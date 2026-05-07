export const playBip = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    
    const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Play a bright two-tone notification (C6 -> E6)
    // Increased volume to 0.4 to be audible over music
    const now = audioCtx.currentTime;
    playTone(1046.50, now, 0.15, 0.4); // C6
    playTone(1318.51, now + 0.1, 0.2, 0.4); // E6
  } catch (e) {
    console.warn('Failed to play notification sound:', e);
  }
};
