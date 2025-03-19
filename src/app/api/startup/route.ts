import { NextResponse } from 'next/server';
import { ensureDirectoriesExist } from '@/lib/local-storage';

// This route runs application startup checks
export async function GET() {
  console.log('Running application startup checks...');
  
  try {
    // Ensure local storage directories exist
    ensureDirectoriesExist();
    
    return NextResponse.json({
      status: 'ok',
      message: 'Application startup checks completed successfully',
      storage: 'local',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in application startup checks:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Application startup checks failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 