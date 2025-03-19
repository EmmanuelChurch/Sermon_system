import { NextRequest, NextResponse } from 'next/server';
import { saveSermon } from '@/lib/local-storage';
import { v4 as uuidv4 } from 'uuid';

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
    const savedSermon = await saveSermon(sermon);
    
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