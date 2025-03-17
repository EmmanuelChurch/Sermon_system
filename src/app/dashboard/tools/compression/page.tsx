'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

export default function CompressionToolPage() {
  const [file, setFile] = useState<File | null>(null);
  const [compressedFileUrl, setCompressedFileUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: string;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setCompressedFileUrl(null);
    setError(null);
    setStatus(`Selected "${selectedFile.name}" (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`);
  };

  const handleCompression = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    try {
      setIsCompressing(true);
      setProgress(0);
      setError(null);
      setStatus(`Starting compression of ${file.name}...`);

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      setProgress(20);
      setStatus('Uploading file to server...');
      
      // Use our API endpoint for standalone compression
      const response = await fetch('/api/tools/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Compression failed: ${errorText}`);
      }

      setProgress(90);
      setStatus('Processing complete. Preparing download...');

      const result = await response.json();
      
      setCompressedFileUrl(result.url);
      setStats({
        originalSize: result.originalSize,
        compressedSize: result.size,
        compressionRatio: result.compressionRatio
      });
      
      setProgress(100);
      setStatus('Compression complete! You can now download the file.');
      
    } catch (error: any) {
      console.error('Compression error:', error);
      setError(error.message || 'An error occurred during compression');
      setStatus(null);
    } finally {
      setIsCompressing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setCompressedFileUrl(null);
    setStatus(null);
    setError(null);
    setStats(null);
    setProgress(0);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6">
        <Link href="/dashboard" className="text-blue-500 hover:underline mb-6 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Audio Compression Tool</h1>
        <p className="mb-6 text-gray-700">
          Use this tool to compress audio files without attaching them to sermons. 
          This is useful for reducing file sizes before uploading them to the sermon system.
        </p>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Audio File:
          </label>
          <input 
            type="file" 
            ref={fileInputRef}
            accept="audio/*" 
            onChange={handleFileChange}
            disabled={isCompressing}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
        
        {status && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded border border-blue-100">
            <div className="flex justify-between items-center mb-2">
              <strong className="text-sm">{status}</strong>
              {isCompressing && <span className="text-xs">{progress}%</span>}
            </div>
            
            {isCompressing && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-500 rounded border border-red-100">
            {error}
          </div>
        )}
        
        {stats && (
          <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2">Compression Results</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <span className="text-gray-500 w-40">Original Size:</span>
                <span className="text-gray-900 font-medium">
                  {(stats.originalSize / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-500 w-40">Compressed Size:</span>
                <span className="text-gray-900 font-medium">
                  {(stats.compressedSize / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-500 w-40">Compression Ratio:</span>
                <span className="text-green-600 font-medium">
                  {stats.compressionRatio}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCompression}
            disabled={!file || isCompressing}
            className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300 disabled:cursor-not-allowed transition"
          >
            {isCompressing ? 'Compressing...' : 'Compress File'}
          </button>
          
          {compressedFileUrl && (
            <a
              href={compressedFileUrl}
              download
              className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition inline-flex items-center"
            >
              Download Compressed File
            </a>
          )}
          
          {compressedFileUrl && (
            <p className="mt-2 text-xs text-gray-500">
              The compressed file will be automatically deleted after 1 hour. Please download it now.
            </p>
          )}
          
          <button
            onClick={resetForm}
            className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
} 