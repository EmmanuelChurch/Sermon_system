import { ReactNode } from 'react';
import StartupCheck from '@/components/StartupCheck';

export const metadata = {
  title: 'Dashboard | Sermon Management System',
  description: 'Manage sermons, transcriptions, and social media snippets',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <StartupCheck />
      {children}
    </div>
  );
} 