window.Game = window.Game || {};

window.Game.Audio = (function () {
  let ctx = null;
  let muted = false;
  let noiseBuffer = null;

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (!noiseBuffer && ctx) {
      const length = ctx.sampleRate * 1.0;
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return ctx;
  }

  function unlock() {
    ensureContext();
  }

  function setMuted(val) {
    muted = !!val;
  }

  function isMuted() {
    return muted;
  }

  function playNoise(duration, filterType, freqStart, freqEnd, gainPeak, q = 1.0) {
    const c = ensureContext();
    if (!c || !noiseBuffer) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;

    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freqStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  function playTone(type, freqStart, freqEnd, duration, gainPeak, delay = 0) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(25, freqEnd), now + duration);
    }

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    unlock,
    setMuted,
    isMuted,

    slash(comboIndex) {
      const pitch = comboIndex === 2 ? 0.78 : comboIndex === 1 ? 1.08 : 1.0;
      playNoise(0.16, 'bandpass', 1700 * pitch, 420 * pitch, 0.22, 1.4);
      playTone('triangle', 320 * pitch, 110 * pitch, 0.12, 0.1);
    },

    hit(heavy = false) {
      playTone('sine', heavy ? 140 : 190, 42, heavy ? 0.16 : 0.1, heavy ? 0.34 : 0.22);
      playNoise(heavy ? 0.14 : 0.09, 'lowpass', heavy ? 1200 : 1800, 180, heavy ? 0.26 : 0.16);
      if (heavy) {
        playTone('sawtooth', 420, 120, 0.09, 0.08);
      }
    },

    block(perfect = false) {
      if (perfect) {
        // Resonant metallic bell parry
        playTone('triangle', 980, 1480, 0.22, 0.22);
        playTone('sine', 1480, 1960, 0.34, 0.18, 0.02);
        playTone('sine', 520, 180, 0.16, 0.25);
        playNoise(0.12, 'highpass', 2400, 1200, 0.18);
      } else {
        playTone('square', 360, 160, 0.12, 0.15);
        playNoise(0.1, 'bandpass', 1200, 500, 0.18, 2.0);
      }
    },

    dodge() {
      playNoise(0.18, 'bandpass', 720, 260, 0.18, 1.2);
    },

    ragePip(pipCount) {
      // Ascending fiery crystalline chime per pip (1 -> 2 -> 3)
      const base = [523.25, 659.25, 783.99][Math.min(2, Math.max(0, pipCount - 1))];
      playTone('triangle', base, base * 1.01, 0.26, 0.18, 0);
      playTone('sine', base * 1.5, base * 1.52, 0.36, 0.16, 0.06);
      if (pipCount === 3) {
        playTone('sine', base * 2.0, base * 2.02, 0.45, 0.15, 0.12);
      }
    },

    shieldBash() {
      playTone('sawtooth', 240, 68, 0.26, 0.22);
      playTone('sine', 160, 48, 0.28, 0.32);
      playNoise(0.24, 'bandpass', 950, 220, 0.24, 1.1);
    },

    shieldThrow() {
      playNoise(0.22, 'bandpass', 2200, 880, 0.18, 2.2);
      playTone('triangle', 620, 980, 0.18, 0.14);
    },

    shieldBounce(chainNum) {
      const f = chainNum >= 2 ? 1280 : 940;
      playTone('triangle', f, f * 1.35, 0.18, 0.22);
      playTone('sawtooth', f * 0.5, f * 0.25, 0.12, 0.14);
      playNoise(0.12, 'highpass', 2800, 1400, 0.16);
    },

    shieldCatch() {
      playTone('triangle', 540, 320, 0.1, 0.16);
      playTone('sine', 820, 640, 0.09, 0.1, 0.02);
    },

    whirlwindTick(isFinal = false) {
      if (isFinal) {
        playTone('sawtooth', 260, 58, 0.35, 0.26);
        playTone('sine', 150, 38, 0.38, 0.34);
        playNoise(0.32, 'bandpass', 1800, 260, 0.28, 1.0);
      } else {
        playNoise(0.2, 'bandpass', 1450, 520, 0.2, 1.6);
        playTone('triangle', 290, 170, 0.16, 0.11);
      }
    },

    enemyHitPlayer() {
      playTone('sawtooth', 160, 52, 0.2, 0.28);
      playNoise(0.16, 'lowpass', 900, 160, 0.22);
    },

    bossSlam() {
      playTone('sine', 115, 28, 0.48, 0.44);
      playTone('sawtooth', 95, 36, 0.38, 0.24);
      playNoise(0.42, 'lowpass', 720, 95, 0.34);
    },

    bossRoar() {
      playTone('sawtooth', 145, 72, 0.58, 0.22);
      playTone('sawtooth', 138, 65, 0.58, 0.18, 0.04);
      playNoise(0.52, 'bandpass', 480, 160, 0.22, 1.8);
    },

    enemyDeath(isBoss = false) {
      if (isBoss) {
        playTone('sawtooth', 180, 42, 0.75, 0.28);
        playTone('sine', 110, 30, 0.85, 0.36);
        playNoise(0.65, 'lowpass', 900, 110, 0.26);
      } else {
        playTone('triangle', 210, 68, 0.22, 0.16);
        playNoise(0.16, 'lowpass', 750, 180, 0.14);
      }
    },

    noRage() {
      playTone('square', 170, 130, 0.1, 0.08);
    },
  };
})();
