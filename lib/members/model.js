// 회원: 찾기·새로 만들기 (다른 기능에서도 가져다 쓰는 함수)
const { db } = require('../core/db');
const { uid, now } = require('../core/util');

const BASE_STATS = { power: 8, speed: 8, stamina: 8, iq: 8, chin: 8 }; // 새 회원 시작 능력치

const GENDER = (g) => (g === 'F' ? 'F' : 'M');
const memberById = (id) => db.members.find((m) => m.id === id);
const genderOf = (id) => memberById(id)?.gender || 'M';

function newMember({ name, phone, gender }) {
  return {
    id: uid(), name, phone, gender: GENDER(gender), createdAt: now(),
    stats: { ...BASE_STATS },
    attendDay: null, attended: false, attendCount: 0,
    strategy: { stance: '오소독스', guard: '밸런스', style: '인파이팅', focus: ['헤드', '바디'] },
    wins: 0, losses: 0, draws: 0, kos: 0, subs: 0, points: 1000, fans: 0, finishes: {}, streak: 0,
  };
}

module.exports = { GENDER, memberById, genderOf, newMember };
