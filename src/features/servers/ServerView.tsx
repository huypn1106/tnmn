import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../../app/firebase';
import { usePlaybackSync } from '../playback/usePlaybackSync';

import { useAuth } from '../auth/useAuth';
import ServerSettingsModal from './ServerSettingsModal';
import { useServer } from './useServer';

import TrackListPanel from '../playlists/TrackListPanel';
import { usePlaylists } from '../playlists/usePlaylists';
import { migrateQueueToPlaylist } from '../playlists/migrateQueue';
import AddTrackModal from '../queue/AddTrackModal';
import GeneratePlaylistModal from '../llm/GeneratePlaylistModal';
import QuoteDisplay from '../../shared/QuoteDisplay';
import StageVisualizer from '../stage/StageVisualizer';

export default function ServerView() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { hasUnread, viewedPlaylistId } = useOutletContext<{ 
    hasUnread: boolean;
    viewedPlaylistId: string | null;
    setViewedPlaylistId: (id: string) => void;
  }>();
  const { user, profile } = useAuth();
  const { server, resolvedId, loading: serverLoading } = useServer(serverId);

  const [viewMode, setViewMode] = useState<'classic' | 'stage'>(() => {
    return (localStorage.getItem('tnmn_view_mode') as 'classic' | 'stage') || 'classic';
  });

  const [memberProfiles, setMemberProfiles] = useState<Array<{ uid: string; displayName?: string; username?: string; photoURL?: string }>>([]);
  const [presence, setPresence] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!server?.members || server.members.length === 0) {
      setMemberProfiles([]);
      setPresence({});
      return;
    }
    let isCancelled = false;
    Promise.all(
      server.members.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          const data = snap.exists() ? snap.data() : {};
          const uname = data.username || data.displayName || 'user';
          return {
            uid,
            ...data,
            username: uname,
            displayName: uname,
          };
        } catch {
          return { uid, username: 'spirit', displayName: 'spirit' };
        }
      })
    ).then((profiles) => {
      if (!isCancelled) setMemberProfiles(profiles);
    });

    const unsubscribes = server.members.map((uid) => {
      const pRef = ref(rtdb, `presence/${uid}`);
      return onValue(pRef, (snap) => {
        setPresence((prev) => ({ ...prev, [uid]: snap.val() }));
      });
    });

    return () => {
      isCancelled = true;
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [server?.members]);

  // Only real listeners currently in this room
  const activeListeners = useMemo(() => {
    const currentServerIds = new Set([serverId, resolvedId, server?.id, server?.slug].filter(Boolean));

    const online = memberProfiles.filter((member) => {
      if (member.uid === user?.uid) return true;
      const status = presence[member.uid];
      return status?.online && currentServerIds.has(status?.activeServerId);
    });

    // Make sure current user is always included if logged in
    if (user && !online.some((m) => m.uid === user.uid)) {
      const myUsername = profile?.username || user.displayName || 'Bạn';
      online.unshift({
        uid: user.uid,
        displayName: myUsername,
        username: myUsername,
        photoURL: profile?.photoURL || user.photoURL || '',
      });
    }

    return online;
  }, [memberProfiles, presence, user, profile, serverId, resolvedId, server]);

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
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  const { playlists, loading: playlistsLoading } = usePlaylists(resolvedId || undefined);

  const enableAI = import.meta.env.VITE_ENABLE_AI_FEATURE === 'true';

  const isDJ = !!user && !!server && server.roles?.[user.uid] === 'dj';
  const isOwner = !!user && !!server && (server.ownerId === user.uid || !server.ownerId || isDJ || server.members?.[0] === user.uid);

  // Stage Background state with optimistic local cache
  const [localStageBg, setLocalStageBg] = useState<string>(() => {
    return localStorage.getItem(`tnmn_stage_bg_${serverId}`) || 'default';
  });

  useEffect(() => {
    if (server?.stageBackground) {
      setLocalStageBg(server.stageBackground);
      const targetId = resolvedId || server?.id || serverId;
      if (targetId) {
        localStorage.setItem(`tnmn_stage_bg_${targetId}`, server.stageBackground);
      }
    }
  }, [server?.stageBackground, resolvedId, serverId, server?.id]);

  const handleViewModeChange = (mode: 'classic' | 'stage') => {
    setViewMode(mode);
    localStorage.setItem('tnmn_view_mode', mode);
  };

  const handleUpdateStageBackground = async (bg: string) => {
    setLocalStageBg(bg);
    const targetDocId = resolvedId || server?.id || serverId;
    if (targetDocId) {
      try {
        localStorage.setItem(`tnmn_stage_bg_${targetDocId}`, bg);
        await updateDoc(doc(db, 'servers', targetDocId), {
          stageBackground: bg,
        });
      } catch (err) {
        console.error('Failed to update stage background in Firestore:', err);
      }
    }
  };

  // Stage LED Text Customization state with optimistic local cache
  const [localLedText, setLocalLedText] = useState<string>(() => {
    return localStorage.getItem(`tnmn_stage_led_${serverId}`) || '';
  });
  const [localLedMode, setLocalLedMode] = useState<'marquee' | 'static' | 'track'>(() => {
    return (localStorage.getItem(`tnmn_stage_led_mode_${serverId}`) as any) || 'marquee';
  });
  const [localLedSpeed, setLocalLedSpeed] = useState<number>(() => {
    const saved = localStorage.getItem(`tnmn_stage_led_speed_${serverId}`);
    return saved ? Number(saved) : 70;
  });

  useEffect(() => {
    if (server?.ledText !== undefined) {
      setLocalLedText(server.ledText);
      const targetId = resolvedId || server?.id || serverId;
      if (targetId) localStorage.setItem(`tnmn_stage_led_${targetId}`, server.ledText);
    }
    if (server?.ledMode) {
      setLocalLedMode(server.ledMode);
      const targetId = resolvedId || server?.id || serverId;
      if (targetId) localStorage.setItem(`tnmn_stage_led_mode_${targetId}`, server.ledMode);
    }
    if (server?.ledSpeed) {
      setLocalLedSpeed(server.ledSpeed);
      const targetId = resolvedId || server?.id || serverId;
      if (targetId) localStorage.setItem(`tnmn_stage_led_speed_${targetId}`, String(server.ledSpeed));
    }
  }, [server?.ledText, server?.ledMode, server?.ledSpeed, resolvedId, serverId, server?.id]);

  const handleUpdateLedConfig = async (config: { text: string; mode: 'marquee' | 'static' | 'track'; speed: number }) => {
    setLocalLedText(config.text);
    setLocalLedMode(config.mode);
    setLocalLedSpeed(config.speed);
    const targetDocId = resolvedId || server?.id || serverId;
    if (targetDocId) {
      try {
        localStorage.setItem(`tnmn_stage_led_${targetDocId}`, config.text);
        localStorage.setItem(`tnmn_stage_led_mode_${targetDocId}`, config.mode);
        localStorage.setItem(`tnmn_stage_led_speed_${targetDocId}`, String(config.speed));
        await updateDoc(doc(db, 'servers', targetDocId), {
          ledText: config.text,
          ledMode: config.mode,
          ledSpeed: config.speed,
        });
      } catch (err) {
        console.error('Failed to update stage LED config in Firestore:', err);
      }
    }
  };
  
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
          <QuoteDisplay className="mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-rule p-2.5 px-3 md:py-4 md:px-8 short:py-2 gap-2">
        <div className="space-y-0.5 min-w-0 flex-1 sm:w-[200px] md:w-[240px] sm:flex-initial">
          <h2 className="font-serif text-xl sm:text-2xl md:text-3xl short:text-xl tracking-tight leading-tight truncate">
            {server?.name || 'Queue'}
          </h2>
          <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-text-3 truncate">
            {server?.slug ? `/server/${server.slug}` : 'Session Dynamics'}
          </p>
        </div>
        
        <div className="hidden md:flex flex-1 justify-center px-4 max-w-lg">
          <QuoteDisplay className="text-center" />
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0 justify-end">
          {/* Mode Switcher: Classic vs Sân khấu */}
          <div className="flex items-center rounded-xl bg-bg-3 p-0.5 border border-rule">
            <button
              onClick={() => handleViewModeChange('classic')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 font-mono text-[9px] sm:text-[10px] uppercase tracking-wider rounded-lg transition-all ${
                viewMode === 'classic'
                  ? 'bg-accent text-accent-foreground font-bold shadow-sm'
                  : 'text-text-3 hover:text-text'
              }`}
              title="Chế độ Classic (Hàng chờ & Danh sách bài hát)"
            >
              Classic
            </button>
            <button
              onClick={() => handleViewModeChange('stage')}
              className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 font-mono text-[9px] sm:text-[10px] uppercase tracking-wider rounded-lg transition-all ${
                viewMode === 'stage'
                  ? 'bg-accent text-accent-foreground font-bold shadow-sm'
                  : 'text-text-3 hover:text-text'
              }`}
              title="Chế độ Sân khấu (Visualizer 2D)"
            >
              <span>Sân khấu 🎧</span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            </button>
          </div>

          {isDJ && viewedPlaylist && (
            <div className="flex items-center gap-2">
              {enableAI && (
                <button
                  onClick={() => setIsGenerateModalOpen(true)}
                  className="flex items-center gap-2 border border-accent/40 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-accent transition-all hover:bg-accent/10 active:scale-95 relative overflow-hidden group"
                >
                  <span className="relative z-10">✦ Generate</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </button>
              )}
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 bg-accent px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-accent-foreground transition-all hover:bg-accent/90 hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden md:inline">Add Track</span>
              </button>
            </div>
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
        
        {viewMode === 'stage' ? (
          <StageVisualizer
            serverId={resolvedId || serverId}
            serverName={server?.name}
            trackTitle={playbackState?.title}
            isPlaying={playbackState?.playing}
            playbackPosition={playbackState?.position}
            updatedAt={playbackState?.updatedAt}
            roomMembers={activeListeners}
            currentUserName={profile?.username || user?.displayName || 'Bạn'}
            currentUserId={user?.uid}
            isOwner={isOwner}
            stageBackground={server?.stageBackground || localStageBg || 'default'}
            onUpdateBackground={handleUpdateStageBackground}
            ledText={server?.ledText !== undefined ? server.ledText : localLedText}
            ledMode={server?.ledMode || localLedMode || 'marquee'}
            ledSpeed={server?.ledSpeed || localLedSpeed || 70}
            onUpdateLedConfig={handleUpdateLedConfig}
            onSwitchToClassic={() => handleViewModeChange('classic')}
          />
        ) : viewedPlaylist ? (
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

      {resolvedId && viewedPlaylist && (
        <GeneratePlaylistModal
          serverId={resolvedId}
          playlistId={viewedPlaylist.id}
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
        />
      )}
    </div>
  );
}
