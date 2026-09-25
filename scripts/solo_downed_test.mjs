// Live test: SOLO DOWNED — dying in solo plays the 30s downed beat with a "▸ Respawn now" button that fast-forwards to
// the normal (void) death flow. Never connects to multiplayer, so this certifies the pure-solo path.
//
// 2026-09-25 — staged past onboarding and self-serving. The test used to boot into the onboarding 'void' scene with no
// map loaded; _coopTryDowned reads _isOnboardingActive() there (the tutorial has not been seen), marks the down SILENT
// (player._downedSilent) and _coopDownedBanner never builds the banner - so the banner / countdown / Respawn checks had
// been red for a while regardless of the game. It now marks the tutorial and the Everdawn beats seen, loads town and
// waits for the hero to stand before the down, and asserts the down is not silent. It also starts its own serve.js
// (it used to expect one already on :8080): node scripts/solo_downed_test.mjs [port]; MOJI_GAME_FILE picks a candidate,
// SERVE_ROOT the directory to serve from (default: the repo root).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched; falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT;
const PORT = process.argv[2] || process.env.PORT || '11377';
const URL = `http://localhost:${PORT}/mojiworld_game.html`;
const srv = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _tryCheatDeathRevive === 'function' && typeof loadMap === 'function' && typeof _coopTryDowned === 'function', null, { timeout: 180000 });
  // stage past onboarding: beats seen, a class, town loaded, the hero standing (the onboarding void makes downs silent)
  const staged = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    for (let i = 0; i < 80 && !player.onGround; i++) await new Promise((r) => setTimeout(r, 50));
    return { map: game.currentMap, onGround: !!player.onGround, onboarding: (typeof _isOnboardingActive === 'function') ? _isOnboardingActive() : null, cls: player.cls };
  });
  ok('staged past onboarding: town loaded, hero standing, onboarding gate off', staged.map === 'town' && staged.onGround && staged.onboarding === false, staged);
  // pump the downed tick (headless rAF throttling)
  await page.evaluate(() => { window.__pump = setInterval(() => { try { if (player._downed) _coopDownedTick(80); } catch (e) {} }, 80); });

  // 1) SOLO death -> DOWNED (not instant death), with the solo banner + skip button.
  const down = await page.evaluate(() => {
    player._god = false; player.hp = 0;
    const saved = _tryCheatDeathRevive();
    return { saved, downed: !!player._downed, silent: !!player._downedSilent, revivable: !!player._downRevivable, hp: player.hp,
      dying: !!game.dying, connected: !!net.connected };
  });
  ok('solo death enters DOWNED (no partner needed), not the silent onboarding kind', down.saved === true && down.downed === true && !down.silent && down.hp === 1 && !down.dying, down);
  ok('never connected — pure solo path', down.connected === false, down);
  // banner is created by the first downed tick — give the pump a beat
  await sleep(400);
  const banner = await page.evaluate(() => {
    const b = document.getElementById('coop-downed-banner');
    const btn = document.getElementById('coop-downed-skip');
    return { banner: !!b, btn: btn ? btn.textContent : null, soloSubtitle: b ? /no one can reach you/.test(b.textContent) : false };
  });
  ok('solo banner variant + Respawn button', banner.banner && banner.btn === '▸ Respawn now' && banner.soloSubtitle && down.revivable === false, banner);

  // 2) Countdown ticks down.
  const s1 = await page.evaluate(() => (document.getElementById('coop-downed-secs') || {}).textContent);
  await sleep(2400);
  const s2 = await page.evaluate(() => (document.getElementById('coop-downed-secs') || {}).textContent);
  ok('countdown ticks (' + s1 + ' -> ' + s2 + ')', parseInt(s2) < parseInt(s1), { s1, s2 });

  // 3) Clicking "Respawn now" fast-forwards to the real death flow.
  await page.evaluate(() => document.getElementById('coop-downed-skip').click());
  await page.waitForFunction(() => !player._downed && (game.dying > 0 || player.hp <= 0), null, { timeout: 8000 }).catch(() => {});
  const dead = await page.evaluate(() => ({ downed: !!player._downed, dying: !!game.dying, banner: !!document.getElementById('coop-downed-banner') }));
  ok('Respawn button fast-forwards into the death flow', dead.downed === false && dead.dying === true, dead);
  ok('banner removed on skip', dead.banner === false, dead);

  // 4) The dying->respawn sequence is driven by the rAF loop (throttled in
  // headless), so drive the respawn directly to certify the flow lands cleanly.
  const after = await page.evaluate(() => { try { respawnAtTown(); } catch (e) {} return { hp: player.hp, downed: !!player._downed }; });
  ok('respawn lands cleanly after the skip (HP restored, not downed)', after.hp > 0 && after.downed === false, after);

  ok('no page errors', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); srv.kill(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== SOLO DOWNED + RESPAWN FAST-FORWARD ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
