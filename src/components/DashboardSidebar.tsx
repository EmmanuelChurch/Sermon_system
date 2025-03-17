import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DashboardSidebar() {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };
  
  return (
    <div className="w-64 bg-gray-800 text-white h-screen flex flex-col">
      <div className="p-4 flex items-center">
        <h1 className="text-xl font-bold">Sermon Manager</h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto">
        <ul className="p-2">
          <li className="mb-1">
            <Link 
              href="/dashboard" 
              className={`flex items-center px-4 py-2 rounded-md ${
                isActive('/dashboard') && !isActive('/dashboard/sermons') && !isActive('/dashboard/transcription-status') && !isActive('/dashboard/podcast')
                  ? 'bg-gray-700' 
                  : 'hover:bg-gray-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Dashboard
            </Link>
          </li>
          
          <li className="mb-1">
            <Link 
              href="/dashboard/sermons" 
              className={`flex items-center px-4 py-2 rounded-md ${
                isActive('/dashboard/sermons') ? 'bg-gray-700' : 'hover:bg-gray-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Sermons
            </Link>
          </li>
          
          <li className="mb-1">
            <Link 
              href="/dashboard/podcast" 
              className={`flex items-center px-4 py-2 rounded-md ${
                isActive('/dashboard/podcast') ? 'bg-gray-700' : 'hover:bg-gray-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-14a1 1 0 011 1v5.268l4.562-2.634a1 1 0 111 1.732L10 12l-6.562-3.634a1 1 0 111-1.732L10 10.268V5a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Podcast
            </Link>
          </li>
          
          <li className="mb-1">
            <Link 
              href="/dashboard/transcription-status" 
              className={`flex items-center px-4 py-2 rounded-md ${
                isActive('/dashboard/transcription-status') ? 'bg-gray-700' : 'hover:bg-gray-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
              </svg>
              Transcription Status
            </Link>
          </li>
        </ul>
      </nav>
      
      <div className="p-4">
        <Link 
          href="/uploads" 
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Upload Sermon
        </Link>
      </div>
    </div>
  );
} 