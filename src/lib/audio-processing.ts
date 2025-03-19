import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

/**
 * Initialize FFmpeg for client-side use
 */
export async function initFFmpeg() {
  if (ffmpeg) return ffmpeg;
  
  try {
    const instance = new FFmpeg();
    
    // Load ffmpeg core
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
    
    console.log('Loading FFmpeg...');
    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    console.log('FFmpeg loaded successfully');
    ffmpeg = instance;
    return instance;
  } catch (error) {
    console.error('Error initializing FFmpeg:', error);
    throw new Error('Failed to load audio compression tool');
  }
}

/**
 * Compress an audio file on the client side before uploading
 * @param file The audio file to compress
 * @param options Compression options
 * @returns A Promise that resolves to the compressed file
 */
export async function compressAudioFileClient(
  file: File,
  options = { bitrate: '128k', format: 'mp3' }
): Promise<File> {
  try {
    // Check file size - only compress if over 10MB
    if (file.size < 10 * 1024 * 1024) {
      console.log('File is under 10MB, skipping compression');
      return file;
    }
    
    console.log(`Starting compression of ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)...`);
    
    // Initialize FFmpeg
    const ffmpeg = await initFFmpeg();
    
    // Create unique input filename
    const inputFileName = `input-${Date.now()}${getFileExtension(file.name)}`;
    const outputFileName = `compressed-${Date.now()}.${options.format}`;
    
    // Write file to memory
    ffmpeg.writeFile(inputFileName, await fetchFile(file));
    
    // Compress audio
    await ffmpeg.exec([
      '-i', inputFileName,
      '-b:a', options.bitrate,
      '-ar', '44100',
      '-ac', '2',
      outputFileName
    ]);
    
    // Read the compressed file data
    const data = await ffmpeg.readFile(outputFileName);
    
    // Create a new file from the compressed data
    const compressedFile = new File(
      [data], 
      `compressed-${file.name.replace(/\.[^/.]+$/, '')}.${options.format}`,
      { type: getAudioMimeType(options.format) }
    );
    
    console.log(`Compression complete: ${(compressedFile.size / (1024 * 1024)).toFixed(2)}MB (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`);
    
    return compressedFile;
  } catch (error) {
    console.error('Error compressing audio file:', error);
    // If compression fails, return the original file
    return file;
  }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? `.${match[1].toLowerCase()}` : '';
}

/**
 * Get MIME type based on audio format
 */
function getAudioMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'm4a': 'audio/mp4',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
  };
  
  return mimeTypes[format] || 'audio/mpeg';
} 