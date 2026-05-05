import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import YouTubePlayer from './YouTubePlayer';
import type { PlayerHandle } from './YouTubePlayer';
import SoundCloudPlayer from './SoundCloudPlayer';
import { usePlaybackSync } from './usePlaybackSync';
import { useColorThief } from '../../shared/hooks/useColorThief';
import WaveformBars from './WaveformBars';
import { useQueue } from '../queue/useQueue';
import { useServer } from '../servers/useServer';

export default function PlayerBar() {
  const { serverId } = useParams<{ serverId: string }>();
  const { user } = useAuth();
  const { server, resolvedId } = useServer(serverId);
  const [player, setPlayer] = useState<PlayerHandle | null>(null);
  const [localTime, setLocalTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('tnmn_muted') === 'true';
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('tnmn_volume');
    return saved !== null ? parseInt(saved, 10) : 100;
  });
  
  const [hasInteracted, setHasInteracted] = useState(() => {
    // Check if user has already interacted with the document
    return (navigator as any).userActivation?.hasBeenActive || false;
  });
  const isDJ = !!user && !!server && server.roles?.[user.uid] === 'dj';
  const { queue } = useQueue(resolvedId || undefined);
  const { playbackState, emitPlayback } = usePlaybackSync(resolvedId || undefined, isDJ, player, hasInteracted);

  useEffect(() => {
    const handleInteraction = () => setHasInteracted(true);
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Dynamic Accent
  useColorThief((playbackState as any)?.thumbnail);

  const handleTrackEnd = useCallback(() => {
    if (!isDJ || !playbackState || queue.length === 0) return;

    if (playbackState.loop === 'one') {
      player?.seekTo(0);
      emitPlayback({ position: 0, playing: true });
      return;
    }

    let nextIndex = -1;
    const currentIndex = queue.findIndex(item => item.id === playbackState.trackId);

    if (playbackState.shuffle) {
      // Simple shuffle: pick a random index that isn't the current one (if possible)
      if (queue.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === currentIndex);
      } else {
        nextIndex = 0;
      }
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (playbackState.loop === 'all') {
          nextIndex = 0;
        } else {
          nextIndex = -1;
        }
      }
    }

    if (nextIndex !== -1) {
      const nextTrack = queue[nextIndex];
      emitPlayback({
        trackId: nextTrack.id,
        source: nextTrack.source,
        sourceId: nextTrack.sourceId,
        thumbnail: nextTrack.thumbnail,
        title: nextTrack.title,
        position: 0,
        playing: true,
      });
    } else {
      emitPlayback({ playing: false });
    }
  }, [isDJ, playbackState, queue, emitPlayback, player]);

  const handlePrevTrack = useCallback(() => {
    if (!isDJ || !playbackState || queue.length === 0) return;

    const currentIndex = queue.findIndex(item => item.id === playbackState.trackId);
    let prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      if (playbackState.loop === 'all') {
        prevIndex = queue.length - 1;
      } else {
        prevIndex = 0; // Just restart current track if no prev
      }
    }

    const prevTrack = queue[prevIndex];
    emitPlayback({
      trackId: prevTrack.id,
      source: prevTrack.source,
      sourceId: prevTrack.sourceId,
      thumbnail: prevTrack.thumbnail,
      title: prevTrack.title,
      position: 0,
      playing: true,
    });
  }, [isDJ, playbackState, queue, emitPlayback]);

  const toggleShuffle = () => {
    if (!isDJ) return;
    emitPlayback({ shuffle: !playbackState?.shuffle });
  };

  const toggleLoop = () => {
    if (!isDJ) return;
    const modes: ('off' | 'one' | 'all')[] = ['off', 'all', 'one'];
    const currentMode = playbackState?.loop || 'off';
    const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
    emitPlayback({ loop: nextMode });
  };

  // Scrubber local update loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (player && !isDragging) {
        setLocalTime(player.getCurrentTime());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [player, isDragging]);
  
  useEffect(() => {
    if (isMuted) {
      player?.setMuted(true);
      player?.setVolume(0);
    } else {
      player?.setMuted(false);
      player?.setVolume(volume);
    }
    localStorage.setItem('tnmn_muted', isMuted.toString());
    localStorage.setItem('tnmn_volume', volume.toString());
  }, [player, isMuted, volume]);

  const togglePlay = useCallback(() => {
    if (!playbackState) return;
    emitPlayback({ 
      playing: !playbackState.playing,
      position: player?.getCurrentTime() || 0 
    });
  }, [playbackState, emitPlayback, player]);

  const handleSeekStart = () => setIsDragging(true);
  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement>) => {
    setIsDragging(false);
    if (!isDJ) return;
    const time = parseFloat((e.currentTarget as HTMLInputElement).value);
    player?.seekTo(time);
    emitPlayback({ position: time });
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!playbackState || !serverId) {
    return (
      <div className="h-full flex items-center px-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-3 italic">Silence is golden</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full md:h-full flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 px-4 py-3 md:py-0">
      {/* Autoplay Overlay */}
      {playbackState.playing && !hasInteracted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-2/80 backdrop-blur-sm animate-in fade-in duration-300">
          <button 
            onClick={() => setHasInteracted(true)}
            className="flex items-center gap-3 bg-accent px-6 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white shadow-2xl hover:scale-105 transition-transform active:scale-95"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Join Broadcast
          </button>
        </div>
      )}

      {/* Hidden Players */}
      {playbackState.source === 'youtube' && (
        <YouTubePlayer 
          videoId={playbackState.sourceId} 
          ref={setPlayer} 
          onEnd={handleTrackEnd}
        />
      )}
      {playbackState.source === 'soundcloud' && (
        <SoundCloudPlayer 
          url={playbackState.sourceId} 
          ref={setPlayer} 
          onEnd={handleTrackEnd}
        />
      )}

      {/* Info */}
      <div className="flex items-center gap-3 w-full md:flex-1 md:min-w-0 overflow-hidden">
        <div className="h-8 w-8 md:h-10 md:w-10 bg-bg-3 shrink-0 overflow-hidden border border-rule/50">
           {(playbackState as any).thumbnail ? (
             <img src={(playbackState as any).thumbnail} alt="" className="h-full w-full object-cover animate-in fade-in duration-500" />
           ) : (
             <div className="w-full h-full bg-accent opacity-20" />
           )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-serif text-xs md:text-sm italic text-text leading-tight break-words line-clamp-2 md:line-clamp-1 md:truncate">{(playbackState as any).title || 'Now Playing'}</p>
            <div className="hidden md:block shrink-0">
              <WaveformBars isPlaying={playbackState.playing} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-[8px] uppercase text-text-3 tracking-tighter truncate max-w-[80px] md:max-w-none">Broadcasting via {playbackState.source}</p>
            {playbackState.playing && (
              <button 
                onClick={() => player?.play()}
                className="font-mono text-[8px] uppercase text-accent hover:underline animate-pulse shrink-0"
              >
                • Sync
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-1 flex-col justify-center gap-0.5 md:gap-1 px-0 md:px-4">
        <div className="flex items-center justify-center gap-3 md:gap-6">
          {isDJ && (
            <button 
              onClick={toggleShuffle}
              className={`transition-all ${playbackState.shuffle ? 'text-accent' : 'text-text-3 hover:text-text'}`}
              title="Shuffle"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.45 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
            </button>
          )}

          {isDJ && (
            <button 
              onClick={handlePrevTrack}
              className="text-text-3 hover:text-text transition-all"
              title="Previous Track"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
          )}

          <button 
            disabled={!isDJ}
            onClick={togglePlay}
            className={`transition-all ${isDJ ? 'hover:scale-110 text-text' : 'text-text-3'}`}
          >
            {playbackState.playing ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          
          {isDJ && (
            <button 
              onClick={handleTrackEnd}
              className="text-text-3 hover:text-text transition-all"
              title="Skip Track"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          )}

          {isDJ && (
            <button 
              onClick={toggleLoop}
              className={`relative transition-all ${playbackState.loop && playbackState.loop !== 'off' ? 'text-accent' : 'text-text-3 hover:text-text'}`}
              title={`Loop: ${playbackState.loop || 'off'}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
              {playbackState.loop === 'one' && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center bg-accent text-[8px] font-bold text-bg rounded-full">1</span>
              )}
            </button>
          )}
        </div>
        
        {/* Scrubber & Volume */}
        <div className="flex items-center justify-center gap-3 md:gap-8">
          <div className="flex items-center gap-3 w-full max-w-md">
            <span className="font-mono text-[10px] text-text-3 w-8 text-right">{formatTime(localTime)}</span>
            <input 
              type="range"
              min={0}
              max={player?.getDuration() || 100}
              step={0.1}
              disabled={!isDJ}
              value={isDragging ? undefined : localTime}
              onMouseDown={handleSeekStart}
              onChange={(e) => setLocalTime(parseFloat(e.target.value))}
              onMouseUp={handleSeekEnd}
              className="flex-1 h-0.5 appearance-none bg-rule outline-none accent-accent cursor-pointer disabled:cursor-default"
            />
            <span className="font-mono text-[10px] text-text-3 w-8">{formatTime(player?.getDuration() || 0)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="text-text-3 hover:text-text transition-all"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              )}
            </button>
            <input 
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setVolume(val);
                if (val > 0) setIsMuted(false);
                else setIsMuted(true);
              }}
              className="w-16 md:w-24 h-0.5 appearance-none bg-rule outline-none accent-accent cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* DJ Badge */}
      <div className="hidden md:flex md:flex-1 justify-end">
        {isDJ ? (
          <span className="border border-accent px-2 py-0.5 font-mono text-[8px] uppercase text-accent tracking-widest">Master DJ</span>
        ) : (
          <span className="border border-rule px-2 py-0.5 font-mono text-[8px] uppercase text-text-3 tracking-widest">Listener</span>
        )}
      </div>
    </div>
  );
}
