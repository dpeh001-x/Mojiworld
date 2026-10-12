// RELEASE 15d (round nine regression hunter) stays fixed:
//   [1] Expedition floors keep their Elder roll: loading tower_b8 never flags its towerOssifer entry as a rare elite
//       (real rare elites - count 1 spawnChance entries - still are)
//   [2] the Storm's Eye guard (maelstromGuard) and the Soul Vortex kill-heal (necromancer) end at a door; Guardian still survives it
//   [3] a skill key pressed in photo mode is not latched to cast on the first step after photo mode closes
//   [4] a co-op guest's Conqueror title and ending follow the host's petition rule (_lxGravitosEarned)
//   node scripts/release15d_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15161), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('mage');
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
  });
  const R = await page.evaluate(async () => {
    const steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    const clear = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; };
    const load = (id, x) => { game._worldStateByMap = game._worldStateByMap || {}; game._worldStateByMap[id] = null; clear(); loadMap(id, x || 300); game.paused = false; };
    const out = {};
    // [1] the rare-elite flag as each roster entry spawns
    const seen = {}; const _sm = spawnMonster;
    window.spawnMonster = function (x, y, type) { if (type) (seen[type] = seen[type] || []).push(!!game._lxRareSpawn); return _sm.apply(this, arguments); };
    try { load('tower_b8'); await steps(5); } catch (e) { out.e1 = String(e).slice(0, 120); }
    window.spawnMonster = _sm;
    out.b8 = { ossifer: (seen.towerOssifer || []).length, flagged: (seen.towerOssifer || []).filter(Boolean).length };
    const rare = []; for (const id of Object.keys(MAPS)) for (const s of (MAPS[id].spawns || [])) if (s && !s.boss && s.spawnChance != null && (s.count | 0) <= 1) rare.push(id + ':' + s.type);
    out.rareCount = rare.length;
    // [2] buffs across a door
    load('forest'); await steps(5);
    player.buffs = player.buffs || {}; player.buffs.maelstromGuard = 6000; player.buffs.necromancer = 20000; player.buffs.guardian = 9000;
    load('mushroom'); await steps(3);
    out.buffs = { maelstromGuard: player.buffs.maelstromGuard | 0, necromancer: player.buffs.necromancer | 0, guardian: player.buffs.guardian | 0 };
    // [4] the guest rule, read off the shipped source (the title grant and the ending both gate on _lxGravitosEarned)
    const src = await (await fetch(location.href.split('?')[0])).text();
    out.guest = { title: /if \(!player\.titles\[LX_TITLE_CONQUEROR\] && \(typeof _lxGravitosEarned/.test(src), ending: /_lxGravitosEarned\(\) : \(\(Q\.active/.test(src) };
    return out;
  });
  // [3] photo mode: a real key press while photo mode is up is not latched for the first step after it closes
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; window._lxKeyTaps = {}; togglePhotoMode(true); });
  await page.waitForTimeout(300);
  const key = await page.evaluate(() => { const ks = Object.keys(KEY_TO_SLOT).filter((k) => KEY_TO_SLOT[k] && KEY_TO_SLOT[k] !== 'd' && /^[a-z]$/.test(k)); return ks[0] || 'x'; });
  await page.keyboard.press(key);
  const P = await page.evaluate((k) => ({ key: k, latched: !!(window._lxKeyTaps && window._lxKeyTaps[k]), photo: !!game._photoMode }), key);
  await page.evaluate(() => { try { togglePhotoMode(false); } catch (e) {} });
  ok('[1] tower_b8 loads its Ossifers without the rare-elite flag (they keep the Elder roll); one-spawn rare elites exist to flag', R.b8.ossifer > 0 && R.b8.flagged === 0 && R.rareCount > 0, R.b8);
  ok('[2] the Storm\'s Eye guard and the Soul Vortex kill-heal end at a door; Guardian survives it', R.buffs.maelstromGuard === 0 && R.buffs.necromancer === 0 && R.buffs.guardian > 0, R.buffs);
  ok('[3] a skill key tapped in photo mode is not latched to cast when photo mode closes', P.photo && !P.latched, P);
  ok('[4] a guest\'s Conqueror title and ending follow _lxGravitosEarned', R.guest.title && R.guest.ending, R.guest);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
