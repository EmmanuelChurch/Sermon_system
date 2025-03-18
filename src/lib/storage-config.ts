'use server';

import path from 'path';
import fs from 'fs';

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';
const useVercelBlob = process.env.USE_VERCEL_BLOB === 'true';

// Storage base paths
export async function getStoragePaths() {
  // In development, use local file system
  if (isDev) {
    const baseDir = path.join(process.cwd(), 'local-storage');
    
    return {
      baseDir,
      audioDir: path.join(baseDir, 'audio'),
      transcriptionsDir: path.join(baseDir, 'transcriptions'),
      podcastDir: path.join(baseDir, 'podcast'),
      sermonsFile: path.join(baseDir, 'sermons.json'),
      snippetsDir: path.join(baseDir, 'snippets'),
      tempDir: path.join(process.cwd(), 'temp'),
      introOutroDir: path.join(process.cwd(), 'Introandoutro'),
      useVercelBlob: false,
    };
  }
  
  // In production
  if (useVercelBlob) {
    // For Vercel Blob storage, we don't use file paths
    // but we still need file path references for code compatibility
    const baseDir = '/tmp/sermon-system';
    
    return {
      baseDir,
      audioDir: path.join(baseDir, 'audio'),
      transcriptionsDir: path.join(baseDir, 'transcriptions'),
      podcastDir: path.join(baseDir, 'podcast'),
      sermonsFile: path.join(baseDir, 'sermons.json'),
      snippetsDir: path.join(baseDir, 'snippets'),
      tempDir: '/tmp/sermon-system-temp',
      introOutroDir: path.join(process.cwd(), 'Introandoutro'),
      useVercelBlob: true,
    };
  }
  
  // Default to /tmp for Vercel serverless functions
  const baseDir = process.env.STORAGE_BASE_PATH || '/tmp/sermon-system';
  
  // In production with custom hosting, you might set a persistent storage path
  return {
    baseDir,
    audioDir: path.join(baseDir, 'audio'),
    transcriptionsDir: path.join(baseDir, 'transcriptions'),
    podcastDir: path.join(baseDir, 'podcast'),
    sermonsFile: path.join(baseDir, 'sermons.json'),
    snippetsDir: path.join(baseDir, 'snippets'),
    tempDir: path.join(baseDir, 'temp'),
    introOutroDir: path.join(process.cwd(), 'Introandoutro'),
    useVercelBlob: false,
  };
};

// Ensure all storage directories exist
export async function ensureStorageDirs() {
  const paths = await getStoragePaths();
  
  // If using Vercel Blob, we don't need local directories
  if (paths.useVercelBlob) {
    // Still create temp dir for temporary processing
    if (!fs.existsSync(paths.tempDir)) {
      fs.mkdirSync(paths.tempDir, { recursive: true });
    }
    
    return paths;
  }
  
  // Otherwise create all local directories
  Object.values(paths).forEach(dir => {
    // Skip files (like sermonsFile) and boolean flags
    if (typeof dir !== 'string' || dir.includes('.json')) return;
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Create empty sermons file if it doesn't exist
  if (!fs.existsSync(paths.sermonsFile)) {
    fs.writeFileSync(paths.sermonsFile, JSON.stringify({ sermons: [] }, null, 2));
  }
  
  return paths;
};

// Get public URL for a file based on its path
export async function getPublicUrl(filePath: string, baseUrl = process.env.NEXT_PUBLIC_APP_URL || '') {
  const paths = await getStoragePaths();
  
  // If using Vercel Blob, we'll assume filePath is already a URL
  if (paths.useVercelBlob) {
    // If it's already a URL, return it
    if (filePath.startsWith('http')) {
      return filePath;
    }
    
    // If it's a filename, construct the URL format that Vercel Blob uses
    const filename = path.basename(filePath);
    return `${baseUrl}/api/file/${filename}`;
  }
  
  // Audio files
  if (filePath.startsWith(paths.audioDir)) {
    const filename = path.basename(filePath);
    return `${baseUrl}/api/file/${filename}`;
  }
  
  // Podcast files
  if (filePath.startsWith(paths.podcastDir)) {
    const filename = path.basename(filePath);
    return `${baseUrl}/api/podcast/${filename}`;
  }
  
  // Default URL (might not work)
  return `${baseUrl}/${filePath}`;
} 