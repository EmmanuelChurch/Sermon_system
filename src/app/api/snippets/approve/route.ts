import { NextRequest, NextResponse } from 'next/server';
import { getSnippetsBySermonId, updateSnippet } from '@/lib/local-storage';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { snippetId, approved } = await request.json();
    
    if (!snippetId) {
      return NextResponse.json(
        { error: 'Snippet ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Updating snippet ${snippetId} approved status to: ${approved}`);
    
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
        // Update the snippet's approval status
        updatedSnippet = await updateSnippet(sermon.id, snippetId, {
          approved,
          updatedAt: new Date().toISOString(),
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
    
    return NextResponse.json({ snippet: updatedSnippet });
  } catch (error) {
    console.error('Error approving snippet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update approval status' },
      { status: 500 }
    );
  }
} 