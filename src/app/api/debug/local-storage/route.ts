import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ensureDirectoriesExist, getSermons } from '@/lib/local-storage';

interface Sermon {
  id: string;
  title: string;
  speaker: string;
  date: string;
  audiourl: string;
  transcriptionstatus: string;
  created_at: string;
  updated_at: string;
}

// Base directory for storing files and data
const BASE_DIR = path.join(process.cwd(), 'local-storage');
const AUDIO_DIR = path.join(BASE_DIR, 'audio');
const TRANSCRIPTIONS_DIR = path.join(BASE_DIR, 'transcriptions');
const SERMON_DATA_FILE = path.join(BASE_DIR, 'sermons.json');

export async function GET() {
  try {
    console.log('Debug: Checking local storage system');
    
    // Ensure directories exist
    ensureDirectoriesExist();
    
    // Check if we can access the storage directories
    const baseExists = fs.existsSync(BASE_DIR);
    const audioExists = fs.existsSync(AUDIO_DIR);
    const transcriptionsExists = fs.existsSync(TRANSCRIPTIONS_DIR);
    const sermonsFileExists = fs.existsSync(SERMON_DATA_FILE);
    
    // Get list of audio files
    let audioFiles: string[] = [];
    if (audioExists) {
      try {
        audioFiles = fs.readdirSync(AUDIO_DIR);
      } catch (error) {
        console.error('Error reading audio directory:', error);
      }
    }
    
    // Get list of transcription files
    let transcriptionFiles: string[] = [];
    if (transcriptionsExists) {
      try {
        transcriptionFiles = fs.readdirSync(TRANSCRIPTIONS_DIR);
      } catch (error) {
        console.error('Error reading transcriptions directory:', error);
      }
    }
    
    // Read the sermons data file
    let sermons: Sermon[] = [];
    if (sermonsFileExists) {
      try {
        sermons = await getSermons();
      } catch (error) {
        console.error('Error reading sermons data:', error);
      }
    }
    
    // Get permissions info for directories
    const permissions = {
      base: 'unknown',
      audio: 'unknown',
      transcriptions: 'unknown',
      sermonsFile: 'unknown'
    };
    
    try {
      if (baseExists) {
        permissions.base = fs.statSync(BASE_DIR).mode.toString(8);
      }
      if (audioExists) {
        permissions.audio = fs.statSync(AUDIO_DIR).mode.toString(8);
      }
      if (transcriptionsExists) {
        permissions.transcriptions = fs.statSync(TRANSCRIPTIONS_DIR).mode.toString(8);
      }
      if (sermonsFileExists) {
        permissions.sermonsFile = fs.statSync(SERMON_DATA_FILE).mode.toString(8);
      }
    } catch (error) {
      console.error('Error getting permissions:', error);
    }
    
    // Get working directory and absolute paths
    const workingDir = process.cwd();
    const absoluteBasePath = path.resolve(BASE_DIR);
    const absoluteAudioPath = path.resolve(AUDIO_DIR);
    
    // Get server details
    const serverInfo = {
      platform: process.platform,
      node: process.version,
      env: process.env.NODE_ENV
    };
    
    // Return all the debug info
    return NextResponse.json({
      workingDirectory: workingDir,
      paths: {
        base: BASE_DIR,
        audio: AUDIO_DIR,
        transcriptions: TRANSCRIPTIONS_DIR,
        sermonsFile: SERMON_DATA_FILE,
        absoluteBase: absoluteBasePath,
        absoluteAudio: absoluteAudioPath
      },
      exists: {
        base: baseExists,
        audio: audioExists,
        transcriptions: transcriptionsExists,
        sermonsFile: sermonsFileExists
      },
      permissions,
      counts: {
        audioFiles: audioFiles.length,
        transcriptionFiles: transcriptionFiles.length,
        sermons: sermons.length
      },
      audioFiles,
      transcriptionFiles,
      sermons,
      serverInfo
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to debug local storage', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 