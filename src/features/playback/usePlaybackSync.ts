import { useEffect, useState, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';
import type { PlayerHandle } from './YouTubePlayer';

export interface PlaybackState {
  playlistId?: string;
  trackId: string;
  source: 'youtube' | 'soundcloud' | 'url';
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
  crossPlaylist?: boolean;
}

export function usePlaybackSync(serverId: string | undefined, isDJ: boolean, player: PlayerHandle | null, _hasInteracted?: boolean) {
  const { user } = useAuth();
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const lastUpdateRef = useRef(0);
  const latestStateRef = useRef<PlaybackState | null>(null);

  // Sync Logic
  useEffect(() => {
    if (!serverId) {
      setPlaybackState(null);
      latestStateRef.current = null;
      return;
    }

    const playbackRef = ref(rtdb, `playback/${serverId}`);
    const unsubscribe = onValue(playbackRef, (snapshot) => {
      const data = snapshot.val() as PlaybackState;
      if (!data) {
        setPlaybackState(null);
        latestStateRef.current = null;
        return;
      }

      setPlaybackState(data);
      latestStateRef.current = data;

      // Sync logic on snapshot received
      if (player) {
        const now = Date.now();
        const targetPos = data.playing 
          ? data.position + (now - data.updatedAt) / 1000 
          : data.position;

        const currentPos = player.getCurrentTime();
        const duration = player.getDuration();

        // Do not seek past duration if duration is available
        if (duration > 0 && targetPos >= duration) return;
        
        // Sync if drift > 2s (3s for DJ to avoid fight-back during seeks)
        const threshold = isDJ ? 3 : 2;
        if (Math.abs(targetPos - currentPos) > threshold && targetPos >= 0) {
          player.seekTo(targetPos);
        }

        if (data.playing) {
          player.play();
        } else {
          player.pause();
        }
      }
    });

    // Active Drift Correction Loop: Every 1 second, ensure ongoing stream sync
    // This catches initial mount when player was unready during onValue, tab switches, and drift
    const syncInterval = setInterval(() => {
      if (!player) return;
      const curState = latestStateRef.current;
      if (!curState) return;

      // If DJ just manually sought or updated, don't fight during the buffer window
      if (isDJ && Date.now() - lastUpdateRef.current < 2500) {
        return;
      }

      const now = Date.now();
      const targetPos = curState.playing
        ? curState.position + (now - curState.updatedAt) / 1000
        : curState.position;

      const currentPos = player.getCurrentTime();
      const duration = player.getDuration();

      if (duration > 0 && targetPos >= duration) return;

      const threshold = isDJ ? 3 : 2;
      const drift = Math.abs(targetPos - currentPos);

      if (drift > threshold && targetPos >= 0) {
        player.seekTo(targetPos);
      }

      if (curState.playing) {
        player.play();
      } else {
        player.pause();
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
    };
  }, [serverId, isDJ, player]);

  // DJ control function
  const emitPlayback = (patch: Partial<PlaybackState>) => {
    if (!serverId || !isDJ) return;
    
    const now = Date.now();
    if (now - lastUpdateRef.current < 200) return;
    lastUpdateRef.current = now;

    // Use explicit position if provided (e.g. seek or new track).
    // Otherwise, compute the current stream position from latest state to prevent resetting to 0!
    let currentPos: number;
    if (patch.position !== undefined) {
      currentPos = patch.position;
    } else if (latestStateRef.current) {
      currentPos = latestStateRef.current.playing
        ? latestStateRef.current.position + (now - latestStateRef.current.updatedAt) / 1000
        : latestStateRef.current.position;
    } else {
      currentPos = player?.getCurrentTime() ?? 0;
    }

    update(ref(rtdb, `playback/${serverId}`), {
      ...patch,
      position: currentPos,
      updatedAt: now,
      djId: user?.uid,
    });
  };

  return { playbackState, emitPlayback };
}
