import Link from 'next/link';
import { ArrowRight, Upload, MessageSquare, Share2 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto py-16 px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            Sermon Management System
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Streamline your sermon workflow with automated transcription, AI-powered snippet generation,
            and social media integration.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/uploads"
              className="bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-md font-medium hover:bg-blue-50 transition-colors"
            >
              Upload Sermon
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="bg-blue-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-6">
              <Upload className="text-blue-600" size={24} />
            </div>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Upload & Transcribe</h2>
            <p className="text-gray-600 mb-4">
              Upload sermon audio files and automatically generate accurate transcriptions using
              Google Cloud Speech-to-Text.
            </p>
            <Link href="/uploads" className="text-blue-600 font-medium inline-flex items-center">
              Upload a sermon <ArrowRight size={16} className="ml-1" />
            </Link>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="bg-green-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-6">
              <MessageSquare className="text-green-600" size={24} />
            </div>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Generate Snippets</h2>
            <p className="text-gray-600 mb-4">
              AI-powered analysis extracts the most impactful quotes and insights from your sermons,
              perfect for sharing on social media.
            </p>
            <Link href="/dashboard" className="text-blue-600 font-medium inline-flex items-center">
              View snippets <ArrowRight size={16} className="ml-1" />
            </Link>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="bg-purple-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-6">
              <Share2 className="text-purple-600" size={24} />
            </div>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Share & Track</h2>
            <p className="text-gray-600 mb-4">
              Easily approve and schedule posts to multiple social media platforms. Track engagement
              and see what resonates with your audience.
            </p>
            <Link href="/dashboard" className="text-blue-600 font-medium inline-flex items-center">
              Go to dashboard <ArrowRight size={16} className="ml-1" />
            </Link>
          </div>
        </div>

        <div className="bg-blue-50 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4 text-center text-gray-900">How It Works</h2>
          <ol className="max-w-3xl mx-auto space-y-6">
            <li className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-4">
                1
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Upload your sermon audio</h3>
                <p className="text-gray-600">
                  Upload your sermon audio file through our simple interface. We support various
                  audio formats.
                </p>
              </div>
            </li>
            <li className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-4">
                2
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Automatic transcription</h3>
                <p className="text-gray-600">
                  Our system uses Google Cloud Speech-to-Text to create accurate transcriptions of
                  your sermons.
                </p>
              </div>
            </li>
            <li className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-4">
                3
              </div>
              <div>
                <h3 className="font-medium text-gray-900">AI-powered snippet generation</h3>
                <p className="text-gray-600">
                  Our AI analyzes the transcription to extract meaningful, impactful quotes that
                  will resonate on social media.
                </p>
              </div>
            </li>
            <li className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-4">
                4
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Review and approve</h3>
                <p className="text-gray-600">
                  You'll receive an email notification when snippets are ready. Review and approve
                  them in the dashboard.
                </p>
              </div>
            </li>
            <li className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-4">
                5
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Share on social media</h3>
                <p className="text-gray-600">
                  Post approved snippets to multiple social media platforms with a single click, or
                  schedule them for later.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
