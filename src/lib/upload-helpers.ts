/**
 * Helper utilities for chunked file uploads
 */

// Maximum chunk size (4MB to stay under Vercel's 4.5MB limit)
export const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB in bytes

/**
 * Split a file into chunks
 * @param file The file to split
 * @param chunkSize The maximum size of each chunk in bytes
 * @returns An array of file chunks with metadata
 */
export async function splitFileIntoChunks(file: File, chunkSize: number = MAX_CHUNK_SIZE) {
  const totalChunks = Math.ceil(file.size / chunkSize);
  const chunks: { chunk: Blob; index: number; totalChunks: number }[] = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunk = file.slice(start, end);
    
    chunks.push({
      chunk: chunk,
      index: i,
      totalChunks: totalChunks
    });
  }
  
  return {
    chunks,
    totalChunks,
    originalFileName: file.name,
    originalFileSize: file.size,
    fileType: file.type,
  };
}

/**
 * Upload a file in chunks to the server
 * @param file The file to upload
 * @param uploadUrl The URL to upload to
 * @param formData Additional form data to include with each chunk
 * @param onProgress Progress callback (0-100)
 * @param onChunkComplete Callback when a chunk is complete
 */
export async function uploadFileInChunks(
  file: File,
  uploadUrl: string,
  formData: Record<string, string>,
  onProgress: (progress: number) => void,
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void
): Promise<any> {
  try {
    const { chunks, totalChunks, originalFileName, originalFileSize, fileType } = 
      await splitFileIntoChunks(file);
    
    console.log(`Splitting file into ${totalChunks} chunks for upload`);
    
    // Generate a unique upload ID for this file
    const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    let completedChunks = 0;
    const chunkResponses: any[] = [];
    
    // Upload each chunk sequentially
    for (const { chunk, index } of chunks) {
      console.log(`Uploading chunk ${index + 1}/${totalChunks}`);
      
      const chunkFormData = new FormData();
      
      // Add the chunk with metadata
      chunkFormData.append('chunk', chunk, originalFileName);
      chunkFormData.append('chunkIndex', index.toString());
      chunkFormData.append('totalChunks', totalChunks.toString());
      chunkFormData.append('uploadId', uploadId);
      chunkFormData.append('originalFileName', originalFileName);
      chunkFormData.append('originalFileSize', originalFileSize.toString());
      chunkFormData.append('fileType', fileType);
      
      // Add additional form data
      Object.entries(formData).forEach(([key, value]) => {
        chunkFormData.append(key, value);
      });
      
      // Upload this chunk
      const response = await fetch(`${uploadUrl}/chunks`, {
        method: 'POST',
        body: chunkFormData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to upload chunk ${index + 1}/${totalChunks}`);
      }
      
      const responseData = await response.json();
      chunkResponses.push(responseData);
      
      completedChunks++;
      
      // Calculate and report progress
      const progress = Math.round((completedChunks / totalChunks) * 100);
      onProgress(progress);
      
      if (onChunkComplete) {
        onChunkComplete(index, totalChunks);
      }
    }
    
    console.log('All chunks uploaded, now finalizing...');
    
    // All chunks uploaded, now finalize the upload
    const finalizeFormData = new FormData();
    finalizeFormData.append('uploadId', uploadId);
    finalizeFormData.append('totalChunks', totalChunks.toString());
    finalizeFormData.append('originalFileName', originalFileName);
    
    // Add additional form data
    Object.entries(formData).forEach(([key, value]) => {
      finalizeFormData.append(key, value);
    });
    
    const finalizeResponse = await fetch(`${uploadUrl}/finalize`, {
      method: 'POST',
      body: finalizeFormData,
    });
    
    if (!finalizeResponse.ok) {
      const errorData = await finalizeResponse.json();
      throw new Error(errorData.error || 'Failed to finalize upload');
    }
    
    return finalizeResponse.json();
  } catch (error) {
    console.error('Error in chunked upload:', error);
    throw error;
  }
} 