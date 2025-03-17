import { NextRequest, NextResponse } from 'next/server';
import { getSnippetsBySermonId } from '@/lib/local-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Properly await params to get the ID
    const paramsResolved = await Promise.resolve(params);
    const sermonId = paramsResolved.id;

    if (!sermonId) {
      return NextResponse.json(
        { error: 'Missing sermon ID' },
        { status: 400 }
      );
    }

    // Get the snippets for this sermon from local storage
    const snippets = getSnippetsBySermonId(sermonId);

    return NextResponse.json({
      success: true,
      snippets: snippets || [],
    });
  } catch (error) {
    console.error('Error fetching snippets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snippets' },
      { status: 500 }
    );
  }
} 