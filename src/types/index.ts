export interface Sermon {
  id: string;
  title: string;
  speaker: string;
  date: string;
  audiourl: string | null;
  transcription?: string;
  transcriptionstatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdat: string;
  updatedat: string;
  audioFileExists?: boolean;  // Indicates if the audio file exists
  transcription_error?: string; // Error message when transcription fails
}

export interface Snippet {
  id: string;
  sermon_id: string;
  content: string;
  platform?: string;
  category?: string;
  format?: string | null;
  timestamp?: number;
  start_time?: number;
  end_time?: number;
  approved: boolean;
  posted: boolean;
  createdat: string;
  updatedat: string;
}

export interface SocialMediaPost {
  id: string;
  snippetId: string;
  platform: 'twitter' | 'facebook' | 'instagram';
  status: 'pending' | 'scheduled' | 'posted' | 'failed';
  scheduledFor?: string;
  postUrl?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EmailNotification {
  id: string;
  sermonId: string;
  recipientEmail: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recording {
  id: string;
  name?: string;
  filename: string;
  size?: number;
  type?: string;
  lastModified?: string;
  uploaded_at: string;
}

// Social media snippet specific types
export interface SocialMediaSnippet {
  content: string;
  format?: string;
  timestamp?: number;
}

export interface SnippetsByCategory {
  [category: string]: SocialMediaSnippet[];
}

export interface SnippetsByPlatform {
  [platform: string]: SnippetsByCategory;
} 