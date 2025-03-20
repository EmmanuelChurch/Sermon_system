import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAudioFilePath } from '@/lib/local-storage';
import fs from 'fs';

// API endpoint to update a sermon's audio file
export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get sermon ID from params
    const params = await Promise.resolve(context.params);
    const sermonId = params.id;
    
    if (!sermonId) {
      return NextResponse.json(
        { error: 'Missing sermon ID' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const { recordingFile, externalUrl } = await request.json();
    
    // We need either a recording file or an external URL
    if (!recordingFile && !externalUrl) {
      return NextResponse.json(
        { error: 'Either recordingFile or externalUrl is required' },
        { status: 400 }
      );
    }
    
    // Get current sermon to update
    const { data: sermon, error: fetchError } = await supabaseAdmin
      .from('sermons')
      .select('*')
      .eq('id', sermonId)
      .single();
    
    if (fetchError || !sermon) {
      console.error('Error fetching sermon:', fetchError);
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
    }
    
    let audioUrl;
    
    // Handle existing recording file
    if (recordingFile) {
      // Use the recordings directory path
      const recordingsDir = process.env.RECORDINGS_DIR || 'recordings';
      const sourceFile = `${recordingsDir}/${recordingFile}`;
      
      // Create a URL that will be served by our API
      audioUrl = `/api/file/${recordingFile}`;
      
      // Check if recording exists
      if (process.env.NODE_ENV !== 'production') {
        if (!fs.existsSync(sourceFile)) {
          console.warn(`Warning: Recording file does not exist at ${sourceFile}`);
        }
      }
    } 
    // Handle external URL
    else if (externalUrl) {
      audioUrl = externalUrl;
    }
    
    // Update the sermon with the new audioUrl
    const { error: updateError } = await supabaseAdmin
      .from('sermons')
      .update({
        audiourl: audioUrl,
      })
      .eq('id', sermonId);
    
    if (updateError) {
      console.error('Error updating sermon:', updateError);
      return NextResponse.json(
        { error: 'Failed to update sermon audio' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Audio URL updated successfully',
      audioUrl
    });
  } catch (error) {
    console.error('Error updating sermon audio:', error);
    return NextResponse.json(
      { error: 'Failed to update sermon audio' },
      { status: 500 }
    );
  }
} 