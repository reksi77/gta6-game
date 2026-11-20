// Every sound is synthesized with WebAudio: no audio files, no network. An engine hum that
// follows the car's speed, a two-tone siren, gunshots, thuds, chimes and a quiet bassline loop.
// Nothing starts until the player presses a key, so the AudioContext is always resumed from
// a real user gesture.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A slow, sunny bassline: A minor walking down to E, one note a beat, quiet under the game.
  const BASSLINE = [110, 0, 130.81, 0, 98, 0, 82.41, 0, 110, 0, 130.81, 0, 146.83, 0, 164.81, 0];

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function noiseBuffer(seconds) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(frequency, duration, type, volume, slideTo) {
    if (!ensure() || context.state === 'suspended') return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration + 0.02);
  }

  function thud(volume, duration, lowpass) {
    if (!ensure() || context.state === 'suspended') return;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(duration);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function startEngine() {
    if (!ensure() || engineOsc !== null) return;
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    if (!ensure() || sirenOsc !== null) return;
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 720;
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    lfo.start();
  }

  function startMusic() {
    if (musicTimer !== null || !ensure()) return;
    musicTimer = window.setInterval(() => {
      if (context.state === 'suspended' || muted) return;
      const note = BASSLINE[musicStep % BASSLINE.length];
      musicStep += 1;
      if (note === 0) return;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.16, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + 0.26);
    }, 230);
  }

  return {
    /** Call from any user gesture: unlocks the context and starts the engine/music beds. */
    resume() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume();
      startEngine();
      startSiren();
      startMusic();
    },
    /** 0 (idle) to 1 (top speed): the engine hum follows the player's car. */
    setEngine(level) {
      if (!engineOsc || !engineGain) return;
      const target = muted ? 0 : 0.02 + level * 0.075;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + level * 95, context.currentTime, 0.08);
    },
    /** The siren swells while any police are in pursuit. */
    setSiren(on) {
      sirenOn = on;
      if (!sirenGain) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.035 : 0, context.currentTime, 0.2);
    },
    sirenActive() {
      return sirenOn;
    },
    gunshot() {
      thud(0.5, 0.12, 1800);
      blip(180, 0.08, 'square', 0.2, 60);
    },
    punch() {
      thud(0.35, 0.1, 500);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.25);
      window.setTimeout(() => blip(990, 0.14, 'sine', 0.25), 90);
    },
    missionPass() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((note, i) => window.setTimeout(() => blip(note, 0.22, 'triangle', 0.3), i * 110));
    },
    busted() {
      blip(392, 0.3, 'sawtooth', 0.25, 196);
      window.setTimeout(() => blip(311, 0.5, 'sawtooth', 0.25, 155), 260);
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.05);
    },
    isMuted() {
      return muted;
    },
  };
}
