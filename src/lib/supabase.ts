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
    
    // Special handling for the ^C control character case
    if (url.includes('^C')) {
      console.warn('Control character ^C detected in URL, removing it');
      const cleanUrl = url.replace(/\^C/g, '');
      try {
        new URL(cleanUrl);
        return cleanUrl;
      } catch (e) {
        console.warn('URL still invalid after removing ^C');
      }
    }
    
    // Try to extract project reference from environment variable
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRefMatch = envUrl.match(/([a-z0-9-]+)\.supabase\.co/);
    const projectRef = projectRefMatch ? projectRefMatch[1] : null;
    
    if (projectRef) {
      // Use the project reference to form a valid URL
      const fallbackUrl = `https://${projectRef}.supabase.co`;
      console.warn(`Using fallback URL based on project reference: ${fallbackUrl}`);
      return fallbackUrl;
    }
    
    // Last resort fallback for Vercel builds - use a dummy URL that won't crash the build
    // This won't work for API calls but will allow the build to complete
    if (process.env.VERCEL === '1') {
      console.warn('Using emergency fallback URL for Vercel build');
      return 'https://example.supabase.co';
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