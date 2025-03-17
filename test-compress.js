const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

// Load environment variables from .env.local
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const envVars = envFile.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, value] = line.split('=');
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {});
  
  console.log('Loaded environment variables from .env.local:');
  console.log(envVars);
  
  // Set the FFMPEG_PATH environment variable
  if (envVars.FFMPEG_PATH) {
    process.env.FFMPEG_PATH = envVars.FFMPEG_PATH;
    console.log(`Set FFMPEG_PATH to: ${process.env.FFMPEG_PATH}`);
  }
} catch (err) {
  console.error(`Error loading .env.local: ${err.message}`);
}

// Path to FFmpeg executable
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'D:/EmmanuelChurchLondon/ffmpeg/bin/ffmpeg.exe';

// Test audio file path - replace with an actual audio file path
const TEST_AUDIO_FILE = 'D:/EmmanuelChurchLondon/test-audio.mp3';

// Create a test audio file if it doesn't exist
async function createTestAudioFile() {
  if (fs.existsSync(TEST_AUDIO_FILE)) {
    console.log(`Test audio file already exists: ${TEST_AUDIO_FILE}`);
    return;
  }
  
  console.log(`Creating test audio file: ${TEST_AUDIO_FILE}`);
  
  try {
    // Generate a 10-second silent audio file
    const cmd = `"${FFMPEG_PATH}" -f lavfi -i anullsrc=r=44100:cl=stereo -t 10 -c:a libmp3lame -b:a 320k "${TEST_AUDIO_FILE}"`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr) {
      console.log(`FFmpeg stderr: ${stderr}`);
    }
    
    console.log(`Created test audio file: ${TEST_AUDIO_FILE}`);
  } catch (error) {
    console.error(`Error creating test audio file: ${error.message}`);
    throw error;
  }
}

// Compress the audio file
async function compressAudioFile(inputPath) {
  console.log(`Compressing audio file: ${inputPath}`);
  
  // Generate output path
  const parsedPath = path.parse(inputPath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}_compressed.mp3`);
  
  try {
    // Run FFmpeg to compress the audio
    const cmd = `"${FFMPEG_PATH}" -i "${inputPath}" -c:a libmp3lame -b:a 64k -ac 1 "${outputPath}"`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr) {
      console.log(`FFmpeg stderr: ${stderr}`);
    }
    
    console.log(`Compressed audio file: ${outputPath}`);
    
    // Get file sizes
    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    
    console.log(`Original size: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`Compressed size: ${(compressedSize / 1024).toFixed(2)} KB`);
    console.log(`Compression ratio: ${(compressedSize / originalSize * 100).toFixed(2)}%`);
    
    return outputPath;
  } catch (error) {
    console.error(`Error compressing audio file: ${error.message}`);
    throw error;
  }
}

// Run the test
async function runTest() {
  try {
    // Check if FFmpeg exists
    if (!fs.existsSync(FFMPEG_PATH)) {
      console.error(`FFmpeg not found at: ${FFMPEG_PATH}`);
      return;
    }
    
    console.log(`Using FFmpeg at: ${FFMPEG_PATH}`);
    
    // Create test audio file
    await createTestAudioFile();
    
    // Compress the audio file
    await compressAudioFile(TEST_AUDIO_FILE);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
  }
}

// Run the test
runTest(); 