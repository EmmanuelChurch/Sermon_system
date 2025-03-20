import { S3Client, PutObjectCommand, GetObjectCommand, 
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const createS3Client = () => {
  // Check for required credentials
  const region = process.env.AWS_REGION || "eu-north-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  
  // Log environment variables status (not the actual values)
  console.log(`AWS Config Status:
    Region: ${region ? 'Set' : 'Missing'}
    Access Key: ${accessKeyId ? 'Set' : 'Missing'}
    Secret Key: ${secretAccessKey ? 'Set' : 'Missing'}
    Bucket Name: ${bucketName ? 'Set' : 'Missing'}
  `);
  
  // Validate credentials before creating client
  if (!accessKeyId || !secretAccessKey) {
    console.error('Missing AWS credentials. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in your environment variables.');
    
    // For local development only, use empty strings to allow code to continue
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using empty credentials in development mode. S3 operations will fail but app will continue running.');
    }
  }
  
  if (!bucketName) {
    console.error('Missing AWS_S3_BUCKET_NAME environment variable. S3 operations will fail.');
  }
  
  // Create and return the client
  return new S3Client({
    region,
    credentials: {
      accessKeyId: accessKeyId || "",
      secretAccessKey: secretAccessKey || ""
    }
  });
};

const s3Client = createS3Client();

// Bucket name from environment variable
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "";

/**
 * Upload a file to S3 with progress tracking
 */
export async function uploadAudioToS3(
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string }> {
  try {
    // Validate bucket name before proceeding
    if (!BUCKET_NAME) {
      throw new Error("AWS_S3_BUCKET_NAME environment variable is not set");
    }
    
    // Generate a unique path for the file
    const key = `sermons/${Date.now()}-${fileName}`;
    
    // For large files, use multipart upload
    if (file.size > 100 * 1024 * 1024) { // 100MB threshold
      return uploadLargeFileToS3(file, key, onProgress);
    }
    
    // For smaller files, use direct upload
    // Convert File/Blob to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // Report start of upload
    onProgress?.(0);
    
    // Create upload command
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: Buffer.from(fileBuffer),
      ContentType: file.type || "audio/mpeg",
    });
    
    // Upload to S3
    await s3Client.send(command);
    
    // Report completion
    onProgress?.(100);
    
    // Return the URL
    const region = process.env.AWS_REGION || "eu-north-1";
    const url = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
    return { url };
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error(`Failed to upload to S3: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Upload a large file to S3 using multipart upload
 */
async function uploadLargeFileToS3(
  file: File | Blob,
  key: string, 
  onProgress?: (progress: number) => void
): Promise<{ url: string }> {
  // Create a multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: file.type || "audio/mpeg"
  });
  
  let uploadId: string | undefined;
  try {
    const { UploadId } = await s3Client.send(createCommand);
    if (!UploadId) throw new Error("Failed to get uploadId");
    uploadId = UploadId;
    
    // Optimal chunk size for S3 multipart upload (5MB minimum)
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts: { ETag: string; PartNumber: number }[] = [];
    
    console.log(`Uploading file in ${chunks} chunks of ${CHUNK_SIZE/1024/1024}MB each`);
    
    // Process each chunk
    for (let i = 0; i < chunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      
      // Slice the file to get this chunk
      const chunk = file.slice(start, end);
      const chunkBuffer = await chunk.arrayBuffer();
      
      // Upload this part
      const uploadPartCommand = new UploadPartCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        PartNumber: i + 1,
        UploadId: uploadId,
        Body: Buffer.from(chunkBuffer)
      });
      
      // Upload the part and get the ETag
      const { ETag } = await s3Client.send(uploadPartCommand);
      
      if (!ETag) throw new Error(`Failed to upload part ${i + 1}`);
      
      // Add this part to our completed parts
      parts.push({
        ETag: ETag,
        PartNumber: i + 1
      });
      
      // Report progress
      const progress = Math.round(((i + 1) / chunks) * 100);
      onProgress?.(progress);
      console.log(`Uploaded part ${i + 1}/${chunks} (${progress}%)`);
    }
    
    // Complete the multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    });
    
    await s3Client.send(completeCommand);
    console.log("Multipart upload completed successfully");
    
    // Return the URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return { url };
  } catch (error) {
    // If there was an uploadId created, abort the multipart upload
    if (uploadId) {
      try {
        await s3Client.send(new AbortMultipartUploadCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          UploadId: uploadId
        }));
        console.log("Multipart upload aborted due to error");
      } catch (abortError) {
        console.error("Error aborting multipart upload:", abortError);
      }
    }
    
    console.error("Error in multipart upload:", error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a pre-signed URL for uploading directly to S3
 */
export async function getS3UploadUrl(fileName: string): Promise<{ uploadUrl: string, fileUrl: string }> {
  try {
    const key = `sermons/${Date.now()}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: "audio/mp3"
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 min expiration
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    
    return { uploadUrl, fileUrl };
  } catch (error) {
    console.error("Error generating S3 upload URL:", error);
    throw new Error(`Failed to generate upload URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}