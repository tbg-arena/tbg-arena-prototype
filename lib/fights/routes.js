// 경기 API: 경기 기록 목록 · 경기 중계 데이터
require('./migrate');
const store = require('../core/store');
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { memberById, genderOf } = require('../members/model');
const { memberLook } = require('../fighter/model');
const { FINISH_TITLE_AT, seenBy, fightSummary } = require('./model');

addMeta({ finishTitleAt: FINISH_TITLE_AT });

const lookOfId = (id) => { const m = memberById(id); return m ? memberLook(m) : {}; };

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
  const c = db.callouts.find((x) => x.fightId === f.id && x.message?.trim()); // 한마디를 적은 콜아웃만 중계 인트로
  send(res, 200, { ...fightSummary(f), taunt: c ? { by: c.challengerId, text: c.message.trim() } : null, aGender: genderOf(f.a), bGender: genderOf(f.b), aLook: lookOfId(f.a), bLook: lookOfId(f.b), coins: f.coins || null, events: await store.events(f), maxHp: f.maxHp, roundSec: f.roundSec || 300 });
});
