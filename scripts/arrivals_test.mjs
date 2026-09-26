// Arrivals (v0.30.x arrivals): no portal sets you down on another portal, and no boss arena keeps you in.
//   node scripts/arrivals_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Every walk goes through the real tryPortal(): the hero is stood on the door, "Up" is tryPortal(), a boss-arena confirm is
// accepted by clicking its first button, and the arrival is read after the hero has landed.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11332';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof tryPortal === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 100;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true, tutorial_intro: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    // wait on the game's own frame counter, with a wall-clock guard (headless runs ~11-17 fps on a loaded machine)
    window.__frames = async (n) => { const t0 = game.time, w0 = performance.now(); while (game.time - t0 < n && performance.now() - w0 < 40000) await sleep(40); };
    const doorY = (po) => (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x);
    const inTrigger = () => (game.portals || []).filter((po) => Math.abs(player.x + player.w / 2 - po.x) < 50 && Math.abs(player.y + player.h - doorY(po)) < 100).map((po) => po.dest + '@' + po.x);
    const unblock = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; };
    // walk: load src, stand on the first door matching pick, press "Up", accept an arena confirm, land, read the arrival
    window.__walk = async (src, pick, prep) => {
      unblock(); loadMap(src); await __frames(12); player.invulnerable = 999999; game.monsters.length = 0; if (prep) prep();
      const po = (game.portals || []).find(pick);
      if (!po) return { err: 'no door', src, doors: (game.portals || []).map((q) => q.dest) };
      player.x = po.x - player.w / 2; player.y = doorY(po) - player.h; player.vx = 0; player.vy = 0;
      const went = tryPortal();
      if (game.currentMap === src) { const b = document.querySelector('#dialog-options button'); const d = document.getElementById('dialog'); if (b && d && getComputedStyle(d).display !== 'none') b.click(); }
      await __frames(45); game.monsters.length = 0;
      const out = { went, map: game.currentMap, x: Math.round(player.x), cx: Math.round(player.x + player.w / 2), hits: inTrigger(), ground: !!player.onGround };
      return out;
    };
    // "Up" where the hero landed: does it take a door?
    window.__up = async () => { const m0 = game.currentMap; const r = tryPortal(); await __frames(4); const out = { took: !!r, map: game.currentMap, stayed: game.currentMap === m0 }; unblock(); return out; };
  });
  const walk = (src, dest, idx) => p.evaluate(([src, dest, idx]) => __walk(src, (q) => q.dest === dest), [src, dest, idx]);
  const up = () => p.evaluate(() => __up());

  // 1) the Void -> Everdawn Central (every new game, every respawn)
  const v = await walk('void', 'town'); const vu = await up();
  check(v.map === 'town' && v.ground && v.hits.length === 0 && vu.stayed && !vu.took, 'the Void -> Everdawn Central lands on the ground clear of every door, and Up there goes nowhere (was: The Bastion)', { v, vu });
  // 2) the Inner Dimension -> Everdawn Central
  const i = await walk('innerDimension', 'town'); const iu = await up();
  check(i.map === 'town' && i.ground && i.hits.length === 0 && iu.stayed, 'the Inner Dimension -> Everdawn Central lands clear of every door', { i, iu });
  // 3) the Clockwork Spire's abandon door -> Everdawn Central (the door is spawned by the Party Quest; stood up here as the game does)
  const sp = await p.evaluate(() => __walk('clockworkSpire', (q) => q.dest === 'town', () => { if (!game.portals.some((q) => q.dest === 'town')) game.portals.push({ x: 56, y: 4584, dest: 'town', name: 'Abandon climb', _pqSpireAbandon: true }); }));
  const su = await up();
  check(sp.map === 'town' && sp.ground && sp.hits.length === 0 && su.stayed, 'the Clockwork Spire -> Everdawn Central lands clear of every door', { sp, su });
  // 4) Interdimensional Ascension -> the Hall of Echoes
  const b = await walk('interdimensionalAscension', 'boss_rush'); const bu = await up();
  check(b.map === 'boss_rush' && b.ground && b.hits.length === 0 && bu.stayed, 'Interdimensional Ascension -> the Hall of Echoes lands clear of its exit, and Up there stays in the hall', { b, bu });
  // 5) a Lv 50 hero can walk out of the Singularity
  const g = await p.evaluate(async () => { player.level = 50; const r = await __walk('gravitosArena', (q) => q.dest === 'zodiacHall'); player.level = 100; return r; });
  check(g.map === 'zodiacHall', 'a Lv 50 hero in the Singularity can take its exit to the Zodiac Sanctum (was: "Sealed - return at Lv 70+")', g);
  // control: the Barnaby gate (a door INTO an arena) still holds
  const c = await p.evaluate(async () => { player.level = 30; const r = await __walk('sundered_forge', (q) => q.dest === 'confusedVigil'); player.level = 100; return r; });
  check(c.map === 'sundered_forge', 'the Lv 40 gate into Confused Vigil still holds at Lv 30', c);
  // paired doors land where they always did: beside the matching door, one trigger radius and a half-body away
  const pair = async (src, dest) => {
    const r = await walk(src, dest);
    const exp = await p.evaluate(([src, dest]) => { const b = (MAPS[dest].portals || []).filter((q) => q.dest === src && !q._retreat).sort((a, c) => a.x - c.x)[0]; const off = 50 + player.w / 2 + 6; const ww = MAPS[dest].worldWidth || 2000; return Math.round(Math.max(8, Math.min(ww - player.w - 8, b.x + (b.x < ww / 2 ? off : -off)))); }, [src, dest]);
    check(r.map === dest && Math.abs(r.x - exp) <= 2 && r.hits.length === 0, `${src} -> ${dest} still lands beside its paired door (x ${exp})`, { r, exp });
  };
  await pair('town', 'forest');
  await pair('forest', 'town');
  await pair('zodiacHall', 'interdimensionalAscension');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
