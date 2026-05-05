import { useEffect, useRef } from 'react';
import type { PlaybackState } from './usePlaybackSync';

interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  onSeekTo?: (time: number) => void;
}

export function useMediaSession(
  playbackState: PlaybackState | null,
  handlers: MediaSessionHandlers,
  currentPosition: number,
  duration: number
) {
  const positionRef = useRef(currentPosition);
  const durationRef = useRef(duration);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    positionRef.current = currentPosition;
    durationRef.current = duration;
    handlersRef.current = handlers;
  }, [currentPosition, duration, handlers]);

  // Update Metadata
  useEffect(() => {
    if (!('mediaSession' in navigator) || !playbackState) return;

    console.log('[MediaSession] Updating metadata', playbackState.title);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: playbackState.title || 'Unknown Title',
      artist: 'TNMN Broadcast',
      album: playbackState.source === 'youtube' ? 'YouTube' : 'SoundCloud',
      artwork: playbackState.thumbnail ? [
        { src: playbackState.thumbnail, sizes: '96x96', type: 'image/jpeg' },
        { src: playbackState.thumbnail, sizes: '128x128', type: 'image/jpeg' },
        { src: playbackState.thumbnail, sizes: '192x192', type: 'image/jpeg' },
        { src: playbackState.thumbnail, sizes: '256x256', type: 'image/jpeg' },
        { src: playbackState.thumbnail, sizes: '384x384', type: 'image/jpeg' },
        { src: playbackState.thumbnail, sizes: '512x512', type: 'image/jpeg' },
      ] : []
    });
  }, [playbackState?.trackId, playbackState?.title, playbackState?.thumbnail, playbackState?.source]);

  // Update Playback State
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playbackState?.playing ? 'playing' : (playbackState ? 'paused' : 'none');
    console.log('[MediaSession] State set to', navigator.mediaSession.playbackState);
  }, [playbackState?.playing]);

  // Set Action Handlers (Stable)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    console.log('[MediaSession] Re-binding stable handlers', {
      hasPrev: !!handlers.onPreviousTrack,
      hasNext: !!handlers.onNextTrack
    });

    navigator.mediaSession.setActionHandler('play', () => {
      console.log('[MediaSession] Play button clicked');
      handlersRef.current.onPlay();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      console.log('[MediaSession] Pause button clicked');
      handlersRef.current.onPause();
    });

    navigator.mediaSession.setActionHandler('previoustrack', handlers.onPreviousTrack ? () => {
      console.log('[MediaSession] Previous button clicked');
      handlersRef.current.onPreviousTrack?.();
    } : null);

    navigator.mediaSession.setActionHandler('nexttrack', handlers.onNextTrack ? () => {
      console.log('[MediaSession] Next button clicked');
      handlersRef.current.onNextTrack?.();
    } : null);

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        handlersRef.current.onSeekTo?.(details.seekTime);
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const offset = details.seekOffset || 10;
      handlersRef.current.onSeekTo?.(Math.max(0, positionRef.current - offset));
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const offset = details.seekOffset || 10;
      handlersRef.current.onSeekTo?.(Math.min(durationRef.current, positionRef.current + offset));
    });

  }, [!!handlers.onPreviousTrack, !!handlers.onNextTrack, !!handlers.onSeekTo]);

  // Update Position State
  useEffect(() => {
    if (!('mediaSession' in navigator) || !playbackState || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1,
        position: Math.min(currentPosition, duration)
      });
    } catch (e) {
      console.error('[MediaSession] Error setting position state:', e);
    }
  }, [currentPosition, duration, playbackState?.trackId]);
}
