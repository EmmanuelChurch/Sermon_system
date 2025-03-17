import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import util from 'util';

const execAsync = util.promisify(exec);

// Function to download a file from a URL to a local path
async function downloadFile(url: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const urlHash = crypto.createHash('md5').update(url).digest('hex');
  const tempFilePath = path.join(tempDir, `file-${urlHash}.mp3`);
  
  console.log(`Downloading file from ${url} to ${tempFilePath}`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'audio/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    fs.writeFileSync(tempFilePath, response.data);
    console.log(`Downloaded file (${response.data.length} bytes) to ${tempFilePath}`);
    
    return tempFilePath;
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error(`Failed to download file from ${url}`);
  }
}

// Main function to transcribe audio using a local Whisper implementation
export async function transcribeWithLocalWhisper(audioUrl: string): Promise<string> {
  try {
    console.log('Transcribing with Local Whisper');
    
    // For testing without local Whisper, return mock transcription
    if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_TRANSCRIPTION === 'true') {
      console.log('Using mock transcription in development mode');
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return `This is a mock transcription of the sermon. 
      
      In the beginning, God created the heavens and the earth. The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters.
      
      And God said, "Let there be light," and there was light. And God saw that the light was good. And God separated the light from the darkness. God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.
      
      Thank you for listening to this sermon. May God bless you.`;
    }
    
    // Get the file path - either from a URL or a local path
    let filePath: string;
    
    if (audioUrl.startsWith('http')) {
      // Download the file if it's a URL
      filePath = await downloadFile(audioUrl);
    } else if (audioUrl.startsWith('/api/file/') || audioUrl.startsWith('/api/proxy')) {
      // Extract the URL from the proxy path if needed
      if (audioUrl.startsWith('/api/proxy')) {
        const urlParams = new URLSearchParams(audioUrl.split('?')[1]);
        const originalUrl = urlParams.get('url');
        if (originalUrl) {
          filePath = await downloadFile(originalUrl);
        } else {
          throw new Error('No URL found in proxy path');
        }
      } else {
        // Extract filename from the URL path and find in recordings directory
        const fileName = audioUrl.split('/').pop();
        filePath = path.join(process.cwd(), 'recordings', fileName || '');
        
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found at ${filePath}`);
        }
      }
    } else {
      // Assume it's already a file path
      filePath = audioUrl;
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at ${filePath}`);
      }
    }
    
    console.log(`Using file: ${filePath}`);
    
    // For now, as a fallback until we install whisper.cpp, use mock transcription
    console.log('USING MOCK TRANSCRIPTION - Local Whisper not yet installed');
    return `This is a mock transcription as local Whisper is not yet installed.
    
    To enable actual transcription, you would need to install whisper.cpp or another local Whisper implementation.
    
    Instructions for Windows:
    1. Download whisper.cpp from GitHub
    2. Build it following their instructions
    3. Place the executable in a location accessible to this application
    4. Update this code to call the executable
    
    Once installed, this will transcribe your audio files locally without any API keys.`;
    
    // Uncomment this code once whisper.cpp is installed
    /*
    // Create output file path
    const outputFilePath = `${filePath}.txt`;
    
    // Call local whisper executable
    // Adjust this command based on your whisper.cpp installation
    const whisperCommand = `whisper "${filePath}" --model base --language en --output_file "${outputFilePath}"`;
    
    console.log(`Running command: ${whisperCommand}`);
    
    const { stdout, stderr } = await execAsync(whisperCommand);
    
    console.log('Whisper stdout:', stdout);
    if (stderr) {
      console.error('Whisper stderr:', stderr);
    }
    
    // Check if output file exists
    if (!fs.existsSync(outputFilePath)) {
      throw new Error(`Transcription output file not found at ${outputFilePath}`);
    }
    
    // Read the transcription from the output file
    const transcription = fs.readFileSync(outputFilePath, 'utf8');
    
    console.log('Transcription successful');
    
    return transcription;
    */
  } catch (error: any) {
    console.error('Error transcribing with Local Whisper:', error.message);
    throw error;
  }
} 