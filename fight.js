// TBG ARENA 경기 엔진 (복싱) — 능력치 + 배운 기술(숙련) + 전략으로 3분 3라운드 자동 시뮬레이션
// 배운 기술만 경기에 나오고, 숙련이 높을수록 자주 나오고 잘 들어간다.

// attack: 공격 기술 / defense: 상대 펀치를 피하고 받아치는 데 쓰임 (공격으로는 안 나옴)
const CATEGORIES = {
  jab:      { label: '잽·스트레이트', icon: '👊', group: 'attack',  target: 'head', dmg: 0.8,  acc: 0.08 },
  hook:     { label: '훅',           icon: '🪝', group: 'attack',  target: 'head', dmg: 1.15, acc: 0,     big: 0.04 },
  uppercut: { label: '어퍼컷',        icon: '⤴️', group: 'attack',  target: 'head', dmg: 1.25, acc: -0.04, big: 0.03 },
  body:     { label: '바디샷',        icon: '🎯', group: 'attack',  target: 'body', dmg: 0.8,  acc: 0.02,  gas: 7 },
  defense:  { label: '디펜스',        icon: '🛡️', group: 'defense' },
};
const FOCUS_CATS = { 헤드: ['jab', 'hook', 'uppercut'], 바디: ['body'] };

const ROUNDS = 3;
const ROUND_SEC = 180;
const MAX_HP = 100;
const DMG_SCALE = 0.72; // 전체 데미지 배율 (낮을수록 판정까지 가는 경기 ↑)

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function weighted(items, wfn) {
  const ws = items.map(wfn);
  let r = Math.random() * ws.reduce((s, w) => s + w, 0);
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
// 한국어 조사 (받침 유무)
function josa(word, pair) {
  const c = String(word).charCodeAt(String(word).length - 1);
  const j = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
  const jong = j !== 0;
  if (pair === '으로') return word + (jong && j !== 8 ? '으로' : '로'); // ㄹ받침은 '로'
  const [withJ, noJ] = { 이가: ['이', '가'], 을를: ['을', '를'], 은는: ['은', '는'], 과와: ['과', '와'] }[pair];
  return word + (jong ? withJ : noJ);
}

function combatPower(m, skills) {
  const st = Object.values(m.stats).reduce((s, v) => s + v, 0);
  const top = skills.map((s) => s.mastery).sort((a, b) => b - a).slice(0, 8);
  return Math.round(st * 6 + top.reduce((s, v) => s + v, 0) * 0.8 + skills.length * 3);
}

function simulateFight(A, B) {
  const known = (p) => p.skills.filter((s) => CATEGORIES[s.category]);
  const mk = (p) => {
    const skills = known(p);
    const defs = skills.filter((s) => CATEGORIES[s.category].group === 'defense');
    return {
      ...p, skills, st: p.stats, strat: p.strategy, hp: MAX_HP, gas: 100, score: 0, landed: {},
      attacks: skills.filter((s) => CATEGORIES[s.category].group === 'attack'),
      defs, defM: defs.reduce((mx, s) => Math.max(mx, s.mastery), 0), // 가장 잘하는 디펜스 숙련
    };
  };
  const F = { [A.id]: mk(A), [B.id]: mk(B) };
  const other = (id) => (id === A.id ? F[B.id] : F[A.id]);
  const events = [];
  const pos = 'stand', top = null;
  let r = 1, t = 0, result = null;

  const hpSnap = () => ({ [A.id]: Math.round(F[A.id].hp), [B.id]: Math.round(F[B.id].hp) });
  let act = null; // 애니메이션용: 이번 공방의 공격자와 기술 분류
  const ev = (type, text, by) => events.push({ r, t: Math.min(Math.round(t), ROUND_SEC), type, text, by: by || null, hp: hpSnap(), pos, top, act });
  const finish = (winner, method, skill) => {
    result = { winnerId: winner.id, method, skill: skill || null, round: r, time: Math.min(Math.round(t), ROUND_SEC) };
  };
  const gasF = (f) => 0.6 + 0.4 * (f.gas / 100);
  const drain = (f, base) => { f.gas = clamp(f.gas - base * (1.45 - f.st.stamina / 100), 5, 100); };
  const useDefense = (f) => (f.defs.length ? weighted(f.defs, (s) => s.mastery + 5) : null);
  // 애니메이션용 회피 동작 (기술 이름으로 추정)
  const dodgeKind = (n) => (/위빙|더킹|덕|웨이브|보빙/.test(n) ? 'duck' : /블로킹|블록|가드|커버/.test(n) ? 'block' : /패리|파링/.test(n) ? 'parry' : /백스텝|스텝|풋워크/.test(n) ? 'back' : 'slip');

  function chooseSkill(f) {
    if (!f.attacks.length) return null;
    const prefer = new Set((f.strat.focus || []).flatMap((x) => FOCUS_CATS[x] || []));
    return weighted(f.attacks, (s) => {
      let w = Math.pow(s.mastery + 5, 1.25);
      if (prefer.has(s.category)) w *= 1.7;
      if (f.strat.style === '아웃복싱') { if (s.category === 'jab') w *= 1.6; if (s.category === 'uppercut') w *= 0.6; }
      if (f.strat.style === '인파이팅' && ['hook', 'uppercut', 'body'].includes(s.category)) w *= 1.3;
      return w;
    });
  }

  function successProb(att, def, s) {
    const cat = CATEGORIES[s.category];
    let p = 0.42 + cat.acc + (s.mastery - 40) / 180 + (att.st.speed - def.st.speed) / 120 + (att.st.iq - def.st.iq) / 150;
    const g = def.strat.guard;
    if (g === '하이가드') p += cat.target === 'body' ? 0.04 : s.category === 'uppercut' ? -0.02 : -0.08;
    else if (g === '숄더롤') p += s.category === 'jab' ? -0.1 : s.category === 'hook' ? 0.03 : -0.03;
    else p -= 0.04; // 밸런스
    if (att.strat.stance !== def.strat.stance && att.strat.stance === '사우스포') p += 0.03;
    p -= def.defM / 700; // 디펜스 숙련이 높을수록 덜 맞는다
    return clamp(p * gasF(att), 0.08, 0.88);
  }

  function hit(att, def, s, scale = 1) {
    const cat = CATEGORIES[s.category];
    let dmg = (4 + att.st.power * 0.22 + s.mastery * 0.08) * cat.dmg * rand(0.7, 1.3) * scale * DMG_SCALE / (1 + def.st.chin / 60);
    const big = Math.random() < 0.06 + (cat.big || 0) + s.mastery / 1000 + att.st.power / 1500;
    if (big) dmg *= 1.8;
    if (cat.gas) drain(def, cat.gas);
    def.hp = Math.max(0, def.hp - dmg);
    att.score += dmg;
    (att.landed[s.id] = (att.landed[s.id] || 0) + 1);
    return { dmg, big };
  }

  function exchange() {
    // 1) 공격권: 스피드·스타일·체력
    const [a, b] = [F[A.id], F[B.id]];
    const w = (f) => f.st.speed * ({ 인파이팅: 1.35, 카운터: 0.8, 아웃복싱: 1 }[f.strat.style] || 1) * gasF(f) + 3;
    const att = Math.random() < w(a) / (w(a) + w(b)) ? a : b;
    const def = other(att.id);
    const s = chooseSkill(att);
    act = s ? { att: att.id, cat: s.category, name: s.name } : null;

    // 2) 쓸 수 있는 공격 기술이 없을 때
    if (!s) {
      if (Math.random() < 0.25) ev('info', pick([`${josa(att.name, '이가')} 거리를 재며 탐색전을 이어간다.`, `${att.name}, 페인트로 상대를 흔들어 본다.`]), att.id);
      return;
    }

    const cat = CATEGORIES[s.category];
    const name = `${att.name}의`;
    drain(att, 3);

    if (Math.random() < successProb(att, def, s)) {
      const { dmg, big } = hit(att, def, s);
      if (def.hp <= 0) {
        if (cat.target === 'body') ev('finish', `${name} ${s.name}!!! ${josa(def.name, '이가')} 배를 움켜쥐고 무릎을 꿇는다! 카운트 아웃!`, att.id);
        else ev('finish', big ? `${name} ${s.name}!!! ${josa(def.name, '이가')} 그대로 쓰러진다! 경기 끝!` : `${name} ${s.name}! 연타가 쏟아지고 심판이 경기를 멈춘다!`, att.id);
        return finish(att, big || cat.target === 'body' ? 'KO' : 'TKO', s.name);
      }
      if (big) {
        ev('big', cat.target === 'body'
          ? `${name} ${josa(s.name, '이가')} 깊숙이 박힌다! ${josa(def.name, '이가')} 몸을 웅크린다!`
          : `${name} ${josa(s.name, '이가')} 제대로 꽂힌다! ${josa(def.name, '이가')} 크게 흔들린다!`, att.id);
        if (def.hp < 45 && Math.random() < 0.5) {
          att.score += 8; // 다운은 10-8 라운드에 가깝게
          ev('down', `다운! ${josa(def.name, '이가')} 캔버스에 주저앉는다! 심판 카운트!`, att.id);
          if (def.hp < 25 && Math.random() < 0.6) {
            ev('finish', `${josa(def.name, '이가')} 카운트 안에 일어나지 못한다! 경기 끝!`, att.id);
            return finish(att, 'KO', s.name);
          }
          ev('info', `${josa(def.name, '이가')} 가까스로 일어나 파이팅 포즈를 잡는다.`, def.id);
        }
      } else {
        ev('strike', pick([
          `${name} ${josa(s.name, '이가')} 정확히 들어간다.`,
          `${name} ${s.name}! 깔끔하게 적중.`,
          `${josa(att.name, '이가')} ${josa(s.name, '을를')} 꽂아 넣는다.`,
        ]) + (dmg > 9 ? ' 묵직하다!' : ''), att.id);
      }
      return;
    }

    // 3) 빗나감 — 디펜스 기술로 피했다면 숙련 성장 대상, 카운터 기회
    const dSkill = useDefense(def);
    if (dSkill) {
      (def.landed[dSkill.id] = (def.landed[dSkill.id] || 0) + 1);
      act = { ...act, dodge: dodgeKind(dSkill.name) };
      def.score += 0.3;
      ev('miss', `${name} ${s.name}, ${josa(def.name, '이가')} ${josa(dSkill.name, '으로')} 흘려낸다.`, def.id);
    } else if (Math.random() < 0.35) ev('miss', `${name} ${s.name}, ${josa(def.name, '이가')} 피해낸다.`, def.id);

    const counterChance = (def.strat.style === '카운터' ? 0.12 : 0.04) + (def.strat.guard === '숄더롤' ? 0.04 : 0) + def.defM / 700;
    if (def.attacks.length && Math.random() < counterChance) {
      const cs = weighted(def.attacks, (x) => x.mastery + 5);
      act = { att: def.id, cat: cs.category, name: cs.name, counter: true };
      const { big } = hit(def, att, cs, 0.8);
      if (att.hp <= 0) {
        ev('finish', `카운터!!! ${def.name}의 ${josa(cs.name, '이가')} 정확히 걸렸다! ${josa(att.name, '이가')} 쓰러진다!`, def.id);
        return finish(def, 'KO', cs.name);
      }
      ev(big ? 'big' : 'strike', `카운터! ${def.name}의 ${josa(cs.name, '이가')} 받아친다${big ? '! 크게 흔들린다!' : '.'}`, def.id);
    }
  }

  const roundScores = [];
  for (r = 1; r <= ROUNDS && !result; r++) {
    t = 0;
    F[A.id].score = 0; F[B.id].score = 0;
    act = null;
    ev('round', `${r}라운드 시작!`);
    while (!result) {
      t += rand(6, 14);
      if (t >= ROUND_SEC) break;
      exchange();
    }
    if (result) break;
    t = ROUND_SEC;
    roundScores.push({ [A.id]: F[A.id].score, [B.id]: F[B.id].score });
    const lead = F[A.id].score === F[B.id].score ? null : (F[A.id].score > F[B.id].score ? F[A.id] : F[B.id]);
    act = null;
    ev('round', `${r}라운드 종료. ${lead ? `${josa(lead.name, '이가')} 조금 더 많은 것을 보여준 라운드.` : '팽팽한 라운드였다.'}`);
    for (const f of Object.values(F)) f.gas = clamp(f.gas + 30, 0, 100);
  }
  if (!result) r = ROUNDS;

  // 판정: 심판 3명이 라운드별 10-9 채점 (오차 포함)
  if (!result) {
    act = null;
    const cards = [0, 1, 2].map(() => {
      let sa = 0, sb = 0;
      for (const rs of roundScores) {
        const x = rs[A.id] * rand(0.85, 1.15), y = rs[B.id] * rand(0.85, 1.15);
        if (Math.abs(x - y) < 1) { sa += 10; sb += 10; }
        else if (x > y) { sa += 10; sb += x - y > 25 ? 8 : 9; }
        else { sb += 10; sa += y - x > 25 ? 8 : 9; }
      }
      return [sa, sb];
    });
    const aWins = cards.filter(([x, y]) => x > y).length, bWins = cards.filter(([x, y]) => y > x).length;
    const cardText = cards.map(([x, y]) => `${x}-${y}`).join(', ');
    t = ROUND_SEC;
    if (aWins === bWins) {
      result = { winnerId: null, method: '판정', detail: '무승부', round: ROUNDS, time: ROUND_SEC, cards };
      ev('finish', `판정 결과… 무승부! (${cardText})`);
    } else {
      const w = aWins > bWins ? F[A.id] : F[B.id];
      const detail = Math.max(aWins, bWins) === 3 ? '만장일치' : Math.min(aWins, bWins) === 0 ? '다수' : '스플릿';
      result = { winnerId: w.id, method: '판정', detail, round: ROUNDS, time: ROUND_SEC, cards };
      ev('finish', `판정 결과… ${detail} 판정으로 ${w.name}의 승리! (${cardText})`, w.id);
    }
  }

  const landed = {};
  for (const f of Object.values(F)) landed[f.id] = Object.entries(f.landed).sort((x, y) => y[1] - x[1]).map(([id]) => id);
  return { events, result, landed, maxHp: MAX_HP, roundSec: ROUND_SEC };
}

module.exports = { simulateFight, combatPower, CATEGORIES, ROUND_SEC };
