import { createClient } from '@supabase/supabase-js';

// Get environment variables with validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Store a copy of the keys to prevent them from being lost
const STORED_ANON_KEY = supabaseAnonKey;
const STORED_SERVICE_KEY = supabaseServiceRoleKey;

// Use a hardcoded key for testing - you can replace this with your key for testing
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdnZmZmRjY2Zzdmxsd3V1ZXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyMDM3NjYsImV4cCI6MjA1Nzc3OTc2Nn0.U5SYsqHNCn40DsLENPFCLrQTlIWNeD7GKAHLPDuXDGk';

// Fallback URL for Supabase - hardcoded as a last resort
const FALLBACK_SUPABASE_URL = 'https://tdvvffdccfsvllwuueps.supabase.co';

// Validate URLs
function validateAndFormatUrl(url: string): string {
  console.log('Raw Supabase URL from env:', url);
  
  // Check if URL is empty
  if (!url || url.trim() === '') {
    console.warn('Supabase URL is empty, using fallback URL');
    return FALLBACK_SUPABASE_URL;
  }

  // Remove any control characters that might have been accidentally included
  const cleanUrl = url
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove all control characters
    .replace(/\^C/g, '')             // Explicitly remove ^C
    .replace(/\r?\n|\r/g, '')        // Remove newlines
    .trim();                         // Remove whitespace
  
  console.log('Cleaned URL:', cleanUrl);

  // Ensure URL starts with https:// (or http:// for local development)
  let formattedUrl = cleanUrl;
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }
  
  try {
    // Test if URL is valid
    new URL(formattedUrl);
    console.log('URL validated successfully:', formattedUrl);
    return formattedUrl;
  } catch (error) {
    console.error(`Invalid Supabase URL detected after cleaning: ${formattedUrl}`, error);
    
    // Extract project reference from the URL if possible
    const projectRefMatch = formattedUrl.match(/([a-z0-9-]+)\.supabase\.co/);
    if (projectRefMatch && projectRefMatch[1]) {
      const projectRef = projectRefMatch[1];
      const fallbackUrl = `https://${projectRef}.supabase.co`;
      console.warn(`Extracted project reference, using URL: ${fallbackUrl}`);
      return fallbackUrl;
    }
    
    // Hard-coded fallback
    console.warn(`Using hardcoded fallback URL: ${FALLBACK_SUPABASE_URL}`);
    return FALLBACK_SUPABASE_URL;
  }
}

// Safely create clients with proper error handling
function createSafeClient(url: string, key: string, isAdmin = false) {
  try {
    // Use stored keys if the provided key is empty
    let effectiveKey = key;
    if (!effectiveKey || effectiveKey.trim() === '') {
      effectiveKey = isAdmin ? STORED_SERVICE_KEY : STORED_ANON_KEY;
      console.log(`Using stored ${isAdmin ? 'service' : 'anon'} key instead of empty key`);
    }
    
    // If still empty, use fallback for anon key (only in production)
    if ((!effectiveKey || effectiveKey.trim() === '') && !isAdmin) {
      console.log('Using fallback anon key as last resort');
      effectiveKey = FALLBACK_SUPABASE_ANON_KEY;
    }

    // Add detailed debugging about the key
    console.log('Key input type:', typeof effectiveKey);
    console.log('Raw key is empty?', !effectiveKey);
    console.log('Key contains control chars?', /[\x00-\x1F\x7F]/.test(effectiveKey));
    
    // More detailed inspection
    const keyChars = Array.from(effectiveKey).map(char => ({ char, code: char.charCodeAt(0) }));
    const suspiciousChars = keyChars.filter(c => c.code < 32 || c.code === 127);
    if (suspiciousChars.length > 0) {
      console.log('Found suspicious characters:', suspiciousChars.map(c => c.code).join(','));
    }
    
    // Clean the key of any control characters or whitespace
    const cleanedKey = effectiveKey.replace(/[\x00-\x1F\x7F]/g, '')
                          .replace(/\^C/g, '')
                          .replace(/\r?\n|\r/g, '')
                          .trim();
    
    // Detailed comparison
    console.log('Original key length:', effectiveKey.length);
    console.log('Cleaned key length:', cleanedKey.length);
    console.log('Difference:', effectiveKey.length - cleanedKey.length);
    
    if (!cleanedKey || cleanedKey.trim() === '') {
      console.error('Supabase API key is empty or contains only control characters');
      
      // In development, provide more detailed debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('Raw key length:', effectiveKey.length);
        console.log('Key contains control chars:', /[\x00-\x1F\x7F]/.test(effectiveKey));
        console.log('First few chars (if any):', effectiveKey.substring(0, 5));
      }
      
      throw new Error('Supabase API key is required');
    }
    
    // Format and validate the URL
    const validatedUrl = validateAndFormatUrl(url);
    
    // Create the client with the validated URL and key
    console.log(`Creating Supabase client with URL: ${validatedUrl.substring(0, 30)}...`);
    
    // Log key length for debugging without exposing the key
    console.log(`API key length: ${cleanedKey.length} characters`);
    
    const client = createClient(validatedUrl, cleanedKey, {
      auth: {
        persistSession: false, // Don't persist session in browser
        autoRefreshToken: true,
        detectSessionInUrl: false,
      }
    });
    
    return client;
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    
    // Create a dummy client that will throw clear errors when used
    // This prevents the application from crashing immediately during build
    return {
      auth: {
        signIn: () => Promise.reject(new Error('Invalid Supabase configuration')),
        signOut: () => Promise.reject(new Error('Invalid Supabase configuration')),
      },
      from: () => ({ 
        select: () => Promise.reject(new Error('Invalid Supabase configuration')),
        insert: () => Promise.reject(new Error('Invalid Supabase configuration')),
        update: () => Promise.reject(new Error('Invalid Supabase configuration')),
        delete: () => Promise.reject(new Error('Invalid Supabase configuration')),
      }),
      storage: { 
        from: () => ({ 
          upload: () => Promise.reject(new Error('Invalid Supabase configuration')),
          getPublicUrl: () => ({ data: { publicUrl: '' }}),
          list: () => Promise.reject(new Error('Invalid Supabase configuration')),
        }) 
      },
      // Add other commonly used methods as needed
    } as any;
  }
}

// Create Supabase clients with proper error handling and logging
console.log('Initializing Supabase clients...');
export const supabaseClient = createSafeClient(supabaseUrl, supabaseAnonKey, false);
export const supabaseAdmin = createSafeClient(supabaseUrl, supabaseServiceRoleKey, true);
console.log('Supabase clients initialized');

export default supabaseClient; 