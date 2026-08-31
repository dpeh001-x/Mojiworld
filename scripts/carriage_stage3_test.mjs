// Live test: STAGE 3 IS HARDER AND THE CARRIAGE ACTUALLY LURCHES.
//
// Per user: "For stage 3 train PQ make it harder ... and more fun."
//
// The load-bearing invariant is the SOFT-LOCK one: the carriage has no
// respawn, so the quest count and the authored spawn count must be EQUAL -
// v0.26.344 was exactly this bug via spawn jitter. Everything else is driven
// through the real paths: loadMap('tower') for the auto-accept + First-Class
// tagging, updateCarriage on the driven clock for the lurch.
//   node scripts/carriage_stage3_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8751; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateCarriage === 'function'
  && typeof QUESTS !== 'undefined', null, { timeout: 120000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const out = {};
  // ---- the soft-lock invariant ----
  out.questCount = QUESTS.q_pq_carriage.count;
  const sp = (MAPS.tower.spawns || []).find((e) => e.type === 'ticketMech');
  out.spawnCount = sp ? sp.count : -1;
  out.noJitter = !!MAPS.tower._noSpawnJitter;

  // ---- real entry: auto-accept + First-Class tagging ----
  player.quests = player.quests || {};
  player.quests.completed = { q_pq_spire: true };
  player.level = 40;   // the auto-accept honours levelReq 29; a fresh headless save is Lv 1
  player.quests.active = {}; player.quests.unlocked = { q_pq_carriage: true };
  player.hp = Math.max(1, player.hp);
  loadMap('tower', 100);
  await new Promise((z) => setTimeout(z, 700));   // spawn pass + the 220ms tagging defer
  const mechs = game.monsters.filter((m) => m && m.type === 'ticketMech');
  const elites = mechs.filter((m) => m._firstClass);
  const plain = mechs.filter((m) => !m._firstClass);
  out.entered = game.currentMap === 'tower';
  out.accepted = !!(player.quests.active && player.quests.active.q_pq_carriage);
  out.mechCount = mechs.length;
  out.eliteCount = elites.length;
  out.elitesFlagged = elites.every((m) => m.isElite && /^First-Class /.test(m.name || ''));
  out.hpRatio = (elites.length && plain.length)
    ? +(elites[0].maxHp / plain[0].maxHp).toFixed(2) : 0;

  // ---- the lurch, through the real tick on the driven clock ----
  const drive = (frames) => { for (let f = 0; f < frames; f++) { game.time++; updateCarriage(16); } };
  game.paused = false;
  updateCarriage(16);                       // creates game._carriage
  const c = game._carriage;
  out.hasState = !!c;
  // airborne victim
  c.lurchAt = game.time + 10; c.lurchWarned = false;
  player.onGround = false; player.vx = 0; player.vy = 0; player._riftSurgeUntil = 0;
  drive(12);
  out.airborne = { vx: +player.vx.toFixed(1), surge: (player._riftSurgeUntil | 0) > (game.time | 0) - 5 };
  // grounded brace
  c.lurchAt = game.time + 10; c.lurchWarned = false;
  player.onGround = true; player.vx = 0; player._riftSurgeUntil = 0;
  drive(12);
  out.grounded = { vx: +player.vx.toFixed(1), surge: (player._riftSurgeUntil | 0) > (game.time | 0) };
  // mechs skid with the brake
  const mvx = mechs.filter((m) => m.currentHp > 0).map((m) => +(m.vx || 0).toFixed(1));
  out.mechSkid = mvx.some((v) => v <= -3);
  // after the cabin is cleared, the brakes stop harassing
  for (const m of mechs) { m.currentHp = 0; }
  c.lurchAt = game.time + 10; c.lurchWarned = false;
  player.onGround = false; player.vx = 0;
  drive(12);
  out.afterClear = { vx: +player.vx.toFixed(1) };
  // restore
  player.quests.active = {}; player.quests.completed = {};
  loadMap('town', 400);
  await new Promise((z) => setTimeout(z, 400));
  return out;
});
await b.close(); srv.kill();

ok('quest count and authored spawn count are 12 AND equal - the soft-lock invariant',
  r.questCount === 12 && r.spawnCount === 12 && r.questCount === r.spawnCount && r.noJitter,
  { questCount: r.questCount, spawnCount: r.spawnCount, jitterPinned: r.noJitter,
    note: 'no respawn on the carriage: unequal counts strand the stage short of its target (v0.26.344)' });
ok('entering the carriage auto-accepts and spawns the full dozen',
  r.entered && r.accepted && r.mechCount === 12,
  { entered: r.entered, accepted: r.accepted, mechs: r.mechCount });
ok('exactly four ride First-Class - elite-flagged, renamed, ~1.8x HP',
  r.eliteCount === 4 && r.elitesFlagged && r.hpRatio >= 1.7 && r.hpRatio <= 1.9,
  { elites: r.eliteCount, flagged: r.elitesFlagged, hpRatio: r.hpRatio });
ok('the lurch HURLS an airborne player toward the rear, past the speed cap',
  r.airborne.vx <= -14 && r.airborne.surge,
  { ...r.airborne, note: 'vx beyond 10 requires the cap exemption - without the surge flag the throw is silently clipped' });
ok('...while a braced (grounded) player only stumbles',
  r.grounded.vx <= 0 && r.grounded.vx >= -5,
  r.grounded);
ok('the mechs skid with the brake - the whole cabin obeys the physics',
  r.mechSkid, { skidded: r.mechSkid });
ok('a cleared cabin stops braking - no harassment after the last mech falls',
  r.afterClear.vx === 0, r.afterClear);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
