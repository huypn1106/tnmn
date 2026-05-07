export default function WaveformBars({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-2.5">
      <div className={`w-[2px] bg-accent/80 rounded-full transition-all duration-500 ${isPlaying ? 'animate-[waveform_1s_ease-in-out_infinite]' : 'h-[30%]'}`} />
      <div className={`w-[2px] bg-accent/80 rounded-full transition-all duration-500 ${isPlaying ? 'animate-[waveform_1.2s_ease-in-out_infinite_0.2s]' : 'h-[60%]'}`} />
      <div className={`w-[2px] bg-accent/80 rounded-full transition-all duration-500 ${isPlaying ? 'animate-[waveform_0.8s_ease-in-out_infinite_0.4s]' : 'h-[40%]'}`} />
    </div>
  );
}
