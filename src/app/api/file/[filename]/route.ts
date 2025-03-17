import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAudioFilePath } from '@/lib/local-storage';

export async function GET(
  request: NextRequest,
  context: { params: { filename: string } }
) {
  try {
    // Properly await params
    const params = await Promise.resolve(context.params);
    const filename = params.filename;
    
    if (!filename) {
      console.error('Filename parameter is missing');
      return NextResponse.json({ error: 'Filename parameter is missing' }, { status: 400 });
    }
    
    const filePath = getAudioFilePath(filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Determine content type based on file extension
    const extension = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    switch (extension) {
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.ogg':
        contentType = 'audio/ogg';
        break;
      case '.m4a':
        contentType = 'audio/mp4';
        break;
      case '.flac':
        contentType = 'audio/flac';
        break;
    }
    
    // Handle range requests (streaming)
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      // Handle invalid ranges
      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize) {
        return new NextResponse('Invalid Range', {
          status: 416, // Range Not Satisfiable
          headers: {
            'Content-Range': `bytes */${fileSize}`
          }
        });
      }
      
      const chunkSize = end - start + 1;
      console.log(`Serving file: ${filename}, Range: ${start}-${end}/${fileSize}, Size: ${(chunkSize / (1024 * 1024)).toFixed(2)}MB, Type: ${contentType}`);
      
      // Create read stream for the chunk
      const fileStream = fs.createReadStream(filePath, { start, end });
      const chunks: Buffer[] = [];
      
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk));
      }
      
      const buffer = Buffer.concat(chunks);
      
      // Return the chunk with appropriate headers
      return new NextResponse(buffer, {
        status: 206, // Partial Content
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } else {
      // Serve the entire file if no range is requested
      console.log(`Serving whole file: ${filename}, size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB, content type: ${contentType}`);
      
      // For large files (>25MB), suggest using range requests
      if (fileSize > 25 * 1024 * 1024) {
        console.log(`Warning: Serving large file (${(fileSize / (1024 * 1024)).toFixed(2)}MB) without range request`);
      }
      
      // Read file as buffer
      const fileBuffer = fs.readFileSync(filePath);
      
      // Return file with appropriate headers
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}

// For HEAD requests (used when getting file info)
export async function HEAD(
  request: NextRequest,
  context: { params: { filename: string } }
) {
  try {
    // Properly await params
    const params = await Promise.resolve(context.params);
    const filename = params.filename;
    
    if (!filename) {
      console.error('Filename parameter is missing');
      return NextResponse.json({ error: 'Filename parameter is missing' }, { status: 400 });
    }
    
    const filePath = getAudioFilePath(filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Determine content type based on file extension
    const extension = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    switch (extension) {
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.ogg':
        contentType = 'audio/ogg';
        break;
      case '.m4a':
        contentType = 'audio/mp4';
        break;
      case '.flac':
        contentType = 'audio/flac';
        break;
    }
    
    // Return headers only
    return new NextResponse(null, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Last-Modified': stats.mtime.toUTCString(),
      },
    });
  } catch (error) {
    console.error('Error serving file headers:', error);
    return NextResponse.json(
      { error: 'Failed to serve file headers' },
      { status: 500 }
    );
  }
} 