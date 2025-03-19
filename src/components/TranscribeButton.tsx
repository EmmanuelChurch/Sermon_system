'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TranscribeButtonProps {
  sermonId: string;
  audioUrl?: string;
  onTranscriptionStarted?: () => void;
}

export default function TranscribeButton({ 
  sermonId,
  audioUrl,
  onTranscriptionStarted
}: TranscribeButtonProps) {
  const router = useRouter();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [compressedFileUrl, setCompressedFileUrl] = useState<string | null>(null);
  const [compressedFileName, setCompressedFileName] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<string>('checking');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Starting transcription process...');

  const handleTranscribe = async () => {
    if (isTranscribing) return;
    
    try {
      setIsTranscribing(true);
      setError(null);
      setProgress(0);
      
      // Set the active step
      setActiveStep('checking');
      
      setStatusMessage('Starting transcription process...');
      
      // Begin transcription
      const response = await fetch(`/api/sermons/${sermonId}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          useMock,
          audioUrl: audioUrl,
        }),
      });
      
      // Update UI with active step
      setActiveStep('processing');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start transcription');
      }
      
      const data = await response.json();
      
      // Set success status
      setStatusMessage(data.message || 'Transcription started successfully!');
      setActiveStep('complete');
      
      // Notify parent component that transcription has started
      if (onTranscriptionStarted) {
        onTranscriptionStarted();
      }
      
      // Redirect to status page after a brief delay
      setTimeout(() => {
        window.location.href = '/dashboard/transcription-status';
      }, 2000);
    } catch (err) {
      console.error('Error starting transcription:', err);
      setActiveStep('error');
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  // New function to handle file selection and compression
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadedFile(file);
    setError(null);
    
    // Check file size (25MB = 26214400 bytes)
    const MAX_SIZE = 25 * 1024 * 1024;
    
    if (file.size <= MAX_SIZE) {
      setStatus(`Selected "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB). Click "Start Transcription" to proceed.`);
      return;
    }
    
    // File is too large - compress it
    try {
      setIsCompressing(true);
      setStatus(`File size exceeds 25MB limit. Compressing ${(file.size / (1024 * 1024)).toFixed(2)}MB file...`);
      setCompressionProgress(10);
      
      // Upload the file to a temporary endpoint that will compress it
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sermonId', sermonId);
      
      setStatus(`Uploading file to server for compression...`);
      setCompressionProgress(20);
      
      const response = await fetch('/api/tools/compress', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Compression failed: ${errorText}`);
      }
      
      setCompressionProgress(90);
      setStatus(`File compressed successfully. Finalizing...`);
      
      const result = await response.json();
      setCompressionProgress(100);
      
      setStatus(`File compressed: ${(file.size / (1024 * 1024)).toFixed(2)}MB → ${(result.size / (1024 * 1024)).toFixed(2)}MB (${result.compressionRatio} reduction). 
      
Download the compressed file by clicking the link below, then use "Choose File" to select it.`);
      
      // Alert user to download the file
      setCompressedFileUrl(result.url);
      setCompressedFileName(result.filename || 'compressed-file.mp3');
      
    } catch (error: any) {
      console.error('Compression error:', error);
      setError(error.message || 'Failed to compress audio file');
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-500 rounded-md border border-red-100">
          {error}
        </div>
      )}
      
      {isTranscribing && (
        <div className="mb-4">
          <div className="space-y-4 mb-4">
            {/* Step Indicator */}
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
              <div className="space-y-3">
                <div className={`flex items-start ${activeStep === 'checking' || activeStep === 'processing' || activeStep === 'complete' ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center mr-3 ${activeStep === 'checking' ? 'bg-blue-500' : activeStep === 'processing' || activeStep === 'complete' ? 'bg-green-500' : 'bg-gray-200'}`}>
                    {activeStep === 'processing' || activeStep === 'complete' ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={'M5 13l4 4L19 7'} />
                      </svg>
                    ) : (
                      <span className="text-white text-xs">1</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Checking Audio</p>
                    <p className="text-sm text-gray-500">Verifying audio file is accessible</p>
                  </div>
                </div>
                
                <div className={`flex items-start ${activeStep === 'processing' || activeStep === 'complete' ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center mr-3 ${activeStep === 'processing' ? 'bg-blue-500' : activeStep === 'complete' ? 'bg-green-500' : 'bg-gray-200'}`}>
                    {activeStep === 'complete' ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={'M5 13l4 4L19 7'} />
                      </svg>
                    ) : (
                      <span className="text-white text-xs">2</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Processing</p>
                    <p className="text-sm text-gray-500">Transcribing audio with AI</p>
                  </div>
                </div>
                
                <div className={`flex items-start ${activeStep === 'complete' ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center mr-3 ${activeStep === 'complete' ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <span className="text-white text-xs">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Complete</p>
                    <p className="text-sm text-gray-500">Transcription in progress</p>
                  </div>
                </div>
                
                {activeStep === 'error' && (
                  <div className="flex items-start text-red-600">
                    <div className="flex-shrink-0 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={'M6 18L18 6M6 6l12 12'} />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Error</p>
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-center text-gray-600">
              {statusMessage}
            </div>
          </div>
        </div>
      )}
      
      {!isTranscribing && (
        <div>
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="useMock"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="useMock" className="ml-2 text-sm text-gray-600">
              Use Mock (Testing)
            </label>
          </div>
          
          <button
            onClick={handleTranscribe}
            disabled={isTranscribing}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300"
          >
            Start Transcription
          </button>
        </div>
      )}
    </div>
  );
} 