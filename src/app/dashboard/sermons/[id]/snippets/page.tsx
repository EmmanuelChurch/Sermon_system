'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SnippetApproval from '@/components/SnippetApproval';
import { Sermon, Snippet } from '@/types';

export default function SermonSnippetsPage() {
  const params = useParams();
  const sermonId = params.id as string;
  
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch sermon details
        const sermonResponse = await fetch(`/api/sermons/${sermonId}`);
        if (!sermonResponse.ok) {
          throw new Error('Failed to fetch sermon details');
        }
        const sermonData = await sermonResponse.json();
        setSermon(sermonData);
        
        // Fetch snippets
        await fetchSnippets();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [sermonId]);

  const fetchSnippets = async () => {
    try {
      const snippetsResponse = await fetch(`/api/sermons/${sermonId}/snippets`);
      if (!snippetsResponse.ok) {
        throw new Error('Failed to fetch snippets');
      }
      const snippetsData = await snippetsResponse.json();
      setSnippets(snippetsData.snippets || []);
      return snippetsData.snippets || [];
    } catch (err) {
      console.error('Error fetching snippets:', err);
      throw err;
    }
  };

  const handleGenerateSnippets = async () => {
    if (!sermon?.transcription) {
      setError('This sermon has no transcription to generate snippets from.');
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationMessage('Generating snippets from transcription...');
      setError(null);

      const response = await fetch(`/api/sermons/${sermonId}/generate-snippets`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate snippets');
      }

      const result = await response.json();
      setGenerationMessage(`Successfully generated ${result.count} snippets across ${result.platforms?.length || 0} platforms!`);
      
      // Refresh the snippets list
      await fetchSnippets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate snippets');
      setGenerationMessage(null);
    } finally {
      setIsGenerating(false);
      // Clear success message after 5 seconds
      if (!error) {
        setTimeout(() => {
          setGenerationMessage(null);
        }, 5000);
      }
    }
  };

  const handleApproveSnippet = async (snippetId: string, approved: boolean) => {
    try {
      const response = await fetch('/api/snippets/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snippetId, approved }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update approval status');
      }
      
      // Update the local state
      setSnippets((prevSnippets) =>
        prevSnippets.map((snippet) =>
          snippet.id === snippetId
            ? { ...snippet, approved }
            : snippet
        )
      );
    } catch (error) {
      throw error;
    }
  };

  const handlePostSnippet = async (snippetId: string, platforms: string[]) => {
    try {
      const response = await fetch('/api/social/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snippetId, platforms }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post snippet');
      }
      
      // Update the local state
      setSnippets((prevSnippets) =>
        prevSnippets.map((snippet) =>
          snippet.id === snippetId
            ? { ...snippet, posted: true }
            : snippet
        )
      );
    } catch (error) {
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4 text-center">
        <p>Loading snippets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
        <Link href="/dashboard" className="text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!sermon) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p>Sermon not found</p>
        </div>
        <Link href="/dashboard" className="text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6 flex justify-between items-center flex-wrap">
        <Link href={`/dashboard/sermons/${sermonId}`} className="text-blue-500 hover:underline mb-4 md:mb-0">
          &larr; Back to Sermon Details
        </Link>
        
        <div className="flex space-x-4">
          {sermon.transcription && (
            <button
              onClick={handleGenerateSnippets}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-md ${
                isGenerating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-500 hover:bg-green-600'
              } text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>Generate Snippets</>
              )}
            </button>
          )}
        </div>
      </div>
      
      {generationMessage && (
        <div className={`mb-6 p-4 rounded-md ${error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          <p className="font-medium">{generationMessage}</p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Snippets for "{sermon.title}"</h1>
        <p className="text-gray-600">
          by {sermon.speaker} ({new Date(sermon.date).toLocaleDateString()})
        </p>
      </div>
      
      {snippets.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center">
          <h2 className="text-xl font-medium mb-4">No snippets available</h2>
          {sermon.transcription ? (
            <p className="mb-4">This sermon has a transcription but no snippets have been generated yet.</p>
          ) : (
            <p className="mb-4">This sermon needs to be transcribed before snippets can be generated.</p>
          )}
          
          {sermon.transcription && (
            <button
              onClick={handleGenerateSnippets}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-md ${
                isGenerating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-500 hover:bg-green-600'
              } text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50`}
            >
              {isGenerating ? 'Generating...' : 'Generate Snippets Now'}
            </button>
          )}
        </div>
      ) : (
        <SnippetApproval
          snippets={snippets}
          sermonTitle={sermon.title}
          audioUrl={sermon.audiourl}
          onApprove={handleApproveSnippet}
          onPost={handlePostSnippet}
        />
      )}
    </div>
  );
} 