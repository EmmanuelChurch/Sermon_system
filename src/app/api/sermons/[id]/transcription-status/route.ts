import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Simulated progress for demo purposes (in a real app, this would come from the database)
const progressCache = new Map<string, {
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  lastUpdated: number;
}>();

// Function to get simulated progress
const getSimulatedProgress = (transcriptionId: string) => {
  const now = Date.now();
  
  // If we don't have a record for this ID, create one
  if (!progressCache.has(transcriptionId)) {
    progressCache.set(transcriptionId, {
      progress: 5,
      status: 'pending',
      message: 'Initializing transcription job...',
      lastUpdated: now
    });
  }
  
  const record = progressCache.get(transcriptionId)!;
  
  // Only update if it's been at least 2 seconds since last update
  if (now - record.lastUpdated < 2000) {
    return record;
  }
  
  // Update progress based on current status
  if (record.status === 'pending' && record.progress >= 10) {
    record.status = 'processing';
    record.message = 'Processing audio file...';
  }
  
  // Increase progress based on current state
  if (record.status === 'pending') {
    record.progress = Math.min(10, record.progress + 5);
    record.message = 'Preparing audio file for transcription...';
  } else if (record.status === 'processing') {
    record.progress = Math.min(95, record.progress + 15);
    
    if (record.progress < 30) {
      record.message = 'Analyzing audio quality...';
    } else if (record.progress < 50) {
      record.message = 'Converting speech to text...';
    } else if (record.progress < 70) {
      record.message = 'Processing transcription segments...';
    } else {
      record.message = 'Finalizing transcription...';
    }
    
    // Completed
    if (record.progress >= 95) {
      record.status = 'completed';
      record.progress = 100;
      record.message = 'Transcription complete!';
    }
  }
  
  record.lastUpdated = now;
  return record;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sermonId = (await params).id;
    const url = new URL(request.url);
    const transcriptionId = url.searchParams.get('id');
    
    if (!transcriptionId) {
      return NextResponse.json(
        { error: 'Missing transcription ID' },
        { status: 400 }
      );
    }
    
    // Create Supabase client
    const supabase = supabaseAdmin;
    
    // Check if there's a real transcription in the database
    const { data: sermon, error } = await supabase
      .from('sermons')
      .select('transcription_status, transcription')
      .eq('id', sermonId)
      .single();
    
    if (error) {
      console.error('Error fetching sermon:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sermon information' }, 
        { status: 500 }
      );
    }
    
    // If the sermon has a transcription, it's complete
    if (sermon.transcription) {
      return NextResponse.json({
        status: 'completed',
        progress: 100,
        message: 'Transcription is complete',
        transcriptionId
      });
    }
    
    // For demo purposes, use simulated progress
    const progress = getSimulatedProgress(transcriptionId);
    
    return NextResponse.json({
      status: progress.status,
      progress: progress.progress,
      message: progress.message,
      transcriptionId
    });
  } catch (error) {
    console.error('Error checking transcription status:', error);
    return NextResponse.json(
      { error: 'Failed to check transcription status' }, 
      { status: 500 }
    );
  }
} 