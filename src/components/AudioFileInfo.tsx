'use client';

import { useState, useEffect, useRef } from 'react';

type AudioFileInfoProps = {
  audioUrl: string | null;
  onFixAudio?: () => void;
  sermonId?: string;
};

export default function AudioFileInfo({ audioUrl, onFixAudio, sermonId }: AudioFileInfoProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const maxRetries = 5; // Increase max retries
  const loadTimeout = 60000; // Extend timeout to 60 seconds
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      setError('Audio file not available');
      return;
    }

    setLoading(true);
    setError(null);
    setAudioLoaded(false);

    // Set up timeout
    timeoutRef.current = setTimeout(() => {
      if (!audioLoaded && retryCount < maxRetries) {
        console.log(`Audio loading timed out, retrying (${retryCount + 1}/${maxRetries})...`);
        setRetryCount(prev => prev + 1);
        setError(`Audio loading timed out, retrying (${retryCount + 1}/${maxRetries})...`);
        
        // Force reload the audio element
        if (audioRef.current) {
          audioRef.current.load();
        }
      } else if (!audioLoaded) {
        setError('Audio loading timed out after multiple attempts. The file may be too large or inaccessible.');
        setLoading(false);
      }
    }, loadTimeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [audioUrl, retryCount, audioLoaded, progress]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
      setAudioLoaded(true);
      setLoading(false);
      setError(null);
      setProgress(100);
      
      // Clear the timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  const handleError = (e: any) => {
    console.error('Audio loading error:', e);
    
    if (retryCount < maxRetries) {
      console.log(`Error loading audio, retrying (${retryCount + 1}/${maxRetries})...`);
      setRetryCount(prev => prev + 1);
    } else {
      setError('Error loading audio file. The file may be corrupted or inaccessible.');
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Function to try direct audio file download
  const handleManualLoad = async () => {
    if (!audioUrl) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch the file directly
      const response = await fetch(audioUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // If we got here, the file is accessible
      if (audioRef.current) {
        audioRef.current.load(); // Try loading again
      }
      
      setError(null);
    } catch (err) {
      console.error('Manual file check error:', err);
      setError(`Error accessing file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold mb-3">Audio</h2>
      
      {!audioUrl ? (
        <div>
          <div className="p-4 bg-red-50 text-red-500 rounded-md mb-4">
            Audio file not available
          </div>
          {onFixAudio && (
            <button
              onClick={onFixAudio}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Fix Audio
            </button>
          )}
        </div>
      ) : error ? (
        <div>
          <div className="p-4 bg-red-50 text-red-500 rounded-md mb-4">
            {error}
          </div>
          <p className="text-sm text-gray-500 mb-2">
            There was an error loading the audio file. This could be due to:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-500 mb-4">
            <li>The file is too large and needs compression</li>
            <li>The file format is not supported by your browser</li>
            <li>The file is corrupted or missing</li>
          </ul>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setRetryCount(0);
                setError(null);
                if (audioRef.current) {
                  audioRef.current.load();
                }
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Retry
            </button>
            <button
              onClick={handleManualLoad}
              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
            >
              Check File
            </button>
            {onFixAudio && (
              <button
                onClick={onFixAudio}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Fix Audio
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {loading && !audioLoaded && (
            <div className="p-4 bg-blue-50 text-blue-500 rounded-md mb-4">
              <div className="flex justify-between items-center mb-2">
                <span>Loading audio file{retryCount > 0 ? ` (attempt ${retryCount + 1}/${maxRetries})` : ''}...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2.5">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <div className={`rounded-md border p-4 ${audioLoaded ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
            <audio 
              ref={audioRef}
              controls={audioLoaded}
              className={`w-full mt-2 ${audioLoaded ? '' : 'hidden'}`}
              onLoadedMetadata={handleLoadedMetadata}
              onError={handleError}
              preload="auto"
              controlsList="nodownload"
            >
              <source src={audioUrl} type="audio/mpeg" />
              <source src={audioUrl} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
            
            {audioLoaded && (
              <div className="mt-2 text-sm text-gray-600">
                <p>Duration: {audioDuration ? formatTime(audioDuration) : 'Unknown'}</p>
                <p className="text-green-600 font-medium">Audio loaded successfully!</p>
              </div>
            )}
            
            {!audioLoaded && (
              <div className="flex justify-center items-center h-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 