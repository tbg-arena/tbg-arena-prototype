// 회원 옷장·상점 화면 (#/shop, 홈의 '옷장 · 상점' 카드로 들어옴): 브랜드 장비 구매 (조건 + 코인) · 옷장에서 착용 · 헤어스타일
// 장비는 꾸미기 전용 (능력치 영향 없음). 판매 목록·가격·조건은 서버 lib/shop/items.js
import { state } from '../../core/state.js';
import { $app, esc, sprite, toast, vibrate } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route, go, addPage } from '../../core/router.js';
import { gearArtURL } from '../../arena/gear-art.js';

let previewId = null;  // 입어 보는 중인 아이템 (화면에서만, 저장 안 함)
let category = null;   // 보고 있는 부위 (처음엔 첫 부위 = 글러브)

addPage('shop', renderShop, { needsId: false });

async function renderShop() {
  const fresh = state.tab !== 'shop'; // 다른 화면에서 들어왔으면 맨 위부터 (구매·착용 후 다시 그릴 땐 보던 위치 유지)
  state.tab = 'shop';
  const seq = state.seq;
  let me, shop;
  try { [me, shop] = await Promise.all([api('GET', '/api/me'), api('GET', '/api/shop')]); }
  catch (e) { toast(e.message, true); return go('#/home'); }
  if (seq !== state.seq) return; // 그 사이 다른 화면으로 이동함
  state.me = me;
  $app.innerHTML = `
    <div class="topbar"><span style="width:60px"></span><div class="muted small">옷장 · 상점</div><span style="width:60px"></span></div>
    <div class="page no-tabs" id="shopPage">${shopView(me, shop)}</div>
    <div class="backbar"><button class="btn block" id="back">← 돌아가기</button></div>`;
  document.getElementById('back').onclick = () => (history.length > 1 ? history.back() : go('#/home'));
  bindShop(me, shop);
  if (fresh) window.scrollTo(0, 0);
}

const itemOf = (shop, id) => shop.items.find((it) => it.id === id);
const fullName = (it) => (it.basic || !it.brand ? it.name : `${it.brand} ${it.name}`);
// 지금 장착에서 한 부위만 item 으로 바꿔 입었을 때의 장비 색·헤어
function lookWith(shop, item) {
  const eq = { ...shop.equipped, ...(item ? { [item.slot]: item.id } : {}) };
  return Object.assign({}, ...Object.values(eq).map((id) => itemOf(shop, id)?.look));
}
const myFigure = (me, shop, item, opts) => sprite({ id: me.member.id, gender: me.member.gender, look: lookWith(shop, item) }, opts);
// 아이템 그림: 32×32 상품 그림 (art), 없으면(헤어) 내 캐릭터 얼굴에 씌운 모습
const itemImage = (me, shop, it, scale) => (it.art ? gearArtURL(it.art, scale) : myFigure(me, shop, it, { pose: 'bust', scale: scale + 1 }));

function heroView(me, shop) {
  const prev = previewId && itemOf(shop, previewId);
  const wearing = shop.slots.map(([slot, label]) => {
    const it = prev?.slot === slot ? prev : itemOf(shop, shop.equipped[slot]);
    return `<div><span class="px">${esc(label)}</span>${esc(fullName(it))}</div>`;
  }).join('');
  return `<div class="card shop-hero" id="shopHero">
      <div class="sprite-box"><img src="${myFigure(me, shop, prev, { pose: 'idle', scale: 2 })}" alt="" /></div>
      <div class="grow" style="min-width:0">
        <div class="small muted">${prev ? '입어 보는 중' : '지금 착용'}</div>
        <div class="shop-wearing">${wearing}</div>
        ${prev ? '<button class="link" id="previewOff" style="padding:4px 0">← 내 장비로 되돌리기</button>' : ''}
      </div>
      <div class="cp"><span>COIN</span><b>${shop.coins}</b></div>
    </div>`;
}

// 부위별로 나눠 보기: 글러브 · 상의 · 트렁크 · 헤어
function categoryBar(shop) {
  const cats = shop.slots;
  return `<div class="seg shop-cats" style="grid-template-columns:repeat(${cats.length},1fr)">${cats.map(([id, label]) => `<button data-cat="${id}" class="${category === id ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
}

function itemCard(me, shop, it) {
  const slot = Object.fromEntries(shop.slots)[it.slot];
  const short = shop.coins < it.price;
  const action = it.owned
    ? (it.equipped ? '<span class="badge solid">착용 중</span>' : `<button class="btn sm" data-equip="${it.id}">착용</button>`)
    : !it.unlocked ? '<button class="btn sm" disabled>잠김</button>'
    : `<button class="btn sm primary" data-buy="${it.id}" ${short ? 'disabled' : ''}>${short ? '코인 부족' : '구매'}</button>`;
  return `
    <div class="card shop-item ${previewId === it.id ? 'on' : ''}" data-preview="${it.id}">
      <div class="shop-thumb"><img src="${itemImage(me, shop, it, 2)}" alt="" /></div>
      <div class="grow" style="min-width:0">
        ${it.brand ? `<div class="brand px">${esc(it.brand)}</div>` : ''}
        <div class="iname">${esc(it.name)} <span class="muted small">· ${esc(slot)}</span></div>
        ${it.desc ? `<div class="muted small">${esc(it.desc)}</div>` : ''}
        ${it.require.length ? `<div class="reqs">${it.require.map((r) => `<span class="req ${r.ok ? 'ok' : ''}">${r.ok ? '✓ ' : ''}${esc(r.label)} ${Math.min(r.have, r.need)}/${r.need}</span>`).join('')}</div>` : ''}
      </div>
      <div class="shop-buy"><div class="price px">${it.owned ? '보유' : `${it.price} COIN`}</div>${action}</div>
    </div>`;
}

function wardrobeRow(me, shop, slot, label) {
  const mine = shop.items.filter((it) => it.slot === slot && it.owned);
  return `<div class="card">
      <div class="small muted" style="margin-bottom:8px">${esc(label)}</div>
      <div class="wardrobe">${mine.map((it) => `<button class="ward ${it.equipped ? 'on' : ''}" data-equip="${it.id}" ${it.equipped ? 'disabled' : ''}><img class="sw ${it.art ? '' : 'face'}" src="${itemImage(me, shop, it, 1)}" alt="" />${esc(fullName(it))}</button>`).join('')}</div>
    </div>`;
}

function shopView(me, shop) {
  const r = shop.coinRules;
  if (!shop.slots.some(([slot]) => slot === category)) category = shop.slots[0][0];
  const inCat = (slot) => slot === category;
  const forSale = shop.items.filter((it) => !it.basic && inCat(it.slot));
  return `
    ${heroView(me, shop)}
    <div class="muted small" style="margin:10px 2px">코인은 경기(승 ${r.win} · 무 ${r.draw} · 패 ${r.lose}, KO/TKO 승 +${r.finish})와 출석 체크(+${r.attend})로 모여요. 장비는 꾸미기 전용이라 능력치에는 영향이 없어요. 아이템을 누르면 입어 볼 수 있어요.</div>
    ${categoryBar(shop)}
    <div class="section-title">옷장</div>
    ${shop.slots.filter(([slot]) => inCat(slot)).map(([slot, label]) => wardrobeRow(me, shop, slot, label)).join('')}
    <div class="section-title">상점</div>
    ${forSale.length ? forSale.map((it) => itemCard(me, shop, it)).join('') : `<div class="card empty">이 부위는 아직 파는 상품이 없어요.</div>`}`;
}

function bindShop(me, shop) {
  // 입어 보기: 다시 불러오지 않고 위쪽 미리보기만 바꾼다
  const setPreview = (id) => {
    previewId = id;
    document.getElementById('shopHero').outerHTML = heroView(me, shop);
    document.querySelectorAll('[data-preview]').forEach((el) => el.classList.toggle('on', el.dataset.preview === id));
    const off = document.getElementById('previewOff');
    if (off) off.onclick = () => setPreview(null);
  };
  setPreview(previewId && itemOf(shop, previewId) ? previewId : null);
  // 부위 바꾸기: 다시 불러오지 않고 목록만 다시 그린다
  document.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
    category = b.dataset.cat;
    document.getElementById('shopPage').innerHTML = shopView(me, shop);
    bindShop(me, shop);
  }));
  document.querySelectorAll('[data-preview]').forEach((el) => (el.onclick = () => setPreview(previewId === el.dataset.preview ? null : el.dataset.preview)));
  document.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); act(async () => {
    const it = itemOf(shop, b.dataset.buy);
    if (!confirm(`${fullName(it)}을(를) ${it.price}코인에 살까요?`)) return;
    await api('POST', '/api/shop/buy', { itemId: it.id });
    previewId = null; vibrate(40); toast(`${fullName(it)} 구매! 바로 착용했어요.`); route();
  }); }));
  document.querySelectorAll('[data-equip]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); act(async () => {
    await api('POST', '/api/shop/equip', { itemId: b.dataset.equip });
    previewId = null; toast(`${fullName(itemOf(shop, b.dataset.equip))} 착용!`); route();
  }); }));
}
