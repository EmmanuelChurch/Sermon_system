import { useState, useEffect } from 'react';
import { Snippet } from '@/types';
import BibleReferenceDisplay from './BibleReferenceDisplay';

interface SnippetApprovalProps {
  snippets: Snippet[];
  sermonTitle: string;
  audioUrl?: string | null;
  onApprove: (snippetId: string, approved: boolean) => Promise<void>;
  onPost: (snippetId: string, platforms: string[]) => Promise<void>;
}

export default function SnippetApproval({
  snippets,
  sermonTitle,
  audioUrl,
  onApprove,
  onPost,
}: SnippetApprovalProps) {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('all');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [biblicalSnippets, setBiblicalSnippets] = useState<Snippet[]>([]);

  // Initialize audio element when audioUrl changes
  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      setAudioElement(audio);
      return () => {
        audio.pause();
      };
    }
  }, [audioUrl]);

  // Detect biblical references in snippets
  useEffect(() => {
    // Simple regex for biblical references (e.g., John 3:16, Genesis 1:1-3)
    const biblicalRegex = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation)\s+\d+:\d+(?:-\d+)?\b/gi;
    
    const bibleSnippets = snippets.filter(snippet => 
      biblicalRegex.test(snippet.content)
    );
    
    setBiblicalSnippets(bibleSnippets);
  }, [snippets]);

  const handleApprove = async (snippetId: string, approved: boolean) => {
    setIsProcessing((prev) => ({ ...prev, [snippetId]: true }));
    setErrors((prev) => ({ ...prev, [snippetId]: '' }));
    
    try {
      await onApprove(snippetId, approved);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [snippetId]: error instanceof Error ? error.message : 'Failed to update approval status',
      }));
    } finally {
      setIsProcessing((prev) => ({ ...prev, [snippetId]: false }));
    }
  };

  const handlePlatformChange = (snippetId: string, platform: string, checked: boolean) => {
    setSelectedPlatforms((prev) => {
      const current = prev[snippetId] || [];
      if (checked) {
        return { ...prev, [snippetId]: [...current, platform] };
      } else {
        return { ...prev, [snippetId]: current.filter((p) => p !== platform) };
      }
    });
  };

  const handlePost = async (snippetId: string) => {
    const platforms = selectedPlatforms[snippetId] || [];
    
    if (platforms.length === 0) {
      setErrors((prev) => ({
        ...prev,
        [snippetId]: 'Please select at least one platform',
      }));
      return;
    }
    
    setIsProcessing((prev) => ({ ...prev, [snippetId]: true }));
    setErrors((prev) => ({ ...prev, [snippetId]: '' }));
    
    try {
      await onPost(snippetId, platforms);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [snippetId]: error instanceof Error ? error.message : 'Failed to post snippet',
      }));
    } finally {
      setIsProcessing((prev) => ({ ...prev, [snippetId]: false }));
    }
  };

  const formatTimestamp = (seconds: number): string => {
    if (!seconds && seconds !== 0) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  const playFromTimestamp = (timestamp: number) => {
    if (audioElement && timestamp >= 0) {
      audioElement.currentTime = timestamp;
      audioElement.play().catch(err => console.error('Error playing audio:', err));
    }
  };

  // Get unique platforms from snippets
  const platforms = ['all', 'bible', ...Array.from(new Set(snippets.map(s => s.platform || 'unspecified')))];
  
  // Filter snippets based on active tab
  const filteredSnippets = activeTab === 'all' 
    ? snippets 
    : activeTab === 'bible'
      ? biblicalSnippets
      : snippets.filter(s => s.platform === activeTab);
  
  // Group snippets by category when a specific platform is selected
  const groupedSnippets = activeTab !== 'all' && activeTab !== 'bible'
    ? filteredSnippets.reduce((acc, snippet) => {
        const category = snippet.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(snippet);
        return acc;
      }, {} as Record<string, Snippet[]>)
    : {};

  // Sort snippets by timestamp if applicable
  if (activeTab === 'all' || activeTab === 'bible') {
    filteredSnippets.sort((a, b) => {
      if (a.timestamp !== undefined && b.timestamp !== undefined) {
        return a.timestamp - b.timestamp;
      }
      return 0;
    });
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">
        Approve Snippets for {'"'}{sermonTitle}{'"'}
      </h2>
      
      {snippets.length === 0 ? (
        <p className="text-gray-600">No snippets available for this sermon.</p>
      ) : (
        <>
          {/* Platform Tabs */}
          <div className="flex space-x-1 mb-6 overflow-x-auto pb-2 bg-gray-50 p-2 rounded-lg">
            {platforms.map(platform => (
              <button
                key={platform}
                onClick={() => setActiveTab(platform)}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                  activeTab === platform 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {platform === 'all' 
                  ? 'All Platforms' 
                  : platform === 'bible'
                    ? `Biblical References (${biblicalSnippets.length})`
                    : platform.charAt(0).toUpperCase() + platform.slice(1)}
                {platform !== 'bible' && (
                  <span className="ml-1 text-xs">
                    ({platform === 'all' 
                      ? snippets.length 
                      : snippets.filter(s => s.platform === platform).length})
                  </span>
                )}
              </button>
            ))}
          </div>
          
          {/* Timeline view */}
          {(activeTab === 'all' || activeTab === 'bible') && filteredSnippets.length > 0 && (
            <div className="mb-8 relative">
              <div className="h-2 bg-gray-200 rounded-full w-full mb-4">
                {/* Timeline markers */}
                {filteredSnippets.map((snippet, index) => {
                  // Find max timestamp to calculate position
                  const maxTimestamp = Math.max(...filteredSnippets.map(s => s.timestamp || 0));
                  const position = ((snippet.timestamp || 0) / (maxTimestamp || 1)) * 100;
                  return (
                    <div
                      key={snippet.id}
                      className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-pointer transform -translate-y-1/2"
                      style={{ left: `${position}%`, top: '50%' }}
                      onClick={() => playFromTimestamp(snippet.timestamp || 0)}
                      title={`${snippet.content.substring(0, 30)}... (${formatTimestamp(snippet.timestamp || 0)})`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>0:00</span>
                <span>{formatTimestamp(Math.max(...filteredSnippets.map(s => s.timestamp || 0)))}</span>
              </div>
            </div>
          )}
          
          {/* Display snippets */}
          <div className="space-y-8">
            {activeTab === 'all' || activeTab === 'bible' ? (
              // All snippets in a single list
              <div className="space-y-6">
                {filteredSnippets.map((snippet) => (
                  <SnippetCard
                    key={snippet.id}
                    snippet={snippet}
                    isProcessing={isProcessing[snippet.id] || false}
                    error={errors[snippet.id] || ''}
                    selectedPlatforms={selectedPlatforms[snippet.id] || []}
                    onApprove={handleApprove}
                    onPost={handlePost}
                    onPlatformChange={handlePlatformChange}
                    formatTimestamp={formatTimestamp}
                    playFromTimestamp={playFromTimestamp}
                    canPlayAudio={!!audioElement}
                  />
                ))}
              </div>
            ) : (
              // Grouped by category for a specific platform
              Object.entries(groupedSnippets).map(([category, categorySnippets]) => (
                <div key={category}>
                  <h3 className="text-xl font-medium mb-4 bg-gray-100 p-2 rounded">
                    {category}
                  </h3>
                  <div className="space-y-6">
                    {categorySnippets.map((snippet) => (
                      <SnippetCard
                        key={snippet.id}
                        snippet={snippet}
                        isProcessing={isProcessing[snippet.id] || false}
                        error={errors[snippet.id] || ''}
                        selectedPlatforms={selectedPlatforms[snippet.id] || []}
                        onApprove={handleApprove}
                        onPost={handlePost}
                        onPlatformChange={handlePlatformChange}
                        formatTimestamp={formatTimestamp}
                        playFromTimestamp={playFromTimestamp}
                        canPlayAudio={!!audioElement}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Extracted SnippetCard component for cleaner code
function SnippetCard({
  snippet,
  isProcessing,
  error,
  selectedPlatforms,
  onApprove,
  onPost,
  onPlatformChange,
  formatTimestamp,
  playFromTimestamp,
  canPlayAudio
}: {
  snippet: Snippet;
  isProcessing: boolean;
  error: string;
  selectedPlatforms: string[];
  onApprove: (id: string, approved: boolean) => Promise<void>;
  onPost: (id: string) => Promise<void>;
  onPlatformChange: (id: string, platform: string, checked: boolean) => void;
  formatTimestamp: (seconds: number) => string;
  playFromTimestamp: (seconds: number) => void;
  canPlayAudio: boolean;
}) {
  // Detect biblical references
  const biblicalRegex = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation)\s+\d+:\d+(?:-\d+)?\b/gi;
  
  // Extract biblical references from content
  const biblicalReferences = snippet.content.match(biblicalRegex);

  return (
    <div
      className={`p-6 border rounded-lg shadow-sm ${
        snippet.approved
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center flex-wrap gap-2">
            {snippet.platform && (
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {snippet.platform}
              </span>
            )}
            {snippet.category && (
              <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                {snippet.category}
              </span>
            )}
            {snippet.timestamp !== undefined && snippet.timestamp !== null && (
              <span 
                className={`inline-flex items-center gap-1 ${
                  canPlayAudio ? 'cursor-pointer hover:bg-gray-200' : ''
                } bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded`}
                onClick={() => canPlayAudio && playFromTimestamp(snippet.timestamp || 0)}
                title={canPlayAudio ? 'Click to play from this timestamp' : ''}
              >
                <svg className="w-10 h-10 text-white bg-blue-500 rounded-full p-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d={'M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z'} clipRule="evenodd" />
                </svg>
                {formatTimestamp(snippet.timestamp)}
              </span>
            )}
          </div>
          <p className="text-lg font-medium mb-2">{'"'}{snippet.content}{'"'}</p>
          <div className="flex flex-wrap text-sm text-gray-600 gap-2">
            {snippet.format && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                Format: {snippet.format}
              </span>
            )}
          </div>
          
          {/* Bible References Display */}
          {biblicalReferences && biblicalReferences.length > 0 && (
            <div className="mt-3 space-y-2">
              {biblicalReferences.map((reference, index) => (
                <BibleReferenceDisplay key={`${snippet.id}-ref-${index}`} reference={reference} />
              ))}
            </div>
          )}
        </div>
        <div className="ml-4 flex items-center">
          {!snippet.approved ? (
            <button
              onClick={() => onApprove(snippet.id, true)}
              disabled={isProcessing}
              className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-green-300"
            >
              {isProcessing ? 'Processing...' : 'Approve'}
            </button>
          ) : (
            <button
              onClick={() => onApprove(snippet.id, false)}
              disabled={isProcessing || snippet.posted}
              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:bg-red-300"
            >
              {isProcessing
                ? 'Processing...'
                : snippet.posted
                ? 'Posted'
                : 'Reject'}
            </button>
          )}
        </div>
      </div>
      
      {snippet.approved && !snippet.posted && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium mb-2">Post to social media:</h3>
          
          <div className="flex flex-wrap gap-4 mb-3">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                onChange={(e) =>
                  onPlatformChange(snippet.id, 'twitter', e.target.checked)
                }
              />
              <span className="ml-2">Twitter</span>
            </label>
            
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                onChange={(e) =>
                  onPlatformChange(snippet.id, 'facebook', e.target.checked)
                }
              />
              <span className="ml-2">Facebook</span>
            </label>
            
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                onChange={(e) =>
                  onPlatformChange(snippet.id, 'instagram', e.target.checked)
                }
              />
              <span className="ml-2">Instagram</span>
            </label>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => onPost(snippet.id)}
              disabled={isProcessing}
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300"
            >
              {isProcessing ? 'Processing...' : 'Post Now'}
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-2 p-2 text-sm text-red-700 bg-red-100 rounded">
          {error}
        </div>
      )}
    </div>
  );
} 