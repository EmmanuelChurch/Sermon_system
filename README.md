# Sermon Management System

A comprehensive tool for managing sermon audio, generating transcriptions, creating podcast episodes, and sharing sermon snippets on social media.

## Features

- **Audio Upload**: Upload sermon audio files in various formats
- **Transcription**: Transcribe sermons using AI (OpenAI Whisper)
- **Snippet Generation**: Automatically extract meaningful snippets from sermons
- **Podcast Creation**: Process sermons into podcast episodes with intro/outro
- **RSS Feed**: Built-in podcast RSS feed generation for podcast platforms
- **Biblical Reference Detection**: Automatically detect Bible references in sermons
- **Dashboard**: Comprehensive management dashboard

## Technologies

- Next.js 15 with Turbopack
- React
- TypeScript
- FFmpeg for audio processing
- OpenAI API for transcription
- Local file storage

## Getting Started

### Prerequisites

- Node.js 18+
- FFmpeg installed on your system
- OpenAI API key (for transcription)

### Installation

1. Clone the repository
   ```
   git clone https://github.com/EmmanuelChurch/Sermon_system.git
   cd Sermon_system
   ```

2. Install dependencies
   ```
   npm install
   ```
   
3. Create `.env.local` file with your configuration
   ```
   OPENAI_API_KEY=your-api-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Start the development server
   ```
   npm run dev
   ```

## Deployment

Use the included `deploy.sh` script for easy deployment to Vercel.

## File Structure

- `/src` - Source code
  - `/app` - Next.js App Router components and API routes
  - `/components` - Reusable React components
  - `/lib` - Utility functions and services
  - `/types` - TypeScript type definitions
- `/public` - Static assets
- `/local-storage` - Local storage for sermons and transcriptions

## Notes

Audio files and transcriptions are stored locally and not included in the repository. Make sure to create the necessary directories before running the application:

- `/local-storage/audio`
- `/local-storage/transcriptions`
- `/local-storage/snippets`
- `/Introandoutro` (for podcast intro/outro clips)

## License

This project is developed for Emmanuel Church London.
