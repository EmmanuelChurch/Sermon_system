import { NextResponse } from 'next/server';
import { getPodcastFileUrl } from '@/lib/audio-processor';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sermonId = params.id;
    const url = getPodcastFileUrl(sermonId);
    
    return NextResponse.json({ 
      url,
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error getting podcast URL:', error);
    return NextResponse.json({ 
      error: 'Failed to get podcast URL',
      url: null
    }, { status: 500 });
  }
} 