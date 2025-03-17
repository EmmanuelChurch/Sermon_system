'use client';

import Link from 'next/link'
import { HomeIcon, BookOpenIcon, MicrophoneIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import { usePathname } from 'next/navigation';

const DashboardNav = () => {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  }

  return (
    <div className="pt-4 space-y-1">
      <Link
        href="/dashboard"
        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${isActive('/dashboard') && !isActive('/dashboard/sermons') && !isActive('/dashboard/recordings') && !isActive('/dashboard/transcription-status') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
      >
        <HomeIcon className="mr-3 h-5 w-5 text-gray-500" />
        Dashboard
      </Link>
      <Link
        href="/dashboard/sermons"
        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${isActive('/dashboard/sermons') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
      >
        <BookOpenIcon className="mr-3 h-5 w-5 text-gray-500" />
        Sermons
      </Link>
      <Link
        href="/dashboard/recordings"
        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${isActive('/dashboard/recordings') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
      >
        <MicrophoneIcon className="mr-3 h-5 w-5 text-gray-500" />
        Recordings
      </Link>
      <Link
        href="/dashboard/transcription-status"
        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${isActive('/dashboard/transcription-status') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
      >
        <ArrowTrendingUpIcon className="mr-3 h-5 w-5 text-gray-500" />
        Transcription Status
      </Link>
    </div>
  )
}

export default DashboardNav 