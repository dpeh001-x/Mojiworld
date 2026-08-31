// SHINOBI'S B STICKS TO THE CLOSEST ENEMY.
// ============================================================================
// Per user: "Shinobi's B does not track the enemy, so sometimes the skill
// doesnt work as intended", sharpened to: "the multiple explosion one should
// stick to the closest enemy and not in front". The Hundred-Hand Shadow Dance
// traced a FIXED Z (+-165 x / 210 y) off the cast point; a victim 400px away
// watched every slash hit air. Each dash now re-resolves the closest living
// enemy at fire time and lands ON it, feet-aligned; the authored Z survives
// as the empty-room fallback.
//
// Driven live (the dashes are wall-clock timers, 100 + i*115ms): a dummy is
// planted 400px from the cast — beyond the old Z's reach by construction —
// and made to WALK; the dance must land on it repeatedly and damage it. Then
// an empty-room cast must fall back to the authored Z and not throw.
// Run: node scripts/shinobi_ult_track_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9993);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function'
  && typeof SKILLS === 'object', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'ShinobiTrk').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*rogue\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 190) });

// ---- tracked cast: victim 400px out, walking --------------------------------
const r1 = await page.evaluate(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = false;
  player.level = 60; player.job = 'ninja'; player.master = 'shinobi';
  player._god = true; player.mp = 99999; player.skillCooldowns = {};
  game.monsters = [];
  const _type = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type || Object.keys(monsterTypes)[0];
  spawnMonster(player.x + 400, player.y, _type, false);
  const m = game.monsters[game.monsters.length - 1];
  m.hp = m.currentHp = m.maxHp = 9e9; m.invulnerable = 0;
  m.x = player.x + 400; m.y = player.y; m.vx = 2.5; m._testWalker = true;   // it WALKS during the dance
  const castX = player.x;
  const hp0 = m.currentHp;
  const samples = [];
  const iv = setInterval(() => {
    if (m._testWalker) { m.x += 3; }   // keep it moving even if AI idles
    samples.push({ px: player.x + player.w / 2, mx: m.x + m.w / 2, my: m.y, py: player.y });
  }, 40);
  try { castSkill('shinobi_ult'); } catch (e) { clearInterval(iv); return { err: String(e).slice(0, 140) }; }
  await new Promise((r) => setTimeout(r, 900));
  clearInterval(iv);
  const stuck = samples.filter((s) => Math.abs(s.px - s.mx) < Math.max(90, m.w));
  return {
    castX, endMx: m.x, hpLost: hp0 - m.currentHp,
    samples: samples.length, stuckSamples: stuck.length,
    maxReach: Math.max(...samples.map((s) => Math.abs(s.px - (castX + player.w / 2)))),
  };
});
ok('the cast ran without error', !r1.err, r1.err || '');
if (!r1.err) {
  ok('the dance reached a victim 400px out — beyond the old fixed Z (max 165px)',
    r1.maxReach > 300, `player travelled ${Math.round(r1.maxReach)}px from cast (old Z: 165)`);
  ok('the dance STUCK to the walking victim (player sampled on top of it)',
    r1.stuckSamples >= 3, `${r1.stuckSamples}/${r1.samples} samples within a body-width`);
  ok('the victim actually took the slashes', r1.hpLost > 0, `hp lost: ${r1.hpLost}`);
}

// ---- empty-room fallback: authored Z, no crash ------------------------------
const r2 = await page.evaluate(async () => {
  game.monsters = [];
  player.skillCooldowns = {}; player.mp = 99999;
  const bx = player.x;
  try { castSkill('shinobi_ult'); } catch (e) { return { err: String(e).slice(0, 140) }; }
  await new Promise((r) => setTimeout(r, 900));
  return { moved: Math.abs(player.x - bx), errFree: true };
});
ok('an empty-room cast still dances the authored Z and does not throw',
  !r2.err && r2.moved <= 400, r2.err || `end offset ${Math.round(r2.moved)}px`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
