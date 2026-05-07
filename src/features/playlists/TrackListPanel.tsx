import { useTracks } from './usePlaylists';
import { usePlaybackSync } from '../playback/usePlaybackSync';
import WaveformBars from '../playback/WaveformBars';
import { removeTrackFromPlaylist } from './trackActions';
import { useAuth } from '../auth/useAuth';
import { setActivePlaylist, deletePlaylist, clonePlaylist, updatePlaylist } from './playlistActions';
import PlaylistSettingsModal from './PlaylistSettingsModal';
import { useState } from 'react';
import { rtdb } from '../../app/firebase';
import { ref, update } from 'firebase/database';
import { useOutletContext } from 'react-router-dom';
import type { Playlist } from './types';
import ConfirmModal from '../../shared/ConfirmModal';

export default function TrackListPanel({ 
  serverId, 
  playlist, 
  activePlaylistId,
  isDJ 
}: { 
  serverId: string; 
  playlist: Playlist;
  activePlaylistId: string | null;
  isDJ: boolean;
}) {
  const { user } = useAuth();
  const { setViewedPlaylistId } = useOutletContext<{ setViewedPlaylistId: (id: string) => void }>();
  const { tracks, loading } = useTracks(serverId, playlist.id);
  const { playbackState } = usePlaybackSync(serverId, isDJ, null, true);

  const [showMenu, setShowMenu] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [trackToRemove, setTrackToRemove] = useState<any>(null);
  const [showDeletePlaylistConfirm, setShowDeletePlaylistConfirm] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const isPlayingFromHere = activePlaylistId === playlist.id;

  const playTrack = async (item: any) => {
    if (!isDJ || !user) return;
    
    // If starting a new playlist, set it as active first
    if (!isPlayingFromHere) {
      await setActivePlaylist(serverId, playlist.id);
    }
    
    update(ref(rtdb, `playback/${serverId}`), {
      playlistId: playlist.id,
      trackId: item.id,
      source: item.source,
      sourceId: item.sourceId,
      title: item.title,
      thumbnail: item.thumbnail,
      position: 0,
      playing: true,
      updatedAt: Date.now(),
      djId: user.uid
    });
  };

  const handleSwitchToPlaylist = async () => {
    if (!isDJ || !tracks.length) return;
    playTrack(tracks[0]);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 animate-pulse space-y-4">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 w-full bg-bg-3 opacity-50" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar relative">
      {!isPlayingFromHere && (
        <div className="sticky top-0 z-10 bg-bg-3 border-b border-rule px-4 py-2 flex items-center justify-between shadow-md">
          <span className="font-mono text-[11px] text-text-3">Not playing from this playlist</span>
          {isDJ && (
            <button 
              onClick={handleSwitchToPlaylist}
              className="font-mono text-[11px] text-accent hover:text-text transition-colors uppercase tracking-widest"
            >
              Switch to this playlist
            </button>
          )}
        </div>
      )}

      <div className="p-4 md:p-8 space-y-8">
        <div className="flex items-start justify-between space-x-4">
          <div className="space-y-1">
            <h2 className="font-serif text-3xl italic tracking-tight">{playlist.name}</h2>
            {playlist.description && (
              <p className="font-mono text-[11px] text-text-3">{playlist.description}</p>
            )}
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-3 mt-2">
              {playlist.trackCount} tracks
            </p>
          </div>

          <div className="relative shrink-0">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="w-10 h-10 flex items-center justify-center text-text-3 hover:text-text hover:bg-bg-3 border border-transparent hover:border-rule transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-bg-2 border border-rule shadow-2xl z-50 flex flex-col py-1">
                  <button 
                    onClick={() => {
                      setShowMenu(false);
                      setIsSettingsOpen(true);
                    }}
                    className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest hover:bg-bg-3 hover:text-accent transition-colors"
                  >
                    Edit Settings
                  </button>
                  <button 
                    onClick={async () => {
                      setShowMenu(false);
                      const text = tracks.map(t => `${t.title} (${t.source})`).join('\n');
                      navigator.clipboard.writeText(text);
                      setCopyStatus('Copied!');
                      setTimeout(() => setCopyStatus(null), 2000);
                    }}
                    className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest hover:bg-bg-3 hover:text-accent transition-colors flex items-center justify-between"
                  >
                    Export (Copy)
                    {copyStatus && <span className="text-[8px] text-accent animate-pulse">{copyStatus}</span>}
                  </button>
                  <button 
                    onClick={async () => {
                      setShowMenu(false);
                      if (!user) return;
                      try {
                        const newId = await clonePlaylist(serverId, playlist.id, user.uid);
                        setViewedPlaylistId(newId);
                      } catch (error: any) {
                        setCopyStatus('Clone Failed');
                        setTimeout(() => setCopyStatus(null), 3000);
                      }
                    }}
                    className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest hover:bg-bg-3 hover:text-accent transition-colors"
                  >
                    Clone Playlist
                  </button>
                  <div className="h-px bg-rule my-1" />
                  <button 
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeletePlaylistConfirm(true);
                    }}
                    className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    Delete Playlist
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <p className="font-serif text-2xl italic text-text-3 mb-4 max-w-sm leading-relaxed">This playlist is empty.</p>
            <div className="w-12 h-px bg-rule" />
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((item, index) => {
              const isPlaying = isPlayingFromHere && item.id === playbackState?.trackId;
              return (
                <div 
                  key={item.id} 
                  onClick={() => playTrack(item)}
                  className={`group relative flex items-center gap-4 border p-3 transition-all
                    ${isPlaying ? 'border-accent/50 bg-bg-3' : 'border-transparent hover:border-rule'}
                    ${isDJ ? 'cursor-pointer hover:bg-bg-3' : 'cursor-default'}
                  `}
                >
                  <span className="w-6 text-center font-mono text-[10px] text-text-3 group-hover:text-text">
                    {index + 1}
                  </span>

                  <div className="relative aspect-video w-24 bg-bg-3 shrink-0 overflow-hidden">
                    <img src={item.thumbnail} alt="" className={`h-full w-full object-cover transition-all duration-500 group-hover:opacity-100 group-hover:scale-105 ${isPlaying ? 'opacity-100' : 'opacity-80'}`} />
                    {isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-bg/40 backdrop-blur-[2px]">
                        <WaveformBars isPlaying={playbackState?.playing || false} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className={`truncate font-serif text-base italic transition-colors group-hover:text-text ${isPlaying ? 'text-accent' : 'text-text-2'}`}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono text-[9px] uppercase text-text-3">{item.source}</p>
                      {isPlaying && <span className="font-mono text-[9px] uppercase text-accent tracking-widest">• Playing</span>}
                    </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrackToRemove(item);
                    }}
                    className="mr-4 h-8 w-8 flex items-center justify-center text-text-3 opacity-0 transition-all hover:text-accent group-hover:opacity-100"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isSettingsOpen && (
        <PlaylistSettingsModal 
          serverId={serverId}
          playlist={playlist}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {trackToRemove && (
        <ConfirmModal
          title="Remove Track"
          message={`Remove "${trackToRemove.title}" from this playlist?`}
          onConfirm={() => {
            removeTrackFromPlaylist(serverId, playlist.id, trackToRemove.id, trackToRemove.duration);
            setTrackToRemove(null);
          }}
          onCancel={() => setTrackToRemove(null)}
          confirmText="Remove"
          variant="danger"
        />
      )}

      {showDeletePlaylistConfirm && (
        <ConfirmModal
          title="Delete Playlist"
          message={`Are you sure you want to delete "${playlist.name}"? This removes all ${playlist.trackCount} tracks.`}
          onConfirm={() => {
            deletePlaylist(serverId, playlist.id);
            setShowDeletePlaylistConfirm(false);
          }}
          onCancel={() => setShowDeletePlaylistConfirm(false)}
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}
