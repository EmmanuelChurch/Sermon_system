'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Sermon } from '@/types';

export default function DashboardPage() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [filteredSermons, setFilteredSermons] = useState<Sermon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSermons, setSelectedSermons] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Date filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortField, setSortField] = useState<'date' | 'createdat'>('createdat');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
        setFilteredSermons([]);
        setError('Invalid data format received from server');
        return;
      }
      
      // Store the fetched sermons
      setSermons(data.sermons);
      
      // Apply initial sorting (by creation date, newest first)
      sortSermons(data.sermons, 'createdat', 'desc');
      
      console.log(`Loaded ${data.sermons.length} sermons successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sermons';
      setError(errorMessage);
      console.error('Error fetching sermons:', err);
      setSermons([]);
      setFilteredSermons([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to sort sermons
  const sortSermons = (sermonsToSort: Sermon[], field: 'date' | 'createdat', order: 'asc' | 'desc') => {
    const sortedSermons = [...sermonsToSort].sort((a, b) => {
      const dateA = new Date(field === 'date' ? a.date : a.createdat).getTime();
      const dateB = new Date(field === 'date' ? b.date : b.createdat).getTime();
      
      return order === 'asc' ? dateA - dateB : dateB - dateA;
    });
    
    setFilteredSermons(sortedSermons);
    setSortField(field);
    setSortOrder(order);
  };

  // Apply filters whenever filter criteria change
  useEffect(() => {
    if (sermons.length === 0) return;
    
    let result = [...sermons];
    
    // Apply date filters if set
    if (startDate) {
      const startDateTime = new Date(startDate).getTime();
      result = result.filter(sermon => {
        const sermonDate = new Date(sermon.date).getTime();
        return sermonDate >= startDateTime;
      });
    }
    
    if (endDate) {
      const endDateTime = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1); // End of the selected day
      result = result.filter(sermon => {
        const sermonDate = new Date(sermon.date).getTime();
        return sermonDate <= endDateTime;
      });
    }
    
    // Apply sort
    sortSermons(result, sortField, sortOrder);
    
  }, [sermons, startDate, endDate, sortField, sortOrder]);

  // Load sermons when component mounts
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
    if (selectedSermons.length === filteredSermons.length) {
      // Deselect all
      setSelectedSermons([]);
    } else {
      // Select all
      setSelectedSermons(filteredSermons.map(sermon => sermon.id));
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
  
  const handleSortChange = (field: 'date' | 'createdat') => {
    // If clicking the same field, toggle order, otherwise set to desc
    const newOrder = field === sortField && sortOrder === 'desc' ? 'asc' : 'desc';
    sortSermons(filteredSermons, field, newOrder);
  };
  
  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    sortSermons(sermons, 'createdat', 'desc');
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
      
      {/* Date filtering */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">Filter Sermons</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="sortBy" className="block text-sm text-gray-600 mb-1">Sort By</label>
            <div className="flex space-x-2">
              <button 
                onClick={() => handleSortChange('createdat')}
                className={`px-3 py-2 rounded-md ${
                  sortField === 'createdat' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Date Created {sortField === 'createdat' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button 
                onClick={() => handleSortChange('date')}
                className={`px-3 py-2 rounded-md ${
                  sortField === 'date' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Recording Date {sortField === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              Clear Filters
            </button>
          </div>
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
      
      {filteredSermons.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-md text-center">
          <p className="text-yellow-700 font-medium">No sermons match your filter criteria</p>
          <button
            onClick={handleClearFilters}
            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedSermons.length === filteredSermons.length && filteredSermons.length > 0}
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
                  <div className="flex items-center cursor-pointer" onClick={() => handleSortChange('date')}>
                    Recording Date
                    {sortField === 'date' && <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center cursor-pointer" onClick={() => handleSortChange('createdat')}>
                    Added On
                    {sortField === 'createdat' && <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                  </div>
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
              {filteredSermons.map((sermon) => (
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
                    {sermon.createdat 
                      ? new Date(sermon.createdat).toLocaleDateString() 
                      : 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${sermon.transcriptionstatus === 'completed' ? 'bg-green-100 text-green-800' : 
                        sermon.transcriptionstatus === 'processing' ? 'bg-yellow-100 text-yellow-800' : 
                        sermon.transcriptionstatus === 'failed' ? 'bg-red-100 text-red-800' : 
                        sermon.transcriptionstatus === 'pending' ? 'bg-blue-100 text-blue-800' :
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
      )}
    </div>
  );
}