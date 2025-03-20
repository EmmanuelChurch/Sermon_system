import { NextRequest, NextResponse } from 'next/server';
import { getSermons } from '@/lib/local-storage'; // Keep for now for backward compatibility
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

// Helper function to ensure directory exists before writing
async function ensureDirectoryExists(filePath: string) {
  try {
    await mkdir(dirname(filePath), { recursive: true });
  } catch (error) {
    // Directory already exists or creation failed
    console.error("Error creating directory:", error);
  }
}

export async function GET() {
  try {
    console.log('Fetching all sermons from Supabase');
    
    // Fetch sermons from Supabase
    const { data: sermons, error } = await supabaseAdmin
      .from('sermons')
      .select('*')
      .order('created_at', { ascending: false });
    
    console.log('Supabase query executed. Results:', {
      hasError: !!error,
      errorMessage: error?.message,
      sermonsCount: sermons?.length || 0,
      sermonsData: sermons?.slice(0, 2) // Log first two sermons for debugging
    });
    
    if (error) {
      console.error('Error fetching sermons from Supabase:', error);
      throw error;
    }
    
    if (!sermons || !Array.isArray(sermons)) {
      console.error('No sermons found or invalid format', sermons);
      return NextResponse.json({
        sermons: []
      });
    }
    
    // Check for empty array but valid response
    if (sermons.length === 0) {
      console.log('Supabase returned empty array. This appears to be valid (no sermons yet)');
    } else {
      console.log(`Found ${sermons.length} sermons in Supabase`);
    }
    
    return NextResponse.json({
      sermons
    });
  } catch (error) {
    console.error('Error fetching sermons from Supabase:', error);
    
    // Fallback to local storage if Supabase fails
    try {
      console.log('Attempting fallback to local storage');
      const localSermons = await getSermons();
      console.log(`Found ${localSermons?.length || 0} sermons in local storage`);
      
      return NextResponse.json({
        sermons: localSermons || [],
        source: 'local_fallback'
      });
    } catch (fallbackError) {
      console.error('Fallback to local storage also failed:', fallbackError);
      return NextResponse.json(
        { error: 'Failed to fetch sermons', sermons: [] },
        { status: 500 }
      );
    }
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
      console.error('Missing required fields:', { title, speaker, date });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (!audioUrl) {
      console.error('No audio URL provided');
      return NextResponse.json(
        { error: 'No audio URL provided' },
        { status: 400 }
      );
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (!dateIsValid) {
      console.error('Invalid date format:', date);
      // Try to fix common date format issues
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        // Date is valid but in wrong format, convert to YYYY-MM-DD
        date = dateObj.toISOString().split('T')[0];
        console.log('Fixed date format:', date);
      } else {
        return NextResponse.json(
          { error: 'Invalid date format. Please use YYYY-MM-DD format.' },
          { status: 400 }
        );
      }
    }
    
    // Generate a unique ID for the sermon
    const sermonId = uuidv4();
    
    // For AWS S3 uploads, we already have the URL
    const finalAudioUrl = audioUrl;
    
    // Create sermon data
    const sermon = {
      id: sermonId,
      title,
      speaker,
      date,
      audiourl: finalAudioUrl,
      transcriptionstatus: 'not_started',
      created_at: new Date().toISOString(),
    };
    
    // Save to Supabase
    console.log('Saving sermon to Supabase with data:', sermon);
    const { data, error } = await supabaseAdmin
      .from('sermons')
      .insert(sermon)
      .select();
    
    if (error) {
      console.error('Error saving sermon to Supabase:', error);
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    console.log('Sermon saved successfully:', data);
    
    return NextResponse.json({
      id: sermonId,
      message: 'Sermon created successfully in Supabase',
    });
  } catch (error) {
    console.error('Error creating sermon:', error);
    return NextResponse.json(
      { error: `Failed to create sermon: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 