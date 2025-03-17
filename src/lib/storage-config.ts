import path from 'path';
import fs from 'fs';

// Define storage paths based on environment
const isDev = process.env.NODE_ENV === 'development';

// Storage base paths
export const getStoragePaths = () => {
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
    };
  }
  
  // In production
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
  };
};

// Ensure all storage directories exist
export const ensureStorageDirs = () => {
  const paths = getStoragePaths();
  
  Object.values(paths).forEach(dir => {
    // Skip files (like sermonsFile)
    if (dir.includes('.json')) return;
    
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
export const getPublicUrl = (filePath: string, baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '') => {
  const paths = getStoragePaths();
  
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
}; 