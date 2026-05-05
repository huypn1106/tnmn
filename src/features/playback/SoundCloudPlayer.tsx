import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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
        onReady?.();
      });
      widgetRef.current.bind(window.SC.Widget.Events.FINISH, () => {
        onEnd?.();
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
  }, [url, onReady, onEnd]);

  useImperativeHandle(ref, () => ({
    play: () => widgetRef.current?.play(),
    pause: () => widgetRef.current?.pause(),
    seekTo: (seconds: number) => widgetRef.current?.seekTo(seconds * 1000),
    getCurrentTime: () => {
      let time = 0;
      widgetRef.current?.getPosition((pos: number) => { time = pos / 1000; });
      return time;
    },
    getDuration: () => {
      let dur = 0;
      widgetRef.current?.getDuration((d: number) => { dur = d / 1000; });
      return dur;
    },
  }));

  return (
    <iframe
      ref={iframeRef}
      className="absolute opacity-0 pointer-events-none"
      src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`}
      allow="autoplay"
    />
  );
});

export default SoundCloudPlayer;
