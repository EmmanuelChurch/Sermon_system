import { NextResponse } from 'next/server';
import { checkAudioFileExists } from '@/lib/audio-processor';

export async function POST(request: Request) {
  try {
    const { action, filePath } = await request.json();
    
    switch(action) {
      case 'checkExists':
        if (!filePath) {
          return NextResponse.json({ error: 'Missing filePath parameter' }, { status: 400 });
        }
        const exists = await checkAudioFileExists(filePath);
        return NextResponse.json({ exists });
        
      default:
        return NextResponse.json({ 
          error: 'Invalid action. Note: Podcast functionality has been removed.' 
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in audio processor API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 