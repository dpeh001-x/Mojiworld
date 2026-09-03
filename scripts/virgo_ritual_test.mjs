// VIRGO: the Banishment ritual is breakable, and heals only what she lost.
// ============================================================================
// Per user: "virgo is taking damage but hp is always at 100%".
//
// Her ritual ("Virgo channels Banishment!") used to be uninterruptible and to
// heal a flat 2.5% of max HP every few seconds — on a zodiac HP pool that is
// ~125 of the player's hits, so the bar never left 100%. Now: three hits (or
// 0.5% of her HP) inside the 1.1s window BREAK the ritual (no heal, no
// banish), and a ritual that resolves heals at most HALF of what she lost
// since the previous one, still capped at 2.5%.
// Run: node scripts/virgo_ritual_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9873);
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
await page.fill('#hero-name-input', 'VirgoTest').catch(() => {});
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

// The ritual is driven from Virgo's pattern fn each sim frame. Step the sim by
// hand (game.time++ / updateMonsters) like the other boss tests so the timing
// is deterministic, and stub the toast to read what she announces.
const r = await ev(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = false; player.level = 90; player._god = true; player.maxHp = 500000; player.hp = getMaxHp();
  const toasts = []; const _st = window.showToast; window.showToast = (t, k) => { toasts.push(String(t)); try { _st(t, k); } catch (e) {} };
  const step = (n) => { for (let i = 0; i < n; i++) { game.time++; try { updateMonsters(16); } catch (e) {} } };
  // a fresh boss sits behind a spawn shield for a moment and hitMonster runs the
  // real damage formula, so: wait the shield out, strip the stagger/opening
  // multipliers, and read every "loss" as an HP delta rather than the input.
  const spawnV = () => { game.monsters = []; game.hazards.length = 0; game.projectiles.length = 0;
    spawnMonster(player.x + 320, player.y, 'zodiac_virgo', true); const m = game.monsters[game.monsters.length - 1];
    m._bossIntroDone = true; step(120); m.invulnerable = 0; m._stagger = 0; m._dirOpenT = 0; m._shroudUntil = 0; m.currentHp = m.maxHp; m._virgoTaken = 0; return m; };
  const waitChannel = (m, max) => { for (let i = 0; i < max && !(m._virgoChannel > 0); i++) { m.patternTimer = 99999; step(1); } if (m._virgoChannel > 0) step(1); return m._virgoChannel > 0; };   // one more tick: the channel DR flag is raised on the tick AFTER the channel opens
  const BIG = (m) => Math.floor(m.maxHp * 0.12);                          // lands as roughly 2% after the formula
  // she evades (eva 1.35) outside her ritual, so hit until one LANDS; returns the HP it took
  const land = (m, input) => { for (let i = 0; i < 30; i++) { m._dirGuardT = 0; m._dirGhostT = 0; m.invulnerable = 0; const b = m.currentHp; hitMonster(m, input, false, 'test'); if (m.currentHp < b) return b - m.currentHp; step(1); } return 0; };
  // ---- 1. a ritual left alone heals at most HALF of what she lost since the last one
  const m1 = spawnV();
  const hp0 = m1.currentHp; const chunk = BIG(m1);
  const hitOk = typeof hitMonster === 'function';
  land(m1, chunk);
  const afterHit = m1.currentHp; const taken = m1._virgoTaken || 0;
  const started1 = waitChannel(m1, 400);
  toasts.length = 0; step(80);                                            // > 1.1s of sim: ritual resolves untouched
  const healed = m1.currentHp - afterHit; const lastHeal = m1._virgoLastHeal;
  // ---- 2. three hits inside the window BREAK the ritual: no heal, no banish
  const m2 = spawnV();
  land(m2, BIG(m2));
  const hp2 = m2.currentHp;
  const started2 = waitChannel(m2, 400);
  game.projectiles.push({ owner: 'player', x: player.x, y: player.y, w: 4, h: 4, life: 999, _test: true });
  toasts.length = 0;
  for (let i = 0; i < 3; i++) { land(m2, Math.floor(m2.maxHp * 0.01)); step(2); }   // three quick landing hits mid-ritual
  const brokeAt = m2._virgoChannel; const brokenFlag = m2._virgoBroken | 0; const chan2 = !!m2._virgoChanneling;
  const hp2broken = m2.currentHp;
  step(80);
  const hp2after = m2.currentHp; const shotsKept = game.projectiles.some((p) => p && p._test);
  const brokeToast = toasts.find((t) => /BROKEN/.test(t)) || null; const banishToast = toasts.find((t) => /banishes/.test(t)) || null;
  // ---- 3. after a broken ritual she tries again, and what she lost meanwhile still counts
  const started3 = waitChannel(m2, 600);
  const takenBefore3 = m2._virgoTaken || 0; const hpBefore3 = m2.currentHp;
  step(80);
  const healed3 = m2.currentHp - hpBefore3;
  window.showToast = _st;
  return { hitOk, maxHp: m1.maxHp, hp0, afterHit, taken, chunk, started1, healed, lastHeal, started2, hp2, brokeAt, brokenFlag, chan2, hp2broken, hp2after, shotsKept, brokeToast, banishToast, started3, takenBefore3, healed3, sign: m1.zodiacSign };
});
ok('Virgo spawns and her ritual starts on the pattern clock', !r.err && r.sign === 'virgo' && r.started1 && r.started2, r.err || JSON.stringify({ sign: r.sign, s1: r.started1, s2: r.started2 }));
ok('damage through the hit path lands and is booked as "taken since her last ritual"', !r.err && r.hp0 - r.afterHit > 0 && r.taken > 0 && Math.abs(r.taken - (r.hp0 - r.afterHit)) <= 1, r.err || `taken ${r.taken} vs lost ${r.hp0 - r.afterHit}`);
ok('a ritual left alone heals HALF of what she lost (2% lost -> 1% healed), not a flat 2.5%', !r.err && r.healed > 0 && Math.abs(r.healed - Math.floor((r.hp0 - r.afterHit) * 0.5)) <= 2 && r.healed < r.maxHp * 0.02,
  r.err || `healed ${r.healed} of ${r.hp0 - r.afterHit} lost (max 2.5% = ${Math.floor(r.maxHp * 0.025)})`);
ok('so her HP visibly stays DOWN after the ritual (bar no longer pinned at 100%)', !r.err && r.afterHit + r.healed < r.hp0, r.err || `hp0 ${r.hp0} -> ${r.afterHit + r.healed}`);
ok('three hits inside the 1.1s window BREAK the ritual', !r.err && r.brokeAt === 0 && !r.chan2 && r.brokenFlag >= 1, r.err || `channel ${r.brokeAt} channeling ${r.chan2} broken ${r.brokenFlag}`);
ok('a broken ritual heals nothing and banishes nothing', !r.err && r.hp2after <= r.hp2broken && r.shotsKept && !r.banishToast, r.err || `hp at break ${r.hp2broken} -> after ${r.hp2after}; shots kept ${r.shotsKept}; banish ${r.banishToast}`);
ok('she announces the break', !r.err && /BROKEN/.test(r.brokeToast || ''), r.err || String(r.brokeToast));
ok('after a broken ritual she tries again, and the next uninterrupted one heals half of everything lost since', !r.err && r.started3 && r.takenBefore3 > 0 && Math.abs(r.healed3 - Math.min(Math.floor(r.maxHp * 0.025), Math.floor(r.takenBefore3 * 0.5))) <= 2,
  r.err || `retried ${r.started3}; lost since ${r.takenBefore3}; healed ${r.healed3}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
