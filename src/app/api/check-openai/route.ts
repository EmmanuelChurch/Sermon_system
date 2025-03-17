import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if OpenAI API key is configured
    const isConfigured = !!process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      configured: isConfigured,
      message: isConfigured 
        ? 'OpenAI API key is configured' 
        : 'OpenAI API key is not configured'
    });
  } catch (error) {
    console.error('Error checking OpenAI configuration:', error);
    return NextResponse.json(
      { error: 'Failed to check OpenAI configuration' },
      { status: 500 }
    );
  }
} 