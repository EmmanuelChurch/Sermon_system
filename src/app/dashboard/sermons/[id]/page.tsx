'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sermon, Recording } from '@/types';
import TranscribeButton from '@/components/TranscribeButton';
import AudioFileInfo from '@/components/AudioFileInfo';

export default function SermonDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const sermonId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [showRecordingSelector, setShowRecordingSelector] = useState(false);
  const [fixingAudio, setFixingAudio] = useState(false);
  const [directAudioUrl, setDirectAudioUrl] = useState('');
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploadStatus, setFileUploadStatus] = useState<string | null>(null);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Load the sermon details
  useEffect(() => {
    const fetchSermonDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/sermons/${sermonId}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
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
        console.log('Sermon data loaded:', data);
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
    if (sermon) {
      setSermon({
        ...sermon,
        transcriptionstatus: 'processing'
      });
    }
  };

  // Function to retry transcription if it seems stuck in pending state
  const handleRetryTranscription = async () => {
    if (!sermon?.audiourl) return;
    
    try {
      const response = await fetch(`/api/sermons/${sermonId}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: sermon.audiourl,
          force: true, // Force restart the transcription
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to retry transcription');
      }
      
      handleTranscriptionStarted();
      alert('Transcription process restarted. Please check the transcription status page for updates.');
      
    } catch (err) {
      console.error('Error retrying transcription:', err);
      alert(err instanceof Error ? err.message : 'Failed to retry transcription');
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  // Handle audio loading and errors
  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setAudioLoaded(true);
      setAudioError(null);
      setAudioDuration(audioRef.current.duration);
    }
  };
  
  const handleAudioError = () => {
    setAudioLoaded(false);
    setAudioError('Could not load audio file. The file may be missing or in an unsupported format.');
  };

  // Monitor audio playback progress
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  // Handle play/pause
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

  // Handle when audio play state changes
  const handlePlayStateChange = () => {
    setIsPlaying(!audioRef.current?.paused);
  };

  // Format time for audio duration
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileUploadStatus('Selected file: ' + file.name);
      setFileUploadProgress(0);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setFileUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      // Update upload progress
      setFileUploadProgress(30);
      setFileUploadStatus('Uploading file...');
      
      // Use our new API endpoint to upload the file
      const response = await fetch(`/api/sermons/${sermonId}/audio`, {
        method: 'POST',
        body: formData,
      });
      
      setFileUploadProgress(70);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }
      
      const data = await response.json();
      
      // Update the sermon state with the new audio URL
      setSermon({
        ...sermon!,
        audiourl: data.url,
        transcriptionstatus: 'pending'
      });
      
      setFileUploadStatus('File uploaded successfully');
      setFileUploadProgress(100);
      
      // Reload the page after a short delay to show the updated UI
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Error uploading file:', err);
      setFileUploadStatus('Failed to upload file: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setFileUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    // Load initial data
    const loadInitialData = async () => {
      await fetchRecordings();
    };
    
    loadInitialData();
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
      <div className="flex justify-between items-center mb-6">
        <Link href="/dashboard" className="text-blue-500 hover:underline">
          ← Back to Dashboard
        </Link>
        <Link 
          href="/dashboard/transcription-status" 
          className="text-green-500 hover:text-green-600 hover:underline"
        >
          View All Transcription Status
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold mb-2">{sermon.title}</h1>
      <p className="text-gray-600 mb-8">by {sermon.speaker} on {formatDate(sermon.date)}</p>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Audio</h2>
            
            {!sermon.audiourl ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-700 font-medium">No audio file available</p>
                <p className="text-red-600 text-sm mt-2 mb-4">
                  You need to upload an audio file for this sermon first.
                </p>
                
                <div className="mt-4 space-y-4">
                  <div className="border border-gray-200 rounded-md p-4 bg-white">
                    <h3 className="font-medium mb-2">Upload Audio File</h3>
                    <div className="mb-3">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100"
                      />
                      {fileUploadStatus && (
                        <p className="mt-2 text-sm text-gray-600">{fileUploadStatus}</p>
                      )}
                      {fileUploadProgress > 0 && fileUploadProgress < 100 && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${fileUploadProgress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={handleFileUpload}
                        disabled={!selectedFile || isUploading}
                        className={`px-4 py-2 rounded-md ${
                          !selectedFile || isUploading
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {isUploading ? 'Uploading...' : 'Upload Audio'}
                      </button>
                      
                      <button
                        onClick={() => setShowRecordingSelector(true)}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Choose from Recordings
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    <p>Supported formats: MP3, WAV, M4A, AAC (Max 500MB)</p>
                    <p>For large files, compression will be applied automatically.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-md p-4">
                <div className="mb-4">
                  <audio 
                    ref={audioRef}
                    className={audioLoaded ? "" : "hidden"}
                    onLoadedMetadata={handleAudioLoaded}
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleAudioError}
                    onPlay={handlePlayStateChange}
                    onPause={handlePlayStateChange}
                    preload="metadata"
                    src={sermon.audiourl}
                  >
                    Your browser does not support the audio element.
                  </audio>
                  
                  {!audioLoaded && !audioError && (
                    <div className="flex justify-center items-center py-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                      <span className="ml-3 text-gray-600">Loading audio...</span>
                    </div>
                  )}
                  
                  {audioError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                      <p className="text-red-700">{audioError}</p>
                    </div>
                  )}
                  
                  {audioLoaded && (
                    <div>
                      <div className="flex items-center mb-2">
                        <button 
                          onClick={togglePlayPause}
                          className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white hover:bg-blue-600 focus:outline-none"
                        >
                          {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <div className="w-full ml-3">
                          <div className="bg-gray-200 rounded-full h-2.5 w-full">
                            <div 
                              className="bg-blue-500 h-2.5 rounded-full"
                              style={{ width: `${audioProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>
                          {audioRef.current ? formatTime(audioRef.current.currentTime) : '0:00'}
                        </span>
                        <span>
                          {audioDuration ? formatTime(audioDuration) : '0:00'}
                        </span>
                      </div>
                      <div className="flex justify-end mt-2">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => { if (audioRef.current) audioRef.current.playbackRate = Math.max(0.5, audioRef.current.playbackRate - 0.25) }}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                          >
                            Slower
                          </button>
                          <button
                            onClick={() => { if (audioRef.current) audioRef.current.playbackRate = 1 }}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                          >
                            1x
                          </button>
                          <button
                            onClick={() => { if (audioRef.current) audioRef.current.playbackRate = Math.min(2, audioRef.current.playbackRate + 0.25) }}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                          >
                            Faster
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <p className="mt-2 text-xs text-gray-500 break-all">
                  Audio URL: {sermon.audiourl}
                </p>
              </div>
            )}
          </div>

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
            ) : sermon.transcriptionstatus === 'pending' ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-yellow-700 font-medium">Transcription pending</p>
                <p className="text-yellow-600 text-sm mt-1">
                  This transcription is queued but hasn't started processing yet.
                </p>
                <p className="text-yellow-600 text-sm mt-1">
                  If it has been pending for a long time, you can try restarting the process.
                </p>
                
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={handleRetryTranscription}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                  >
                    Restart Transcription
                  </button>
                  <Link
                    href="/dashboard/transcription-status"
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Check Status Page
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">This sermon has not been transcribed yet.</p>
                <div className="flex flex-col space-y-4">
                  <TranscribeButton 
                    sermonId={sermonId} 
                    audioUrl={sermon.audiourl}
                    onTranscriptionStarted={handleTranscriptionStarted}
                  />
                  
                  <div className="mt-2 border-t pt-4 border-gray-200">
                    <p className="text-sm text-gray-500 mb-2">
                      After the transcription process starts, you can monitor its progress on the transcription status page.
                    </p>
                    <Link
                      href="/dashboard/transcription-status"
                      className="text-sm text-blue-500 hover:underline"
                    >
                      View all transcription jobs →
                    </Link>
                  </div>
                </div>
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
              <div className="mb-4">
                <p className="text-gray-500 text-sm">Created At</p>
                <p className="font-medium">{formatDate(sermon.createdat)}</p>
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
    </div>
  );
} 