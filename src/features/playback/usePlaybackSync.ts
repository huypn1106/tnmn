import { useEffect, useState, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';
import type { PlayerHandle } from './YouTubePlayer';

export interface PlaybackState {
  trackId: string;
  source: 'youtube' | 'soundcloud';
  sourceId: string;
  title?: string;
  thumbnail?: string;
  position: number;
  playing: boolean;
  updatedAt: number;
  djId: string;
  duration?: number;
  shuffle?: boolean;
  loop?: 'off' | 'one' | 'all';
}

export function usePlaybackSync(serverId: string | undefined, isDJ: boolean, player: PlayerHandle | null) {
  const { user } = useAuth();
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const lastUpdateRef = useRef(0);

  // Sync Logic
  useEffect(() => {
    if (!serverId) {
      setPlaybackState(null);
      return;
    }

    const playbackRef = ref(rtdb, `playback/${serverId}`);
    const unsubscribe = onValue(playbackRef, (snapshot) => {
      const data = snapshot.val() as PlaybackState;
      if (!data) {
        setPlaybackState(null);
        return;
      }

      setPlaybackState(data);

      // Sync logic for both DJ and listeners
      if (player) {
        const now = Date.now();
        const targetPos = data.playing 
          ? data.position + (now - data.updatedAt) / 1000 
          : data.position;

        const currentPos = player.getCurrentTime();
        
        // Sync if drift > 2s or if track/pause state differs significantly
        // For DJ, we use a slightly larger threshold to avoid fight-back during seeks
        const threshold = isDJ ? 3 : 2;
        if (Math.abs(targetPos - currentPos) > threshold) {
          player.seekTo(targetPos);
        }

        if (data.playing) {
          player.play();
        } else {
          player.pause();
        }
      }
    });

    return () => unsubscribe();
  }, [serverId, isDJ, player]);

  // DJ control function
  const emitPlayback = (patch: Partial<PlaybackState>) => {
    if (!serverId || !isDJ) return;
    
    const now = Date.now();
    // Simple throttle for manual seeks/updates
    if (now - lastUpdateRef.current < 200) return;
    lastUpdateRef.current = now;

    update(ref(rtdb, `playback/${serverId}`), {
      ...patch,
      updatedAt: now,
      djId: user?.uid,
    });
  };

  return { playbackState, emitPlayback };
}
