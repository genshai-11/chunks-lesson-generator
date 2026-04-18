import React, { useState } from 'react';
import { logOut, auth } from '../firebase';
import { LogOut, Database, Wand2, ListMusic, Settings as SettingsIcon, Mic, User, PanelLeftClose, PanelLeftOpen, PlayCircle, Blocks } from 'lucide-react';
import ResourcesTab from './ResourcesTab';
import MixerTab from './MixerTab';
import ChunksTab from './ChunksTab';
import PlayerTab from './PlayerTab';
import SettingsTab from './SettingsTab';
import AudioOhmTestTab from './AudioOhmTestTab';

type TabType = 'resources' | 'mixer' | 'chunks' | 'player' | 'audio' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('resources');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabs = [
    { id: 'resources', label: 'Resources', icon: Database },
    { id: 'mixer', label: 'The Mixer', icon: Wand2 },
    { id: 'chunks', label: 'Chunks DB', icon: ListMusic },
    { id: 'player', label: 'Player', icon: PlayCircle },
    { id: 'audio', label: 'Audio Ohm', icon: Mic },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* MOBILE TOP HEADER */}
      <div className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-20">
        <div className="flex items-center">
          <Blocks className="w-6 h-6 text-red-600 mr-2" />
          <span className="text-xl font-black text-red-600 tracking-tighter">chunks</span>
          <span className="ml-2 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">generator</span>
        </div>
        <button
          onClick={logOut}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside 
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 fixed inset-y-0 z-20 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`h-16 flex items-center border-b border-gray-100 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
          {!isCollapsed && (
            <div className="flex items-center overflow-hidden">
              <Blocks className="w-7 h-7 text-red-600 mr-2" />
              <span className="text-2xl font-black text-red-600 tracking-tighter">chunks</span>
              <span className="ml-2 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">gen</span>
            </div>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <Blocks className="w-6 h-6 text-red-600" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className={`flex-1 overflow-y-auto py-6 space-y-2 ${isCollapsed ? 'px-3' : 'px-4'}`}>
          {!isCollapsed && <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Menu</div>}
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={isCollapsed ? tab.label : undefined}
                className={`w-full flex items-center py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  isActive 
                    ? 'bg-red-50 text-red-700 shadow-sm border border-red-100' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-red-600' : 'text-gray-400'} ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span>{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-4' : 'justify-between'}`}>
            <div className="flex items-center overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0" title={auth.currentUser?.email || 'User'}>
                <User className="w-4 h-4" />
              </div>
              {!isCollapsed && (
                <div className="ml-3 truncate">
                  <p className="text-xs font-medium text-gray-900 truncate">{auth.currentUser?.email || 'User'}</p>
                  <p className="text-[10px] text-gray-500">Admin</p>
                </div>
              )}
            </div>
            <button
              onClick={logOut}
              className={`p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ${isCollapsed ? 'w-full flex justify-center' : ''}`}
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16 pb-safe">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-red-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-red-600' : 'text-gray-400'}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out pb-20 md:pb-0 min-h-screen ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
          {activeTab === 'resources' && <ResourcesTab />}
          {activeTab === 'mixer' && <MixerTab />}
          {activeTab === 'chunks' && <ChunksTab />}
          {activeTab === 'player' && <PlayerTab />}
          {activeTab === 'audio' && <AudioOhmTestTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}
