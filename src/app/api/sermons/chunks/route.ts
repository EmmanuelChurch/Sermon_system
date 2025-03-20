import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

// Add this helper function before the POST function
async function ensureDirectoryExists(filePath: string) {
  try {
    await mkdir(dirname(filePath), { recursive: true });
    console.log(`Ensured directory exists: ${dirname(filePath)}`);
  } catch (error) {
    // Directory already exists or creation failed
    console.error("Error creating directory:", error);
  }
}

// Handler for receiving file chunks
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Get chunk metadata
    const chunk = formData.get('chunk') as File;
    const chunkIndex = Number(formData.get('chunkIndex'));
    const totalChunks = Number(formData.get('totalChunks'));
    const uploadId = formData.get('uploadId') as string;
    const originalFileName = formData.get('originalFileName') as string;
    
    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !uploadId) {
      console.error('Missing required chunk metadata', { chunkIndex, totalChunks, uploadId });
      return NextResponse.json(
        { error: 'Missing required chunk metadata' },
        { status: 400 }
      );
    }
    
    console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} for upload ${uploadId}, size: ${chunk.size} bytes`);
    
    // Create a temporary directory for the chunks
    const isVercel = process.env.VERCEL === '1';
    const tempBaseDir = isVercel ? '/tmp' : os.tmpdir();
    const chunksDir = path.join(tempBaseDir, 'sermon-chunks', uploadId);
    
    // Ensure the directory exists
    try {
      if (!fs.existsSync(chunksDir)) {
        fs.mkdirSync(chunksDir, { recursive: true });
        console.log(`Created chunks directory: ${chunksDir}`);
      }
    } catch (error) {
      console.error('Error creating chunks directory:', error);
      return NextResponse.json(
        { error: 'Failed to create storage for chunks' },
        { status: 500 }
      );
    }
    
    // Save the chunk to a temporary file
    const chunkPath = path.join(chunksDir, `chunk-${chunkIndex}`);
    
    try {
      // Get chunk data
      const chunkArrayBuffer = await chunk.arrayBuffer();
      const chunkBuffer = Buffer.from(chunkArrayBuffer);
      
      if (chunkBuffer.length === 0) {
        console.error(`Received empty chunk ${chunkIndex + 1}/${totalChunks}`);
        return NextResponse.json(
          { error: 'Received empty chunk' },
          { status: 400 }
        );
      }
      
      // Ensure the directory exists before writing
      await ensureDirectoryExists(chunkPath);
      
      // Write chunk to disk
      fs.writeFileSync(chunkPath, chunkBuffer);
      console.log(`Saved chunk ${chunkIndex + 1}/${totalChunks} for upload ${uploadId}, size: ${chunkBuffer.length} bytes`);
      
      // Store chunk metadata for reassembly
      const metadataPath = path.join(chunksDir, 'metadata.json');
      let metadata = {
        uploadId,
        originalFileName,
        totalChunks,
        receivedChunks: [] as number[],
        formData: {} as Record<string, string>,
        chunkSizes: {} as Record<string, number>,
      };
      
      // Load existing metadata if available
      if (fs.existsSync(metadataPath)) {
        try {
          const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
        } catch (metadataError) {
          console.error('Error reading metadata, starting fresh:', metadataError);
          // Continue with fresh metadata
        }
      } 
      
      // Track chunk size for validation
      metadata.chunkSizes[chunkIndex] = chunkBuffer.length;
      
      // Add this chunk to received chunks if not already there
      if (!metadata.receivedChunks.includes(chunkIndex)) {
        metadata.receivedChunks.push(chunkIndex);
        console.log(`Added chunk ${chunkIndex} to receivedChunks array, now have ${metadata.receivedChunks.length}/${totalChunks}`);
      } else {
        console.log(`Chunk ${chunkIndex} already in receivedChunks array`);
      }
      
      // Double check that we save the last chunk
      if (chunkIndex === totalChunks - 1) {
        console.log(`Received last chunk (${chunkIndex}), ensuring it's properly tracked`);
        
        // Make absolutely sure the last chunk is in the received chunks array
        if (!metadata.receivedChunks.includes(chunkIndex)) {
          metadata.receivedChunks.push(chunkIndex);
          console.log(`Added last chunk ${chunkIndex} to receivedChunks array`);
        }
        
        // Verify the received chunks against total
        console.log(`After last chunk, have ${metadata.receivedChunks.length}/${totalChunks} chunks`);
        
        // If we're still missing chunks, log which ones for debugging
        if (metadata.receivedChunks.length < totalChunks) {
          const missingChunks = [];
          for (let i = 0; i < totalChunks; i++) {
            if (!metadata.receivedChunks.includes(i)) {
              missingChunks.push(i);
            }
          }
          console.log(`Still missing chunks: ${missingChunks.join(', ')}`);
        }
      }
      
      // Store form data from the first chunk
      if (chunkIndex === 0) {
        // Extract other form fields
        for (const [key, value] of formData.entries()) {
          if (
            key !== 'chunk' && 
            key !== 'chunkIndex' && 
            key !== 'totalChunks' && 
            key !== 'uploadId' && 
            key !== 'originalFileName' && 
            key !== 'originalFileSize' && 
            key !== 'fileType' &&
            typeof value === 'string'
          ) {
            metadata.formData[key] = value;
          }
        }
      }
      
      // Save metadata
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      
      console.log(`Updated metadata: ${metadata.receivedChunks.length}/${totalChunks} chunks received`);
      
      return NextResponse.json({
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} received successfully`,
        chunkIndex,
        totalChunks,
        receivedCount: metadata.receivedChunks.length,
        uploadId
      });
    } catch (error) {
      console.error('Error saving chunk:', error);
      return NextResponse.json(
        { error: `Failed to save chunk: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing chunk upload:', error);
    return NextResponse.json(
      { error: `Failed to process chunk upload: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 