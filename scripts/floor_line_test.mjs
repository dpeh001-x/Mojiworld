#!/usr/bin/env node
// v0.30.1610 floor line (per user: "the black outline should be exactly at the floor blackline"; "ensure most objects around the rest of
// mojiworld is grounded to the floor line"). For every feet-anchored prop on every map: drawWorldProps plants the art's lowest row on
// prop.y + sink, so the prop stands on the line when that row is the bottom row of the dark top line of the floor or ledge under it.
// Each map is drawn by hand with the game paused (render-only, as _lxDrawBetween does) at an exact camera - vertical maps included - with
// props, NPCs, portals and monsters hidden, and the surface's dark rows are read in the prop's own columns.
//  [1] every map with props loads and every surface line is found
//  [2] every prop stands on its line (|y + sink - line bottom| <= 1), except ALLOW below (hung, floating or deliberately sunk pieces)
//  [3] the ALLOW list is not stale: each entry still exists and is still off the line
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree. node scripts/floor_line_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10463); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
// map|key|x ('*' = every x) -> why it is not on a floor line
const ALLOW = {
  'bastion|bastion_banner|2064': 'a banner hung on the wall', 'bastionRampart|bastion_banner|856': 'a banner hung on the wall',
  'hiddenPagoda|shadow_banner_skull|656': 'a banner hung under the ledge', 'shadowWovenHood|shadow_banner_skull|540': 'a banner hung under the ledge',
  'emeraldVillage|emerald_watchtower_bell|226': 'the bell hangs under the hut eave',
  'emeraldVillage|emerald_cherry_branch|*': 'the user\'s floating sakura flowers (Prop Editor bake)', 'jadeGrove|emerald_cherry_branch|*': 'the user\'s floating sakura flowers',
  'fracturedReflection|rift_cracked_mirror|960': 'sink 3 on purpose (v0.30.1568: its far foot hung)', 'thunderPlateau|ice_crystal_cluster|420': 'planted in a snow cap that rises above the line',
  'bastion|bastion_anvil|2250': 'Barnaby\'s anvil, 4 px in: its row is pinned by the v0.30.1461 marker (left for the user)',
};
const allowOf = (r) => ALLOW[`${r.map}|${r.key}|${r.x}`] || ALLOW[`${r.map}|${r.key}|*`];
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAP_PROPS === 'object' && document.getElementById('lo-menu'), null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const maps = await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {} if (!player.cls) applyClass('warrior'); player.level = 60; player._god = true; player.invulnerable = 1e9; player._gravitosCineSeen = true;
    try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
    window._perfLowFx = () => false; window.drawPlayer = () => {}; window.updateAmbient = () => {}; game.paused = false;
    window.__draw = () => { const pp = game.particles, push0 = pp && pp.push; if (pp) pp.push = () => 0; _lxRenderOnly = true;
      try { ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; _lxDrawFrame(performance.now()); } finally { _lxRenderOnly = false; if (pp) pp.push = push0; } };
    return Object.keys(MAP_PROPS).filter((m) => MAPS[m] && (MAP_PROPS[m] || []).some((q) => q && q.key && (q.anchor || 'feet') !== 'hang')); });
  const rows = [];
  for (const map of maps) rows.push(...await page.evaluate(async (map) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = [];
    game.paused = false; try { loadMap(map, 200); } catch (e) { return [{ map, err: 'load ' + String(e).slice(0, 60) }]; } await sleep(1500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (game.currentMap !== map) return [{ map, err: 'landed on ' + game.currentMap }];
    game.paused = true; game.ambient.length = 0; try { if (Array.isArray(game.monsters)) game.monsters.length = 0; } catch (e) {}
    const md = game.mapData, all = MAP_PROPS[map], props = all.filter((q) => q && q.key && (q.anchor || 'feet') !== 'hang');
    for (const q of props) { const im = LX_OBJECTS[q.key]; for (let i = 0; i < 60 && im && !(im.complete && im.naturalWidth); i++) await sleep(100); }
    const keep = { npc: window.drawNPCs, por: window.drawPortals, mon: window.drawMonster };
    MAP_PROPS[map] = []; window.drawNPCs = () => {}; window.drawPortals = () => {}; window.drawMonster = () => {};
    const g = document.getElementById('game').getContext('2d', { willReadFrequently: true }), plats = md.platforms || [], ww = md.worldWidth || 1600, wh = Math.max(560, md.worldHeight || 560);
    try {
      for (const q of props) {
        const img = LX_OBJECTS[q.key]; let w = 40; if (img && img.naturalWidth) { const f = Math.max(0.7, Math.min(1.4, Math.max(img.naturalWidth, img.naturalHeight) / 512)); w = 80 * (q.scale || 1) * f * img.naturalWidth / img.naturalHeight; }
        const sup = plats.filter((s) => q.x >= s.x - 2 && q.x <= s.x + s.w + 2 && Math.abs(s.y - q.y) <= 40).sort((a, c) => Math.abs(a.y - q.y) - Math.abs(c.y - q.y))[0];
        const cx = Math.max(0, Math.min(ww - 960, Math.round(q.x - 480))), cy = Math.max(0, Math.min(wh - 560, Math.round(q.y - 400)));
        game.camera.x = cx; game.camera.y = cy; window.__draw(); const ref = sup ? sup.y : q.y, ty = Math.round(ref - cy), bots = [];
        for (const k of [-0.25, -0.12, 0, 0.12, 0.25]) { const sx = Math.round(q.x + k * w - cx); if (sx < 0 || sx >= 960) continue; const y0 = Math.max(0, ty - 16), n = Math.min(560 - y0, 34); if (n <= 0) continue;
          const d = g.getImageData(sx, y0, 1, n).data, runs = [];
          for (let i = 0; i < n; i++) if (d[i * 4 + 3] > 200 && 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2] < 75) { const y = y0 + i + cy, r = runs[runs.length - 1]; if (r && y === r[1] + 1) r[1] = y; else runs.push([y, y]); }
          const best = runs.sort((a, c) => Math.min(Math.abs(a[0] - ref), Math.abs(a[1] - ref)) - Math.min(Math.abs(c[0] - ref), Math.abs(c[1] - ref)))[0]; if (best) bots.push(best[1]); }
        const lb = bots.length ? bots.sort((a, c) => a - c)[bots.length >> 1] : null;
        out.push({ map, key: q.key, x: q.x, y: q.y, sink: q.sink || 0, sup: sup ? (sup.type || 'ledge') + '@' + sup.y : null, line: lb, delta: lb != null ? q.y + (q.sink || 0) - lb : null });
      }
    } finally { MAP_PROPS[map] = all; window.drawNPCs = keep.npc; window.drawPortals = keep.por; window.drawMonster = keep.mon; game.paused = false; }
    return out;
  }, map));
  const bad = rows.filter((r) => r.err), plain = rows.filter((r) => !r.err && !allowOf(r)), off = plain.filter((r) => r.delta == null || Math.abs(r.delta) > 1);
  console.log(`${maps.length} maps, ${rows.length} feet-anchored props, ${rows.length - plain.length - bad.length} on the ALLOW list`);
  ok('[1] every map with props loads, and every prop\'s surface line is found', !bad.length && plain.every((r) => r.line != null), bad.map((r) => r.map + ' ' + r.err).concat(plain.filter((r) => r.line == null).map((r) => `${r.map} ${r.key}@${r.x} no line`)).join('; '));
  ok('[2] every other prop stands on the floor\'s black line (its lowest art row within 1 px of the line\'s bottom row)', !off.length, off.map((r) => `${r.map} ${r.key}@${r.x} y ${r.y} on ${r.sup} line ${r.line} (${r.delta > 0 ? '+' : ''}${r.delta})`).join('; '));
  const stale = Object.keys(ALLOW).filter((k) => { const [m, key, x] = k.split('|'); const hit = rows.filter((r) => r.map === m && r.key === key && (x === '*' || String(r.x) === x)); return !hit.length || hit.every((r) => r.delta != null && Math.abs(r.delta) <= 1); });
  ok('[3] the ALLOW list is not stale (each entry is still there and still off the line)', !stale.length, stale.join('; '));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 400)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
