import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Singleton instance
let ffmpegInstance: FFmpeg | null = null;

// Initialize FFmpeg with appropriate configuration for development or production
export async function initFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  try {
    console.log('Loading FFmpeg...');
    
    // Create a new FFmpeg instance with baseURL set to serve WASM files from the public directory
    const ffmpeg = new FFmpeg();
    
    // Set log level
    ffmpeg.on('log', ({ message }) => {
      console.log(`[FFmpeg] ${message}`);
    });

    // Load FFmpeg (this loads the WASM binary)
    await ffmpeg.load();
    
    console.log('FFmpeg loaded successfully');
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
    throw new Error(`Failed to load FFmpeg: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Utility function to compress audio using FFmpeg
export async function compressAudio(
  inputFile: File | Blob,
  outputFilename: string = 'compressed.mp3',
  bitrate: string = '64k'
): Promise<Blob> {
  try {
    // Initialize FFmpeg
    const ffmpeg = await initFFmpeg();
    
    // Write the file to FFmpeg's virtual file system
    const inputName = 'input' + (inputFile instanceof File ? inputFile.name.substring(inputFile.name.lastIndexOf('.')) : '.wav');
    const data = await fetchFile(inputFile);
    await ffmpeg.writeFile(inputName, data);
    
    // Run the compression command
    await ffmpeg.exec([
      '-i', inputName,
      '-b:a', bitrate,
      '-c:a', 'libmp3lame',
      outputFilename
    ]);
    
    // Read the compressed file from the virtual file system
    const compressedData = await ffmpeg.readFile(outputFilename);
    
    // Clean up virtual files
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputFilename);
    
    // Return the compressed audio as a Blob
    return new Blob([compressedData], { type: 'audio/mp3' });
  } catch (error) {
    console.error('Audio compression failed:', error);
    throw new Error(`Audio compression failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default {
  initFFmpeg,
  compressAudio
}; 