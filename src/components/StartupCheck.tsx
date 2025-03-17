'use client';

import { useEffect, useState } from 'react';

export default function StartupCheck() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  
  useEffect(() => {
    const runStartupChecks = async () => {
      if (status !== 'idle') return;
      
      setStatus('loading');
      try {
        const response = await fetch('/api/startup');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to run startup checks');
        }
        
        const data = await response.json();
        console.log('Startup checks completed:', data);
        setStatus('success');
        setMessage(data.message);
      } catch (err) {
        console.error('Error running startup checks:', err);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    runStartupChecks();
  }, [status]);
  
  // This component doesn't render anything visible
  return null;
} 