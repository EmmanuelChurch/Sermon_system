'use client';

/**
 * Client-side mock of audio processor functions
 * These are safe to import in client components and will call the server API
 */

/**
 * Process audio by adding intro/outro and normalizing volume
 */
export async function processSermonAudio(
  inputAudioPath: string, 
  sermonId: string
): Promise<string> {
  const response = await fetch('/api/sermons/' + sermonId + '/process-podcast', {
    method: 'POST'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process sermon audio');
  }
  
  const data = await response.json();
  return data.outputPath || '';
}

/**
 * Get the podcast-ready file URL for a sermon
 */
export async function getPodcastFileUrl(sermonId: string): Promise<string | null> {
  const response = await fetch(`/api/sermons/${sermonId}/podcast-url`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.url;
}

/**
 * Check if a podcast version of a sermon exists
 */
export async function podcastVersionExists(sermonId: string): Promise<boolean> {
  const response = await fetch(`/api/sermons/${sermonId}/podcast-exists`);
  if (!response.ok) return false;
  const data = await response.json();
  return data.exists || false;
}

/**
 * Get the local file path for a podcast file
 * Note: In client context, this returns the API URL instead
 */
export async function getPodcastFilePath(sermonId: string): Promise<string> {
  return `/api/podcast/${sermonId}_podcast.mp3`;
} 