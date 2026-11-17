// 선수 전략 예전 데이터 정리 (core/migrations.js 참고)
const { addMigration } = require('../core/migrations');
const { STRATEGY } = require('./model');

addMigration((db) => {
  for (const m of db.members) {
    const s = m.strategy;
    if (!s) continue;
    if (!STRATEGY.guard.includes(s.guard)) s.guard = '밸런스';
    if (!STRATEGY.style.includes(s.style)) s.style = { 압박: '인파이팅', 아웃파이팅: '아웃복싱' }[s.style] || '인파이팅';
    if (!Array.isArray(s.focus)) s.focus = ['헤드', '바디'];
    delete s.range;
  }
  return false;
});
