import { NextRequest, NextResponse } from 'next/server';

// This API route is deprecated as client-side FFmpeg has been disabled
// due to browser compatibility issues. We now use direct upload to S3
// without client-side compression.

export async function GET(req: NextRequest) {
  return new NextResponse(
    JSON.stringify({ 
      message: 'FFmpeg API endpoints are disabled. Direct upload is used instead.' 
    }),
    { 
      status: 410, // Gone
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 