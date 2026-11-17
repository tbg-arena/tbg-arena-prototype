// 경기: 치르기 · 전적 반영 · 관전 여부 (다른 기능에서도 가져다 쓰는 함수)
const { db } = require('../core/db');
const { uid, now } = require('../core/util');
const { simulateFight, combatPower } = require('./engine');
const { skillsOf } = require('../skills/model');
const { refresh } = require('../attendance/model');

const FINISH_TITLE_AT = 5; // 같은 기술로 5번 피니시 → 칭호

// 회원이 아직 중계를 안 본 경기 = 그 회원에게는 결과를 숨길 경기
const unseenOf = (me) => db.fights.filter((f) => (f.a === me.id && !f.seenA) || (f.b === me.id && !f.seenB));
// 보는 사람이 그 경기 중계를 봤는지 (me 없음 = 코치)
const seenBy = (f, me) => (me ? (f.a === me.id ? f.seenA : f.b === me.id ? f.seenB : true) : f.seenCoach);

function runFight(A, B) {
  refresh(A); refresh(B);
  const sa = skillsOf(A.id), sb = skillsOf(B.id);
  const pa = combatPower(A, sa), pb = combatPower(B, sb);
  const sim = simulateFight(
    { id: A.id, name: A.name, stats: A.stats, strategy: A.strategy, skills: sa, finisher: A.finisher },
    { id: B.id, name: B.name, stats: B.stats, strategy: B.strategy, skills: sb, finisher: B.finisher },
  );
  const f = {
    id: uid(), a: A.id, b: B.id, aName: A.name, bName: B.name, powerA: pa, powerB: pb,
    createdAt: now(), events: sim.events, result: sim.result, maxHp: sim.maxHp, roundSec: sim.roundSec, seenA: false, seenB: false, seenCoach: false,
  };

  // 결과 반영
  const { winnerId, method, skill } = sim.result;
  const exp = 1 / (1 + Math.pow(10, ((B.points - A.points) / 400))); // Elo 기대 승률
  const K = 40;
  const scoreA = winnerId === A.id ? 1 : winnerId === B.id ? 0 : 0.5;
  const dA = Math.round(K * (scoreA - exp) + (winnerId === A.id && method !== '판정' ? 8 : 0));
  const dB = Math.round(K * ((1 - scoreA) - (1 - exp)) + (winnerId === B.id && method !== '판정' ? 8 : 0));
  f.delta = { [A.id]: dA, [B.id]: dB };
  applyRecord(A, f); applyRecord(B, f);
  // 경기에서 성공한 기술은 숙련 +1 (최대 3개). 오른 기술은 경기에 기록해 두고, 중계 보기 전엔 숨긴다
  f.gains = {};
  for (const [mid, list] of Object.entries(sim.landed)) {
    for (const sid of list.slice(0, 3)) {
      const s = db.skills.find((x) => x.id === sid);
      if (s && s.memberId === mid && s.mastery < 100) { s.mastery++; f.gains[sid] = (f.gains[sid] || 0) + 1; }
    }
  }
  db.fights.push(f);
  return f;
}

// 경기 결과를 선수 전적에 반영 (승패·KO·포인트·팬·연승·피니시 칭호)
function applyRecord(m, f) {
  const { winnerId, method, skill } = f.result || {};
  m.points = Math.max(0, m.points + (f.delta?.[m.id] || 0));
  if (!winnerId) { m.draws++; m.streak = 0; m.fans += 5; }
  else if (winnerId === m.id) {
    m.wins++; m.streak = Math.max(1, m.streak + 1);
    m.fans += method === '판정' ? 10 : 25;
    if (method === 'KO' || method === 'TKO') m.kos++;
    if (method === '서브미션') m.subs++;
    if (skill && method !== '판정') { m.finishes = m.finishes || {}; m.finishes[skill] = (m.finishes[skill] || 0) + 1; }
  } else { m.losses++; m.streak = Math.min(-1, m.streak - 1); m.fans += 3; }
}

// 남아 있는 경기 기록으로 전적을 처음부터 다시 계산 (경기가 지워졌을 때)
// data: { members, fights } — 이번 요청의 db 또는 계산용 복사본
function rebuildRecords(data) {
  const byId = new Map(data.members.map((m) => [m.id, m]));
  for (const m of data.members) Object.assign(m, { wins: 0, losses: 0, draws: 0, kos: 0, subs: 0, points: 1000, fans: 0, finishes: {}, streak: 0 });
  for (const f of data.fights.slice().sort((a, b) => a.createdAt - b.createdAt)) {
    for (const id of [f.a, f.b]) if (byId.has(id)) applyRecord(byId.get(id), f);
  }
}

function fightSummary(f) {
  return {
    id: f.id, a: f.a, b: f.b, aName: f.aName, bName: f.bName, powerA: f.powerA, powerB: f.powerB,
    result: f.result, createdAt: f.createdAt, delta: f.delta,
  };
}

module.exports = { FINISH_TITLE_AT, unseenOf, seenBy, runFight, applyRecord, rebuildRecords, fightSummary };
