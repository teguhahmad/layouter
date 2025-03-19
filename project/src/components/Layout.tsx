import React from 'react';
import { Settings, BookOpen, FileDown } from 'lucide-react';
import { cn } from '../utils/cn';
import { useEbookStore } from '../store/useEbookStore';
import { Preview } from './Preview';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'settings' | 'chapters';
  onTabChange: (tab: 'settings' | 'chapters') => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          <aside className="w-96">
            <nav className="flex items-center justify-center space-x-2 mb-6">
              <button
                onClick={() => onTabChange('settings')}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2',
                  activeTab === 'settings'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Settings size={16} />
                Settings
              </button>
              <button
                onClick={() => onTabChange('chapters')}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2',
                  activeTab === 'chapters'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <BookOpen size={16} />
                Chapters
              </button>
              <button
                onClick={() => document.getElementById('generate-pdf-btn')?.click()}
                className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-2"
                title="Generate PDF"
              >
                <FileDown size={16} />
                Download
              </button>
            </nav>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {children}
            </div>
          </aside>

          <main className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-8rem)] overflow-auto">
              <Preview />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}