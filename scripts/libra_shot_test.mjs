// LIBRA: the scale projectile is slower, with the same reach.
// ============================================================================
// Per user: "libra projectile speed is too fast, please nerf the speed".
// Her 45x18 scale shot flew at 10 px/frame for 120 frames (1,200px) — the
// fastest shot in the zodiac. Now 6.5 px/frame for 185 frames: same reach,
// 65% of the speed. Proven on the real shot: spawn Libra with the player in
// range, run her AI, catch the first scale projectile she fires.
// Run: node scripts/libra_shot_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9893);
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
await page.fill('#hero-name-input', 'Libra').catch(() => {});
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
  game.paused = true; player.level = 90; player._god = true; player.maxHp = 500000; player.hp = getMaxHp();
  const step = (n, f) => { for (let i = 0; i < n; i++) { game.time++; try { updateMonsters(16); } catch (e) {} if (f) f(); } };
  game.monsters = []; game.hazards.length = 0; game.projectiles.length = 0;
  spawnMonster(player.x + 420, player.y, 'zodiac_libra', true);
  const m = game.monsters[game.monsters.length - 1];
  m._bossIntroDone = true; step(120); m.invulnerable = 0;
  const seen = new Set(); let shot = null; let frames = 0;
  step(2400, () => {
    frames++;
    for (const p of game.projectiles) { if (!p || seen.has(p)) continue; seen.add(p); if (p.owner === 'enemy' && p.w === 45 && p.h === 18) { if (!shot) shot = { vx: p.vx, vy: p.vy, life: p.life, w: p.w, h: p.h, at: frames }; } }
    if (shot && frames > shot.at + 5) return;
  });
  game.monsters = []; game.hazards.length = 0; game.projectiles.length = 0; game.paused = false;
  return { sign: m.zodiacSign, shot, consts: { speed: typeof LIBRA_SCALE_SPEED !== 'undefined' ? LIBRA_SCALE_SPEED : null, life: typeof LIBRA_SCALE_LIFE !== 'undefined' ? LIBRA_SCALE_LIFE : null } };
});
ok('Libra spawns and fires her 45×18 scale projectile', !r.err && r.sign === 'libra' && r.shot, r.err || JSON.stringify({ sign: r.sign, shot: r.shot }));
ok('the scale shot flies at 6.5 px/frame (was 10)', !r.err && r.shot && Math.abs(Math.abs(r.shot.vx) - 6.5) < 0.01, r.err || `vx ${r.shot && r.shot.vx}`);
ok('...over 185 frames, so the reach is unchanged (~1,200px)', !r.err && r.shot && r.shot.life === 185 && Math.abs(Math.abs(r.shot.vx) * r.shot.life - 1200) <= 5, r.err || `life ${r.shot && r.shot.life}, reach ${r.shot && Math.abs(r.shot.vx) * r.shot.life}`);
ok('the numbers live in named constants', !r.err && r.consts.speed === 6.5 && r.consts.life === 185, r.err || JSON.stringify(r.consts));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
