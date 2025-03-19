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
      
      const response = await fetch('/api/sermons');
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
      
      setSermons(data.sermons);
      console.log(`Loaded ${data.sermons.length} sermons successfully`);
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
          onClick={fetchSermons}
          className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Sermon Dashboard</h1>
        <div className="flex space-x-4">
          {selectedSermons.length > 0 && (
            <button
              onClick={handleMultiDelete}
              disabled={isDeleting}
              className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:bg-red-300 flex items-center"
            >
              {isDeleting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d={'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'}></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>Delete Selected ({selectedSermons.length})</>
              )}
            </button>
          )}
          <Link
            href="/dashboard/tools/compression"
            className="bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
          >
            Compress Audio
          </Link>
          <Link
            href="/recordings"
            className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
          >
            Use Recording
          </Link>
          <Link
            href="/uploads"
            className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            Upload New Sermon
          </Link>
        </div>
      </div>

      {sermons.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-600 mb-4">No sermons have been uploaded yet.</p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/recordings"
              className="text-green-500 hover:underline"
            >
              Use an existing recording
            </Link>
            <span className="text-gray-400">|</span>
            <Link
              href="/uploads"
              className="text-blue-500 hover:underline"
            >
              Upload a new sermon
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      checked={selectedSermons.length === sermons.length && sermons.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </label>
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Speaker
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transcription
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Snippets
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sermons.map((sermon) => (
                <tr key={sermon.id} className={`hover:bg-gray-50 ${selectedSermons.includes(sermon.id) ? 'bg-blue-50' : ''}`}>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        checked={selectedSermons.includes(sermon.id)}
                        onChange={() => toggleSelectSermon(sermon.id)}
                      />
                    </label>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {sermon.title}
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{sermon.speaker}</div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(sermon.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        sermon.transcriptionstatus
                      )}`}
                    >
                      {sermon.transcriptionstatus}
                    </span>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <Link
                      href={`/dashboard/sermons/${sermon.id}/snippets`}
                      className="text-blue-500 hover:underline"
                    >
                      View Snippets
                    </Link>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link
                        href={`/dashboard/sermons/${sermon.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Details
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
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'processing':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}