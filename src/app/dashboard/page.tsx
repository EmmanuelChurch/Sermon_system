'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Sermon } from '@/types';

export default function DashboardPage() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSermons, setSelectedSermons] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSermons = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Fetching sermons from API...');
      
      const response = await fetch('/api/sermons', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sermons: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Sermons response:', data);
      
      if (!data || !data.sermons) {
        console.error('Invalid sermon data format:', data);
        setSermons([]);
        setError('Invalid data format received from server');
        return;
      }
      
      // Sort sermons by date, newest first
      const sortedSermons = data.sermons.sort((a: Sermon, b: Sermon) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      setSermons(sortedSermons);
      console.log(`Loaded ${sortedSermons.length} sermons successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sermons';
      setError(errorMessage);
      console.error('Error fetching sermons:', err);
      setSermons([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSermons();
  }, []);

  const handleDelete = async (sermonId: string) => {
    if (!confirm('Are you sure you want to delete this sermon? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sermons/${sermonId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete sermon');
      }
      
      // Refresh the sermon list after deletion
      fetchSermons();
      
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred while deleting the sermon');
      console.error('Error deleting sermon:', err);
    }
  };

  const handleMultiDelete = async () => {
    if (selectedSermons.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedSermons.length} sermon(s)? This action cannot be undone.`)) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      // Delete sermons one by one
      for (const sermonId of selectedSermons) {
        const response = await fetch(`/api/sermons/${sermonId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete sermon');
        }
      }
      
      // Clear selections and refresh the sermon list
      setSelectedSermons([]);
      fetchSermons();
      
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred while deleting sermons');
      console.error('Error deleting sermons:', err);
    } finally {
      setIsDeleting(false);
    }
  };
  
  const toggleSelectAll = () => {
    if (selectedSermons.length === sermons.length) {
      // Deselect all
      setSelectedSermons([]);
    } else {
      // Select all
      setSelectedSermons(sermons.map(sermon => sermon.id));
    }
  };
  
  const toggleSelectSermon = (sermonId: string) => {
    if (selectedSermons.includes(sermonId)) {
      // Deselect
      setSelectedSermons(selectedSermons.filter(id => id !== sermonId));
    } else {
      // Select
      setSelectedSermons([...selectedSermons, sermonId]);
    }
  };

  const handleRetryFetch = () => {
    fetchSermons();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="text-center py-10">
          <p>Loading sermons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
        <button 
          onClick={handleRetryFetch}
          className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (sermons.length === 0) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Sermon Dashboard</h1>
          <Link href="/uploads" className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600">
            Upload New Sermon
          </Link>
        </div>
        
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">No Sermons Found</h2>
          <p className="mb-4">Get started by uploading your first sermon.</p>
          <Link 
            href="/uploads" 
            className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
          >
            Upload New Sermon
          </Link>
        </div>
      </div>
    );
  }

  // Provide direct access to Transcription Status page
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Sermon Dashboard</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/uploads" className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 text-center">
            Upload New Sermon
          </Link>
          <Link href="/dashboard/transcription-status" className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 text-center">
            Transcription Status
          </Link>
        </div>
      </div>

      {selectedSermons.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md mb-4 flex justify-between items-center">
          <p>{selectedSermons.length} sermon(s) selected</p>
          <button
            onClick={handleMultiDelete}
            disabled={isDeleting}
            className="bg-red-500 text-white py-1 px-3 rounded-md hover:bg-red-600 disabled:bg-red-300"
          >
            {isDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4">
                <input
                  type="checkbox"
                  checked={selectedSermons.length === sermons.length && sermons.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Speaker
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sermons.map((sermon) => (
              <tr key={sermon.id} className="hover:bg-gray-50">
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedSermons.includes(sermon.id)}
                    onChange={() => toggleSelectSermon(sermon.id)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/dashboard/sermons/${sermon.id}`} className="text-blue-600 hover:underline">
                    {sermon.title || 'Untitled'}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {sermon.speaker || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {sermon.date 
                    ? new Date(sermon.date).toLocaleDateString() 
                    : 'Unknown date'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${sermon.transcriptionstatus === 'completed' ? 'bg-green-100 text-green-800' : 
                      sermon.transcriptionstatus === 'processing' ? 'bg-yellow-100 text-yellow-800' : 
                      sermon.transcriptionstatus === 'failed' ? 'bg-red-100 text-red-800' : 
                      'bg-gray-100 text-gray-800'}`}>
                    {sermon.transcriptionstatus || 'No transcription'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <Link
                      href={`/dashboard/sermons/${sermon.id}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDelete(sermon.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}