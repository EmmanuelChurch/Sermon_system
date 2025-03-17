import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase';

// Endpoint to list recording files
export async function GET() {
  try {
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
        lastModified: stats.mtime.toISOString()
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
      { error: error instanceof Error ? error.message : 'Failed to list recordings' },
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
    
    // Define paths
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
        transcriptionstatus: 'pending',
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
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