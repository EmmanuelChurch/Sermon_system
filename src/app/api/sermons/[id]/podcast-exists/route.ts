import { NextResponse } from 'next/server';
import { podcastVersionExists } from '@/lib/audio-processor';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sermonId = params.id;
    const exists = podcastVersionExists(sermonId);
    
    return NextResponse.json({ 
      exists,
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error checking podcast existence:', error);
    return NextResponse.json({ 
      error: 'Failed to check podcast existence' 
    }, { status: 500 });
  }
} 