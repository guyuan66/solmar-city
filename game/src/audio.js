// Sound, synthesized with WebAudio — no audio assets, nothing to load.
// Engine hum follows speed, the siren wails when the heat is on, and pickups,
// crashes and mission chimes are short blips. Silent until the first gesture.
export function createAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      return false;
    }
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 60;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engine.connect(filter).connect(engineGain).connect(ctx.destination);
    engine.start();
    siren = ctx.createOscillator();
    siren.type = 'sine';
    siren.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    siren.connect(sirenGain).connect(ctx.destination);
    siren.start();
    return true;
  }

  function blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  function hornSound() {
    if (!ctx) return;
    // Two-tone car horn: a low square pair held for a beat.
    for (const f of [340, 428]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.3);
    }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    /** H — car horn, two-tone. */
    horn() { hornSound(); },
    /** Taxi meter tick: a short high blip each time the fare crosses $5. */
    meterBlip() { blip(1560, 0.06, 'sine', 0.07); },
    /** Achievement fanfare: brighter and longer than the mission jingle. */
    achievement() { [660, 880, 1108, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.28, 'triangle', 0.14), i * 120)); },
    /** Police helicopter arriving: a rising two-note alert. */
    heliAlert() { blip(520, 0.18, 'sawtooth', 0.09); setTimeout(() => blip(780, 0.24, 'sawtooth', 0.09), 170); },
    setDriving(speed, wanted) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(Math.min(0.05, Math.abs(speed) * 0.0012), t, 0.1);
      engine.frequency.setTargetAtTime(55 + Math.abs(speed) * 4.5, t, 0.1);
      sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.03 : 0, t, 0.2);
      sirenTimer += 1;
      if (wanted > 0 && sirenTimer % 30 === 0) {
        siren.frequency.setTargetAtTime(siren.frequency.value > 800 ? 660 : 920, t, 0.05);
      }
    },
    crash() { blip(90, 0.25, 'square', 0.18); },
    pickup() { blip(880, 0.12); setTimeout(() => blip(1320, 0.16), 90); },
    missionDone() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.2), i * 110)); },
    busted() { [400, 300, 200].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.15), i * 160)); },
  };
}
