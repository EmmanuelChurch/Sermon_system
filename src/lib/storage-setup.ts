import { supabaseAdmin } from './supabase';

/**
 * Ensures that the necessary storage buckets exist in Supabase
 */
export async function ensureStorageBuckets() {
  console.log('Checking Supabase storage buckets...');

  try {
    // Get list of existing buckets
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    
    if (error) {
      console.error('Error getting storage buckets:', error);
      return;
    }
    
    const existingBuckets = buckets.map(bucket => bucket.name);
    console.log('Existing buckets:', existingBuckets);
    
    // Check if 'sermons' bucket exists
    if (!existingBuckets.includes('sermons')) {
      console.log('Creating "sermons" bucket...');
      
      const { data, error: createError } = await supabaseAdmin.storage.createBucket('sermons', {
        public: true,
        fileSizeLimit: 104857600, // 100MB limit (reduced from 500MB)
        allowedMimeTypes: [
          'audio/mpeg', 
          'audio/mp3', 
          'audio/mp4',
          'audio/ogg',
          'audio/wav',
          'audio/webm',
          'audio/*'
        ]
      });
      
      if (createError) {
        console.error('Error creating sermons bucket:', createError);
      } else {
        console.log('Successfully created sermons bucket');
      }
    } else {
      console.log('Sermons bucket already exists');
    }
    
    // Set bucket to public
    const { error: updateError } = await supabaseAdmin.storage.updateBucket('sermons', {
      public: true
    });
    
    if (updateError) {
      console.error('Error updating bucket visibility:', updateError);
    } else {
      console.log('Successfully updated bucket visibility');
    }
    
  } catch (err) {
    console.error('Error in storage bucket setup:', err);
  }
} 