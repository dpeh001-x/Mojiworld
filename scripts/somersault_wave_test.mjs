// Four user asks, verified against the projectiles the game actually spawns:
//   1. the doombringer wave should be less vertically squashed
//   2. Somersault Smash should be faster
//   3. its shockwave should sit at the player's height
//   4. that shockwave should be slightly smaller and travel a shorter distance
//
// Squash is measured as box aspect vs the SPRITE's true aspect, because that
// ratio is the squash — a box-size assertion alone says nothing about it.
//   node scripts/somersault_wave_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const art = await sharp('Sprites/projectiles/p_ult_doombringer.webp').metadata();
const artAspect = art.width / art.height;

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof player === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  player.cls = 'warrior'; player.job = 'berserker'; player.master = null;
  player.facing = 1; game.paused = false;
  player.hp = Math.max(1, player.maxHp || 100);

  // --- doombringer rider (bloodlust up) ---
  player.buffs = player.buffs || {}; player.buffs.bloodlust = 600;
  game.projectiles.length = 0;
  SKILL_FNS.slash();
  const bw = game.projectiles.find(p => p && p.skill === 'bloodwave' && p.bspr === 'bult_doombringer');
  out.rider = bw ? { w: bw.w, h: bw.h, cyOff: (bw.y + bw.h / 2) - (player.y + player.h / 2) } : null;

  // --- Somersault Smash ---
  player.buffs.bloodlust = 0;
  player._skillLockTimer = 0;
  const t0 = Date.now();
  game.projectiles.length = 0;
  const pcyAtCast = player.y + player.h / 2;
  SKILL_FNS.powerStrike();
  out.lockMs = player._skillLockTimer || 0;
  out.somersaultMs = player.somersaultDuration || 0;
  const wave = await new Promise((res) => setTimeout(() => res(
    game.projectiles.find(p => p && p.skill === 'bloodwave' && !p.bspr)), 1200));
  out.elapsedToWave = Date.now() - t0;
  out.wave = wave ? {
    w: wave.w, h: wave.h, life: wave.life, vx: wave.vx,
    travel: Math.abs(wave.vx) * wave.life,
    cyOff: (wave.y + wave.h / 2) - (player.y + player.h / 2),
    cyOffAtCast: (wave.y + wave.h / 2) - pcyAtCast,
  } : null;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log(`art aspect ${artAspect.toFixed(3)} (${art.width}x${art.height})`);
console.log('rider ->', JSON.stringify(r.rider));
console.log('wave  ->', JSON.stringify(r.wave));
console.log('somersault lock ms ->', r.lockMs, '/ duration', r.somersaultMs);

// 1. squash
const riderAspect = r.rider ? r.rider.w / r.rider.h : null;
const squash = riderAspect ? Math.abs(riderAspect - artAspect) / artAspect : null;
console.log(`rider box aspect ${riderAspect && riderAspect.toFixed(3)} -> squash ${(squash * 100).toFixed(0)}% (was 41%)`);
ok('the doombringer wave is much less squashed than before', squash != null && squash < 0.15, { squashPct: +(squash * 100).toFixed(0) });
ok('and it was NOT un-squashed by shrinking the width', r.rider && r.rider.w === 104, { w: r.rider && r.rider.w });

// 2. faster
ok('the somersault is faster (<= 340 ms, was 460)', r.somersaultMs > 0 && r.somersaultMs <= 340, { ms: r.somersaultMs });
ok('the skill-lock window shortened with it (they are one constant)', r.lockMs > 0 && r.lockMs <= 340, { lockMs: r.lockMs });

// 3. position
ok('the smash shockwave is centred on the player (within 2 px)',
   r.wave && Math.abs(r.wave.cyOffAtCast) <= 2, { offset: r.wave && +r.wave.cyOffAtCast.toFixed(1) });

// 4. smaller + shorter
ok('the shockwave is slightly smaller (was 78x52)',
   r.wave && r.wave.w === 64 && r.wave.h === 44, r.wave);
ok('it is SLIGHTLY smaller, not gutted (still >= 60% of the old area)',
   r.wave && (r.wave.w * r.wave.h) >= 0.6 * (78 * 52), { area: r.wave && r.wave.w * r.wave.h, oldArea: 78 * 52 });
ok('it travels a shorter distance (was ~306 px)',
   r.wave && r.wave.travel < 260, { travel: r.wave && r.wave.travel });
ok('shortened via LIFE, not by slowing it down (speed unchanged)',
   r.wave && Math.abs(r.wave.vx) === 9, { vx: r.wave && r.wave.vx });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
