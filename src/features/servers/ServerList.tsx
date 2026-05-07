import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useServers } from './useServers';
import { useAuth } from '../auth/useAuth';
import CreateServerModal from './CreateServerModal';
import { useServer } from './useServer';
import PlaylistSidebar from '../playlists/PlaylistSidebar';
import { usePlaybackSync } from '../playback/usePlaybackSync';

interface ServerListProps {
  onCloseMobile?: () => void;
  viewedPlaylistId: string | null;
  setViewedPlaylistId: (id: string) => void;
}

export default function ServerList({ onCloseMobile, viewedPlaylistId, setViewedPlaylistId }: ServerListProps) {
  const { servers, loading } = useServers();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { serverId: routeId } = useParams<{ serverId: string }>();
  const { server, resolvedId } = useServer(routeId);
  const isDJ = !!user && !!server && server.roles?.[user.uid] === 'dj';
  const { playbackState } = usePlaybackSync(resolvedId || undefined, isDJ, null, true);
  const activePlaylistId = playbackState?.playlistId || server?.activePlaylistId || null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg-2">
      {/* Header */}
      <div className="shrink-0 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-accent">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">Rooms</h2>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group relative flex h-7 w-7 items-center justify-center rounded-full border border-rule bg-bg-3 transition-all hover:border-accent/50 hover:text-accent"
          >
            <svg className="h-4 w-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Server List */}
      <div className="flex-initial overflow-y-auto px-3 custom-scrollbar max-h-[40%]">
        <div className="space-y-1">
          {loading ? (
            <div className="space-y-3 px-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-lg bg-bg-3" />
                  <div className="h-3 w-24 rounded bg-bg-3" />
                </div>
              ))}
            </div>
          ) : (
            servers.map((server) => {
              const isActive = routeId === server.slug || routeId === server.id;
              // Check if this specific server is currently playing
              // Note: we'd need playback state for EACH server to be perfect, 
              // but we can at least show it for the CURRENTLY RESOLVED server.
              const isPlaying = isActive && playbackState?.playing;

              return (
                <NavLink
                  key={server.id}
                  to={`/server/${server.slug || server.id}`}
                  className={`group relative flex items-center gap-3 rounded-xl p-3 transition-all duration-300 ${
                    isActive 
                      ? 'bg-bg-3 text-white shadow-lg shadow-black/10' 
                      : 'text-text-2 hover:bg-bg-3/30 hover:text-text'
                  }`}
                >
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute -left-3 h-8 w-1 rounded-r-full bg-accent" />
                  )}

                  <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border transition-all duration-500 ${
                    isActive ? 'border-accent/40' : 'border-rule grayscale group-hover:grayscale-0'
                  }`}>
                    {server.coverURL ? (
                      <img src={server.coverURL} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-bg-3 font-mono text-xs font-bold uppercase text-text-3">
                        {server.name.charAt(0)}
                      </div>
                    )}
                    
                    {isPlaying && (
                      <div className="absolute inset-0 bg-accent/20 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="flex items-end gap-[2px] h-3">
                          <div className="w-1 bg-white animate-[waveform_1s_ease-in-out_infinite] h-[40%]" />
                          <div className="w-1 bg-white animate-[waveform_1.2s_ease-in-out_infinite_0.2s] h-[80%]" />
                          <div className="w-1 bg-white animate-[waveform_0.9s_ease-in-out_infinite_0.4s] h-[60%]" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate font-sans text-[13px] font-medium tracking-wide transition-colors ${
                      isActive ? 'text-white' : 'text-text-2 group-hover:text-text'
                    }`}>
                      {server.name}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-text-3 opacity-60">
                      {isActive ? 'Current' : 'Joined'}
                    </span>
                  </div>

                  {/* Subtle Arrow on Hover */}
                  {!isActive && (
                    <div className="opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">
                      <svg className="h-3 w-3 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </NavLink>
              );
            })
          )}
        </div>
      </div>


      {/* Playlists Section (Replaces Friends) */}
      {resolvedId && (
        <div className="mt-8 border-t border-rule flex-1 flex flex-col min-h-0 -mx-4">
          <PlaylistSidebar 
            serverId={resolvedId}
            activePlaylistId={activePlaylistId}
            viewedPlaylistId={viewedPlaylistId}
            setViewedPlaylistId={setViewedPlaylistId}
            isDJ={isDJ}
          />
        </div>
      )}

      <div className="mt-auto p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-bg-3/30 p-3 ring-1 ring-rule transition-all hover:bg-bg-3/50">
           <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-rule bg-bg-3">
             {user?.photoURL ? (
               <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
             ) : (
               <div className="flex h-full w-full items-center justify-center bg-accent/10 text-accent font-bold uppercase">
                 {user?.displayName?.charAt(0) || 'U'}
               </div>
             )}
           </div>
           <div className="flex min-w-0 flex-1 flex-col">
             <span className="truncate font-sans text-[13px] font-bold text-text transition-colors group-hover:text-white">
               {user?.displayName || 'Guest User'}
             </span>
             <div className="flex items-center gap-1.5">
               <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
               <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-accent/80">Live</span>
             </div>
           </div>
           <button 
             onClick={() => {/* Sign out logic if needed */}}
             className="text-text-3 hover:text-white transition-colors"
           >
             <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
           </button>
        </div>
      </div>

      <CreateServerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
