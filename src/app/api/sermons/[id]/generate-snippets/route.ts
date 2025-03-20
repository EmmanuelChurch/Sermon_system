import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSermonById, saveSermon, saveSnippets } from '@/lib/local-storage';
import { generateSnippets } from '@/lib/openai';
import { Snippet } from '@/types';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
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

    // Get the sermon record from Supabase
    let { data: sermon, error: sermonError } = await supabaseAdmin
      .from('sermons')
      .select('*')
      .eq('id', sermonId)
      .single();

    if (sermonError || !sermon) {
      console.log('Falling back to local storage for sermon data');
      // Fall back to local storage
      const localSermon = await getSermonById(sermonId);

      if (!localSermon) {
        return NextResponse.json(
          { error: 'Sermon not found in Supabase or local storage' },
          { status: 404 }
        );
      }

      // Use the local sermon data
      sermon = localSermon;
    }

    if (!sermon.transcription) {
      return NextResponse.json(
        { error: 'Sermon has no transcription' },
        { status: 400 }
      );
    }

    // Generate snippets using OpenAI with the enhanced prompt
    console.log(`Generating snippets for sermon: ${sermonId}`);
    
    try {
      const snippetsData = await generateSnippets(sermon.transcription);
      
      // Prepare snippets for storage - transforming the complex structure into a flattened array
      const allSnippets: any[] = [];
      
      // Process the snippetsData based on its format
      // Check if we have a nested structure or flat array structure
      Object.entries(snippetsData).forEach(([platform, content]) => {
        // Handle nested structure: { platform: { category: [items] } }
        if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
          // Nested structure case
          Object.entries(content).forEach(([category, items]) => {
            if (Array.isArray(items)) {
              items.forEach(item => {
                allSnippets.push({
                  id: uuidv4(),
                  sermon_id: sermonId, // For local storage
                  sermonid: sermonId, // For Supabase
                  platform,
                  category,
                  content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content),
                  format: item.format || null,
                  timestamp: item.timestamp || 0,
                  approved: false,
                  posted: false,
                  createdat: new Date().toISOString(),
                  updatedat: new Date().toISOString(),
                });
              });
            }
          });
        } 
        // Handle flat array structure: { platform: [ {category, content, ...} ] }
        else if (Array.isArray(content)) {
          content.forEach(item => {
            allSnippets.push({
              id: uuidv4(),
              sermon_id: sermonId, // For local storage
              sermonid: sermonId, // For Supabase
              platform,
              category: item.category || 'Uncategorized',
              content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content),
              format: item.format || null,
              timestamp: item.timestamp || 0,
              approved: false,
              posted: false,
              createdat: new Date().toISOString(),
              updatedat: new Date().toISOString(),
            });
          });
        }
      });

      console.log(`Processed ${allSnippets.length} snippets across all platforms`);
      
      if (allSnippets.length === 0) {
        console.error('No snippets were extracted from the OpenAI response. Raw data:', JSON.stringify(snippetsData).substring(0, 500) + '...');
        return NextResponse.json(
          { error: 'Failed to extract snippets from the AI response - please try again' },
          { status: 500 }
        );
      }
      
      // Save snippets to Supabase
      console.log('Saving snippets to Supabase...');
      const { error: snippetsError } = await supabaseAdmin
        .from('snippets')
        .insert(allSnippets);
        
      if (snippetsError) {
        console.error('Error saving snippets to Supabase:', snippetsError);
        // Fall back to local storage
        console.log('Falling back to local storage for snippets...');
        await saveSnippets(allSnippets);
      } else {
        console.log('Snippets saved to Supabase successfully');
      }

      // Update the sermon with a flag indicating snippets have been generated
      const { error: updateError } = await supabaseAdmin
        .from('sermons')
        .update({
          has_snippets: true,
          updatedat: new Date().toISOString()
        })
        .eq('id', sermonId);
        
      if (updateError) {
        console.error('Error updating sermon in Supabase:', updateError);
        // Fall back to local storage
        await saveSermon({
          ...sermon,
          has_snippets: true,
          updated_at: new Date().toISOString()
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Snippets generated successfully',
        count: allSnippets.length,
        platforms: Object.keys(snippetsData),
      });
    } catch (openaiError) {
      console.error('Error with OpenAI snippet generation:', openaiError);
      return NextResponse.json(
        { error: 'Failed to generate snippets from OpenAI: ' + (openaiError instanceof Error ? openaiError.message : String(openaiError)) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error generating snippets:', error);
    return NextResponse.json(
      { error: 'Failed to generate snippets: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
} 