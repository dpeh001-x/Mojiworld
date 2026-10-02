// POSTE RESTANTE - HELD PARCELS (per user: "think of a better utility function for the postal mail NPC"). Loot that cannot fit a full bag is
// scooped up by the Postal Wisp instead of lying on the ground (90-150 s, gone on a map change): 30 parcels, 7 real days, saved with the
// character, collected from her (P from anywhere) once there is room. Only overflow loot goes in; common-grade monster gear is skipped
// (quest rewards, sigils and the god weapon always go in); she cannot reach the tower; nothing touches the network.
//   node scripts/postal_held_parcels_test.mjs      (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served build)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 13871), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
let pass = 0, fail = 0; const ok = (n, c, note) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '   ' + JSON.stringify(note))); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _lxPostboxHold === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.level = 60; player.cls = player.cls || 'warrior'; player.invulnerable = 9e9; player._gravitosCineSeen = true; player._tutorialSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true });
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1500)); game.paused = false;
    setInterval(() => { game.monsters.length = 0; game.paused = false; }, 150);   // a calm field: no mob interrupts the pickups
    window.__toasts = []; const st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return st.apply(this, arguments); };
    window.__mk = (name, rarity, slot, extra) => Object.assign({ name, rarity, tier: 3, slot: slot || 'weapon', icon: '🗡️', stars: 0 }, extra || {});
    window.__fill = (tab, n) => { player.inventory = player.inventory.filter((x) => _itemTab(x) !== tab); for (let i = 0; i < n; i++) player.inventory.push(tab === 'etc' ? { name: 'Junk ' + i, rarity: 'common', type: 'material' } : window.__mk('Filler ' + i, 'rare')); };
    window.__drop = (it, extra) => game.drops.push(Object.assign({ x: player.x + player.w / 2, y: player.y + player.h / 2, vy: 0, type: 'item', item: it, life: 90000 }, extra || {}));
    window.__wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 4000)) { if (fn()) return true; await new Promise((r) => setTimeout(r, 80)); } return !!fn(); };
    window.__clean = () => { player.postbox = []; game.drops = []; window.__toasts.length = 0; if (game.expedition) game.expedition.active = false; };
  });
  const cap = await page.evaluate(() => player.invCap.equip);
  // 1. a rare drop on a full Equip tab goes to the Wisp
  let r = await page.evaluate(async () => { __clean(); __fill('equip', player.invCap.equip); const it = __mk('Sunblade', 'legendary'), n0 = player.inventory.length; __drop(it);
    const gone = await __wait(() => game.drops.length === 0); return { gone, held: _lxPostboxList().map((p) => p.it.name), bag: player.inventory.length - n0, toast: __toasts.filter((t) => /Wisp took/.test(t)) }; });
  ok('a rare drop on a full bag is taken by the Wisp (off the ground, not in the bag)', r.gone && r.held.join() === 'Sunblade' && r.bag === 0, r);
  ok('and she says so, with the item and the count', r.toast.length === 1 && /Sunblade/.test(r.toast[0]) && /1\/30/.test(r.toast[0]) && /P to collect/.test(r.toast[0]), r.toast);
  // 2. common-grade monster gear stays where it fell; a common QUEST REWARD does not
  r = await page.evaluate(async () => { __clean(); __fill('equip', player.invCap.equip); __drop(__mk('Rusty Blade', 'common')); await new Promise((r) => setTimeout(r, 900));
    const stayed = game.drops.length === 1 && _lxPostboxList().length === 0; game.drops = []; __drop(__mk('Reward Ring', 'common', 'accessory'), { _questReward: true });
    const gone = await __wait(() => game.drops.length === 0); return { stayed, gone, held: _lxPostboxList().map((p) => p.it.name) }; });
  ok('common-grade monster gear is left on the ground (30 slots would fill with it)', r.stayed, r);
  ok('a quest reward is held whatever its grade', r.gone && r.held.join() === 'Reward Ring', r);
  // 3. a chest, the god weapon and a sigil never touch the ground when the Wisp can hold them
  r = await page.evaluate(async () => { __clean(); __fill('equip', player.invCap.equip); const _mg = window._mapGearLevel; window._mapGearLevel = () => 99;   // the forest's chests roll starter gear (common); a late map rolls the rare-and-up the Wisp takes
    let n = 0; for (; n < 800 && _lxPostboxList().length < 3; n++) openChest({ x: player.x, y: player.y, w: 24, h: 20, tier: 'gold', opened: false });   // a chest rolls gear only some of the time
    window._mapGearLevel = _mg; await new Promise((r) => setTimeout(r, 700)); const ground = game.drops.filter((d) => d.type === 'item' && d.item && d.item.rarity !== 'common').length; return { chests: n, held: _lxPostboxList().length, ground, toasts: __toasts.filter((t) => /held by the Postal Wisp/.test(t)).length }; });
  ok('gold chests on a full bag: nothing above common-grade is left on the ground (3 held)', r.ground === 0 && r.held === 3, r);
  ok('and each chest toast says the Wisp holds it', r.toasts === r.held, r);
  r = await page.evaluate(() => { __clean(); __fill('equip', player.invCap.equip); const it = _lxGrantGodWeapon(); return { it: !!it, held: _lxPostboxList().length, ground: game.drops.length, toast: __toasts.some((t) => /held by the Postal Wisp/.test(t)) }; });
  ok('the god weapon on a full bag is held (unrepeatable loot is never left to a timer)', r.it && r.held === 1 && r.ground === 0 && r.toast, r);
  r = await page.evaluate(() => { __clean(); __fill('etc', player.invCap.etc); const sg = __mk('Aries Sigil', 'epic', 'sigil', { zodiacSign: 'aries' }); const bagged = _lxGiveSigil(sg); return { bagged, held: _lxPostboxList().map((p) => p.it.name), ground: game.drops.length }; });
  ok('a zodiac sigil on a full Etc tab is held and counts as bagged', r.bagged === true && r.held.join() === 'Aries Sigil' && r.ground === 0, r);
  // 4. the limits: 30 parcels; the tower is out of reach
  r = await page.evaluate(async () => { __clean(); __fill('equip', player.invCap.equip); player.postbox = Array.from({ length: 30 }, (_, i) => ({ it: __mk('Held ' + i, 'epic'), at: Date.now() - i * 1000 })); __drop(__mk('Thirty-First', 'legendary')); await new Promise((r) => setTimeout(r, 900));
    return { stayed: game.drops.length === 1, n: _lxPostboxList().length, said: __toasts.some((t) => /post office is full/.test(t)) }; });
  ok('a 31st parcel is not taken (30 held): it stays on the ground and she says the post office is full', r.stayed && r.n === 30 && r.said, r);
  r = await page.evaluate(async () => { __clean(); __fill('equip', player.invCap.equip); game.expedition = game.expedition || {}; game.expedition.active = true; __drop(__mk('Tower Blade', 'legendary')); await new Promise((r) => setTimeout(r, 900));
    const stayed = game.drops.length === 1 && _lxPostboxList().length === 0; player.postbox = [{ it: __mk('Old', 'epic'), at: Date.now() }]; document.getElementById('dialog-text') || 0; game.expedition.active = false; return { stayed }; });
  ok('inside an expedition she takes nothing (the tower is out of reach, like the daily parcel)', r.stayed, r);
  // 5. the counter: the Wisp's "Held parcels" chip opens a card per parcel (oldest first, a days-left sticker, a Collect pill); collecting is free - one card, or
  //    all that fit, oldest first - and only what fits; "Anything for me?" tells the truth
  r = await page.evaluate(async () => { __clean(); __fill('equip', player.invCap.equip - 2); const now = Date.now(), d = 86400000, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    player.postbox = [6.2, 4, 3, 1, 0.1].map((days, i) => ({ it: __mk('Parcel ' + i, 'epic'), at: now - days * d }));
    openPostalWisp(); await sleep(400); const dlg = document.getElementById('dialog'), btn = (re) => [...dlg.querySelectorAll('#dialog-options button')].find((b) => re.test(b.textContent));
    const hb = btn(/Held parcels \(5\)/); const typed = () => __wait(() => !dlg.classList.contains('typing'), 25000);   // the answer types out (70 chars/s): read it when the reveal is done
    await typed(); const ask = btn(/Anything for me/); if (ask) ask.click(); await sleep(200); await typed(); const askText = document.getElementById('dialog-text').textContent;
    const open = () => document.getElementById('shop-modal').style.display === 'flex', cards = () => [...document.querySelectorAll('#shop-list .parcel-row')], inner = document.querySelector('#shop-modal .modal');
    const names = () => cards().map((c) => c.querySelector('.sell-name b').textContent), foot = () => document.getElementById('parcel-collect-btn'), held = () => _lxPostboxList().map((p) => p.it.name).join(), last = () => player.inventory[player.inventory.length - 1].name;
    const pills = () => cards().map((c) => c.querySelector('.parcel-go').textContent.trim()), fulls = () => cards().map((c) => c.classList.contains('full'));
    if (hb) hb.click(); await __wait(() => open()); await sleep(200);
    const o = { hasBtn: !!hb, askText, open: open(), dlgClosed: dlg.style.display !== 'block', cls: inner.classList.contains('parcel-desk') && inner.classList.contains('sell-desk'), title: document.getElementById('shop-title').textContent, names: names(),
      days: cards().map((c) => c.querySelector('.parcel-days').textContent.replace(/\s+/g, ' ').trim()), urgent: cards().map((c) => c.querySelector('.parcel-days').classList.contains('urgent')), go: pills(), foot: foot().textContent.trim() };
    cards()[3].click(); await sleep(300); o.one = { held: held(), tail: last(), cards: names().length, foot: foot().textContent.trim() };   // any card, not only the oldest
    foot().click(); await sleep(300); o.all = { held: held(), tail: last(), off: foot().disabled, foot: foot().textContent.trim(), go: pills(), full: fulls() };   // the last free slot goes to the oldest
    __toasts.length = 0; cards()[0].click(); await sleep(200); o.fullClick = { held: _lxPostboxList().length, said: __toasts.some((t) => /tab is full/.test(t)) };
    player.inventory = player.inventory.filter((x) => !/^Filler [0-3]$/.test(x.name)); openShop('parcels'); o.room = foot().textContent.trim(); foot().click(); await sleep(300); o.empty = { held: _lxPostboxList().length, text: document.getElementById('shop-list').textContent };
    return o; });
  ok('P opens the Wisp with a "Held parcels (5)" chip', r.hasBtn, r);
  ok('"Anything for me?" reports the real count instead of the old empty joke', /5 parcels/.test(r.askText), r.askText);
  ok('the chip opens the counter (the dialog closes): the sell desk\'s card grid, titled "Held Parcels", one card per parcel, oldest first', r.open && r.dlgClosed && r.cls && /Held Parcels/.test(r.title) && r.names.join() === 'Parcel 0,Parcel 1,Parcel 2,Parcel 3,Parcel 4', r);
  ok('each card has a days-left sticker (hot pink on the last day) and a Collect pill; with 2 free slots every card can go, and the footer says how many fit (2)', r.days.join() === '⏳ Last day,⏳ 3d left,⏳ 4d left,⏳ 6d left,⏳ 7d left' && r.urgent.join() === 'true,false,false,false,false' && r.go.join() === 'Collect,Collect,Collect,Collect,Collect' && /Collect 2 that fit/.test(r.foot), r);
  ok('a card click collects that parcel, any card (it joins the bag, the counter redraws with 4, 1 now fits)', r.one.held === 'Parcel 0,Parcel 1,Parcel 2,Parcel 4' && r.one.tail === 'Parcel 3' && r.one.cards === 4 && /Collect 1 that fit/.test(r.one.foot), r.one);
  ok('the footer takes what fits, oldest first (Parcel 0); the rest go grey ("Equip full") and the footer reads "bag is full" and is off', r.all.held === 'Parcel 1,Parcel 2,Parcel 4' && r.all.tail === 'Parcel 0' && r.all.off && /bag is full/.test(r.all.foot) && r.all.go.join() === 'Equip full,Equip full,Equip full' && r.all.full.join() === 'true,true,true', r.all);
  ok('a card whose tab is full does nothing but say so', r.fullClick.held === 3 && r.fullClick.said, r.fullClick);
  ok('with room again the footer takes the rest and the counter shows its empty state', /Collect 3 that fit/.test(r.room) && r.empty.held === 0 && /The satchel is flat/.test(r.empty.text), r);
  // 6. seven real days; repair; save and reload; no network
  r = await page.evaluate(() => { __clean(); const d = 86400000, now = Date.now();
    player.postbox = [{ it: __mk('Expired', 'epic'), at: now - 7 * d - 1000 }, { it: __mk('Fresh', 'epic'), at: now - 6.5 * d }, { it: { name: 'x"y', rarity: 'x" onmouseover=1', tier: 'zz' }, at: now }, 'junk', null, { it: 5, at: now }, { it: { rarity: 'epic' }, at: now }];
    const kept = _lxPostboxSanitize(); const fresh = kept.find((p) => p.it.name === 'Fresh'), bad = kept.find((p) => /xy/.test(p.it.name));
    return { names: kept.map((p) => p.it.name), left: fresh ? _lxPostboxDaysLeft(fresh) : null, repaired: bad ? [bad.it.rarity, bad.it.tier] : null }; });
  ok('a parcel is kept 7 real days (6.5 stays with 1 day left, 7 leaves) and a save with junk entries is cleaned', r.names.join() === 'Fresh,xy' && r.left === 1 && r.repaired.join() === 'common,0', r);
  r = await page.evaluate(() => { __clean(); player.postbox = Array.from({ length: 45 }, (_, i) => ({ it: __mk('P' + i, 'epic'), at: Date.now() })); return _lxPostboxSanitize().length; });
  ok('a save cannot carry more than 30 parcels', r === 30, r);
  r = await page.evaluate(async () => { __clean(); player.postbox = [{ it: __mk('Saved Sunblade', 'legendary', 'weapon', { tier: 7 }), at: Date.now() - 3600000 }];
    const inList = PLAYER_SAVE_FIELDS.indexOf('postbox') >= 0; if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow(); else saveState(); player.postbox = [];
    const loaded = loadState(); await new Promise((r) => setTimeout(r, 300)); return { inList, loaded, names: (player.postbox || []).map((p) => p.it.name), tier: (player.postbox[0] || { it: {} }).it.tier }; });
  ok('parcels are saved with the character and come back after a reload', r.inList && r.names.join() === 'Saved Sunblade' && r.tier === 7, r);
  r = await page.evaluate(() => [_lxPostboxHold, _lxPostboxCollect, _lxPostboxSanitize, _lxPostboxVisit].every((f) => !/\bnet\b|\.ws\b|_mp[A-Z]|_coop/.test(f.toString())));
  ok('nothing travels the network (no net / ws / co-op calls in the held-parcels code)', r === true, r);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
