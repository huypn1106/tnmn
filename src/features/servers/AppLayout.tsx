import { useState, useRef, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import ServerList from './ServerList';
import PlayerBar from '../playback/PlayerBar';
import { usePresence } from '../../shared/hooks/usePresence';
import ChatRail from '../chat/ChatRail';
import MembersList from './MembersList';
import { playBip } from '../../shared/utils/sound';

const DEFAULT_CHAT_WIDTH = 280;
const MIN_CHAT_WIDTH = 240;
const MAX_CHAT_WIDTH = 700;

export default function AppLayout() {
  usePresence();
  const [activeTab, setActiveTab] = useState<'servers' | 'queue' | 'chat'>('queue');
  const [hasUnread, setHasUnread] = useState(false);
  const [viewedPlaylistId, setViewedPlaylistId] = useState<string | null>(null);

  // Resizable Chat Rail state with localStorage persistence
  const [chatWidth, setChatWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tnmn_chat_rail_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_CHAT_WIDTH && parsed <= MAX_CHAT_WIDTH) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return DEFAULT_CHAT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const chatWidthRef = useRef(chatWidth);
  chatWidthRef.current = chatWidth;

  // Pointer drag listener for smooth resizing across the whole screen
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = Math.min(MAX_CHAT_WIDTH, Math.floor(window.innerWidth * 0.6));
      const clamped = Math.max(MIN_CHAT_WIDTH, Math.min(maxWidth, newWidth));
      setChatWidth(clamped);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem('tnmn_chat_rail_width', chatWidthRef.current.toString());
      } catch (e) {
        console.warn(e);
      }
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleResetWidth = () => {
    setChatWidth(DEFAULT_CHAT_WIDTH);
    try {
      localStorage.setItem('tnmn_chat_rail_width', DEFAULT_CHAT_WIDTH.toString());
    } catch (e) {
      console.warn(e);
    }
  };

  const handleNewMessage = () => {
    if (activeTab !== 'chat') {
      setHasUnread(true);
    }
    
    // Play sound if not on chat tab OR if window is in background, and notifications are not muted
    const isMuted = localStorage.getItem('tnmn_mute_notifications') === 'true';
    if (!isMuted && (activeTab !== 'chat' || document.hidden)) {
      playBip();
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg text-text selection:bg-accent selection:text-white">
      <div className="relative flex flex-1 overflow-hidden md:flex-row">
        {/* Sidebar: Servers + Friends */}
        <aside className={`
          ${activeTab === 'servers' ? 'flex' : 'hidden'} 
          absolute inset-0 z-40 bg-bg md:relative md:flex md:h-full md:w-[var(--sidebar-w)] md:shrink-0 md:border-r md:border-rule md:bg-bg-2
        `}>
          <ServerList 
            onCloseMobile={() => setActiveTab('queue')} 
            viewedPlaylistId={viewedPlaylistId}
            setViewedPlaylistId={setViewedPlaylistId}
          />
        </aside>

        {/* Main content: Queue + Player */}
        <main className={`
          ${activeTab === 'queue' ? 'flex' : 'hidden md:flex'} 
          relative flex flex-1 flex-col overflow-hidden
        `}>
          <div className="flex-1 overflow-y-auto">
            <Outlet context={{ hasUnread, viewedPlaylistId, setViewedPlaylistId }} />
          </div>
        </main>

        {/* Right Rail: Chat + Members */}
        <aside 
          onMouseEnter={() => setHasUnread(false)}
          style={{ '--rail-w': `${chatWidth}px` } as React.CSSProperties}
          className={`
          ${activeTab === 'chat' ? 'flex' : 'hidden'} 
          absolute inset-0 z-40 flex-col bg-bg md:relative md:border-l md:border-rule md:bg-bg-2 lg:flex lg:w-[var(--rail-w)] lg:shrink-0 ${
            isDragging ? 'select-none transition-none' : ''
          }
        `}>
          {/* Resize Handle - visible on desktop (lg:) */}
          <div
            onPointerDown={handlePointerDown}
            onDoubleClick={handleResetWidth}
            className={`hidden lg:flex absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-50 items-center justify-center select-none group touch-none ${
              isDragging ? 'bg-accent/20' : 'hover:bg-accent/10'
            }`}
            title="Kéo để chỉnh kích thước khung chat (Nhấp đúp để đặt lại mặc định 280px)"
          >
            {/* Visual indicator bar */}
            <div 
              className={`w-[2px] h-10 rounded-full transition-all duration-150 ${
                isDragging ? 'bg-accent h-16' : 'bg-rule group-hover:bg-accent/80'
              }`}
            />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-rule lg:hidden">
              <h2 className="font-mono text-xs uppercase tracking-widest text-text-3">Chat & Members</h2>
              <button onClick={() => setActiveTab('queue')} className="text-text-3">&times;</button>
            </div>
            <ChatRail onNewMessage={handleNewMessage} />
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
          onClick={() => {
            setActiveTab('chat');
            setHasUnread(false);
          }}
          className={`relative flex flex-1 flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${activeTab === 'chat' ? 'text-accent' : 'text-text-3'}`}
        >
          {hasUnread && (
            <span className="absolute top-3 right-1/2 translate-x-4 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
          )}
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Chat</span>
        </button>
      </nav>
    </div>
  );
}
