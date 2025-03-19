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

  // Remove any control characters that might have been accidentally included
  url = url.replace(/[\x00-\x1F\x7F]/g, '');

  // Ensure URL starts with https:// (or http:// for local development)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    // Test if URL is valid
    new URL(url);
    return url;
  } catch (error) {
    console.error(`Invalid Supabase URL detected: ${url}`);
    // Fall back to a default structure if we can extract a domain
    const domainMatch = url.match(/^https?:\/\/([a-zA-Z0-9.-]+)/);
    if (domainMatch && domainMatch[1]) {
      const fallbackUrl = `https://${domainMatch[1]}`;
      console.warn(`Attempting to use fallback URL: ${fallbackUrl}`);
      return fallbackUrl;
    }
    throw new Error(`Cannot create valid Supabase URL from: ${url}`);
  }
}

// Safely create clients with proper error handling
function createSafeClient(url: string, key: string) {
  try {
    // Format and validate the URL
    const validatedUrl = validateAndFormatUrl(url);
    return createClient(validatedUrl, key);
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    // Create a dummy client that will throw clear errors when used
    // This prevents the application from crashing immediately during build
    return {
      auth: {},
      from: () => ({ select: () => Promise.reject(new Error('Invalid Supabase configuration')) }),
      storage: { from: () => ({ upload: () => Promise.reject(new Error('Invalid Supabase configuration')) }) },
      // Add other commonly used methods as needed
    } as any;
  }
}

// Create Supabase clients with proper error handling
export const supabaseClient = createSafeClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createSafeClient(supabaseUrl, supabaseServiceRoleKey);

export default supabaseClient; 