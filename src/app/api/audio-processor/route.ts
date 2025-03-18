import { NextResponse } from 'next/server';
import { 
  processSermonAudio, 
  getPodcastFileUrl, 
  podcastVersionExists, 
  getPodcastFilePath 
} from '@/lib/audio-processor';

export async function POST(request: Request) {
  try {
    const { action, sermonId, inputAudioPath } = await request.json();
    
    switch(action) {
      case 'processAudio':
        if (!sermonId || !inputAudioPath) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }
        const outputPath = await processSermonAudio(inputAudioPath, sermonId);
        return NextResponse.json({ success: true, outputPath });
        
      case 'podcastExists':
        if (!sermonId) {
          return NextResponse.json({ error: 'Missing sermonId' }, { status: 400 });
        }
        const exists = podcastVersionExists(sermonId);
        return NextResponse.json({ exists });
        
      case 'getPodcastUrl':
        if (!sermonId) {
          return NextResponse.json({ error: 'Missing sermonId' }, { status: 400 });
        }
        const url = getPodcastFileUrl(sermonId);
        return NextResponse.json({ url });
        
      case 'getPodcastPath':
        if (!sermonId) {
          return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
        }
        const path = getPodcastFilePath(sermonId);
        return NextResponse.json({ path });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in audio processor API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 