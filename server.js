// TBG ARENA - 의존성 없는 Node.js 서버 (로컬: JSON 파일 / Vercel: Redis 저장, store.js 참고)
// 복싱 육성 시뮬레이션: 체육관 출석·실제 배운 기술 → 성장 → 콜아웃 → 자동 경기 시뮬레이션
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { simulateFight, combatPower, CATEGORIES } = require('./fight');
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
  delete m.trainDay; delete m.trainsLeft; delete m.condition; delete m.condAt;
}
// 복싱 전용 전환: 펀치는 이름으로 세부 분류, 복싱이 아닌 기술(킥·태클·그라운드·서브미션 등)은 제거
const boxingCat = (name) => (/파운딩|엘보|니킥|킥/.test(name) ? null : /바디|리버/.test(name) ? 'body' : /어퍼/.test(name) ? 'uppercut' : /훅/.test(name) ? 'hook' : 'jab');
db.skills = db.skills.filter((s) => {
  if (CATEGORIES[s.category]) return true;
  const c = s.category === 'punch' ? boxingCat(s.name) : null;
  if (c) s.category = c;
  return !!c;
});
for (const m of db.members) {
  const s = m.strategy;
  if (!s) continue;
  if (!STRATEGY.guard.includes(s.guard)) s.guard = '밸런스';
  if (!STRATEGY.style.includes(s.style)) s.style = { 압박: '인파이팅', 아웃파이팅: '아웃복싱' }[s.style] || '인파이팅';
  if (!Array.isArray(s.focus)) s.focus = ['헤드', '바디'];
  delete s.range;
}
}

const uid = () => crypto.randomBytes(6).toString('hex');
const now = () => Date.now();
const digits = (s) => String(s || '').replace(/\D/g, '');
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const memberById = (id) => db.members.find((m) => m.id === id);
const skillsOf = (id) => db.skills.filter((s) => s.memberId === id);

// 날짜가 바뀌면 오늘 출석 여부 리셋 (조회 시점에 지연 처리)
function refresh(m) {
  if (m.attendDay !== today()) m.attended = false;
  return m;
}

function newMember({ name, phone, belt }) {
  return {
    id: uid(), name, phone, belt: belt || '화이트', createdAt: now(),
    stats: { ...BASE_STATS },
    attendDay: null, attended: false, attendCount: 0,
    strategy: { stance: '오소독스', guard: '밸런스', style: '인파이팅', focus: ['헤드', '바디'] },
    wins: 0, losses: 0, draws: 0, kos: 0, subs: 0, points: 1000, fans: 0, finishes: {}, streak: 0,
  };
}

function publicMember(m) {
  refresh(m);
  const skills = skillsOf(m.id);
  return {
    id: m.id, name: m.name, belt: m.belt,
    stats: Object.fromEntries(Object.entries(m.stats).map(([k, v]) => [k, Math.floor(v)])),
    power: combatPower(m, skills),
    wins: m.wins, losses: m.losses, draws: m.draws, kos: m.kos, subs: m.subs,
    points: m.points, fans: m.fans, streak: m.streak,
    titles: Object.entries(m.finishes || {}).filter(([, c]) => c >= FINISH_TITLE_AT).map(([k]) => k),
    skillCount: skills.length,
    busy: db.callouts.some((c) => c.status === 'pending_opponent' && c.opponentId === m.id) ? 'invited' : null,
  };
}

function privateMember(m) {
  return {
    ...publicMember(m),
    statsRaw: m.stats, strategy: m.strategy, finishes: m.finishes || {},
    attended: m.attended, attendCount: m.attendCount || 0,
  };
}

// ───────── HTTP 유틸 ─────────
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
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
  send(res, 200, { categories: CATEGORIES, strategy: STRATEGY, finishTitleAt: FINISH_TITLE_AT });
});

// ── 회원
route('GET', '/api/me', 'member', async (req, res, { me }) => {
  const unseen = db.fights.filter((f) => (f.a === me.id && !f.seenA) || (f.b === me.id && !f.seenB)).map((f) => f.id);
  send(res, 200, {
    member: privateMember(me),
    skills: skillsOf(me.id),
    pendingForMe: db.callouts.filter((c) => c.opponentId === me.id && c.status === 'pending_opponent').length,
    unseenFights: unseen,
  });
  save();
});

route('PUT', '/api/me/strategy', 'member', async (req, res, { me, body }) => {
  const s = { ...me.strategy };
  for (const k of ['stance', 'guard', 'style']) if (STRATEGY[k].includes(body[k])) s[k] = body[k];
  if (Array.isArray(body.focus)) {
    const r = body.focus.filter((x) => STRATEGY.focus.includes(x));
    if (r.length) s.focus = r;
  }
  me.strategy = s; save();
  send(res, 200, privateMember(me));
});

route('GET', '/api/members', 'any', async (req, res) => {
  send(res, 200, db.members.map(publicMember).sort((a, b) => b.points - a.points || b.power - a.power));
});

route('GET', '/api/members/:id', 'any', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  send(res, 200, { member: { ...publicMember(m), strategy: m.strategy }, skills: skillsOf(m.id).map(({ name, category, mastery }) => ({ name, category, mastery })) });
});

// ── 콜아웃
function calloutView(c) {
  return { ...c, challenger: memberById(c.challengerId)?.name, opponent: memberById(c.opponentId)?.name };
}

route('GET', '/api/callouts', 'any', async (req, res, { me, session }) => {
  let list = db.callouts;
  if (session.role === 'member') list = list.filter((c) => c.challengerId === me.id || c.opponentId === me.id);
  send(res, 200, list.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 50).map(calloutView));
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
  if (!body.accept) { c.status = 'declined'; save(); return send(res, 200, calloutView(c)); }
  const A = memberById(c.challengerId), B = memberById(c.opponentId);
  if (!A || !B) return fail(res, 404, '선수 정보가 없습니다.');
  const fight = runFight(A, B);
  c.status = 'done'; c.fightId = fight.id;
  fight.seenB = true; // 수락한 사람은 바로 관전
  save();
  send(res, 200, calloutView(c));
});

// ── 경기
function runFight(A, B) {
  refresh(A); refresh(B);
  const sa = skillsOf(A.id), sb = skillsOf(B.id);
  const pa = combatPower(A, sa), pb = combatPower(B, sb);
  const sim = simulateFight(
    { id: A.id, name: A.name, stats: A.stats, strategy: A.strategy, skills: sa },
    { id: B.id, name: B.name, stats: B.stats, strategy: B.strategy, skills: sb },
  );
  const f = {
    id: uid(), a: A.id, b: B.id, aName: A.name, bName: B.name, powerA: pa, powerB: pb,
    createdAt: now(), events: sim.events, result: sim.result, maxHp: sim.maxHp, roundSec: sim.roundSec, seenA: false, seenB: false,
  };

  // 결과 반영
  const { winnerId, method, skill } = sim.result;
  const exp = 1 / (1 + Math.pow(10, ((B.points - A.points) / 400))); // Elo 기대 승률
  const K = 40;
  const scoreA = winnerId === A.id ? 1 : winnerId === B.id ? 0 : 0.5;
  const dA = Math.round(K * (scoreA - exp) + (winnerId === A.id && method !== '판정' ? 8 : 0));
  const dB = Math.round(K * ((1 - scoreA) - (1 - exp)) + (winnerId === B.id && method !== '판정' ? 8 : 0));
  f.delta = { [A.id]: dA, [B.id]: dB };
  for (const [m, d] of [[A, dA], [B, dB]]) {
    m.points = Math.max(0, m.points + d);
    if (!winnerId) { m.draws++; m.streak = 0; m.fans += 5; }
    else if (winnerId === m.id) {
      m.wins++; m.streak = Math.max(1, m.streak + 1);
      m.fans += method === '판정' ? 10 : 25;
      if (method === 'KO' || method === 'TKO') m.kos++;
      if (method === '서브미션') m.subs++;
      if (skill && method !== '판정') { m.finishes = m.finishes || {}; m.finishes[skill] = (m.finishes[skill] || 0) + 1; }
    } else { m.losses++; m.streak = Math.min(-1, m.streak - 1); m.fans += 3; }
  }
  // 경기에서 성공한 기술은 숙련 +1 (최대 3개)
  for (const [mid, list] of Object.entries(sim.landed)) {
    for (const sid of list.slice(0, 3)) {
      const s = db.skills.find((x) => x.id === sid);
      if (s && s.memberId === mid) s.mastery = clamp(s.mastery + 1, 1, 100);
    }
  }
  db.fights.push(f);
  return f;
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
  send(res, 200, list.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 40).map(fightSummary));
});

route('GET', '/api/fights/:id', 'any', async (req, res, { me, params }) => {
  const f = db.fights.find((x) => x.id === params.id);
  if (!f) return fail(res, 404, '경기를 찾을 수 없습니다.');
  if (me && f.a === me.id && !f.seenA) { f.seenA = true; save(); }
  if (me && f.b === me.id && !f.seenB) { f.seenB = true; save(); }
  send(res, 200, { ...fightSummary(f), events: await store.events(f), maxHp: f.maxHp, roundSec: f.roundSec || 300 });
});

// ── 코치(관리자)
route('POST', '/api/coach/callouts/:id', 'coach', async (req, res, { params, body }) => {
  const c = db.callouts.find((x) => x.id === params.id);
  if (!c) return fail(res, 404, '콜아웃을 찾을 수 없습니다.');
  if (c.status !== 'pending_coach') return fail(res, 409, '이미 처리된 콜아웃입니다.');
  c.status = body.approve ? 'pending_opponent' : 'rejected';
  c.coachNote = String(body.note || '').slice(0, 80);
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
  const m = newMember({ name, phone, belt: String(body.belt || '화이트').slice(0, 10) });
  db.members.push(m); save();
  send(res, 201, publicMember(m));
});

route('PUT', '/api/coach/members/:id', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  if (body.name) m.name = String(body.name).trim().slice(0, 20);
  if (body.belt) m.belt = String(body.belt).slice(0, 10);
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
  for (const c of db.callouts) if ((c.challengerId === m.id || c.opponentId === m.id) && c.status.startsWith('pending')) c.status = 'cancelled';
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
  const s = { id: uid(), memberId: m.id, name, category, mastery, desc: String(body.desc || '').slice(0, 60), createdAt: now() };
  db.skills.push(s); save();
  send(res, 201, s);
});

route('PUT', '/api/coach/skills/:id', 'coach', async (req, res, { params, body }) => {
  const s = db.skills.find((x) => x.id === params.id);
  if (!s) return fail(res, 404, '기술을 찾을 수 없습니다.');
  if (body.mastery != null) s.mastery = clamp(parseInt(body.mastery, 10) || 1, 1, 100);
  if (body.name) s.name = String(body.name).trim().slice(0, 24);
  if (CATEGORIES[body.category]) s.category = body.category;
  save(); send(res, 200, s);
});

route('DELETE', '/api/coach/skills/:id', 'coach', async (req, res, { params }) => {
  const s = db.skills.find((x) => x.id === params.id);
  if (!s) return fail(res, 404, '기술을 찾을 수 없습니다.');
  db.skills = db.skills.filter((x) => x.id !== s.id); save();
  send(res, 200, { ok: true });
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
  migrate(db);
  dirty = false;
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

module.exports = { handle };

// 로컬 실행: node server.js (정적 파일 + API)
if (require.main === module) {
  http.createServer((req, res) => (req.url.startsWith('/api/') ? handle(req, res) : serveStatic(req, res))).listen(PORT, () => {
    console.log(`🥊 TBG ARENA → http://localhost:${PORT}  (저장소: ${store.kind})`);
    if (COACH_PIN === '1234') console.log('⚠️  코치 PIN 기본값(1234) 사용 중 — COACH_PIN 환경변수로 변경하세요.');
  });
}
