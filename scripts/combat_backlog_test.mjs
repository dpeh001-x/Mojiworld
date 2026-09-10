// v0.30.x — Combat findings verified from the audit backlog.
//   node scripts/combat_backlog_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11291);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Cmb');
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

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};
  { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } }
  game.paused = false;
  // C14: a buff and a cooldown keep ticking while hit-stunned
  player.buffs = player.buffs || {};
  player.buffs.__probe = 3000; player.skillCooldowns = player.skillCooldowns || {}; player.skillCooldowns.__probe = 3000;
  player.hitStun = 1500;
  await wait(700);
  out.stunStill = player.hitStun > 0;
  out.buffAfter = player.buffs.__probe | 0; out.cdAfter = player.skillCooldowns.__probe | 0;
  player.hitStun = 0; delete player.buffs.__probe; delete player.skillCooldowns.__probe;
  return out;
});
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const ironWill = html.includes("if (_dr > 0 && dmg > 0) dmg = Math.max(1,");
const latches = html.includes("'_bigMeleeFiring', '_columnFiring', '_hgCharging',");
const opening = html.includes("|| (m._stagger > 0) || (m._dirOpenT > 0);");
const rawDt = html.includes("if (m._stagger > 0) m._stagger -= _rawDt;");
const virgo = html.includes("if (_vCs && !m._columnFiring && !m._bigMeleeFiring) {");
const shards = html.includes("_q._sovShardOf === m) { _q.currentHp = 0; game.monsters.splice(_si, 1); }");
const bestiary = html.includes("latch before it goes");
console.log(JSON.stringify({ ...r, ironWill, latches, opening, rawDt, virgo, shards, bestiary }));
const checks = [
  ['buffs keep ticking while hit-stunned', r.stunStill === true && r.buffAfter > 0 && r.buffAfter < 2700, 'buff ' + r.buffAfter],
  ['cooldowns keep ticking while hit-stunned', r.cdAfter > 0 && r.cdAfter < 2700, 'cd ' + r.cdAfter],
  ['Iron Will no longer resurrects a fully absorbed hit', ironWill],
  ['a stagger cancels an in-flight telegraph', latches],
  ['a latched swing halts during the punish opening', opening],
  ['the stagger window burns in real ms', rawDt],
  ["Virgo's banish does not retarget a drawn column", virgo],
  ['crown shards die with the Sovereign', shards],
  ['achievements latch before ascension wipes the bestiary', bestiary],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
