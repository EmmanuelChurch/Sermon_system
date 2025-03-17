import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

/**
 * Simple endpoint to test FFmpeg
 */
export async function GET() {
  try {
    // Get the configured FFmpeg path
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    
    // Check if file exists (if it's a path)
    let fileExists = false;
    if (ffmpegPath.includes('/') || ffmpegPath.includes('\\')) {
      try {
        fileExists = fs.existsSync(ffmpegPath);
      } catch (err) {
        // Ignore errors
      }
    }
    
    // Try running FFmpeg directly
    let versionOutput = '';
    let versionError = '';
    try {
      const cmd = ffmpegPath.includes(' ') ? `"${ffmpegPath}" -version` : `${ffmpegPath} -version`;
      const result = await execPromise(cmd);
      versionOutput = result.stdout.substring(0, 300);
    } catch (e: any) {
      versionError = e.message;
    }
    
    return NextResponse.json({
      ffmpegPath,
      fileExists,
      versionOutput: versionOutput || null,
      versionError: versionError || null,
      env: {
        FFMPEG_PATH: process.env.FFMPEG_PATH,
      }
    });
  } catch (error: any) {
    console.error('Error checking FFmpeg:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check FFmpeg' },
      { status: 500 }
    );
  }
} 