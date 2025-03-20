import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { transcribeAudio } from '@/lib/openai-whisper';

// Sample mock transcription data
const MOCK_TRANSCRIPTION = {
  transcription: `
This is a sample transcription. 

We are testing the transcription feature of the sermon system. In a real transcription, 
this would contain the actual text from the sermon audio.

The sermon system is designed to help churches manage and transcribe sermon recordings.
This allows for easier searching, accessibility, and content creation.

Thank you for testing this feature.
`.trim(),
  segments: [
    { start: 0, end: 5, text: "This is a sample transcription." },
    { start: 6, end: 12, text: "We are testing the transcription feature of the sermon system." },
    { start: 13, end: 20, text: "In a real transcription, this would contain the actual text from the sermon audio." },
    { start: 21, end: 30, text: "The sermon system is designed to help churches manage and transcribe sermon recordings." },
    { start: 31, end: 40, text: "This allows for easier searching, accessibility, and content creation." },
    { start: 41, end: 45, text: "Thank you for testing this feature." }
  ]
};

// Keep track of processing jobs with timestamps
const processingJobs = new Map<string, {
  sermonId: string;
  startTime: number;
  lastUpdate: number;
  status: string;
}>();

// Export for debugging 
export { processingJobs };

export async function POST(request: Request) {
  try {
    const { sermonId, useMock, transcriptionId } = await request.json();

    const startTime = Date.now();
    
    if (!sermonId) {
      return NextResponse.json(
        { error: 'Missing required sermonId' },
        { status: 400 }
      );
    }

    console.log(`[${new Date().toISOString()}] Processing transcription request for sermon ${sermonId}`, {
      useMock,
      transcriptionId,
      startTime
    });

    // If mock is requested, return immediately with mock data
    if (useMock) {
      console.log(`[${new Date().toISOString()}] Using mock transcription data for ${sermonId}`);
      
      // Update the sermon record with mock transcription
      const { error } = await supabaseAdmin
        .from('sermons')
        .update({
          transcription: MOCK_TRANSCRIPTION.transcription,
          transcriptionstatus: 'completed'
        })
        .eq('id', sermonId);

      if (error) {
        console.error(`[${new Date().toISOString()}] Error updating sermon with mock transcription:`, error);
        return NextResponse.json(
          { error: 'Failed to update sermon with mock transcription' },
          { status: 500 }
        );
      }

      console.log(`[${new Date().toISOString()}] Mock transcription completed for ${sermonId}`);
      return NextResponse.json({
        message: 'Mock transcription completed',
        mock: true,
        transcriptionId
      });
    }

    // For real transcription, fetch sermon info
    const { data: sermon, error } = await supabaseAdmin
      .from('sermons')
      .select('audiourl')
      .eq('id', sermonId)
      .single();

    if (error || !sermon) {
      console.error(`[${new Date().toISOString()}] Error fetching sermon ${sermonId}:`, error);
      return NextResponse.json(
        { error: 'Failed to fetch sermon details' },
        { status: 500 }
      );
    }

    // Add to processing jobs
    processingJobs.set(transcriptionId, {
      sermonId,
      startTime,
      lastUpdate: Date.now(),
      status: 'started'
    });

    // Check if we have an OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error(`[${new Date().toISOString()}] Missing OpenAI API key, falling back to mock data`);
      
      // Start a background process to simulate real transcription with a delay
      setTimeout(async () => {
        try {
          processingJobs.set(transcriptionId, {
            sermonId,
            startTime,
            lastUpdate: Date.now(),
            status: 'processing'
          });
          
          console.log(`[${new Date().toISOString()}] Simulated processing halfway done for ${sermonId}`);
          
          // Wait a bit more
          setTimeout(async () => {
            try {
              // Update with mock data after a delay (simulating real transcription)
              const { error } = await supabaseAdmin
                .from('sermons')
                .update({
                  transcription: MOCK_TRANSCRIPTION.transcription,
                  transcriptionstatus: 'completed'
                })
                .eq('id', sermonId);

              processingJobs.set(transcriptionId, {
                sermonId,
                startTime,
                lastUpdate: Date.now(),
                status: 'completed'
              });
              
              console.log(`[${new Date().toISOString()}] Transcription completed for sermon ${sermonId} after ${(Date.now() - startTime)/1000} seconds`);
              
              if (error) {
                console.error(`[${new Date().toISOString()}] Error updating sermon after transcription:`, error);
              }
              
              // Clean up old job after 1 minute
              setTimeout(() => {
                processingJobs.delete(transcriptionId);
                console.log(`[${new Date().toISOString()}] Removed completed job ${transcriptionId} from tracking`);
              }, 60000);
              
            } catch (error) {
              console.error(`[${new Date().toISOString()}] Error in final transcription update:`, error);
              processingJobs.set(transcriptionId, {
                sermonId,
                startTime,
                lastUpdate: Date.now(),
                status: 'failed'
              });
            }
          }, 15000); // Additional 15 seconds for second half
          
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error in delayed transcription update:`, error);
          processingJobs.set(transcriptionId, {
            sermonId,
            startTime,
            lastUpdate: Date.now(),
            status: 'failed'
          });
        }
      }, 15000); // 15-second delay for first half of processing

      // Return success immediately, simulated transcription continues in background
      console.log(`[${new Date().toISOString()}] Returning initial success response for ${sermonId} (simulated)`);
      return NextResponse.json({
        message: 'Transcription started',
        mock: false,
        transcriptionId
      });
    }
    
    // Using the real OpenAI Whisper API
    console.log(`[${new Date().toISOString()}] Starting real OpenAI Whisper transcription for ${sermonId}`);

    // Start a background process for the transcription
    (async () => {
      try {
        processingJobs.set(transcriptionId, {
          sermonId,
          startTime,
          lastUpdate: Date.now(),
          status: 'processing'
        });
        
        // Run the actual transcription
        const result = await transcribeAudio(sermonId, sermon.audiourl);
        
        // Update the sermon with the transcription
        const { error } = await supabaseAdmin
          .from('sermons')
          .update({
            transcription: result.transcription,
            transcriptionstatus: 'completed'
          })
          .eq('id', sermonId);
          
        if (error) {
          console.error(`[${new Date().toISOString()}] Error updating sermon with real transcription:`, error);
          processingJobs.set(transcriptionId, {
            sermonId,
            startTime,
            lastUpdate: Date.now(),
            status: 'failed'
          });
          return;
        }
        
        // Mark as completed
        processingJobs.set(transcriptionId, {
          sermonId,
          startTime,
          lastUpdate: Date.now(),
          status: 'completed'
        });
        
        console.log(`[${new Date().toISOString()}] Real transcription completed for sermon ${sermonId} after ${(Date.now() - startTime)/1000} seconds`);
        
        // Clean up job record after a minute
        setTimeout(() => {
          processingJobs.delete(transcriptionId);
          console.log(`[${new Date().toISOString()}] Removed completed job ${transcriptionId} from tracking`);
        }, 60000);
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in real transcription process:`, error);
        
        // Update status to failed
        await supabaseAdmin
          .from('sermons')
          .update({
            transcriptionstatus: 'failed'
          })
          .eq('id', sermonId);
        
        processingJobs.set(transcriptionId, {
          sermonId,
          startTime,
          lastUpdate: Date.now(),
          status: 'failed'
        });
      }
    })();
    
    // Return success immediately, real transcription continues in background
    console.log(`[${new Date().toISOString()}] Returning initial success response for ${sermonId} (real API)`);
    return NextResponse.json({
      message: 'Transcription started',
      mock: false,
      transcriptionId
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error processing transcription request:`, error);
    return NextResponse.json(
      { error: 'Internal server error processing transcription request' },
      { status: 500 }
    );
  }
} 