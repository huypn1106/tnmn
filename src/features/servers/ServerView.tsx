import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { usePlaybackSync } from '../playback/usePlaybackSync';

import { useAuth } from '../auth/useAuth';
import ServerSettingsModal from './ServerSettingsModal';
import { useServer } from './useServer';

import TrackListPanel from '../playlists/TrackListPanel';
import { usePlaylists } from '../playlists/usePlaylists';
import { migrateQueueToPlaylist } from '../playlists/migrateQueue';
import AddTrackModal from '../queue/AddTrackModal';
import AudioVisualizer from '../playback/AudioVisualizer';

export default function ServerView() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { hasUnread, viewedPlaylistId } = useOutletContext<{ 
    hasUnread: boolean;
    viewedPlaylistId: string | null;
    setViewedPlaylistId: (id: string) => void;
  }>();
  const { user } = useAuth();
  const { server, resolvedId, loading: serverLoading } = useServer(serverId);

  useEffect(() => {
    const isCurrentServer = server && (server.id === serverId || server.slug === serverId);
    if (isCurrentServer && server.slug && serverId !== server.slug) {
      navigate(`/server/${server.slug}`, { replace: true });
    }
  }, [server, serverId, navigate]);

  // Migration logic
  useEffect(() => {
    if (resolvedId && server?.ownerId) {
      migrateQueueToPlaylist(resolvedId, server.ownerId).catch(console.error);
    }
  }, [resolvedId, server?.ownerId]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  const { playlists, loading: playlistsLoading } = usePlaylists(resolvedId || undefined);

  const isDJ = !!user && !!server && server.roles?.[user.uid] === 'dj';
  const isOwner = !!user && !!server && server.ownerId === user.uid;
  
  const { playbackState } = usePlaybackSync(resolvedId || undefined, isDJ, null, true);
  const activePlaylistId = playbackState?.playlistId || server?.activePlaylistId || null;
  const viewedPlaylist = playlists.find(p => p.id === viewedPlaylistId) || playlists.find(p => p.id === activePlaylistId) || playlists[0];

  useEffect(() => {
    if (server?.name) {
      const songPrefix = playbackState?.playing && playbackState?.title 
        ? `${playbackState.title} • ` 
        : '';
      const unreadPrefix = hasUnread ? '(•) ' : '';
      document.title = `${unreadPrefix}${songPrefix}${server.name}`;
    } else {
      document.title = hasUnread ? '(•) Listen Together' : 'Listen Together';
    }
  }, [server?.name, playbackState?.title, playbackState?.playing, hasUnread]);

  const loading = serverLoading || playlistsLoading;

  if (serverLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!resolvedId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,var(--bg-2)_0%,transparent_70%)]">
        <div className="max-w-md space-y-6">
          <h1 className="font-serif text-5xl text-text opacity-10 animate-pulse">Select a room.</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-3">Your circle is waiting for the signal</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-rule p-4 md:p-8">
        <div className="space-y-4 flex-1">
          <div className="space-y-2">
            <h2 className="font-serif text-5xl tracking-tighter leading-none">{server?.name || 'Queue'}</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-3">
              {server?.slug ? `/server/${server.slug}` : 'Session Dynamics'}
            </p>
          </div>
          <AudioVisualizer isPlaying={playbackState?.playing || false} />
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {isDJ && viewedPlaylist && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-accent px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-accent-foreground transition-all hover:bg-accent/90 hover:scale-105 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden md:inline">Add Track</span>
            </button>
          )}
          
          <div className="flex items-center gap-1 border-r border-rule pr-2 md:gap-2 md:pr-4">
            {isOwner && (
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex h-10 w-10 items-center justify-center text-text-3 transition-all hover:bg-bg-3 hover:text-accent"
                title="Server Settings"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
            <div className="relative flex items-center">
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/invite/${server?.inviteToken}`;
                  navigator.clipboard.writeText(url);
                  setShowCopied(true);
                  setTimeout(() => setShowCopied(false), 2000);
                }}
                className="flex h-10 w-10 items-center justify-center text-text-3 transition-all hover:bg-bg-3 hover:text-accent"
                title="Copy Invite Link"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              {showCopied && (
                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 animate-in fade-in slide-in-from-top-1 duration-200 z-50">
                  <div className="whitespace-nowrap bg-accent px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-accent-foreground shadow-xl">
                    Link Copied
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* PlaylistSidebar is now in ServerList (global sidebar) */}
        
        {viewedPlaylist ? (
          <TrackListPanel 
            serverId={resolvedId} 
            playlist={viewedPlaylist} 
            activePlaylistId={activePlaylistId} 
            isDJ={isDJ} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            {loading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            ) : (
              <p className="font-mono text-text-3">Select a playlist to view</p>
            )}
          </div>
        )}
      </div>

      {server && (
        <ServerSettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          server={server} 
        />
      )}

      {resolvedId && viewedPlaylist && (
        <AddTrackModal 
          serverId={resolvedId} 
          playlistId={viewedPlaylist.id}
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)} 
        />
      )}
    </div>
  );
}
