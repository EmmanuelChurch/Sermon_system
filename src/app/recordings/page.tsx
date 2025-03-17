'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RecordingFile {
  name: string;
  path: string;
  fullPath: string;
  size: number;
  type: string;
}

export default function RecordingsPage() {
  const router = useRouter();
  const [files, setFiles] = useState<RecordingFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/recordings');
        
        if (!response.ok) {
          throw new Error('Failed to fetch recordings');
        }
        
        const data = await response.json();
        setFiles(data.files || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecordings();
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      alert('Please select an audio file');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedFile,
          title,
          speaker,
          date,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create sermon');
      }
      
      const result = await response.json();
      alert('Sermon created successfully!');
      router.push('/dashboard');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create sermon');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">Loading recordings...</h1>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">Recordings</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
        <Link href="/dashboard" className="text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6">
        <Link href="/dashboard" className="text-blue-500 hover:underline">
          &larr; Back to Dashboard
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold mb-6">Create Sermon from Recording</h1>
      
      {files.length === 0 ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p>No recording files found in the recordings directory. Please place your audio files in the "recordings" folder.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Available Recordings</h2>
            <div className="border rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {files.map((file) => (
                  <li 
                    key={file.name}
                    className={`p-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center ${selectedFile === file.name ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedFile(file.name)}
                  >
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {file.type.toUpperCase()} • {formatFileSize(file.size)}
                      </p>
                    </div>
                    {selectedFile === file.name && (
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">Sermon Details</h2>
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border">
              <div className="mb-4">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Sermon Title*
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter sermon title"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="speaker" className="block text-sm font-medium text-gray-700 mb-1">
                  Speaker*
                </label>
                <input
                  type="text"
                  id="speaker"
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter speaker name"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date*
                </label>
                <input
                  type="date"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Recording
                </label>
                {selectedFile ? (
                  <p className="text-blue-600 font-medium">{selectedFile}</p>
                ) : (
                  <p className="text-red-500">Please select a recording from the list</p>
                )}
              </div>
              
              <button
                type="submit"
                disabled={!selectedFile || isSubmitting}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300"
              >
                {isSubmitting ? 'Creating Sermon...' : 'Create Sermon'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 