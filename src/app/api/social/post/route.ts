import { NextRequest, NextResponse } from 'next/server';
import { getSnippetsBySermonId, updateSnippet } from '@/lib/local-storage';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { snippetId, platforms } = await request.json();
    
    if (!snippetId) {
      return NextResponse.json(
        { error: 'Snippet ID is required' },
        { status: 400 }
      );
    }
    
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: 'At least one platform is required' },
        { status: 400 }
      );
    }
    
    console.log(`Posting snippet ${snippetId} to platforms: ${platforms.join(', ')}`);
    
    // Fetch all sermons
    const sermonsResponse = await fetch(`${request.nextUrl.origin}/api/sermons`);
    if (!sermonsResponse.ok) {
      throw new Error(`Failed to fetch sermons: ${sermonsResponse.status}`);
    }
    
    const sermonsData = await sermonsResponse.json();
    
    // Handle different response formats
    let sermons = [];
    if (Array.isArray(sermonsData)) {
      sermons = sermonsData;
    } else if (sermonsData && typeof sermonsData === 'object') {
      sermons = sermonsData.sermons || [];
    }
    
    if (!Array.isArray(sermons)) {
      throw new Error(`Invalid sermons data format: ${JSON.stringify(sermonsData)}`);
    }
    
    console.log(`Found ${sermons.length} sermons to search through`);
    
    let updatedSnippet = null;
    
    // Find the snippet in each sermon's snippets
    for (const sermon of sermons) {
      const snippets = getSnippetsBySermonId(sermon.id);
      const foundSnippet = snippets.find((s: any) => s.id === snippetId);
      
      if (foundSnippet) {
        // In a real app, this is where you'd integrate with the social media platforms' APIs
        
        // Update the snippet's posted status
        updatedSnippet = await updateSnippet(sermon.id, snippetId, {
          posted: true,
          platforms: platforms,
          postedAt: new Date().toISOString(),
        });
        break;
      }
    }
    
    if (!updatedSnippet) {
      return NextResponse.json(
        { error: 'Snippet not found' },
        { status: 404 }
      );
    }
    
    // Simulate a successful posting
    return NextResponse.json({
      success: true, 
      message: `Successfully posted to ${platforms.join(', ')}`,
      snippet: updatedSnippet
    });
  } catch (error) {
    console.error('Error posting snippet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post snippet' },
      { status: 500 }
    );
  }
} 