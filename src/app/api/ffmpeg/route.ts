import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Get the file path from the URL
    const url = new URL(req.url);
    const filePath = url.pathname.replace('/api/ffmpeg', '');
    
    // Map to the actual file in public/ffmpeg
    const publicFilePath = path.join(process.cwd(), 'public', 'ffmpeg', filePath);
    
    // Check if the file exists
    if (!fs.existsSync(publicFilePath)) {
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Read the file content
    const fileContent = fs.readFileSync(publicFilePath);
    
    // Determine content type based on file extension
    let contentType = 'application/octet-stream';
    if (filePath.endsWith('.js')) {
      contentType = 'application/javascript';
    } else if (filePath.endsWith('.wasm')) {
      contentType = 'application/wasm';
    }
    
    // Create and return the response with CORS headers
    const response = new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
    return response;
  } catch (error) {
    console.error('Error serving FFmpeg file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  });
} 