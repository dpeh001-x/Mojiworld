// RELEASE 28b (world / map fix set) stays fixed - real keys (walk to the door, Up; W opens the map) in the running game:
//   [1] the W map's "back to" strip after the Usurpers' Court / the Last Step: no request for a region emblem those maps do not have
//       (no 404, no console error), each chip carries an icon (the painted emblem, else the W node's emoji)
//   [2] three ledge doors land the hero ON the back door's ledge (centre >= 6 px in from the lip), standing, outside its trigger:
//       Frostbite Hollow -> Sky Garden, Lava Cavern -> Dune Sands, Jade Grove -> Fungal Hollow
//   [3] a boss arena names one recommended level: the W hover text, every door into it (drawn label) and the arena dialog
//       (Krook Throne from the Sauro Slope, walked) all say _lxArenaRecLevel; no authored "(Lv 50 boss)" left
//   [4] area cards agree with their own roster (card within the ordinary roster's levels +-5): Carriage 29, Endless Express 29,
//       Bloomhaven 56; their monsters keep their levels
//   [5] a door arrival faces into the map: walking LEFT into three Zodiac Sanctum doors and an ordinary door, the hero lands facing
//       away from the door they came out of
//   [6] the Journal's coin preview is what the hand-in pays (Road I, real Turn-in click at Nurse Joyce): 0 / 3 / 5 Dawn Fragments,
//       with and without Dawn's Favor, with a Slaughter Ladder tier
//   node release28b_test.mjs     PORT (default 15961) / MOJI_GAME_FILE / SERVE_ROOT; ONLY=1,2,...
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15961), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 700) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
console.log('  serve pid ' + server.pid);
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try { console.log('  browser pid ' + browser.process().pid); } catch (e) {}
const errs = [], cons = [], bad = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 200)); });
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+\//, '')); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS !== 'undefined' && !!document.getElementById('lo-menu'), null, { timeout: 180000 });
  await sleep(3000);
  // straight into the world (the title menu is not under test): Lv 60 warrior, every story beat seen EXCEPT the epilogue (Dawn's Favor off)
  await page.evaluate(async () => {
    const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    player.cls = 'warrior'; try { devSetLevel(60); } catch (e) { player.level = 60; }
    player._god = true; player.invulnerable = 9e9;
    player._storyBeatsSeen = new Proxy({}, { get: (t, k) => k !== 'epilogue_gravitos', set: () => true });
    player._gravitosCineSeen = true; player._tutorialSeen = true;
    window._lxTwelveKnown = () => true; window._lxGravitosEarned = () => true; window._lxLastStepDoorOpen = () => true;
    game.visitedMaps = game.visitedMaps || {}; for (const id in MAPS) game.visitedMaps[id] = true;
    loadMap('forest', 300); game.paused = false; await sl(700);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
  });
  const clear = () => page.evaluate(() => { for (const o of document.querySelectorAll('#story-beat-overlay, #boss-intro-overlay')) o.classList.remove('on'); game.paused = false; player.hp = player.maxHp; player.invulnerable = 9e9; });
  const keyUp = async () => { await page.keyboard.down('ArrowUp'); await sleep(160); await page.keyboard.up('ArrowUp'); };
  // stand on the door's own surface `away` px from it (on `side`), then walk to it with the arrow keys and settle inside its trigger
  async function walkInto(door, side) {
    await page.evaluate(({ door, side }) => {
      const md = game.mapData; const y = door.y;
      const okx = (x) => (md.platforms || []).some((q) => Math.abs(q.y - y) <= 4 && x >= q.x + 4 && x <= q.x + q.w - 4);
      let sx = door.x + side * 100; if (!okx(sx)) sx = door.x + side * 60; if (!okx(sx)) sx = door.x - side * 100;
      player.x = sx - player.w / 2; player.y = y - player.h - 2; player.vx = 0; player.vy = 0; game.monsters.length = 0;
    }, { door, side });
    await sleep(500);
    let held = null;
    for (let t0 = Date.now(); Date.now() - t0 < 6000;) {
      await clear();
      const cx = await page.evaluate(() => player.x + player.w / 2);
      if (Math.abs(door.x - cx) < 18) break;
      const k = door.x > cx ? 'ArrowRight' : 'ArrowLeft';
      if (held !== k) { if (held) await page.keyboard.up(held); await page.keyboard.down(k); held = k; }
      await sleep(40);
    }
    if (held) await page.keyboard.up(held);
    for (let i = 0; i < 25; i++) {   // icy floors slide: settle, nudge with taps
      await sleep(250);
      const s = await page.evaluate(() => ({ cx: player.x + player.w / 2, vx: player.vx || 0 }));
      if (Math.abs(door.x - s.cx) < 36 && Math.abs(s.vx) < 0.6) break;
      if (Math.abs(door.x - s.cx) < 36) continue;
      const k = door.x > s.cx ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await sleep(60); await page.keyboard.up(k);
    }
  }
  // walk through `dest`'s door on map `src` with real keys; answers an arena dialog with its first button (Enter); returns the arrival
  async function through(src, dest, side, opts = {}) {
    await page.evaluate((src) => { loadMap(src, 300); }, src); await sleep(1200); await clear();
    const door = await page.evaluate((dest) => { const p = (game.portals || []).find((q) => q.dest === dest); return p ? { x: p.x, y: (typeof p.y === 'number') ? p.y : _defaultPortalY(p.x) } : null; }, dest);
    if (!door) return { err: 'no door ' + src + '>' + dest };
    await walkInto(door, side == null ? (door.x < 600 ? 1 : -1) : side);
    const faceIn = await page.evaluate(() => player.facing);
    await keyUp();
    let dlg = null;
    for (let i = 0; i < 50; i++) {
      await sleep(100);
      const s = await page.evaluate(() => { const d = document.getElementById('dialog'); const v = d && d.offsetParent !== null; return { m: game.currentMap, v, t: v ? (document.getElementById('dialog-text') || {}).textContent : null }; });
      if (s.v && !dlg) { dlg = s.t; if (opts.keepDialog) return { dlg, door }; await page.evaluate(() => { const b = document.querySelector('#dialog-options button'); if (b) b.click(); }); }
      if (s.m === dest) break;
    }
    await sleep(opts.settle || 1600); await clear();
    const a = await page.evaluate((src) => {
      const md = game.mapData, cx = player.x + player.w / 2, feet = player.y + player.h;
      const gp = (game.portals || []).filter((p) => p && p.dest === src).map((p) => ({ x: p.x, y: (typeof p.y === 'number') ? p.y : _defaultPortalY(p.x) }))
        .sort((p, q) => (Math.abs(p.y - feet) - Math.abs(q.y - feet)) || (Math.abs(p.x - cx) - Math.abs(q.x - cx)));
      const bd = gp[0] || null;
      const host = bd ? (md.platforms || []).find((q) => bd.x >= q.x && bd.x <= q.x + q.w && Math.abs(q.y - bd.y) <= 6) : null;
      return { map: game.currentMap, cx: Math.round(cx), feet: Math.round(feet), onGround: !!player.onGround, facing: player.facing, door: bd && { x: Math.round(bd.x), y: Math.round(bd.y) },
        host: host && [Math.round(host.x), Math.round(host.x + host.w), Math.round(host.y)], lip: host ? Math.round(Math.min(cx - host.x, host.x + host.w - cx)) : null,
        onHost: !!(host && Math.abs(host.y - feet) <= 4 && cx >= host.x && cx <= host.x + host.w), dist: bd ? Math.round(Math.abs(cx - bd.x)) : null };
    }, src);
    a.faceIn = faceIn; a.dlg = dlg; return a;
  }
  if (on('1')) {   // ---- [1] the "back to" strip
    await page.evaluate(async () => { const sl = (ms) => new Promise((r) => setTimeout(r, ms)); game.mapHistory = [];
      for (const [id, x] of [['glasswindSteppe', 300], ['lastStep', 300], ['usurpersCourt', 300], ['town', 900]]) { loadMap(id, x); game.paused = false; await sl(1400); } });
    await clear(); await sleep(400);
    const b0 = bad.length, c0 = cons.length;
    await page.keyboard.press('w'); await sleep(2800);
    const chips = await page.evaluate(() => [...document.querySelectorAll('#worldmap-recent button[data-map-id]')].map((b) => { const im = b.querySelector('img'), em = b.querySelector('.wm-rc-emo');
      return { id: b.getAttribute('data-map-id'), img: !!im, loaded: !!(im && im.complete && im.naturalWidth > 0), emo: em ? em.textContent : '' }; }));
    const nb = bad.slice(b0), nc = cons.slice(c0);
    const uc = chips.find((c) => c.id === 'usurpersCourt'), gs = chips.find((c) => c.id === 'glasswindSteppe');
    ok('[1] W after the Usurpers\' Court: no request for a region emblem it does not have (no 404 under Sprites/world/regions/)', !nb.some((u) => /regions\//.test(u)), nb);
    ok('[1] ...and no console error beyond the other 404s of that window', nc.length <= nb.filter((u) => !/regions\//.test(u)).length, { nc, nb });
    ok('[1] the Usurpers\' Court chip shows the W node\'s emoji (no broken image, not iconless); the Last Step (an arena) is not offered', !!uc && !uc.img && uc.emo.length > 0 && !chips.some((c) => c.id === 'lastStep'), chips);
    ok('[1] a painted map (Glasswind Steppe) still shows its emblem', !!gs && gs.img && gs.loaded, gs);
    await page.keyboard.press('Escape'); await sleep(600);
    await page.evaluate(() => { try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {} });
  }
  if (on('2')) {   // ---- [2] ledge doors land on the ledge
    for (const [src, dest] of [['frostbiteHollow', 'skyGarden'], ['lavaCavern', 'duneSands'], ['jadeGrove', 'mushroom']]) {
      const a = await through(src, dest, null, { settle: 2200 });
      ok(`[2] ${src} -> ${dest}: the hero stands ON the back door's ledge, centre >= 6 px in from its lip, outside its 50 px trigger`,
        a.map === dest && a.onGround && a.onHost && a.lip >= 6 && a.dist >= 50, a);
    }
  }
  if (on('3')) {   // ---- [3] one recommended level per arena
    const A = await page.evaluate(() => { const o = [];
      for (const id in MAPS) { const m = MAPS[id]; if (!m || !m.isBossArena || !(m.levelReq > 1) || m.levelLabel === false) continue;
        const doors = []; for (const s in MAPS) for (const po of (MAPS[s].portals || [])) if (po && po.dest === id) doors.push({ src: s, gate: po.levelGate | 0, name: po.name, label: _lxPortalLabel(po, _lxPortalArrow(po.name, po.x)) });
        o.push({ id, rec: _lxArenaRecLevel(m), doors }); }
      return o; });
    await page.evaluate(() => { loadMap('town', 900); }); await sleep(1500); await clear();
    await page.keyboard.press('w'); await sleep(2800);
    const W = await page.evaluate((ids) => { const o = {}; for (const id of ids) { const g = document.querySelector('[data-map-id="' + id + '"][aria-label]'); const t = g ? g.getAttribute('aria-label') : '';
      const mm = /Lv (\d+)\+ recommended/.exec(t); o[id] = mm ? +mm[1] : null; } return o; }, A.map((a) => a.id));
    await page.keyboard.press('Escape'); await sleep(600);
    const wBad = A.filter((a) => W[a.id] != null && W[a.id] !== a.rec).map((a) => a.id + ' W ' + W[a.id] + ' rec ' + a.rec);
    ok('[3] the W map names each boss arena\'s recommended level (the dialog\'s)', !wBad.length && W.krookThrone === 40 && W.slimeCave === A.find((a) => a.id === 'slimeCave').rec, { wBad, W });
    const dBad = []; for (const a of A) for (const d of a.doors) { const want = Math.max(d.gate, a.rec); const t = /\(Lv (\d+)\+?[^)]*\)/.exec(d.label);
      if (want >= 10 ? !(t && +t[1] === want && /\(Lv \d+\+\)/.test(d.label)) : !!t) dBad.push(d.src + '>' + a.id + ' "' + d.label + '" want ' + want); if (/boss\)/.test(d.name || '')) dBad.push('name ' + d.src + '>' + a.id + ' "' + d.name + '"'); }
    ok('[3] every door into a boss arena tags that level "(Lv N+)" (its gate when higher), no hand-written "(Lv 50 boss)" left', !dBad.length, dBad);
    // the Krook Throne from the Sauro Slope, walked: the drawn sign and the dialog
    await page.evaluate(() => { window.__drawn = []; const _ft = CanvasRenderingContext2D.prototype.fillText; if (!window.__ftHooked) { window.__ftHooked = 1; CanvasRenderingContext2D.prototype.fillText = function (t) { try { if (/Krook/.test(String(t))) window.__drawn.push(String(t)); } catch (e) {} return _ft.apply(this, arguments); }; } });
    const k = await through('sauroSlope', 'krookThrone', null, { keepDialog: true });
    const drawn = await page.evaluate(() => [...new Set(window.__drawn)]);
    await page.evaluate(() => { try { closeDialog(); } catch (e) {} });
    const dl = /Recommended level: (\d+)\+/.exec(k.dlg || ''), sg = drawn.map((t) => /\(Lv (\d+)/.exec(t)).filter(Boolean).map((m) => +m[1]);
    ok('[3] Krook Throne, walked from the Sauro Slope: the drawn door sign, the arena dialog and the W map all say 40', !!dl && +dl[1] === 40 && sg.length > 0 && sg.every((n) => n === 40) && W.krookThrone === 40, { dlg: k.dlg, drawn, W: W.krookThrone });
  }
  if (on('4')) {   // ---- [4] area cards
    const C = {};
    for (const id of ['tower', 'clockworkExpress', 'bloomhaven']) {
      C[id] = await page.evaluate(async (id) => { game._lastAreaCard = null; loadMap(id, 200); await new Promise((r) => setTimeout(r, 900));
        const sub = (document.querySelector('#area-title .at-sub') || {}).textContent || '';
        const lv = game.monsters.filter((m) => m && !m.isBoss && m.currentHp > 0).map((m) => ({ t: m.type, lv: _mobLevel(m), nat: MOB_NATURAL_LEVEL[m.type] || 0 }));
        return { sub, lvOk: lv.length > 0 && lv.every((x) => x.lv === (MAPS[id].expressScaling ? (player.level | 0) : x.nat)), lv: lv.slice(0, 3) }; }, id);   // the Express scales its mechs to the hero
      await clear();
    }
    ok('[4] area cards: the Carriage of Ascension and the Endless Express say Lv 29, Bloomhaven Lv 56', C.tower.sub === 'Recommended Lv 29' && C.clockworkExpress.sub === 'Recommended Lv 29' && C.bloomhaven.sub === 'Recommended Lv 56', C);
    ok('[4] ...and their monsters keep their own levels (the Express: the hero\'s, as before)', C.tower.lvOk && C.clockworkExpress.lvOk && C.bloomhaven.lvOk, C);
    const S = await page.evaluate(() => { const o = []; for (const id in MAPS) { const m = MAPS[id]; if (!m || m.isBossArena || m.levelLabel === false || !(+m.levelReq > 1)) continue; const s = _lxMapLvSpan(id); if (!s) continue;
      if (m.levelReq < s.lo - 5 || m.levelReq > s.hi + 5) o.push(id + ' card ' + m.levelReq + ' roster ' + s.lo + '-' + s.hi); } return o; });
    ok('[4] every "Recommended Lv" card sits within its ordinary roster +-5', !S.length, S);
  }
  if (on('5')) {   // ---- [5] facing on arrival
    for (const dest of ['zod_aries', 'zod_leo', 'zod_pisces']) {
      const a = await through('zodiacHall', dest, 1, { settle: 2000 });
      ok(`[5] walking LEFT into the Zodiac Sanctum door to ${dest}: the hero lands facing into the arena, away from the door`, a.map === dest && a.faceIn === -1 && !!a.door && a.facing === (a.cx >= a.door.x ? 1 : -1), a);
    }
    const t = await through('town', 'forest', null);
    const away = t.door && (t.cx >= t.door.x ? 1 : -1);
    const t2 = await through('forest', 'town', null);
    const away2 = t2.door && (t2.cx >= t2.door.x ? 1 : -1);
    ok('[5] an ordinary door pair (Everdawn <-> Forest): each arrival faces away from the door it came out of', t.map === 'forest' && t.facing === away && t2.map === 'town' && t2.facing === away2, { t, t2 });
  }
  if (on('6')) {   // ---- [6] the Journal's coins are the coins the hand-in pays
    const SC = [{ f: 0, dawn: false, ks: 0 }, { f: 3, dawn: false, ks: 0 }, { f: 5, dawn: false, ks: 0 }, { f: 0, dawn: true, ks: 0 }, { f: 3, dawn: true, ks: 0 }, { f: 5, dawn: true, ks: 0 }, { f: 5, dawn: true, ks: 3 }];
    const rows = [];
    for (const sc of SC) {
      await page.evaluate((sc) => {
        player.dawnFragments = Object.keys(DAWN_FRAGMENTS).slice(0, sc.f);
        player.titles = player.titles || {}; if (sc.dawn) player.titles[LX_TITLE_CONQUEROR] = true; else delete player.titles[LX_TITLE_CONQUEROR];
        player._ksTier = sc.ks;
        const Q = player.quests; delete Q.completed.q_road_1; delete Q.active.q_road_1;
        acceptQuest('q_road_1', true); Q.active.q_road_1.readyToHandIn = true;
        game._lastAreaCard = 'everdawn_megamall'; loadMap('everdawn_megamall', 600);   // Nurse Joyce keeps the Megamall's clinic
      }, sc);
      await sleep(1300); await clear();
      // the Journal (Q): the exact figure is on the reward strip's tooltip
      await page.keyboard.press('q'); await sleep(900);
      const shown = await page.evaluate(() => { const nm = QUESTS.q_road_1.name; for (const el of document.querySelectorAll('.qj-rw[title]')) { let r = el; for (let i = 0; i < 6 && r && !(r.textContent || '').includes(nm); i++) r = r.parentElement;
        if (r && (r.textContent || '').includes(nm)) { const m = /Reward [^0-9]*([0-9,]+) Mojicoins/.exec(el.getAttribute('title')); if (m) return +m[1].replace(/,/g, ''); } } return null; });
      await page.keyboard.press('q'); await sleep(500);
      await page.evaluate(() => { try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {} });
      // Nurse Joyce, talked to (N), the Turn in button clicked
      await page.evaluate(() => { const n = (game.npcs || []).find((q) => q && q.name === 'Nurse Joyce'); if (n) { player.x = n.x - 34; player.y = n.y + (n.h || 48) - player.h - 2; player.vx = 0; player.vy = 0; } });
      await sleep(600); await clear();
      const c0 = await page.evaluate(() => player.mojicoins || 0);
      await page.keyboard.press('n'); await sleep(900);
      const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => /Turn in/.test(x.textContent)); if (b) { b.click(); return true; } return false; });
      await sleep(900);
      const r = await page.evaluate(() => ({ coins: player.mojicoins || 0, done: !!player.quests.completed.q_road_1, ks: _ksCoinMul(), dawn: _lxDawnCoinMul() }));
      try { await page.evaluate(() => { try { closeDialog(); } catch (e) {} for (const o of document.querySelectorAll('#story-beat-overlay')) o.classList.remove('on'); }); } catch (e) {}
      rows.push({ ...sc, shown, paid: r.coins - c0, clicked, done: r.done, ks: r.ks, dawn: r.dawn });
    }
    ok('[6] every hand-in happened through Nurse Joyce\'s Turn in button', rows.every((x) => x.clicked && x.done), rows);
    ok('[6] the Journal\'s Road I coins == the coins the hand-in paid (0 / 3 / 5 fragments, with and without Dawn\'s Favor, a Ladder tier)', rows.every((x) => x.shown != null && x.shown === x.paid), rows);
    ok('[6] ...and the cases really differ (Dawn\'s Favor and the Ladder move the pay)', new Set(rows.map((x) => x.paid)).size >= 3, rows.map((x) => x.paid));
  }
} finally {
  console.log('errors: ' + JSON.stringify(errs.slice(0, 4)));
  await browser.close(); server.kill();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
