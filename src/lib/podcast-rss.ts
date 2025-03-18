'use server';

import fs from 'fs';
import path from 'path';
import { getStoragePaths } from './storage-config';
import { podcastVersionExists, getPodcastFileUrl } from './audio-processor';

// Escape special XML characters
async function escapeXml(unsafe: string): Promise<string> {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Get file size in bytes
async function getFileSizeInBytes(filePath: string): Promise<number> {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return stats.size;
    }
    return 0;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

// Default duration is 30 minutes
async function getDurationInSeconds(sermonId: string): Promise<number> {
  // For now, return a default duration of 30 minutes
  return 30 * 60;
}

// Format duration as HH:MM:SS
async function formatDuration(seconds: number): Promise<string> {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Generate the podcast RSS feed
export async function generatePodcastRSS(sermons: any[]) {
  const PATHS = await getStoragePaths();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';
  const podcastImageUrl = `${baseUrl}/podcast-cover.jpg`;
  
  // Filter sermons with podcast versions
  const podcastSermons = sermons.filter(sermon => 
    sermon.podcastUrl || (sermon.id && await podcastVersionExists(sermon.id))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Build items first
  const items = await Promise.all(podcastSermons.map(async (sermon) => {
    const podcastUrl = sermon.podcastUrl || await getPodcastFileUrl(sermon.id);
    const podcastFilePath = path.join(PATHS.podcastDir, `${sermon.id}_podcast.mp3`);
    const fileSize = await getFileSizeInBytes(podcastFilePath);
    const durationSeconds = await getDurationInSeconds(sermon.id);
    
    // Skip if podcast URL doesn't exist
    if (!podcastUrl) return '';
    
    return `
    <item>
      <title>${await escapeXml(sermon.title)}</title>
      <itunes:author>${await escapeXml(sermon.speaker)}</itunes:author>
      <pubDate>${new Date(sermon.date).toUTCString()}</pubDate>
      <enclosure 
        url="${baseUrl}${podcastUrl}" 
        type="audio/mpeg" 
        length="${fileSize}"
      />
      <guid isPermaLink="false">${sermon.id}</guid>
      <itunes:duration>${await formatDuration(durationSeconds)}</itunes:duration>
      <description>${await escapeXml(sermon.description || sermon.title)}</description>
    </item>`;
  }));
  
  // Basic podcast info
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Emmanuel Church London Sermons</title>
    <link>${baseUrl}</link>
    <language>en-us</language>
    <itunes:author>Emmanuel Church London</itunes:author>
    <description>Weekly sermons from Emmanuel Church London</description>
    <itunes:image href="${podcastImageUrl}"/>
    <itunes:category text="Religion &amp; Spirituality">
      <itunes:category text="Christianity"/>
    </itunes:category>
    <itunes:explicit>no</itunes:explicit>
    <copyright>©${new Date().getFullYear()} Emmanuel Church London</copyright>
    
    ${items.join('')}
  </channel>
</rss>`;

  return rss;
} 