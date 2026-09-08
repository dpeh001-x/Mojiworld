// v0.30.411 setshard economy test: repeat-kill ladder for a normal boss and a
// zodiac boss, twin exclusion (shards + sigil), Express respawn gate,
// flat 1500 respec cost (v0.30.431), prestige reset (static).
//   node scripts/setshard_economy_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11061);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: process.env.MOJI_PW_EXE ? undefined : 'msedge', executablePath: process.env.MOJI_PW_EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });   // v0.30.431 — MOJI_PW_EXE overrides the browser, like the other gear guards
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Econ');
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

const res = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 160) });
  window._prologueActive = false;
  player.level = 100; player._god = true;
  game._bossKills = {}; game.bossDefeated = {}; game._bossDefeatedAt = {};
  player.setshards = 0;

  // ---- normal-boss ladder (Krook in his throne) ----
  loadMap('krookThrone'); await wait(1200); game.paused = false;
  for (const q of game.monsters) q.currentHp = 0; game.monsters.length = 0;
  const killOnce = (type, prep) => {
    const b = spawnMonster(700, 300, type, true, false);
    if (!b || b._suppressed) return null;
    if (prep) prep(b);
    const before = player.setshards | 0;
    killMonster(b, 'melee');
    game.paused = false;
    return (player.setshards | 0) - before;
  };
  const kLv = (monsterTypes.kingKrook.level || 0);
  const kFull = Math.min(10000, kLv * kLv);
  // warm-up kill absorbs one-time bonuses (first-boss honors etc.), then the
  // ladder counter is reset so the measured series starts at "first kill".
  killOnce('kingKrook'); await wait(60);
  game._bossKills = {};
  const kd = [];
  for (let i = 0; i < 7; i++) { kd.push(killOnce('kingKrook')); await wait(60); }
  const expK = [1, 0.4, 0.2, 0.1, 0.05, 0.025, 0.02].map((f) => Math.max(1, Math.round(kFull * Math.max(0.02, f))));
  ok('krook ladder 100/40/20/10/5/2.5/2%', JSON.stringify(kd) === JSON.stringify(expK), `lv ${kLv} full ${kFull} got ${JSON.stringify(kd)} want ${JSON.stringify(expK)}`);
  ok('krook lifetime converges (7 kills < 1.85x first)', kd.reduce((a, b) => a + b, 0) < kFull * 1.85, kd.reduce((a, b) => a + b, 0) + ' vs ' + kFull);

  // ---- zodiac ladder + sigil, and twin exclusion ----
  const zPrep = (b) => { b.zodiacSign = 'gemini'; b.zodiacBoss = true; b.isZodiac = true; };
  const sigils = () => (player.inventory || []).filter((it) => it && it.zodiacSigil).length;
  const zLv = monsterTypes.zodiac_gemini.level || 74;
  const zFull = Math.min(10000, zLv * zLv);
  const s0 = sigils();
  const zd = [];
  for (let i = 0; i < 3; i++) { zd.push(killOnce('zodiac_gemini', zPrep)); await wait(60); }
  const expZ = [1, 0.5, 0.25].map((f) => Math.max(1, Math.round(zFull * f)));
  ok('gemini ladder 100/50/25%', JSON.stringify(zd) === JSON.stringify(expZ), `lv ${zLv} got ${JSON.stringify(zd)} want ${JSON.stringify(expZ)}`);
  ok('each real zodiac kill drops one sigil', sigils() - s0 === 3, (sigils() - s0) + ' sigils');
  const s1 = sigils();
  const kills1 = (game._bossKills['zodiac_gemini'] | 0);
  const td = killOnce('zodiac_gemini', (b) => { zPrep(b); b._isTwin = true; });
  ok('twin pays 0 shards', td === 0, td);
  ok('twin drops no sigil', sigils() === s1, sigils() - s1);
  ok('twin does not advance the ladder', (game._bossKills['zodiac_gemini'] | 0) === kills1, game._bossKills['zodiac_gemini']);
  const pd = killOnce('zodiac_gemini', (b) => { zPrep(b); b._isPiscesTwin = true; });
  ok('pisces-style twin pays 0 shards', pd === 0, pd);

  // ---- respec cost scaling ----
  const rc = [30, 50, 60, 80, 95, 100].map((l) => _lxRespecCost(l));
  ok('respec cost is a flat 1500 at every level (v0.30.431, per user; the v0.30.412 level curve is retired)', JSON.stringify(rc) === JSON.stringify([1500, 1500, 1500, 1500, 1500, 1500]), JSON.stringify(rc));

  // ---- Express respawn gate ----
  player._pqFinaleBossPending = true;
  game.bossDefeated.clockworkExpress = true;
  game._bossDefeatedAt.clockworkExpress = game._playMs || 0;
  loadMap('clockworkExpress'); await wait(900); game.paused = false;
  const cond1 = game.monsters.some((m) => m && m.type === 'pqConductor' && m.currentHp > 0);
  ok('conductor does NOT respawn inside the 10-min gate', !cond1 && player._pqFinaleBossPending === true, `spawned=${cond1} pending=${player._pqFinaleBossPending}`);
  loadMap('town'); await wait(500);
  game._bossDefeatedAt.clockworkExpress = (game._playMs || 0) - 11 * 60 * 1000;
  loadMap('clockworkExpress'); await wait(900); game.paused = false;
  const cond2 = game.monsters.some((m) => m && m.type === 'pqConductor' && m.currentHp > 0);
  ok('conductor respawns once the gate has passed', cond2 && player._pqFinaleBossPending === false, `spawned=${cond2} pending=${player._pqFinaleBossPending}`);
  return out;
});
await browser.close(); server.kill();

// static: prestige resets the ladder
const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
const prest = /game\.bossDefeated = \{\};[\s\S]{0,600}game\._bossKills = \{\};\s*game\._bossDefeatedAt = \{\};/.test(html);
res.push({ n: 'prestige resets _bossKills + _bossDefeatedAt (static)', pass: prest, extra: '' });

let fails = 0;
for (const r of res) { console.log((r.pass ? 'PASS ' : 'FAIL ') + r.n + (r.extra ? '  [' + r.extra + ']' : '')); if (!r.pass) fails++; }
console.log(`${res.length - fails}/${res.length} passed`);
process.exit(fails ? 1 : 0);
