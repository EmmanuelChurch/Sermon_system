import { NextRequest, NextResponse } from 'next/server';
import { saveSermon, saveAudioFile, getSermons } from '@/lib/local-storage';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all sermons');
    const sermons = await getSermons();
    
    if (!sermons || !Array.isArray(sermons)) {
      console.error('No sermons found or invalid format', sermons);
      return NextResponse.json({
        sermons: []
      });
    }
    
    console.log(`Found ${sermons.length} sermons`);
    
    return NextResponse.json({
      sermons
    });
  } catch (error) {
    console.error('Error fetching sermons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sermons', sermons: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Get form fields
    const title = formData.get('title') as string;
    const speaker = formData.get('speaker') as string;
    const date = formData.get('date') as string;
    const audioFile = formData.get('audioFile') as File;
    const audioUrl = formData.get('audioUrl') as string;
    
    if (!title || !speaker || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (!audioFile && !audioUrl) {
      return NextResponse.json(
        { error: 'No audio file or URL provided' },
        { status: 400 }
      );
    }
    
    // Generate a unique ID for the sermon
    const sermonId = uuidv4();
    
    let finalAudioUrl = '';
    
    // Handle audio file upload
    if (audioFile) {
      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filename = audioFile.name;
        
        const { url } = saveAudioFile(buffer, filename, sermonId);
        finalAudioUrl = url;
      } catch (err) {
        console.error('Error saving audio file:', err);
        return NextResponse.json(
          { error: 'Failed to save audio file' },
          { status: 500 }
        );
      }
    } else if (audioUrl) {
      // For external URLs, store directly
      finalAudioUrl = audioUrl;
    }
    
    // Save sermon data
    const sermon = {
      id: sermonId,
      title,
      speaker,
      date,
      audiourl: finalAudioUrl,
      transcriptionstatus: 'not_started',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    saveSermon(sermon);
    
    return NextResponse.json({
      id: sermonId,
      message: 'Sermon created successfully',
    });
  } catch (error) {
    console.error('Error creating sermon:', error);
    return NextResponse.json(
      { error: 'Failed to create sermon' },
      { status: 500 }
    );
  }
} 