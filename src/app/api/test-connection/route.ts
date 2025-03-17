import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Test the connection by trying to access the public schema
    const { data, error } = await supabaseAdmin.from('sermons').select('count()', { count: 'exact' });
    
    if (error) {
      throw new Error(`Failed to connect to Supabase: ${error.message}`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Supabase',
      data: {
        count: data[0]?.count || 0,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        tablesChecked: ['sermons']
      }
    });
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Supabase',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL 
      },
      { status: 500 }
    );
  }
} 