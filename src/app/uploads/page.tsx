"use client";

import { useState, useRef, FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { compressAudioFileClient } from '@/lib/audio-processing';
import { uploadFileInChunks } from '@/lib/upload-helpers';
import { uploadAudioToSupabase } from '@/lib/supabase-storage';
import { initFFmpeg, compressAudio } from '@/lib/ffmpeg-handler';
import { fetchFile } from '@ffmpeg/util';

type UploadStep = 
  | 'idle' 
  | 'compression' 
  | 'uploading' 
  | 'processing'
  | 'transcribing'
  | 'completed'
  | 'error';

// Add this hook before the component
function useProcessingSimulation() {
  const [processingStep, setProcessingStep] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  
  const simulateProcessing = useCallback((onComplete: () => void) => {
    setIsSimulating(true);
    setProcessingProgress(0);
    setProcessingStep('Analyzing audio file...');
    
    const steps = [
      { step: 'Analyzing audio file...', progress: 10, duration: 1000 },
      { step: 'Preparing for transcription...', progress: 20, duration: 1200 },
      { step: 'Transcribing audio...', progress: 40, duration: 2000 },
      { step: 'Generating snippets...', progress: 70, duration: 1500 },
      { step: 'Finalizing...', progress: 90, duration: 1000 },
      { step: 'Complete', progress: 100, duration: 800 }
    ];
    
    let currentStepIndex = 0;
    
    const processStep = () => {
      if (currentStepIndex >= steps.length) {
        setIsSimulating(false);
        onComplete();
        return;
      }
      
      const currentStep = steps[currentStepIndex];
      setProcessingStep(currentStep.step);
      setProcessingProgress(currentStep.progress);
      
      currentStepIndex++;
      
      setTimeout(processStep, currentStep.duration);
    };
    
    // Start processing
    processStep();
  }, []);
  
  return {
    processingStep,
    processingProgress,
    isSimulating,
    simulateProcessing
  };
}

// Add this component to display detailed chunk progress
// Add at the top level, outside of the UploadPage component
const ChunkProgressDisplay = ({ 
  totalChunks, 
  currentChunk, 
  uploadProgress 
}: { 
  totalChunks: number; 
  currentChunk: number; 
  uploadProgress: number;
}) => {
  const chunks = Array.from({ length: totalChunks }, (_, i) => i);
  
  return (
    <div className="mt-3 mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">0%</span>
        <span className="text-xs text-gray-500">Upload Progress</span>
        <span className="text-xs text-gray-500">100%</span>
      </div>
      
      <div className="flex space-x-1 mb-2">
        {chunks.map(chunk => (
          <div 
            key={chunk}
            className={`h-2 flex-1 rounded-sm ${
              chunk < currentChunk 
                ? 'bg-green-500' 
                : chunk === currentChunk 
                  ? 'bg-blue-500' 
                  : 'bg-gray-200'
            }`}
            title={`Chunk ${chunk + 1} of ${totalChunks}`}
          />
        ))}
      </div>
      
      <div className="text-center text-xs">
        <span className="font-medium">
          {currentChunk < totalChunks 
            ? `Uploading chunk ${currentChunk + 1} of ${totalChunks} (${Math.round((currentChunk + 1) / totalChunks * 100)}% complete)`
            : 'All chunks uploaded'}
        </span>
      </div>
    </div>
  );
};

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
  const [currentStep, setCurrentStep] = useState<UploadStep>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [stepDetails, setStepDetails] = useState<string>('');

  // Inside the UploadPage component, add these state variables:
  const [chunkDetails, setChunkDetails] = useState<{
    totalChunks: number;
    currentChunk: number;
    isUploading: boolean;
  }>({
    totalChunks: 0,
    currentChunk: 0,
    isUploading: false
  });

  const {
    processingStep,
    processingProgress,
    isSimulating,
    simulateProcessing
  } = useProcessingSimulation();

  // Helper function to update progress state
  const updateProgress = (step: UploadStep, detail: string, value: number) => {
    setCurrentStep(step);
    setStepDetails(detail);
    setUploadProgress(value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalFileSize(selectedFile.size);
      updateProgress('idle', 'File selected', 0);
      
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
    
    if (isCompressing) {
      return; // Prevent multiple submissions
    }
    
    setError('');
    
    try {
      // Set uploading state
      setIsCompressing(true);
      setCurrentStep('compression');
      setCompressionProgress('Compressing audio file...');
      
      // Collect form data
      const formDataValues: Record<string, string> = {
        title,
        speaker,
        date,
        addIntroOutro: addIntroOutro.toString(),
        createPodcastVersion: createPodcastVersion.toString(),
        uploadToPodcast: uploadToPodcast.toString(),
        podcastPlatform,
      };
      
      // URL-based upload
      if (isUrlInput && audioUrl) {
        updateProgress('uploading', 'Fetching audio from URL...', 30);
        
        try {
          const response = await fetch('/api/sermons/from-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: audioUrl,
              ...formDataValues,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to upload from URL');
          }
          
          const data = await response.json();
          
          // Start processing simulation
          updateProgress('processing', 'Processing audio file...', 70);
          
          simulateProcessing(() => {
            updateProgress('completed', 'Upload and processing completed successfully!', 100);
            
            setTimeout(() => {
              router.push(`/dashboard/sermons/${data.id}`);
            }, 1000);
          });
        } catch (error) {
          console.error('URL upload error:', error);
          setError(`Failed to upload from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setCurrentStep('error');
          setIsCompressing(false);
        }
        
        return;
      }
      
      // File upload
      if (file) {
        try {
          // Compress the audio file first
          updateProgress('compression', 'Compressing audio file...', 10);
          const audioFileToUpload = await compressAudioFileClient(file);
          
          // Update progress
          const compressionRatio = Math.round((1 - audioFileToUpload.size / file.size) * 100);
          updateProgress(
            'compression', 
            `Compression complete: ${(audioFileToUpload.size / (1024 * 1024)).toFixed(2)} MB (${compressionRatio}% reduction)`, 
            30
          );
          
          // Switch to using Supabase storage for upload
          updateProgress('uploading', 'Uploading to Supabase storage...', 40);
          
          // Upload the file to Supabase storage
          const { url } = await uploadAudioToSupabase(
            audioFileToUpload,
            audioFileToUpload.name,
            (progress) => {
              // Map progress from 0-100 to our 40-70% range
              const mappedProgress = 40 + (progress * 0.3);
              updateProgress('uploading', `Uploading: ${progress}%`, mappedProgress);
            }
          );
          
          // File is uploaded, now create the sermon record
          updateProgress('uploading', 'Upload complete, creating sermon record...', 70);
          
          // Create sermon record
          const response = await fetch('/api/sermons', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audioUrl: url,
              ...formDataValues,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create sermon record');
          }
          
          const data = await response.json();
          
          // Start processing simulation after successful upload
          updateProgress('processing', 'Processing audio file...', 80);
          
          simulateProcessing(() => {
            updateProgress('completed', 'Upload and processing completed successfully!', 100);
            
            setTimeout(() => {
              router.push(`/dashboard/sermons/${data.id}`);
            }, 1000);
          });
        } catch (uploadError) {
          console.error('Upload failed:', uploadError);
          setError(`Failed to upload: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          setCurrentStep('error');
          setIsCompressing(false);
        }
      } else {
        setError('Please select a file to upload');
        setIsCompressing(false);
      }
    } catch (error) {
      console.error('Submission error:', error);
      setError(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCurrentStep('error');
      setIsCompressing(false);
    }
  };

  // Function to render the progress indicator
  const renderProgressIndicator = () => {
    if (currentStep === 'idle') return null;
    
    const steps = [
      { key: 'compression', label: 'Compression' },
      { key: 'uploading', label: 'Upload' },
      { key: 'processing', label: 'Processing' },
      { key: 'completed', label: 'Complete' }
    ];
    
    const getCurrentStepIndex = () => {
      if (currentStep === 'error') return -1;
      return steps.findIndex(step => step.key === currentStep);
    };
    
    const currentStepIndex = getCurrentStepIndex();
    
    // Calculate progress based on current step and simulation
    const calculateProgress = () => {
      if (currentStep === 'error') return uploadProgress;
      if (currentStep === 'processing' && isSimulating) {
        return 70 + (processingProgress * 0.3 / 100);
      }
      return uploadProgress;
    };
    
    // Get the current detail text
    const getDetailText = () => {
      if (currentStep === 'error') return stepDetails;
      if (currentStep === 'processing' && isSimulating) {
        return processingStep;
      }
      
      // For uploading step, check if we're handling chunks
      if (currentStep === 'uploading' && stepDetails.includes('chunk')) {
        // Make the chunk text more prominent
        return (
          <span className="font-medium">
            {stepDetails}
          </span>
        );
      }
      
      return stepDetails;
    };
    
    return (
      <div className="mt-6 mb-4">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div key={step.key} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStepIndex >= index 
                  ? currentStepIndex === index 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {currentStepIndex > index ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className="text-xs mt-1">{step.label}</span>
            </div>
          ))}
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
          <div 
            className={`h-2.5 rounded-full ${currentStep === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} 
            style={{ width: `${calculateProgress()}%` }}
          ></div>
        </div>
        
        <div className="text-sm mt-2 text-center">
          {currentStep === 'error' ? (
            <span className="text-red-500">{getDetailText()}</span>
          ) : (
            getDetailText()
          )}
        </div>
        
        {/* Add a detailed chunk counter if we're uploading chunks */}
        {currentStep === 'uploading' && stepDetails.includes('chunk') && (
          <div className="mt-2 text-xs text-gray-600 text-center">
            The file is being uploaded in small chunks to bypass size limitations.
            <br />This ensures even large files can be uploaded successfully.
          </div>
        )}
        
        {/* Add under the progress bar: */}
        {currentStep === 'uploading' && chunkDetails.isUploading && chunkDetails.totalChunks > 0 && (
          <ChunkProgressDisplay
            totalChunks={chunkDetails.totalChunks}
            currentChunk={chunkDetails.currentChunk}
            uploadProgress={uploadProgress}
          />
        )}
      </div>
    );
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
        
        {renderProgressIndicator()}
        
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
          
          <div className="flex justify-end space-x-4 mt-6">
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