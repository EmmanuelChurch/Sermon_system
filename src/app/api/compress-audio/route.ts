import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { createReadStream } from 'fs';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);
const OS_TEMP_DIR = process.env.TEMP || '/tmp';

/**
 * Compresses an audio file and updates the sermon record with the compressed file URL
 * @deprecated This endpoint is maintained for backward compatibility but client-side compression has been removed
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Server-side audio compression request received');
    
    // Return a deprecation notice
    if (process.env.NODE_ENV === 'development') {
      console.warn('WARNING: The compress-audio endpoint is deprecated and will be removed in a future update.');
    }
    
    // Check if request is multipart/form-data
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Request must be multipart/form-data' },
        { status: 400 }
      );
    }
    
    // Get form data
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;
    
    if (!audioFile) {
      console.error('No audio file provided');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    console.log(`Received file: ${audioFile.name}, Size: ${audioFile.size} bytes, Type: ${audioFile.type}`);
    
    // Create a temporary directory for file storage
    // In Vercel, use /tmp directory instead of os.tmpdir()
    const isVercel = process.env.VERCEL === '1';
    const tempBaseDir = isVercel ? '/tmp' : os.tmpdir();
    const tempDir = join(tempBaseDir, 'sermon-audio');
    
    console.log(`Using temporary directory: ${tempDir}`);
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('Created temporary directory');
      } else {
        console.log('Temporary directory already exists');
      }
    } catch (dirError) {
      console.error('Error creating temp directory:', dirError);
      // Fall back to base temp directory if subdirectory creation fails
      console.log('Falling back to base temp directory');
      if (isVercel) {
        // Make sure /tmp exists in Vercel
        if (!fs.existsSync('/tmp')) {
          try {
            fs.mkdirSync('/tmp');
            console.log('Created /tmp directory in Vercel');
          } catch (e) {
            console.error('Failed to create /tmp directory:', e);
          }
        }
      }
    }
    
    // Generate unique file names
    const uniqueId = uuidv4();
    const inputPath = join(tempDir, `input-${uniqueId}${getExtension(audioFile.name)}`);
    const outputPath = join(tempDir, `output-${uniqueId}.mp3`);
    
    // Get file buffer
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    
    // Write the input file to temp directory
    await writeFile(inputPath, buffer);
    
    try {
      // Check if ffmpeg is available
      await execAsync('ffmpeg -version');
      console.log('FFmpeg is available on the server');
    } catch (error) {
      console.error('FFmpeg not found on server:', error);
      // If FFmpeg is not available, return the original file
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': audioFile.type || 'audio/mpeg',
          'Content-Disposition': `attachment; filename="original-${audioFile.name}"`,
        },
      });
    }
    
    try {
      // Compress the audio with FFmpeg
      const bitrate = '64k'; // Can be passed from client if needed
      console.log(`Compressing audio with FFmpeg: ${inputPath} -> ${outputPath}`);
      await execAsync(`ffmpeg -i "${inputPath}" -b:a ${bitrate} -c:a libmp3lame -y "${outputPath}"`);
      
      // Read the compressed file
      console.log('Reading compressed file');
      const compressedBuffer = await readFileAsBuffer(outputPath);
      
      // Calculate compression stats
      const originalSize = buffer.length;
      const compressedSize = compressedBuffer.length;
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
      console.log(`Compression complete: Original size: ${originalSize} bytes, Compressed size: ${compressedSize} bytes, Ratio: ${compressionRatio}%`);
      
      // Clean up temporary files
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ]);
      
      // Return the compressed audio with metadata
      return NextResponse.json({
        message: 'Audio file compressed successfully',
        file: compressedBuffer.toString('base64'),
        mimeType: audioFile.type || 'audio/mpeg',
        originalSize: originalSize,
        compressedSize: compressedSize,
        compressionRatio: `${compressionRatio}%`,
        filename: `${audioFile.name.replace(/\.[^/.]+$/, '')}.mp3`,
        notice: 'This endpoint is deprecated and will be removed in a future update.'
      });
    } catch (error) {
      console.error('Error compressing audio:', error);
      
      // Clean up input file
      await unlink(inputPath).catch(() => {});
      
      // Return the original file if compression fails
      return NextResponse.json({
        message: 'Compression failed',
        file: buffer.toString('base64'),
        originalSize: buffer.length,
        compressedSize: buffer.length,
        compressionRatio: '0%',
        filename: audioFile.name,
        mimeType: audioFile.type || 'audio/mpeg',
        error: 'Compression failed, returning original file',
        notice: 'This endpoint is deprecated and will be removed in a future update.'
      });
    }
  } catch (error) {
    console.error('Error in compress-audio API:', error);
    return NextResponse.json(
      { 
        error: `Failed to compress audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
        notice: 'This endpoint is deprecated and will be removed in a future update.'
      },
      { status: 500 }
    );
  }
}

// Helper for reading files as buffer
async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath);
    
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Helper to get file extension with the dot
function getExtension(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.'));
  return ext || '.wav';
} 