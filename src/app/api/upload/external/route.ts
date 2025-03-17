import { NextRequest, NextResponse } from 'next/server';
import { saveSermon } from '@/lib/local-storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert a Dropbox share link to a direct download link
 * 
 * @param url Dropbox URL (e.g., https://www.dropbox.com/scl/fi/...)
 * @returns Direct download URL (e.g., https://dl.dropboxusercontent.com/scl/fi/...)
 */
function convertDropboxUrl(url: string): string {
  // Check if this is a Dropbox URL
  if (url.includes('dropbox.com')) {
    try {
      // Parse the URL to get its components
      const urlObj = new URL(url);
      
      // Extract the path without query parameters
      const path = urlObj.pathname;
      
      // Create direct download URL
      return `https://dl.dropboxusercontent.com${path}`;
    } catch (error) {
      console.error('Error converting Dropbox URL:', error);
    }
  }
  
  // Return the original URL if not a Dropbox URL or if conversion failed
  return url;
}

export async function POST(request: NextRequest) {
  try {
    console.log('External URL sermon upload request received');
    
    const body = await request.json();
    const { title, speaker, date, audioUrl } = body;
    
    // Validate inputs
    if (!title || !speaker || !date || !audioUrl) {
      return NextResponse.json(
        { error: 'Required fields are missing' },
        { status: 400 }
      );
    }
    
    // Generate a unique ID for the sermon
    const sermonId = uuidv4();
    
    // Create sermon object with external URL
    const sermon = {
      id: sermonId,
      title,
      speaker,
      date,
      audiourl: audioUrl,
      transcription: null,
      transcriptionstatus: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Save the sermon to local storage
    const savedSermon = saveSermon(sermon);
    
    return NextResponse.json({
      success: true,
      sermon: savedSermon
    });
  } catch (error) {
    console.error('Error uploading sermon with external URL:', error);
    return NextResponse.json(
      { error: 'Failed to upload sermon with external URL' },
      { status: 500 }
    );
  }
} 