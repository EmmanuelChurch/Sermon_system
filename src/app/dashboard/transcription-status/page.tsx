'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TranscriptionStatusPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sermons, setSermons] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchSermons = async () => {
    try {
      setLoading(true);
      // Fetch the sermons
      const response = await fetch('/api/sermons');
      if (!response.ok) {
        throw new Error(`Error fetching sermons: ${response.status}`);
      }
      
      const data = await response.json();
      const sermonsData = Array.isArray(data) ? data : (data.sermons || []);
      
      if (!Array.isArray(sermonsData)) {
        throw new Error('Invalid sermons data format');
      }
      
      setSermons(sermonsData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching sermons:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sermons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSermons();
    
    // Set up polling every 5 seconds
    const interval = setInterval(fetchSermons, 5000);
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, []);

  // Filter sermons by transcription status
  const inProgressSermons = sermons.filter(
    sermon => sermon.transcriptionstatus === 'processing'
  );
  
  const recentlyCompletedSermons = sermons.filter(
    sermon => sermon.transcriptionstatus === 'completed' && 
    (new Date(sermon.updated_at).getTime() > new Date().getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
  );
  
  const failedSermons = sermons.filter(
    sermon => sermon.transcriptionstatus === 'failed'
  );

  // Format functions
  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Transcription Status</h1>
        
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
          <button 
            onClick={fetchSermons}
            className="ml-2 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
            aria-label="Refresh"
          >
            🔄
          </button>
        </div>
      </div>
      
      {loading && sermons.length === 0 ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* In Progress Transcriptions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">In Progress</h2>
            
            {inProgressSermons.length === 0 ? (
              <p className="text-gray-500">No transcriptions in progress</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Sermon</th>
                      <th className="py-2 px-4 border-b text-left">Speaker</th>
                      <th className="py-2 px-4 border-b text-left">Started</th>
                      <th className="py-2 px-4 border-b text-left">Duration</th>
                      <th className="py-2 px-4 border-b text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inProgressSermons.map(sermon => (
                      <tr key={sermon.id} className="hover:bg-gray-50">
                        <td className="py-2 px-4 border-b">{sermon.title || 'Untitled'}</td>
                        <td className="py-2 px-4 border-b">{sermon.speaker || 'Unknown'}</td>
                        <td className="py-2 px-4 border-b">{formatDate(sermon.updated_at)}</td>
                        <td className="py-2 px-4 border-b">{formatDuration(sermon.duration)}</td>
                        <td className="py-2 px-4 border-b">
                          <Link href={`/dashboard/sermons/${sermon.id}`} className="text-blue-500 hover:underline">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Recently Completed Transcriptions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Recently Completed</h2>
            
            {recentlyCompletedSermons.length === 0 ? (
              <p className="text-gray-500">No recently completed transcriptions</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Sermon</th>
                      <th className="py-2 px-4 border-b text-left">Speaker</th>
                      <th className="py-2 px-4 border-b text-left">Completed</th>
                      <th className="py-2 px-4 border-b text-left">Duration</th>
                      <th className="py-2 px-4 border-b text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentlyCompletedSermons.map(sermon => (
                      <tr key={sermon.id} className="hover:bg-gray-50">
                        <td className="py-2 px-4 border-b">{sermon.title || 'Untitled'}</td>
                        <td className="py-2 px-4 border-b">{sermon.speaker || 'Unknown'}</td>
                        <td className="py-2 px-4 border-b">{formatDate(sermon.updated_at)}</td>
                        <td className="py-2 px-4 border-b">{formatDuration(sermon.duration)}</td>
                        <td className="py-2 px-4 border-b">
                          <div className="flex space-x-3">
                            <Link href={`/dashboard/sermons/${sermon.id}`} className="text-blue-500 hover:underline">
                              View
                            </Link>
                            <Link href={`/dashboard/sermons/${sermon.id}/snippets`} className="text-green-500 hover:underline">
                              Snippets
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Failed Transcriptions */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Failed</h2>
            
            {failedSermons.length === 0 ? (
              <p className="text-gray-500">No failed transcriptions</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Sermon</th>
                      <th className="py-2 px-4 border-b text-left">Speaker</th>
                      <th className="py-2 px-4 border-b text-left">Failed</th>
                      <th className="py-2 px-4 border-b text-left">Error</th>
                      <th className="py-2 px-4 border-b text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedSermons.map(sermon => (
                      <tr key={sermon.id} className="hover:bg-gray-50">
                        <td className="py-2 px-4 border-b">{sermon.title || 'Untitled'}</td>
                        <td className="py-2 px-4 border-b">{sermon.speaker || 'Unknown'}</td>
                        <td className="py-2 px-4 border-b">{formatDate(sermon.updated_at)}</td>
                        <td className="py-2 px-4 border-b text-red-500 truncate max-w-[300px]" title={sermon.transcription_error}>
                          {sermon.transcription_error || 'Unknown error'}
                        </td>
                        <td className="py-2 px-4 border-b">
                          <Link href={`/dashboard/sermons/${sermon.id}`} className="text-blue-500 hover:underline">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 