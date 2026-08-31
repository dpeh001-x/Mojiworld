#!/usr/bin/env node
// Per user: "Massive lag when fighting bosses such as krook" (video, v0.30.316).
//
// REGRESSION TEST for the v0.30.321 King Krook TDZ fix. His attack-decision
// block read `_now` seven lines before `const _now` was declared, throwing a
// ReferenceError on every decision beat. The call site is try/FINALLY (no
// catch), so the throw escaped the whole monster update and was swallowed
// unlogged by the frame loop's catch. Two symptoms: every frame aborted
// mid-update once Krook idled past his gate (the user's "massive lag"), and
// nothing below the throw ever ran — no TYRANT'S STOMP, no megaFireball, no
// firebomb, no combo strings, on every build since v0.30.236.
//
// Asserts, after 12 s of live fight: ZERO throws escape bossAI, and Krook has
// actually picked an attack (left 'idle' or stamped a special cooldown).
// Against v0.30.319 this measures ~452 throws and a Krook pinned in 'idle'.
//
//   node scripts/krook_ai_alive_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9985);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Probe');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(async () => {
  player.level = 86; player._god = true;
  loadMap('krookThrone');
  await new Promise((r) => setTimeout(r, 1200));
  game.paused = false;
  if (!game.monsters.some((m) => m && m.type === 'kingKrook')) {
    try { spawnMonster(700, 300, 'kingKrook', true, false); } catch (e) {}
  }
  for (const m of game.monsters) { m.hp = m.maxHp = 9e9; m.currentHp = 9e9; m.aggro = true; m.aggroTarget = player; }
  const kk = game.monsters.find((m) => m && m.type === 'kingKrook');
  player.x = (kk ? kk.x - 120 : 600); player.y = 340;
});
await page.evaluate(() => {
  // Count throws ESCAPING bossAI — the frame loop's wrapper swallows them
  // upstream, so page-error listeners alone read 0 even while it storms.
  const orig = window.bossAI;
  window.__aiThrows = 0; window.__aiMsg = '';
  window.bossAI = function () {
    try { return orig.apply(this, arguments); }
    catch (e) { window.__aiThrows++; if (!window.__aiMsg) window.__aiMsg = String(e); throw e; }
  };
});
// SAMPLE CONTINUOUSLY, don't snapshot. A single end-of-run read is racy: the
// fixed boss cycles attack -> idle, and a snapshot that lands mid-idle after a
// basic attack (which stamps no special cooldown) read as "never attacked".
await page.evaluate(() => {
  window.__statesSeen = {};
  window.__stateTimer = setInterval(() => {
    const kk = game.monsters.find((m) => m && m.type === 'kingKrook');
    if (kk && kk.patternState) window.__statesSeen[kk.patternState] = 1;
  }, 200);
});
await page.waitForTimeout(12000);
const state = await page.evaluate(() => {
  clearInterval(window.__stateTimer);
  const kk = game.monsters.find((m) => m && m.type === 'kingKrook');
  return {
    statesSeen: Object.keys(window.__statesSeen).sort().join(','),
    stompAt: kk ? (kk._lastStompAt ?? null) : null,
    megaAt: kk ? (kk._lastMegaAt ?? null) : null,
    aiThrows: window.__aiThrows, aiMsg: window.__aiMsg,
  };
});
await browser.close(); server.kill();

const attacked = state.statesSeen.replace(/\bidle\b,?/, '').length > 0 || state.stompAt != null || state.megaAt != null;
const pass = state.aiThrows === 0 && attacked;
console.log('\n  ' + PAGE);
console.log('  Krook after 12s: ' + JSON.stringify(state));
console.log((state.aiThrows === 0 ? '  PASS  ' : '  FAIL  ') + 'zero throws escape bossAI' + (state.aiThrows ? '   [' + state.aiThrows + ' — ' + state.aiMsg + ']' : ''));
console.log((attacked ? '  PASS  ' : '  FAIL  ') + 'Krook actually picked an attack   [states seen: ' + state.statesSeen + ']');
process.exit(pass ? 0 : 1);
