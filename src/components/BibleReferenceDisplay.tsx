import React, { useState } from 'react';

interface BibleReferenceDisplayProps {
  reference: string;
}

export default function BibleReferenceDisplay({ reference }: BibleReferenceDisplayProps) {
  const [verseText, setVerseText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchVerseText = async () => {
    if (verseText) {
      // Already fetched, just toggle expanded state
      setExpanded(!expanded);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clean up reference for API use
      const cleanReference = reference.replace(/\s+/g, '+');
      
      // Fetch from Bible API
      const response = await fetch(`https://bible-api.com/${cleanReference}?translation=kjv`);
      
      if (!response.ok) {
        throw new Error(`Error fetching Bible verse: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.text) {
        setVerseText(data.text);
        setExpanded(true);
      } else {
        throw new Error('No verse text found');
      }
    } catch (err) {
      console.error('Error fetching verse:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch verse');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bible-reference">
      <div 
        className={`inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded cursor-pointer hover:bg-amber-200 transition-colors ${expanded ? 'font-semibold' : ''}`}
        onClick={fetchVerseText}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d={'M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z'} />
        </svg>
        {reference}
        {isLoading && (
          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d={'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'} />
          </svg>
        )}
      </div>
      
      {expanded && verseText && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-sm">
          <p className="italic">{verseText}</p>
          <p className="mt-2 text-xs text-right font-medium">— {reference} (KJV)</p>
        </div>
      )}
      
      {error && (
        <div className="mt-1 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
} 