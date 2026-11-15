// TBG ARENA — 8비트 효과음 (Web Audio로 실시간 합성, 음원 파일 없음)
// 모바일은 사용자가 화면을 한 번 터치해야 소리가 나므로 unlock()을 터치/클릭 핸들러 안에서 부른다.
(function () {
  const KEY = 'tbg_sfx';
  let ac = null, master = null, noiseBuf = null;
  let enabled = false;
  try { enabled = localStorage.getItem(KEY) === '1'; } catch {}

  function ctx() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master = ac.createGain(); master.gain.value = 0.55;
    master.connect(comp).connect(ac.destination);
    // 1초짜리 화이트 노이즈 (타격·관중·바람 소리 재료)
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }

  // ── 재료
  function tone(type, f0, f1, dur, vol, at = 0) {
    const t = ac.currentTime + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, { type = 'lowpass', f0 = 3000, f1 = f0, q = 0.8, at = 0, attack = 0.003 } = {}) {
    const t = ac.currentTime + at;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  // 천천히 커졌다 사라지는 관중 함성
  function swell(dur, vol, f = 900, at = 0) {
    const t = ac.currentTime + at;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  // ── 효과음 목록
  const SOUNDS = {
    whoosh: () => noise(0.12, 0.18, { type: 'bandpass', f0: 2400, f1: 700, q: 1.4, attack: 0.02 }),
    kick: () => noise(0.18, 0.22, { type: 'bandpass', f0: 1800, f1: 400, q: 1.2, attack: 0.03 }),
    miss: () => { noise(0.2, 0.16, { type: 'bandpass', f0: 3200, f1: 900, q: 2, attack: 0.04 }); tone('triangle', 520, 260, 0.12, 0.05, 0.04); },
    hit: () => { tone('square', 320, 70, 0.1, 0.22); noise(0.06, 0.35, { f0: 4000, f1: 800 }); },
    big: () => {
      tone('square', 200, 38, 0.24, 0.3); tone('sine', 90, 30, 0.3, 0.5);
      noise(0.16, 0.5, { f0: 5000, f1: 400 });
      swell(0.9, 0.08, 1100, 0.05);
    },
    counter: () => { tone('square', 660, 660, 0.05, 0.12); tone('square', 990, 990, 0.08, 0.12, 0.06); },
    slam: () => { tone('sine', 140, 28, 0.35, 0.6); noise(0.3, 0.35, { f0: 900, f1: 120 }); },
    bounce: () => { tone('sine', 110, 40, 0.18, 0.35); noise(0.12, 0.2, { f0: 700, f1: 150 }); },
    sprawl: () => { noise(0.14, 0.2, { f0: 1200, f1: 300 }); tone('square', 300, 180, 0.08, 0.08); },
    sweep: () => tone('square', 200, 900, 0.22, 0.12),
    down: () => {
      SOUNDS.big();
      tone('triangle', 520, 90, 0.7, 0.18, 0.12); // 휘청 ↘
      swell(1.6, 0.16, 900, 0.1);
    },
    lock: () => { [0, 0.16, 0.32, 0.48].forEach((at, i) => tone('triangle', 180 + i * 20, 160 + i * 20, 0.12, 0.2, at)); },
    escape: () => { tone('square', 300, 600, 0.1, 0.1); tone('square', 600, 1200, 0.1, 0.1, 0.1); },
    tap: () => { tone('square', 1400, 1100, 0.04, 0.14); noise(0.03, 0.15, { type: 'highpass', f0: 3000 }); },
    ko: () => {
      // 크래시 → 낮게 깔리는 슬로모션 굉음
      noise(1.4, 0.7, { f0: 6000, f1: 200 });
      tone('square', 160, 22, 0.9, 0.35);
      tone('sine', 70, 20, 1.6, 0.6);
      tone('sawtooth', 110, 40, 1.4, 0.08, 0.05);
    },
    crowd: () => { swell(2.4, 0.32, 850); swell(2.2, 0.18, 1600, 0.1); },
    fanfare: () => {
      const n = [523, 659, 784, 1047]; // C E G C
      n.forEach((f, i) => tone('square', f, f, 0.12, 0.1, i * 0.1));
      tone('square', 1047, 1047, 0.45, 0.1, 0.42); tone('square', 784, 784, 0.45, 0.06, 0.42);
    },
    bell: () => { // 공 소리 (금속성 배음)
      for (const [f, v] of [[830, 0.28], [1245, 0.14], [2210, 0.08], [3100, 0.04]]) tone('sine', f, f * 0.995, 1.3, v);
      noise(0.03, 0.2, { type: 'highpass', f0: 4000 });
    },
    bell2: () => { SOUNDS.bell(); setTimeout(() => ac && SOUNDS.bell(), 260); },
    click: () => tone('square', 880, 880, 0.04, 0.08),
  };

  const SFX = {
    get enabled() { return enabled; },
    // 반드시 터치/클릭 핸들러 안에서 호출 (iOS 자동재생 제한)
    unlock() {
      const a = ctx(); if (!a) return false;
      if (a.state === 'suspended') a.resume();
      // iOS 깨우기용 무음 1샘플
      const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0);
      return true;
    },
    setEnabled(v) {
      enabled = !!v;
      try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch {}
      if (enabled) { SFX.unlock(); SFX.play('click'); }
    },
    toggle() { SFX.setEnabled(!enabled); return enabled; },
    play(name) {
      if (!enabled || !ac || ac.state !== 'running') return;
      const fn = SOUNDS[name]; if (!fn) return;
      try { fn(); } catch {}
    },
  };

  // 예전에 켜 둔 사용자는 첫 터치 때 자동으로 소리 활성화
  const wake = () => { if (enabled) SFX.unlock(); };
  window.addEventListener('pointerdown', wake, { passive: true });
  window.addEventListener('keydown', wake);

  window.SFX = SFX;
})();
