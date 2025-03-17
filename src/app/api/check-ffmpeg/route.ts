import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

// Define the FFmpeg path finding function directly in this file for testing
async function findFfmpegPath(): Promise<string | null> {
  // Paths to check for FFmpeg
  const possiblePaths = [
    // Path from env variable (if set)
    process.env.FFMPEG_PATH,
    
    // Common Windows paths
    'D:/EmmanuelChurchLondon/ffmpeg/bin/ffmpeg.exe',
    'D:/EmmanuelChurchLondon/ffmpeg/ffmpeg.exe',
    'C:/ffmpeg/bin/ffmpeg.exe',
    'C:/Program Files/ffmpeg/bin/ffmpeg.exe',
    
    // Look in PATH (just the name, will search PATH)
    'ffmpeg',
    'ffmpeg.exe'
  ].filter(Boolean) as string[]; // Filter out nulls/undefineds
  
  console.log('Searching for FFmpeg in the following locations:', possiblePaths);
  
  // Check each path to see if the file exists
  for (const pathToCheck of possiblePaths) {
    // Skip checking PATH entries (those without a full path)
    if (!pathToCheck.includes('/') && !pathToCheck.includes('\\')) {
      try {
        // Try running the command via exec to check if it's in PATH
        const { stdout } = await execPromise(`${pathToCheck} -version`);
        if (stdout && stdout.includes('ffmpeg version')) {
          console.log(`FFmpeg found in PATH: ${pathToCheck}`);
          return pathToCheck;
        }
      } catch (err) {
        // Command not found in PATH, continue to next option
      }
      continue;
    }
    
    // Check for explicit path existence
    try {
      if (fs.existsSync(pathToCheck)) {
        console.log(`FFmpeg found at: ${pathToCheck}`);
        return pathToCheck;
      }
    } catch (err) {
      // Error checking path, continue to next option
    }
  }
  
  console.warn('FFmpeg not found in any of the checked locations');
  return null;
}

const execPromise = promisify(exec);

/**
 * Endpoint to check FFmpeg configuration
 */
export async function GET() {
  try {
    // Get FFmpeg path
    const ffmpegPath = await findFfmpegPath();
    
    // Check if file exists
    let fileExists = false;
    if (ffmpegPath && ffmpegPath.includes('/')) {
      try {
        fileExists = fs.existsSync(ffmpegPath);
      } catch (err) {
        // Ignore errors
      }
    }
    
    // Get working directory
    const cwd = process.cwd();
    
    // Try to run ffmpeg directly
    let versionOutput = '';
    let versionError = '';
    try {
      if (ffmpegPath) {
        const cmd = ffmpegPath.includes(' ') ? `"${ffmpegPath}" -version` : `${ffmpegPath} -version`;
        const result = await execPromise(cmd);
        versionOutput = result.stdout.substring(0, 500); // Limit output size
      } else {
        versionOutput = 'FFmpeg path not found';
      }
    } catch (err: any) {
      versionError = err.message || 'Unknown error';
    }
    
    // Get installation instructions
    const installInstructions = `
    To install FFmpeg on Windows:
    
    1. Download FFmpeg from https://github.com/BtbN/FFmpeg-Builds/releases
       (Get the latest ffmpeg-master-latest-win64-gpl.zip)
    2. Extract the zip file to a folder (e.g., D:/EmmanuelChurchLondon/ffmpeg)
    3. Make sure the bin folder contains ffmpeg.exe
    4. Update your .env.local file with:
       FFMPEG_PATH=D:/EmmanuelChurchLondon/ffmpeg/bin/ffmpeg.exe
    `;
    
    // Return response
    return NextResponse.json({
      success: !!ffmpegPath,
      ffmpegPath,
      fileExists,
      workingDirectory: cwd,
      versionOutput,
      versionError,
      installInstructions,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        FFMPEG_PATH: process.env.FFMPEG_PATH,
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 