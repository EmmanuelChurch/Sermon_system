import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { saveSermon, saveAudioFile } from '@/lib/local-storage';

// Handler for finalizing chunked uploads
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Get metadata
    const uploadId = formData.get('uploadId') as string;
    const totalChunks = Number(formData.get('totalChunks'));
    const originalFileName = formData.get('originalFileName') as string;
    
    if (!uploadId || isNaN(totalChunks)) {
      return NextResponse.json(
        { error: 'Missing required finalization metadata' },
        { status: 400 }
      );
    }
    
    // Get the temp directory where chunks are stored
    const isVercel = process.env.VERCEL === '1';
    const tempBaseDir = isVercel ? '/tmp' : os.tmpdir();
    const chunksDir = path.join(tempBaseDir, 'sermon-chunks', uploadId);
    const metadataPath = path.join(chunksDir, 'metadata.json');
    
    if (!fs.existsSync(chunksDir) || !fs.existsSync(metadataPath)) {
      return NextResponse.json(
        { error: 'Upload session not found or expired' },
        { status: 404 }
      );
    }
    
    // Load metadata
    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    // Verify we have all chunks
    if (metadata.receivedChunks.length !== totalChunks) {
      return NextResponse.json(
        { 
          error: 'Not all chunks were received',
          received: metadata.receivedChunks.length,
          expected: totalChunks
        },
        { status: 400 }
      );
    }
    
    // Sort the received chunks array to make sure we reassemble in order
    metadata.receivedChunks.sort((a: number, b: number) => a - b);
    
    // Create the output file
    const outputDir = path.join(tempBaseDir, 'reassembled-files');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const reassembledFilePath = path.join(outputDir, `${uploadId}-${originalFileName}`);
    const outputStream = fs.createWriteStream(reassembledFilePath);
    
    // Combine all chunks in order
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunksDir, `chunk-${i}`);
      
      if (!fs.existsSync(chunkPath)) {
        outputStream.close();
        return NextResponse.json(
          { error: `Missing chunk ${i}` },
          { status: 500 }
        );
      }
      
      // Append this chunk to the output file
      const chunkData = fs.readFileSync(chunkPath);
      outputStream.write(chunkData);
    }
    
    outputStream.end();
    
    console.log(`Reassembled file saved to ${reassembledFilePath}`);
    
    // Wait for the file to be fully written
    await new Promise<void>((resolve) => {
      outputStream.on('finish', () => {
        resolve();
      });
    });
    
    // Extract form data from the metadata
    const { title, speaker, date } = metadata.formData;
    
    // Generate a unique ID for the sermon
    const sermonId = uuidv4();
    
    // Save the reassembled file
    try {
      const fileBuffer = fs.readFileSync(reassembledFilePath);
      
      const { url } = await saveAudioFile(fileBuffer, originalFileName, sermonId);
      
      // Save sermon data
      const sermon = {
        id: sermonId,
        title: title || 'Untitled',
        speaker: speaker || 'Unknown',
        date: date || new Date().toISOString().split('T')[0],
        audiourl: url,
        transcriptionstatus: 'not_started',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      await saveSermon(sermon);
      
      // Clean up temporary files
      try {
        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = path.join(chunksDir, `chunk-${i}`);
          if (fs.existsSync(chunkPath)) {
            fs.unlinkSync(chunkPath);
          }
        }
        
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
        }
        
        fs.rmdirSync(chunksDir);
        fs.unlinkSync(reassembledFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary files:', cleanupError);
        // Non-fatal error, continue
      }
      
      return NextResponse.json({
        id: sermonId,
        message: 'Chunked upload completed successfully',
      });
    } catch (error) {
      console.error('Error saving reassembled file:', error);
      return NextResponse.json(
        { error: 'Failed to save the reassembled file' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error finalizing chunked upload:', error);
    return NextResponse.json(
      { error: 'Failed to finalize chunked upload' },
      { status: 500 }
    );
  }
} 