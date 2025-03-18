import { NextRequest, NextResponse } from 'next/server';
import { getSermons, saveSermon } from '@/lib/local-storage';
import { downloadAudioFile } from '@/lib/openai-whisper';
import { processSermonAudio } from '@/lib/audio-processor';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Sermon } from '@/types';

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
    
    // Get sermon data
    const sermons = await getSermons();
    const sermon = sermons.find((s: Sermon) => s.id === sermonId);
    
    if (!sermon) {
      return NextResponse.json({ error: 'Sermon not found' }, { status: 404 });
    }
    
    if (!sermon.audiourl) {
      return NextResponse.json({ error: 'No audio URL available for this sermon' }, { status: 400 });
    }
    
    // Process audio using our API endpoint
    const processorResponse = await fetch(new URL('/api/audio-processor', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'processAudio',
        sermonId,
        inputAudioPath: sermon.audiourl,
      }),
    });
    
    if (!processorResponse.ok) {
      const error = await processorResponse.json();
      throw new Error(error.error || 'Failed to process podcast');
    }
    
    const processorData = await processorResponse.json();
    
    // Update sermon with podcast URL
    const podcastUrlResponse = await fetch(new URL('/api/audio-processor', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getPodcastUrl',
        sermonId,
      }),
    });
    
    if (podcastUrlResponse.ok) {
      const urlData = await podcastUrlResponse.json();
      
      // Update sermon with podcast URL
      if (urlData.url) {
        sermon.podcasturl = urlData.url;
        await saveSermon(sermon);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      outputPath: processorData.outputPath
    });
    
  } catch (error) {
    console.error('Error processing podcast:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process podcast' 
    }, { status: 500 });
  }
} 