import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { saveAudioFile } from '@/lib/local-storage';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { compressAudioFile } from '@/lib/openai-whisper';

/**
 * API endpoint to handle audio file uploads for an existing sermon
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sermonId = params.id;
    console.log(`Processing audio update for sermon ID: ${sermonId}`);
    
    // First check if the sermon exists
    const { data: sermon, error: sermonError } = await supabaseAdmin
      .from('sermons')
      .select('*')
      .eq('id', sermonId)
      .single();
    
    if (sermonError || !sermon) {
      console.error('Sermon not found:', sermonError);
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
    }
    
    // Check if the request is multipart form data (file upload) or JSON (recording selection)
    const contentType = request.headers.get('content-type') || '';
    
    // Handle form data with file upload
    if (contentType.includes('multipart/form-data')) {
      console.log('Processing file upload');
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }
      
      console.log(`Processing audio file: ${file.name}, size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
      
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Save the file to local storage
      console.log('Saving audio file');
      const { url, path: filePath } = await saveAudioFile(buffer, file.name, sermonId);
      
      // Check if the file needs compression (> 25MB)
      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit
      let finalUrl = url;
      
      if (buffer.length > MAX_FILE_SIZE) {
        console.log(`File size exceeds 25MB (${(buffer.length / (1024 * 1024)).toFixed(2)}MB), compressing...`);
        
        try {
          // Determine temp directory based on environment
          const tempDir = process.env.NODE_ENV === 'production' 
            ? '/tmp' 
            : path.join(process.cwd(), 'temp');
            
          // Make sure it exists
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
            finalUrl = `/api/file/${compressedFileName}`;
            
            console.log(`Saved compressed file at: ${compressedStoragePath}`);
            console.log(`Compressed file URL: ${finalUrl}`);
          }
        } catch (compressionError) {
          console.error('Error during compression:', compressionError);
          // Fall back to the original file if compression fails
        }
      }
      
      // Update the sermon record with the new audio URL
      const { error: updateError } = await supabaseAdmin
        .from('sermons')
        .update({
          audiourl: finalUrl,
          transcriptionstatus: 'pending', // Reset transcription status
          transcription: null, // Clear any previous transcription
          updatedat: new Date().toISOString()
        })
        .eq('id', sermonId);
      
      if (updateError) {
        console.error('Error updating sermon record:', updateError);
        return NextResponse.json(
          { error: 'Failed to update sermon record' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        url: finalUrl,
        message: 'Audio file uploaded successfully'
      });
    } 
    // Handle JSON request (likely recording selection)
    else {
      // Processing direct URL or recording selection
      const { recordingFile, externalUrl } = await request.json();
      
      let audioUrl: string | null = null;
      
      if (recordingFile) {
        // Assuming the recording ID corresponds to a file saved in local storage
        audioUrl = `/api/file/${recordingFile}`;
      } else if (externalUrl) {
        // External URL provided
        audioUrl = externalUrl;
      } else {
        return NextResponse.json(
          { error: 'No recording or URL provided' },
          { status: 400 }
        );
      }
      
      // Update the sermon record with the new audio URL
      const { error: updateError } = await supabaseAdmin
        .from('sermons')
        .update({
          audiourl: audioUrl,
          transcriptionstatus: 'pending', // Reset transcription status
          transcription: null, // Clear any previous transcription
          updatedat: new Date().toISOString()
        })
        .eq('id', sermonId);
      
      if (updateError) {
        console.error('Error updating sermon record:', updateError);
        return NextResponse.json(
          { error: 'Failed to update sermon record' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        url: audioUrl,
        message: 'Audio file reference updated successfully'
      });
    }
  } catch (error) {
    console.error('Error handling audio update:', error);
    return NextResponse.json(
      { error: 'Failed to process audio update' },
      { status: 500 }
    );
  }
} 