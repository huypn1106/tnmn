import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';
import YouTubePlayer from './YouTubePlayer';
import type { PlayerHandle } from './YouTubePlayer';
import type { Server } from '../servers/useServers';
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
  
  const isDJ = !!user && !!server && server.roles?.[user.uid] === 'dj';
  const { queue } = useQueue(resolvedId || undefined);
  const { playbackState, emitPlayback } = usePlaybackSync(resolvedId || undefined, isDJ, player);

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
    <div className="flex h-full items-center gap-4 px-4">
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
      <div className="flex items-center gap-3 w-64 shrink-0 overflow-hidden">
        <div className="h-10 w-10 bg-bg-3 shrink-0 overflow-hidden border border-rule/50">
           {(playbackState as any).thumbnail ? (
             <img src={(playbackState as any).thumbnail} alt="" className="h-full w-full object-cover animate-in fade-in duration-500" />
           ) : (
             <div className="w-full h-full bg-accent opacity-20" />
           )}
        </div>
        <div className="truncate">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="truncate font-serif text-sm italic text-text leading-tight">{(playbackState as any).title || 'Now Playing'}</p>
            <WaveformBars isPlaying={playbackState.playing} />
          </div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-[8px] uppercase text-text-3 tracking-tighter">Broadcasting via {playbackState.source}</p>
            {playbackState.playing && (
              <button 
                onClick={() => player?.play()}
                className="font-mono text-[8px] uppercase text-accent hover:underline animate-pulse"
              >
                • Sync Audio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-1 flex-col gap-1 px-4">
        <div className="flex items-center justify-center gap-6">
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
        
        {/* Scrubber */}
        <div className="flex items-center gap-3">
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
      </div>

      {/* DJ Badge */}
      <div className="w-32 flex justify-end">
        {isDJ ? (
          <span className="border border-accent px-2 py-0.5 font-mono text-[8px] uppercase text-accent tracking-widest">Master DJ</span>
        ) : (
          <span className="border border-rule px-2 py-0.5 font-mono text-[8px] uppercase text-text-3 tracking-widest">Listener</span>
        )}
      </div>
    </div>
  );
}
