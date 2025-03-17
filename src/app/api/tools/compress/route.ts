import { NextRequest, NextResponse } from 'next/server';
import { compressAudioFile } from '@/lib/openai-whisper';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Route handler for standalone audio compression
export async function POST(request: NextRequest) {
  try {
    console.log('--- STANDALONE AUDIO COMPRESSION REQUEST RECEIVED ---');
    
    // Parse the FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error('ERROR: No file provided in the request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check if the file is an audio file
    const isAudio = file.type.startsWith('audio/');
    if (!isAudio) {
      console.error(`ERROR: Uploaded file is not an audio file. Type: ${file.type}`);
      return NextResponse.json({ error: 'File must be an audio file' }, { status: 400 });
    }

    console.log(`Received file: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`);

    // Create a temporary directory for file storage
    const tempDir = path.join(os.tmpdir(), 'audio-compression');
    console.log(`Using temporary directory: ${tempDir}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('Created temporary directory');
    } else {
      console.log('Temporary directory already exists');
    }

    // Generate unique filenames
    const timestamp = Date.now();
    const originalFilename = `${timestamp}-${file.name}`;
    const originalFilePath = path.join(tempDir, originalFilename);
    console.log(`Generated original file path: ${originalFilePath}`);

    // Convert the file to a Buffer and save it
    console.log('Converting file to Buffer...');
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);
    console.log(`Buffer created, size: ${fileBuffer.length} bytes`);
    fs.writeFileSync(originalFilePath, fileBuffer);

    console.log(`Original file saved at: ${originalFilePath}`);

    // Compress the audio file
    console.log('Starting audio compression...');
    const compressedFilePath = await compressAudioFile(originalFilePath);
    const compressedFileSize = fs.statSync(compressedFilePath).size;
    const compressionRatio = ((file.size - compressedFileSize) / file.size * 100).toFixed(2);
    console.log(`Compressed file saved at: ${compressedFilePath}`);
    console.log(`Original size: ${file.size} bytes, Compressed size: ${compressedFileSize} bytes`);
    console.log(`Compression ratio: ${compressionRatio}% reduction`);

    // Create a persistent location for compressed files
    const publicDir = path.join(process.cwd(), 'public');
    const compressedDir = path.join(publicDir, 'compressed');
    
    if (!fs.existsSync(compressedDir)) {
      fs.mkdirSync(compressedDir, { recursive: true });
      console.log(`Created compressed files directory: ${compressedDir}`);
    }
    
    // Generate a unique filename for the compressed file
    const fileExtension = path.extname(compressedFilePath);
    const uniqueId = uuidv4();
    const uniqueFileName = `${uniqueId}${fileExtension}`;
    const destinationPath = path.join(compressedDir, uniqueFileName);
    
    // Copy the compressed file to the public directory
    fs.copyFileSync(compressedFilePath, destinationPath);
    console.log(`Copied compressed file to: ${destinationPath}`);
    
    // Create a public URL for the file
    const publicUrl = `/compressed/${uniqueFileName}`;
    console.log(`Public URL: ${publicUrl}`);
    
    // Clean up temporary files
    console.log('Cleaning up temporary files...');
    try {
      fs.unlinkSync(originalFilePath);
      fs.unlinkSync(compressedFilePath);
      console.log('Temporary files removed');
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }

    // Set up a cleanup job to remove the file after 1 hour
    setTimeout(() => {
      try {
        if (fs.existsSync(destinationPath)) {
          fs.unlinkSync(destinationPath);
          console.log(`Cleaned up compressed file after timeout: ${destinationPath}`);
        }
      } catch (err) {
        console.error('Error cleaning up compressed file:', err);
      }
    }, 3600000); // 1 hour in milliseconds

    console.log('--- STANDALONE AUDIO COMPRESSION COMPLETED SUCCESSFULLY ---');
    return NextResponse.json({
      success: true,
      size: compressedFileSize,
      url: publicUrl,
      originalSize: file.size,
      compressionRatio: `${compressionRatio}%`,
      filename: `compressed-${path.basename(file.name, path.extname(file.name))}${fileExtension}`
    });
    
  } catch (error) {
    console.error('Error processing audio compression:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 