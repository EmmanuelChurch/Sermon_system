import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getStoragePaths, ensureStorageDirs, getPublicUrl } from './storage-config';

// Get storage paths - initialize asynchronously
let PATHS: any = null;
async function initPaths() {
  if (!PATHS) {
    PATHS = await getStoragePaths();
  }
  return PATHS;
}

// Base directory for storing files and data
const BASE_DIR = path.join(process.cwd(), 'local-storage');
const AUDIO_DIR = path.join(BASE_DIR, 'audio');
const TRANSCRIPTIONS_DIR = path.join(BASE_DIR, 'transcriptions');
const SERMON_DATA_FILE = path.join(BASE_DIR, 'sermons.json');

// Ensure directories exist
export async function ensureDirectoriesExist() {
  return await ensureStorageDirs();
}

// Get all sermons
export async function getSermons() {
  await ensureDirectoriesExist();
  const paths = await initPaths();
  
  try {
    const data = await fs.promises.readFile(paths.sermonsFile, 'utf8');
    return JSON.parse(data).sermons;
  } catch (error) {
    console.error('Error reading sermons file:', error);
    return [];
  }
}

// Get a single sermon by ID
export async function getSermonById(id: string) {
  const sermons = await getSermons();
  return sermons.find((sermon: any) => sermon.id === id);
}

// Save a sermon (create or update)
export async function saveSermon(sermon: any) {
  await ensureDirectoriesExist();
  const sermons = await getSermons();
  const paths = await initPaths();
  
  const index = sermons.findIndex((s: any) => s.id === sermon.id);
  
  if (index >= 0) {
    // Update existing sermon
    sermons[index] = { ...sermons[index], ...sermon };
  } else {
    // Create new sermon
    if (!sermon.id) {
      sermon.id = uuidv4();
    }
    sermon.created_at = sermon.created_at || new Date().toISOString();
    sermon.updated_at = new Date().toISOString();
    sermons.push(sermon);
  }
  
  await fs.promises.writeFile(paths.sermonsFile, JSON.stringify({ sermons }, null, 2));
  return sermon;
}

// Update sermon transcription status
export function updateSermonTranscriptionStatus(
  sermonId: string, 
  status: string, 
  transcription?: string, 
  error?: string
) {
  const sermon = getSermonById(sermonId);
  if (!sermon) {
    throw new Error(`Sermon not found with ID: ${sermonId}`);
  }
  
  const updates: any = {
    transcriptionstatus: status,
    updated_at: new Date().toISOString()
  };
  
  if (transcription) {
    updates.transcription = transcription;
    
    // Also save transcription to a file
    const transcriptionFilePath = path.join(TRANSCRIPTIONS_DIR, `${sermonId}.txt`);
    fs.writeFileSync(transcriptionFilePath, transcription);
  }
  
  if (error) {
    updates.transcription_error = error;
  }
  
  return saveSermon({ ...sermon, ...updates });
}

// Save audio file locally and return the file path and URL
export async function saveAudioFile(buffer: Buffer, originalFilename: string, sermonId: string) {
  await ensureDirectoriesExist();
  
  // Make sure PATHS is initialized
  const paths = await initPaths();
  
  // Log the paths for debugging
  console.log('Storage paths in saveAudioFile:', JSON.stringify(paths));
  
  if (!paths || !paths.audioDir) {
    console.error('Error: audioDir is undefined in storage paths', paths);
    throw new Error('Storage configuration is incomplete: audioDir is missing');
  }
  
  const extension = path.extname(originalFilename);
  const filename = `${sermonId}${extension}`;
  const filePath = path.join(paths.audioDir, filename);
  
  // Ensure the audio directory exists
  if (!fs.existsSync(paths.audioDir)) {
    console.log(`Audio directory doesn't exist, creating it: ${paths.audioDir}`);
    fs.mkdirSync(paths.audioDir, { recursive: true });
  }
  
  // Write the file
  try {
    console.log(`Writing audio file to: ${filePath}`);
    fs.writeFileSync(filePath, buffer);
    console.log(`Successfully wrote file, size: ${buffer.length} bytes`);
    
    // Verify the file was written correctly
    if (!fs.existsSync(filePath)) {
      throw new Error(`File was not created at ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    console.log(`File stats: size=${stats.size}, isFile=${stats.isFile()}`);
    
    if (stats.size === 0) {
      throw new Error('File was created but is empty');
    }
  } catch (writeError: any) {
    console.error('Error writing audio file:', writeError);
    throw new Error(`Failed to write audio file: ${writeError.message}`);
  }
  
  // Create a URL that can be used in the browser
  try {
    const fileUrl = await getPublicUrl(filePath);
    console.log(`Generated public URL: ${fileUrl}`);
    
    // Update sermon record with new audio URL
    try {
      const sermon = await getSermonById(sermonId);
      if (sermon) {
        await saveSermon({
          ...sermon,
          audiourl: fileUrl,
          updated_at: new Date().toISOString()
        });
      }
    } catch (sermonError) {
      console.error('Error updating sermon record:', sermonError);
      // Continue anyway since we have the file and URL
    }
    
    return {
      path: filePath,
      url: fileUrl
    };
  } catch (urlError: any) {
    console.error('Error generating public URL:', urlError);
    throw new Error(`Failed to generate public URL: ${urlError.message}`);
  }
}

// Get audio file path by filename
export function getAudioFilePath(filename: string) {
  return path.join(AUDIO_DIR, filename);
}

// Get transcription file path by sermon ID
export function getTranscriptionFilePath(sermonId: string) {
  return path.join(TRANSCRIPTIONS_DIR, `${sermonId}.txt`);
}

// Save snippets
export function saveSnippets(snippets: any[]): any[];
export function saveSnippets(sermonId: string, snippets: any[]): boolean;
export function saveSnippets(arg1: any, arg2?: any): any {
  ensureDirectoriesExist();
  
  // Create snippets directory if it doesn't exist
  const SNIPPETS_DIR = path.join(BASE_DIR, 'snippets');
  if (!fs.existsSync(SNIPPETS_DIR)) {
    fs.mkdirSync(SNIPPETS_DIR, { recursive: true });
  }
  
  // Case 1: saveSnippets(snippets: any[])
  if (Array.isArray(arg1) && arg2 === undefined) {
    const snippets = arg1;
    
    // Group snippets by sermon ID
    const snippetsBySermonId: Record<string, any[]> = {};
    snippets.forEach(snippet => {
      const sermonId = snippet.sermon_id;
      if (!snippetsBySermonId[sermonId]) {
        snippetsBySermonId[sermonId] = [];
      }
      snippetsBySermonId[sermonId].push(snippet);
    });
    
    // Save each group of snippets to its own file
    for (const [sermonId, sermonSnippets] of Object.entries(snippetsBySermonId)) {
      const snippetsFilePath = path.join(SNIPPETS_DIR, `${sermonId}.json`);
      fs.writeFileSync(snippetsFilePath, JSON.stringify(sermonSnippets, null, 2));
    }
    
    return snippets;
  }
  
  // Case 2: saveSnippets(sermonId: string, snippets: any[]): boolean
  else if (typeof arg1 === 'string' && Array.isArray(arg2)) {
    const sermonId = arg1;
    const snippets = arg2;
    
    try {
      const snippetsFilePath = path.join(SNIPPETS_DIR, `${sermonId}.json`);
      fs.writeFileSync(snippetsFilePath, JSON.stringify(snippets, null, 2));
      return true;
    } catch (error) {
      console.error(`Error saving snippets for sermon ${sermonId}:`, error);
      return false;
    }
  }
  
  throw new Error('Invalid arguments for saveSnippets');
}

// Get snippets by sermon ID
export function getSnippetsBySermonId(sermonId: string): any[] {
  ensureDirectoriesExist();
  
  const SNIPPETS_DIR = path.join(BASE_DIR, 'snippets');
  const snippetsFilePath = path.join(SNIPPETS_DIR, `${sermonId}.json`);
  
  if (!fs.existsSync(snippetsFilePath)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(snippetsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading snippets for sermon ${sermonId}:`, error);
    return [];
  }
}

// Update a specific snippet
export async function updateSnippet(sermonId: string, snippetId: string, updates: Record<string, any>): Promise<any> {
  try {
    // Get all snippets for this sermon
    const snippets = getSnippetsBySermonId(sermonId);
    
    // Find the target snippet
    const targetIndex = snippets.findIndex((s: any) => s.id === snippetId);
    
    if (targetIndex === -1) {
      throw new Error(`Snippet ${snippetId} not found for sermon ${sermonId}`);
    }
    
    // Update the snippet with the provided updates
    snippets[targetIndex] = {
      ...snippets[targetIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    // Save the updated snippets
    saveSnippets(sermonId, snippets);
    
    // Return the updated snippet
    return snippets[targetIndex];
  } catch (error) {
    console.error(`Error updating snippet ${snippetId}:`, error);
    throw error;
  }
}

// Delete a sermon by ID
export async function deleteSermon(id: string) {
  await ensureDirectoriesExist();
  
  // Get all sermons
  const sermons = await getSermons();
  
  // Find the sermon
  const sermon = sermons.find((s: any) => s.id === id);
  
  if (!sermon) {
    throw new Error(`Sermon not found with ID: ${id}`);
  }
  
  // Remove the sermon from the array
  const updatedSermons = sermons.filter((s: any) => s.id !== id);
  
  const paths = await initPaths();
  
  // Save the updated sermons array
  await fs.promises.writeFile(paths.sermonsFile, JSON.stringify({ sermons: updatedSermons }, null, 2));
  
  // Clean up associated files
  
  // 1. Delete audio file if it exists and is local
  if (sermon.audiourl && sermon.audiourl.startsWith('/api/file/')) {
    const filename = sermon.audiourl.split('/').pop();
    const audioFilePath = path.join(paths.audioDir, filename);
    
    if (fs.existsSync(audioFilePath)) {
      try {
        fs.unlinkSync(audioFilePath);
        console.log(`Deleted audio file: ${audioFilePath}`);
      } catch (error) {
        console.error(`Failed to delete audio file: ${audioFilePath}`, error);
      }
    }
  }
  
  // 2. Delete transcription file if it exists
  const transcriptionFilePath = path.join(paths.transcriptionsDir, `${id}.txt`);
  if (fs.existsSync(transcriptionFilePath)) {
    try {
      fs.unlinkSync(transcriptionFilePath);
      console.log(`Deleted transcription file: ${transcriptionFilePath}`);
    } catch (error) {
      console.error(`Failed to delete transcription file: ${transcriptionFilePath}`, error);
    }
  }
  
  // 3. Delete snippets file if it exists
  const SNIPPETS_DIR = path.join(paths.baseDir, 'snippets');
  const snippetsFilePath = path.join(SNIPPETS_DIR, `${id}.json`);
  if (fs.existsSync(snippetsFilePath)) {
    try {
      fs.unlinkSync(snippetsFilePath);
      console.log(`Deleted snippets file: ${snippetsFilePath}`);
    } catch (error) {
      console.error(`Failed to delete snippets file: ${snippetsFilePath}`, error);
    }
  }
  
  console.log(`Sermon deleted successfully: ${id}`);
  return true;
} 