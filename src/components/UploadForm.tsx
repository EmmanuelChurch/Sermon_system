'use client';

import { useState, FormEvent, ChangeEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Define the upload steps
type UploadStep = {
  id: string;
  label: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
};

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    speaker: '',
    date: new Date().toISOString().split('T')[0],
    externalUrl: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useExternalUrl, setUseExternalUrl] = useState(false);
  
  // Define upload steps
  const [uploadSteps, setUploadSteps] = useState<UploadStep[]>([
    { id: 'prepare', label: 'Preparing Data', description: 'Organizing file data for upload', isCompleted: false, isActive: false },
    { id: 'check-size', label: 'Checking File Size', description: 'Determining if compression is needed', isCompleted: false, isActive: false },
    { id: 'compress', label: 'Compressing File', description: 'Reducing file size for faster upload', isCompleted: false, isActive: false },
    { id: 'upload', label: 'Uploading', description: 'Sending file to the server', isCompleted: false, isActive: false },
    { id: 'process', label: 'Processing', description: 'Finalizing and saving your sermon', isCompleted: false, isActive: false },
    { id: 'complete', label: 'Complete', description: 'Upload successful!', isCompleted: false, isActive: false },
  ]);

  // Update step function
  const updateStep = (stepId: string, updates: Partial<UploadStep>) => {
    setUploadSteps(prev => 
      prev.map(step => 
        step.id === stepId 
          ? { ...step, ...updates } 
          : step
      )
    );
  };

  // Set active step
  const setActiveStep = (stepId: string) => {
    setUploadSteps(prev => 
      prev.map(step => ({
        ...step,
        isActive: step.id === stepId,
        isCompleted: prev.findIndex(s => s.id === step.id) < prev.findIndex(s => s.id === stepId)
      }))
    );
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Check if the file is an audio file
      if (!selectedFile.type.startsWith('audio/')) {
        setError('Please upload an audio file');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
    }
  };

  const toggleUploadMode = (useUrl: boolean) => {
    // Reset error when switching modes
    setError(null);
    
    // Reset file when switching to URL mode
    if (useUrl && file) {
      setFile(null);
      // Reset the file input value
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    
    // Set the mode
    setUseExternalUrl(useUrl);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!useExternalUrl && !file) {
      setError('Please select an audio file or provide an external URL');
      return;
    }
    
    if (useExternalUrl && !formData.externalUrl) {
      setError('Please provide an external URL for the audio file');
      return;
    }
    
    if (!formData.title || !formData.speaker || !formData.date) {
      setError('Please fill in all required fields');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    // Reset steps
    setUploadSteps(steps => steps.map(step => ({ ...step, isActive: false, isCompleted: false })));
    
    try {
      let response;
      
      if (useExternalUrl) {
        // Set active step for URL upload
        setActiveStep('prepare');
        
        // Send API request with external URL
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UI feedback
        
        setActiveStep('upload');
        response = await fetch('/api/upload/external', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: formData.title,
            speaker: formData.speaker,
            date: formData.date,
            audioUrl: formData.externalUrl
          }),
        });
        
        setActiveStep('process');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UI feedback
      } else {
        // Create form data for the API request with file upload
        setActiveStep('prepare');
        const apiFormData = new FormData();
        apiFormData.append('audioFile', file!);
        apiFormData.append('title', formData.title);
        apiFormData.append('speaker', formData.speaker);
        apiFormData.append('date', formData.date);
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UI feedback
        
        // Check file size - show compression step if needed
        setActiveStep('check-size');
        const fileSize = file!.size;
        const needsCompression = fileSize > 25 * 1024 * 1024; // 25MB threshold
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UI feedback
        
        if (needsCompression) {
          setActiveStep('compress');
          // We don't actually compress client-side, but we'll show the step in UI
          // The server will handle compression
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate compression time
        }
        
        // Set active step for upload
        setActiveStep('upload');
        
        // Start upload progress indicator
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 95) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 5;
          });
        }, 500);
        
        // Send the request to the API
        response = await fetch('/api/upload', {
          method: 'POST',
          body: apiFormData,
        });
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        // Processing step
        setActiveStep('process');
        await new Promise(resolve => setTimeout(resolve, 800)); // Brief delay for UI feedback
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload sermon');
      }
      
      // Complete step
      setActiveStep('complete');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Show complete state briefly
      
      // Reset the form
      setFormData({
        title: '',
        speaker: '',
        date: new Date().toISOString().split('T')[0],
        externalUrl: '',
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Redirect to the dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      // Reset steps on error
      setUploadSteps(steps => steps.map(step => ({ ...step, isActive: false, isCompleted: false })));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-6">Upload New Sermon</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-500 rounded-md border border-red-100">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title" className="block text-gray-700 font-medium mb-2">
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="speaker" className="block text-gray-700 font-medium mb-2">
            Speaker
          </label>
          <input
            type="text"
            id="speaker"
            name="speaker"
            value={formData.speaker}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="date" className="block text-gray-700 font-medium mb-2">
            Date
          </label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <button
              type="button"
              onClick={() => toggleUploadMode(false)}
              className={`px-4 py-2 rounded-l-md ${!useExternalUrl ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => toggleUploadMode(true)}
              className={`px-4 py-2 rounded-r-md ${useExternalUrl ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Use URL
            </button>
          </div>
          
          {useExternalUrl ? (
            <div>
              <label htmlFor="externalUrl" className="block text-gray-700 font-medium mb-2">
                External Audio URL
              </label>
              <input
                type="url"
                id="externalUrl"
                name="externalUrl"
                value={formData.externalUrl}
                onChange={handleInputChange}
                placeholder="https://example.com/audio.mp3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Paste a direct URL to an audio file (must be publicly accessible)
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="file" className="block text-gray-700 font-medium mb-2">
                Audio File
              </label>
              <input
                type="file"
                id="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Select an audio file from your device
              </p>
              {file && (
                <p className="mt-2 text-sm text-blue-500">
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>
          )}
        </div>
        
        {isUploading && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Upload Progress</h3>
            <div className="space-y-4">
              {uploadSteps.map((step) => (
                <div key={step.id} className="flex items-start">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                    step.isCompleted ? 'bg-green-500' : step.isActive ? 'bg-blue-500' : 'bg-gray-200'
                  }`}>
                    {step.isCompleted ? (
                      <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={'M5 13l4 4L19 7'}></path>
                      </svg>
                    ) : (
                      <span className="text-white text-xs">{uploadSteps.findIndex(s => s.id === step.id) + 1}</span>
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className={`font-medium ${step.isActive ? 'text-blue-600' : step.isCompleted ? 'text-green-600' : 'text-gray-600'}`}>
                      {step.label}
                    </p>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-right text-sm text-gray-600 mt-1">{uploadProgress}%</p>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading}
            className={`px-4 py-2 text-white rounded-md ${
              isUploading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isUploading ? 'Uploading...' : 'Upload Sermon'}
          </button>
        </div>
      </form>
    </div>
  );
} 