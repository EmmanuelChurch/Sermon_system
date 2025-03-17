import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Sample mock transcription data
const MOCK_TRANSCRIPTION = {
  transcription: `
This is a sample transcription that was auto-completed by the system after detecting a stuck job.

The original transcription process appeared to be stuck or taking too long.
This is placeholder text that is used when a transcription job needs to be force-completed.

Please try transcribing again if you need the actual content.
`.trim(),
  segments: [
    { start: 0, end: 5, text: "This is a sample transcription that was auto-completed by the system after detecting a stuck job." },
    { start: 6, end: 12, text: "The original transcription process appeared to be stuck or taking too long." },
    { start: 13, end: 20, text: "This is placeholder text that is used when a transcription job needs to be force-completed." },
    { start: 21, end: 30, text: "Please try transcribing again if you need the actual content." }
  ]
};

export async function GET() {
  try {
    console.log('[TRANSCRIPTION CHECK] Checking for stuck transcription jobs');
    
    // Get all sermons with status 'processing'
    const { data: stuckSermons, error } = await supabaseAdmin
      .from('sermons')
      .select('id, title, transcriptionstatus, updatedat')
      .eq('transcriptionstatus', 'processing');
    
    if (error) {
      console.error('Error checking for stuck transcriptions:', error);
      return NextResponse.json(
        { error: 'Failed to check for stuck transcriptions' },
        { status: 500 }
      );
    }
    
    const now = new Date();
    const stuckJobs = [];
    
    // Check for any sermons that have been processing for more than 1 minute
    for (const sermon of stuckSermons || []) {
      const updatedAt = new Date(sermon.updatedat);
      const diffMs = now.getTime() - updatedAt.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      
      // If it's been processing for more than 1 minute, mark as stuck
      if (diffMinutes > 1) {
        stuckJobs.push({
          ...sermon,
          minutesStuck: Math.floor(diffMinutes)
        });
      }
    }
    
    // Force complete any stuck jobs
    const completedJobs = [];
    for (const job of stuckJobs) {
      try {
        console.log(`[TRANSCRIPTION CHECK] Force completing stuck job for sermon ${job.id} (stuck for ${job.minutesStuck} minutes)`);
        
        const { error: updateError } = await supabaseAdmin
          .from('sermons')
          .update({
            transcription: MOCK_TRANSCRIPTION.transcription,
            transcriptionstatus: 'completed',
            updatedat: new Date().toISOString()
          })
          .eq('id', job.id);
        
        if (updateError) {
          console.error(`Error force completing sermon ${job.id}:`, updateError);
        } else {
          completedJobs.push(job);
        }
      } catch (error) {
        console.error(`Error processing stuck job ${job.id}:`, error);
      }
    }
    
    return NextResponse.json({
      stuck: stuckJobs,
      completed: completedJobs,
      timestamp: new Date().toISOString(),
      message: stuckJobs.length > 0 
        ? `Found ${stuckJobs.length} stuck jobs, force completed ${completedJobs.length}` 
        : 'No stuck transcription jobs found'
    });
  } catch (error) {
    console.error('Error in transcription check endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error checking transcription status' },
      { status: 500 }
    );
  }
} 