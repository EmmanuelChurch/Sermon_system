'use client';

/**
 * Client-side wrapper for audio processor functions
 * Uses API endpoints instead of direct server imports
 */

/**
 * Process audio by adding intro/outro and normalizing volume
 */
export async function processSermonAudio(
  inputAudioPath: string, 
  sermonId: string
): Promise<string> {
  const response = await fetch('/api/audio-processor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'processAudio',
      inputAudioPath,
      sermonId,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process sermon audio');
  }
  
  const data = await response.json();
  return data.outputPath;
}

/**
 * Get the podcast-ready file URL for a sermon
 */
export async function getPodcastFileUrl(sermonId: string): Promise<string | null> {
  const response = await fetch('/api/audio-processor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'getPodcastUrl',
      sermonId,
    }),
  });
  
  if (!response.ok) {
    return null;
  }
  
  const data = await response.json();
  return data.url;
}

/**
 * Check if a podcast version of a sermon exists
 */
export async function podcastVersionExists(sermonId: string): Promise<boolean> {
  const response = await fetch('/api/audio-processor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'podcastExists',
      sermonId,
    }),
  });
  
  if (!response.ok) {
    return false;
  }
  
  const data = await response.json();
  return data.exists;
}

/**
 * Get the local file path for a podcast file
 */
export async function getPodcastFilePath(filename: string): Promise<string | null> {
  const response = await fetch('/api/audio-processor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'getPodcastPath',
      sermonId: filename, // Using sermonId parameter for filename
    }),
  });
  
  if (!response.ok) {
    return null;
  }
  
  const data = await response.json();
  return data.path;
} 