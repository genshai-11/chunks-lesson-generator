import React, { useState } from 'react';
import { logOut, auth } from '../firebase';
import { LogOut, Database, Wand2, ListMusic, Settings as SettingsIcon } from 'lucide-react';
import ResourcesTab from './ResourcesTab';
import MixerTab from './MixerTab';
import ChunksTab from './ChunksTab';
import SettingsTab from './SettingsTab';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'resources' | 'mixer' | 'chunks' | 'settings'>('resources');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-2xl font-black text-red-600 tracking-tighter">CHUNKS</span>
                <span className="ml-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">v1.0</span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('resources')}
                  className={`${
                    activeTab === 'resources'
                      ? 'border-red-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Resources
                </button>
                <button
                  onClick={() => setActiveTab('mixer')}
                  className={`${
                    activeTab === 'mixer'
                      ? 'border-red-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  The Mixer
                </button>
                <button
                  onClick={() => setActiveTab('chunks')}
                  className={`${
                    activeTab === 'chunks'
                      ? 'border-red-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <ListMusic className="w-4 h-4 mr-2" />
                  Chunks DB
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`${
                    activeTab === 'settings'
                      ? 'border-red-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  AI Settings
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-4 hidden sm:block">
                {auth.currentUser?.email}
              </span>
              <button
                onClick={logOut}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 bg-white hover:text-gray-700 focus:outline-none transition"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === 'resources' && <ResourcesTab />}
        {activeTab === 'mixer' && <MixerTab />}
        {activeTab === 'chunks' && <ChunksTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}
