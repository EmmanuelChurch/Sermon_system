import { Resend } from 'resend';
import { Snippet } from '@/types';

/**
 * Format a timestamp in seconds to a readable format (MM:SS)
 */
function formatTimestamp(seconds: number | undefined): string {
  if (seconds === undefined) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Send an email notification with snippets for approval
 * @param recipientEmail The email address to send the notification to
 * @param sermonTitle The title of the sermon
 * @param snippets The array of snippets to include in the email
 * @param approvalLink The link to the approval dashboard
 * @returns The result of the email sending operation
 */
export const sendSnippetApprovalEmail = async (
  recipientEmail: string,
  sermonTitle: string,
  snippets: Snippet[],
  approvalLink: string
) => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.warn('Skipping email send: Missing Resend API key');
      return null;
    }
    
    const resend = new Resend(resendApiKey);
    
    // Format the snippets for the email
    const snippetsHtml = snippets
      .map(
        (snippet, index) => `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e1e1e1; border-radius: 5px;">
          <p style="font-size: 16px; line-height: 1.5;">"${snippet.content}"</p>
          <p style="color: #666; font-size: 14px;">Timestamp: ${formatTimestamp(snippet.timestamp)}</p>
        </div>
      `
      )
      .join('');

    const { data, error } = await resend.emails.send({
      from: 'Sermon System <notifications@your-church-domain.com>',
      to: recipientEmail,
      subject: `[Action Required] Approve Snippets for "${sermonTitle}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; font-size: 24px;">New Snippets Ready for Approval</h1>
          <p style="font-size: 16px; line-height: 1.5;">
            We've generated some social media snippets from the sermon "${sermonTitle}" that need your approval.
          </p>
          
          <h2 style="color: #333; font-size: 20px; margin-top: 30px;">Snippets:</h2>
          ${snippetsHtml}
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${approvalLink}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Review and Approve Snippets
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            This is an automated message from your church's sermon management system.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw so the process can continue even if email fails
    return null;
  }
}; 