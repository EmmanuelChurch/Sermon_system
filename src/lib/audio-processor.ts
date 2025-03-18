'use server';

// Server-side only imports
import fs from 'fs';
import path from 'path';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';

// Server-only imports
const { exec } = require('child_process');
const execPromise = util.promisify(exec);

// Constants
const INTRO_OUTRO_DIR = path.join(process.cwd(), 'Introandoutro');
const PODCAST_DIR = path.join(process.cwd(), 'local-storage', 'podcast');
const INTRO_FILE = path.join(INTRO_OUTRO_DIR, 'Emmanuel Podcast Intro.mp3');
const OUTRO_FILE = path.join(INTRO_OUTRO_DIR, 'Emmanuel Podcast Outro.mp3');

/**
 * Process audio by adding intro/outro and normalizing volume
 */
export async function processSermonAudio(
  inputAudioPath: string, 
  sermonId: string
): Promise<string> {
  console.log(`Starting advanced audio processing for sermon ${sermonId}`);
  
  // Ensure podcast directory exists
  if (!fs.existsSync(PODCAST_DIR)) {
    fs.mkdirSync(PODCAST_DIR, { recursive: true });
  }
  
  // Create a temp directory for intermediate files
  const tempDir = path.join(process.cwd(), 'temp', 'audio-processing', sermonId);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  try {
    // Verify intro and outro files exist
    if (!fs.existsSync(INTRO_FILE)) {
      throw new Error(`Intro file not found: ${INTRO_FILE}`);
    }
    
    if (!fs.existsSync(OUTRO_FILE)) {
      throw new Error(`Outro file not found: ${OUTRO_FILE}`);
    }
    
    // Create concatenation list file
    const filesListPath = path.join(tempDir, 'files.txt');
    const filesList = [
      `file '${INTRO_FILE.replace(/\\/g, '/')}'`,
      `file '${inputAudioPath.replace(/\\/g, '/')}'`,
      `file '${OUTRO_FILE.replace(/\\/g, '/')}'`
    ].join('\n');
    
    fs.writeFileSync(filesListPath, filesList);
    console.log(`Created files list at ${filesListPath}`);
    
    // Combined output path (intermediate)
    const combinedAudioPath = path.join(tempDir, `${sermonId}_combined.mp3`);
    
    // Final podcast-ready output path
    const finalOutputPath = path.join(PODCAST_DIR, `${sermonId}_podcast.mp3`);
    
    // Step 1: Concatenate files
    console.log('Concatenating intro, sermon, and outro...');
    await execPromise(`ffmpeg -f concat -safe 0 -i "${filesListPath}" -c copy "${combinedAudioPath}"`);
    
    // Step 2: Normalize volume
    console.log('Normalizing audio volume...');
    await execPromise(`ffmpeg -i "${combinedAudioPath}" -af "loudnorm=I=-16:LRA=11:TP=-1.5" -ar 44100 -ac 2 "${finalOutputPath}"`);
    
    console.log(`Fully processed audio saved to ${finalOutputPath}`);
    
    // Clean up temporary files
    fs.unlinkSync(filesListPath);
    fs.unlinkSync(combinedAudioPath);
    
    // Return the path to the final processed file
    return finalOutputPath;
  } catch (error) {
    console.error('Error processing sermon audio:', error);
    throw error;
  }
}

/**
 * Get the podcast-ready file URL for a sermon
 */
export function getPodcastFileUrl(sermonId: string): string | null {
  const podcastFilePath = path.join(PODCAST_DIR, `${sermonId}_podcast.mp3`);
  
  if (fs.existsSync(podcastFilePath)) {
    // Return a URL that can be used in the browser
    return `/api/podcast/${sermonId}_podcast.mp3`;
  }
  
  return null;
}

/**
 * Check if a podcast version of a sermon exists
 */
export function podcastVersionExists(sermonId: string): boolean {
  const podcastFilePath = path.join(PODCAST_DIR, `${sermonId}_podcast.mp3`);
  return fs.existsSync(podcastFilePath);
}

/**
 * Get the local file path for a podcast file
 */
export function getPodcastFilePath(filename: string): string {
  return path.join(PODCAST_DIR, filename);
} 