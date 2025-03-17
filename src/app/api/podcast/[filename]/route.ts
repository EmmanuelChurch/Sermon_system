import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getPodcastFilePath } from '@/lib/audio-processor';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    
    if (!filename) {
      return new NextResponse('Filename is required', { status: 400 });
    }
    
    const filePath = getPodcastFilePath(filename);
    
    // Check if file exists
    try {
      await fs.promises.access(filePath);
    } catch (error) {
      console.error(`File not found: ${filePath}`);
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Get file size
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    
    // Handle range requests (for audio streaming)
    const range = request.headers.get('range');
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      console.log(`Serving file: ${filename}, Range: ${start}-${end}/${fileSize}, Size: ${(chunkSize / (1024 * 1024)).toFixed(2)}MB, Type: audio/mpeg`);
      
      const file = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(chunkSize);
      await file.read(buffer, 0, chunkSize, start);
      await file.close();
      
      // Set the appropriate headers
      const headers = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': 'audio/mpeg',
      };
      
      return new NextResponse(buffer, {
        status: 206,
        headers: headers,
      });
    } else {
      // Non-range request (full file)
      console.log(`Serving full file: ${filename}, Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB, Type: audio/mpeg`);
      
      const buffer = await fs.promises.readFile(filePath);
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': fileSize.toString(),
        },
      });
    }
  } catch (error) {
    console.error('Error serving podcast file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 