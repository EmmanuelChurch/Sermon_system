import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// API endpoint to update a sermon's audio file
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the sermon ID from the URL params
    const sermonId = (await params).id;
    if (!sermonId) {
      return NextResponse.json(
        { error: 'Missing sermon ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { recordingFile, externalUrl } = body;

    // Check if either a recordingFile or an externalUrl is provided
    if (!recordingFile && !externalUrl) {
      return NextResponse.json(
        { error: 'Missing recording file or external URL' },
        { status: 400 }
      );
    }

    console.log(`Updating sermon ${sermonId} with ${recordingFile ? `recording file ${recordingFile}` : `external URL ${externalUrl}`}`);

    // Make sure the sermon exists
    const { data: sermon, error: fetchError } = await supabaseAdmin
      .from('sermons')
      .select('*')
      .eq('id', sermonId)
      .single();

    if (fetchError || !sermon) {
      console.error('Sermon not found:', fetchError);
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
    }

    let fileUrl;

    // Handle external URL
    if (externalUrl) {
      // Validate the URL
      try {
        new URL(externalUrl);
        fileUrl = externalUrl;
        console.log(`Using external URL: ${fileUrl}`);
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    } 
    // Handle recording file
    else if (recordingFile) {
      // Define paths
      const recordingsDir = path.join(process.cwd(), 'recordings');
      const sourceFile = path.join(recordingsDir, recordingFile);
      
      // Check if source file exists
      if (!fs.existsSync(sourceFile)) {
        console.error(`Recording file not found at ${sourceFile}`);
        return NextResponse.json(
          { error: 'Recording file not found' },
          { status: 404 }
        );
      }
      
      // Create a URL for the file
      fileUrl = `/api/file/${recordingFile}`;
      console.log(`Using local file: ${fileUrl}`);
    }
    
    // Update the sermon record in Supabase
    const { data, error } = await supabaseAdmin
      .from('sermons')
      .update({
        audiourl: fileUrl,
        updatedat: new Date().toISOString()
      })
      .eq('id', sermonId);

    if (error) {
      console.error('Failed to update sermon record:', error);
      return NextResponse.json(
        { error: `Failed to update sermon record: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Sermon audio updated successfully',
      audioUrl: fileUrl
    });
  } catch (error: any) {
    console.error('Error updating sermon audio:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update sermon audio' },
      { status: 500 }
    );
  }
} 