let sharedAudioContext: AudioContext | null = null;

export const playSound = (type: 'tap' | 'type' | 'receive' | 'send', userCode: string) => {
  const soundsEnabled = localStorage.getItem(`sounds_${userCode}`) !== 'false';
  if (!soundsEnabled) return;

  try {
    if (!sharedAudioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      sharedAudioContext = new AudioContextClass();
    }
    
    // Resume context if it was suspended (autoplay policy)
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume();
    }
    
    const ctx = sharedAudioContext;

    const playTone = (freq: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + duration * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    };

    switch (type) {
      case 'tap':
        // A very quick, dull click
        playTone(400, 'sine', 0.05, 0.05);
        break;
      case 'type':
        // A faint, high-pitched tick
        playTone(600, 'triangle', 0.03, 0.02);
        break;
      case 'receive':
        // A pleasant two-tone ding
        playTone(523.25, 'sine', 0.15, 0.1); // C5
        setTimeout(() => {
          if (ctx.state === 'running') playTone(659.25, 'sine', 0.3, 0.1); // E5
        }, 100);
        break;
      case 'send':
        // A crisp pop
        playTone(440, 'sine', 0.1, 0.08); // A4
        setTimeout(() => {
          if (ctx.state === 'running') playTone(880, 'sine', 0.2, 0.05); // A5
        }, 50);
        break;
    }
  } catch (e) {
    // Ignore audio errors
  }
};
