// 회원 옷장·상점 화면 (#/shop, 홈의 '옷장 · 상점' 카드로 들어옴): 브랜드 장비 구매 (조건 + 코인) · 옷장에서 착용 · 헤어스타일
// 장비는 꾸미기 전용 (능력치 영향 없음). 판매 목록·가격·조건은 서버 lib/shop/items.js
import { state } from '../../core/state.js';
import { $app, esc, sprite, toast, vibrate } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route, go, addPage } from '../../core/router.js';
import { gearArtURL } from '../../arena/gear-art.js';
import { figureURL, bustURL } from '../../arena/figure.js';

let preview = {};      // 입어 보는 중: { 부위: 아이템 id } — 부위마다 하나씩 겹쳐 입어 볼 수 있음 (화면에서만, 저장 안 함)
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
// 지금 장착 위에 over({ 부위: id })를 겹쳐 입었을 때의 장비 색·헤어 + 부위별 그림(arts → 정면 전신) — 서버 lookFor 와 같은 모양
function lookWith(shop, over = {}) {
  const its = Object.values({ ...shop.equipped, ...over }).map((id) => itemOf(shop, id)).filter(Boolean);
  return Object.assign({ arts: Object.fromEntries(its.filter((it) => it.art).map((it) => [it.slot, it.art])) }, ...its.map((it) => it.look));
}
const me4 = (me, shop, over) => ({ id: me.member.id, gender: me.member.gender, look: lookWith(shop, over) });
const myFigure = (me, shop, over, opts) => sprite(me4(me, shop, over), opts);
// 아이템 그림: 32×32 상품 그림 (art), 없으면(헤어) 내 캐릭터 얼굴에 씌운 모습
const itemImage = (me, shop, it, scale) => (it.art ? gearArtURL(it.art, scale) : bustURL({ id: me.member.id, gender: me.member.gender, look: it.look }));
// 입어 보는 것 중 지금 장비와 다른 것 / 그중 이미 가진 것 (= 한 번에 착용할 수 있는 것)
const tried = (shop) => Object.values(preview).map((id) => itemOf(shop, id)).filter((it) => it && shop.equipped[it.slot] !== it.id);
const wearable = (shop) => tried(shop).filter((it) => it.owned);

// 위쪽 카드: 캐릭터 · 부위별 장비 · 코인 + 아래 버튼 줄 (버튼 줄은 늘 있어서 입어 봐도 카드 높이가 그대로)
function heroView(me, shop) {
  const t = tried(shop), w = wearable(shop);
  const wearing = shop.slots.map(([slot, label]) => {
    const id = preview[slot] || shop.equipped[slot];
    // 좁은 칸이라 브랜드는 빼고 상품 이름만 (브랜드는 아래 상점 카드에)
    return `<div class="${preview[slot] && preview[slot] !== shop.equipped[slot] ? 'chg' : ''}"><span class="px">${esc(label)}</span>${esc(itemOf(shop, id).name)}</div>`;
  }).join('');
  const label = w.length ? `${w.length}개 한 번에 착용` : t.length ? '산 장비만 착용할 수 있어요' : '옷장 · 상점에서 눌러 입어 보세요';
  return `<div class="card shop-hero ${t.length ? 'trying' : ''}" id="shopHero">
      <div class="shop-hero-top">
        <div class="fig-box"><img src="${figureURL(me4(me, shop, preview), 2)}" alt="입은 모습" /></div>
        <div class="grow" style="min-width:0">
          <div class="small muted">${t.length ? `입어 보는 중 · ${t.length}개` : '지금 착용'}</div>
          <div class="shop-wearing">${wearing}</div>
          <div class="shop-coin px">COIN <b>${shop.coins}</b></div>
        </div>
      </div>
      <div class="shop-hero-act">
        <button class="btn sm" id="previewOff" ${t.length ? '' : 'disabled'}>되돌리기</button>
        <button class="btn sm primary grow" id="equipAll" ${w.length ? '' : 'disabled'}>${label}</button>
      </div>
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
  const god = it.god; // 신 등급 전용 (신 등급 회원에게만 보임): 금빛 카드 + 전용 배지
  const action = it.owned
    ? (it.equipped ? '<span class="badge solid">착용 중</span>' : `<button class="btn sm" data-equip="${it.id}">착용</button>`)
    : !it.unlocked ? '<button class="btn sm" disabled>잠김</button>'
    : `<button class="btn sm primary" data-buy="${it.id}" ${short ? 'disabled' : ''}>${short ? '코인 부족' : '구매'}</button>`;
  return `
    <div class="card shop-item ${preview[it.slot] === it.id ? 'on' : ''} ${god ? 'god' : ''}" data-preview="${it.id}">
      <div class="shop-thumb"><img src="${itemImage(me, shop, it, 2)}" alt="" /></div>
      <div class="grow" style="min-width:0">
        ${it.brand ? `<div class="brand px">${esc(it.brand)}</div>` : ''}
        <div class="iname">${esc(it.name)} <span class="muted small">· ${esc(slot)}</span></div>
        ${it.desc ? `<div class="muted small">${esc(it.desc)}</div>` : ''}
        ${god ? '<div class="reqs"><span class="req god">신 등급 전용</span></div>' : ''}
        ${it.require.length ? `<div class="reqs">${it.require.map((r) => `<span class="req ${r.ok ? 'ok' : ''}">${r.ok ? '✓ ' : ''}${esc(r.label)} ${Math.min(r.have, r.need)}/${r.need}</span>`).join('')}</div>` : ''}
      </div>
      <div class="shop-buy"><div class="price px">${it.owned ? '보유' : `${it.price} COIN`}</div>${action}</div>
    </div>`;
}

function wardrobeRow(me, shop, slot, label) {
  const mine = shop.items.filter((it) => it.slot === slot && it.owned);
  return `<div class="card">
      <div class="small muted" style="margin-bottom:8px">${esc(label)}</div>
      <div class="wardrobe">${mine.map((it) => `<button class="ward ${it.equipped ? 'on' : ''} ${preview[it.slot] === it.id && !it.equipped ? 'try' : ''}" data-preview="${it.id}" aria-pressed="${preview[it.slot] === it.id}"><img class="sw ${it.art ? '' : 'face'}" src="${itemImage(me, shop, it, 1)}" alt="" />${esc(fullName(it))}</button>`).join('')}</div>
    </div>`;
}

function shopView(me, shop) {
  const r = shop.coinRules;
  if (!shop.slots.some(([slot]) => slot === category)) category = shop.slots[0][0];
  const inCat = (slot) => slot === category;
  const forSale = shop.items.filter((it) => !it.basic && inCat(it.slot));
  return `
    ${heroView(me, shop)}
    <div class="muted small" style="margin:10px 2px">코인은 경기(승 ${r.win} · 무 ${r.draw} · 패 ${r.lose}, KO/TKO 승 +${r.finish})와 출석 체크(+${r.attend})로 모여요. 장비는 꾸미기 전용이라 능력치에는 영향이 없어요. 옷장 · 상점 아이템을 누르면 부위마다 겹쳐 입어 보고, 가진 것은 한 번에 착용할 수 있어요.</div>
    ${categoryBar(shop)}
    <div class="section-title">옷장</div>
    ${shop.slots.filter(([slot]) => inCat(slot)).map(([slot, label]) => wardrobeRow(me, shop, slot, label)).join('')}
    <div class="section-title">상점</div>
    ${forSale.length ? forSale.map((it) => itemCard(me, shop, it)).join('') : `<div class="card empty">이 부위는 아직 파는 상품이 없어요.</div>`}`;
}

function bindShop(me, shop) {
  // 입어 보기: 다시 불러오지 않고 위쪽 카드 · 눌린 표시만 바꾼다
  const paint = () => {
    document.getElementById('shopHero').outerHTML = heroView(me, shop);
    document.querySelectorAll('[data-preview]').forEach((el) => {
      const it = itemOf(shop, el.dataset.preview), on = preview[it.slot] === it.id;
      el.classList.toggle(el.classList.contains('ward') ? 'try' : 'on', on && !(el.classList.contains('ward') && it.equipped));
      if (el.classList.contains('ward')) el.setAttribute('aria-pressed', on);
    });
    document.getElementById('previewOff').onclick = () => { preview = {}; paint(); };
    document.getElementById('equipAll').onclick = () => act(async () => {
      const items = wearable(shop);
      await api('POST', '/api/shop/equip', { itemIds: items.map((it) => it.id) });
      for (const it of items) delete preview[it.slot]; // 안 산 것은 계속 입어 보는 중으로 남김
      toast(items.length > 1 ? `${items.length}개 한 번에 착용!` : `${fullName(items[0])} 착용!`); route();
    });
  };
  // 같은 걸 다시 누르면 그 부위만 원래대로. 지금 입은 걸 누르면 그 부위 미리보기 해제
  const toggle = (id) => {
    const it = itemOf(shop, id);
    if (preview[it.slot] === id || shop.equipped[it.slot] === id) delete preview[it.slot]; else preview[it.slot] = id;
    paint();
  };
  for (const [slot, id] of Object.entries(preview)) if (!itemOf(shop, id)) delete preview[slot]; // 목록에서 사라진 아이템
  paint();
  // 부위 바꾸기: 다시 불러오지 않고 목록만 다시 그린다
  document.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
    category = b.dataset.cat;
    document.getElementById('shopPage').innerHTML = shopView(me, shop);
    bindShop(me, shop);
  }));
  document.querySelectorAll('[data-preview]').forEach((el) => (el.onclick = () => toggle(el.dataset.preview)));
  document.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); act(async () => {
    const it = itemOf(shop, b.dataset.buy);
    if (!confirm(`${fullName(it)}을(를) ${it.price}코인에 살까요?`)) return;
    await api('POST', '/api/shop/buy', { itemId: it.id });
    delete preview[it.slot]; vibrate(40); toast(`${fullName(it)} 구매! 바로 착용했어요.`); route();
  }); }));
  document.querySelectorAll('[data-equip]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); act(async () => {
    const it = itemOf(shop, b.dataset.equip);
    await api('POST', '/api/shop/equip', { itemIds: [it.id] });
    delete preview[it.slot]; toast(`${fullName(it)} 착용!`); route();
  }); }));
}
