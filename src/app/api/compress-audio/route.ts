import { NextRequest, NextResponse } from 'next/server';
import { compressAudioFile } from '@/lib/openai-whisper';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Compresses an audio file and updates the sermon record with the compressed file URL
 */
export async function POST(request: NextRequest) {
  try {
    console.log('--- AUDIO COMPRESSION REQUEST RECEIVED ---');
    
    // Parse the FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sermonId = formData.get('sermonId') as string | null;

    if (!file) {
      console.error('ERROR: No file provided in the request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!sermonId) {
      console.error('ERROR: No sermon ID provided in the request');
      return NextResponse.json({ error: 'No sermon ID provided' }, { status: 400 });
    }

    // Check if the file is an audio file
    const isAudio = file.type.startsWith('audio/');
    if (!isAudio) {
      console.error(`ERROR: Uploaded file is not an audio file. Type: ${file.type}`);
      return NextResponse.json({ error: 'File must be an audio file' }, { status: 400 });
    }

    console.log(`Received file: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}, SermonID: ${sermonId}`);

    // Create a temporary directory for file storage
    // In Vercel, use /tmp directory instead of os.tmpdir()
    const isVercel = process.env.VERCEL === '1';
    const tempDir = isVercel ? '/tmp/sermon-audio' : path.join(os.tmpdir(), 'sermon-audio');
    
    console.log(`Using temporary directory: ${tempDir}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('Created temporary directory');
    } else {
      console.log('Temporary directory already exists');
    }

    // Generate unique filenames
    const originalFilename = `${sermonId}-${Date.now()}-${file.name}`;
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

    // Upload the compressed file to Supabase Storage
    console.log('Preparing to upload compressed file to storage...');
    // Instead of streaming, read the file into a buffer
    const compressedFileBuffer = fs.readFileSync(compressedFilePath);
    const fileName = path.basename(compressedFilePath);
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${sermonId}/${uuidv4()}${fileExtension}`;
    console.log(`Storage path: sermons/${uniqueFileName}`);

    console.log('Uploading to Supabase storage...');
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('sermons')
      .upload(uniqueFileName, compressedFileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading compressed file to storage:', uploadError);
      return NextResponse.json({ error: 'Failed to upload compressed file' }, { status: 500 });
    }

    console.log('File uploaded successfully:', uploadData);

    // Get the public URL for the uploaded file
    console.log('Getting public URL for uploaded file...');
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('sermons')
      .getPublicUrl(uniqueFileName);

    const publicUrl = publicUrlData.publicUrl;
    console.log(`Public URL: ${publicUrl}`);

    // Update the sermon record with the new audio URL
    console.log(`Updating sermon record (ID: ${sermonId}) with new audio URL...`);
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('sermons')
      .update({ audio_url: publicUrl })
      .eq('id', sermonId)
      .select();

    if (updateError) {
      console.error('Error updating sermon with new audio URL:', updateError);
      return NextResponse.json({ error: 'Failed to update sermon record' }, { status: 500 });
    }

    console.log('Sermon record updated successfully:', updateData);

    // Clean up temporary files
    console.log('Cleaning up temporary files...');
    try {
      fs.unlinkSync(originalFilePath);
      fs.unlinkSync(compressedFilePath);
      console.log('Temporary files removed');
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }

    console.log('--- AUDIO COMPRESSION COMPLETED SUCCESSFULLY ---');
    return NextResponse.json({
      success: true,
      size: compressedFileSize,
      url: publicUrl,
      originalSize: file.size,
      compressionRatio: `${compressionRatio}%`
    });
  } catch (error) {
    console.error('Error processing audio compression:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 