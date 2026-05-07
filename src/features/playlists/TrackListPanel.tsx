import { useTracks } from './usePlaylists';
import { usePlaybackSync } from '../playback/usePlaybackSync';
import WaveformBars from '../playback/WaveformBars';
import { removeTrackFromPlaylist } from './trackActions';
import { useAuth } from '../auth/useAuth';
import { setActivePlaylist, deletePlaylist, clonePlaylist, updatePlaylist } from './playlistActions';
import PlaylistSettingsModal from './PlaylistSettingsModal';
import { useState, useEffect, useRef } from 'react';
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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [trackToRemove, setTrackToRemove] = useState<any>(null);
  const [showDeletePlaylistConfirm, setShowDeletePlaylistConfirm] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  
  const trackRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const isPlayingFromHere = activePlaylistId === playlist.id;

  // Auto-scroll logic
  useEffect(() => {
    if (isPlayingFromHere && playbackState?.trackId) {
      const el = trackRefs.current[playbackState.trackId];
      if (el) {
        // Delay slightly to ensure layout is ready
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [playbackState?.trackId, isPlayingFromHere, tracks.length]);

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
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
      {!isPlayingFromHere && (
        <div className="shrink-0 bg-bg-3 border-b border-rule px-4 py-2 flex items-center justify-between shadow-md z-10">
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

      {playbackState?.trackId && (
        <div className="shrink-0 relative z-20 mx-4 mt-4 md:mx-8 md:mt-6">
          <div className="relative bg-bg/40 backdrop-blur-3xl rounded-none border border-rule/10 shadow-2xl overflow-hidden group animate-in fade-in slide-in-from-top-4 duration-1000 ease-out animate-glow hover:bg-bg/50 transition-colors">
            
            {/* Fancy Animated Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/5 opacity-50 animate-slow-pan" />
            
            {/* Border Beam Effect */}
            <div 
              className="absolute inset-0 rounded-none pointer-events-none"
              style={{
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
                padding: '1px'
              }}
            >
              <div 
                className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0%,var(--accent)_10%,transparent_20%)] animate-[spin_8s_linear_infinite]"
                style={{
                  width: '200%',
                  height: '200%',
                  top: '-50%',
                  left: '-50%'
                }}
              />
            </div>

            <div className="relative p-5 md:px-10 md:py-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(var(--accent-rgb),0.8)]" />
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.5em] text-accent/80">Now Broadcasting</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-px w-32 bg-gradient-to-r from-accent/30 to-transparent" />
                  {isPlayingFromHere && (
                    <span className="font-mono text-[9px] uppercase text-accent tracking-[0.3em] flex items-center gap-2 opacity-60">
                      <span className="h-[2px] w-4 bg-accent/40" />
                      Active
                    </span>
                  )}
                </div>
              </div>
              
              <div 
                className={`relative flex items-center gap-6 md:gap-12
                  ${isDJ ? 'cursor-pointer' : ''}
                `}
                onClick={() => {
                  if (isDJ && playbackState) {
                    update(ref(rtdb, `playback/${serverId}`), {
                      position: 0,
                      playing: true,
                      updatedAt: Date.now(),
                    });
                  }
                }}
              >
                <div className="relative h-24 w-24 md:h-40 md:w-40 shrink-0 group/thumb">
                  {/* Thumbnail Outer Glow */}
                  <div className="absolute -inset-4 bg-accent/10 blur-3xl opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-1000" />
                  
                  <div className="relative h-full w-full bg-bg-3 overflow-hidden rounded-none border border-rule/20 shadow-2xl transition-all duration-700 group-hover/thumb:scale-[1.05] group-hover/thumb:rotate-1 animate-float">
                    <img src={playbackState.thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-1000 group-hover/thumb:scale-110" />
                    <div className="absolute inset-0 flex items-center justify-center bg-bg/30 backdrop-blur-[1px]">
                      <WaveformBars isPlaying={playbackState.playing || false} />
                    </div>
                  </div>
                  
                  {isDJ && (
                    <div className="absolute -bottom-3 -right-3 h-10 w-10 bg-accent text-accent-foreground rounded-none flex items-center justify-center shadow-2xl opacity-0 group-hover/thumb:opacity-100 transition-all scale-75 group-hover/thumb:scale-100">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-serif text-2xl md:text-4xl font-bold tracking-tight text-text leading-none animate-in fade-in slide-in-from-bottom-2 duration-1000">
                      {playbackState.title}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[9px] uppercase px-3 py-1 rounded-none border border-accent/20 text-accent tracking-[0.2em] bg-accent/5 backdrop-blur-md">
                        {playbackState.source}
                      </span>
                    </div>
                    {playbackState.playing && (
                      <div className="flex items-center gap-3 font-mono text-[9px] uppercase text-text-3 tracking-[0.3em]">
                        <div className="flex gap-[2px]">
                          <div className="w-0.5 h-2 bg-accent/60 animate-waveform" />
                          <div className="w-0.5 h-3 bg-accent/80 animate-[waveform_1s_infinite_0.2s]" />
                          <div className="w-0.5 h-2.5 bg-accent animate-[waveform_0.8s_infinite_0.4s]" />
                        </div>
                        Broadcast Live
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Refined Glass Progress Indicator */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-40 animate-shimmer" 
                style={{ width: '100%' }} 
              />
            </div>
          </div>
        </div>
      )}



      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pt-6">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <p className="font-serif text-2xl text-text-3 mb-4 max-w-sm leading-relaxed">This playlist is empty.</p>
            <div className="w-12 h-px bg-rule" />
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((item, index) => {
              const isPlaying = isPlayingFromHere && item.id === playbackState?.trackId;
              return (
                <div 
                  key={item.id} 
                  ref={el => trackRefs.current[item.id] = el}
                  className={`group relative flex items-center gap-4 border p-3 transition-all scroll-mt-12
                    ${isPlaying ? 'border-accent/50 bg-bg-3' : 'border-transparent hover:border-rule'}
                  `}
                >
                  <div className="w-8 shrink-0 flex items-center justify-center">
                    {isDJ ? (
                      <button 
                        onClick={() => playTrack(item)}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all
                          ${isPlaying ? 'bg-accent text-accent-foreground' : 'text-text-3 hover:bg-accent/10 hover:text-accent'}
                        `}
                      >
                        {isPlaying ? (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                      </button>
                    ) : (
                      <span className="font-mono text-[10px] text-text-3">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  <div className="relative aspect-video w-24 bg-bg-3 shrink-0 overflow-hidden">
                    <img src={item.thumbnail} alt="" className={`h-full w-full object-cover transition-all duration-500 group-hover:opacity-100 group-hover:scale-105 ${isPlaying ? 'opacity-100' : 'opacity-80'}`} />
                    {isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-bg/40 backdrop-blur-[2px]">
                        <WaveformBars isPlaying={playbackState?.playing || false} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className={`truncate font-serif text-base transition-colors group-hover:text-text ${isPlaying ? 'text-accent font-bold' : 'text-text-2'}`}>
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
