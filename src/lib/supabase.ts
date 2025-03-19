import { createClient } from '@supabase/supabase-js';

// Get environment variables with validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Validate URLs
function validateAndFormatUrl(url: string): string {
  // Check if URL is empty
  if (!url) {
    throw new Error('Supabase URL is required');
  }

  // Ensure URL starts with https:// (or http:// for local development)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    // Test if URL is valid
    new URL(url);
    return url;
  } catch (error) {
    throw new Error(`Invalid Supabase URL: ${url}`);
  }
}

// Format and validate the URL
const validatedUrl = validateAndFormatUrl(supabaseUrl);

// Create a Supabase client with the anonymous key for client-side operations
export const supabaseClient = createClient(validatedUrl, supabaseAnonKey);

// Create a Supabase admin client with the service role key for server-side operations
export const supabaseAdmin = createClient(validatedUrl, supabaseServiceRoleKey);

export default supabaseClient; 