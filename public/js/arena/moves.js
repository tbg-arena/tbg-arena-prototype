// 기술별 경기 동작: 어떤 동작으로 치고(seq), 어떤 궤적(trail)이 나고, 어떻게 맞는지(hit)
// 새 세부 기술을 만들면 서버 lib/fights/engine.js 의 MOVES 와 여기 MOVE_FX, sprite.js 의 포즈를 같이 맞춘다.
export const STRIKES = ['punch', 'kick', 'knee', 'elbow', 'jab', 'hook', 'uppercut', 'body'];
// 복싱 기술별 동작: seq(연속 동작) · 궤적(trail) · 맞는 반응(hit) · 라벨
// a.move: 세부 기술 (예전 경기 기록에는 없어서 이름으로 추정)
export const MOVE_FX = {
  jab: { seq: [['jab', 0.2]], trail: 'straight', hit: 'hit', label: 'JAB' },
  onetwo: { seq: [['jab', 0.2], ['cross', 0.26]], trail: 'straight', hit: 'hit', label: 'ONE-TWO' },
  double: { seq: [['jab', 0.18], ['jab', 0.2]], trail: 'straight', hit: 'hit', label: 'DOUBLE JAB' },
  straight: { seq: [['cross', 0.28]], trail: 'straight', hit: 'hit', label: 'STRAIGHT' },
  hook: { seq: [['hook', 0.38]], trail: 'arc', hit: 'hitSide', label: 'HOOK!' },
  shorthook: { seq: [['shorthook', 0.28]], trail: 'arc', hit: 'hitSide', label: 'SHORT HOOK' },
  overhand: { seq: [['overhand', 0.44]], trail: 'arc', hit: 'hitSide', label: 'OVERHAND!' },
  uppercut: { seq: [['upper', 0.42]], trail: 'up', hit: 'hitUp', label: 'UPPERCUT!', dy: 3 },
  shortupper: { seq: [['shortupper', 0.3]], trail: 'up', hit: 'hitUp', label: 'SHORT UPPER', dy: 4 },
  bodystraight: { seq: [['body', 0.34]], trail: 'low', hit: 'hitBody', label: 'BODY!', dy: 12 },
  bodyhook: { seq: [['bodyhook', 0.38]], trail: 'low', hit: 'hitBody', label: 'BODY HOOK!', dy: 11 },
  liver: { seq: [['bodyhook', 0.4]], trail: 'low', hit: 'hitBody', label: 'LIVER!', dy: 13 },
  bodyupper: { seq: [['bodyupper', 0.36]], trail: 'up', hit: 'hitBody', label: 'BODY UPPER!', dy: 10 },
};
export function guessMove(cat, name) {
  const n = String(name || '').replace(/\s/g, '');
  if (cat === 'jab') return /원투|1-2/.test(n) ? 'onetwo' : /더블|트리플/.test(n) ? 'double' : /스트레이트|크로스/.test(n) ? 'straight' : 'jab';
  if (cat === 'hook') return /오버핸드/.test(n) ? 'overhand' : /숏|쇼트/.test(n) ? 'shorthook' : 'hook';
  if (cat === 'uppercut') return /숏|쇼트/.test(n) ? 'shortupper' : 'uppercut';
  if (cat === 'body') return /리버/.test(n) ? 'liver' : /어퍼/.test(n) ? 'bodyupper' : /훅/.test(n) ? 'bodyhook' : 'bodystraight';
  return null;
}
export const boxingMove = (a) => MOVE_FX[a.move] || MOVE_FX[guessMove(a.cat, a.name)] || null;
export const DODGE_LABEL = { slip: 'SLIP', duck: 'DUCK', weave: 'WEAVE', roll: 'ROLL', block: 'BLOCK', parry: 'PARRY', back: 'BACKSTEP' };
export const DODGE_DUR = { duck: 0.5, weave: 0.55, back: 0.45 };
// 콤보: 들어간 펀치·방어 동작을 이어 붙인다. seq 셋째 칸 = 그 펀치가 끝나는 지점(중간 타격 연출용), 넷째 칸 = 방어 동작
export function comboMove(parts) {
  const ms = parts.filter((p) => p.cat !== 'defense').map(boxingMove).filter(Boolean);
  if (!ms.length) return null;
  const last = ms[ms.length - 1];
  const seq = parts.flatMap((p) => {
    if (p.cat === 'defense') return DODGE_LABEL[p.move] ? [[p.move, 0.3, null, true]] : [];
    const m = boxingMove(p);
    return m ? m.seq.map(([k, d], i) => [k, d, i === m.seq.length - 1 ? m : null]) : [];
  });
  while (seq.length && seq[seq.length - 1][3]) seq.pop(); // 마지막 펀치 뒤 방어 동작은 생략 (타격 연출이 펀치에 맞게)
  return { seq, trail: ms[0].trail, hit: last.hit, dy: last.dy, label: `${ms.length} HIT COMBO!`, combo: true };
}
