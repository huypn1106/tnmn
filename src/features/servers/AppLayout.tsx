import { Outlet } from 'react-router-dom';
import ServerList from './ServerList';
import PlayerBar from '../playback/PlayerBar';
import { usePresence } from '../../shared/hooks/usePresence';
import ChatRail from '../chat/ChatRail';

export default function AppLayout() {
  usePresence();
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg text-text selection:bg-accent selection:text-white md:flex-row">
      {/* Sidebar: Servers + Friends */}
      <aside className="h-16 w-full shrink-0 border-b border-rule bg-bg-2 md:h-full md:w-[var(--sidebar-w)] md:border-b-0 md:border-r">
        <ServerList />
      </aside>

      {/* Main content: Queue + Player */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
        
        {/* Now Playing Bar */}
        <div className="h-[var(--player-h)] shrink-0 border-t border-rule bg-bg-2">
          <PlayerBar />
        </div>
      </main>

      {/* Right Rail: Chat + Members */}
      <aside className="hidden h-full w-[var(--rail-w)] shrink-0 border-l border-rule bg-bg-2 lg:flex lg:flex-col">
        <ChatRail />
      </aside>

      {/* Mobile Tab Bar placeholder */}
      <nav className="flex h-16 w-full shrink-0 border-t border-rule bg-bg-2 md:hidden">
        <div className="flex flex-1 items-center justify-around font-mono text-[10px] uppercase tracking-widest opacity-40">
          <span>Server</span>
          <span>Queue</span>
          <span>Chat</span>
        </div>
      </nav>
    </div>
  );
}
