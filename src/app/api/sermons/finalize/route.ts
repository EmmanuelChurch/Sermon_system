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
    
    // Log incoming request data
    console.log(`Finalizing upload: ${uploadId}, expected chunks: ${totalChunks}`);
    
    // Get the temp directory where chunks are stored
    const isVercel = process.env.VERCEL === '1';
    const tempBaseDir = isVercel ? '/tmp' : os.tmpdir();
    const chunksDir = path.join(tempBaseDir, 'sermon-chunks', uploadId);
    const metadataPath = path.join(chunksDir, 'metadata.json');
    
    if (!fs.existsSync(chunksDir)) {
      console.error(`Chunks directory not found: ${chunksDir}`);
      return NextResponse.json(
        { error: 'Upload session not found or expired' },
        { status: 404 }
      );
    }
    
    if (!fs.existsSync(metadataPath)) {
      console.error(`Metadata file not found: ${metadataPath}`);
      return NextResponse.json(
        { error: 'Upload metadata not found' },
        { status: 404 }
      );
    }
    
    // Load metadata
    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    let metadata;
    try {
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      console.error(`Error parsing metadata: ${error}`);
      return NextResponse.json(
        { error: 'Invalid metadata format' },
        { status: 500 }
      );
    }
    
    console.log(`Metadata loaded, received chunks: ${metadata.receivedChunks.length}/${totalChunks}`);
    
    // Verify we have all chunks
    if (metadata.receivedChunks.length !== totalChunks) {
      // Log the missing chunks for debugging
      const receivedChunkIds = new Set(metadata.receivedChunks);
      const missingChunks = [];
      
      for (let i = 0; i < totalChunks; i++) {
        if (!receivedChunkIds.has(i)) {
          missingChunks.push(i);
        }
      }
      
      console.error(`Missing chunks: ${missingChunks.join(', ')}`);
      
      return NextResponse.json(
        { 
          error: 'Not all chunks were received',
          received: metadata.receivedChunks.length,
          expected: totalChunks,
          missingChunks,
        },
        { status: 400 }
      );
    }
    
    // Check each chunk file exists
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunksDir, `chunk-${i}`);
      if (!fs.existsSync(chunkPath)) {
        console.error(`Chunk file missing: ${chunkPath}`);
        return NextResponse.json(
          { error: `Chunk file ${i} is missing on the server` },
          { status: 500 }
        );
      }
    }
    
    // Sort the received chunks array to make sure we reassemble in order
    metadata.receivedChunks.sort((a: number, b: number) => a - b);
    
    // Create the output file
    const outputDir = path.join(tempBaseDir, 'reassembled-files');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }
    
    const reassembledFilePath = path.join(outputDir, `${uploadId}-${originalFileName}`);
    console.log(`Reassembling to: ${reassembledFilePath}`);
    
    try {
      // Use streams for efficient file handling
      const outputStream = fs.createWriteStream(reassembledFilePath);
      
      // Combine all chunks in order
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunksDir, `chunk-${i}`);
        console.log(`Reading chunk ${i} from ${chunkPath}`);
        
        // Check chunk file exists and has content
        const chunkStats = fs.statSync(chunkPath);
        if (chunkStats.size === 0) {
          console.error(`Chunk ${i} is empty (0 bytes)`);
          return NextResponse.json(
            { error: `Chunk ${i} is empty` },
            { status: 500 }
          );
        }
        
        // Append this chunk to the output file
        const chunkData = fs.readFileSync(chunkPath);
        outputStream.write(chunkData);
      }
      
      // Finalize the file
      outputStream.end();
      
      // Wait for the file to be fully written
      await new Promise<void>((resolve, reject) => {
        outputStream.on('finish', () => {
          console.log(`File reassembly complete, size: ${fs.statSync(reassembledFilePath).size} bytes`);
          resolve();
        });
        outputStream.on('error', (err) => {
          console.error(`Error writing reassembled file: ${err}`);
          reject(err);
        });
      });
    } catch (fileError) {
      console.error(`Error during file reassembly: ${fileError}`);
      return NextResponse.json(
        { error: 'Failed to reassemble file chunks' },
        { status: 500 }
      );
    }
    
    // Extract form data from the metadata
    const { title, speaker, date } = metadata.formData;
    
    // Generate a unique ID for the sermon
    const sermonId = uuidv4();
    
    // Save the reassembled file
    try {
      const fileBuffer = fs.readFileSync(reassembledFilePath);
      
      const { url } = await saveAudioFile(fileBuffer, originalFileName, sermonId);
      console.log(`Saved audio file with URL: ${url}`);
      
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
      console.log(`Sermon saved with ID: ${sermonId}`);
      
      // Clean up temporary files - wrap in try/catch to continue even if cleanup fails
      try {
        console.log(`Cleaning up temporary files from ${chunksDir}`);
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