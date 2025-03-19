"use client";

import { useState, useRef, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { compressAudioFileClient } from '@/lib/audio-processing';

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

  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<string | null>(null);
  const [originalFileSize, setOriginalFileSize] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalFileSize(selectedFile.size);
      
      // Display file size info
      const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      setCompressionProgress(`Selected file: ${selectedFile.name} (${fileSizeMB} MB)`);
      
      // Show compression message for large files
      if (selectedFile.size > 10 * 1024 * 1024) {
        setCompressionProgress(`File is large (${fileSizeMB} MB). It will be compressed before upload.`);
      }
    }
  };

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
        let audioFileToUpload = file;
        
        // Compress large audio files on the client side before uploading
        if (file.size > 10 * 1024 * 1024) {
          setIsCompressing(true);
          setCompressionProgress('Compressing audio file before upload...');
          
          try {
            audioFileToUpload = await compressAudioFileClient(file);
            
            const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const compressedSizeMB = (audioFileToUpload.size / (1024 * 1024)).toFixed(2);
            const reductionPercent = Math.round((1 - audioFileToUpload.size / file.size) * 100);
            
            setCompressionProgress(
              `Compression complete: ${originalSizeMB} MB → ${compressedSizeMB} MB (${reductionPercent}% reduction)`
            );
          } catch (compressError) {
            console.error('Compression failed, using original file:', compressError);
            setCompressionProgress('Compression failed, using original file');
          } finally {
            setIsCompressing(false);
          }
        }
        
        formData.append('audioFile', audioFileToUpload);
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
            <path fillRule="evenodd" d={'M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z'} clipRule="evenodd" />
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
          
          <div className="mb-4">
            <label className="block font-medium mb-1">Audio File</label>
            {isUrlInput ? (
              <input
                type="url"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter URL to audio file"
                required={isUrlInput}
              />
            ) : (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="audio/*"
                  required={!isUrlInput}
                />
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md mr-2"
                  >
                    {file ? 'Change File' : 'Upload File'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUrlInput(true)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-md"
                  >
                    Use URL
                  </button>
                </div>
                {file && (
                  <div className="mt-2 text-sm">
                    Selected: {file.name}
                  </div>
                )}
                {compressionProgress && (
                  <div className="mt-2 text-sm text-gray-600">
                    {compressionProgress}
                  </div>
                )}
              </>
            )}
            {isUrlInput && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUrlInput(false);
                    setAudioUrl('');
                  }}
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  Switch to file upload
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: MP3, WAV, M4A. Large files will be automatically compressed.
            </p>
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
                <path fillRule="evenodd" d={'M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'} clipRule="evenodd" />
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
                        <option value="buzzsprout">Buzzsprout</option>
                        <option value="libsyn">Libsyn</option>
                        <option value="manual">Manual Export Only</option>
                      </select>
                      
                      <p className="text-sm text-gray-500 mt-2">
                        Note: You&apos;ll need to configure API credentials for the selected platform in settings.
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
              disabled={isLoading || isCompressing}
              className={`bg-green-500 text-white py-2 px-6 rounded-md font-medium ${
                (isLoading || isCompressing) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'
              }`}
            >
              {isLoading ? 'Uploading...' : isCompressing ? 'Compressing...' : 'Upload Sermon'}
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