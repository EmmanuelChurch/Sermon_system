import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase';

// Helper function to check if running in Vercel
const isVercel = () => {
  return process.env.VERCEL || process.env.VERCEL_ENV;
};

// Endpoint to list recording files
export async function GET() {
  try {
    // In Vercel production, use Supabase to list sermons
    if (isVercel()) {
      console.log('Running in Vercel environment, using Supabase to list recordings');
      
      try {
        // Get sermons from Supabase
        const { data: sermons, error } = await supabaseAdmin
          .from('sermons')
          .select('id, title, audiourl, speaker, date, created_at')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching recordings from Supabase:', error);
          throw error;
        }
        
        // Transform to recordings format
        const recordings = sermons
          .filter(sermon => sermon.audiourl) // Only include sermons with audio
          .map(sermon => {
            // Extract filename from audiourl
            const url = sermon.audiourl;
            const name = url.split('/').pop() || `sermon-${sermon.id}.mp3`;
            
            return {
              name,
              id: sermon.id,
              title: sermon.title || name,
              speaker: sermon.speaker || 'Unknown',
              size: 0, // Size unknown for remote files
              type: 'mp3',
              lastModified: sermon.created_at || new Date().toISOString(),
              url: sermon.audiourl
            };
          });
          
        return NextResponse.json({
          recordings
        });
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
        return NextResponse.json({
          recordings: []
        });
      }
    }
    
    // Local development: read from filesystem
    const recordingsDir = path.join(process.cwd(), 'recordings');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
      return NextResponse.json({
        recordings: []
      });
    }
    
    // Read the directory contents
    const files = fs.readdirSync(recordingsDir);
    
    // Get file stats for each recording
    const recordings = files.map(file => {
      const filePath = path.join(recordingsDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        type: path.extname(file).slice(1).toLowerCase(),
        lastModified: stats.mtime.toISOString(),
        url: `/api/file/${file}`
      };
    }).filter(file => {
      // Filter audio files
      const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
      return audioExtensions.includes(file.type);
    });
    
    return NextResponse.json({
      recordings
    });
  } catch (error) {
    console.error('Error listing recordings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list recordings', recordings: [] },
      { status: 500 }
    );
  }
}

// Endpoint to use an existing recording file
export async function POST(request: NextRequest) {
  try {
    const { fileName, title, speaker, date } = await request.json();
    
    if (!fileName || !title || !speaker || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // For Vercel: create a sermon record with the provided info
    if (isVercel()) {
      // Create a unique ID for the sermon
      const sermonId = uuidv4();
      
      // In Vercel, we'll assume the fileName is already a valid URL
      const isUrl = fileName.startsWith('http');
      const audioUrl = isUrl ? fileName : `/api/file/${fileName}`;
      
      // Insert sermon record into Supabase
      const { data, error } = await supabaseAdmin
        .from('sermons')
        .insert({
          id: sermonId,
          title,
          speaker,
          date,
          audiourl: audioUrl,
          transcriptionstatus: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating sermon from recording in Supabase:', error);
        return NextResponse.json(
          { error: `Failed to create sermon record: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        sermon: data
      });
    }
    
    // For local development: check if the file exists in the recordings directory
    const recordingsDir = path.join(process.cwd(), 'recordings');
    const sourceFile = path.join(recordingsDir, fileName);
    
    // Check if source file exists
    if (!fs.existsSync(sourceFile)) {
      return NextResponse.json(
        { error: 'Recording file not found' },
        { status: 404 }
      );
    }
    
    // Create a unique ID for the sermon
    const sermonId = uuidv4();
    
    // Create a URL for the file that will be served by our API
    const fileUrl = `/api/file/${fileName}`;
    
    // Insert sermon record into Supabase
    const { data, error } = await supabaseAdmin
      .from('sermons')
      .insert({
        id: sermonId,
        title,
        speaker,
        date,
        audiourl: fileUrl,
        transcriptionstatus: 'pending'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to create sermon record: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sermon: data
    });
  } catch (error) {
    console.error('Error creating sermon from recording:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create sermon' },
      { status: 500 }
    );
  }
} 