"use client";

import { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UploadPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUrlInput, setIsUrlInput] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Advanced options
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [addIntroOutro, setAddIntroOutro] = useState(true);
  const [createPodcastVersion, setCreatePodcastVersion] = useState(true);
  const [uploadToPodcast, setUploadToPodcast] = useState(false);
  const [podcastPlatform, setPodcastPlatform] = useState('none');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!title || !speaker || !date) {
      setError('Please fill in all fields');
      return;
    }
    
    if (!isUrlInput && !file) {
      setError('Please select an audio file');
      return;
    }
    
    if (isUrlInput && !audioUrl) {
      setError('Please enter a valid audio URL');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('title', title);
      formData.append('speaker', speaker);
      formData.append('date', date);
      
      // Add advanced options
      formData.append('addIntroOutro', addIntroOutro.toString());
      formData.append('createPodcastVersion', createPodcastVersion.toString());
      formData.append('uploadToPodcast', uploadToPodcast.toString());
      formData.append('podcastPlatform', podcastPlatform);
      
      if (isUrlInput) {
        formData.append('audioUrl', audioUrl);
      } else if (file) {
        formData.append('audioFile', file);
      }
      
      // Submit the form
      const response = await fetch('/api/sermons', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload sermon');
      }
      
      const data = await response.json();
      
      // Redirect to the sermon detail page
      router.push(`/dashboard/sermons/${data.id}`);
    } catch (err) {
      console.error('Error uploading sermon:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload sermon');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      {/* Back navigation */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-blue-500 hover:underline flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold mb-6 text-center">Upload Sermon</h1>
      
      <p className="text-center mb-8">
        Upload a sermon audio file to automatically transcribe it and generate social media snippets.<br />
        The system will notify you when snippets are ready for approval.
      </p>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Upload New Sermon</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="title" className="block font-medium mb-1">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Sermon title"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="speaker" className="block font-medium mb-1">Speaker</label>
            <input
              type="text"
              id="speaker"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Speaker name"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="date" className="block font-medium mb-1">Date</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          
          <div className="mb-6">
            <div className="flex space-x-4 mb-4">
              <button
                type="button"
                onClick={() => {
                  setIsUrlInput(false);
                  setAudioUrl('');
                }}
                className={`px-4 py-2 rounded-md ${
                  !isUrlInput 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Upload File
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setIsUrlInput(true);
                  setFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className={`px-4 py-2 rounded-md ${
                  isUrlInput 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Use URL
              </button>
            </div>
            
            {isUrlInput ? (
              <div>
                <label htmlFor="audioUrl" className="block font-medium mb-1">Audio URL</label>
                <input
                  type="url"
                  id="audioUrl"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://example.com/audio.mp3"
                  required={isUrlInput}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="audioFile" className="block font-medium mb-1">Audio File</label>
                <input
                  type="file"
                  id="audioFile"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      setFile(files[0]);
                    }
                  }}
                  accept="audio/*"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required={!isUrlInput}
                />
                <p className="text-sm text-gray-500 mt-1">Select an audio file from your device</p>
              </div>
            )}
          </div>
          
          {/* Advanced Options Section */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 mr-1 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Advanced Options
            </button>
            
            {showAdvancedOptions && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                <h3 className="font-semibold mb-3">Podcast Settings</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="addIntroOutro"
                      checked={addIntroOutro}
                      onChange={(e) => setAddIntroOutro(e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label htmlFor="addIntroOutro" className="ml-2">
                      Add intro and outro
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="createPodcastVersion"
                      checked={createPodcastVersion}
                      onChange={(e) => setCreatePodcastVersion(e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label htmlFor="createPodcastVersion" className="ml-2">
                      Create podcast version with normalized audio
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="uploadToPodcast"
                      checked={uploadToPodcast}
                      onChange={(e) => setUploadToPodcast(e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label htmlFor="uploadToPodcast" className="ml-2">
                      Upload to podcast platform
                    </label>
                  </div>
                  
                  {uploadToPodcast && (
                    <div className="ml-6 mt-2">
                      <label htmlFor="podcastPlatform" className="block text-sm font-medium mb-1">
                        Select Platform
                      </label>
                      <select
                        id="podcastPlatform"
                        value={podcastPlatform}
                        onChange={(e) => setPodcastPlatform(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="none">Select a platform</option>
                        <option value="anchor">Anchor (Spotify)</option>
                        <option value="buzzsprout">Buzzsprout</option>
                        <option value="transistor">Transistor</option>
                        <option value="podbean">Podbean</option>
                        <option value="libsyn">Libsyn</option>
                        <option value="manual">Manual Export Only</option>
                      </select>
                      
                      <p className="text-sm text-gray-500 mt-2">
                        Note: You'll need to configure API credentials for the selected platform in settings.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-end space-x-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </Link>
            
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Upload Sermon'
              )}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">About Podcast Distribution</h2>
        <p className="mb-3">
          To distribute your sermons to podcast platforms like Spotify, consider using one of these services:
        </p>
        
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Anchor</strong> (Free) - Owned by Spotify, easiest way to get on Spotify</li>
          <li><strong>Buzzsprout</strong> - Popular hosting with wide distribution</li>
          <li><strong>Transistor</strong> - Professional hosting with analytics</li>
          <li><strong>Podbean</strong> - Established platform with good distribution</li>
          <li><strong>Libsyn</strong> - One of the oldest podcast hosting services</li>
        </ul>
        
        <p>
          For direct Spotify integration, we recommend setting up an <a href="https://anchor.fm" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Anchor</a> account 
          and linking it to your Spotify for Creators account.
        </p>
      </div>
    </div>
  );
} 