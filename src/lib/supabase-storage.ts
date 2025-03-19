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
    
    try {
      // Test if Supabase client is available by getting storage bucket details
      const { data, error } = await supabaseClient.storage.getBucket('sermons');
      
      if (error) {
        console.error('Error checking Supabase bucket:', error.message);
        // Continue anyway, might be just permissions issue
      } else {
        console.log('Successfully connected to Supabase storage:', data?.name);
      }
    } catch (error) {
      console.warn('Error checking Supabase connection:', error);
      // Continue anyway, the upload might still work
    }
    
    // Create upload options
    const options = {
      cacheControl: '3600',
      upsert: false,
    };
    
    // Create a wrapper around the supabase upload that supports progress events
    if (onProgress) {
      try {
        // Standard upload with progress tracking approximation
        // First, update to 10% to show initial progress
        onProgress(10);
        
        const { data, error } = await supabaseClient.storage
          .from('sermons')
          .upload(uniquePath, file, options);
        
        if (error) {
          console.error('Supabase upload error:', error);
          throw error;
        }
        
        // Update to 90% after upload completes
        onProgress(90);
        
        // Get the public URL for the file
        const { data: urlData } = supabaseClient.storage
          .from('sermons')
          .getPublicUrl(uniquePath);
        
        if (!urlData.publicUrl) {
          throw new Error('Failed to get public URL after upload');
        }
        
        // Final progress update
        onProgress(100);
        
        return { url: urlData.publicUrl, path: uniquePath };
      } catch (error) {
        console.error('Error with progress tracking upload:', error);
        throw error;
      }
    } else {
      // Standard upload without progress tracking
      const { data, error } = await supabaseClient.storage
        .from('sermons')
        .upload(uniquePath, file, options);
      
      if (error) {
        // Handle specific error cases
        if (error.message.includes('bucket') || error.message.includes('not found')) {
          console.error('Supabase bucket not found. Please ensure the "sermons" bucket exists.');
          throw new Error('Storage bucket not configured: Please contact the administrator');
        }
        
        if (error.message.includes('auth') || error.message.includes('permission')) {
          console.error('Supabase authentication or permission error:', error);
          throw new Error('Storage permission denied: Please contact the administrator');
        }
        
        console.error('Supabase upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }
      
      // Get the public URL for the file
      const { data: urlData } = supabaseClient.storage
        .from('sermons')
        .getPublicUrl(uniquePath);
      
      return { url: urlData.publicUrl, path: uniquePath };
    }
  } catch (error: any) {
    console.error('Error uploading to Supabase:', error);
    
    // Fallback handling for common errors
    if (error.message?.includes('Invalid Supabase configuration')) {
      throw new Error('Supabase storage is not properly configured. Please check your environment settings.');
    }
    
    if (error.message?.includes('Network Error') || error.message?.includes('Failed to fetch')) {
      throw new Error('Network error while uploading. Please check your internet connection and try again.');
    }
    
    // Rethrow with clear message
    throw error.message ? error : new Error('Unknown error during file upload');
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
  } catch (error: any) {
    console.error('Error deleting from Supabase:', error);
    throw error.message ? error : new Error('Unknown error during file deletion');
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
    
    if (!data) {
      throw new Error('No data returned from signed URL creation');
    }
    
    return {
      url: data.signedUrl,
      path: uniquePath,
      token: data.token,
    };
  } catch (error: any) {
    console.error('Error creating presigned URL:', error);
    throw error.message ? error : new Error('Unknown error creating upload URL');
  }
} 