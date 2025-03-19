import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import path from 'path';
import fs from 'fs';
import { transcribeWithLocalWhisper } from '@/lib/local-whisper';

// Mock transcription function for development purposes
async function mockTranscribeAudio(filePath: string): Promise<string> {
  console.log(`Mock transcribing file: ${filePath}`);
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Return a mock transcription
  return `This is a mock transcription of the sermon. 
  
  In the beginning, God created the heavens and the earth. The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters.
  
  And God said, "Let there be light," and there was light. And God saw that the light was good. And God separated the light from the darkness. God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.
  
  Thank you for listening to this sermon. May God bless you.`;
}

export async function POST(request: NextRequest) {
  try {
    const { sermonId, useMock } = await request.json();
    console.log('Transcription requested for sermon ID:', sermonId);
    console.log('Use mock transcription:', useMock ? 'Yes' : 'No');

    if (!sermonId) {
      return NextResponse.json(
        { error: 'Missing sermon ID' },
        { status: 400 }
      );
    }

    // Get the sermon record from Supabase
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

    console.log('Found sermon:', sermon.id, sermon.title, sermon.audiourl);

    // Update the sermon status to 'processing'
    const { error: updateError } = await supabaseAdmin
      .from('sermons')
      .update({ transcriptionstatus: 'processing' })
      .eq('id', sermonId);

    if (updateError) {
      console.error('Failed to update sermon status:', updateError);
      throw new Error(`Failed to update sermon status: ${updateError.message}`);
    }

    try {
      // Use mock transcription if explicitly requested
      if (useMock === true) {
        console.log('Using mock transcription as requested');
        const transcription = await mockTranscribeAudio("mock-requested");
        
        // Update the sermon record with the mock transcription
        const { error: saveError } = await supabaseAdmin
          .from('sermons')
          .update({
            transcription,
            transcriptionstatus: 'completed',
            updatedat: new Date().toISOString(),
          })
          .eq('id', sermonId);
          
        if (saveError) {
          throw new Error(`Failed to save transcription: ${saveError.message}`);
        }
        
        return NextResponse.json({
          success: true,
          message: 'Mock transcription completed',
          mock: true
        });
      }
      
      // Check if the audio URL is an external URL (starts with http or https)
      const isExternalUrl = sermon.audiourl.startsWith('http://') || sermon.audiourl.startsWith('https://');
      let audioUrl = sermon.audiourl;
      let audioPath;
      
      // If it's not an external URL, it's a local file reference
      if (!isExternalUrl) {
        // Extract the filename from the audiourl path
        // The audiourl is in the format '/api/file/filename.ext'
        const audioUrlParts = sermon.audiourl.split('/');
        const audioFileName = audioUrlParts[audioUrlParts.length - 1];
        
        // Get the path to the audio file in the recordings directory
        audioPath = path.join(process.cwd(), 'recordings', audioFileName);
        console.log('Audio file path:', audioPath);
        
        // Check if the file exists
        if (!fs.existsSync(audioPath)) {
          console.error('Audio file not found at:', audioPath);
          // List files in the recordings directory for debugging
          try {
            const recordingsDir = path.join(process.cwd(), 'recordings');
            console.log('Files in recordings directory:', fs.readdirSync(recordingsDir));
          } catch (e) {
            console.error('Error listing recordings directory:', e);
          }
          throw new Error(`Audio file not found at ${audioPath}`);
        }
        
        console.log('Audio file exists:', audioPath);
        
        // Get the public URL for the audio file
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004';
        audioUrl = `${baseUrl}${sermon.audiourl}`;
      }
      
      // For external URLs, use our proxy to avoid CORS issues
      if (audioUrl && !audioUrl.startsWith('/')) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004';
        const proxyUrl = `${baseUrl}/api/proxy?url=${encodeURIComponent(audioUrl)}`;
        console.log('Using proxy for external URL:', audioUrl);
        console.log('Proxy URL:', proxyUrl);
        audioUrl = proxyUrl;
      }
      
      console.log('Audio URL for transcription:', audioUrl);
      
      // Transcribe the audio file using Local Whisper
      let transcription;
      
      try {
        console.log('Starting transcription with Local Whisper');
        transcription = await transcribeWithLocalWhisper(audioUrl);
        console.log('Transcription completed successfully. Length:', transcription?.length || 0);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Transcription error with Local Whisper:', err.message);
        console.error('Error details:', err);
        
        // Update sermon status to failed
        await supabaseAdmin
          .from('sermons')
          .update({
            transcriptionstatus: 'failed',
            updatedat: new Date().toISOString(),
          })
          .eq('id', sermonId);
        
        return NextResponse.json({
          success: false,
          error: `Transcription error: ${err.message}`,
        }, { status: 500 });
      }

      // Update the sermon record with the transcription
      const { error: saveError } = await supabaseAdmin
        .from('sermons')
        .update({
          transcription,
          transcriptionstatus: 'completed',
          updatedat: new Date().toISOString(),
        })
        .eq('id', sermonId);

      if (saveError) {
        console.error('Failed to save transcription:', saveError);
        throw new Error(`Failed to save transcription: ${saveError.message}`);
      }

      console.log('Transcription saved successfully for sermon:', sermonId);

      return NextResponse.json({
        success: true,
        message: 'Transcription completed successfully',
      });
    } catch (transcriptionError: unknown) {
      const err = transcriptionError instanceof Error ? transcriptionError : new Error(String(transcriptionError));
      console.error('Transcription error:', err.message);
      
      // Update the sermon status to 'failed' if transcription fails
      await supabaseAdmin
        .from('sermons')
        .update({
          transcriptionstatus: 'failed',
          updatedat: new Date().toISOString(),
        })
        .eq('id', sermonId);

      throw err;
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error transcribing sermon:', err.message, err.stack);
    return NextResponse.json(
      { error: err.message || 'Failed to transcribe sermon' },
      { status: 500 }
    );
  }
} 