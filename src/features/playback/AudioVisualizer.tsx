import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
}

export default function AudioVisualizer({ isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize Web Audio API
    if (!audioContextRef.current) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Since we don't have direct access to the audio stream from iframes,
        // we'll use a silent oscillator to drive the analyser if we wanted real "nodes",
        // but for a truly "reactive" feel to the *playing state*, we'll procedurally 
        // generate the visual data in the render loop to ensure high performance 
        // and smooth cinematic feel as requested.
        
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
        audioContextRef.current = ctx;
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smoothed data for cinematic feel
    const barCount = 64;
    const smoothedData = new Float32Array(barCount).fill(0);
    const noiseOffsets = new Float32Array(barCount).fill(0).map(() => Math.random() * 100);

    const render = () => {
      if (!canvas || !ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = width / barCount;
      const gap = 3;
      const activeBarWidth = barWidth - gap;

      // Update smoothed data
      const time = Date.now() * 0.001;
      for (let i = 0; i < barCount; i++) {
        let target = 0;
        
        if (isPlaying) {
          // Create a dynamic, "musical" feel using multiple sine waves and noise
          const noise = Math.sin(time * 2 + noiseOffsets[i]) * 0.3 + 0.5;
          const wave = Math.sin(time * 5 + i * 0.1) * 0.2 + 0.5;
          const bass = i < 10 ? Math.sin(time * 10) * 0.3 + 0.7 : 0;
          target = (noise * 0.4 + wave * 0.4 + bass * 0.2) * height * 0.95;
          
          // Random spikes
          if (Math.random() > 0.98) target += 15;
        } else {
          // Minimal ambient movement when paused
          target = (Math.sin(time * 1 + i * 0.2) * 0.05 + 0.1) * height * 0.25;
        }

        // Smoothly interpolate
        smoothedData[i] += (target - smoothedData[i]) * 0.15;
      }

      // Draw bars
      const centerY = height / 2;
      for (let i = 0; i < barCount; i++) {
        const barHeight = Math.max(1, smoothedData[i]); // Minimum height for visibility
        const x = i * barWidth + gap / 2;
        const y = centerY - barHeight / 2;

        // Gradient for premium feel
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');

        ctx.fillStyle = gradient;
        
        // Soft Glow
        ctx.shadowBlur = isPlaying ? 20 : 8;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        
        // Bar shape (flat)
        ctx.fillRect(x, y, activeBarWidth, barHeight);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  // Handle Resize
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (canvasRef.current) {
          const { width, height } = entry.contentRect;
          canvasRef.current.width = width * window.devicePixelRatio;
          canvasRef.current.height = height * window.devicePixelRatio;
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[40px] relative overflow-hidden pointer-events-none mb-2 mt-1 animate-in fade-in duration-1000"
      style={{ mixBlendMode: 'screen' }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
