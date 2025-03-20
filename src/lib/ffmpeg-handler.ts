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
      
      // Try multiple loading methods with different CDNs and paths
      const loadingMethods = [
        // Method 1: Try loading from the API route (best for CORS)
        async () => {
          const baseURL = window.location.origin;
          console.log('Attempting to load FFmpeg from API route');
          await ffmpegInstance!.load({
            coreURL: `${baseURL}/api/ffmpeg/ffmpeg-core.js`,
            wasmURL: `${baseURL}/api/ffmpeg/ffmpeg-core.wasm`,
            workerURL: `${baseURL}/api/ffmpeg/ffmpeg-core.worker.js`
          });
        },
        
        // Method 2: Try loading from site root
        async () => {
          console.log('Attempting to load FFmpeg from site root');
          await ffmpegInstance!.load({
            coreURL: '/ffmpeg-core.js',
            wasmURL: '/ffmpeg-core.wasm'
          });
        },
        
        // Method 3: Try loading from /ffmpeg subdirectory
        async () => {
          const baseURL = window.location.origin;
          console.log('Attempting to load FFmpeg from /ffmpeg subdirectory');
          await ffmpegInstance!.load({
            coreURL: `${baseURL}/ffmpeg/ffmpeg-core.js`,
            wasmURL: `${baseURL}/ffmpeg/ffmpeg-core.wasm`
          });
        },
        
        // Method 4: Try loading from unpkg CDN
        async () => {
          console.log('Attempting to load FFmpeg from unpkg CDN');
          await ffmpegInstance!.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/ffmpeg-core.wasm',
            workerURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/ffmpeg-core.worker.js'
          });
        },
        
        // Method 5: Try loading from jsDelivr CDN (alternative CDN)
        async () => {
          console.log('Attempting to load FFmpeg from jsDelivr CDN');
          await ffmpegInstance!.load({
            coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/ffmpeg-core.js',
            wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/ffmpeg-core.wasm',
            workerURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/ffmpeg-core.worker.js'
          });
        },
        
        // Method 6: Try loading with no URLs (let FFmpeg find the files)
        async () => {
          console.log('Attempting to load FFmpeg with no explicit URLs');
          await ffmpegInstance!.load();
        }
      ];
      
      // Try each loading method in sequence until one succeeds
      let loaded = false;
      let lastError = null;
      
      for (const method of loadingMethods) {
        if (loaded) break;
        
        try {
          await method();
          console.log('FFmpeg loaded successfully');
          loaded = true;
        } catch (error) {
          console.warn('Loading method failed:', error);
          lastError = error;
        }
      }
      
      if (!loaded) {
        throw new Error(`All FFmpeg loading methods failed. Last error: ${lastError}`);
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