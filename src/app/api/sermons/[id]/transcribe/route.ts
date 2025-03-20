import { NextRequest, NextResponse } from "next/server";
import { transcribeWithOpenAI } from "@/lib/openai-whisper";
import { updateSermonTranscriptionStatus } from "@/lib/local-storage"; // Keep for fallback
import { supabaseAdmin } from "@/lib/supabase";

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
    
    // Get the sermon from Supabase
    const { data: sermon, error } = await supabaseAdmin
      .from('sermons')
      .select('*')
      .eq('id', sermonId)
      .single();
    
    if (error || !sermon) {
      console.error(`Sermon not found in Supabase: ${sermonId}`, error);
      
      // Try fallback to local storage
      try {
        console.log(`Attempting to fetch sermon from local storage: ${sermonId}`);
        const localSermon = await updateSermonTranscriptionStatus(sermonId, 'checking');
        
        if (!localSermon) {
          console.error(`Sermon not found in local storage either: ${sermonId}`);
          return NextResponse.json(
            { error: 'Sermon not found' },
            { status: 404 }
          );
        }
        
        // Process using local storage
        console.log(`Using local storage for sermon ${sermonId}`);
      } catch (localError) {
        console.error(`Local storage fallback also failed: ${localError}`);
        return NextResponse.json(
          { error: 'Sermon not found' },
          { status: 404 }
        );
      }
    }
    
    // Check if sermon has audio URL (from DB or provided in the request)
    const audioUrl = providedAudioUrl || (sermon ? sermon.audiourl : null);
    
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
      
      // Update sermon with mock transcription in Supabase
      const { error: updateError } = await supabaseAdmin
        .from('sermons')
        .update({
          transcription: 'This is a mock transcription for testing purposes.',
          transcriptionstatus: 'completed'
        })
        .eq('id', sermonId);
      
      if (updateError) {
        console.error(`Error updating sermon with mock transcription:`, updateError);
        return NextResponse.json(
          { error: 'Failed to update sermon with mock transcription' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        mock: true,
        message: 'Mock transcription completed'
      });
    }
    
    // Start real transcription
    console.log(`Starting real transcription for sermon ${sermonId}`);
    
    // Update status to processing in Supabase
    const { error: processingError } = await supabaseAdmin
      .from('sermons')
      .update({
        transcriptionstatus: 'processing'
      })
      .eq('id', sermonId);
    
    if (processingError) {
      console.error(`Error updating transcription status to processing:`, processingError);
      // Continue anyway
    }
    
    // Start transcription in background
    try {
      // We'll use the OpenAI Whisper integration
      
      // Fire and forget - we'll use the status updates to track progress
      transcribeWithOpenAI(sermonId, audioUrl)
        .then(async (transcript) => {
          console.log(`Transcription completed for sermon ${sermonId}`);
          
          // Update sermon with transcription in Supabase
          const { error: transcriptionError } = await supabaseAdmin
            .from('sermons')
            .update({
              transcription: transcript,
              transcriptionstatus: 'completed'
            })
            .eq('id', sermonId);
          
          if (transcriptionError) {
            console.error(`Error updating sermon with transcription:`, transcriptionError);
            
            // Try fallback to local storage
            try {
              await updateSermonTranscriptionStatus(sermonId, 'completed', transcript);
              console.log(`Used local storage fallback for transcription result`);
            } catch (localError) {
              console.error(`Local storage fallback also failed:`, localError);
            }
          }
        })
        .catch(async (error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`Transcription error for sermon ${sermonId}: ${err.message}`);
          
          // Update sermon with error in Supabase
          const { error: errorUpdateError } = await supabaseAdmin
            .from('sermons')
            .update({
              transcriptionstatus: 'failed',
              transcription_error: err.message || 'Unknown error'
            })
            .eq('id', sermonId);
          
          if (errorUpdateError) {
            console.error(`Error updating sermon with transcription error:`, errorUpdateError);
            
            // Try fallback to local storage
            try {
              await updateSermonTranscriptionStatus(sermonId, 'failed', undefined, err.message || 'Unknown error');
              console.log(`Used local storage fallback for transcription error`);
            } catch (localError) {
              console.error(`Local storage fallback also failed:`, localError);
            }
          }
        });
      
      return NextResponse.json({
        success: true,
        message: 'Transcription started'
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Error starting transcription: ${err.message}`);
      
      // Update sermon with error in Supabase
      const { error: errorUpdateError } = await supabaseAdmin
        .from('sermons')
        .update({
          transcriptionstatus: 'failed',
          transcription_error: err.message || 'Unknown error'
        })
        .eq('id', sermonId);
      
      if (errorUpdateError) {
        console.error(`Error updating sermon with transcription error:`, errorUpdateError);
        
        // Try fallback to local storage
        try {
          await updateSermonTranscriptionStatus(sermonId, 'failed', undefined, err.message || 'Unknown error');
          console.log(`Used local storage fallback for transcription error`);
        } catch (localError) {
          console.error(`Local storage fallback also failed:`, localError);
        }
      }
      
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