import { NextRequest, NextResponse } from 'next/server';
import { getSnippetsBySermonId } from '@/lib/local-storage';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Properly await params to get the ID
    const paramsResolved = await Promise.resolve(params);
    const sermonId = paramsResolved.id;

    if (!sermonId) {
      console.error('Missing sermon ID in request params');
      return NextResponse.json(
        { error: 'Missing sermon ID' },
        { status: 400 }
      );
    }

    console.log(`Fetching snippets for sermon ID: ${sermonId}`);
    
    // First try to get snippets from Supabase
    let snippets: any[] = [];
    let source = 'supabase';
    
    try {
      console.log(`Attempting to fetch snippets from Supabase for sermon ${sermonId}`);
      
      // Debug Supabase connection
      try {
        const { data: connectionTest, error: connectionError } = await supabaseAdmin
          .from('sermons')
          .select('id')
          .limit(1);
        
        if (connectionError) {
          console.error('Supabase connection test failed:', connectionError);
        } else {
          console.log('Supabase connection test successful');
        }
      } catch (connErr) {
        console.error('Error testing Supabase connection:', connErr);
      }
      
      // Fetch snippets from Supabase
      const { data, error } = await supabaseAdmin
        .from('snippets')
        .select('*')
        .eq('sermonid', sermonId);
        
      if (error) {
        console.error(`Error fetching snippets from Supabase for sermon ${sermonId}:`, error);
        throw error;
      }
      
      console.log(`Supabase query result for sermon ${sermonId}:`, {
        hasData: !!data,
        dataLength: data?.length || 0,
        firstItem: data && data.length > 0 ? data[0].id : null
      });
      
      if (data && data.length > 0) {
        console.log(`Found ${data.length} snippets in Supabase for sermon ${sermonId}`);
        snippets = data;
      } else {
        console.log(`No snippets found in Supabase for sermon ${sermonId}, checking local storage`);
        // Fall back to local storage if no snippets found in Supabase
        const localSnippets = getSnippetsBySermonId(sermonId);
        if (localSnippets && localSnippets.length > 0) {
          console.log(`Found ${localSnippets.length} snippets in local storage for sermon ${sermonId}`);
          snippets = localSnippets;
          source = 'local';
        } else {
          console.log(`No snippets found in local storage either for sermon ${sermonId}`);
        }
      }
    } catch (supabaseError) {
      console.error(`Supabase error for sermon ${sermonId}, falling back to local storage:`, supabaseError);
      // Fall back to local storage if Supabase fails
      try {
        const localSnippets = getSnippetsBySermonId(sermonId);
        snippets = localSnippets || [];
        source = 'local';
        console.log(`Retrieved ${snippets.length} snippets from local storage (fallback)`);
      } catch (localError) {
        console.error(`Local storage fallback also failed for sermon ${sermonId}:`, localError);
      }
    }

    console.log(`Returning ${snippets.length} snippets for sermon ${sermonId} from ${source}`);
    
    return NextResponse.json({
      success: true,
      snippets,
      source,
      count: snippets.length
    });
  } catch (error) {
    console.error('Error fetching snippets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snippets', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 