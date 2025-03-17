import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('Debug: Checking all transcription statuses');
    
    // Query for all sermons with their transcription status
    const { data, error } = await supabaseAdmin
      .from('sermons')
      .select('id, title, transcriptionstatus, createdat, updatedat')
      .order('updatedat', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('Error fetching sermon statuses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sermon statuses' },
        { status: 500 }
      );
    }
    
    // For tracking active transcriptions
    let activeTranscriptions: Array<{
      id: string;
      status: string;
      progress: number;
      message: string;
      lastUpdated: string;
    }> = [];
    
    // Get list of processing jobs
    let processingJobs: Array<{
      id: string;
      sermonId: string;
      status: string;
      startTime: string;
      lastUpdate: string;
      duration: string;
    }> = [];
    
    try {
      const transcriptionModule = require('../../transcription/route');
      if (transcriptionModule && transcriptionModule.processingJobs) {
        processingJobs = Array.from(transcriptionModule.processingJobs.entries())
          .map(entry => {
            const [id, job] = entry as [string, any];
            const startTime = new Date(job.startTime);
            const lastUpdate = new Date(job.lastUpdate);
            const durationMs = Date.now() - job.startTime;
            const durationSec = Math.floor(durationMs / 1000);
            const durationMin = Math.floor(durationSec / 60);
            
            let duration = '';
            if (durationMin > 0) {
              duration = `${durationMin}m ${durationSec % 60}s`;
            } else {
              duration = `${durationSec}s`;
            }
            
            // Also add to active transcriptions for UI display with progress
            const progress = Math.min(95, Math.floor((durationMs / 30000) * 100)); // 30 seconds total time
            activeTranscriptions.push({
              id,
              status: job.status,
              progress,
              message: `Transcription ${job.status} (${duration})`,
              lastUpdated: new Date(job.lastUpdate).toISOString()
            });
            
            return {
              id,
              sermonId: job.sermonId,
              status: job.status,
              startTime: startTime.toISOString(),
              lastUpdate: lastUpdate.toISOString(),
              duration
            };
          });
      }
    } catch (e) {
      console.error('Failed to access processing jobs:', e);
    }
    
    // Get information about server uptime
    const serverInfo = {
      uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json({
      sermons: data,
      activeTranscriptions,
      processingJobs,
      serverInfo,
      timestamp: new Date().toISOString(),
      note: 'This endpoint shows the status of all recent sermons and any active transcription jobs'
    });
  } catch (error) {
    console.error('Error in transcription debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error checking transcription status' },
      { status: 500 }
    );
  }
}

// Helper function to format uptime
function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  
  return parts.join(' ');
} 