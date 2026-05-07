import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import type { PlayerHandle } from './YouTubePlayer';

declare global {
  interface Window {
    SC: any;
  }
}

interface Props {
  url: string;
  onReady?: () => void;
  onEnd?: () => void;
}

const SoundCloudPlayer = forwardRef<PlayerHandle, Props>(({ url, onReady, onEnd }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);

  const onReadyRef = useRef(onReady);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onReadyRef.current = onReady;
    onEndRef.current = onEnd;
  }, [onReady, onEnd]);

  const initialUrl = useRef(url);

  useEffect(() => {
    if (isReady && widgetRef.current) {
      widgetRef.current.load(url, {
        auto_play: false,
        hide_related: true,
        show_comments: false,
        show_user: false,
        show_reposts: false,
        show_teaser: false
      });
    }
  }, [url, isReady]);

  useEffect(() => {
    // Load SC API if not already loaded
    if (!window.SC) {
      const tag = document.createElement('script');
      tag.src = "https://w.soundcloud.com/player/api.js";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!iframeRef.current) return;
      
      widgetRef.current = window.SC.Widget(iframeRef.current);
      widgetRef.current.bind(window.SC.Widget.Events.READY, () => {
        setIsReady(true);
        widgetRef.current.getDuration((dur: number) => {
          durationRef.current = dur / 1000;
        });
        onReadyRef.current?.();
      });
      widgetRef.current.bind(window.SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
        currentTimeRef.current = data.currentPosition / 1000;
      });
      widgetRef.current.bind(window.SC.Widget.Events.SEEK, (data: any) => {
        currentTimeRef.current = data.currentPosition / 1000;
      });
      widgetRef.current.bind(window.SC.Widget.Events.FINISH, () => {
        onEndRef.current?.();
      });
    };

    if (window.SC) {
      initPlayer();
    } else {
      const interval = setInterval(() => {
        if (window.SC) {
          initPlayer();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    play: () => widgetRef.current?.play(),
    pause: () => widgetRef.current?.pause(),
    seekTo: (seconds: number) => widgetRef.current?.seekTo(seconds * 1000),
    getCurrentTime: () => currentTimeRef.current,
    getDuration: () => durationRef.current,
    setMuted: (muted: boolean) => {
      widgetRef.current?.setVolume(muted ? 0 : 100);
    },
    setVolume: (volume: number) => {
      widgetRef.current?.setVolume(volume);
    },
  }), [isReady]);

  return (
    <iframe
      ref={iframeRef}
      className="absolute opacity-0 pointer-events-none"
      src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(initialUrl.current)}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`}
      allow="autoplay"
    />
  );
});

export default SoundCloudPlayer;
