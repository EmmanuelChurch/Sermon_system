import fs from 'fs';
import path from 'path';
import { getStoragePaths } from './storage-config';
import { getPodcastFileUrl, podcastVersionExists } from './audio-processor';

// Helper function to escape XML special characters
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Get file size in bytes
function getFileSizeInBytes(filePath: string): number {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    return 0;
  }
}

// Get audio duration in seconds
function getDurationInSeconds(sermonId: string): number {
  try {
    // This would ideally use a proper audio metadata library
    // For now, return a placeholder duration
    return 1800; // 30 minutes default
  } catch (error) {
    console.error(`Error getting duration for sermon ${sermonId}:`, error);
    return 1800; // Default to 30 minutes
  }
}

// Format as HH:MM:SS
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Generate the podcast RSS feed
export function generatePodcastRSS(sermons: any[]) {
  const PATHS = getStoragePaths();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';
  const podcastImageUrl = `${baseUrl}/podcast-cover.jpg`;
  
  // Filter sermons with podcast versions
  const podcastSermons = sermons.filter(sermon => 
    sermon.podcastUrl || (sermon.id && podcastVersionExists(sermon.id))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
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
    
    ${podcastSermons.map(sermon => {
      const podcastUrl = sermon.podcastUrl || getPodcastFileUrl(sermon.id);
      const podcastFilePath = path.join(PATHS.podcastDir, `${sermon.id}_podcast.mp3`);
      const fileSize = getFileSizeInBytes(podcastFilePath);
      const durationSeconds = getDurationInSeconds(sermon.id);
      
      // Skip if podcast URL doesn't exist
      if (!podcastUrl) return '';
      
      return `
    <item>
      <title>${escapeXml(sermon.title)}</title>
      <itunes:author>${escapeXml(sermon.speaker)}</itunes:author>
      <pubDate>${new Date(sermon.date).toUTCString()}</pubDate>
      <enclosure 
        url="${baseUrl}${podcastUrl}" 
        type="audio/mpeg" 
        length="${fileSize}"
      />
      <guid isPermaLink="false">${sermon.id}</guid>
      <itunes:duration>${formatDuration(durationSeconds)}</itunes:duration>
      <description>${escapeXml(sermon.description || sermon.title)}</description>
    </item>`;
    }).join('')}
  </channel>
</rss>`;

  return rss;
} 