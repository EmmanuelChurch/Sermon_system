import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { statSync, createReadStream } from 'fs';
import fs from 'fs';
import path from 'path';

// Map of file extensions to MIME types
const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get the path from the URL
    const pathParts = (await params).path || [];
    if (!pathParts || pathParts.length === 0) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Construct the full file path
    const filePath = join(process.cwd(), 'recordings', ...pathParts);
    
    try {
      // Check if the file exists and get its size
      const stats = statSync(filePath);
      
      // Determine the content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      
      // Read the file synchronously (for smaller files)
      // This avoids stream conversion issues with TypeScript
      const fileBuffer = fs.readFileSync(filePath);
      
      // Return the file as a response
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': stats.size.toString(),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (err) {
      console.error('File not found or not accessible:', filePath, err);
      return new NextResponse('File not found', { status: 404 });
    }
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 