import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface PlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
}

interface Props {
  videoId: string;
  onReady?: () => void;
  onEnd?: () => void;
}

const YouTubePlayer = forwardRef<PlayerHandle, Props>(({ videoId, onReady, onEnd }, ref) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingPlayRef = useRef<boolean>(false);

  const onReadyRef = useRef(onReady);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onReadyRef.current = onReady;
    onEndRef.current = onEnd;
  }, [onReady, onEnd]);

  const initialVideoId = useRef(videoId);
  const prevVideoIdRef = useRef(videoId);

  useEffect(() => {
    if (isReady && playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      if (videoId !== prevVideoIdRef.current) {
        prevVideoIdRef.current = videoId;
        playerRef.current.loadVideoById(videoId);
      }
    }
  }, [videoId, isReady]);

  useEffect(() => {
    // Load YT API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '200',
        width: '200',
        videoId: initialVideoId.current,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            // Execute any queued seek or play commands that arrived before player was ready
            if (pendingSeekRef.current !== null && playerRef.current && typeof playerRef.current.seekTo === 'function') {
              playerRef.current.seekTo(pendingSeekRef.current, true);
              pendingSeekRef.current = null;
            }
            if (pendingPlayRef.current && playerRef.current && typeof playerRef.current.playVideo === 'function') {
              try {
                playerRef.current.playVideo();
              } catch {}
              pendingPlayRef.current = false;
            }
            onReadyRef.current?.();
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              onEndRef.current?.();
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (isReady && playerRef.current && typeof playerRef.current.playVideo === 'function') {
        try {
          playerRef.current.playVideo();
        } catch {}
      } else {
        pendingPlayRef.current = true;
      }
    },
    pause: () => {
      pendingPlayRef.current = false;
      if (isReady && playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo();
      }
    },
    seekTo: (seconds: number) => {
      if (isReady && playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(seconds, true);
      } else {
        pendingSeekRef.current = seconds;
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        return playerRef.current.getCurrentTime();
      }
      return 0;
    },
    getDuration: () => {
      if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
        return playerRef.current.getDuration();
      }
      return 0;
    },
    setMuted: (muted: boolean) => {
      if (playerRef.current && typeof (muted ? playerRef.current.mute : playerRef.current.unMute) === 'function') {
        if (muted) playerRef.current.mute();
        else playerRef.current.unMute();
      }
    },
    setVolume: (volume: number) => {
      if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(volume);
      }
    },
  }), [isReady]);

  return (
    <div className="fixed -top-[9999px] -left-[9999px] pointer-events-none" aria-hidden="true">
      <div ref={containerRef} />
    </div>
  );
});

export default YouTubePlayer;
