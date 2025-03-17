import { NextRequest, NextResponse } from 'next/server';
import { saveSermon, saveAudioFile } from '@/lib/local-storage';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { compressAudioFile } from '@/lib/openai-whisper';

export async function POST(request: NextRequest) {
  try {
    console.log('New sermon upload request received');
    
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const speaker = formData.get('speaker') as string;
    const date = formData.get('date') as string;
    const audioFile = formData.get('audioFile') as File | null;
    
    // Validate inputs
    console.log('Validating input data');
    if (!title || !speaker || !date) {
      return NextResponse.json(
        { error: 'Required fields are missing' },
        { status: 400 }
      );
    }
    
    // Generate a unique ID for the sermon
    const sermonId = uuidv4();
    console.log(`Generated sermon ID: ${sermonId}`);
    
    // Create sermon object with basic info
    const sermon = {
      id: sermonId,
      title,
      speaker,
      date,
      audiourl: null as string | null,
      transcription: null,
      transcriptionstatus: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // If an audio file was uploaded, save it
    if (audioFile) {
      try {
        console.log(`Processing audio file: ${audioFile.name}, size: ${(audioFile.size / (1024 * 1024)).toFixed(2)}MB`);
        
        // Convert the file to a buffer
        console.log('Converting file to buffer');
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Save the file using local storage
        console.log('Saving audio file to local storage');
        const { url, path: filePath } = saveAudioFile(buffer, audioFile.name, sermonId);
        
        // Check if file needs compression (> 25MB)
        const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
        
        if (buffer.length > MAX_FILE_SIZE) {
          console.log(`File size exceeds 25MB (${(buffer.length / (1024 * 1024)).toFixed(2)}MB), compressing...`);
          
          try {
            // Create temp directory for compression if needed
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Compress the file
            const compressedFilePath = await compressAudioFile(filePath);
            
            if (compressedFilePath !== filePath) {
              // Get size of compressed file
              const compressedStats = fs.statSync(compressedFilePath);
              console.log(`Compression successful. New size: ${(compressedStats.size / (1024 * 1024)).toFixed(2)}MB`);
              
              // Generate a new filename for the compressed file
              const compressedFileName = `${sermonId}_compressed${path.extname(compressedFilePath)}`;
              const compressedStoragePath = path.join(path.dirname(filePath), compressedFileName);
              
              // Copy the compressed file to the storage location
              fs.copyFileSync(compressedFilePath, compressedStoragePath);
              
              // Update the URL to point to the compressed file
              const compressedUrl = `/api/file/${compressedFileName}`;
              sermon.audiourl = compressedUrl;
              
              console.log(`Saved compressed file at: ${compressedStoragePath}`);
              console.log(`Compressed file URL: ${compressedUrl}`);
            } else {
              // No compression was needed or applied
              sermon.audiourl = url;
            }
          } catch (compressionError) {
            console.error('Error during compression:', compressionError);
            // Fall back to the original file if compression fails
            sermon.audiourl = url;
          }
        } else {
          // File is small enough, no compression needed
          console.log(`File size is under 25MB (${(buffer.length / (1024 * 1024)).toFixed(2)}MB), no compression needed`);
          sermon.audiourl = url;
        }
        
        console.log(`Final audio URL: ${sermon.audiourl}`);
      } catch (fileError) {
        console.error('Error saving audio file:', fileError);
        return NextResponse.json(
          { error: 'Failed to save audio file' },
          { status: 500 }
        );
      }
    }
    
    // Save the sermon to local storage
    console.log('Saving sermon metadata to local storage');
    const savedSermon = saveSermon(sermon);
    
    console.log(`Sermon upload complete. ID: ${sermonId}, Title: ${title}`);
    return NextResponse.json({
      success: true,
      sermon: savedSermon
    });
    
  } catch (error) {
    console.error('Error uploading sermon:', error);
    return NextResponse.json(
      { error: 'Failed to upload sermon' },
      { status: 500 }
    );
  }
} 