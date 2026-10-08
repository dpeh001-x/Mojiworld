// AETHERION'S SANCTUM OPENS FROM THE LAST STEP (per user: "on defeating mira, the portal to aetherion's sanctum should appear and open
// from the last step map, with level gate of 50. Aetherion sanctum portal from the celestial spire should be removed", then "reposition in
// the W world map as well"). Pins, in the running game (after the Stage Editor bake, which replaces both maps' doors):
//   the Celestial Spire has no door to the Sanctum; the Sanctum's way back leads to the Last Step;
//   before she falls the Last Step has no Sanctum door and the Sanctum's lane stays off the W map (_retreat);
//   her kill opens '▶ Aetherion's Sanctum' (levelGate 50) with its toast once her film hands the screen back, and the lane shows; a save with her fall gets the door on
//   the next loadMap; walking through it lands in the Sanctum; the Sanctum's pin sits beside the Last Step (569, 723).
//   node scripts/sanctum_door_test.mjs            (MOJI_SERVE_ROOT / PORT override)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10471);
let pass = 0, fail = 0; const ok = (m, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 400) : '')); c ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { cwd: ROOT, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.clock.install();
  await page.goto('http://localhost:' + PORT + '/mojiworld_game.html', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof MAPS === 'object' && MAPS.lastStep && MAPS.sanctum, null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const A = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player.cls = 'warrior'; player.level = 55; player._god = true; player._tutorialSeen = true; player._gravitosCineSeen = true; game.paused = false;
    game.bossDefeated = {}; if (game.bestiary) delete game.bestiary._boss_miraFallen;
    loadMap('lastStep', 300); await sleep(5000);
    const doors = (id) => (MAPS[id].portals || []).map((p) => ({ dest: p.dest, gate: p.levelGate || 0, ret: !!p._retreat }));
    return { spire: doors('celestialSpire'), sanctum: doors('sanctum'), last: doors('lastStep'), pin: [MAPS.sanctum.wmX, MAPS.sanctum.wmY], lastPin: [MAPS.lastStep.wmX, MAPS.lastStep.wmY] };
  });
  ok('the Celestial Spire has no door to the Sanctum', !A.spire.some((d) => d.dest === 'sanctum'), A.spire);
  ok("the Sanctum's way back leads to the Last Step (none to the Spire)", A.sanctum.some((d) => d.dest === 'lastStep') && !A.sanctum.some((d) => d.dest === 'celestialSpire'), A.sanctum);
  ok('before she falls the Last Step has no Sanctum door, and the Sanctum lane stays off the W map', !A.last.some((d) => d.dest === 'sanctum') && A.sanctum.filter((d) => d.dest === 'lastStep').every((d) => d.ret), { last: A.last, sanctum: A.sanctum });
  ok("the Sanctum's pin sits beside the Last Step (569, 723)", A.pin[0] === 569 && A.pin[1] === 723 && Math.hypot(A.pin[0] - A.lastPin[0], A.pin[1] - A.lastPin[1]) <= 100, { pin: A.pin, last: A.lastPin });
  const now0 = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now0 + 1000);
  const step = async (n) => { for (let i = 0; i < n; i++) { await page.clock.runFor(16); await page.evaluate(() => { player.hp = getMaxHp(); player.invulnerable = 0; }); } };
  // her fall
  await page.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = function (t) { window.__toasts.push(String(t || '')); return o.apply(this, arguments); };
    if (player._storyBeatsSeen) delete player._storyBeatsSeen.mira_aetherion;   // her film (v0.30.1642) plays on this fall
    const m = (game.monsters || []).find((q) => q.type === 'miraFallen'); m.traits = Object.assign({}, m.traits, { revivesOnce: null }); m._revived = true; m.currentHp = 0;
    (typeof killMonster === 'function' ? killMonster : _killMonsterRaw)(m); });
  await step(200);   // the kill, the film's 1.5 s, the door's 2.2 s
  const FM = await page.evaluate(() => ({ film: !!document.getElementById('kill-film-overlay'), door: (MAPS.lastStep.portals || []).filter((p) => p.dest === 'sanctum').length,
    toast: (window.__toasts || []).some((t) => /Sanctum is open/.test(t)) }));
  ok('her film plays first, and the door waits for it (no door, no toast while it holds the screen)', FM.film && FM.door === 0 && !FM.toast, FM);
  await page.evaluate(() => { const o = document.getElementById('kill-film-overlay'); if (o) o.click(); });   // skip it, as a player can
  await step(120);
  const B = await page.evaluate(() => { const d = (MAPS.lastStep.portals || []).filter((p) => p.dest === 'sanctum'); return { n: d.length, gate: d[0] && d[0].levelGate, x: d[0] && d[0].x, name: d[0] && d[0].name,
    beaten: !!(game.bossDefeated && game.bossDefeated.lastStep), toast: (window.__toasts || []).some((t) => /Sanctum is open/.test(t)), ret: (MAPS.sanctum.portals || []).filter((p) => p.dest === 'lastStep').map((p) => !!p._retreat) }; });
  ok("her fall opens one '▶ Aetherion's Sanctum' door on the Last Step, levelGate 50, with its toast", B.n === 1 && B.gate === 50 && /Aetherion/.test(B.name || '') && B.beaten && B.toast, B);
  ok('once she has fallen the Sanctum lane shows on the W map', B.ret.length > 0 && B.ret.every((r) => !r), B.ret);
  // a save with her fall: the door comes back on the next loadMap
  await page.evaluate(() => { MAPS.lastStep.portals = MAPS.lastStep.portals.filter((p) => p.dest !== 'sanctum'); game.bossDefeated.lastStep = true; loadMap('lastStep', 300); });   // the clock is paused: no in-page sleep
  await step(30);
  const C = await page.evaluate(() => ({ maps: (MAPS.lastStep.portals || []).filter((p) => p.dest === 'sanctum').length, live: (game.portals || []).filter((p) => p.dest === 'sanctum').length }));
  ok('a save that holds her fall gets the door back on the next loadMap', C.maps === 1 && C.live === 1, C);
  // through it
  await step(120);
  const D = await page.evaluate(() => {
    const d = (game.portals || []).find((p) => p.dest === 'sanctum'); if (!d) return { err: 'no door in the live map' };
    player.x = d.x - player.w / 2; player.y = ((typeof _defaultPortalY === 'function') ? _defaultPortalY(d.x) : 540) - player.h; player.vx = 0; player.vy = 0;
    const r = tryPortal(); return { r, map: game.currentMap }; });
  // a boss arena asks first ('Boss Arena Ahead'): step in
  const P = await page.evaluate(() => { const b = [...document.querySelectorAll('button, .dlg-opt, [role=button], a')].find((e) => /Enter the arena/i.test(e.textContent || ''));
    if (b) { b.click(); return 'clicked'; } const d = document.getElementById('dialog'); return 'no button; dialog: ' + (d ? (d.innerText || '').slice(0, 200) : 'none'); });
  await step(60);
  const E = await page.evaluate(() => game.currentMap);
  ok('walking through it lands in Aetherion\'s Sanctum', E === 'sanctum', { D, P, now: E });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
