import { NextResponse } from 'next/server';
import { getSermons } from '@/lib/local-storage';
import { generatePodcastRSS } from '@/lib/podcast-rss';

export async function GET() {
  try {
    const sermons = await getSermons();
    const rssFeed = await generatePodcastRSS(sermons);
    
    return new NextResponse(rssFeed, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'max-age=300, s-maxage=300' // 5 minute cache
      }
    });
  } catch (error) {
    console.error('Error generating podcast feed:', error);
    return NextResponse.json(
      { error: 'Failed to generate podcast feed' },
      { status: 500 }
    );
  }
} 