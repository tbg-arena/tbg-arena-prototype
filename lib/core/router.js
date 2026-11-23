// API 라우터: 각 기능의 routes.js 가 route() 로 API를 등록하고, handle() 이 요청을 처리한다.
// 요청 하나 = 저장소에서 불러오기 → 예전 데이터 정리 → API 실행 → 바뀌었으면 저장 → 응답
const store = require('./store');
const { db, replaceDb, isDirty, setDirty } = require('./db');
const { send, fail, readBody } = require('./http');
const { runMigrations } = require('./migrations');
const { memberById } = require('../members/model');
const { refresh } = require('../attendance/model');

const routes = [];

// 세션 만료: 코치는 로그인 후 12시간 (회원 74명 개인정보를 보므로 짧게, 고정)
//            회원은 마지막 사용 후 90일 (쓸 때마다 연장 — 저장 횟수를 줄이려고 하루 한 번만 at 갱신)
const SESSION_TTL = { coach: 12 * 3600e3, member: 90 * 864e5 };
const TOUCH_EVERY = 864e5;
const expired = (s, t) => !(t - s.at < (SESSION_TTL[s.role] ?? 0)); // at 없거나 모르는 역할도 만료
function pruneSessions(t) {
  let n = 0;
  for (const [k, s] of Object.entries(db.sessions || {})) if (expired(s, t)) { delete db.sessions[k]; n++; }
  return n > 0;
}
// auth: null = 로그인 없이 / 'member' = 회원만 / 'coach' = 코치만 / 'any' = 로그인한 누구나
// handler(req, res, { params, body, me, session, token }) — me: 로그인한 회원 (코치면 null)
const route = (method, pattern, auth, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, auth, handler });
};

// 요청은 한 번에 하나씩 처리 (불러오기 → 처리 → 저장이 섞이지 않도록)
let queue = Promise.resolve();
function handle(req, res) {
  const run = queue.then(() => handleApi(req, res));
  queue = run.catch(() => {});
  return run;
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://x');
  let data;
  try { data = await store.load(); }
  catch (e) { console.error(e); return send(res, 503, { error: `저장소 연결 실패: ${e.message}` }); }
  replaceDb(data);
  const migrated = await runMigrations(db);
  setDirty(pruneSessions(Date.now()) || migrated); // 정리된 게 있으면 이번 요청에서 저장
  // 응답은 저장이 끝난 뒤에 보낸다 (서버리스는 응답 후 바로 멈출 수 있음)
  const end = res.end.bind(res);
  let pending = null;
  res.end = (...args) => { pending = args; return res; };
  try { await dispatch(req, res, url); }
  catch (e) { console.error(e); if (!pending) fail(res, 500, '서버 오류'); }
  if (isDirty()) {
    try { await store.save(db); }
    catch (e) { console.error(e); res.statusCode = 500; pending = [JSON.stringify({ error: `저장 실패: ${e.message}` })]; }
  }
  end(...(pending || []));
}

async function dispatch(req, res, url) {
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const session = db.sessions[token];
    let me = null;
    if (r.auth) {
      if (!session) return fail(res, 401, '로그인이 필요합니다.'); // 만료된 세션은 위 pruneSessions 가 이미 지움
      if (session.role === 'member' && Date.now() - session.at > TOUCH_EVERY) { session.at = Date.now(); setDirty(true); }
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

module.exports = { route, handle };
