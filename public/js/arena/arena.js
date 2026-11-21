// TBG ARENA — 픽셀 아트 경기 연출 (사이드뷰, Canvas 2D)
// 저해상도 월드 버퍼(160×100)에 도트 캐릭터를 그리고, 카메라 줌/쉐이크와 함께 확대 출력한다.
// 경기 이벤트(e.act = {att, cat})를 받아 펀치·킥·태클·그라운드·서브미션·다운·KO를 연출한다.
// 캐릭터 그리기는 sprite.js, 기술별 동작 정의는 moves.js, 효과음은 sfx.js
import { SFX } from './sfx.js';
import { clamp01, bump, easeOut, lerp, hash, mkCanvas } from './util.js';
import { SW, SH, OX, OY, SIDE, lookOf, drawSprite } from './sprite.js';
import { STRIKES, boxingMove, comboMove, DODGE_LABEL, DODGE_DUR, DODGE_MOVE } from './moves.js';

const LW = 160, LH = 100;          // 월드(도트) 해상도
const FLOOR = 76, CX = LW / 2;     // 발 위치, 링 중앙
const FONT = 'Galmuri11, "Galmuri11", monospace';

const logoImg = new Image(); logoImg.src = '/logo.png';
let logoDark = null; // 밝은 매트용 검정 로고
logoImg.onload = () => {
  logoDark = mkCanvas(logoImg.width, logoImg.height);
  const g = logoDark.getContext('2d'); g.drawImage(logoImg, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, logoImg.width, logoImg.height);
};
try { document.fonts?.load(`700 16px Galmuri11`); } catch {}

// ───────── 아레나 ─────────
export class Arena {
  constructor(canvas, L, R, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.demo = !!opts.demo;
    this.cast = opts.cast || null; this.castI = 0; this.bouts = 0; this.comboBy = null; // 데모: 여러 대진을 번갈아
    this.world = mkCanvas(LW, LH); this.w = this.world.getContext('2d');
    this.order = [L.id, R.id];
    this.f = { [L.id]: this.mk('L', L, 1), [R.id]: this.mk('R', R, -1) };
    this.pos = 'stand'; this.top = null;
    this.rt = 0; this.gt = 0; this.stop = 0; this.slow = 1; this.slowT = 0;
    this.fx = []; this.parts = []; this.q = []; this.speed = 1;
    this.ex = 0; this.exEnd = 0; // 지금 공방 번호 · 그 공방 연출이 끝나는 게임 시각 (겹침 방지)
    this.shake = 0; this.flash = 0; this.invert = 0; this.bars = 0; this.tbars = 0; this.hype = 0; this.lockOn = 0; this.dim = 0; this.spot = null;
    this.cam = { x: CX, y: 52, z: 1.15, punch: 0, fx: CX, fy: 52, fz: 0 };
    this.crowd = Array.from({ length: 2 }, (_, row) => Array.from({ length: 26 }, (_, i) => ({ x: i * 7 - 4 + row * 3 + (hash(i + 'c' + row) % 3), p: (hash(i + 'p' + row) % 100) / 15, s: hash(i + 's' + row) % 3 })));
    this.resize();
    this._rs = () => this.resize();
    window.addEventListener('resize', this._rs);
    this.layout(true);
    this.running = true; this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    if (this.demo) this.demoTick();
  }
  mk(side, p, d) {
    return { side, d, id: p.id, name: p.name || '', look: lookOf(p), st: SIDE[side], sp: mkCanvas(SW, SH),
      x: CX - d * 40, tx: CX, y: 0, vy: 0, kx: 0, lying: 0, tLying: 0, hand: 0, anim: null, ko: false, down: false, win: false, flash: 0, blink: 2 + Math.random() * 3 };
  }
  other(id) { return this.f[this.order[0] === id ? this.order[1] : this.order[0]]; }
  get fighters() { return this.order.map((id) => this.f[id]); }
  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = this.c.clientWidth || 320;
    this.dpr = dpr; this.cw = Math.round(w * dpr); this.ch = Math.round(w * LH / LW * dpr);
    this.c.width = this.cw; this.c.height = this.ch;
    this.c.style.height = (w * LH / LW) + 'px';
  }
  destroy() {
    this.running = false;
    clearTimeout(this.demoTimer);
    window.removeEventListener('resize', this._rs);
    window.removeEventListener('resize', this._rs);
  }
  later(ms, fn) { this.q.push({ at: this.gt + ms / 1000, fn }); }
  // 지금 공방 연출이 끝날 때까지 남은 실제 시간(ms). 다음 공방은 이만큼 기다렸다가 시작
  busyLeft() { return Math.max(0, ((this.exEnd - this.gt) * 1000) / (this.speed || 1)); }
  sfx(name, lvl = 1) {
    if (this.demo || this.silent) return;
    if ((this.speed >= 3 && lvl < 1) || (this.speed >= 8 && lvl < 2)) return;
    SFX.play(name);
  }

  // ── 위치
  layout(snap) {
    const [a, b] = this.fighters;
    const t = this.gt;
    if (this.pos === 'ground') {
      const top = this.f[this.top] || a, bot = this.other(top.id);
      const mid = CX + Math.sin(t * 0.4) * 3;
      const back = -bot.d;
      bot.tx = mid - back * 13; bot.tLying = 1;
      top.tx = mid - back * 3; top.tLying = top.ko ? 1 : 0;
    } else {
      const gap = this.pos === 'clinch' ? 15 : 29 + Math.sin(t * 1.3) * 3;
      const mid = CX + Math.sin(t * 0.55) * (this.pos === 'clinch' ? 3 : 12);
      a.tx = mid - gap / 2; b.tx = mid + gap / 2;
      for (const f of [a, b]) if (!f.ko && !f.down) f.tLying = 0;
    }
    if (snap) for (const f of [a, b]) { f.x = f.tx; f.lying = f.tLying; }
  }
  headPos(f) {
    const a = -f.lying * Math.PI / 2, lx = 0, ly = -25;
    const x = lx * Math.cos(a) - ly * Math.sin(a), y = lx * Math.sin(a) + ly * Math.cos(a);
    return [f.x + f.d * x, FLOOR + f.y - f.lying * 6 + (this.isMount(f) ? -3 : 0) + y];
  }
  isMount(f) { return this.pos === 'ground' && this.top === f.id && !f.ko && f.lying < 0.5; }

  // ── 이벤트 연출
  play(e, prevHp, result) {
    const a = e.act;
    const att = a ? this.f[a.att] : null;
    const def = att ? this.other(att.id) : null;
    const strike = a && (STRIKES.includes(a.cat) || a.showcase); // showcase: 펀치 없는 필살기 (디펜스·스텝만)
    const landed = ['strike', 'big', 'down', 'finish'].includes(e.type);
    const dmgOf = (id) => Math.max(0, Math.round((prevHp?.[id] ?? e.hp?.[id] ?? 0) - (e.hp?.[id] ?? 0)));

    if (e.type === 'round') {
      if (/시작/.test(e.text)) {
        for (const f of this.fighters) { f.ko = f.down = f.win = false; f.tLying = 0; f.anim = null; }
        this.pos = 'stand'; this.top = null; this.layout(true);
        for (const f of this.fighters) f.x = CX - f.d * 34;
        this.banner(`ROUND ${e.r}`, 1.1, { sub: 'FIGHT!', bars: true });
        this.hype = 1;
        this.sfx('bell', 2);
      } else { this.banner('END OF ROUND', 0.9, { bars: true, small: true }); this.sfx('bell2', 2); }
      return;
    }

    if (strike && att) {
      // 공방이 겹칠 때: 앞 공방에서 예약된 동작(맞는 반응 · 이어지는 펀치)이
      // 지금 공격 중인 선수의 동작을 덮어쓰지 않게 한다 (둘 다 맞기만 하는 것처럼 보이던 문제)
      const ex = ++this.ex;
      att.attEx = ex;
      const live = (f) => ex === this.ex || f.attEx !== this.ex;
      att.hand ^= 1;
      const mv = a.combo?.length > 1 || a.showcase ? comboMove(a.combo) : boxingMove(a);
      // 피하는 동작 연출: 라벨 + 몸 이동 (스텝은 앞뒤로 움직이고 점프는 뜀)
      const evade = (f, k) => { const m = DODGE_MOVE[k]; if (m?.kx) f.kx = f.d * m.kx; if (m?.vy) f.vy = m.vy; this.text(DODGE_LABEL[k], f, '#cfcfcf', 0.8, -12); };
      const kind = mv ? mv.seq[0][0] : this.isMount(att) ? 'gnp' : a.cat;
      let dur = mv ? mv.seq[0][1] : a.cat === 'kick' ? 0.5 : a.cat === 'knee' ? 0.42 : 0.34;
      const swing = () => {
        if (!live(att)) return;
        att.anim = { kind, t0: this.gt, dur, hand: att.hand };
        if (DODGE_LABEL[kind]) return evade(att, kind); // 콤보가 방어·스텝 동작으로 시작
        this.whoosh(att, mv ? mv.trail : kind);
        this.sfx(a.cat === 'kick' ? 'kick' : 'whoosh', 0);
      };
      // 카운터: 방금 피한 동작(슬립·위빙 등)에서 바로 받아친다
      const pre = a.counter && DODGE_LABEL[a.from] ? 0.22 : 0;
      if (pre) { att.anim = { kind: a.from, t0: this.gt, dur: pre + 0.06 }; this.later(pre * 1000, swing); } else swing();
      // 원투·더블 잽: 이어지는 펀치
      let lead = pre;
      if (mv) for (const [k2, d2] of mv.seq.slice(1)) {
        lead += dur * 0.85; dur = d2;
        this.later(lead * 1000, () => {
          if (!live(att)) return;
          att.anim = { kind: k2, t0: this.gt, dur: d2, hand: att.hand };
          if (DODGE_LABEL[k2]) return evade(att, k2); // 콤보 속 방어·스텝 동작
          this.whoosh(att, mv.trail); this.sfx('whoosh', 0);
        });
      }
      this.exEnd = this.gt + lead + dur + (e.type === 'big' || e.type === 'down' || e.type === 'finish' ? 0.55 : 0.35);
      // 콤보: 마지막 펀치 전까지 펀치마다 가볍게 맞는 반응
      if (mv?.combo) {
        let t2 = pre, d = mv.seq[0][1], n = 0;
        mv.seq.forEach(([, dd, end], i) => {
          const hitNo = end ? ++n : 0;
          if (i) { t2 += d * 0.85; d = dd; }
          if (end && i < mv.seq.length - 1) this.later((t2 + dd * 0.45) * 1000, () => {
            if (!live(def)) return;
            const [hx, hy] = this.headPos(def);
            def.anim = { kind: end.hit, t0: this.gt, dur: 0.22 }; def.kx = -def.d * 25; def.flash = 0.05;
            this.burst(hx - def.d * 4, hy + (end.dy || 1), false); this.sfx('hit', 0);
            // 필살기 연타 카운트업: 숫자가 커지고 흔들림·멈춤이 점점 세짐
            if (a.finisher) { this.text(`${hitNo} HIT`, att, '#ff1744', 0.9 + hitNo * 0.15, -18 - hitNo * 3, att.d * 8); this.shake = 0.3 + hitNo * 0.15; this.stop = 0.04 + hitNo * 0.02; this.cam.punch = 0.3 + hitNo * 0.05; }
          });
        });
      }
      // 필살기 시작: 섬광 + 공격자 줌인·스포트라이트
      if (a.finisher) {
        const [ax, ay] = this.headPos(att);
        this.flash = 0.35; this.invert = 0.06; this.hype = 1.5;
        this.dim = 1; this.spot = att;
        this.cam.punch = 0.45; this.cam.fx = ax; this.cam.fy = ay + 8;
        this.sfx('counter', 2);
      }
      // 펀치 없는 필살기: 움직임이 끝나면 라벨 (스포트라이트는 저절로 걷힘)
      if (a.showcase && mv) this.later((lead + dur) * 1000, () => { this.hype = 1.2; this.text(mv.label.replace(' COMBO!', '!!'), att, '#ff1744', 1.4, -28, att.d * 6); this.sfx('counter', 1); });
      if (a.counter) { this.text(pre ? `${DODGE_LABEL[a.from]} COUNTER!` : 'COUNTER!', att, '#ff1744', 1.1, -10); this.invert = 0.08; this.sfx('counter', 1); }
      if (landed && a.guard) {
        // 가드 위로 맞음: 맞는 반응 대신 막는 자세, 약한 충격
        this.later((lead + dur * 0.45) * 1000, () => {
          if (!live(def)) return;
          const [hx, hy] = this.headPos(def);
          def.anim = { kind: a.guard, t0: this.gt, dur: 0.35 };
          def.kx = -def.d * 25;
          this.stop = 0.04; this.shake = 0.15;
          this.burst(hx - def.d * 7, hy + (a.guard === 'roll' ? 6 : 2), false);
          this.text(a.guard === 'roll' ? 'ROLL' : 'GUARD', def, '#cfcfcf', 0.85, -12);
          const d = dmgOf(def.id);
          if (d) this.num(`-${d}`, hx - def.d * 4, hy - 5, false);
          this.sfx('hit', 0);
        });
      } else if (landed) {
        const big = e.type !== 'strike';
        this.later((lead + dur * 0.45) * 1000, () => {
          const [hx, hy] = this.headPos(def);
          const px = hx - def.d * 4, py = hy + (mv ? mv.dy || 1 : a.cat === 'kick' ? 4 : 1);
          if (live(def)) def.anim = { kind: mv ? mv.hit : 'hit', t0: this.gt, dur: big ? 0.5 : 0.32 }; // 데미지 · 효과는 그대로, 동작만 건너뜀
          // 필살기 마무리: 긴 슬로모션 + 반전 플래시 + 스피드라인 + 크게 밀려남 + 총 데미지
          if (a.finisher) {
            this.slowmo(0.3, 1.3); this.invert = 0.14; this.flash = 0.9; this.shake = 1.4; this.stop = 0.22;
            this.speedLines = { t0: this.rt, dur: 1.3 }; this.hype = 2; this.dim = 0;
            this.text(mv?.combo ? mv.label.replace(' COMBO!', '!!') : 'FINISH!!', att, '#ff1744', 1.7, -30, att.d * 6);
            this.later(10, () => { def.kx = -def.d * 150; def.vy = -50; });
            this.sfx('big', 2);
          } else if (mv?.combo) this.text(mv.label, att, '#ff1744', 1.1, -22, att.d * 6);
          else if (mv && !big) this.text(mv.label, att, a.cat === 'jab' ? '#cfcfcf' : '#ffffff', a.cat === 'jab' ? 0.7 : 0.9, -20, att.d * 6);
          if (mv && a.cat === 'body') this.spray(px, py, -def.d, 8, ['#cfefff', '#9fd8ff']);
          if (mv && a.cat === 'uppercut') this.spray(px, py - 2, 0, 6, ['#ffffff']);
          def.flash = big ? 0.1 : 0.06;
          def.kx = -def.d * (big ? 90 : 45);
          this.stop = big ? 0.16 : 0.06;
          this.sfx(e.type === 'down' ? 'down' : big ? 'big' : 'hit', e.type === 'down' ? 2 : big ? 1 : 0);
          this.burst(px, py, big);
          this.spray(px, py, -def.d, big ? 14 : 6, big ? ['#ffffff', '#cfefff', '#ff1744'] : ['#ffffff', '#cfefff']);
          this.shake = big ? 1 : 0.35;
          this.cam.punch = big ? 0.35 : 0.08; this.cam.fx = px; this.cam.fy = py;
          const d = dmgOf(def.id);
          if (d) a.finisher ? this.text(`-${d}`, def, '#ff1744', 1.6, -4) : this.num(`-${d}`, px, py - 6, big);
          if (big) {
            this.flash = 0.5; this.hype = Math.min(1.5, this.hype + 0.8);
            this.text(e.type === 'down' ? 'DOWN!' : ['BIG HIT!', 'BAM!', 'CRACK!'][Math.floor(Math.random() * 3)], def, '#ffffff', e.type === 'down' ? 1.6 : 1.3, -16);
          }
          if (e.type === 'down') {
            this.slowmo(0.35, 0.6);
            def.down = true; def.tLying = 1; def.vy = -70;
            this.stars(def, 1.6);
            this.later(1300, () => { if (!def.ko) { def.down = false; def.tLying = 0; } });
          }
        });
      } else if (e.type === 'miss') {
        this.later((lead + dur * 0.3) * 1000, () => {
          const dk = a.dodge;
          if (!live(def)) return;
          def.anim = { kind: DODGE_LABEL[dk] ? dk : 'dodge', t0: this.gt, dur: DODGE_DUR[dk] || 0.4 };
          const dm = DODGE_MOVE[dk]; // 백스텝·스텝은 빠지고, 위빙은 파고든다
          if (dm?.kx) def.kx = def.d * dm.kx;
          if (dm?.vy) def.vy = dm.vy;
          if (dk === 'block') { const [hx, hy] = this.headPos(def); this.burst(hx - def.d * 6, hy + 2, false); }
          this.text(dk ? DODGE_LABEL[dk] : 'MISS', def, dk ? '#ffffff' : '#8a8a8a', dk ? 0.9 : 0.8, -12);
          // 필살기 실패: 열기가 식고 공격자 위로 허탈한 MISS…
          if (a.finisher) { this.dim = 0; this.hype = 0; this.slowmo(0.5, 0.6); this.later(250, () => this.text('MISS…', att, '#8a8a8a', 1.4, -28)); }
          this.sfx(dk === 'block' ? 'hit' : 'miss', 0);
        });
      }
    } else if (a && att) {
      if (a.cat === 'takedown') {
        att.anim = { kind: 'shoot', t0: this.gt, dur: 0.5 };
        if (e.type === 'miss') this.later(260, () => { this.text('SPRAWL!', def, '#ffffff', 1, -12); this.dust(def.x, 6); this.sfx('sprawl', 1); });
        else this.later(300, () => {
          this.shake = 0.8; this.stop = 0.1; this.flash = 0.25; def.vy = -60;
          this.cam.punch = 0.2; this.cam.fx = def.x; this.cam.fy = FLOOR - 10;
          this.text('TAKEDOWN!', att, '#ffffff', 1.2, -16);
          this.sfx('slam', 1);
          this.later(220, () => this.dust((att.x + def.x) / 2, 14));
        });
      } else if (a.cat === 'clinch' && e.type !== 'miss') {
        att.anim = { kind: 'shoot', t0: this.gt, dur: 0.3 };
        this.text('CLINCH', att, '#bdbdbd', 0.8, -14);
      } else if (a.cat === 'ground' && e.type === 'td' && this.top && e.top && e.top !== this.top) {
        this.later(150, () => { this.text('SWEEP!', att, '#ff1744', 1.2, -14); this.shake = 0.5; this.dust(CX, 10); this.sfx('sweep', 1); });
      } else if (a.cat === 'submission') {
        if (e.type === 'sub') { this.lock(1.6); this.text('LOCKED!', att, '#ff1744', 1.2, -18); this.sfx('lock', 1); }
        else if (e.type === 'miss') this.text('...', att, '#8a8a8a', 0.9, -12);
        else if (e.type === 'info') { this.text('ESCAPE!', def, '#ffffff', 1, -14); this.sfx('escape', 1); }
      }
    }

    const apply = () => { this.pos = e.pos || 'stand'; this.top = e.top || null; };
    if (a && a.cat === 'takedown' && e.type === 'td') this.later(300, apply); else apply();

    if (e.type === 'finish') this.finish(e, result);
  }

  finish(e, result) {
    const method = result?.method;
    this.tbars = 1;
    if (!result || method === '판정') {
      this.later(250, () => {
        this.pos = 'stand'; this.top = null;
        this.banner(result?.winnerId ? 'DECISION' : 'DRAW', 3, { bars: true });
        this.sfx('bell2', 2);
        if (result?.winnerId) this.later(900, () => { this.f[result.winnerId].win = true; this.hype = 1.5; this.sfx('crowd', 2); this.sfx('fanfare', 2); });
      });
      return;
    }
    const loser = this.other(result.winnerId), winner = this.f[result.winnerId];
    const sub = method === '서브미션';
    this.later(sub ? 300 : 360, () => {
      if (sub) {
        this.lock(2.2, true); this.slowmo(0.5, 0.8); this.sfx('lock', 2);
        this.cam.punch = 0.5; this.cam.fx = (loser.x + winner.x) / 2; this.cam.fy = FLOOR - 8;
        [0, 260, 520].forEach((ms) => this.later(ms, () => { this.text('TAP', loser, '#ffffff', 1, -6 - Math.random() * 10, (Math.random() - 0.5) * 14); this.shake = 0.3; this.sfx('tap', 2); }));
        this.later(900, () => { this.banner('TAP OUT', 3.2, { bars: true, big: true }); this.hype = 2; this.flash = 0.6; this.sfx('bell2', 2); this.sfx('crowd', 2); });
        this.later(1600, () => this.sfx('fanfare', 2));
        this.later(1600, () => { this.pos = 'stand'; this.top = null; winner.win = true; loser.ko = true; loser.tLying = 1; });
      } else {
        // 드라마틱 KO: 히트스톱 → 반전 플래시 → 슬로모션 날아감 → 바운드 → 배너
        this.stop = 0.28; this.invert = 0.12; this.flash = 1; this.shake = 1.6;
        this.sfx('ko', 2);
        this.slowmo(0.25, 1.5);
        const [hx, hy] = this.headPos(loser);
        this.cam.punch = 0.6; this.cam.fx = hx; this.cam.fy = hy + 14;
        this.burst(hx - loser.d * 4, hy, true, true);
        this.spray(hx, hy, -loser.d, 26, ['#ffffff', '#ff1744', '#cfefff']);
        loser.ko = true; loser.tLying = 1; loser.vy = -150; loser.kx = -loser.d * 160;
        loser.anim = { kind: 'hit', t0: this.gt, dur: 0.6 };
        this.speedLines = { t0: this.rt, dur: 1.4 };
        this.later(700, () => { this.stars(loser, 99); });
        this.later(420, () => { this.banner(method === 'KO' ? 'K.O.' : 'T.K.O.', 3.4, { bars: true, big: true }); this.hype = 2; this.sfx('bell2', 2); this.sfx('crowd', 2); });
        this.later(1500, () => { winner.win = true; this.sfx('fanfare', 2); });
      }
    });
  }

  // 결과 바로 보기 — 마지막 상태로 즉시 이동
  snap(e, result) {
    this.q = []; this.fx = []; this.parts = []; this.stop = 0; this.slow = 1; this.speed = 4; this.lockOn = 0;
    if (e) { this.pos = e.pos; this.top = e.top; }
    this.tbars = 1;
    if (result && result.method !== '판정') {
      const loser = this.other(result.winnerId);
      this.pos = 'stand'; this.top = null;
      loser.ko = true; loser.tLying = 1; this.f[result.winnerId].win = true;
      if (result.method !== '서브미션') this.stars(loser, 99);
      this.banner(result.method === 'KO' ? 'K.O.' : result.method === 'TKO' ? 'T.K.O.' : 'TAP OUT', 3, { bars: true, big: true });
    } else {
      this.pos = 'stand'; this.top = null;
      if (result?.winnerId) this.f[result.winnerId].win = true;
      this.banner(result?.winnerId ? 'DECISION' : 'DRAW', 3, { bars: true });
    }
    this.layout(true);
  }

  // ── 데모 (로그인 화면)
  // 대진이 여러 개면 11번 주고받을 때마다 다음 대진으로 (옷 · 장비 · 머리가 바뀐다)
  nextBout() {
    this.bouts = 0; this.comboBy = null;
    this.castI = (this.castI + 1) % this.cast.length;
    const [L, R] = this.cast[this.castI], [a, b] = this.fighters;
    a.look = lookOf({ ...L, id: a.id }); b.look = lookOf({ ...R, id: b.id });
    this.flash = 0.35; this.hype = 0.6;
    this.text(`ROUND ${this.castI + 1}`, a, '#ffffff', 1.5, -30, 22);
    this.demoTimer = setTimeout(() => this.running && this.demoTick(), 1400);
  }
  demoTick() {
    if (this.cast?.length > 1 && ++this.bouts > 11) return this.nextBout();
    const [a, b] = this.fighters;
    // 맞힌 쪽이 이어서 치는 연타 (40%) — 한 번씩 주고받기만 하면 단조로워서
    const att = this.comboBy && Math.random() < 0.7 ? this.comboBy : Math.random() < 0.5 ? a : b;
    const DEMO = [['jab', 'jab'], ['jab', 'onetwo'], ['jab', 'double'], ['jab', 'straight'], ['hook', 'hook'], ['hook', 'shorthook'], ['hook', 'overhand'], ['uppercut', 'uppercut'], ['uppercut', 'shortupper'], ['body', 'bodystraight'], ['body', 'bodyhook'], ['body', 'liver'], ['body', 'bodyupper']];
    const [cat, move] = DEMO[Math.floor(Math.random() * DEMO.length)], name = '';
    const type = Math.random() < 0.3 ? 'miss' : Math.random() < 0.18 ? 'big' : 'strike';
    const kinds = Object.keys(DODGE_LABEL), pickK = () => kinds[Math.floor(Math.random() * kinds.length)];
    const dodge = type === 'miss' ? pickK() : undefined;
    const guard = type === 'strike' && Math.random() < 0.25 ? (Math.random() < 0.5 ? 'block' : 'roll') : undefined;
    const counter = type === 'strike' && !guard && Math.random() < 0.15;
    this.play({ type, act: { att: att.id, cat, name, move, dodge, guard, counter, from: counter ? pickK() : undefined }, pos: 'stand', top: null });
    this.comboBy = type !== 'miss' && Math.random() < 0.4 ? att : null;
    const want = this.comboBy ? 380 + Math.random() * 220 : 700 + Math.random() * 900;
    this.demoTimer = setTimeout(() => this.running && this.demoTick(), Math.max(want, this.busyLeft() + (this.comboBy ? 60 : 160)));
  }

  // ── 효과 생성
  burst(x, y, big, huge) { this.fx.push({ kind: 'burst', x, y, t0: this.rt, dur: huge ? 0.6 : big ? 0.4 : 0.22, big, huge }); }
  whoosh(f, kind) { this.fx.push({ kind: 'whoosh', f, t0: this.rt, dur: 0.22, low: kind === 'kick', style: kind }); }
  text(text, f, color, size = 1, dy = -14, dx = 0) {
    const [hx, hy] = this.headPos(f);
    this.fx.push({ kind: 'text', text, x: hx + dx, y: hy + dy, t0: this.rt, dur: 1, color, size });
  }
  num(text, x, y, big) { this.fx.push({ kind: 'text', text, x: x + (Math.random() - 0.5) * 6, y, t0: this.rt, dur: 0.8, color: big ? '#ff1744' : '#ffffff', size: big ? 1.15 : 0.85, num: true }); }
  lock(dur, tap) { this.fx = this.fx.filter((x) => x.kind !== 'lock'); this.fx.push({ kind: 'lock', t0: this.rt, dur, tap }); }
  stars(f, dur) { this.fx = this.fx.filter((x) => !(x.kind === 'stars' && x.f === f)); this.fx.push({ kind: 'stars', f, t0: this.rt, dur }); }
  banner(text, dur = 1.2, o = {}) {
    this.fx = this.fx.filter((x) => x.kind !== 'banner');
    this.fx.push({ kind: 'banner', text, t0: this.rt, dur, ...o });
    if (o.bars) { this.tbars = 1; if (!o.big) setTimeout(() => { if (!this.fx.some((x) => x.kind === 'banner' && x.big)) this.tbars = 0; }, dur * 1000 / Math.min(this.speed, 3)); }
  }
  slowmo(f, dur) { this.slow = f; this.slowT = dur; }
  spray(x, y, dir, n, cols) {
    for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: dir * (30 + Math.random() * 90) + (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 70, life: 0.4 + Math.random() * 0.5, c: cols[i % cols.length], g: 260, s: Math.random() < 0.3 ? 2 : 1 });
  }
  dust(x, n) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 16, y: FLOOR - 1, vx: (Math.random() - 0.5) * 60, vy: -10 - Math.random() * 25, life: 0.5 + Math.random() * 0.4, c: i % 2 ? '#9c9c9c' : '#c4c4c4', g: 30, s: 2 });
  }

  // ── 루프
  loop(ts) {
    if (!this.running) return;
    const raw = Math.min(0.1, Math.max(0, (ts - this.last) / 1000)); this.last = ts;
    const sp = Math.min(this.speed, 3);
    const rdt = raw * sp;
    this.rt += rdt;
    // 히트스톱 / 슬로모션
    let gdt = rdt;
    if (this.stop > 0) { this.stop -= raw; gdt = 0; }
    else if (this.slowT > 0) { this.slowT -= raw; gdt *= this.slow; if (this.slowT <= 0) this.slow = 1; }
    this.gt += gdt;
    // 예약 실행
    if (this.q.length) {
      const due = this.q.filter((x) => x.at <= this.gt);
      if (due.length) { this.q = this.q.filter((x) => x.at > this.gt); due.forEach((x) => x.fn()); }
    }
    this.update(gdt, rdt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt, rdt) {
    this.layout();
    const k = 1 - Math.exp(-dt * 6);
    for (const f of this.fighters) {
      f.x += (f.tx - f.x) * k + f.kx * dt;
      f.kx *= Math.exp(-dt * 7);
      f.x = Math.max(16, Math.min(LW - 16, f.x));
      if (f.vy || f.y < 0) {
        f.vy += 420 * dt; f.y += f.vy * dt;
        if (f.y >= 0) {
          f.y = 0;
          if (f.vy > 90) { f.vy = -f.vy * 0.32; this.dust(f.x - f.d * 10, 8); this.shake = Math.max(this.shake, 0.6); this.sfx('bounce', 1); }
          else f.vy = 0;
        }
      }
      const rate = f.ko ? 5 : 9;
      f.lying += (f.tLying - f.lying) * (1 - Math.exp(-dt * rate));
      f.flash = Math.max(0, f.flash - rdt);
      f.blink -= dt; if (f.blink < -0.12) f.blink = 2 + Math.random() * 3;
    }
    for (const p of this.parts) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.y > FLOOR + 2 && p.g > 100) { p.y = FLOOR + 2; p.vy *= -0.3; p.vx *= 0.6; } }
    this.parts = this.parts.filter((p) => p.life > 0).slice(-160);
    this.fx = this.fx.filter((x) => this.rt - x.t0 < x.dur);
    this.shake = Math.max(0, this.shake - rdt * 2.6);
    this.flash = Math.max(0, this.flash - rdt * 3);
    this.invert = Math.max(0, this.invert - rdt);
    this.hype = Math.max(0, this.hype - rdt * 0.35);
    this.bars += (this.tbars - this.bars) * (1 - Math.exp(-rdt * 10));
    if (this.stop <= 0) this.dim = Math.max(0, this.dim - rdt * 0.7); // 필살기 스포트라이트는 서서히 걷힘
    // 카메라: 두 선수 중간을 따라가고, 타격 순간 임팩트 지점으로 펀치 줌
    const [a, b] = this.fighters;
    const lockFx = this.fx.find((x) => x.kind === 'lock');
    const baseZ = this.demo ? 1 : (this.pos === 'stand' ? 1.18 : 1.35) + (lockFx ? 0.25 : 0);
    const mx = (a.x + b.x) / 2;
    const tx = lerp(mx, this.cam.fx, Math.min(1, this.cam.punch * 2));
    const ty = lerp(this.pos === 'stand' ? 54 : 60, this.cam.fy, Math.min(1, this.cam.punch * 2));
    const kk = 1 - Math.exp(-rdt * 8);
    this.cam.x += (tx - this.cam.x) * kk; this.cam.y += (ty - this.cam.y) * kk;
    this.cam.z += (baseZ + this.cam.punch - this.cam.z) * (1 - Math.exp(-rdt * 14));
    this.cam.punch = Math.max(0, this.cam.punch - rdt * (this.slow < 1 ? 0.25 : 0.9));
  }

  // ── 그리기 (월드 버퍼)
  draw() {
    const w = this.w;
    w.imageSmoothingEnabled = false;
    this.drawStage(w);
    // 그림자
    for (const f of this.fighters) {
      const sw = 12 + f.lying * 16, sx = f.x - f.d * f.lying * 12;
      w.fillStyle = 'rgba(0,0,0,.28)';
      w.fillRect(Math.round(sx - sw / 2), FLOOR - 1, Math.round(sw), 2);
      w.fillRect(Math.round(sx - sw / 2 + 2), FLOOR + 1, Math.round(sw - 4), 1);
    }
    // 누운 선수 먼저
    const fs = [...this.fighters].sort((p, q) => q.lying - p.lying);
    for (const f of fs) this.drawFighter(w, f);
    for (const x of this.fx) this.drawWorldFx(w, x);
    for (const p of this.parts) { w.globalAlpha = Math.min(1, p.life * 3); w.fillStyle = p.c; w.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    w.globalAlpha = 1;
    this.present();
  }

  drawStage(w) {
    const t = this.rt;
    w.fillStyle = '#000'; w.fillRect(0, 0, LW, LH);
    // 스포트라이트 빔
    w.save(); w.globalAlpha = 0.06 + this.hype * 0.03; w.fillStyle = '#fff';
    for (const [x0, x1] of [[CX - 46, CX - 8], [CX + 8, CX + 46]]) {
      w.beginPath(); w.moveTo(x0 + 30, 0); w.lineTo(x1 + 18, 0); w.lineTo(x1, FLOOR); w.lineTo(x0, FLOOR); w.closePath(); w.fill();
    }
    w.restore();
    // 관중 (실루엣) — 흥분하면 점프
    this.crowd.forEach((row, ri) => {
      const by = 26 + ri * 9;
      for (const c of row) {
        const j = Math.round(Math.max(0, Math.sin(t * 9 + c.p)) * this.hype * 2.5);
        w.fillStyle = ri ? '#161616' : '#0e0e0e';
        w.fillRect(c.x, by - 5 - j - c.s, 4, 4); w.fillRect(c.x - 1, by - 1 - j - c.s, 6, 8);
        if (this.hype > 0.6 && Math.sin(t * 9 + c.p) > 0.6 && c.s === 1) { w.fillRect(c.x - 2, by - 8 - j, 1, 4); w.fillRect(c.x + 5, by - 8 - j, 1, 4); }
      }
    });
    // 카메라 플래시
    const flashes = 0.04 + this.hype * 0.35;
    if (Math.random() < flashes) this.fx.push({ kind: 'camflash', x: 2 + Math.random() * (LW - 4), y: 10 + Math.random() * 24, t0: this.rt, dur: 0.09 });
    // 매트
    const top = 52;
    w.fillStyle = '#d8d8d8'; w.fillRect(0, top, LW, LH - top);
    w.fillStyle = '#bcbcbc'; w.fillRect(0, top, LW, 3);
    // 디더 그늘 (가장자리)
    w.fillStyle = '#b4b4b4';
    for (let y = top + 3; y < 84; y += 1) for (let x = (y % 2); x < LW; x += 2) {
      const e = Math.abs(x - CX) / CX;
      if (e > 0.72 || (y < top + 6 && x % 4 === 0)) w.fillRect(x, y, 1, 1);
    }
    if (logoDark) { w.globalAlpha = 0.13; w.drawImage(logoDark, CX - 26, top + 7, 52, 15); w.globalAlpha = 1; }
    // 뒤쪽 로프 & 포스트
    for (const [i, y] of [[0, 32], [1, 39], [2, 46]].map(([i, y]) => [i, y])) {
      w.fillStyle = i === 1 ? '#ff1744' : '#f0f0f0'; w.globalAlpha = 0.85; w.fillRect(18, y, LW - 36, 1); w.globalAlpha = 1;
    }
    for (const x of [16, LW - 19]) { w.fillStyle = '#fff'; w.fillRect(x, 28, 3, 26); w.fillStyle = '#000'; w.fillRect(x, 28, 3, 2); }
    // 옆 로프: 뒤 기둥에서 앞 기둥으로 비스듬히 내려오는 3줄 (양쪽). 가로 로프만 있으면 링이 벽처럼 보여서
    const BACK = [32, 39, 46], FRONT = [61, 70, 79];
    const rope = (x0, y0, x1, y1, c) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      w.fillStyle = c;
      for (let k = 0; k <= n; k++) w.fillRect(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), 1, 1);
    };
    BACK.forEach((yb, i) => {
      const c = i === 1 ? '#ff1744' : '#f0f0f0';
      w.globalAlpha = 0.85;
      rope(17, yb, 2, FRONT[i], c);           // 왼쪽
      rope(LW - 18, yb, LW - 3, FRONT[i], c); // 오른쪽
      w.globalAlpha = 1;
    });
    // 뒤 기둥 코너 패드 (로프가 묶이는 자리)
    for (const x of [16, LW - 19]) BACK.forEach((yb, i) => { w.fillStyle = i === 1 ? '#ff1744' : '#9a9a9a'; w.fillRect(x, yb - 1, 3, 3); });
    // 앞 에이프런
    w.fillStyle = '#000'; w.fillRect(0, 84, LW, LH - 84);
    w.fillStyle = '#fff'; w.fillRect(0, 84, LW, 1);
    w.fillStyle = '#ff1744'; w.fillRect(0, 86, LW, 1);
    if (logoImg.complete && logoImg.naturalWidth) w.drawImage(logoImg, CX - 13, 89, 26, 9);
    w.fillStyle = '#3a3a3a';
    for (let x = 6; x < LW; x += 12) if (Math.abs(x - CX) > 20) w.fillRect(x, 93, 6, 1);
    // 앞 포스트
    for (const x of [0, LW - 4]) { w.fillStyle = '#fff'; w.fillRect(x, 58, 4, 32); w.fillStyle = '#ff1744'; w.fillRect(x, 58, 4, 3); }
    // 앞 기둥 코너 패드 (옆 로프가 묶이는 자리)
    for (const x of [0, LW - 4]) [61, 70, 79].forEach((yf, i) => { w.fillStyle = i === 1 ? '#ff1744' : '#9a9a9a'; w.fillRect(x, yf - 1, 4, 3); });
  }

  drawFighter(w, f) {
    const t = this.gt;
    let pose = { kind: 'idle', k: 0, hand: f.hand, face: f.blink < 0 ? 'blink' : 'normal' };
    const an = f.anim;
    if (an) {
      const p = (t - an.t0) / an.dur;
      if (p > 1) f.anim = null;
      else {
        pose.kind = an.kind; pose.hand = an.hand; pose.p = p;
        pose.k = an.kind === 'shoot' ? Math.min(1, easeOut(p * 1.6)) * (p > 0.8 ? (1 - p) * 5 : 1) : bump(p);
        if (['punch', 'kick', 'knee', 'elbow', 'gnp', 'jab', 'cross', 'hook', 'upper', 'body', 'shorthook', 'overhand', 'shortupper', 'bodyhook', 'bodyupper'].includes(an.kind)) pose.face = 'effort';
      }
    }
    if (!f.anim && this.pos === 'clinch' && f.lying < 0.5) pose.kind = 'clinch';
    if (f.win && !f.anim) pose.kind = 'win';
    pose.ko = f.ko; pose.down = f.down;
    pose.kneel = this.isMount(f);
    const standing = f.lying < 0.5 && !pose.kneel;
    pose.bob = standing && this.pos !== 'ground' ? (Math.sin(t * (f.win ? 12 : 7) + f.look.phase) > 0.2 ? 1 : 0) : 0;
    if (f.win) pose.bob = Math.sin(t * 10) > 0 ? 1 : 0;
    const g = f.sp.getContext('2d');
    drawSprite(g, f.look, f.st, pose);
    if (f.flash > 0) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over'; }
    w.save();
    const winHop = f.win ? -Math.round(Math.abs(Math.sin(t * 5)) * 3) : 0;
    w.translate(Math.round(f.x), Math.round(FLOOR + f.y - f.lying * 6 + (pose.kneel ? -3 : 0) + winHop));
    w.scale(f.d, 1);
    if (f.lying > 0.02) w.rotate(-f.lying * Math.PI / 2);
    w.drawImage(f.sp, -OX, -OY);
    w.restore();
  }

  drawWorldFx(w, x) {
    const p = (this.rt - x.t0) / x.dur;
    if (x.kind === 'camflash') {
      w.fillStyle = '#fff'; w.fillRect(Math.round(x.x), Math.round(x.y), 1, 1);
      w.globalAlpha = 0.6; w.fillRect(Math.round(x.x) - 1, Math.round(x.y), 3, 1); w.fillRect(Math.round(x.x), Math.round(x.y) - 1, 1, 3); w.globalAlpha = 1;
    } else if (x.kind === 'burst') {
      // 도트 임팩트: 별 모양 광선 + 링
      const R = (x.huge ? 22 : x.big ? 13 : 7) * easeOut(p * 1.4);
      const n = x.big ? 10 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (x.big ? 0.2 : 0.4);
        const len = i % 2 ? R : R * 0.6;
        for (let r = R * 0.35; r < len; r += 1) {
          w.fillStyle = r > len - 2 ? '#ff1744' : '#ffffff';
          if (!x.big && r > len - 2) w.fillStyle = '#ffffff';
          w.fillRect(Math.round(x.x + Math.cos(a) * r), Math.round(x.y + Math.sin(a) * r), 1, 1);
        }
      }
      if (p < 0.35) { w.fillStyle = '#fff'; const s = x.big ? 5 : 3; w.fillRect(Math.round(x.x - s / 2), Math.round(x.y - s / 2), s, s); }
      if (x.big) {
        w.strokeStyle = '#fff'; w.globalAlpha = 1 - p; w.lineWidth = 1;
        w.beginPath(); w.arc(Math.round(x.x) + 0.5, Math.round(x.y) + 0.5, R * 1.25, 0, Math.PI * 2); w.stroke(); w.globalAlpha = 1;
      }
    } else if (x.kind === 'whoosh') {
      const f = x.f, [hx, hy] = this.headPos(f);
      w.globalAlpha = 1 - p; w.fillStyle = f.look.gear?.trail || '#fff'; // 브랜드 글러브는 궤적도 브랜드 색 (상점)
      if (x.style === 'arc') { // 훅: 바깥에서 휘어 들어오는 궤적
        for (let i = 0; i < 7; i++) { const t = (i / 6) * Math.min(1, p * 1.6), ang = -Math.PI * 0.9 + t * Math.PI * 0.9; w.fillRect(Math.round(f.x + f.d * (6 + Math.cos(ang) * 9)), Math.round(hy + 3 + Math.sin(ang) * 6), 2, 1); }
        w.globalAlpha = 1;
      } else if (x.style === 'up') { // 어퍼컷: 아래에서 위로
        for (let i = 0; i < 3; i++) { const len = 5 + i * 2, xx = f.x + f.d * (11 + i * 2); w.fillRect(Math.round(xx), Math.round(hy + 12 - p * 12 - len + i * 2), 1, len); }
        w.globalAlpha = 1;
      } else {
      const y0 = x.low ? FLOOR - 16 : x.style === 'low' ? hy + 12 : hy + 2;
      for (let i = 0; i < 3; i++) {
        const len = 6 + i * 2, xx = f.x + f.d * (10 + p * 10);
        w.fillRect(Math.round(f.d > 0 ? xx - len : xx), Math.round(y0 + (i - 1) * 3), len, 1);
      }
      w.globalAlpha = 1;
      }
    } else if (x.kind === 'stars') {
      const [hx, hy] = this.headPos(x.f);
      for (let i = 0; i < 3; i++) {
        const a = this.rt * 4 + (i * Math.PI * 2) / 3;
        const sx = Math.round(hx + Math.cos(a) * 8), sy = Math.round(hy - 7 + Math.sin(a) * 3);
        w.fillStyle = i === 1 ? '#ff1744' : '#fff';
        w.fillRect(sx, sy - 1, 1, 3); w.fillRect(sx - 1, sy, 3, 1);
      }
    } else if (x.kind === 'lock') {
      const [a, b] = this.fighters;
      const mx = Math.round((a.x + b.x) / 2), my = FLOOR - 10;
      const pulse = Math.sin(this.rt * 16) > 0 ? 1 : 0;
      const r = 11 + pulse;
      w.fillStyle = x.tap ? '#ff1744' : '#fff';
      for (let i = 0; i < 16; i++) {
        if (i % 2) continue;
        const an = (i / 16) * Math.PI * 2 + this.rt * 2;
        w.fillRect(Math.round(mx + Math.cos(an) * r), Math.round(my + Math.sin(an) * r * 0.6), 2, 1);
      }
    }
  }

  // ── 화면 출력 (카메라 + 오버레이)
  present() {
    const c = this.ctx, W = this.cw, H = this.ch;
    const z = this.cam.z, vw = LW / z, vh = LH / z;
    const x0 = Math.max(0, Math.min(LW - vw, this.cam.x - vw / 2));
    const y0 = Math.max(0, Math.min(LH - vh, this.cam.y - vh / 2));
    const S = W / vw;
    const shx = (Math.random() - 0.5) * 8 * this.shake * this.dpr, shy = (Math.random() - 0.5) * 8 * this.shake * this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.drawImage(this.world, x0, y0, vw, vh, shx - 4 * this.dpr * this.shake, shy, W + 8 * this.dpr * this.shake, H);
    // 필살기 스포트라이트: 공격자 주변만 밝게
    if (this.dim > 0.01 && this.spot) {
      const sx = (this.spot.x - x0) * S, sy = (FLOOR - 18 - y0) * S;
      const g = c.createRadialGradient(sx, sy, W * 0.08, sx, sy, W * 0.65);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.78 * this.dim})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    const toS = (wx, wy) => [(wx - x0) * S + shx, (wy - y0) * S + shy];
    const px = H / 100; // 화면 기준 단위

    // 이름표
    if (!this.demo) for (const f of this.fighters) {
      if (!f.name) continue;
      const [hx, hy] = this.headPos(f);
      const [sx, sy] = toS(hx, hy - (f.lying > 0.5 ? 10 : 12));
      c.font = `700 ${Math.round(5.2 * px)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText(f.name).width + 6 * px;
      c.fillStyle = 'rgba(0,0,0,.8)'; c.fillRect(Math.round(sx - tw / 2), Math.round(sy - 4 * px), Math.round(tw), Math.round(8 * px));
      c.fillStyle = f.st.tag; c.fillRect(Math.round(sx - tw / 2), Math.round(sy + 4 * px - px * 0.8), Math.round(tw), Math.max(1, Math.round(px * 0.8)));
      c.fillStyle = '#fff'; c.fillText(f.name, sx, sy);
    }

    // 스피드 라인 (KO 슬로모션)
    if (this.speedLines && this.rt - this.speedLines.t0 < this.speedLines.dur) {
      const p = (this.rt - this.speedLines.t0) / this.speedLines.dur;
      c.save(); c.globalAlpha = 0.55 * (1 - p); c.fillStyle = '#fff';
      const cx = W / 2, cy = H / 2;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 + (hash(i) % 10) / 20;
        const r0 = Math.max(W, H) * (0.42 + ((hash(i * 7 + Math.floor(this.rt * 20)) % 20) / 100));
        const r1 = Math.max(W, H) * 0.9;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        c.lineTo(cx + Math.cos(a + 0.025) * r1, cy + Math.sin(a + 0.025) * r1);
        c.lineTo(cx + Math.cos(a - 0.025) * r1, cy + Math.sin(a - 0.025) * r1);
        c.fill();
      }
      c.restore();
    }

    // 서브미션 비네트
    const lockFx = this.fx.find((x) => x.kind === 'lock');
    if (lockFx) {
      const pulse = 0.35 + Math.sin(this.rt * 10) * 0.12;
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, lockFx.tap ? `rgba(120,0,0,${pulse + 0.2})` : `rgba(0,0,0,${pulse + 0.25})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }

    // 텍스트 FX
    for (const x of this.fx) {
      if (x.kind !== 'text') continue;
      const p = (this.rt - x.t0) / x.dur;
      const pop = p < 0.12 ? 1.7 - (p / 0.12) * 0.7 : 1;
      const [sx, sy] = toS(x.x, x.y - easeOut(p) * (x.num ? 10 : 6));
      const size = Math.round(9 * px * x.size * pop);
      c.save();
      c.globalAlpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
      c.font = `700 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = Math.max(2, size * 0.28); c.strokeStyle = '#000';
      c.strokeText(x.text, sx, sy);
      c.fillStyle = x.color; c.fillText(x.text, sx, sy);
      c.restore();
    }

    // 레터박스
    if (this.bars > 0.01) {
      const bh = Math.round(this.bars * H * 0.13);
      c.fillStyle = '#000'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
    }

    // 배너
    const bn = this.fx.find((x) => x.kind === 'banner');
    if (bn) this.drawBanner(c, bn, W, H, px);

    // 플래시 / 반전
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(0.85, this.flash * 0.8)})`; c.fillRect(0, 0, W, H); }
    if (this.invert > 0) { c.globalCompositeOperation = 'difference'; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
  }

  drawBanner(c, x, W, H, px) {
    const p = (this.rt - x.t0) / x.dur;
    const tin = clamp01((this.rt - x.t0) / 0.22);
    const out = p > 0.85 ? (1 - p) / 0.15 : 1;
    c.save();
    c.globalAlpha = out;
    // 슬래시 띠
    const bandH = (x.big ? 30 : x.small ? 14 : 22) * px;
    const cy = H / 2;
    c.fillStyle = 'rgba(0,0,0,.72)';
    c.beginPath(); c.moveTo(0, cy - bandH / 2 + 4 * px); c.lineTo(W, cy - bandH / 2 - 4 * px); c.lineTo(W, cy + bandH / 2 - 4 * px); c.lineTo(0, cy + bandH / 2 + 4 * px); c.fill();
    c.fillStyle = '#fff'; c.fillRect(0, cy - bandH / 2 - 6 * px + (1 - tin) * 20 * px, W * tin, Math.max(2, px));
    c.fillStyle = '#ff1744'; c.fillRect(W * (1 - tin), cy + bandH / 2 + 4 * px, W * tin, Math.max(2, px));
    // 글자: 왼쪽에서 오버슈트로 날아 들어옴
    const ov = tin < 1 ? (1 - easeOut(tin)) * -W * 0.7 + Math.sin(tin * Math.PI) * 6 * px : 0;
    const shakeT = x.big && p < 0.15 ? (Math.random() - 0.5) * 4 * px : 0;
    const size = Math.round((x.big ? 26 : x.small ? 10 : 17) * px);
    c.font = `700 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tx = W / 2 + ov + shakeT, ty = cy - (x.sub ? 3 * px : 0) + shakeT;
    c.fillStyle = '#ff1744'; c.fillText(x.text, tx + 2 * px, ty + 2 * px);
    c.lineWidth = Math.max(3, size * 0.16); c.strokeStyle = '#000'; c.lineJoin = 'round'; c.strokeText(x.text, tx, ty);
    c.fillStyle = '#fff'; c.fillText(x.text, tx, ty);
    if (x.sub && p > 0.45) {
      const sp = clamp01((p - 0.45) / 0.1);
      const s2 = Math.round(9 * px * (1.8 - sp * 0.8));
      c.font = `700 ${s2}px ${FONT}`;
      c.lineWidth = Math.max(2, s2 * 0.25); c.strokeText(x.sub, W / 2, cy + 9 * px);
      c.fillStyle = '#ff1744'; c.fillText(x.sub, W / 2, cy + 9 * px);
    }
    c.restore();
  }
}
