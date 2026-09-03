// REGULUS (and every zodiac boss): SPENT for 8s after HEAVENSPLIT.
// ============================================================================
// Per user: "regulus does too much damage, he does his insane 1 hp attack and
// then does not give space for player to recover with his big aoe, give at
// least 8 seconds of cooldown, before building up aggression to the player".
//
// HEAVENSPLIT is the zodiac desperation move (1.5s warning, then HP -> 1).
// Before, only the NEXT desperation had a cooldown; the sign's attack pattern,
// Leo's pounce and the lunge carried straight on. Now the boss is SPENT for
// 8s: no sign AI, no gait, no lunge, it backs away, says so, and its pattern
// clock restarts from zero when the window ends.
// Run: node scripts/regulus_spent_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9887);
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const SERVE_JS = existsSync(path.join(SERVE_ROOT, 'serve.js')) ? path.join(SERVE_ROOT, 'serve.js') : path.join(ROOT, 'serve.js');
const server = spawn(process.execPath, [SERVE_JS, String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'Spent').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 160) }; } };

const r = await ev(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = true;                                   // the test steps the sim by hand
  player.level = 90; player._god = false; player.maxHp = 500000; player.hp = getMaxHp(); player.invulnerable = 0; player.blockTimer = 0; player.stunTimer = 0; player.frozenTimer = 0;
  const toasts = []; const _st = window.showToast; window.showToast = (t, k) => { toasts.push(String(t)); };
  const step = (n, f) => { for (let i = 0; i < n; i++) { game.time++; try { updateMonsters(16); } catch (e) {} if (f) f(); } };
  game.monsters = []; game.hazards.length = 0; game.projectiles.length = 0;
  spawnMonster(player.x + 520, player.y, 'zodiac_leo', true);
  const m = game.monsters[game.monsters.length - 1];
  m._bossIntroDone = true; step(120); m.invulnerable = 0;
  m.currentHp = Math.floor(m.maxHp * 0.45);               // phase 2: the desperation is live
  step(30);
  const despLive = m._despCD != null;
  // force HEAVENSPLIT: cooldown to zero, pin the roll to the 1-HP move (retry —
  // the boss's own state machine can eat a tick)
  const rnd = Math.random; Math.random = () => 0.1;
  let warned = false, tries = 0, despDbg = '';
  for (; tries < 8 && !warned; tries++) {
    m._despState = null; m._despTimer = 0; m._despCD = 0; m.currentHp = Math.floor(m.maxHp * 0.45);
    step(2);
    warned = m._despState === 'warning' && m._despMove === 'hp1';
    despDbg = `state=${m._despState} move=${m._despMove} cd=${m._despCD | 0} phase=${m.phase} hp=${(m.currentHp / m.maxHp).toFixed(2)}`;
  }
  Math.random = rnd;
  player.x = m.x + 520; player.y = m.y; player.hp = getMaxHp(); player.invulnerable = 0;
  step(100);                                              // > 1.5s: it fires
  const hpAfter = player.hp; const spent = m._zSpentMs | 0; const spentToast = toasts.find((t) => /SPENT/.test(t)) || null;
  // the window: eight seconds of no aggression
  const d0 = Math.abs((m.x + m.w / 2) - (player.x + player.w / 2));
  let nonIdle = 0, enemyShots = 0, enemyHaz = 0, hpMin = player.hp, moved = 0;
  const p0 = game.projectiles.filter((p) => p && p.owner === 'enemy').length, h0 = game.hazards.length;
  const states = {}; const hazSeen = new Set(); const hazNew = [];
  game.hazards.forEach((h) => hazSeen.add(h));
  // measure exactly the window that is left (the fire landed some frames ago):
  // counting past its end would book the boss's legitimate return as a leak
  const winSteps = spent > 0 ? Math.max(1, Math.floor(spent / 16) - 3) : 480;   // no window at all (the old build): measure the full 8s
  step(winSteps, () => {
    if (m.patternState && m.patternState !== 'idle') { nonIdle++; states[m.patternState] = (states[m.patternState] || 0) + 1; }
    hpMin = Math.min(hpMin, player.hp);
    game.hazards.forEach((h) => { if (!hazSeen.has(h)) { hazSeen.add(h); hazNew.push((h.type || '?') + ':' + (h._sourceLabel || h.owner || '')); } });
  });
  const p1 = game.projectiles.filter((p) => p && p.owner === 'enemy').length, h1 = game.hazards.length;
  enemyShots = Math.max(0, p1 - p0); enemyHaz = Math.max(0, h1 - h0);
  const d1 = Math.abs((m.x + m.w / 2) - (player.x + player.w / 2)); moved = d1 - d0;
  step(60);                                               // the boss's own clock runs a hair under 16ms/step: let the window close
  const spentAfter = m._zSpentMs | 0; const recoverToast = toasts.find((t) => /pride again/.test(t)) || null;
  // after it: aggression comes back within ten seconds
  let resumed = false; const p2 = game.projectiles.filter((p) => p && p.owner === 'enemy').length;
  step(600, () => { if ((m.patternState && m.patternState !== 'idle') || game.projectiles.filter((p) => p && p.owner === 'enemy').length > p2 || Math.abs(m.vx) > 3) resumed = true; });
  window.showToast = _st; game.monsters = []; game.hazards.length = 0; game.projectiles.length = 0; game.paused = false;
  return { sign: m.zodiacSign, despLive, warned, tries, despDbg, hpAfter, spent, spentToast, nonIdle, states, hazNew, enemyShots, enemyHaz, hpMin, moved: Math.round(moved), spentAfter, recoverToast, resumed };
});
ok('Regulus spawns, reaches phase 2 and winds up HEAVENSPLIT', !r.err && r.sign === 'leo' && r.despLive && r.warned, r.err || JSON.stringify({ sign: r.sign, desp: r.despLive, warned: r.warned, tries: r.tries, dbg: r.despDbg }));
ok('HEAVENSPLIT lands: the player is left at 1 HP', !r.err && r.hpAfter === 1, r.err || `hp ${r.hpAfter}`);
ok('...and Regulus is SPENT for 8s, and says so', !r.err && r.spent >= 7000 && /SPENT/.test(r.spentToast || ''), r.err || `spent ${r.spent}ms; toast ${r.spentToast}`);
ok('for the next 8s he starts no attack: no pattern, no enemy shots, no hazards', !r.err && r.nonIdle === 0 && r.enemyShots === 0 && r.enemyHaz === 0, r.err || `non-idle frames ${r.nonIdle} ${JSON.stringify(r.states)}, shots ${r.enemyShots}, hazards ${r.enemyHaz} ${JSON.stringify(r.hazNew)}`);
ok('the player takes no further damage in the window (still 1 HP, alive)', !r.err && r.hpMin >= 1, r.err || `min hp ${r.hpMin}`);
ok('he backs away instead of closing in', !r.err && r.moved > 20, r.err || `distance change ${r.moved}px`);
ok('the window ends on time and he announces the return', !r.err && r.spentAfter === 0 && /pride again/.test(r.recoverToast || ''), r.err || `spent left ${r.spentAfter}; toast ${r.recoverToast}`);
ok('aggression rebuilds afterwards (an attack within ten seconds)', !r.err && r.resumed, r.err || `resumed ${r.resumed}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
