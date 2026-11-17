// 이번 요청의 데이터. 요청마다 저장소에서 불러온 내용으로 바뀐다 (router.js 참고).
// db 객체는 그대로 두고 안의 내용만 갈아 끼우기 때문에, 어느 파일에서 require 해도 항상 이번 요청의 데이터를 본다.
//
//   const { db, save } = require('../core/db');
//   db.members.push(m); save();   // save() = "응답 전에 저장해줘" 표시. 실제 저장은 router.js 가 요청 끝에 한 번만 한다.
const db = {};
let dirty = false;

const save = () => { dirty = true; };

function replaceDb(data) {
  for (const k of Object.keys(db)) delete db[k];
  Object.assign(db, data);
}
const isDirty = () => dirty;
const setDirty = (v) => { dirty = v; };

module.exports = { db, save, replaceDb, isDirty, setDirty };
