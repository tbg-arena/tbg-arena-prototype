// 게임 속 선수: 전략 선택지, 보는 사람 기준 공개 정보 (다른 기능에서도 가져다 쓰는 함수)
const { db } = require('../core/db');
const { combatPower } = require('../fights/engine');
const { skillsOf } = require('../skills/model');
const { refresh } = require('../attendance/model');
const { FINISH_TITLE_AT, unseenOf, rebuildRecords } = require('../fights/model');

const STRATEGY = {
  stance: ['오소독스', '사우스포'],
  guard: ['하이가드', '숄더롤', '밸런스'],
  style: ['인파이팅', '카운터', '아웃복싱'],
  focus: ['헤드', '바디'],
};

// 다른 기능이 선수 정보에 값을 보태는 연결 지점 (예: shop → 장비 색 · 코인)
const lookParts = [];
const privateParts = [];
const addLook = (fn) => { lookParts.push(fn); };              // fn(m) → { 색 이름: 값 } — 캐릭터 그림(sprite.js)에 쓰임
const addPrivateFields = (fn) => { privateParts.push(fn); };  // fn(m, view) → { 필드: 값 } — 본인·코치만 보는 정보
const memberLook = (m) => Object.assign({}, ...lookParts.map((fn) => fn(m)));
addLook((m) => (m.god ? { halo: true } : {})); // 신 등급 후광 (members/migrate.js)

// 보는 회원 기준 전적: 안 본 경기를 빼고 다시 계산 (안 본 경기가 없으면 null = 저장된 전적 그대로)
function viewFor(me) {
  if (!me) return null;
  const unseen = unseenOf(me);
  if (!unseen.length) return null;
  const hidden = new Set(unseen.map((f) => f.id));
  const copy = { members: db.members.map((m) => ({ id: m.id })), fights: db.fights.filter((f) => !hidden.has(f.id)) };
  rebuildRecords(copy);
  const gain = new Map(); // 안 본 경기에서 오른 숙련도
  for (const f of unseen) for (const [sid, n] of Object.entries(f.gains || {})) gain.set(sid, (gain.get(sid) || 0) + n);
  return { hidden, gain, rec: new Map(copy.members.map((r) => [r.id, r])) };
}
// 보는 회원 기준 기술 목록 (안 본 경기에서 오른 숙련도는 빼고)
const skillsView = (id, view) => skillsOf(id).map((s) => (view?.gain.has(s.id) ? { ...s, mastery: s.mastery - view.gain.get(s.id) } : s));

function publicMember(m, view) {
  refresh(m);
  const skills = skillsView(m.id, view);
  const r = view?.rec.get(m.id) || m; // 전적은 보는 사람 기준
  return {
    id: m.id, name: m.name, gender: m.gender || 'M', look: memberLook(m),
    stats: Object.fromEntries(Object.entries(m.stats).map(([k, v]) => [k, Math.floor(v)])),
    power: combatPower(m, skills),
    wins: r.wins, losses: r.losses, draws: r.draws, kos: r.kos, subs: r.subs,
    points: r.points, fans: r.fans, streak: r.streak,
    titles: Object.entries(r.finishes || {}).filter(([, c]) => c >= FINISH_TITLE_AT).map(([k]) => k),
    skillCount: skills.length,
  };
}

function privateMember(m, view) {
  return {
    ...publicMember(m, view),
    statsRaw: m.stats, strategy: m.strategy, finisher: m.finisher || null, finishes: (view?.rec.get(m.id) || m).finishes || {},
    attended: m.attended, attendCount: m.attendCount || 0,
    ...Object.assign({}, ...privateParts.map((fn) => fn(m, view))),
  };
}

module.exports = { STRATEGY, viewFor, skillsView, publicMember, privateMember, addLook, addPrivateFields, memberLook };
