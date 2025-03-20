import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Keep track of initialization state to avoid multiple initializations
let ffmpegInstance: FFmpeg | null = null;
let isInitializing = false;
let initializationPromise: Promise<FFmpeg> | null = null;

/**
 * Initializes the FFmpeg WASM module with comprehensive error handling
 * and multiple loading strategies
 */
export async function initFFmpeg(): Promise<FFmpeg> {
  // If we already have an initialized instance, return it
  if (ffmpegInstance !== null) {
    console.log('Using existing FFmpeg instance');
    return ffmpegInstance;
  }

  // If initialization is in progress, return the existing promise
  if (isInitializing && initializationPromise) {
    console.log('FFmpeg initialization already in progress');
    return initializationPromise;
  }

  // Set flag to prevent multiple initializations
  isInitializing = true;

  // Create a new initialization promise
  initializationPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('Starting FFmpeg initialization');
      
      // Create a new FFmpeg instance
      const FFmpeg = (await import('@ffmpeg/ffmpeg')).FFmpeg;
      ffmpegInstance = new FFmpeg();
      
      // Set up logging
      ffmpegInstance.on('log', ({ message }) => {
        console.log(`[FFmpeg] ${message}`);
      });

      console.log('FFmpeg instance created, loading core...');
      
      // Load directly from esm.sh CDN - better CORS support
      try {
        console.log('Loading FFmpeg from esm.sh CDN');
        await ffmpegInstance.load({
          coreURL: 'https://esm.sh/@ffmpeg/core@0.12.4/dist/esm/ffmpeg-core.js',
          wasmURL: 'https://esm.sh/@ffmpeg/core@0.12.4/dist/esm/ffmpeg-core.wasm',
          workerURL: 'https://esm.sh/@ffmpeg/core@0.12.4/dist/esm/ffmpeg-core.worker.js'
        });
        console.log('FFmpeg core loaded successfully from esm.sh CDN');
      } catch (esmError) {
        console.error('Failed to load FFmpeg from esm.sh CDN:', esmError);
        
        // Try unpkg as fallback
        try {
          console.log('Trying fallback to unpkg CDN');
          await ffmpegInstance.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm/ffmpeg-core.wasm',
            workerURL: 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm/ffmpeg-core.worker.js'
          });
          console.log('FFmpeg core loaded successfully from unpkg CDN');
        } catch (unpkgError) {
          console.error('Failed to load FFmpeg from unpkg CDN:', unpkgError);
          throw unpkgError;
        }
      }
      
      console.log('FFmpeg ready to use');
      resolve(ffmpegInstance);
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      ffmpegInstance = null;
      isInitializing = false;
      reject(new Error(`Failed to load FFmpeg: ${error}`));
    } finally {
      isInitializing = false;
    }
  });

  return initializationPromise;
}

/**
 * Compresses an audio file using FFmpeg WASM with improved error handling
 */
export async function compressAudio(
  audioFile: File,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  try {
    console.log('Starting audio compression');
    const ffmpeg = await initFFmpeg();
    
    console.log('FFmpeg ready, processing file:', audioFile.name);
    const inputFileName = 'input.' + (audioFile.name.split('.').pop() || 'wav');
    const outputFileName = 'output.mp3';
    
    // Write the input file to the FFmpeg virtual file system
    console.log('Writing file to FFmpeg virtual filesystem');
    const fileData = await fetchFile(audioFile);
    await ffmpeg.writeFile(inputFileName, fileData);
    
    // Set up progress reporting
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        if (progress >= 0 && progress <= 1) {
          onProgress(progress * 100);
        }
      });
    }
    
    console.log('Running FFmpeg compression command');
    // Run the FFmpeg command for compression
    await ffmpeg.exec([
      '-i', inputFileName,
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      outputFileName
    ]);
    
    console.log('Compression completed, reading output file');
    // Read the output file from the FFmpeg virtual file system
    const data = await ffmpeg.readFile(outputFileName);
    
    // Clean up files from the FFmpeg virtual file system
    console.log('Cleaning up FFmpeg virtual filesystem');
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    
    console.log('Audio compression successful');
    // Convert the Uint8Array to a Blob
    return new Blob([data], { type: 'audio/mp3' });
  } catch (error) {
    console.error('Error during audio compression:', error);
    throw new Error(`FFmpeg compression failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default {
  initFFmpeg,
  compressAudio
}; 