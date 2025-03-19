import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSnippets } from '@/lib/openai';
import { sendSnippetApprovalEmail } from '@/lib/email';
import { Resend } from 'resend';

// Initialize Resend client with proper error handling
function getResendClient() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.warn('Missing Resend API key. Email functionality will be disabled.');
      // Return a mock client for build to succeed
      return {
        emails: {
          send: async () => {
            console.error('Attempted to send email but Resend API key is missing');
            return { error: 'No API key configured' };
          }
        }
      } as any;
    }
    
    return new Resend(resendApiKey);
  } catch (error) {
    console.error('Error initializing Resend client:', error);
    // Return a mock client to avoid breaking the build
    return {
      emails: {
        send: async () => {
          console.error('Failed to initialize Resend client');
          return { error: 'Client initialization failed' };
        }
      }
    } as any;
  }
}

const resend = getResendClient();

export async function POST(request: NextRequest) {
  try {
    const { sermonId } = await request.json();

    if (!sermonId) {
      return NextResponse.json(
        { error: 'Missing sermon ID' },
        { status: 400 }
      );
    }

    // Get the sermon record from Supabase
    const { data: sermon, error: fetchError } = await supabaseAdmin
      .from('sermons')
      .select('*')
      .eq('id', sermonId)
      .single();

    if (fetchError || !sermon) {
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

    // Generate snippets using OpenAI
    const snippetsData = await generateSnippets(sermon.transcription);

    // Insert the snippets into Supabase
    const snippets = snippetsData.map((snippet: { content: string; timestamp: number }) => ({
      id: uuidv4(),
      sermonId,
      content: snippet.content,
      timestamp: snippet.timestamp,
      approved: false,
      posted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseAdmin
      .from('snippets')
      .insert(snippets);

    if (insertError) {
      throw new Error(`Failed to insert snippets: ${insertError.message}`);
    }

    // Get the admin email from environment variables or configuration
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@your-church-domain.com';
    
    // Generate the approval link
    const approvalLink = `${request.nextUrl.origin}/dashboard/sermons/${sermonId}/snippets`;
    
    // Send an email notification for approval
    await sendSnippetApprovalEmail(
      adminEmail,
      sermon.title,
      snippets,
      approvalLink
    );

    return NextResponse.json({
      success: true,
      message: 'Snippets generated successfully',
      snippets,
    });
  } catch (error) {
    console.error('Error generating snippets:', error);
    return NextResponse.json(
      { error: 'Failed to generate snippets' },
      { status: 500 }
    );
  }
} 