'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sermon, Recording } from '@/types';
import TranscribeButton from '@/components/TranscribeButton';
import AudioFileInfo from '@/components/AudioFileInfo';

// Function to check podcast existence and get URL through server action
async function checkPodcastExists(sermonId: string): Promise<boolean> {
  const response = await fetch(`/api/sermons/${sermonId}/podcast-exists`);
  if (!response.ok) return false;
  const data = await response.json();
  return data.exists;
}

async function getPodcastUrl(sermonId: string): Promise<string | null> {
  const response = await fetch(`/api/sermons/${sermonId}/podcast-url`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.url;
}

export default function SermonDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const sermonId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [showRecordingSelector, setShowRecordingSelector] = useState(false);
  const [fixingAudio, setFixingAudio] = useState(false);
  const [directAudioUrl, setDirectAudioUrl] = useState('');

  // State for podcast info
  const [hasPodcastVersion, setHasPodcastVersion] = useState(false);
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null);

  // Load the sermon details
  useEffect(() => {
    const fetchSermonDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/sermons/${sermonId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Sermon not found');
          } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch sermon details');
          }
          return;
        }
        
        const data = await response.json();
        setSermon(data);
      } catch (err) {
        console.error('Error fetching sermon details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch sermon details');
      } finally {
        setIsLoading(false);
      }
    };

    if (sermonId) {
      fetchSermonDetails();
    }
  }, [sermonId]);

  // Function to fetch available recordings
  const fetchRecordings = async () => {
    try {
      const response = await fetch('/api/recordings');
      if (!response.ok) {
        throw new Error('Failed to fetch recordings');
      }
      const data = await response.json();
      setRecordings(data.recordings || []);
    } catch (err) {
      console.error('Error fetching recordings:', err);
    }
  };

  // Show the recording selector dialog
  const showFixAudioDialog = async () => {
    await fetchRecordings();
    setSelectedRecording(null);
    setShowRecordingSelector(true);
  };

  // Handle audio fix by associating an existing recording with this sermon
  const handleFixAudio = async () => {
    if (!selectedRecording) return;
    
    try {
      setFixingAudio(true);
      
      const response = await fetch(`/api/sermons/${sermonId}/audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordingFile: selectedRecording,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update audio');
      }
      
      // Refresh the page to show the updated audio
      window.location.reload();
    } catch (err) {
      console.error('Error updating audio:', err);
      alert(err instanceof Error ? err.message : 'Failed to update audio');
    } finally {
      setFixingAudio(false);
      setShowRecordingSelector(false);
    }
  };

  // Handle when a transcription is started successfully
  const handleTranscriptionStarted = () => {
    // Refresh sermon data or update local state
    if (sermon) {
      setSermon({
        ...sermon,
        transcriptionstatus: 'processing'
      });
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Add a function to handle direct URL update
  const handleDirectUrlUpdate = async () => {
    if (!directAudioUrl) return;
    
    try {
      setFixingAudio(true);
      
      const response = await fetch(`/api/sermons/${sermonId}/audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          externalUrl: directAudioUrl,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update audio URL');
      }
      
      // Refresh the page to show the updated audio
      window.location.reload();
    } catch (err) {
      console.error('Error updating audio URL:', err);
      alert(err instanceof Error ? err.message : 'Failed to update audio URL');
    } finally {
      setFixingAudio(false);
      setShowRecordingSelector(false);
    }
  };

  useEffect(() => {
    fetchSermonDetails();
    fetchRecordings();
    
    // Check podcast status
    const checkPodcast = async () => {
      try {
        const exists = await checkPodcastExists(sermonId);
        setHasPodcastVersion(exists);
        
        if (exists) {
          const url = await getPodcastUrl(sermonId);
          setPodcastUrl(url);
        }
      } catch (error) {
        console.error("Error checking podcast status:", error);
      }
    };
    
    checkPodcast();
  }, [sermonId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Link href="/dashboard" className="text-blue-500 hover:underline mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Link href="/dashboard" className="text-blue-500 hover:underline mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!sermon) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Link href="/dashboard" className="text-blue-500 hover:underline mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p>Sermon not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <Link href="/dashboard" className="text-blue-500 hover:underline mb-6 inline-block">
        ← Back to Dashboard
      </Link>
      
      <h1 className="text-3xl font-bold mb-2">{sermon.title}</h1>
      <p className="text-gray-600 mb-8">by {sermon.speaker} on {formatDate(sermon.date)}</p>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <AudioFileInfo 
            audioUrl={sermon.audiourl}
            onFixAudio={showFixAudioDialog}
            sermonId={sermonId}
          />

          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Transcription</h2>
            {sermon.transcriptionstatus === 'completed' ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                  <p className="text-green-700 font-medium">Transcription complete</p>
                </div>
                <div className="prose max-w-none border border-gray-200 rounded-md p-4 bg-white">
                  {sermon.transcription ? (
                    <div className="h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      <p className="whitespace-pre-line">{sermon.transcription}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No transcription content available</p>
                  )}
                </div>
              </>
            ) : sermon.transcriptionstatus === 'processing' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-blue-700 font-medium">Transcription in progress...</p>
                <p className="text-blue-600 text-sm mt-1">Please refresh the page in a few minutes to check for updates.</p>
                <p className="text-blue-600 text-sm mt-1">You can also check the <Link href="/dashboard/transcription-status" className="underline">Transcription Status</Link> page for updates.</p>
              </div>
            ) : sermon.transcriptionstatus === 'failed' ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-700 font-medium">Transcription failed</p>
                <p className="text-red-600 text-sm mt-1">Please try again or check the server logs for more information.</p>
                {sermon.transcription_error && (
                  <p className="text-red-600 text-sm mt-2">Error: {sermon.transcription_error}</p>
                )}
                {sermon.audiourl && (
                  <div className="mt-4">
                    <TranscribeButton 
                      sermonId={sermonId} 
                      audioUrl={sermon.audiourl}
                      onTranscriptionStarted={handleTranscriptionStarted}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                {sermon.audiourl ? (
                  <div>
                    <p className="text-gray-600 mb-4">This sermon has not been transcribed yet.</p>
                    <TranscribeButton 
                      sermonId={sermonId} 
                      audioUrl={sermon.audiourl}
                      onTranscriptionStarted={handleTranscriptionStarted}
                    />
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-yellow-700">No audio file available. Please add an audio file before transcribing.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Sermon Information</h2>
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="mb-4">
                <p className="text-gray-500 text-sm">Title</p>
                <p className="font-medium">{sermon.title}</p>
              </div>
              <div className="mb-4">
                <p className="text-gray-500 text-sm">Speaker</p>
                <p className="font-medium">{sermon.speaker}</p>
              </div>
              <div className="mb-4">
                <p className="text-gray-500 text-sm">Date</p>
                <p className="font-medium">{formatDate(sermon.date)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">ID</p>
                <p className="font-mono text-sm text-gray-600">{sermon.id}</p>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Snippets</h2>
            <div className="bg-white border border-gray-200 rounded-md p-4">
              {sermon.transcriptionstatus === 'completed' ? (
                <div className="space-y-3">
                  <Link 
                    href={`/dashboard/sermons/${sermonId}/snippets`}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 inline-block"
                  >
                    View & Manage Snippets
                  </Link>
                  <p className="text-sm text-gray-500 mt-2">
                    View, manage, and generate AI-powered snippets for social media.
                  </p>
                </div>
              ) : (
                <p className="text-gray-500">Snippets will be available after transcription is complete.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Recording selector modal */}
      {showRecordingSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4">Select a Recording</h2>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">Select from existing recordings:</p>
              {recordings.length > 0 ? (
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded">
                  {recordings.map((recording) => (
                    <div 
                      key={recording.id}
                      className={`p-2 cursor-pointer ${selectedRecording === recording.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                      onClick={() => setSelectedRecording(recording.id)}
                    >
                      <p className="font-medium">{recording.filename}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(recording.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No recordings available</p>
              )}
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">Or enter a direct URL:</p>
              <input
                type="url"
                value={directAudioUrl}
                onChange={(e) => setDirectAudioUrl(e.target.value)}
                placeholder="https://example.com/audio.mp3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRecordingSelector(false)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              {selectedRecording ? (
                <button
                  onClick={handleFixAudio}
                  disabled={fixingAudio}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
                >
                  {fixingAudio ? 'Updating...' : 'Use Selected Recording'}
                </button>
              ) : directAudioUrl ? (
                <button
                  onClick={handleDirectUrlUpdate}
                  disabled={fixingAudio}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
                >
                  {fixingAudio ? 'Updating...' : 'Use URL'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      
      {/* Add this after the Audio section */}
      {hasPodcastVersion && (
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Podcast Version
          </h2>
          
          <p className="mb-4 text-gray-700">
            This sermon has been processed with intro/outro and volume normalization for podcast use.
          </p>
          
          {podcastUrl && (
            <div className="mb-4">
              <audio 
                className="w-full" 
                controls 
                src={podcastUrl}
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
          
          <div className="flex space-x-4">
            {podcastUrl && (
              <a 
                href={podcastUrl} 
                download={`${sermon.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_podcast.mp3`}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download Podcast Version
              </a>
            )}
            
            {!hasPodcastVersion && sermon.audiourl && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/sermons/${sermonId}/process-podcast`, {
                      method: 'POST',
                    });
                    
                    if (response.ok) {
                      // Reload the page after processing
                      window.location.reload();
                    } else {
                      const data = await response.json();
                      alert(`Error: ${data.error || 'Failed to process podcast'}`);
                    }
                  } catch (error) {
                    console.error('Error processing podcast:', error);
                    alert('An error occurred while processing the podcast');
                  }
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create Podcast Version
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 