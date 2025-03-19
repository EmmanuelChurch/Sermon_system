import { supabaseClient, supabaseAdmin } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Get the storage access key from environment variables
const STORAGE_ACCESS_KEY = process.env.SUPABASE_STORAGE_KEY;

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
    
    // Check if we have a storage access key
    const hasAccessKey = !!STORAGE_ACCESS_KEY;
    console.log(`Using storage access key: ${hasAccessKey ? 'Yes' : 'No'}`);
    
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
      upsert: true, // Change to true to overwrite existing files
    };
    
    // Function to handle the actual upload with access key if available
    const performUpload = async (useAdmin = false) => {
      // If we have a direct access key, use that method
      if (hasAccessKey && typeof window !== 'undefined') {
        console.log('Using direct upload with storage access key');
        
        // Create the form data for the upload
        const formData = new FormData();
        formData.append('file', file);
        
        // Get the Supabase URL from the client
        const supabaseUrl = supabaseClient.storageUrl ?? 'https://tdvvffdccfsvllwuueps.supabase.co';
        const bucketName = 'sermons';
        
        // Build the direct upload URL using the access key
        const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${uniquePath}`;
        
        // Perform the direct upload with fetch
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STORAGE_ACCESS_KEY}`,
          },
          body: formData,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Direct upload failed: ${response.status} ${errorText}`);
        }
        
        const responseData = await response.json();
        return responseData;
      }
      
      // Fall back to regular client if no access key or not in browser
      const client = useAdmin ? supabaseAdmin : supabaseClient;
      console.log(`Attempting upload with ${useAdmin ? 'admin' : 'anonymous'} client`);
      
      const { data, error } = await client.storage
        .from('sermons')
        .upload(uniquePath, file, options);
        
      if (error) {
        // Check if it's an RLS (row level security) error
        if (error.message?.includes('row-level security') || 
            error.message?.includes('Unauthorized') || 
            error.statusCode === 403) {
          
          if (!useAdmin) {
            console.log('Unauthorized error, retrying with admin client');
            // Retry with admin client if this was the anonymous client
            return performUpload(true);
          } else {
            console.error('Still unauthorized even with admin client');
            throw error;
          }
        }
        
        throw error;
      }
      
      return data;
    };
    
    // Create a wrapper around the supabase upload that supports progress events
    if (onProgress) {
      try {
        // Standard upload with progress tracking approximation
        // First, update to 10% to show initial progress
        onProgress(10);
        
        // Try upload with client first, falls back to admin if needed
        try {
          await performUpload();
        } catch (error) {
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
      try {
        // Try upload with client first, falls back to admin if needed
        await performUpload();
        
        // Get the public URL for the file
        const { data: urlData } = supabaseClient.storage
          .from('sermons')
          .getPublicUrl(uniquePath);
        
        return { url: urlData.publicUrl, path: uniquePath };
      } catch (error: any) {
        // Handle specific error cases
        if (error.message?.includes('bucket') || error.message?.includes('not found')) {
          console.error('Supabase bucket not found. Please ensure the "sermons" bucket exists.');
          throw new Error('Storage bucket not configured: Please contact the administrator');
        }
        
        if (error.message?.includes('auth') || error.message?.includes('permission')) {
          console.error('Supabase authentication or permission error:', error);
          throw new Error('Storage permission denied: Please contact the administrator');
        }
        
        console.error('Supabase upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }
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