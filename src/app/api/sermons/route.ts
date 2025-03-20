import { NextRequest, NextResponse } from 'next/server';
import { saveSermon, saveAudioFile, getSermons } from '@/lib/local-storage';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
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
    // Try to parse as JSON first (for AWS S3 uploads)
    let title, speaker, date, audioUrl;
    let formData;
    
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      // Handle JSON request from AWS S3 upload
      const jsonData = await request.json();
      title = jsonData.title;
      speaker = jsonData.speaker;
      date = jsonData.date;
      audioUrl = jsonData.audioUrl;
      console.log('Received JSON data:', { title, speaker, date, audioUrl });
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      // Handle form data for backward compatibility
      formData = await request.formData();
      title = formData.get('title') as string;
      speaker = formData.get('speaker') as string;
      date = formData.get('date') as string;
      audioUrl = formData.get('audioUrl') as string;
      console.log('Received form data:', { title, speaker, date, audioUrl });
    } else {
      console.error('Unsupported content type:', contentType);
      return NextResponse.json(
        { error: `Unsupported content type: ${contentType}` },
        { status: 400 }
      );
    }
    
    // Get form fields
    if (!title || !speaker || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (!audioUrl) {
      return NextResponse.json(
        { error: 'No audio URL provided' },
        { status: 400 }
      );
    }
    
    // Generate a unique ID for the sermon
    const sermonId = uuidv4();
    
    // For AWS S3 uploads, we already have the URL
    const finalAudioUrl = audioUrl;
    
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
    
    await saveSermon(sermon);
    
    return NextResponse.json({
      id: sermonId,
      message: 'Sermon created successfully',
    });
  } catch (error) {
    console.error('Error creating sermon:', error);
    return NextResponse.json(
      { error: `Failed to create sermon: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 