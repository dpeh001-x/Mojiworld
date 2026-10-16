// RELEASE 26a (economy / systems hunter round) stays fixed - real clicks and keys, a fresh hero per part:
//   [1] Barnaby's bench: a double-click on a T8 row forges nothing yet and shows "✓ Confirm"; Confirm forges ONE piece for one
//       price; an off-class row asks first (and says why); a cheap own-class T5 row is one click and a double-click on it forges one;
//       _craftSetPiece called twice at once forges one
//   [2] an Expedition: the Boons tab's Reroll is disabled and says so; a reroll / discard is refused (no charge, no confirm), and after
//       the run ends nothing was paid and the roll is the one from before; outside the run a reroll still works
//   [3] the bag's bulk discard: ticks are the items - a bag change under them keeps them on the same items, the confirm names them,
//       exactly those two go; closing the panel (Esc) clears the ticks
//   [4] hover compare rows equal what equipping really changes (getEquipBonus, measured after a real click) for an off-class weapon,
//       own-class ★0 / ★5 / ★10 weapons, an armour and an accessory; the star line's main-stat figure is the measured ★10/★0 ratio;
//       getEquipBonus is the sum of _lxItemContrib over the worn pieces + set bonuses
//   [5] the star forge: the preview's ATK now / next are what the weapon pays before / after a real Forge click, its chip is the
//       real step; ★2 reads "Safe" (no ★ loss), ★5 "Dangerous"
//   [6] Reset Stats: the toast's SP = the dialog's +SP = the SP really gained; [7] Felina states the trillion ceiling, and it holds
//   node release26a_test.mjs        PORT (default 15272) / MOJI_GAME_FILE / SERVE_ROOT; ONLY=1,2,...; R26A_SHOT=<path prefix> for shots
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15272), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const SHOT = process.env.R26A_SHOT || '';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const press = async (page, key, hold = 110) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(150); };
const boot = async (kit) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(async (k) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== k.cls) { try { applyClass(k.cls); } catch (e) {} player.cls = k.cls; }
    devSetLevel(k.level);
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const b in STORY_BEATS) player._storyBeatsSeen[b] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    player.mojicoins = k.coins; player.bankBalance = 0; player.setshards = k.shards || 0;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clear = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); }
      { const am = document.getElementById('advancement-modal'); if (am) am.style.display = 'none'; }
      { const tm = document.getElementById('tutorial-modal'); if (tm && (tm.classList.contains('tut-dock') || getComputedStyle(tm).display !== 'none')) try { _closeTutorial(true); } catch (e) {} } game.paused = false; };
    window.__toasts = []; const _st = window.showToast; window.showToast = function (m) { try { window.__toasts.push(String(m)); } catch (e) {} return _st.apply(this, arguments); };
    const mk = (b, stars, slot) => ({ ...b, baseName: b.name, stars: stars || 0, slot });
    window._r26 = { sleep, clear, mk };
    game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { town: null });
    loadMap('town', 600); for (let i = 0; i < 6; i++) { await sleep(250); clear(); }
  }, kit);
  await page.waitForTimeout(400);
  return page;
};
// the U panel on a tab: U pressed until the tab shows (a map-entry film can eat the first press), then the tab clicked
const openU = async (page, tab) => { for (let k = 0; k < 6; k++) { await press(page, 'u'); try { await page.waitForSelector('[data-utab="' + tab + '"]', { state: 'visible', timeout: 2500 }); break; } catch (e) { await page.evaluate(() => { try { window._r26.clear(); } catch (e) {} }); } }
  await page.click('[data-utab="' + tab + '"]'); await page.waitForTimeout(500); };
const st = (page) => page.evaluate(() => ({ coins: player.mojicoins, shards: player.setshards, bag: player.inventory.map((i) => i.name) }));
const shot = async (page, name) => { if (SHOT) try { await page.screenshot({ path: SHOT + name + '.png' }); } catch (e) {} };
// the centre of the i-th match, once nothing covers it (a map-entry video can sit over the bench for a moment after boot)
const btnBox = async (page, sel, i) => { const h = (await page.$$(sel))[i]; if (!h) return null; await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox(); if (!b) return null;
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.waitForFunction((a) => { const t = document.querySelectorAll(a.sel)[a.i]; const e = document.elementFromPoint(a.x, a.y); return !!t && !!e && (e === t || t.contains(e)); }, { sel, i, x: c.x, y: c.y }, { timeout: 30000 }).catch(() => {});
  return c; };
const confirmText = (page) => page.evaluate(() => { const m = document.getElementById('confirm-modal'); if (!m || getComputedStyle(m).display === 'none') return null; return ((document.getElementById('confirm-title') || {}).textContent || '') + ' || ' + ((document.getElementById('confirm-body') || {}).textContent || ''); });
try {
  // ---------------- [1] the craft bench
  if (on('1')) {
    const page = await boot({ cls: 'warrior', level: 75, coins: 10000000, shards: 200000 });
    await page.evaluate(() => { player.inventory = []; openCraftingModal(); }); await page.waitForTimeout(600);
    const rowIdx = (re, off) => page.$$eval('#craft-list .enhance-item', (rs, a) => rs.findIndex((r) => new RegExp(a[0]).test(r.querySelector('button').textContent) && (a[1] ? /-only/.test(r.textContent) : !/-only/.test(r.textContent))), [re, off]);
    const label = (i) => page.$$eval('#craft-list .enhance-item', (rs, i) => [rs[i].querySelector('button').textContent.trim(), rs[i].textContent.replace(/\s+/g, ' ').trim()], i);
    const t8 = await rowIdx('45,?000', false);
    const S0 = await st(page);
    let b = await btnBox(page, '#craft-list .enhance-item button', t8);
    await page.mouse.dblclick(b.x, b.y); await page.waitForTimeout(700);
    const S1 = await st(page); const L1 = await label(t8);
    await shot(page, 'r26a_craft');
    ok('[1a] a double-click on a T8 row forges nothing yet, and the row asks "✓ Confirm"', S1.bag.length === 0 && S0.coins === S1.coins && /Confirm/.test(L1[0]), { forged: S1.bag.length, spent: S0.coins - S1.coins, btn: L1[0] });
    b = await btnBox(page, '#craft-list .enhance-item button', t8); await page.mouse.click(b.x, b.y); await page.waitForTimeout(700);
    const S2 = await st(page);
    ok('[1b] Confirm forges ONE piece for one price (2,000,000 + 45,000)', S2.bag.length === 1 && S0.coins - S2.coins === 2000000 && S0.shards - S2.shards === 45000, { forged: S2.bag.length, coins: S0.coins - S2.coins, shards: S0.shards - S2.shards });
    const off = await rowIdx('8,?000', true);
    const S3 = await st(page);
    b = await btnBox(page, '#craft-list .enhance-item button', off); await page.mouse.click(b.x, b.y); await page.waitForTimeout(600);
    const S4 = await st(page); const L4 = await label(off);
    ok('[1c] one click on an off-class T5 row forges nothing and asks, saying it pays -25% for this class', S4.bag.length === S3.bag.length && S4.coins === S3.coins && /Confirm/.test(L4[0]) && /−25%/.test(L4[1]), { forged: S4.bag.length - S3.bag.length, row: L4[1].slice(0, 160) });
    await page.waitForTimeout(4400);
    const L5 = await label(off);
    ok('[1d] ...and the ask lapses after 4 s', !/Confirm/.test(L5[0]), L5[0]);
    const own = await rowIdx('8,?000', false);
    const S5 = await st(page);
    b = await btnBox(page, '#craft-list .enhance-item button', own); await page.mouse.click(b.x, b.y); await page.waitForTimeout(700);
    const S6 = await st(page);
    await page.waitForTimeout(500);
    b = await btnBox(page, '#craft-list .enhance-item button', own); await page.mouse.dblclick(b.x, b.y); await page.waitForTimeout(700);
    const S7 = await st(page);
    ok('[1e] a cheap own-class T5 row is one click (one piece), and a double-click on it forges ONE', S6.bag.length - S5.bag.length === 1 && S7.bag.length - S6.bag.length === 1 && S5.coins - S7.coins === 500000, { click: S6.bag.length - S5.bag.length, dbl: S7.bag.length - S6.bag.length, coins: S5.coins - S7.coins });
    const twice = await page.evaluate(async () => { await window._r26.sleep(500); const e = _allCraftables().find((x) => x.item.tier === 5 && (x.item.cls === player.cls || x.item.cls === 'any')); const n0 = player.inventory.length, c0 = player.mojicoins; _craftSetPiece(e); _craftSetPiece(e); return { made: player.inventory.length - n0, coins: c0 - player.mojicoins }; });
    ok('[1f] _craftSetPiece called twice at once forges one piece', twice.made === 1 && twice.coins === 250000, twice);
    await page.context().close();
  }
  // ---------------- [2] boons inside an Expedition
  if (on('2')) {
    const page = await boot({ cls: 'warrior', level: 45, coins: 100000 });
    const bst = () => page.evaluate(() => ({ coins: player.mojicoins, boons: (player.boons || []).map((b) => b.id + ':' + b.roll).join(' '), n: (player.boons || []).length, exp: !!(game.expedition && game.expedition.active) }));
    await page.evaluate(() => {
      const defs = POWERUPS.filter((d) => d && d.id && d.min !== d.max);
      const a = rollBoonInstance(defs[0].id), b = rollBoonInstance(defs[1].id);
      player.boons = [a, b]; player.boonsEquipped = [0]; _applyEquippedBoons();
      _startExpedition();
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { window._r26.clear(); game.monsters = []; window.__toasts.length = 0; });
    const B0 = await bst();
    await openU(page, 'boons');
    const rr = await page.evaluate(() => [...document.querySelectorAll('#lp-boons [data-reroll]')].map((x) => ({ dis: x.disabled, txt: x.textContent.trim(), title: x.title || '' })));
    ok('[2a] in a run the Boons tab\'s Reroll buttons are disabled and say why', rr.length === 2 && rr.every((r) => r.dis && /after the run/.test(r.txt + r.title)), rr);
    await page.evaluate(() => { const b = document.querySelector('#lp-boons [data-reroll]'); b.disabled = false; b.scrollIntoView({ block: 'center' }); });   // force the click through, as a stale tab would let it
    await page.click('#lp-boons [data-reroll]'); await page.waitForTimeout(400);
    const B1 = await bst(); const t1 = await page.evaluate(() => window.__toasts.slice(-2));
    ok('[2b] a reroll inside the run is refused: nothing charged, the roll stays, the toast says why', B1.coins === B0.coins && B1.boons === B0.boons && t1.some((t) => /Finish or leave the Expedition before you reroll/.test(t)), { paid: B0.coins - B1.coins, same: B1.boons === B0.boons, t1 });
    await page.evaluate(() => { const b = document.querySelector('#lp-boons [data-discard]'); if (b) b.scrollIntoView({ block: 'center' }); });
    await page.click('#lp-boons [data-discard]'); await page.waitForTimeout(400);
    const c1 = await confirmText(page);
    if (c1) { await page.click('#confirm-yes'); await page.waitForTimeout(400); }
    const B2 = await bst();
    ok('[2c] a discard inside the run is refused before any confirm (the run-end restore would bring it back)', !c1 && B2.n === 2, { confirm: c1, n: B2.n });
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.evaluate(() => { _endExpedition('quit'); }); await page.waitForTimeout(2500);
    const B3 = await bst();
    ok('[2d] after the run ends nothing was paid for it and the bag is the one from before', !B3.exp && B3.coins === B0.coins && B3.boons === B0.boons, { paid: B0.coins - B3.coins, before: B0.boons, after: B3.boons });
    await page.evaluate(() => { window._r26.clear(); });
    await openU(page, 'boons');
    await page.evaluate(() => { const b = document.querySelector('#lp-boons [data-reroll]'); if (b) b.scrollIntoView({ block: 'center' }); });
    const en = await page.evaluate(() => { const b = document.querySelector('#lp-boons [data-reroll]'); return b ? !b.disabled : null; });
    if (en) await page.click('#lp-boons [data-reroll]'); await page.waitForTimeout(400);
    const B4 = await bst();
    ok('[2e] outside a run the Reroll button works and charges as before', en === true && B4.coins < B3.coins, { enabled: en, paid: B3.coins - B4.coins });
    await page.context().close();
  }
  // ---------------- [3] the bag's bulk discard
  if (on('3')) {
    const page = await boot({ cls: 'warrior', level: 45, coins: 2000000 });
    const names = ['Iron Sword', 'Wooden Sword', 'Steel Blade', 'Runed Sabre', 'Enchanted Katana'];
    const fill = () => page.evaluate((names) => { player.inventory = []; for (const n of names) { const b = ITEM_POOL.weapons.find((i) => i.name === n); player.inventory.push(window._r26.mk(b, 0, 'weapon')); } }, names);
    const bag = () => page.evaluate(() => player.inventory.map((i) => i.name));
    const tick = async (nm) => { const i = await page.evaluate((nm) => player.inventory.findIndex((x) => x.name === nm), nm); await page.click('#u-inv-grid .inv-slot[data-invidx="' + i + '"]'); await page.waitForTimeout(250); };
    const ticked = () => page.evaluate(() => [...document.querySelectorAll('#u-inv-grid .inv-slot[data-invidx]')].filter((s) => (s.querySelector('.inv-pick') || {}).textContent === '☑').map((s) => player.inventory[+s.dataset.invidx].name));
    await fill();
    await openU(page, 'items');
    await page.click('#u-inv-bulk-toggle'); await page.waitForTimeout(300);
    await tick('Wooden Sword'); await tick('Steel Blade');
    const T0 = await ticked();
    // the bag changes under the open panel: the first piece leaves (a sale), a new one arrives (a buy) - same length
    await page.evaluate(() => { player.inventory.splice(0, 1); const b = ITEM_POOL.weapons.find((i) => !['Iron Sword', 'Wooden Sword', 'Steel Blade', 'Runed Sabre', 'Enchanted Katana'].includes(i.name) && (i.tier | 0) <= 3); player.inventory.push(window._r26.mk(b, 0, 'weapon')); renderInventory('u-'); });
    await page.waitForTimeout(300);
    const T1 = await ticked();
    ok('[3a] after a sale + a buy (same bag length) the ticks stay on the items the player chose', JSON.stringify(T1.slice().sort()) === JSON.stringify(['Steel Blade', 'Wooden Sword']), { before: T0, after: T1 });
    await page.click('#u-inv-bulk-go'); await page.waitForTimeout(400);
    const c = await confirmText(page);
    ok('[3b] the confirm names what goes', !!c && /Wooden Sword/.test(c) && /Steel Blade/.test(c), c);
    if (c) { await page.click('#confirm-yes'); await page.waitForTimeout(400); }
    const B1 = await bag();
    ok('[3c] exactly those two are gone', !B1.includes('Wooden Sword') && !B1.includes('Steel Blade') && B1.length === 3 && B1.includes('Runed Sabre') && B1.includes('Enchanted Katana'), B1);
    await tick(B1[0]);
    const T2 = await ticked();
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const left = await page.evaluate(() => (game._invDiscardSel && game._invDiscardSel.size) | 0);
    ok('[3d] closing the panel (Esc) clears the ticks, as Brok\'s sell desk does', T2.length === 1 && left === 0, { ticked: T2, leftAfterClose: left });
    await page.context().close();
  }
  // ---------------- [4] compare rows, star line, payout identity, forge preview, risk chip
  if (on('4')) {
    const page = await boot({ cls: 'warrior', level: 75, coins: 3000000 });
    const KEYS = ['atk', 'def', 'hp', 'mp', 'crit', 'atkPct', 'critDmg'];
    const LBL = { 'ATK': 'atk', 'DEF': 'def', 'HP': 'hp', 'MP': 'mp', '% Crit': 'crit', '% ATK': 'atkPct', '% Crit DMG': 'critDmg' };
    const setup = await page.evaluate(() => {
      const P = window._r26.mk, cls = player.cls;
      const W = ITEM_POOL.weapons.filter((it) => (it.tier | 0) === 8);
      const own = W.filter((it) => it.cls === cls).sort((a, b) => a.atk - b.atk)[0];
      const own2 = W.filter((it) => it.cls === cls && it !== own)[0] || own;
      const off = W.filter((it) => it.cls !== cls && it.cls !== 'any' && !it.setId).sort((a, b) => b.atk - a.atk)[0];
      const A = ITEM_POOL.armors.filter((it) => (it.tier | 0) === 8 && (it.cls === cls || it.cls === 'any'));
      const C = ITEM_POOL.accessories.filter((it) => (it.tier | 0) >= 7 && (it.cls === cls || it.cls === 'any'));
      const accCrit = C.find((it) => (it.crit || 0) > 0) || C[1] || C[0];
      player.equipped.weapon = P(own, 0, 'weapon'); player.equipped.armor = P(A[0], 0, 'armor'); player.equipped.accessory = P(C.find((x) => x !== accCrit) || C[0], 0, 'accessory');
      invalidateEquipBonusCache();
      const probes = [P(off, 0, 'weapon'), P(own2, 5, 'weapon'), P(own, 10, 'weapon'), P(A[1] || A[0], 5, 'armor'), P(accCrit, 0, 'accessory')];
      probes.forEach((p, i) => { p._r26 = 'p' + i; });
      player.inventory = probes.slice();
      window.__base = { w: player.equipped.weapon, a: player.equipped.armor, c: player.equipped.accessory };
      return probes.map((p) => p.name + ' ' + p.slot + ' cls ' + p.cls + ' *' + p.stars);
    });
    console.log('  probes: ' + setup.join(' | '));
    const bonus = () => page.evaluate((K) => { const o = {}; for (const k of K) o[k] = getEquipBonus(k); return o; }, KEYS);
    await openU(page, 'items');
    const bad = [];
    for (let i = 0; i < setup.length; i++) {
      const box = await page.evaluate((tag) => { const s = [...document.querySelectorAll('#u-inv-grid .inv-slot[data-invidx]')].find((el) => (player.inventory[+el.dataset.invidx] || {})._r26 === tag); if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, 'p' + i);
      if (!box) { bad.push({ probe: i, err: 'no tile' }); continue; }
      await page.mouse.move(box.x - 220, box.y - 120); await page.mouse.move(box.x, box.y, { steps: 4 }); await page.waitForTimeout(350);
      const rows = await page.evaluate(() => { const t = document.getElementById('item-tooltip'); if (!t || t.style.display === 'none') return null; return [...t.querySelectorAll('div')].map((d) => d.textContent.trim()).filter((x) => /^[▲▼] [+-]/.test(x) && !/Power/.test(x)); });
      if (i === 0) await shot(page, 'r26a_compare');
      const B0 = await bonus();
      await page.mouse.click(box.x, box.y); await page.waitForTimeout(450);
      const B1 = await bonus();
      const shown = {}; for (const r of rows || []) { const p = r.split(' '); const v = parseFloat(p[1].split(',').join('')); const k = LBL[p.slice(2).join(' ')]; if (k) shown[k] = v; }
      for (const k of KEYS) {
        const pct = k === 'atkPct' || k === 'critDmg';
        const real = (B1[k] - B0[k]) * (pct ? 100 : 1);
        const s = shown[k];
        if (s === undefined) { if (Math.abs(real) >= 1) bad.push({ probe: i, k, real: +real.toFixed(2), shown: 'none' }); continue; }
        if (Math.abs(s - real) > 1.01) bad.push({ probe: i, k, real: +real.toFixed(2), shown: s });
      }
      await page.evaluate(() => { const b = window.__base; for (const sl of ['weapon', 'armor', 'accessory']) { const cur = player.equipped[sl]; if (cur !== b[{ weapon: 'w', armor: 'a', accessory: 'c' }[sl]]) { const j = player.inventory.indexOf(b[{ weapon: 'w', armor: 'a', accessory: 'c' }[sl]]); if (j >= 0) player.inventory.splice(j, 1, cur); player.equipped[sl] = b[{ weapon: 'w', armor: 'a', accessory: 'c' }[sl]]; } } invalidateEquipBonusCache(); renderInventory('u-'); });
      await page.waitForTimeout(300);
    }
    ok('[4a] every hover compare row equals what a real equip changes (off-class, own *0/*5/*10 weapons, armour, accessory)', bad.length === 0, bad.slice(0, 6));
    // the star line of the 10-star weapon: its ATK figure is the measured 10-star / 0-star ratio
    const star = await page.evaluate(async () => {
      const tile = [...document.querySelectorAll('#u-inv-grid .inv-slot[data-invidx]')].find((el) => (player.inventory[+el.dataset.invidx] || {})._r26 === 'p2');
      tile.dispatchEvent(new MouseEvent('mouseenter')); await window._r26.sleep(200);
      const tt = document.getElementById('item-tooltip'); const line = [...tt.querySelectorAll('div')].map((d) => d.textContent).find((x) => x.indexOf('★★') >= 0) || '';
      const it = player.inventory[+tile.dataset.invidx], cur = player.equipped.weapon;
      const W = (w) => { player.equipped.weapon = w; invalidateEquipBonusCache(); const a = getEquipBonus('atk'); player.equipped.weapon = null; invalidateEquipBonusCache(); const z = getEquipBonus('atk'); player.equipped.weapon = cur; invalidateEquipBonusCache(); return a - z; };
      const w10 = W(it), w0 = W(Object.assign({}, it, { stars: 0 }));
      tile.dispatchEvent(new MouseEvent('mouseleave'));
      return { line: line.trim(), real: Math.round((w10 / w0 - 1) * 100) };
    });
    const m = star.line.match(/ATK [+]([0-9]+)%/);
    ok('[4b] the 10-star weapon\'s star line gives ATK its own curve, as measured', !!m && Math.abs(+m[1] - star.real) <= 1, star);
    const ident = await page.evaluate((K) => { const out = []; const eqs = [window.__base, { w: player.inventory.find((x) => x._r26 === 'p2'), a: player.inventory.find((x) => x._r26 === 'p3'), c: player.inventory.find((x) => x._r26 === 'p4') }];
      const keep = { ...player.equipped };
      for (const e of eqs) { player.equipped.weapon = e.w; player.equipped.armor = e.a; player.equipped.accessory = e.c; invalidateEquipBonusCache();
        for (const k of K) { let sum = 0; for (const sl of ['weapon', 'armor', 'accessory']) sum += (typeof _lxItemContrib === 'function') ? _lxItemContrib(player.equipped[sl], k, sl) : NaN; sum += getSetBonus(k); const g = getEquipBonus(k); if (!(Math.abs(sum - g) < 1e-9)) out.push({ k, sum, g }); } }
      Object.assign(player.equipped, keep); invalidateEquipBonusCache(); return out; }, KEYS);
    ok('[4c] getEquipBonus is exactly the sum of _lxItemContrib over the worn pieces plus set bonuses', ident.length === 0, ident.slice(0, 4));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.context().close();
  }
  // ---------------- [5] the star forge: preview = payout, the chip = the real step, the risk label = the failure rule
  if (on('5')) {
    const page = await boot({ cls: 'warrior', level: 75, coins: 3000000 });
    await page.evaluate(() => { const P = window._r26.mk; const W = ITEM_POOL.weapons.filter((it) => (it.tier | 0) === 8 && it.cls === player.cls)[0];
      player.inventory = []; player.equipped.weapon = P(W, 2, 'weapon'); invalidateEquipBonusCache(); });
    const wpay = () => page.evaluate(() => { const cur = player.equipped.weapon; const a = getEquipBonus('atk'); player.equipped.weapon = null; invalidateEquipBonusCache(); const z = getEquipBonus('atk'); player.equipped.weapon = cur; invalidateEquipBonusCache(); return a - z; });
    const read = () => page.evaluate(() => { const r = [...document.querySelectorAll('#enhance-preview .forge-row')].find((x) => (x.querySelector('.fr-k') || {}).textContent === 'ATK');
      const chips = [...document.querySelectorAll('#enhance-preview span')].map((x) => x.textContent.trim());
      return { a: r ? parseFloat(r.querySelector('.fr-a').textContent) : null, b: r ? parseFloat(r.querySelector('.fr-b').textContent) : null,
        chip: chips.find((t) => /over current/.test(t)) || '', risk: chips.find((t) => /success/.test(t) && /Safe|Risky|Dangerous/.test(t)) || '',
        note: ((document.getElementById('enhance-preview') || {}).textContent || '').indexOf('no ★ loss') >= 0, name: ((document.querySelector('#enhance-preview div div') || {}).textContent || '').trim(), stars: player.equipped.weapon.stars };
    });
    const pickWeapon = async () => { const t = await page.$$('#enhance-list .inv-slot'); await t[0].click(); await page.waitForTimeout(400); };   // the weapon is the only piece
    await page.evaluate(() => openEnhancementModal()); await page.waitForTimeout(600);
    await pickWeapon();
    const P0 = await read(); const W0 = await wpay();
    ok('[5a] the preview\'s ATK now is what the weapon pays (class bonus included)', P0.a != null && Math.abs(P0.a - W0) <= 1, { shown: P0.a, pays: Math.round(W0), name: P0.name });
    const gm = P0.chip.match(/[+]([0-9-]+)% ATK over current/);
    ok('[5b] the "over current" chip is the ATK step the next star really adds', !!gm && P0.a > 0 && Math.abs(+gm[1] - Math.round((P0.b / P0.a - 1) * 100)) <= 1, { chip: P0.chip, a: P0.a, b: P0.b });
    ok('[5c] at 2 stars (failure cannot take a star) the chip reads Safe, beside the "no ★ loss" line', /Safe/.test(P0.risk) && !/Risky/.test(P0.risk) && P0.note, { risk: P0.risk, note: P0.note });
    await page.evaluate(() => { window.__mr = Math.random; Math.random = () => 0; });
    await page.click('#do-enhance'); await page.waitForTimeout(300);
    await page.evaluate(() => { Math.random = window.__mr; }); await page.waitForTimeout(2500);
    const W1 = await wpay(); const st1 = await page.evaluate(() => player.equipped.weapon.stars);
    ok('[5d] after a real Forge click lands 3 stars, the weapon pays the preview\'s "next" ATK', st1 === 3 && Math.abs(P0.b - W1) <= 1, { next: P0.b, pays: Math.round(W1), stars: st1 });
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    await page.evaluate(() => { player.equipped.weapon.stars = 5; invalidateEquipBonusCache(); window._r26.clear(); openEnhancementModal(); }); await page.waitForTimeout(500);
    await pickWeapon();
    const P5 = await read();
    ok('[5e] from 5 stars (a failure can take a star) it reads Dangerous', /Dangerous/.test(P5.risk) && !P5.note, { risk: P5.risk });
    await page.context().close();
  }
  // ---------------- [6] Reset Stats: the toast, the dialog and the SP really gained agree
  if (on('6')) {
    const page = await boot({ cls: 'warrior', level: 45, coins: 100000, shards: 5000 });
    await page.evaluate(() => { player.skillPoints = 0; player._levelUpSpent = { atk: 5 }; player.baseAtk += 50; player._trainerSpent = { atk: 3, def: 2, hp: 1 }; player.baseAtk += 3; player.baseDef += 2; player.maxHp += 10; window.__toasts.length = 0; });
    await openU(page, 'lp');
    await page.evaluate(() => { const b = document.getElementById('lp-reset-btn'); if (b) b.scrollIntoView({ block: 'center' }); });
    await page.click('#lp-reset-btn'); await page.waitForTimeout(500);
    const dlg = await page.evaluate(() => { const g = document.querySelector('#confirm-modal .rc-gain b'); return g ? +g.textContent : null; });
    await page.click('#confirm-yes'); await page.waitForTimeout(600);
    const after = await page.evaluate(() => ({ sp: player.skillPoints, toast: window.__toasts.find((t) => /Stats reset/.test(t)) || '' }));
    const tm = after.toast.match(/reset . ([0-9]+) SP refunded/);
    ok('[6] the reset toast prints the SP the dialog promised and the hero got', dlg != null && !!tm && +tm[1] === dlg && after.sp === dlg, { dialog: dlg, toast: after.toast, gained: after.sp });
    await page.context().close();
  }
  // ---------------- [7] Felina: the bank's ceiling is stated, and it holds
  if (on('7')) {
    const page = await boot({ cls: 'warrior', level: 45, coins: 100000 });
    await page.evaluate(() => { openNPC({ role: 'banker', name: 'Felina', x: player.x + player.w / 2, y: player.y }); });
    await page.waitForTimeout(500);
    const opt = await page.evaluate(() => [...document.querySelectorAll('#dialog-options button')].findIndex((b) => /How does interest work/.test(b.textContent)));
    if (opt >= 0) { await (await page.$$('#dialog-options button'))[opt].click(); await page.waitForFunction(() => /ledgers second/.test((document.getElementById('dialog-text') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {}); }
    const txt = await page.evaluate(() => (document.getElementById('dialog-text') || {}).textContent || '');
    const cap = await page.evaluate(() => { try { closeDialog(); } catch (e) {} const g = game.expedition; game.expedition = { active: false }; player.bankBalance = 1e12 - 5; player.bankAccrueMs = 0; _lxBankAccrue(3600000 * 3); const b = player.bankBalance; player.bankBalance = 0; game.expedition = g; return b; });
    ok('[7] Felina no longer says "no cap" - she names the trillion ceiling, and three hours\' interest on 1e12 - 5 stops at 1e12', opt >= 0 && !/no cap/.test(txt) && /trillion/.test(txt) && cap <= 1e12, { said: txt.slice(0, 160), balance: cap });
    await page.context().close();
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { ok('harness: ' + String(e && e.stack || e).slice(0, 300), false); }
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
