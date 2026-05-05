import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ServerList from './ServerList';
import PlayerBar from '../playback/PlayerBar';
import { usePresence } from '../../shared/hooks/usePresence';
import ChatRail from '../chat/ChatRail';
import MembersList from './MembersList';

export default function AppLayout() {
  usePresence();
  const [activeTab, setActiveTab] = useState<'servers' | 'queue' | 'chat'>('queue');

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg text-text selection:bg-accent selection:text-white">
      <div className="flex flex-1 overflow-hidden md:flex-row">
        {/* Sidebar: Servers + Friends */}
        <aside className={`
          ${activeTab === 'servers' ? 'flex' : 'hidden'} 
          fixed inset-0 z-40 bg-bg md:relative md:flex md:h-full md:w-[var(--sidebar-w)] md:shrink-0 md:border-r md:border-rule md:bg-bg-2
        `}>
          <ServerList onCloseMobile={() => setActiveTab('queue')} />
        </aside>

        {/* Main content: Queue + Player */}
        <main className={`
          ${activeTab === 'queue' ? 'flex' : 'hidden md:flex'} 
          relative flex flex-1 flex-col overflow-hidden
        `}>
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>

        {/* Right Rail: Chat + Members */}
        <aside className={`
          ${activeTab === 'chat' ? 'flex' : 'hidden'} 
          fixed inset-0 z-40 flex-col bg-bg md:relative md:border-l md:border-rule md:bg-bg-2 lg:flex lg:w-[var(--rail-w)] lg:shrink-0
        `}>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between p-4 border-b border-rule lg:hidden">
              <h2 className="font-mono text-xs uppercase tracking-widest text-text-3">Chat & Members</h2>
              <button onClick={() => setActiveTab('queue')} className="text-text-3">&times;</button>
            </div>
            <ChatRail />
          </div>
          <div className="shrink-0">
            <MembersList />
          </div>
        </aside>
      </div>

      {/* Now Playing Bar - Persistent */}
      <div className="min-h-[var(--player-h)] md:h-[var(--player-h)] shrink-0 border-t border-rule bg-bg-2 z-30">
        <PlayerBar />
      </div>

      {/* Mobile Tab Bar */}
      <nav className="flex h-16 w-full shrink-0 border-t border-rule bg-bg-2 md:hidden">
        <button 
          onClick={() => setActiveTab('servers')}
          className={`flex flex-1 flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${activeTab === 'servers' ? 'text-accent' : 'text-text-3'}`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>Rooms</span>
        </button>
        <button 
          onClick={() => setActiveTab('queue')}
          className={`flex flex-1 flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${activeTab === 'queue' ? 'text-accent' : 'text-text-3'}`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <span>Queue</span>
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex flex-1 flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${activeTab === 'chat' ? 'text-accent' : 'text-text-3'}`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Chat</span>
        </button>
      </nav>
    </div>
  );
}
