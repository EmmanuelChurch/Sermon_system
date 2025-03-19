import { NextResponse } from 'next/server';

export async function GET() {
  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  // Analyze key 
  const keyInfo = {
    type: typeof anonKey,
    length: anonKey.length,
    isEmpty: !anonKey || anonKey.trim() === '',
    hasControlChars: /[\x00-\x1F\x7F]/.test(anonKey),
    firstFewChars: anonKey.substring(0, 3) + '...'
  };
  
  // Clean the key
  const cleanedKey = anonKey.replace(/[\x00-\x1F\x7F]/g, '')
                          .replace(/\^C/g, '')
                          .replace(/\r?\n|\r/g, '')
                          .trim();
  
  // Get key length difference
  const cleanedKeyInfo = {
    length: cleanedKey.length,
    difference: anonKey.length - cleanedKey.length
  };
  
  // Return the debug information
  return NextResponse.json({
    urlInfo: {
      type: typeof supabaseUrl,
      length: supabaseUrl.length,
      value: supabaseUrl.substring(0, 8) + '...'
    },
    keyInfo,
    cleanedKeyInfo,
    env: process.env.NODE_ENV
  });
} 