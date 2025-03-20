'use server';

import { supabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { exec } from 'child_process';
import util from 'util';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fsPromises } from 'fs';
import FormData from 'form-data';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { checkAudioFileExists } from './audio-processor';

// Convert exec to Promise-based
const execPromise = util.promisify(exec);

// Constants
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit for OpenAI API
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'D:/EmmanuelChurchLondon/ffmpeg/bin/ffmpeg.exe';

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper function to actually download the audio to a specific path
 */
async function downloadAudioToPath(audioUrl: string, outputPath: string): Promise<string> {
  console.log(`Downloading audio from ${audioUrl} to ${outputPath}`);
  
  // If the file already exists at the output path, return it
  if (fs.existsSync(outputPath)) {
    try {
      // Verify it's a valid audio file
      const stat = fs.statSync(outputPath);
      if (stat.size > 0) {
        console.log(`File already exists at ${outputPath}, using cached version`);
        return outputPath;
      }
    } catch (error) {
      console.warn(`Error checking existing file: ${error}`);
      // Will continue to download a new copy
    }
  }
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  try {
    await fsPromises.mkdir(dir, { recursive: true });
  } catch (err) {
    console.warn(`Could not create directory ${dir}: ${err}`);
    // Continue anyway
  }

  // Handle local API file URLs (starting with /api/file/)
  if (audioUrl.startsWith('/api/file/')) {
    try {
      // Local file, get the filename
      const filename = audioUrl.split('/').pop();
      if (!filename) throw new Error('Invalid filename in audio URL');
      
      // Check for file in local storage
      const localAudioPath = path.join(process.cwd(), 'local-storage', 'audio', filename);
      
      if (fs.existsSync(localAudioPath)) {
        console.log(`Using local file: ${localAudioPath}`);
        // Copy the file to the output path
        await fsPromises.copyFile(localAudioPath, outputPath);
        return outputPath;
      } else {
        throw new Error(`Local audio file not found: ${localAudioPath}`);
      }
    } catch (error) {
      console.error('Error accessing local audio file:', error);
      throw error;
    }
  }
  
  // For external URLs, try fetch first
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || 
      !audioUrl.startsWith('/')) {
    try {
      // Add http/https if the URL doesn't have it (but isn't a local file path)
      let fetchUrl = audioUrl;
      if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://') && !audioUrl.startsWith('/')) {
        fetchUrl = `https://${audioUrl}`;
      }
      
      // For absolute URLs, attempt a regular fetch
      console.log(`Fetching from URL: ${fetchUrl}`);
      const response = await fetch(fetchUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
      }
      
      // Get the audio data
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Write to file
      await fsPromises.writeFile(outputPath, buffer);
      
      console.log(`Successfully downloaded audio to ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`Error downloading with fetch API: ${error}`);
      console.log('Falling back to http.get method...');
      // Fall through to http.get method below
    }
  }

  // Use http/https module as fallback
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const protocol = audioUrl.startsWith('https') ? https : http;
    
    const request = protocol.get(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'audio/*'
      }
    }, (response) => {
      // Check if the request was redirected
      if (response.statusCode === 301 || response.statusCode === 302) {
        const newUrl = response.headers.location;
        if (!newUrl) {
          reject(new Error(`Redirect without location header`));
          return;
        }
        
        console.log(`Following redirect to: ${newUrl}`);
        
        // Close the current request
        request.destroy();
        
        // Follow the redirect
        downloadAudioToPath(newUrl, outputPath)
          .then(resolve)
          .catch(reject);
        
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP status ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Download completed to ${outputPath}`);
        resolve(outputPath);
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file as it might be corrupted
      reject(err);
    });
    
    file.on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file as it might be corrupted
      reject(err);
    });
  });
}

/**
 * Find FFmpeg executable, trying multiple possible locations
 */
export async function findFfmpegPath(): Promise<string | null> {
  // In Vercel Production environment, we need to use a different approach
  const isVercel = process.env.VERCEL === '1';
  
  if (isVercel) {
    console.log('Running in Vercel environment, using PATH for FFmpeg');
    return 'ffmpeg'; // In Vercel, we depend on the system ffmpeg
  }
  
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

/**
 * Check if ffmpeg is installed and available
 */
export async function checkFfmpeg(): Promise<boolean> {
  return new Promise<boolean>(async (resolve) => {
    try {
      // Try to find FFmpeg in various locations
      const ffmpegPath = await findFfmpegPath();
      
      if (!ffmpegPath) {
        console.warn('FFmpeg not found in any location');
        resolve(false);
        return;
      }
      
      console.log(`Using FFmpeg at: ${ffmpegPath}`);
      
      // Set the path for fluent-ffmpeg if we have a full path (not just 'ffmpeg')
      if (ffmpegPath.includes('/') || ffmpegPath.includes('\\')) {
        try {
          ffmpeg.setFfmpegPath(ffmpegPath);
          console.log(`Set FFmpeg path to: ${ffmpegPath}`);
        } catch (error) {
          console.warn(`Error setting FFmpeg path: ${error}`);
        }
      }
      
      // Try running a simple command to verify
      try {
        const cmd = ffmpegPath.includes(' ') ? `"${ffmpegPath}" -version` : `${ffmpegPath} -version`;
        const result = await execPromise(cmd);
        console.log('FFmpeg version check successful:', result.stdout.substring(0, 100));
        resolve(true);
      } catch (err) {
        console.warn(`Error running FFmpeg:`, err);
        resolve(false);
      }
    } catch (error) {
      console.warn(`Error in FFmpeg check:`, error);
      resolve(false);
    }
  });
}

/**
 * Get FFmpeg installation instructions for the current platform
 */
export async function getFfmpegInstallInstructions(): Promise<string> {
  const platform = process.platform;
  
  switch (platform) {
    case 'win32':
      return `
To install FFmpeg on Windows:
1. Download the FFmpeg build from https://github.com/BtbN/FFmpeg-Builds/releases
2. Extract the ZIP file
3. Add the bin folder to your PATH environment variable
4. Restart your terminal/IDE
      `.trim();
    
    case 'darwin':
      return `
To install FFmpeg on macOS using Homebrew:
1. Install Homebrew if not already installed: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
2. Run: brew install ffmpeg
      `.trim();
    
    case 'linux':
      return `
To install FFmpeg on Linux (Ubuntu/Debian):
1. Run: sudo apt update
2. Run: sudo apt install ffmpeg

For other Linux distributions, please consult your package manager.
      `.trim();
    
    default:
      return 'Please install FFmpeg for your platform to enable audio compression.';
  }
}

/**
 * Compress audio file to reduce its size
 * Pass sermon ID if you want to process for podcast too
 */
export async function compressAudioFile(
  inputPath: string,
  sermonId?: string,
  targetSizeBytes: number = MAX_FILE_SIZE
): Promise<string> {
  const isVercel = process.env.VERCEL === '1';
  
  // First check if the file exists
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // Get file size
  const stats = fs.statSync(inputPath);
  const fileSizeBytes = stats.size;
  
  // If file is already small enough, return the original path
  if (fileSizeBytes <= targetSizeBytes) {
    console.log(`File is already under ${targetSizeBytes / (1024 * 1024)}MB (${fileSizeBytes / (1024 * 1024)}MB), no compression needed`);
    return inputPath;
  }
  
  // Generate output path
  const parsedPath = path.parse(inputPath);
  
  // Ensure temp directory exists with proper handling for Vercel
  const tempBaseDir = isVercel ? '/tmp' : os.tmpdir();
  // Create a dedicated subdirectory for better organization
  const outputDir = path.join(tempBaseDir, 'audio-compression');
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  }
  
  const outputPath = path.join(outputDir, `${parsedPath.name}_compressed.mp3`);
  
  console.log(`File size ${fileSizeBytes / (1024 * 1024)}MB exceeds limit of ${targetSizeBytes / (1024 * 1024)}MB, compressing...`);
  
  try {
    // Get the FFmpeg path (using our enhanced method)
    const ffmpegPath = await findFfmpegPath();
    
    if (!ffmpegPath) {
      throw new Error('FFmpeg not found. Cannot compress audio file.');
    }
    
    // Set the path if it's a full path
    if (ffmpegPath.includes('/') || ffmpegPath.includes('\\')) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
    
    // Calculate compression level based on file size
    // For files significantly over the limit, use more aggressive compression
    let targetBitrate = 96; // Default bitrate: 96kbps
    const audioChannels = 1;  // Default: mono
    let sampleRate = 22050; // Default: 22.05 kHz
    
    // Calculate how much we need to compress
    const compressionRatio = targetSizeBytes / fileSizeBytes;
    
    if (compressionRatio < 0.9 && compressionRatio >= 0.7) {
      // Moderate compression needed
      targetBitrate = 80;
      sampleRate = 22050;
    } else if (compressionRatio < 0.7 && compressionRatio >= 0.5) {
      // Strong compression needed
      targetBitrate = 64;
      sampleRate = 16000;
    } else if (compressionRatio < 0.5) {
      // Very aggressive compression needed
      targetBitrate = 48;
      sampleRate = 16000;
    }
    
    console.log(`Using compression settings: ${targetBitrate}kbps, ${audioChannels} channels, ${sampleRate}Hz sample rate`);
    
    // Process the audio file
    return new Promise((resolve, reject) => {
      // Run compression with fluent-ffmpeg
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(targetBitrate)
        .audioChannels(audioChannels)
        .audioFrequency(sampleRate)
        .on('error', (err: any) => {
          console.error('Error compressing audio:', err);
          reject(new Error(`FFmpeg compression error: ${err.message}`));
        })
        .on('end', async () => {
          // Check if output file exists and is smaller
          if (fs.existsSync(outputPath)) {
            const newStats = fs.statSync(outputPath);
            console.log(`Compressed file size: ${newStats.size / (1024 * 1024)}MB (original: ${fileSizeBytes / (1024 * 1024)}MB)`);
            
            // If file is still too large, try a second pass with more aggressive settings
            if (newStats.size > targetSizeBytes) {
              console.log('File still too large, applying second pass compression...');
              
              // Generate a second output path (use same output directory logic)
              const secondPassPath = path.join(outputDir, `${parsedPath.name}_compressed_2.mp3`);
              
              // Apply more aggressive compression
              ffmpeg(outputPath)
                .audioCodec('libmp3lame')
                .audioBitrate(32) // Very low bitrate
                .audioChannels(1)
                .audioFrequency(8000) // Low quality but ensures small size
                .on('error', (err: any) => {
                  console.error('Error in second pass compression:', err);
                  // Still return the first compressed version
                  resolve(outputPath);
                })
                .on('end', async () => {
                  if (fs.existsSync(secondPassPath)) {
                    const finalStats = fs.statSync(secondPassPath);
                    console.log(`Second pass compression: ${finalStats.size / (1024 * 1024)}MB`);
                    resolve(secondPassPath);
                  } else {
                    // Use the first compressed version if second fails
                    resolve(outputPath);
                  }
                })
                .save(secondPassPath);
            } else {
              resolve(outputPath);
            }
          } else {
            reject(new Error('Compression failed: output file not created'));
          }
        })
        .save(outputPath);
    });
  } catch (error) {
    console.error('Error during compression setup:', error);
    throw new Error(`Failed to compress audio file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Download an audio file from a URL
 */
export async function downloadAudioFile(audioUrl: string, localPath?: string): Promise<string> {
  // Generate a unique temp file path if not provided
  // Use /tmp in production (serverless) environments where /var/task is read-only
  const tempBaseDir = process.env.NODE_ENV === 'production' 
    ? '/tmp'
    : path.join(process.cwd(), 'temp');
    
  console.log(`Using temp directory for audio: ${tempBaseDir} for environment: ${process.env.NODE_ENV}`);
  
  // Create the temp directory if it doesn't exist
  try {
    await fsPromises.mkdir(tempBaseDir, { recursive: true });
  } catch (err) {
    console.error(`Error creating audio temp directory: ${tempBaseDir}`, err);
    // Fall back to OS temp directory
    const osTempDir = os.tmpdir();
    console.log(`Falling back to OS temp directory: ${osTempDir}`);
    const outputPath = localPath || path.join(osTempDir, `${uuidv4()}.mp3`);
    return downloadAudioToPath(audioUrl, outputPath);
  }
  
  const tempAudioDir = path.join(tempBaseDir, 'audio');
  
  // Create the nested audio directory
  try {
    await fsPromises.mkdir(tempAudioDir, { recursive: true });
  } catch (err) {
    console.error(`Error creating nested audio directory: ${tempAudioDir}`, err);
    // Just use the base temp directory if we can't create the nested one
    const outputPath = localPath || path.join(tempBaseDir, `${uuidv4()}.mp3`);
    return downloadAudioToPath(audioUrl, outputPath);
  }
  
  const outputPath = localPath || path.join(tempAudioDir, `${uuidv4()}.mp3`);
  return downloadAudioToPath(audioUrl, outputPath);
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudio(sermonId: string, audioUrl: string): Promise<{
  transcription: string;
  segments?: { start: number; end: number; text: string }[];
}> {
  const tempFilePaths: string[] = [];
  
  try {
    console.log(`Starting OpenAI Whisper transcription for sermon ${sermonId}`);
    
    // First, check if the audio URL is a local file or an API route
    if (audioUrl.startsWith('/api/')) {
      // The file is served from our local API
      // Convert to a full URL for downloading
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      audioUrl = `${baseUrl}${audioUrl}`;
    }
    
    // Download the audio file
    const tempDir = path.join(process.cwd(), 'temp');
    const audioFilePath = path.join(tempDir, `${sermonId}.wav`);
    tempFilePaths.push(audioFilePath);
    
    await downloadAudioFile(audioUrl, audioFilePath);
    
    // Check file size
    const stats = fs.statSync(audioFilePath);
    const fileSizeBytes = stats.size;
    
    console.log(`Audio file size: ${(fileSizeBytes / (1024 * 1024)).toFixed(2)}MB`);
    
    // Compress if needed
    let processedFilePath = audioFilePath;
    if (fileSizeBytes > MAX_FILE_SIZE) {
      console.log(`Audio file exceeds OpenAI's 25MB limit, attempting to compress...`);
      try {
        processedFilePath = await compressAudioFile(audioFilePath);
        tempFilePaths.push(processedFilePath);
        
        // Verify file is now under the size limit
        const compressedStats = fs.statSync(processedFilePath);
        console.log(`Compressed file size: ${(compressedStats.size / (1024 * 1024)).toFixed(2)}MB`);
        
        if (compressedStats.size > MAX_FILE_SIZE) {
          throw new Error(`File still too large after compression (${(compressedStats.size / (1024 * 1024)).toFixed(2)}MB). The maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
        }
      } catch (compressionError: any) {
        console.error('Compression failed:', compressionError);
        throw new Error(`Unable to process audio file: ${compressionError.message}`);
      }
    }
    
    // Create the transcription using OpenAI
    console.log(`Sending file to OpenAI Whisper API: ${processedFilePath}`);
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(processedFilePath),
      model: "whisper-1",
      response_format: "verbose_json",
      temperature: 0,
      language: "en"
    });
    
    console.log(`OpenAI transcription successful, received ${JSON.stringify(transcriptionResponse).length} bytes of data`);
    
    // Check the response format
    if ('text' in transcriptionResponse) {
      const text = transcriptionResponse.text;
      
      // Create segments from the result
      let segments: { start: number; end: number; text: string }[] = [];
      
      if ('segments' in transcriptionResponse) {
        segments = (transcriptionResponse.segments || []).map((segment: any) => ({
          start: segment.start,
          end: segment.end,
          text: segment.text
        }));
      }
      
      // Clean up temporary files
      try {
        for (const filePath of tempFilePaths) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (cleanupError) {
        console.warn('Error cleaning up temporary files:', cleanupError);
      }
      
      return {
        transcription: text,
        segments
      };
    } else {
      throw new Error('Unexpected response format from OpenAI API');
    }
  } catch (error) {
    // Clean up any temporary files
    try {
      for (const filePath of tempFilePaths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (cleanupError) {
      console.warn('Error cleaning up temporary files:', cleanupError);
    }
    
    console.error('Error in transcribeAudio:', error);
    throw error;
  }
}

// Helper function to transcribe with OpenAI
export async function transcribeWithOpenAI(sermonId: string, audioUrl: string): Promise<string> {
  try {
    const { transcription } = await transcribeAudio(sermonId, audioUrl);
    return transcription;
  } catch (error) {
    console.error('Error in transcribeWithOpenAI:', error);
    throw error;
  }
} 