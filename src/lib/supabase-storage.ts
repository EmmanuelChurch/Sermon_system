import { supabaseClient } from './supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload an audio file to Supabase Storage
 * @param file The audio file to upload (client-side File object)
 * @param fileName Optional custom file name
 * @param onProgress Optional progress callback
 * @returns A Promise that resolves to the uploaded file's public URL
 */
export async function uploadAudioToSupabase(
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string; path: string }> {
  try {
    // Generate a unique file path
    const uniquePath = `${uuidv4()}/${fileName}`;
    
    // Log upload details
    console.log(`Uploading to Supabase Storage: ${uniquePath}, size: ${file.size} bytes`);
    
    // Create upload options
    const options = {
      cacheControl: '3600',
      upsert: false,
    };
    
    // Create a wrapper around the supabase upload that supports progress events
    if (onProgress) {
      // Create a custom XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
      
      // Create a promise that resolves when the upload completes
      const uploadPromise = new Promise<{ url: string; path: string }>((resolve, reject) => {
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Get the public URL for the file
            const { data } = supabaseClient.storage
              .from('sermons')
              .getPublicUrl(uniquePath);
            
            resolve({ url: data.publicUrl, path: uniquePath });
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload aborted'));
      });
      
      // Start the upload using the standard Supabase client
      // We can't use the XHR directly with Supabase's client
      const { data, error } = await supabaseClient.storage
        .from('sermons')
        .upload(uniquePath, file, options);
      
      if (error) throw error;
      
      return uploadPromise;
    } else {
      // Standard upload without progress tracking
      const { data, error } = await supabaseClient.storage
        .from('sermons')
        .upload(uniquePath, file, options);
      
      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }
      
      // Get the public URL for the file
      const { data: urlData } = supabaseClient.storage
        .from('sermons')
        .getPublicUrl(uniquePath);
      
      return { url: urlData.publicUrl, path: uniquePath };
    }
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
}

/**
 * Delete a file from Supabase Storage
 * @param path The path of the file to delete
 */
export async function deleteFileFromSupabase(path: string): Promise<void> {
  try {
    const { error } = await supabaseClient.storage
      .from('sermons')
      .remove([path]);
    
    if (error) {
      console.error('Error deleting file from Supabase:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    throw error;
  }
}

/**
 * Create a presigned URL for client-side upload direct to Supabase
 * This is useful for very large files that you want to upload directly from the client
 * @param fileName The name of the file to upload
 * @returns A Promise that resolves to the presigned URL
 */
export async function createPresignedUploadUrl(fileName: string): Promise<{
  url: string;
  path: string;
  token: string;
}> {
  try {
    const uniquePath = `${uuidv4()}/${fileName}`;
    
    const { data, error } = await supabaseClient.storage
      .from('sermons')
      .createSignedUploadUrl(uniquePath);
    
    if (error) {
      console.error('Error creating presigned URL:', error);
      throw new Error(`Failed to create upload URL: ${error.message}`);
    }
    
    return {
      url: data.signedUrl,
      path: uniquePath,
      token: data.token,
    };
  } catch (error) {
    console.error('Error creating presigned URL:', error);
    throw error;
  }
} 