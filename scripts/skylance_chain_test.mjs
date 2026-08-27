// Live test: SKY LANCE'S CHAINED DIVES DO NOT ABORT THE DIVE IN FLIGHT.
//
// Per user: "dragoon G skill is still bugged". G resolves to slot 'x', which
// for a Dragoon is dragoon_skylance - the code's own comments call it "the
// dragoon G skill" too.
//
// The defect: the follow-up dives are booked with scheduleSkillTimer, which is
// setTimeout (wall clock), while the dive is frame-based gravity. From the apex
// the drop is ~23 frames - 383 ms at 60 fps, inside the 700 ms chain, but
// 767 ms at 30 fps, outside it. Below ~33 fps the chain teleports the player
// back to the apex mid-dive and the first impact never resolves, so the skill
// loses a third to a half of its damage precisely when frames are scarce.
// Measured on a live cast through the real key path: chain fired at +940 ms
// with the player 126 px above the ground; one impact instead of two.
//
// The IMPACT-COUNT checks below only discriminate when the harness is slow
// enough to lose the race - on a fast machine the old build passes them too.
// The helper checks are deterministic and pin the new behaviour directly at
// any frame rate; they are the ones that fail on the previous build regardless.
//   node scripts/skylance_chain_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof skillBySlot === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.evaluate(() => { try { loadMap('sauroSlope'); } catch (e) {} });
await page.waitForTimeout(1500);

const wiring = await page.evaluate(() => {
  player.cls = 'warrior'; player.job = 'knight'; player.master = 'dragoon';
  player.level = 60; player.mp = player.maxMp = 999;
  const found = skillBySlot('x');
  return { gSlot: KEY_TO_SLOT.g, id: found && found.id, key: SLOT_TO_KEY.x,
    hasHelper: typeof _lxSkyLanceChain === 'function' };
});

// ---- the real cast, through the real key ----
// FIRST, before anything pokes at player state: the helper probe below has to
// move the player and set dragoonSlam by hand, and running it first left the
// cast with zero impacts - the test measuring its own leftovers.
const cast = await page.evaluate(async (rank10) => {
  const out = { impacts: [], aborts: [] };
  game.monsters = [];
  spawnMonster(Math.round(player.x) + 200, player.y - 30, 'slime', false);
  const mon = game.monsters[0];
  if (mon) { mon.hp = mon.currentHp = 5e8; mon.maxHp = 5e8; }
  await new Promise((r) => { let n = 0; const t = () => { game.paused = false; if (++n > 90) return r(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.groundY = Math.round(player.y); out.settled = !!player.onGround;
  if (player.skillCooldowns) player.skillCooldowns.dragoon_skylance = 0;
  player.mp = 999;
  const realLv10 = window.getSkillLv10;
  window.getSkillLv10 = (id) => (id === 'dragoon_skylance' ? (rank10 ? { extraHit: 1.5 } : null) : realLv10(id));
  const origAround = window.performAround;
  const t0 = performance.now();
  window.performAround = function (...a) { out.impacts.push(Math.round(performance.now() - t0)); return origAround.apply(this, a); };
  let prevY = player.y;
  const origFn = SKILL_FNS.dragoon_skylance;
  SKILL_FNS.dragoon_skylance = function (...a) { out.fired = (out.fired | 0) + 1; return origFn.apply(this, a); };
  // Warrior skill keys are HOLD-TO-CHARGE: the cast lands on KEYUP. Holding the
  // key for the whole observation window meant the skill fired after it, and
  // the first cut of this test read zero impacts on a build that works.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', bubbles: true }));
  await new Promise((r) => { let n = 0; const t = () => { game.paused = false; if (++n > 18) return r(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'g', code: 'KeyG', bubbles: true }));
  await new Promise((r) => { let n = 0; const t = () => {
    game.paused = false;
    // an upward jump of >60px while a slam is live, with the player still well
    // above the floor, IS the abort this test exists for
    if (prevY - player.y > 60 && (out.groundY - prevY) > 40 && (player.dragoonSlam | 0) === 1) {
      out.aborts.push({ ms: Math.round(performance.now() - t0), gap: Math.round(out.groundY - prevY) });
    }
    prevY = player.y;
    if (++n > 280) return r(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  SKILL_FNS.dragoon_skylance = origFn;
  window.performAround = origAround; window.getSkillLv10 = realLv10;
  game.monsters = [];
  return out;
}, false);

// ---- deterministic: the helper itself ----
// dragoonSlam cannot simply be set on a grounded player - the slam resolves in
// the same frame and clears the flag, which made the first cut of this probe
// report "not deferred" on a build that defers correctly. The player is parked
// far above the floor so the dive genuinely stays in flight for the window.
const helper = await page.evaluate(async () => {
  if (typeof _lxSkyLanceChain !== 'function') return { missing: true };
  const out = {};
  const frames = (n) => new Promise((r) => { let i = 0; const t = () => { game.paused = false; if (++i > n) return r(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const savedY = player.y, savedX = player.x, savedVy = player.vy;
  // A: a dive still in flight defers the chain
  let ran = false;
  player.y = savedY - 3000; player.vy = 0; player.onGround = false; player.dragoonSlam = 1;
  _lxSkyLanceChain(() => { ran = true; }, 60);
  await frames(30);
  out.stillAirborne = !player.onGround;      // the premise of check A
  out.deferredWhileSlamming = !ran;
  // B: it runs as soon as the dive resolves
  player.dragoonSlam = 0;
  await frames(30);
  out.ranOnceSlamCleared = ran;
  // C: with nothing in flight it is not delayed at all
  let ran2 = false; const t0 = performance.now();
  player.dragoonSlam = 0;
  _lxSkyLanceChain(() => { ran2 = true; out.promptMs = Math.round(performance.now() - t0); }, 60);
  await frames(30);
  out.promptWhenClear = ran2;
  player.x = savedX; player.y = savedY; player.vy = savedVy; player.dragoonSlam = 0;
  return out;
});

ok('G resolves to the Dragoon\'s Sky Lance (the "G skill")',
  wiring.gSlot === 'x' && wiring.id === 'dragoon_skylance' && wiring.key === 'G', wiring);

ok('a chained dive DEFERS while the previous dive is still falling',
  helper.deferredWhileSlamming === true && helper.stillAirborne === true,
  { ...helper, note: 'the defect: it used to teleport the player back to the apex mid-dive' });

ok('...and fires the moment that dive resolves',
  helper.ranOnceSlamCleared === true, helper);

ok('...and is not delayed at all when nothing is in flight',
  helper.promptWhenClear === true, { promptMs: helper.promptMs });

ok('a real G press never aborts a dive that has not landed',
  cast.aborts.length === 0,
  { aborts: cast.aborts, note: 'measured before the fix: 1 abort at +940ms with the player 126px up' });

ok('the G press actually casts the skill', (cast.fired | 0) === 1,
  { fired: cast.fired | 0, settledOnGround: cast.settled,
    note: 'warrior keys are hold-to-charge; the cast lands on KEYUP' });

ok('both dives land, so the cast delivers the two impacts its card promises',
  cast.impacts.length >= 2,
  { impacts: cast.impacts, got: cast.impacts.length,
    note: 'only discriminates when the harness is slow enough to lose the race' });

ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
