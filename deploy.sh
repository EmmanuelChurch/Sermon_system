#!/bin/bash

# Production deployment script for the sermon system
# This script prepares and deploys the application to Vercel

# Stop on errors
set -e

echo "🚀 Starting sermon system deployment..."

# Check if Git is initialized
if [ ! -d ".git" ]; then
  echo "Initializing Git repository..."
  git init
  git add .
  git commit -m "Initial commit"
fi

# Make sure we have the latest code
if [ -n "$(git remote)" ]; then
  echo "Pulling latest changes..."
  git pull
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building project..."
npm run build

# Ensure we have the Vercel CLI
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel
fi

# Check if we need to create podcast cover image
if [ ! -f "public/podcast-cover.jpg" ]; then
  echo "⚠️ Warning: public/podcast-cover.jpg is missing!"
  echo "   You should add a podcast cover image (3000x3000px recommended)"
  echo "   This is required for most podcast platforms."
fi

# Create the Introdandoutro directory if it doesn't exist
if [ ! -d "Introandoutro" ]; then
  echo "Creating Introandoutro directory..."
  mkdir -p "Introandoutro"
  echo "⚠️ Note: You need to add intro and outro files to the Introandoutro directory"
fi

# Create local storage directories
echo "Creating local storage directories..."
mkdir -p local-storage/audio local-storage/transcriptions local-storage/podcast local-storage/snippets temp

# Prompt about environment variables
echo ""
echo "⚠️ Make sure you've set these environment variables in Vercel:"
echo "- OPENAI_API_KEY: Required for transcription"
echo "- NEXT_PUBLIC_BASE_URL: Your production URL"
echo ""

# Ask if ready to deploy
read -p "Ready to deploy to Vercel? (y/n) " choice
if [[ "$choice" =~ ^[Yy]$ ]]; then
  echo "Deploying to Vercel..."
  npx vercel --prod
  echo "✅ Deployment complete!"
else
  echo "Deployment canceled. You can deploy manually with 'npx vercel --prod'"
fi

echo ""
echo "📋 Post-deployment checklist:"
echo "1. Verify the RSS feed works at /api/podcast-feed"
echo "2. Validate the feed at https://validator.w3.org/feed/"
echo "3. Upload your podcast cover image if you haven't yet"
echo "4. Submit your RSS feed to podcast platforms"
echo ""
echo "🎉 All done!" 