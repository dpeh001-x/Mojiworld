// Crown Shards: they hunt, they shoot, they stay leashed, and contact stays harmless.
// Plus the Sovereign's lengthened one-shot cadence.
//   node scripts/sov_crown_shard_test.mjs   (MOJI_GAME_FILE serves a staged build)
import { chromium } from 'playwright-core'; import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process'; import net from 'node:net';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const GAME = process.env.MOJI_GAME_FILE ? path.resolve(ROOT, process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  ' + x : '')); };
// ---- the cadence, read off the source ----------------------------------------
const src = readFileSync(GAME, 'utf8').replace(/\r\n/g, '\n');
ok('the OHKO repeat cadence is the lengthened one (24 / 18 / 13.5 s)', /_sp === 1 \? 1440 : _sp === 2 \? 1080 : 810/.test(src));
ok('the old 16 / 12 / 9 s cadence is gone', !/_sp === 1 \? 960 : _sp === 2 \? 720 : 540/.test(src));
ok('the first collapse is pushed from 8 s to 12 s', /_sovereignOhkoTick = \(game\.time \|\| 0\) \+ 720;/.test(src));
ok('the collapse still costs the Sovereign its SPENT window', /_sovSpentUntil = \(game\.time \| 0\) \+ 210 \+ 150;/.test(src));
// ---- the shards, in a running fight ------------------------------------------
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true; try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; } const c = document.querySelector('.cls-card'); if (c) c.click(); if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const out = {}; const frames = (n) => new Promise((res) => { let i = 0; const t = () => { game.paused = false; if (++i >= n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  try { loadMap('forest'); } catch (e) {} await frames(20);
  player.hp = player.maxHp = 999999; player._god = true;
  game.monsters = []; game.projectiles = [];
  spawnMonster(Math.round(player.x + 260), Math.round(player.y), 'towerSovereign', false);
  const m = game.monsters.filter((x) => x && x.type === 'towerSovereign').pop();
  if (!m) return { err: 'no sovereign' };
  m.currentHp = m.maxHp = 400000; m.atk = 300; m._expeditionFinalBoss = true; m._sovPhase = 1;
  m._sovereignOhkoTick = (game.time | 0) + 999999;   // keep the collapse out of this measurement
  m._sovereignDrainAt = (game.time | 0) + 999999; m._sovereignHomingAt = (game.time | 0) + 999999;
  m._sovRegaliaAt = 0;                                // raise the Regalia on the next tick
  await frames(30);
  const shards = () => (game.monsters || []).filter((q) => q && q._sovShardOf === m && q.currentHp > 0);
  out.shardCount = shards().length; out.shielded = !!m._sovShielded;
  if (!out.shardCount) return out;
  out.shardAtk = shards()[0].atk;
  // FAR: park the player well outside the notice radius and let them settle on the orbit
  player.x = m.x + 1400; player.y = m.y;
  await frames(90);
  const cx = m.x + m.w / 2, cy = m.y + m.h * 0.38;
  const distTo = (q, ax, ay) => Math.hypot((q.x + q.w / 2) - ax, (q.y + q.h / 2) - ay);
  // the orbit is an ELLIPSE (x radius _orbR, y radius _orbR*0.55), so a plain radius check is
  // wrong at the top and bottom - measure how well each shard sits ON that ellipse instead
  const _orbR = 130 + (m._sovPhase || 1) * 10;
  out.orbitFit = shards().map((q) => { const dx = (q.x + q.w / 2) - cx, dy = (q.y + q.h / 2) - cy;
    return +Math.sqrt((dx / _orbR) ** 2 + (dy / (_orbR * 0.55)) ** 2).toFixed(2); });
  // NEAR: stand next to the crown and watch one shard close in
  game.projectiles = [];
  player.x = cx - player.w / 2 + 40; player.y = cy - player.h / 2;
  const before = Math.round(Math.min(...shards().map((q) => distTo(q, player.x + player.w / 2, player.y + player.h / 2))));
  await frames(120);
  const after = Math.round(Math.min(...shards().map((q) => distTo(q, player.x + player.w / 2, player.y + player.h / 2))));
  out.nearestBefore = before; out.nearestAfter = after;
  out.maxLeash = Math.round(Math.max(...shards().map((q) => distTo(q, m.x + m.w / 2, m.y + m.h * 0.38))));
  const shots = (game.projectiles || []).filter((p) => p && p._sourceLabel === 'a Crown Shard');
  out.shots = shots.length;
  out.shotSkill = shots[0] && shots[0].skill; out.shotDmg = shots[0] && Math.round(shots[0].damage);
  out.shotOwner = shots[0] && shots[0].owner; out.bossAtk = m.atk;
  out.distinctFireTimes = new Set(shards().map((q) => q._sovShardShotAt | 0)).size;
  out.shardCountAfter = shards().length;
  return out;
});
ok('the Regalia raises and spawns shards', !r.err && r.shardCount >= 4, r.err || `${r.shardCount} shards, shielded ${r.shielded}`);
ok('a shard still has ZERO attack, so walking in to break it is safe', r.shardAtk === 0, `atk ${r.shardAtk}`);
ok('far from the player they hold the crown orbit', Array.isArray(r.orbitFit) && r.orbitFit.every((f) => f >= 0.9 && f <= 1.1), `ellipse fit ${(r.orbitFit || []).join(', ')} (1.00 = exactly on the orbit)`);
ok('with the player close, a shard closes the distance (it hunts)', r.nearestAfter < r.nearestBefore, `${r.nearestBefore}px -> ${r.nearestAfter}px`);
ok('it stops at arm\'s length instead of sliding inside the player', r.nearestAfter >= 40, `closest approach ${r.nearestAfter}px`);
ok('the leash holds - no shard strays past 340px from the crown', r.maxLeash <= 348, `furthest ${r.maxLeash}px`);
ok('shards fire at a nearby player', r.shots > 0, `${r.shots} shard shots in 2 s`);
ok('the shot is the Sovereign regalia projectile, owned by the enemy', r.shotSkill === 'msovereign' && r.shotOwner === 'enemy', `${r.shotSkill} / ${r.shotOwner}`);
ok('the shot lands at 18% of the boss attack, well under its own 55% homer', r.shotDmg === Math.round(r.bossAtk * 0.18), `${r.shotDmg} vs boss atk ${r.bossAtk}`);
ok('their cadences are staggered, not a lockstep volley', r.distinctFireTimes > 1, `${r.distinctFireTimes} distinct next-shot times across ${r.shardCountAfter} shards`);
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await b.close(); srv.kill();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
