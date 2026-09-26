// A menu must not run out the clocks the pause-shift block cannot see: "last used at" stamps read as
// `game.time - X > N`, and deadlines nested inside objects.
// Per the 2026-09-26 full audit. loop()'s pause block pushes forward only FUTURE values it knows by name; these were
// either past timestamps (King Krook's / Mooma's / King Gloopaloo's / Taur's special cooldowns and the shared boss
// special clock - a long menu handed the boss a forced special on unpause; Capricorn's Altitude Pressure armed early)
// or nested deadlines (the Master milestone windows and marks, Aetherion's cooldowns and his tick clock, Blood Ritual,
// Shroud, the Sky mark, the mirror decoy, the Clockwork Express brake).
// Each value is written relative to game.time, the pause card is held for 600 steps, and every distance must survive;
// an UNPAUSED control of the same length must drain (the clock itself still runs).
//   node scripts/pause_since_stamps_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html', PORT = String(process.argv[3] || 9987);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxPauseOpen === 'function' && document.getElementById('hero-name-input'), null, { timeout: 180000 });
await page.waitForTimeout(6000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Clock').catch(() => {});
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); if (!m) return; for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._tutorialSeen = true; player.level = 60; player._god = true; player.invulnerable = 9e9;
  try { closeAllModals(); } catch (e) {}
  loadMap('forest', 300); game.paused = false; await sleep(1500);
  // a monster held in place (AI parked) to carry the monster-side fields; the pause block walks game.monsters
  game.monsters.length = 0;
  const m = spawnMonster(player.x + 500, player.y - 40, 'slime', false);
  const hold = setInterval(() => { if (m) { m.x = player.x + 500; m.vx = 0; m.patternState = 'idle'; } }, 16);
  const SINCE = ['_lastSpecialAt', '_lastStompAt', '_lastMegaAt', '_lastFirebombAt', '_lastShellAt', '_lastSummonAt', '_lastQuakeAt', '_lastShakeAt', '_lastPlantAt', '_capArenaStart'];
  const stamp = () => {
    const t = game.time | 0;
    for (const f of SINCE) m[f] = t - 30;                       // "last used 30 steps ago"
    m._ae = { cd: { echo: t + 300, skybreak: t + 300, astral: t + 300, heal: t + 300 }, lastTick: t - 1 };
    m._msMarkUntil = t + 300; m._shroudUntil = t + 300; m._skyMarkUntil = t + 300;
    player._msWin = { id: 'warlord_ult', until: t + 300, lifesteal: 0.1 };
    player._bloodRitualUntil = t + 300;
    game._mirrorDecoy = { x: player.x, y: player.y, w: 30, h: 50, until: t + 300 };
    game._carriage = Object.assign(game._carriage || {}, { lurchAt: t + 300, lurchWarned: false });
  };
  const read = () => {
    const t = game.time | 0, o = {};
    for (const f of SINCE) o[f] = t - m[f];                     // elapsed since
    o.aeAstral = m._ae.cd.astral - t; o.aeEcho = m._ae.cd.echo - t; o.aeTickGap = t - m._ae.lastTick;
    o.msMark = m._msMarkUntil - t; o.shroud = m._shroudUntil - t; o.skyMark = m._skyMarkUntil - t;
    o.msWin = player._msWin ? player._msWin.until - t : null; o.bloodRitual = player._bloodRitualUntil - t;
    o.decoy = game._mirrorDecoy ? game._mirrorDecoy.until - t : null; o.lurch = game._carriage ? game._carriage.lurchAt - t : null;
    return o;
  };
  const steps = async (n) => { const t0 = game.time | 0; const w0 = performance.now(); while (((game.time | 0) - t0) < n && performance.now() - w0 < 90000) await sleep(16); return (game.time | 0) - t0; };
  // PAUSED: the real pause card (a registered pause owner, so the watchdog leaves it alone)
  stamp(); const before = read();
  _lxPauseOpen(); const heldSteps = await steps(600);
  const paused = read();            // read while still paused: nothing has run since
  try { _lxPauseClose(); } catch (e) {} game.paused = false;
  // CONTROL: the same length unpaused - the clock must drain these (read the same way)
  stamp(); const cBefore = read(); const ranSteps = await steps(600); const control = read();
  clearInterval(hold);
  return { before, paused, heldSteps, cBefore, control, ranSteps, stillPausedCard: !!document.getElementById('lx-pause') };
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
const drift = (k) => Math.abs((R.paused[k] ?? 1e9) - (R.before[k] ?? 0));
const drained = (k) => (R.control[k] === null ? 1e9 : Math.abs((R.control[k] ?? 0) - (R.cBefore[k] ?? 0)));   // gone = the game consumed it (the decoy and the brake are cleared once they expire)
console.log(`paused ${R.heldSteps} steps behind the pause card; control ran ${R.ranSteps} steps`);
ok(R.heldSteps >= 590 && R.ranSteps >= 590, 'the clock ran both windows (game.time counts while paused)', { held: R.heldSteps, ran: R.ranSteps });
const SINCE = ['_lastSpecialAt', '_lastStompAt', '_lastMegaAt', '_lastFirebombAt', '_lastShellAt', '_lastSummonAt', '_lastQuakeAt', '_lastShakeAt', '_lastPlantAt', '_capArenaStart'];
const badSince = SINCE.filter((k) => drift(k) > 3);
ok(badSince.length === 0, 'BOSS COOLDOWN STAMPS: "last used" does not age behind a menu (Krook, Mooma, King Gloopaloo, Taur, the special clock, Capricorn)', badSince.map((k) => k + ' +' + drift(k)));
const NEST = ['aeAstral', 'aeEcho', 'aeTickGap', 'msMark', 'shroud', 'skyMark', 'msWin', 'bloodRitual', 'decoy', 'lurch'];
const badNest = NEST.filter((k) => drift(k) > 3);
ok(badNest.length === 0, 'NESTED DEADLINES keep their distance (Aetherion cd + tick clock, Master windows and marks, Blood Ritual, Shroud, Sky mark, decoy, Express brake)', badNest.map((k) => k + ' ' + (R.paused[k] - R.before[k])));
const notDrained = SINCE.concat(NEST).filter((k) => drained(k) < 500);
ok(notDrained.length === 0, 'CONTROL: unpaused, every one of them drains with the clock', notDrained);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
