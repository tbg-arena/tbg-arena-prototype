// 콤비네이션: 콤비 글자를 동작으로 나누고, 회원이 배운 기술로 이뤄졌으면 '열림'
// 열린 콤비는 회원이 필살기로 장착 (글자 → 내 기술 id 목록, fighter 의 필살기 형식 그대로)
// 콤비 목록은 db.combos (코치가 추가·수정·삭제). 처음엔 list.js 기본값 (migrate.js)
const { db } = require('../core/db');
const { CATEGORIES, FIN_LEN } = require('../fights/engine');
const { skillsOf } = require('../skills/model');

// 콤비 글자 사전: [띄어쓰기 뺀 글자, 화면 이름, 분류, 세부 기술]. 배열 앞쪽부터 맞추므로 긴 글자를 먼저 둔다
// 세부 기술이 null = 그 분류의 아무 기술 (예: '바디'). 모든 글자가 경기 동작 — 새 동작이 필요하면 fights/engine.js MOVES 에 먼저 추가
const WORDS = [
  ['바디스트레이트', '바디 스트레이트', 'body', 'bodystraight'],
  ['라이트바디훅', '라이트 바디 훅', 'body', 'bodyhook'],
  ['바디잽', '바디 잽', 'body', 'bodystraight'],
  ['바디훅', '바디 훅', 'body', 'bodyhook'],
  ['바디어퍼', '바디 어퍼', 'body', 'bodyupper'],
  ['리버', '리버샷', 'body', 'liver'],
  ['버티컬훅', '버티컬 훅', 'hook', 'shorthook'],
  ['체크훅', '체크 훅', 'hook', 'checkhook'],
  ['숏훅', '숏 훅', 'hook', 'shorthook'],
  ['오버핸드', '오버핸드', 'hook', 'overhand'],
  ['스트레이트', '스트레이트', 'jab', 'straight'],
  ['블라인드', '블라인드', 'jab', 'pin'],
  ['핀', '핀', 'jab', 'pin'],
  ['숄더롤', '숄더롤', 'defense', 'roll'],
  ['숄더', '숄더롤', 'defense', 'roll'],
  ['백스텝', '백스텝', 'defense', 'back'],
  ['스웨이', '스웨이', 'defense', 'sway'],
  ['블로킹', '블락', 'defense', 'block'],
  ['블락', '블락', 'defense', 'block'],
  ['가드', '가드', 'defense', 'block'],
  ['범퍼', '범퍼', 'defense', 'block'],
  ['더킹', '더킹', 'defense', 'duck'],
  ['딥', '딥', 'defense', 'duck'],
  ['패링', '패링', 'defense', 'parry'],
  ['패리', '패링', 'defense', 'parry'],
  ['위빙', '위빙', 'defense', 'weave'],
  ['슬립', '슬립', 'defense', 'slip'],
  ['워킹스텝', '워킹 스텝', 'step', 'walk'],
  ['점프스텝', '점프 스텝', 'step', 'jump'],
  ['사이드스텝', '사이드 스텝', 'step', 'side'],
  ['피벗스텝', '피벗', 'step', 'pivot'],
  ['L스텝', 'L 스텝', 'step', 'lstep'],
  ['점프', '점프 스텝', 'step', 'jump'],
  ['사이드', '사이드 스텝', 'step', 'side'],
  ['피벗', '피벗', 'step', 'pivot'],
  ['스텝', '스텝', 'step', 'walk'],
  ['원투', '원투', 'jab', 'onetwo'],
  ['어퍼컷', '어퍼', 'uppercut', 'uppercut'],
  ['어퍼', '어퍼', 'uppercut', 'uppercut'],
  ['바디', '바디', 'body', null],
  ['잽', '잽', 'jab', 'jab'],
  ['원', '원', 'jab', 'jab'],
  ['투', '투', 'jab', 'straight'],
  ['훅', '훅', 'hook', 'hook'],
];
const MAX_REPEAT = 8; // '어퍼X5' 같은 반복 표기 상한
const squash = (t) => t.replace(/[\s,]/g, '');
const isWord = (t) => WORDS.some(([key]) => key === squash(t));

// 글자 → 동작 목록 [{ label, cat, move }] (+ .unknown: 못 알아본 글자, 코치 저장 때 막는 데 씀)
// 괄호는 동작이면 살리고 '(핀)', 메모면 버림 '(대각선)'. 방향 '왼)' '오)' '백)' '위로)', 쉼표는 무시
function parse(text) {
  const s = squash(String(text).replace(/\(([^)]*)\)/g, (m, inner) => (isWord(inner) ? ` ${inner} ` : ' ')).replace(/(왼|오|백|위로)\)/g, ''));
  const out = [];
  let unknown = '';
  for (let i = 0; i < s.length;) {
    const rep = /^[Xx×](\d+)/.exec(s.slice(i));
    if (rep && out.length) { // 앞 동작 반복: 어퍼X5 = 어퍼 5번
      for (let k = 1; k < Math.min(Number(rep[1]), MAX_REPEAT); k++) out.push(out[out.length - 1]);
      i += rep[0].length; continue;
    }
    const w = WORDS.find(([key]) => s.startsWith(key, i));
    if (!w) { unknown += s[i]; i++; continue; }
    out.push({ label: w[1], cat: w[2], move: w[3] });
    i += w[0].length;
  }
  out.unknown = unknown;
  return out;
}
// 코치 저장 전 검사: 동작이 하나 이상 · 모르는 글자 없음 → null, 아니면 안내 문구
function checkText(text) {
  const p = parse(text);
  if (p.unknown) return `모르는 동작이 있어요: '${p.unknown}'. 띄어쓰기로 나눠 적었는지 확인해 주세요.`;
  if (!p.length) return '동작을 하나 이상 적어 주세요.';
  return null;
}
// 코치가 등록한 콤비는 모두 필살기로 쓸 수 있다 (동작 1개 이상). 펀치 없이 디펜스·스텝만이어도 됨
const usable = (parts) => parts.length >= FIN_LEN.min;
const cache = new Map(); // 글자 → 나눈 결과 (요청마다 db 가 바뀌어도 같은 글자면 재사용)
const parsedOf = (text) => { if (!cache.has(text)) cache.set(text, parse(text)); return cache.get(text); };
const allCombos = () => (db.combos || []).map((c) => ({ ...c, parts: parsedOf(c.text) }));
const usableCombos = () => allCombos().filter((c) => usable(c.parts));
const partsView = (parts) => parts.map((p) => ({ label: p.label, kind: CATEGORIES[p.cat].group }));
// 코치 화면용: 나눈 동작
const comboView = (c) => ({ id: c.id, text: c.text, parts: partsView(c.parts) });

// 동작 하나에 쓸 내 기술: 같은 세부 기술 중 숙련 높은 것. 공격은 같은 분류 아무 기술도 됨 (잽 → 원투 기술)
// 방어 · 스텝은 동작이 달라서 (슬립 ≠ 위빙, 사이드 ≠ 피벗) 같은 세부 기술만
function pickSkill(part, mine) {
  const best = (xs) => xs.sort((a, b) => b.mastery - a.mastery)[0] || null;
  const same = mine.filter((s) => s.category === part.cat);
  const exact = best(same.filter((s) => !part.move || s.move === part.move));
  if (exact || CATEGORIES[part.cat]?.group !== 'attack') return exact;
  return best(same);
}

// 회원의 콤비 목록: open = 동작 모두 내 기술로 가능
function combosOf(memberId, finisher) {
  const mine = skillsOf(memberId).filter((s) => CATEGORIES[s.category]);
  const fin = (finisher || []).join(',');
  return usableCombos().map((c) => {
    const game = c.parts;
    const picks = game.map((p) => pickSkill(p, mine));
    const ids = picks.filter(Boolean).map((s) => s.id).slice(0, FIN_LEN.max);
    const open = picks.every(Boolean);
    const missing = [...new Set(game.filter((p, i) => !picks[i]).map((p) => p.label))];
    return {
      id: c.id, text: c.text, open, missing, hits: ids.length, ids,
      parts: partsView(c.parts),
      equipped: open && !!fin && ids.join(',') === fin,
    };
  });
}

module.exports = { parse, checkText, combosOf, allCombos, comboView };
