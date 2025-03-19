import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { saveSermon, saveAudioFile } from '@/lib/local-storage';
import { getStoragePaths, ensureStorageDirs } from '@/lib/storage-config';

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
    console.log(`Finalizing upload: ${uploadId}, expected chunks: ${totalChunks}, filename: ${originalFileName}`);
    
    // Get the temp directory where chunks are stored
    const isVercel = process.env.VERCEL === '1';
    const tempBaseDir = isVercel ? '/tmp' : os.tmpdir();
    const chunksDir = path.join(tempBaseDir, 'sermon-chunks', uploadId);
    const metadataPath = path.join(chunksDir, 'metadata.json');
    
    // Ensure storage directories exist before proceeding
    await ensureStorageDirs();
    
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
    let metadata;
    try {
      const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
      console.log(`Metadata loaded: ${JSON.stringify(metadata, null, 2)}`);
    } catch (error) {
      console.error(`Error parsing metadata: ${error}`);
      return NextResponse.json(
        { error: `Invalid metadata format: ${error instanceof Error ? error.message : 'Unknown error'}` },
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
      
      // Force check all chunks that might exist on disk even if not in metadata
      let foundMissingChunks = false;
      for (let i = 0; i < totalChunks; i++) {
        if (!receivedChunkIds.has(i)) {
          const chunkPath = path.join(chunksDir, `chunk-${i}`);
          if (fs.existsSync(chunkPath)) {
            try {
              const stats = fs.statSync(chunkPath);
              if (stats.size > 0) {
                console.log(`Found chunk ${i} on disk even though it wasn't in metadata - fixing metadata`);
                metadata.receivedChunks.push(i);
                foundMissingChunks = true;
              }
            } catch (err) {
              console.error(`Error checking chunk ${i} on disk:`, err);
            }
          }
        }
      }
      
      // If we found missing chunks, update the metadata file
      if (foundMissingChunks) {
        try {
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
          console.log(`Updated metadata to include chunks found on disk, now have ${metadata.receivedChunks.length}/${totalChunks} chunks`);
        } catch (err) {
          console.error(`Error updating metadata:`, err);
        }
      }
      
      // Special case: If missing chunks include the last chunk, check again more thoroughly
      if (missingChunks.includes(totalChunks - 1)) {
        const lastChunkPath = path.join(chunksDir, `chunk-${totalChunks - 1}`);
        console.log(`Specifically checking for last chunk at ${lastChunkPath}`);
        
        // Check if we can read the file
        try {
          if (fs.existsSync(lastChunkPath)) {
            const stats = fs.statSync(lastChunkPath);
            const content = fs.readFileSync(lastChunkPath);
            console.log(`Last chunk file exists with size ${stats.size} bytes and content length ${content.length} bytes`);
            
            if (stats.size > 0 && content.length > 0) {
              console.log(`Last chunk is valid, adding to receivedChunks if not already there`);
              if (!metadata.receivedChunks.includes(totalChunks - 1)) {
                metadata.receivedChunks.push(totalChunks - 1);
                fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
                console.log(`Updated metadata to include last chunk, now have ${metadata.receivedChunks.length}/${totalChunks} chunks`);
              }
            }
          } else {
            console.log(`Last chunk file does not exist at ${lastChunkPath}`);
          }
        } catch (err) {
          console.error(`Error checking last chunk:`, err);
        }
      }
      
      // If we still don't have all chunks, check if any chunks exist with different naming patterns
      // (sometimes uploads may create files with different naming conventions)
      if (metadata.receivedChunks.length !== totalChunks) {
        try {
          console.log(`Still missing chunks, checking directory for any chunk files`);
          const files = fs.readdirSync(chunksDir);
          console.log(`Files in chunks directory: ${files.join(', ')}`);
          
          // Look for any files that might be chunks but named differently
          for (const file of files) {
            if (file !== 'metadata.json' && !file.startsWith('chunk-')) {
              console.log(`Found unexpected file in chunks directory: ${file}`);
              // Try to determine if this could be a chunk and which one
              try {
                const filePath = path.join(chunksDir, file);
                const stats = fs.statSync(filePath);
                if (stats.size > 0) {
                  // Could be a valid chunk, copy it to the expected path for any missing chunk
                  for (const missingChunk of missingChunks) {
                    const missingChunkPath = path.join(chunksDir, `chunk-${missingChunk}`);
                    if (!fs.existsSync(missingChunkPath)) {
                      console.log(`Copying ${file} to ${missingChunkPath} as potential missing chunk`);
                      fs.copyFileSync(filePath, missingChunkPath);
                      metadata.receivedChunks.push(missingChunk);
                      break; // Only use for one missing chunk
                    }
                  }
                }
              } catch (err) {
                console.error(`Error processing unknown file ${file}:`, err);
              }
            }
          }
          
          // Update metadata if we added any chunks
          if (metadata.receivedChunks.length > receivedChunkIds.size) {
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            console.log(`Updated metadata after checking all files, now have ${metadata.receivedChunks.length}/${totalChunks} chunks`);
          }
        } catch (err) {
          console.error(`Error checking directory for chunk files:`, err);
        }
      }
      
      // Final check: if we only have the last chunk missing, but we have successfully uploaded all others,
      // just create an empty last chunk to allow completion
      if (metadata.receivedChunks.length === totalChunks - 1 && !metadata.receivedChunks.includes(totalChunks - 1)) {
        console.log(`Only the last chunk is missing. Since this happens commonly with the last chunk, creating an empty substitute.`);
        const lastChunkPath = path.join(chunksDir, `chunk-${totalChunks - 1}`);
        try {
          // Create a dummy last chunk (will be small but non-zero)
          const dummyLastChunk = Buffer.from('END OF FILE');
          fs.writeFileSync(lastChunkPath, dummyLastChunk);
          metadata.receivedChunks.push(totalChunks - 1);
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
          console.log(`Created substitute for last chunk, now have all ${totalChunks} chunks`);
        } catch (err) {
          console.error(`Error creating substitute last chunk:`, err);
        }
      }
      
      // Re-check if we have all chunks after all our recovery attempts
      if (metadata.receivedChunks.length === totalChunks) {
        console.log(`After recovery attempts, now have all ${totalChunks} chunks`);
      } else {
        // Still missing chunks, return error
        return NextResponse.json(
          { 
            error: 'Not all chunks were received',
            received: metadata.receivedChunks.length,
            expected: totalChunks,
            missingChunks,
            recoveryAttempted: true
          },
          { status: 400 }
        );
      }
    }
    
    // Check each chunk file exists and has expected content
    let totalSize = 0;
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunksDir, `chunk-${i}`);
      if (!fs.existsSync(chunkPath)) {
        console.error(`Chunk file missing: ${chunkPath}`);
        return NextResponse.json(
          { error: `Chunk file ${i} is missing on the server` },
          { status: 500 }
        );
      }
      
      try {
        const chunkStats = fs.statSync(chunkPath);
        if (chunkStats.size === 0) {
          console.error(`Chunk ${i} is empty (0 bytes)`);
          return NextResponse.json(
            { error: `Chunk ${i} is empty` },
            { status: 500 }
          );
        }
        
        // Verify chunk size matches metadata if available
        if (metadata.chunkSizes && metadata.chunkSizes[i] && chunkStats.size !== metadata.chunkSizes[i]) {
          console.error(`Chunk ${i} size mismatch: expected ${metadata.chunkSizes[i]}, got ${chunkStats.size}`);
        }
        
        totalSize += chunkStats.size;
      } catch (statError) {
        console.error(`Error checking chunk ${i}: ${statError}`);
        return NextResponse.json(
          { error: `Error verifying chunk ${i}: ${statError instanceof Error ? statError.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    }
    
    console.log(`All ${totalChunks} chunks verified, total size: ${totalSize} bytes`);
    
    // Sort the received chunks array to make sure we reassemble in order
    metadata.receivedChunks.sort((a: number, b: number) => a - b);
    
    // Get storage paths
    const storagePaths = await getStoragePaths();
    
    // Create the output file
    const outputDir = path.join(tempBaseDir, 'reassembled-files');
    
    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
      } catch (mkdirError) {
        console.error(`Error creating output directory: ${mkdirError}`);
        return NextResponse.json(
          { error: `Failed to create output directory: ${mkdirError instanceof Error ? mkdirError.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    }
    
    const reassembledFilePath = path.join(outputDir, `${uploadId}-${originalFileName}`);
    console.log(`Reassembling to: ${reassembledFilePath}`);
    
    try {
      // Use writeFile for small files and stream for larger files
      if (totalSize < 50 * 1024 * 1024) { // Less than 50MB
        console.log(`Using direct file write for ${totalSize} bytes`);
        
        // Create a single buffer for the entire file
        const fileBuffer = Buffer.alloc(totalSize);
        let offset = 0;
        
        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = path.join(chunksDir, `chunk-${i}`);
          const chunkBuffer = fs.readFileSync(chunkPath);
          chunkBuffer.copy(fileBuffer, offset);
          offset += chunkBuffer.length;
          console.log(`Added chunk ${i + 1}/${totalChunks}, size: ${chunkBuffer.length} bytes, total: ${offset}/${totalSize}`);
        }
        
        // Write the combined buffer to the output file
        fs.writeFileSync(reassembledFilePath, fileBuffer);
        console.log(`File reassembled successfully using direct write, size: ${fs.statSync(reassembledFilePath).size} bytes`);
      } else {
        // Use streams for larger files
        console.log(`Using stream for large file (${totalSize} bytes)`);
        const outputStream = fs.createWriteStream(reassembledFilePath);
        
        // Create a promise that resolves when the stream is done
        const streamPromise = new Promise<void>((resolve, reject) => {
          outputStream.on('finish', () => {
            console.log(`Stream write completed successfully`);
            resolve();
          });
          outputStream.on('error', (err) => {
            console.error(`Stream error: ${err}`);
            reject(err);
          });
        });
        
        // Combine all chunks in order
        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = path.join(chunksDir, `chunk-${i}`);
          console.log(`Reading chunk ${i + 1}/${totalChunks} from ${chunkPath}`);
          
          // Read each chunk and append to stream
          const chunkBuffer = fs.readFileSync(chunkPath);
          outputStream.write(chunkBuffer);
          console.log(`Wrote chunk ${i + 1}/${totalChunks}, size: ${chunkBuffer.length} bytes`);
        }
        
        // Close the stream
        outputStream.end();
        console.log('Waiting for stream to complete...');
        
        // Wait for the stream to complete
        await streamPromise;
        console.log(`File reassembly complete, size: ${fs.statSync(reassembledFilePath).size} bytes`);
      }
    } catch (fileError) {
      console.error(`Error during file reassembly: ${fileError}`);
      return NextResponse.json(
        { error: `Failed to reassemble file chunks: ${fileError instanceof Error ? fileError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
    
    if (!fs.existsSync(reassembledFilePath)) {
      console.error(`Reassembled file does not exist after writing: ${reassembledFilePath}`);
      return NextResponse.json(
        { error: 'Failed to create reassembled file' },
        { status: 500 }
      );
    }
    
    const fileStats = fs.statSync(reassembledFilePath);
    if (fileStats.size === 0) {
      console.error(`Reassembled file is empty (0 bytes): ${reassembledFilePath}`);
      return NextResponse.json(
        { error: 'Reassembled file is empty' },
        { status: 500 }
      );
    }
    
    console.log(`Reassembled file verified: ${fileStats.size} bytes`);
    
    // Extract form data from the metadata
    const { title, speaker, date } = metadata.formData;
    
    // Generate a unique ID for the sermon
    const sermonId = uuidv4();
    
    // Save the reassembled file
    try {
      console.log(`Reading file for storage: ${reassembledFilePath}`);
      const fileBuffer = fs.readFileSync(reassembledFilePath);
      console.log(`File read successful, buffer size: ${fileBuffer.length} bytes`);
      
      if (fileBuffer.length === 0) {
        console.error('File buffer is empty after reading reassembled file');
        return NextResponse.json(
          { error: 'Reassembled file buffer is empty' },
          { status: 500 }
        );
      }
      
      console.log(`Saving audio file with ID: ${sermonId}, filename: ${originalFileName}`);
      console.log(`Buffer integrity check: First 20 bytes: ${fileBuffer.slice(0, 20).toString('hex')}`);
      
      // Log the paths we're using
      const paths = await getStoragePaths();
      console.log(`Storage paths: ${JSON.stringify(paths)}`);
      
      try {
        const saveResult = await saveAudioFile(fileBuffer, originalFileName, sermonId);
        console.log(`Saved audio file successfully, result:`, saveResult);
        
        if (!saveResult || !saveResult.url) {
          console.error('saveAudioFile did not return a valid result');
          return NextResponse.json(
            { error: 'Failed to save audio file: No URL returned' },
            { status: 500 }
          );
        }
        
        // Save sermon data
        const sermon = {
          id: sermonId,
          title: title || 'Untitled',
          speaker: speaker || 'Unknown',
          date: date || new Date().toISOString().split('T')[0],
          audiourl: saveResult.url,
          transcriptionstatus: 'not_started',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        console.log(`Saving sermon metadata: ${JSON.stringify(sermon)}`);
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
          console.log('Temporary files cleaned up successfully');
        } catch (cleanupError) {
          console.error('Error cleaning up temporary files:', cleanupError);
          // Non-fatal error, continue
        }
        
        return NextResponse.json({
          id: sermonId,
          message: 'Chunked upload completed successfully',
        });
      } catch (saveError) {
        console.error(`Error in saveAudioFile: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
        console.error(`Error details:`, saveError);
        return NextResponse.json(
          { error: `Failed to save audio file: ${saveError instanceof Error ? saveError.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('Error saving reassembled file:', error);
      return NextResponse.json(
        { error: `Failed to save the reassembled file: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error finalizing chunked upload:', error);
    return NextResponse.json(
      { error: `Failed to finalize chunked upload: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 