import { useEffect, useRef, useCallback } from 'react';

/**
 * useSilentAudio
 * Keeps an audio element playing a silent loop on mobile browsers (iOS Safari & Android Chrome).
 * This registers an active Audio Session with the OS, preventing MediaSession controls
 * from being dismissed on the lock screen when the device is locked.
 */
export function useSilentAudio(isPlaying: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('/silence.wav');
      audio.loop = true;
      (audio as any).playsInline = true;
      audio.preload = 'auto';
      audio.volume = 0.01;
      audioRef.current = audio;
    }

    const audio = audioRef.current;

    const tryPlay = () => {
      if (isPlaying && audio.paused) {
        audio.play().catch(() => {
          // Autoplay might be temporarily blocked until first user gesture
        });
      }
    };

    if (isPlaying) {
      tryPlay();
    } else {
      audio.pause();
    }

    const handleGesture = () => {
      if (isPlaying && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, [isPlaying]);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, []);

  return { resume, pause };
}
