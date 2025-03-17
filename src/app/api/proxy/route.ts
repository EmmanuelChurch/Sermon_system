import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// This endpoint proxies requests to external URLs to avoid CORS issues
export async function GET(request: NextRequest) {
  try {
    // Get the URL from the query parameters
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json(
        { error: 'Missing URL parameter' },
        { status: 400 }
      );
    }
    
    console.log('Proxying request to:', url);
    
    // Add dl=1 parameter if it's a Dropbox URL
    let finalUrl = url;
    if (url.includes('dropbox.com') && !url.includes('dl=1')) {
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.set('dl', '1');
        finalUrl = urlObj.toString();
        console.log('Added dl=1 to Dropbox URL:', finalUrl);
      } catch (error) {
        console.error('Error processing URL:', error);
      }
    }
    
    // Create a unique filename based on the URL hash
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const urlHash = crypto.createHash('md5').update(finalUrl).digest('hex');
    const tempFilePath = path.join(tempDir, `proxy-${urlHash}`);
    
    console.log('Attempting to download file to:', tempFilePath);
    
    // Try to download the file
    try {
      // Forward the request to the external URL
      const response = await axios.get(finalUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // Increased timeout for large files (60 seconds)
        headers: {
          // Add headers that help with Dropbox and other services
          'Accept': 'audio/*,*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });
      
      // Get the content type from the response
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      
      console.log('Successfully downloaded file:', {
        contentType,
        size: response.data.length,
        url: finalUrl
      });
      
      // Save the file to temp directory for debugging/caching
      fs.writeFileSync(tempFilePath, response.data);
      console.log('Saved file to:', tempFilePath);
      
      // Return the file with the correct content type
      return new NextResponse(response.data, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(response.data.length),
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (downloadError: any) {
      console.error('Error downloading from URL:', downloadError.message);
      console.error('Response status:', downloadError.response?.status);
      console.error('Response headers:', JSON.stringify(downloadError.response?.headers || {}));
      
      // Log more details about the error
      if (downloadError.response) {
        console.error('Response data:', downloadError.response.data?.toString().substring(0, 200) + '...');
      }
      
      throw new Error(`Failed to download file from ${finalUrl}: ${downloadError.message}`);
    }
  } catch (error: any) {
    console.error('Error proxying external URL:', error.message);
    
    // Return a detailed error response
    return NextResponse.json(
      { 
        error: 'Failed to proxy external file',
        message: error.message,
        url: request.nextUrl.searchParams.get('url'),
        status: error.response?.status || 500
      },
      { status: 500 }
    );
  }
} 