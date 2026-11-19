// 배운 것 넣기: 회원이 받은 주차 기록 (db.lessons) + 넣기 · 되돌리기
// 커리큘럼은 db.curriculum (코치가 추가·수정·삭제, 순서 = 주차 번호). 처음엔 curriculum.js 기본값 (migrate.js)
// 기록 1개 = { id, memberId, weekId, week, final, day, at, skillId?, created?, bump?, stats? }
//   weekId: 받은 주차 (번호는 코치가 순서를 바꾸면 달라지므로 id로 가리킨다. week 는 받을 때 번호, 참고용)
//   final: 받을 때 마지막 주차였음 = 완주
//   created: 이 수업으로 새로 만든 기술 (되돌리면 삭제) / bump: 이미 있던 기술에 올린 숙련 (되돌리면 그만큼 내림)
//   stats: 이 주차로 실제 오른 능력치 (상한에 걸리면 덜 오름 → 되돌릴 때도 그만큼만)
const { db } = require('../core/db');
const { uid, now, today, clamp } = require('../core/util');
const { FIN_LEN } = require('../fights/engine');
const { skillsOf } = require('../skills/model');

const START_MASTERY = 10; // 처음 배운 기술 숙련
const REPEAT_BUMP = 5;    // 이미 있는 기술을 또 배우면 숙련 + (코치 화면의 +5 버튼과 같은 폭)
const MAX_SKILLS = 30;    // skills/routes 의 회원당 기술 상한과 같게

const weeks = () => db.curriculum || [];
const posOf = (weekId) => weeks().findIndex((w) => w.id === weekId) + 1; // 지금 몇 주차인지 (0 = 지워진 주차)

const lessonsOf = (id) => db.lessons.filter((l) => l.memberId === id);
// 받은 순서대로 정렬한 기록
const sortedOf = (id) => lessonsOf(id).sort((a, b) => a.at - b.at);
// 가장 최근에 받은 주차 (코치 화면 '지난번'). 지워진 주차 기록은 건너뜀
const lastWeek = (id) => sortedOf(id).map((l) => posOf(l.weekId)).filter(Boolean).at(-1) || 0;
const dayLesson = (id, day) => lessonsOf(id).find((l) => l.day === day) || null;
const todayLesson = (id) => dayLesson(id, today());
const todayWeek = (id) => { const l = todayLesson(id); return l ? posOf(l.weekId) || l.week : null; };
// 완주 횟수 = 마지막 주차를 받은 횟수 (받을 때 기준이라, 나중에 주차를 늘려도 그대로)
const lapsOf = (id) => lessonsOf(id).filter((l) => l.final).length;

// 다음에 넣을 주차 (코치 화면에 미리 채워지는 값)
// 이번 회차(마지막 완주 뒤)에서 받은 가장 큰 주차 + 1. 마지막 주차를 받으면 다음은 1주 (2회차 복습)
// 가장 큰 주차 기준이라, 코치가 복습으로 앞 주차를 넣어도 진도가 뒤로 밀리지 않는다
function nextWeek(id) {
  const ls = sortedOf(id);
  const round = ls.slice(ls.map((l) => !!l.final).lastIndexOf(true) + 1);
  const max = round.reduce((w, l) => Math.max(w, posOf(l.weekId)), 0);
  return Math.min(weeks().length, max + 1);
}

// 주차 하나 넣기. 오늘 이미 받았으면 null (두 번 넣지 않게)
function give(m, week) {
  const w = weeks()[week - 1];
  if (!w || todayLesson(m.id)) return null;
  const rec = { id: uid(), memberId: m.id, weekId: w.id, week, final: week === weeks().length, day: today(), at: now() };
  if (w.skill) {
    const [name, category, move] = w.skill;
    const mine = skillsOf(m.id);
    const s = mine.find((x) => x.name === name);
    if (s) {
      const before = s.mastery;
      s.mastery = clamp(before + REPEAT_BUMP, 1, 100);
      Object.assign(rec, { skillId: s.id, bump: s.mastery - before });
    } else if (mine.length < MAX_SKILLS) {
      const ns = { id: uid(), memberId: m.id, name, category, move, mastery: START_MASTERY, desc: `${week}주차 수업`, createdAt: now() };
      db.skills.push(ns);
      Object.assign(rec, { skillId: ns.id, created: true });
    }
  }
  rec.stats = addStats(m, w.stats);
  db.lessons.push(rec);
  return rec;
}

// 능력치 올리기 → 실제 오른 양. 출석 성장과 같은 상한 99 (코치가 준 100은 깎지 않음)
const STAT_MAX = 99;
function addStats(m, stats) {
  const delta = {};
  for (const [k, v] of Object.entries(stats || {})) {
    if (!(k in m.stats)) continue;
    const cur = m.stats[k];
    m.stats[k] = clamp(cur + v, 0, Math.max(STAT_MAX, cur));
    if (m.stats[k] !== cur) delta[k] = (delta[k] || 0) + (m.stats[k] - cur);
  }
  return delta;
}
function subStats(m, delta) {
  for (const [k, d] of Object.entries(delta || {})) if (k in m.stats) m.stats[k] = clamp(m.stats[k] - d, 0, Math.max(STAT_MAX, m.stats[k]));
}

// 그날 넣은 것 되돌리기 (기본 오늘): 새로 만든 기술은 삭제(필살기에서도 빼기), 올린 숙련은 내림
function undoDay(m, day = today()) {
  const rec = dayLesson(m.id, day);
  if (!rec) return false;
  const s = rec.skillId && db.skills.find((x) => x.id === rec.skillId);
  if (s && rec.created) {
    db.skills = db.skills.filter((x) => x.id !== s.id);
    if (m.finisher) { const f = m.finisher.filter((id) => id !== s.id); m.finisher = f.length >= FIN_LEN.min ? f : null; }
  } else if (s && rec.bump) s.mastery = clamp(s.mastery - rec.bump, 1, 100);
  subStats(m, rec.stats);
  db.lessons = db.lessons.filter((l) => l.id !== rec.id);
  return true;
}

// ── 오늘 한 운동: 운동마다 그 능력치를 조금 더 올린다 (출석 성장 위에 얹는 보너스)
// 운동 하나당 합계 +1 (능력치 두 개짜리는 +0.5씩). 오른 양은 m.train[날짜] 에 보관 → 출석을 지우면 되돌림
const TRAININGS = [
  ['fit', '체력운동', { stamina: 1 }],
  ['mitt', '미트', { speed: 1 }],
  ['bag', '샌드백', { power: 1 }],
  ['spar', '스파링', { iq: 0.5, chin: 0.5 }],
  ['rope', '줄넘기', { stamina: 0.5, speed: 0.5 }],
  ['core', '코어·근력', { power: 0.5, chin: 0.5 }],
].map(([id, label, stats]) => ({ id, label, stats }));
function untrain(m, day = today()) {
  const t = m.train?.[day];
  if (!t) return false;
  subStats(m, t.delta);
  delete m.train[day];
  return true;
}

// 오늘 운동 기록 (다시 저장하면 앞 기록을 되돌리고 새로 적용). 반환: 적용된 운동 id 목록
function train(m, kinds) {
  untrain(m);
  const picked = TRAININGS.filter((t) => (kinds || []).includes(t.id));
  if (!picked.length) return [];
  const delta = {};
  for (const t of picked) for (const [k, d] of Object.entries(addStats(m, t.stats))) delta[k] = (delta[k] || 0) + d;
  m.train = { ...(m.train || {}), [today()]: { kinds: picked.map((t) => t.id), delta } };
  return picked.map((t) => t.id);
}

module.exports = { weeks, TRAININGS, lessonsOf, lastWeek, nextWeek, lapsOf, todayLesson, todayWeek, give, undoDay, train, untrain };
