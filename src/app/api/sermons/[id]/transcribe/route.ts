import { NextRequest, NextResponse } from "next/server";
import { transcribeWithOpenAI } from "@/lib/openai-whisper";
import { getSermonById, updateSermonTranscriptionStatus } from "@/lib/local-storage";

/**
 * Endpoint to transcribe a sermon
 */
export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Properly await params
    const params = await Promise.resolve(context.params);
    const sermonId = params.id;
    
    const { useMock, audioUrl: providedAudioUrl } = await request.json();
    
    console.log(`Starting transcription for sermon ${sermonId}, useMock=${useMock}`);
    
    // Get the sermon from local storage
    const sermon = await getSermonById(sermonId);
    
    if (!sermon) {
      console.error(`Sermon not found: ${sermonId}`);
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
    }
    
    // Check if sermon has audio URL (from DB or provided in the request)
    const audioUrl = providedAudioUrl || sermon.audiourl;
    
    if (!audioUrl) {
      console.error(`Sermon has no audio URL: ${sermonId}`);
      return NextResponse.json(
        { error: 'Sermon has no audio URL' },
        { status: 400 }
      );
    }
    
    // Handle mock transcription for testing
    if (useMock) {
      console.log(`Using mock transcription for sermon ${sermonId}`);
      
      // Update sermon with mock transcription
      await updateSermonTranscriptionStatus(
        sermonId,
        'completed',
        'This is a mock transcription for testing purposes.'
      );
      
      return NextResponse.json({
        success: true,
        mock: true,
        message: 'Mock transcription completed'
      });
    }
    
    // Start real transcription
    console.log(`Starting real transcription for sermon ${sermonId}`);
    
    // Update status to processing
    await updateSermonTranscriptionStatus(sermonId, 'processing');
    
    // Start transcription in background
    try {
      // We'll use the OpenAI Whisper integration
      
      // Fire and forget - we'll use the status updates to track progress
      transcribeWithOpenAI(sermonId, audioUrl)
        .then(async (transcript) => {
          console.log(`Transcription completed for sermon ${sermonId}`);
          
          // Update sermon with transcription
          await updateSermonTranscriptionStatus(sermonId, 'completed', transcript);
        })
        .catch(async (error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`Transcription error for sermon ${sermonId}: ${err.message}`);
          
          // Update sermon with error
          await updateSermonTranscriptionStatus(sermonId, 'failed', undefined, err.message || 'Unknown error');
        });
      
      return NextResponse.json({
        success: true,
        message: 'Transcription started'
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Error starting transcription: ${err.message}`);
      
      // Update sermon with error
      await updateSermonTranscriptionStatus(sermonId, 'failed', undefined, err.message || 'Unknown error');
      
      return NextResponse.json(
        { error: `Failed to start transcription: ${err.message}` },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('Error in transcription endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process transcription request' },
      { status: 500 }
    );
  }
} 