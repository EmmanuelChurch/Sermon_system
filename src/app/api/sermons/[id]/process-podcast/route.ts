import { NextRequest, NextResponse } from 'next/server';
import { getSermonById } from '@/lib/local-storage';
import { downloadAudioFile } from '@/lib/openai-whisper';
import { processSermonAudio } from '@/lib/audio-processor';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sermonId = params.id;
    
    if (!sermonId) {
      return NextResponse.json(
        { error: 'Sermon ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Processing sermon ${sermonId} for podcast use`);
    
    // Get the sermon
    const sermon = getSermonById(sermonId);
    
    if (!sermon) {
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
    }
    
    // Check if audio URL exists
    if (!sermon.audiourl) {
      return NextResponse.json(
        { error: 'Sermon has no audio file' },
        { status: 400 }
      );
    }
    
    // Download the audio file
    const tempDir = path.join(os.tmpdir(), 'sermon-process', sermonId);
    const tempFile = path.join(tempDir, `${uuidv4()}.mp3`);
    
    try {
      console.log(`Downloading audio file from ${sermon.audiourl}`);
      const audioFilePath = await downloadAudioFile(sermon.audiourl, tempFile);
      
      // Process the audio with intro/outro and normalize
      console.log('Processing audio for podcast use...');
      const podcastPath = await processSermonAudio(audioFilePath, sermonId);
      
      console.log(`Successfully created podcast version at ${podcastPath}`);
      
      return NextResponse.json({
        success: true,
        message: 'Podcast version created successfully',
        podcastUrl: `/api/podcast/${sermonId}_podcast.mp3`
      });
    } catch (error) {
      console.error('Error processing sermon for podcast:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to process sermon for podcast' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in podcast processing endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 