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
 * @param maxRetries Maximum number of retries per chunk
 */
export async function uploadFileInChunks(
  file: File,
  uploadUrl: string,
  formData: Record<string, string>,
  onProgress: (progress: number) => void,
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void,
  maxRetries: number = 3
): Promise<any> {
  try {
    const { chunks, totalChunks, originalFileName, originalFileSize, fileType } = 
      await splitFileIntoChunks(file);
    
    console.log(`Splitting file into ${totalChunks} chunks for upload, each ~${Math.round(file.size/totalChunks/1024)}KB`);
    
    // Generate a unique upload ID for this file
    const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    let completedChunks = 0;
    let failedChunks: number[] = [];
    const chunkResponses: any[] = [];
    
    // Upload each chunk sequentially
    for (const { chunk, index } of chunks) {
      let retries = 0;
      let success = false;
      
      while (retries < maxRetries && !success) {
        try {
          console.log(`Uploading chunk ${index + 1}/${totalChunks} (${(chunk.size / 1024).toFixed(1)}KB)`);
          
          if (retries > 0) {
            console.log(`Retry #${retries} for chunk ${index + 1}/${totalChunks}`);
            onProgress(Math.round((completedChunks / totalChunks) * 100));
          }
          
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
          
          // Verify the server received the chunk
          if (!responseData.success) {
            throw new Error(`Server reported failure for chunk ${index + 1}/${totalChunks}`);
          }
          
          // Add the response for this chunk
          chunkResponses.push(responseData);
          
          // Success!
          success = true;
          completedChunks++;
          
          // Calculate and report progress
          const progress = Math.round((completedChunks / totalChunks) * 100);
          onProgress(progress);
          
          if (onChunkComplete) {
            onChunkComplete(index, totalChunks);
          }
          
          // If this is the last chunk, add a small delay before finalizing
          // to ensure the server has fully processed it
          if (index === totalChunks - 1) {
            console.log('Last chunk uploaded, waiting before finalizing...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          retries++;
          console.error(`Error uploading chunk ${index + 1}/${totalChunks}:`, error);
          
          if (retries >= maxRetries) {
            console.error(`Failed to upload chunk ${index + 1}/${totalChunks} after ${maxRetries} retries`);
            failedChunks.push(index);
          }
          
          // Wait a short time before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // If we couldn't upload this chunk after all retries, track it
      if (!success) {
        failedChunks.push(index);
      }
    }
    
    // Check for failed chunks
    if (failedChunks.length > 0) {
      throw new Error(`Failed to upload ${failedChunks.length} chunks: ${failedChunks.join(', ')}`);
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
    
    let finalizeRetries = 0;
    const MAX_FINALIZE_RETRIES = 5; // Increase max retries for finalization specifically
    
    while (finalizeRetries < MAX_FINALIZE_RETRIES) {
      try {
        console.log(`Finalizing upload, attempt ${finalizeRetries + 1}/${MAX_FINALIZE_RETRIES}...`);
        
        // Add a longer delay before first finalization attempt
        if (finalizeRetries === 0) {
          console.log('Waiting 2 seconds before first finalization attempt...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const finalizeResponse = await fetch(`${uploadUrl}/finalize`, {
          method: 'POST',
          body: finalizeFormData,
        });
        
        if (!finalizeResponse.ok) {
          const errorData = await finalizeResponse.json();
          const errorMessage = errorData.error || 'Failed to finalize upload';
          
          // If we're getting "not all chunks received" but we uploaded all of them,
          // wait longer and try again
          if (errorMessage.includes('Not all chunks were received') && finalizeRetries < MAX_FINALIZE_RETRIES - 1) {
            console.log('Server reports missing chunks despite uploading all chunks. Retrying after delay...');
            await new Promise(resolve => setTimeout(resolve, 3000 * (finalizeRetries + 1)));
            finalizeRetries++;
            continue;
          }
          
          throw new Error(errorMessage);
        }
        
        return finalizeResponse.json();
      } catch (error) {
        finalizeRetries++;
        console.error(`Error finalizing upload (attempt ${finalizeRetries}/${MAX_FINALIZE_RETRIES}):`, error);
        
        if (finalizeRetries >= MAX_FINALIZE_RETRIES) {
          throw error;
        }
        
        // Wait longer between retries, with increasing backoff
        const delayMs = 2000 * finalizeRetries;
        console.log(`Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw new Error('Failed to finalize upload after multiple attempts');
  } catch (error) {
    console.error('Error in chunked upload:', error);
    throw error;
  }
} 