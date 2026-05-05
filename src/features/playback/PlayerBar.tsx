import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';
import YouTubePlayer from './YouTubePlayer';
import type { PlayerHandle } from './YouTubePlayer';
import SoundCloudPlayer from './SoundCloudPlayer';
import { usePlaybackSync } from './usePlaybackSync';
import { useColorThief } from '../../shared/hooks/useColorThief';
import WaveformBars from './WaveformBars';
import { useQueue } from '../queue/useQueue';

export default function PlayerBar() {
  const { serverId } = useParams<{ serverId: string }>();
  const { user } = useAuth();
  const [djId, setDjId] = useState<string | null>(null);
  const playerRef = useRef<PlayerHandle>(null);
  const [localTime, setLocalTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const isDJ = !!user && djId === user.uid;
  const { queue } = useQueue(serverId);

  // Sync server metadata for DJ check
  useEffect(() => {
    if (!serverId) return;
    const unsubscribe = onSnapshot(doc(db, 'servers', serverId), (doc) => {
      if (doc.exists()) {
        setDjId(doc.data().djId);
      }
    });
    return () => unsubscribe();
  }, [serverId]);

  const { playbackState, emitPlayback } = usePlaybackSync(serverId, isDJ, playerRef.current);

  // Dynamic Accent
  useColorThief((playbackState as any)?.thumbnail);

  const handleTrackEnd = () => {
    if (!isDJ || !playbackState || queue.length === 0) return;

    // Find current track index
    const currentIndex = queue.findIndex(item => item.id === playbackState.trackId);
    const nextTrack = queue[currentIndex + 1];

    if (nextTrack) {
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
  };

  // Scrubber local update loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && !isDragging) {
        setLocalTime(playerRef.current.getCurrentTime());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isDragging]);

  const togglePlay = () => {
    if (!playbackState) return;
    emitPlayback({ 
      playing: !playbackState.playing,
      position: playerRef.current?.getCurrentTime() || 0 
    });
  };

  const handleSeekStart = () => setIsDragging(true);
  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement>) => {
    setIsDragging(false);
    if (!isDJ) return;
    const time = parseFloat((e.currentTarget as HTMLInputElement).value);
    playerRef.current?.seekTo(time);
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
          ref={playerRef} 
          onEnd={handleTrackEnd}
        />
      )}
      {playbackState.source === 'soundcloud' && (
        <SoundCloudPlayer 
          url={playbackState.sourceId} 
          ref={playerRef} 
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
          <p className="font-mono text-[8px] uppercase text-text-3 tracking-tighter">Broadcasting via {playbackState.source}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-1 flex-col gap-1 px-4">
        <div className="flex items-center justify-center gap-6">
          <button 
            disabled={!isDJ}
            onClick={togglePlay}
            className={`transition-all ${isDJ ? 'hover:scale-110 text-white' : 'text-text-3'}`}
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
              className="text-text-3 hover:text-white transition-all"
              title="Skip Track"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          )}
        </div>
        
        {/* Scrubber */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-text-3 w-8 text-right">{formatTime(localTime)}</span>
          <input 
            type="range"
            min={0}
            max={playerRef.current?.getDuration() || 100}
            step={0.1}
            disabled={!isDJ}
            value={isDragging ? undefined : localTime}
            onMouseDown={handleSeekStart}
            onChange={(e) => setLocalTime(parseFloat(e.target.value))}
            onMouseUp={handleSeekEnd}
            className="flex-1 h-0.5 appearance-none bg-rule outline-none accent-accent cursor-pointer disabled:cursor-default"
          />
          <span className="font-mono text-[10px] text-text-3 w-8">{formatTime(playerRef.current?.getDuration() || 0)}</span>
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
