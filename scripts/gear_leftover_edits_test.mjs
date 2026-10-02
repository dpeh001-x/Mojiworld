#!/usr/bin/env node
// v0.30.1569 - LEFTOVER GEAR ALIGN EDITS NO LONGER HIDE NEWER GEAR ART (per user: "whittled stick on screen sprite is not updated").
// Gear Align (removed v0.30.932) saved its edits in the browser - art in localStorage.lx_eq_erase, placement in
// localStorage.lx_eq_attach_override - and both still WON over the committed data/gear_erase.js and gear_calibration.js.
// Nothing writes either now, so on the browser that once ran Gear Align every piece re-baked since kept its old look
// (the Whittled Stick's v0.30.1498 redesign, seven more drawings, 13 placement rows) while its icon showed the new one.
// This test plants such leftovers in a fresh browser:
//   ART       a leftover copy, and a leftover "cleared" null, lose to the baked art for all eight re-baked pieces
//   PLACE     a leftover placement loses to the baked row for the stick and the 13 rows re-baked since the last export
//   UNBAKED   a leftover edit for a piece the files do not cover still applies (nothing that was never baked vanishes)
//   IN GAME   a hero holding the stick, with a magenta leftover copy planted, holds the baked redesign: no magenta drawn
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/gear_leftover_edits_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11803);
const ART = ['wpn:whittled_stick', 'arm:dawnshard_aegis', 'arm:skyhunter_vest', 'arm:stormcaller_cloak', 'arm:thunderbow_mantle',
  'arm:worldbreaker_bulwark', 'wpn:cosmic_wand', 'wpn:skyhunter_longbow'];   // re-baked after the last Gear Align export (v0.30.248)
const PLACE = ['wpn:whittled_stick', 'wpn:oblivion_whisper', 'wpn:skyhunter_longbow', 'wpn:spectre_fangs', 'wpn:stormcaller_bow',
  'arm:apocalypse_wargear', 'arm:apprentice_robe', 'arm:cataclysm_carapace', 'arm:chain_mail', 'arm:cloth_tunic', 'arm:hunters_tunic',
  'arm:stormcaller_cloak', 'arm:tempest_hauberk', 'arm:worldbreaker_bulwark'];   // the stick + the 13 rows re-baked after v0.29.416
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(([art, place]) => { try {
  localStorage.mojiworld_prologue_seen = '1';
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(4, 4, 56, 56);
  const mag = c.toDataURL('image/png'), E = { 'wpn:zz_unbaked_probe': mag };
  for (const k of art) E[k] = (k === 'arm:dawnshard_aegis') ? null : mag;   // one leftover "cleared" null, the rest leftover copies
  const A = { 'wpn:zz_unbaked_probe': { scale: 1.7, dx: 5 } }; for (const k of place) A[k] = { scale: 2.5, dx: 40, dy: -30, rot: 1.2 };
  localStorage.lx_eq_erase = JSON.stringify(E); localStorage.lx_eq_attach_override = JSON.stringify(A);
} catch (e) {} }, [ART, PLACE]);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const R = await page.evaluate(async ([art, place]) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {};
    const B = window.LX_EQ_ERASE_DATA || {}, live = JSON.parse(localStorage.lx_eq_erase);
    out.planted = art.filter((k) => Object.prototype.hasOwnProperty.call(_lxEqEraseMap(), k)).length;
    out.artWrong = art.filter((k) => !B[k] || _lxEqEraseData(k) !== B[k]);
    out.unbakedArt = _lxEqEraseData('wpn:zz_unbaked_probe') === live['wpn:zz_unbaked_probe'];
    out.placeWrong = place.filter((k) => !LX_EQ_ATTACH[k] || JSON.stringify(_lxEqAttach(k)) !== JSON.stringify(LX_EQ_ATTACH[k]));
    const u = _lxEqAttach('wpn:zz_unbaked_probe'); out.unbakedPlace = u.scale === 1.7 && u.dx === 5;
    // in game: the starter stick in hand
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 5; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; player.dawnAuraOff = true;
    const base = ITEM_POOL.weapons.find((w) => w.name === 'Whittled Stick');
    player.equipped.weapon = { ...base, baseName: base.name, stars: 0, slot: 'weapon' }; player._equipBonusCache = null;
    loadMap('forest', 420); await sleep(1500); game.paused = false;
    const tm = document.getElementById('tutorial-modal'); if (tm) tm.style.display = 'none';
    for (let i = 0; i < 40 && !_lxEqErasedImg('wpn:whittled_stick'); i++) await sleep(100);
    game.monsters.length = 0; await sleep(700);
    const im = _lxEqErasedImg('wpn:whittled_stick'); out.held = !im ? 'file' : im._src === B['wpn:whittled_stick'] ? 'baked' : 'leftover';
    const cv = document.getElementById('game'), k = cv.width / (typeof W !== 'undefined' ? W : 960), cam = game.camera || { x: 0, y: 0 };
    const hx = (player.x + player.w / 2 - cam.x) * k, hy = (player.y + player.h / 2 - (cam.y || 0)) * k, s = Math.round(160 * k);
    const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'); g.drawImage(cv, hx - s / 2, hy - s / 2, s, s, 0, 0, 160, 160);
    const d = g.getImageData(0, 0, 160, 160).data; let mag = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 70 && d[i + 2] > 200) mag++;
    out.magenta = mag; out.drewHero = d.some((v, i) => i % 4 === 3 && v > 0);
    return out;
  }, [ART, PLACE]);
  ok('setup: the leftover edits are planted in the browser', R.planted === ART.length, R.planted);
  ok('ART: the eight re-baked pieces show their baked art over leftover copies and a leftover "cleared"', R.artWrong.length === 0, R.artWrong.join(', ') || 'all baked');
  ok('PLACE: the stick and the 13 re-baked rows keep their baked placement over leftover overrides', R.placeWrong.length === 0, R.placeWrong.join(', ') || 'all baked');
  ok('UNBAKED: a leftover art edit still shows for a piece the files do not cover', R.unbakedArt === true);
  ok('UNBAKED: a leftover placement still applies to a piece the files do not cover', R.unbakedPlace === true);
  ok('IN GAME: the hero holds the baked Whittled Stick redesign', R.held === 'baked', R.held);
  ok('IN GAME: no magenta from the leftover copy is drawn at the hero', R.drewHero && R.magenta === 0, 'magenta px ' + R.magenta);
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
