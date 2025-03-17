'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PodcastManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sermons, setSermons] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    const url = window.location.origin + '/api/podcast-feed';
    setFeedUrl(url);
    
    fetchSermons();
  }, []);

  const fetchSermons = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sermons');
      
      if (!response.ok) {
        throw new Error('Failed to fetch sermons');
      }
      
      const data = await response.json();
      const sermonsData = Array.isArray(data) ? data : (data.sermons || []);
      
      // Sort by date, newest first
      sermonsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setSermons(sermonsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching sermons:', err);
      setError('Failed to load sermons. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(feedUrl)
      .then(() => {
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        setCopySuccess('Failed to copy');
      });
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Podcast Management</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Podcast RSS Feed</h2>
        
        <div className="mb-4">
          <p className="mb-2">Your podcast RSS feed URL:</p>
          <div className="flex items-center">
            <input
              type="text"
              value={feedUrl}
              readOnly
              className="flex-grow p-2 border border-gray-300 rounded-l-md bg-gray-50"
            />
            <button
              onClick={copyToClipboard}
              className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600"
            >
              {copySuccess ? copySuccess : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Use this URL to submit your podcast to platforms like Spotify, Apple Podcasts, etc.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <a
            href="https://podcasters.spotify.com/submit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center p-4 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Submit to Spotify
          </a>
          
          <a
            href="https://podcastsconnect.apple.com/my-podcasts"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center p-4 bg-purple-500 text-white rounded-md hover:bg-purple-600"
          >
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.707 19.293a1 1 0 11-1.414 1.414L.293 14.707a1 1 0 010-1.414l6-6a1 1 0 111.414 1.414L2.414 14l5.293 5.293zm8.586-11.586a1 1 0 111.414-1.414l6 6a1 1 0 010 1.414l-6 6a1 1 0 11-1.414-1.414L21.586 14l-5.293-5.293z"/>
            </svg>
            Submit to Apple Podcasts
          </a>
        </div>
        
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-semibold mb-2">RSS Feed Preview</h3>
          <p>
            <a
              href={feedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View your RSS feed
            </a>
            {' | '}
            <a
              href="https://validator.w3.org/feed/check.cgi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Validate your feed
            </a>
          </p>
        </div>
        
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h3 className="font-semibold mb-2">Requirements for Podcast Platforms</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Make sure your podcast RSS feed validates correctly</li>
            <li>Create a square cover image (3000x3000px recommended) and add it in the public folder</li>
            <li>Ensure consistent audio quality for all episodes</li>
            <li>Description, author info, and categories should be complete</li>
          </ul>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Podcast Episodes</h2>
          
          <div className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
            <button 
              onClick={fetchSermons}
              className="ml-2 p-1 bg-gray-100 hover:bg-gray-200 rounded"
              aria-label="Refresh"
            >
              🔄
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center my-10">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-4 border-b text-left">Title</th>
                  <th className="py-2 px-4 border-b text-left">Speaker</th>
                  <th className="py-2 px-4 border-b text-left">Date</th>
                  <th className="py-2 px-4 border-b text-left">Podcast Status</th>
                  <th className="py-2 px-4 border-b text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sermons.map((sermon) => (
                  <tr key={sermon.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">{sermon.title}</td>
                    <td className="py-2 px-4 border-b">{sermon.speaker}</td>
                    <td className="py-2 px-4 border-b">
                      {new Date(sermon.date).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {sermon.podcastUrl ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                          Ready
                        </span>
                      ) : sermon.audiourl ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                          Audio Only
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                          No Audio
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 border-b">
                      <Link
                        href={`/dashboard/sermons/${sermon.id}`}
                        className="text-blue-500 hover:underline mr-3"
                      >
                        View
                      </Link>
                      {sermon.audiourl && !sermon.podcastUrl && (
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/sermons/${sermon.id}/process-podcast`, {
                                method: 'POST',
                              });
                              
                              if (response.ok) {
                                alert('Podcast processing started. This may take a few minutes.');
                                // Refresh after a delay
                                setTimeout(() => fetchSermons(), 5000);
                              } else {
                                const data = await response.json();
                                alert(`Error: ${data.error || 'Failed to process podcast'}`);
                              }
                            } catch (error) {
                              console.error('Error processing podcast:', error);
                              alert('Failed to process podcast');
                            }
                          }}
                          className="text-green-500 hover:underline"
                        >
                          Create Podcast
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                
                {sermons.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      No sermons found. Upload sermons to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 