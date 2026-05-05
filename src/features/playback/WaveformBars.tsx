export default function WaveformBars({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-2.5">
      {[0.4, 0.7, 0.5].map((delay, i) => (
        <span 
          key={i}
          className={`w-0.5 bg-accent transition-all duration-500 ${isPlaying ? 'animate-waveform' : 'h-[20%] opacity-50'}`}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
