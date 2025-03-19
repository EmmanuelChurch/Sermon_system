import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSermonById, saveSermon, saveSnippets } from '@/lib/local-storage';
import { generateSnippets } from '@/lib/openai';
import { Snippet } from '@/types';

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

    // Get the sermon record from local storage
    const sermon = await getSermonById(sermonId);

    if (!sermon) {
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
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
      const allSnippets: Snippet[] = [];
      
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
                  sermon_id: sermonId,
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
              sermon_id: sermonId,
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
      
      // Save the snippets to local storage
      await saveSnippets(allSnippets);

      // Update the sermon with a flag indicating snippets have been generated
      await saveSermon({
        ...sermon,
        has_snippets: true,
        updated_at: new Date().toISOString()
      });

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