// 콤비를 DB로 (core/migrations.js 참고): db.combos 가 없으면 list.js 기본 콤비로 채운다
// 이후엔 코치가 화면에서 추가·수정·삭제
const { addMigration } = require('../core/migrations');
const { uid } = require('../core/util');
const LIST = require('./list');

addMigration((db) => {
  if (Array.isArray(db.combos)) return false;
  db.combos = LIST.map((text) => ({ id: uid(), text }));
  return true;
});
