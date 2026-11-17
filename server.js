// TBG ARENA - 의존성 없는 Node.js 서버 (로컬: JSON 파일 / Vercel: Redis 저장, store.js 참고)
// 복싱 육성 시뮬레이션: 체육관 출석·실제 배운 기술 → 성장 → 콜아웃 → 자동 경기 시뮬레이션
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { simulateFight, combatPower, CATEGORIES, MOVES, guessMove, validMove, COMBO_MAX } = require('./fight');
const store = require('./store');

const PORT = process.env.PORT || 3000;
const COACH_PIN = process.env.COACH_PIN || '1234';
const PUBLIC_DIR = path.join(__dirname, 'public');

// ───────── 밸런스 ─────────
const BASE_STATS = { power: 8, speed: 8, stamina: 8, iq: 8, chin: 8 };
const STAT_MAX = 99;
const ATTEND_GAIN = 1.5;          // 출석 1회당 능력치 성장 기준치 (높을수록 성장 둔화)
const FINISH_TITLE_AT = 5;        // 같은 기술로 5번 피니시 → 칭호
const STRATEGY = {
  stance: ['오소독스', '사우스포'],
  guard: ['하이가드', '숄더롤', '밸런스'],
  style: ['인파이팅', '카운터', '아웃복싱'],
  focus: ['헤드', '바디'],
};

// ───────── DB ─────────
// 요청마다 저장소에서 불러오고(load), 바뀌었으면(save 호출) 응답 전에 저장한다.
let db = null;
let dirty = false;
const save = () => { dirty = true; };

// 예전 데이터 형식 정리 (불러올 때마다 실행, 여러 번 실행해도 안전)
function migrate(db) {
// 훈련/컨디션 시스템 제거 이전 데이터 정리
for (const m of db.members) {
  if (m.attendDay === undefined) m.attendDay = m.attended ? m.trainDay : null;
  delete m.trainDay; delete m.trainsLeft; delete m.condition; delete m.condAt; delete m.belt;
}
// 복싱 전용 전환: 펀치는 이름으로 세부 분류, 복싱이 아닌 기술(킥·태클·그라운드·서브미션 등)은 제거
const boxingCat = (name) => (/파운딩|엘보|니킥|킥/.test(name) ? null : /바디|리버/.test(name) ? 'body' : /어퍼/.test(name) ? 'uppercut' : /훅/.test(name) ? 'hook' : 'jab');
db.skills = db.skills.filter((s) => {
  if (CATEGORIES[s.category]) return true;
  const c = s.category === 'punch' ? boxingCat(s.name) : null;
  if (c) s.category = c;
  return !!c;
});
// 세부 기술(move)이 없는 예전 기술은 이름으로 채운다
let moved = 0;
for (const s of db.skills) if (!validMove(s.category, s.move)) { s.move = guessMove(s.category, s.name); moved++; }
for (const m of db.members) {
  const s = m.strategy;
  if (!s) continue;
  if (!STRATEGY.guard.includes(s.guard)) s.guard = '밸런스';
  if (!STRATEGY.style.includes(s.style)) s.style = { 압박: '인파이팅', 아웃파이팅: '아웃복싱' }[s.style] || '인파이팅';
  if (!Array.isArray(s.focus)) s.focus = ['헤드', '바디'];
  delete s.range;
}
// 삭제된 회원이 나온 경기·콜아웃 정리 (회원 삭제 때 같이 지우기 전에 삭제된 회원 포함)
const alive = new Set(db.members.map((m) => m.id));
const orphanFights = db.fights.filter((f) => !alive.has(f.a) || !alive.has(f.b)).map((f) => f.id);
const callouts = db.callouts.length;
db.fights = db.fights.filter((f) => alive.has(f.a) && alive.has(f.b));
db.callouts = db.callouts.filter((c) => alive.has(c.challengerId) && alive.has(c.opponentId));
// 지워진 경기가 있으면(또는 한 번도 안 맞춰봤으면) 전적을 남은 경기로 다시 계산
// 코치 관전 여부(seenCoach) 도입 전 경기는 코치가 이미 본 것으로 처리
let coachSeen = 0;
for (const f of db.fights) if (f.seenCoach === undefined) { f.seenCoach = true; coachSeen++; }
const rebuild = orphanFights.length > 0 || !db.recordsV;
if (rebuild) { rebuildRecords(db); db.recordsV = 1; }
return { orphanFights, changed: rebuild || moved > 0 || coachSeen > 0 || db.callouts.length !== callouts };
}

const uid = () => crypto.randomBytes(6).toString('hex');
const now = () => Date.now();
const digits = (s) => String(s || '').replace(/\D/g, '');
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const GENDER = (g) => (g === 'F' ? 'F' : 'M');
const genderOf = (id) => memberById(id)?.gender || 'M';
const memberById = (id) => db.members.find((m) => m.id === id);
const skillsOf = (id) => db.skills.filter((s) => s.memberId === id);

// 날짜가 바뀌면 오늘 출석 여부 리셋 (조회 시점에 지연 처리)
// 조회만 하는 요청이 DB 전체를 다시 쓰지 않도록, 실제로 바뀔 때만 저장
// (Vercel은 여러 인스턴스가 동시에 저장하면 마지막 저장이 이겨서, 4초 폴링이 방금 치른 경기를 덮어쓸 수 있음)
function refresh(m) {
  if (m.attended && m.attendDay !== today()) { m.attended = false; save(); }
  return m;
}

function newMember({ name, phone, gender }) {
  return {
    id: uid(), name, phone, gender: GENDER(gender), createdAt: now(),
    stats: { ...BASE_STATS },
    attendDay: null, attended: false, attendCount: 0,
    strategy: { stance: '오소독스', guard: '밸런스', style: '인파이팅', focus: ['헤드', '바디'] },
    wins: 0, losses: 0, draws: 0, kos: 0, subs: 0, points: 1000, fans: 0, finishes: {}, streak: 0,
  };
}

// 회원이 아직 중계를 안 본 경기 = 그 회원에게는 결과를 숨길 경기
const unseenOf = (me) => db.fights.filter((f) => (f.a === me.id && !f.seenA) || (f.b === me.id && !f.seenB));

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
    id: m.id, name: m.name, gender: m.gender || 'M',
    stats: Object.fromEntries(Object.entries(m.stats).map(([k, v]) => [k, Math.floor(v)])),
    power: combatPower(m, skills),
    wins: r.wins, losses: r.losses, draws: r.draws, kos: r.kos, subs: r.subs,
    points: r.points, fans: r.fans, streak: r.streak,
    titles: Object.entries(r.finishes || {}).filter(([, c]) => c >= FINISH_TITLE_AT).map(([k]) => k),
    skillCount: skills.length,
    busy: db.callouts.some((c) => c.status === 'pending_opponent' && c.opponentId === m.id) ? 'invited' : null,
  };
}

function privateMember(m, view) {
  return {
    ...publicMember(m, view),
    statsRaw: m.stats, strategy: m.strategy, combos: m.combos || [], finishes: (view?.rec.get(m.id) || m).finishes || {},
    attended: m.attended, attendCount: m.attendCount || 0,
  };
}

// ───────── HTTP 유틸 ─────────
// 배포 버전: 앱이 이 값이 바뀐 걸 보면 새 코드로 다시 불러온다 (열어 둔 옛 화면 + 새 서버 조합 방지)
// (Vercel에서 배포 ID를 못 읽으면 끔: 인스턴스마다 값이 달라 계속 새로고침되는 것 방지)
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || (process.env.VERCEL ? '' : String(Date.now()));
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(APP_VERSION ? { 'X-App-Version': APP_VERSION } : {}) });
  res.end(JSON.stringify(data));
}
const fail = (res, status, msg) => send(res, status, { error: msg });

function readBody(req) {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })() : req.body || {});
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) return fail(res, 403, 'forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) {
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) return fail(res, 404, 'not found');
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(idx);
      });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ───────── 라우터 ─────────
const routes = [];
const route = (method, pattern, auth, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, auth, handler });
};

// ── 인증
route('POST', '/api/login', null, async (req, res, { body }) => {
  const phone = digits(body.phone);
  if (phone.length < 10) return fail(res, 400, '전화번호를 정확히 입력해주세요.');
  const m = db.members.find((x) => x.phone === phone);
  if (!m) return fail(res, 404, '등록되지 않은 번호입니다. 코치에게 회원 등록을 요청하세요.');
  const token = uid() + uid();
  db.sessions[token] = { role: 'member', memberId: m.id, at: now() };
  save(); send(res, 200, { token, role: 'member' });
});

route('POST', '/api/coach/login', null, async (req, res, { body }) => {
  if (String(body.pin || '') !== COACH_PIN) return fail(res, 401, 'PIN이 올바르지 않습니다.');
  const token = uid() + uid();
  db.sessions[token] = { role: 'coach', at: now() };
  save(); send(res, 200, { token, role: 'coach' });
});

route('POST', '/api/logout', 'any', async (req, res, { token }) => {
  delete db.sessions[token]; save(); send(res, 200, { ok: true });
});

route('GET', '/api/meta', null, async (req, res) => {
  send(res, 200, { categories: CATEGORIES, moves: MOVES, comboMax: COMBO_MAX, strategy: STRATEGY, finishTitleAt: FINISH_TITLE_AT });
});

// ── 회원
route('GET', '/api/me', 'member', async (req, res, { me }) => {
  // 아직 안 본 경기 = 코치 승인으로 치러진 경기 (상대 이름과 함께)
  const unseen = unseenOf(me).map((f) => {
    const oid = f.a === me.id ? f.b : f.a;
    return { id: f.id, name: memberById(oid)?.name || (f.a === me.id ? f.bName : f.aName) };
  });
  const view = viewFor(me);
  send(res, 200, {
    member: privateMember(me, view),
    skills: skillsView(me.id, view),
    pendingForMe: db.callouts.filter((c) => c.opponentId === me.id && c.status === 'pending_opponent').length,
    unseenFights: unseen,
  });
});

route('PUT', '/api/me/strategy', 'member', async (req, res, { me, body }) => {
  const s = { ...me.strategy };
  for (const k of ['stance', 'guard', 'style']) if (STRATEGY[k].includes(body[k])) s[k] = body[k];
  if (Array.isArray(body.focus)) {
    const r = body.focus.filter((x) => STRATEGY.focus.includes(x));
    if (r.length) s.focus = r;
  }
  me.strategy = s; save();
  send(res, 200, privateMember(me, viewFor(me)));
});

// 콤보 루틴: 내 기술 id 2개 이상(공격 1개 이상), 최대 5개
route('PUT', '/api/me/combos', 'member', async (req, res, { me, body }) => {
  const own = skillsOf(me.id).filter((s) => CATEGORIES[s.category]);
  const mine = new Set(own.map((s) => s.id));
  const attack = new Set(own.filter((s) => CATEGORIES[s.category].group === 'attack').map((s) => s.id));
  const list = Array.isArray(body.combos) ? body.combos : null;
  if (!list || list.length > COMBO_MAX.combos) return fail(res, 400, `콤보는 최대 ${COMBO_MAX.combos}개까지 만들 수 있어요.`);
  for (const c of list) {
    if (!Array.isArray(c) || c.length < COMBO_MAX.min || c.length > COMBO_MAX.max) return fail(res, 400, `콤보 하나에 기술은 ${COMBO_MAX.min}~${COMBO_MAX.max}개예요.`);
    if (!c.every((id) => mine.has(id))) return fail(res, 400, '내 기술로만 콤보를 만들 수 있어요.');
    if (!c.some((id) => attack.has(id))) return fail(res, 400, '콤보에 공격 기술이 하나는 있어야 해요.');
  }
  me.combos = list.map((c) => c.map(String)); save();
  send(res, 200, privateMember(me, viewFor(me)));
});

route('GET', '/api/members', 'any', async (req, res, { me }) => {
  const view = viewFor(me);
  send(res, 200, db.members.map((m) => publicMember(m, view)).sort((a, b) => b.points - a.points || b.power - a.power));
});

route('GET', '/api/members/:id', 'any', async (req, res, { me, params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const view = viewFor(me);
  send(res, 200, { member: { ...publicMember(m, view), strategy: m.strategy }, skills: skillsView(m.id, view).map(({ name, category, mastery }) => ({ name, category, mastery })) });
});

// ── 콜아웃
// 보는 사람이 그 경기 중계를 봤는지 (me 없음 = 코치)
const seenBy = (f, me) => (me ? (f.a === me.id ? f.seenA : f.b === me.id ? f.seenB : true) : f.seenCoach);
// live: 경기는 치러졌지만 보는 사람이 아직 중계를 안 봄 → '경기 중'으로 표시
function calloutView(c, me) {
  const f = c.fightId && db.fights.find((x) => x.id === c.fightId);
  return { ...c, challenger: memberById(c.challengerId)?.name, opponent: memberById(c.opponentId)?.name, live: !!f && !seenBy(f, me) };
}

route('GET', '/api/callouts', 'any', async (req, res, { me, session }) => {
  let list = db.callouts;
  if (session.role === 'member') list = list.filter((c) => c.challengerId === me.id || c.opponentId === me.id);
  send(res, 200, list.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 50).map((c) => calloutView(c, me)));
});

route('POST', '/api/callouts', 'member', async (req, res, { me, body }) => {
  const opp = memberById(body.opponentId);
  if (!opp || opp.id === me.id) return fail(res, 400, '상대를 선택해주세요.');
  if (!skillsOf(me.id).length) return fail(res, 400, '배운 기술이 없습니다. 코치에게 기술 등록을 받으세요.');
  if (!skillsOf(opp.id).length) return fail(res, 400, '상대에게 등록된 기술이 없습니다.');
  const dup = db.callouts.find((c) => ['pending_coach', 'pending_opponent'].includes(c.status) &&
    ((c.challengerId === me.id && c.opponentId === opp.id) || (c.challengerId === opp.id && c.opponentId === me.id)));
  if (dup) return fail(res, 409, '이미 대기 중인 콜아웃이 있습니다.');
  const c = {
    id: uid(), challengerId: me.id, opponentId: opp.id,
    message: String(body.message || '').slice(0, 80),
    status: 'pending_coach', createdAt: now(), fightId: null,
  };
  db.callouts.push(c); save();
  send(res, 201, calloutView(c));
});

route('POST', '/api/callouts/:id/cancel', 'member', async (req, res, { me, params }) => {
  const c = db.callouts.find((x) => x.id === params.id);
  if (!c || c.challengerId !== me.id) return fail(res, 404, '콜아웃을 찾을 수 없습니다.');
  if (!['pending_coach', 'pending_opponent'].includes(c.status)) return fail(res, 409, '취소할 수 없는 상태입니다.');
  c.status = 'cancelled'; save(); send(res, 200, calloutView(c));
});

route('POST', '/api/callouts/:id/respond', 'member', async (req, res, { me, params, body }) => {
  const c = db.callouts.find((x) => x.id === params.id);
  if (!c || c.opponentId !== me.id) return fail(res, 404, '콜아웃을 찾을 수 없습니다.');
  if (c.status !== 'pending_opponent') return fail(res, 409, '코치 승인 후 응답할 수 있습니다.');
  if (!body.accept) { c.status = 'declined'; save(); return send(res, 200, calloutView(c, me)); }
  const A = memberById(c.challengerId), B = memberById(c.opponentId);
  if (!A || !B) return fail(res, 404, '선수 정보가 없습니다.');
  const fight = runFight(A, B);
  c.status = 'done'; c.fightId = fight.id;
  fight.seenB = true; // 수락한 사람은 바로 관전
  save();
  send(res, 200, calloutView(c, me));
});

// ── 경기
function runFight(A, B) {
  refresh(A); refresh(B);
  const sa = skillsOf(A.id), sb = skillsOf(B.id);
  const pa = combatPower(A, sa), pb = combatPower(B, sb);
  const sim = simulateFight(
    { id: A.id, name: A.name, stats: A.stats, strategy: A.strategy, skills: sa, combos: A.combos },
    { id: B.id, name: B.name, stats: B.stats, strategy: B.strategy, skills: sb, combos: B.combos },
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
function rebuildRecords(db) {
  const byId = new Map(db.members.map((m) => [m.id, m]));
  for (const m of db.members) Object.assign(m, { wins: 0, losses: 0, draws: 0, kos: 0, subs: 0, points: 1000, fans: 0, finishes: {}, streak: 0 });
  for (const f of db.fights.slice().sort((a, b) => a.createdAt - b.createdAt)) {
    for (const id of [f.a, f.b]) if (byId.has(id)) applyRecord(byId.get(id), f);
  }
}

function fightSummary(f) {
  return {
    id: f.id, a: f.a, b: f.b, aName: f.aName, bName: f.bName, powerA: f.powerA, powerB: f.powerB,
    result: f.result, createdAt: f.createdAt, delta: f.delta,
  };
}

route('GET', '/api/fights', 'any', async (req, res, { me, session }) => {
  let list = db.fights;
  if (session.role === 'member') list = list.filter((f) => f.a === me.id || f.b === me.id);
  const hidden = new Set(list.filter((f) => !seenBy(f, me)).map((f) => f.id)); // 중계 보기 전엔 결과 숨김
  send(res, 200, list.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 40)
    .map((f) => (hidden.has(f.id) ? { ...fightSummary(f), result: null, delta: null, hidden: true } : fightSummary(f))));
});

route('GET', '/api/fights/:id', 'any', async (req, res, { me, params, session }) => {
  const f = db.fights.find((x) => x.id === params.id);
  if (!f) return fail(res, 404, '경기를 찾을 수 없습니다.');
  if (me && f.a === me.id && !f.seenA) { f.seenA = true; save(); }
  if (me && f.b === me.id && !f.seenB) { f.seenB = true; save(); }
  if (session.role === 'coach' && !f.seenCoach) { f.seenCoach = true; save(); }
  send(res, 200, { ...fightSummary(f), aGender: genderOf(f.a), bGender: genderOf(f.b), events: await store.events(f), maxHp: f.maxHp, roundSec: f.roundSec || 300 });
});

// ── 코치(관리자)
route('POST', '/api/coach/callouts/:id', 'coach', async (req, res, { params, body }) => {
  const c = db.callouts.find((x) => x.id === params.id);
  if (!c) return fail(res, 404, '콜아웃을 찾을 수 없습니다.');
  if (c.status !== 'pending_coach') return fail(res, 409, '이미 처리된 콜아웃입니다.');
  c.coachNote = String(body.note || '').slice(0, 80);
  if (!body.approve) { c.status = 'rejected'; save(); return send(res, 200, calloutView(c)); }
  // 코치가 승인하면 상대 수락 없이 바로 경기
  const A = memberById(c.challengerId), B = memberById(c.opponentId);
  if (!A || !B) return fail(res, 404, '선수 정보가 없습니다.');
  const fight = runFight(A, B);
  c.status = 'done'; c.fightId = fight.id;
  save(); send(res, 200, calloutView(c));
});

route('GET', '/api/coach/members', 'coach', async (req, res) => {
  send(res, 200, db.members.map((m) => ({ ...privateMember(m), phone: m.phone, skills: skillsOf(m.id) })));
});

route('POST', '/api/coach/members', 'coach', async (req, res, { body }) => {
  const name = String(body.name || '').trim().slice(0, 20);
  const phone = digits(body.phone);
  if (!name) return fail(res, 400, '이름을 입력해주세요.');
  if (phone.length < 10 || phone.length > 11) return fail(res, 400, '전화번호를 정확히 입력해주세요.');
  if (db.members.some((m) => m.phone === phone)) return fail(res, 409, '이미 등록된 전화번호입니다.');
  const m = newMember({ name, phone, gender: body.gender });
  db.members.push(m); save();
  send(res, 201, publicMember(m));
});

route('PUT', '/api/coach/members/:id', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  if (body.name) m.name = String(body.name).trim().slice(0, 20);
  if (body.gender) m.gender = GENDER(body.gender);
  if (body.phone) {
    const p = digits(body.phone);
    if (p.length < 10 || p.length > 11) return fail(res, 400, '전화번호를 정확히 입력해주세요.');
    if (db.members.some((x) => x.phone === p && x.id !== m.id)) return fail(res, 409, '이미 등록된 전화번호입니다.');
    m.phone = p;
  }
  save(); send(res, 200, publicMember(m));
});

route('DELETE', '/api/coach/members/:id', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  db.members = db.members.filter((x) => x.id !== m.id);
  db.skills = db.skills.filter((s) => s.memberId !== m.id);
  // 이 회원이 나온 경기 기록(중계 포함)과 관련 콜아웃도 함께 삭제
  const gone = db.fights.filter((f) => f.a === m.id || f.b === m.id).map((f) => f.id);
  db.fights = db.fights.filter((f) => f.a !== m.id && f.b !== m.id);
  db.callouts = db.callouts.filter((c) => c.challengerId !== m.id && c.opponentId !== m.id);
  if (gone.length) rebuildRecords(db); // 상대 선수 승패·포인트에서도 빠지도록
  await store.dropFights(gone);
  for (const [t, s] of Object.entries(db.sessions)) if (s.memberId === m.id) delete db.sessions[t];
  save(); send(res, 200, { ok: true });
});

// 출석 체크: 체육관에 실제로 나온 회원만 능력치가 성장 (오를수록 둔화)
route('POST', '/api/coach/members/:id/attend', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  refresh(m);
  if (m.attended) return fail(res, 409, '오늘 이미 출석 체크했습니다.');
  m.attended = true; m.attendDay = today(); m.attendCount = (m.attendCount || 0) + 1;
  const gains = {};
  for (const k of Object.keys(m.stats)) {
    const cur = m.stats[k];
    const g = ATTEND_GAIN * (0.6 + Math.random() * 0.8) * (1 - cur / (STAT_MAX + 20));
    m.stats[k] = clamp(cur + g, 0, STAT_MAX);
    gains[k] = Math.floor(m.stats[k]) - Math.floor(cur);
  }
  save(); send(res, 200, { ...privateMember(m), gains });
});

route('POST', '/api/coach/members/:id/skills', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const name = String(body.name || '').trim().slice(0, 24);
  const category = CATEGORIES[body.category] ? body.category : null;
  const mastery = clamp(parseInt(body.mastery, 10) || 10, 1, 100);
  if (!name || !category) return fail(res, 400, '기술 이름과 분류를 입력해주세요.');
  if (skillsOf(m.id).length >= 30) return fail(res, 400, '기술은 최대 30개까지 등록할 수 있습니다.');
  if (skillsOf(m.id).some((s) => s.name === name)) return fail(res, 409, '이미 등록된 기술입니다.');
  const move = validMove(category, body.move) ? body.move : guessMove(category, name);
  const s = { id: uid(), memberId: m.id, name, category, move, mastery, desc: String(body.desc || '').slice(0, 60), createdAt: now() };
  db.skills.push(s); save();
  send(res, 201, s);
});

route('PUT', '/api/coach/skills/:id', 'coach', async (req, res, { params, body }) => {
  const s = db.skills.find((x) => x.id === params.id);
  if (!s) return fail(res, 404, '기술을 찾을 수 없습니다.');
  if (body.mastery != null) s.mastery = clamp(parseInt(body.mastery, 10) || 1, 1, 100);
  if (body.name) s.name = String(body.name).trim().slice(0, 24);
  if (CATEGORIES[body.category]) s.category = body.category;
  if (validMove(s.category, body.move)) s.move = body.move;
  else if (!validMove(s.category, s.move)) s.move = guessMove(s.category, s.name);
  save(); send(res, 200, s);
});

route('DELETE', '/api/coach/skills/:id', 'coach', async (req, res, { params }) => {
  const s = db.skills.find((x) => x.id === params.id);
  if (!s) return fail(res, 404, '기술을 찾을 수 없습니다.');
  db.skills = db.skills.filter((x) => x.id !== s.id);
  // 지운 기술은 콤보에서 빼고, 2타 미만으로 남은 콤보는 버린다
  const m = memberById(s.memberId);
  if (m?.combos) m.combos = m.combos.map((c) => c.filter((id) => id !== s.id)).filter((c) => c.length >= COMBO_MAX.min);
  save(); send(res, 200, { ok: true });
});

// ───────── 서버 ─────────
// 요청은 한 번에 하나씩 처리 (불러오기 → 처리 → 저장이 섞이지 않도록)
let queue = Promise.resolve();
function handle(req, res) {
  const run = queue.then(() => handleApi(req, res));
  queue = run.catch(() => {});
  return run;
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://x');
  try { db = await store.load(); }
  catch (e) { console.error(e); return send(res, 503, { error: `저장소 연결 실패: ${e.message}` }); }
  const mig = migrate(db);
  dirty = mig.changed; // 정리된 게 있으면 이번 요청에서 저장
  if (mig.orphanFights.length) await store.dropFights(mig.orphanFights).catch((e) => console.error(e));
  // 응답은 저장이 끝난 뒤에 보낸다 (서버리스는 응답 후 바로 멈출 수 있음)
  const end = res.end.bind(res);
  let pending = null;
  res.end = (...args) => { pending = args; return res; };
  try { await route_(req, res, url); }
  catch (e) { console.error(e); if (!pending) fail(res, 500, '서버 오류'); }
  if (dirty) {
    try { await store.save(db); }
    catch (e) { console.error(e); res.statusCode = 500; pending = [JSON.stringify({ error: `저장 실패: ${e.message}` })]; }
  }
  end(...(pending || []));
}

async function route_(req, res, url) {
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const session = db.sessions[token];
    let me = null;
    if (r.auth) {
      if (!session) return fail(res, 401, '로그인이 필요합니다.');
      if (r.auth !== 'any' && session.role !== r.auth) return fail(res, 403, '권한이 없습니다.');
      if (session.role === 'member') {
        me = memberById(session.memberId);
        if (!me) { delete db.sessions[token]; return fail(res, 401, '회원 정보가 없습니다.'); }
        refresh(me);
      }
    }
    const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
    return await r.handler(req, res, { params, body, me, session, token });
  }
  fail(res, 404, 'not found');
}

// 요청 하나를 처리하는 함수 (API + 정적 파일)
// Vercel이 server.js 를 서버 앱으로 자동 인식해 직접 호출해도 동작하도록 이것을 내보낸다.
function app(req, res) {
  const p = new URL(req.url, 'http://x');
  const rp = p.searchParams.get('__p'); // vercel.json rewrite 형태 복원
  if (rp !== null) { p.searchParams.delete('__p'); req.url = '/api' + rp + (p.search || ''); }
  return req.url.startsWith('/api/') ? handle(req, res) : serveStatic(req, res);
}
module.exports = app;
module.exports.handle = handle;

// 로컬 실행: node server.js
if (require.main === module) {
  http.createServer(app).listen(PORT, () => {
    console.log(`🥊 TBG ARENA → http://localhost:${PORT}  (저장소: ${store.kind})`);
    if (COACH_PIN === '1234') console.log('⚠️  코치 PIN 기본값(1234) 사용 중 — COACH_PIN 환경변수로 변경하세요.');
  });
}
