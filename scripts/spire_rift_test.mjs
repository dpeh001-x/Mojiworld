// Live test: SPIRE VOID-TEARS ARE SCATTERED, AND THE SURGE ACTUALLY THROWS YOU.
//
// Per user, from a screenshot of two tears stacked at the same x: "the rifts are
// in all the same vertical line, randomise their placements near the platforms,
// also make them have a larger knockback".
//
// Both halves are measured against the real map build and the real player
// physics - the placement out of MAPS.clockworkSpire, and the carry distance by
// stepping the game's own movement until the player lands.
//   node scripts/spire_rift_test.mjs [port]
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
for (let p = 8911; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && MAPS.clockworkSpire && typeof player === 'object',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const M = MAPS.clockworkSpire, hz = M._pqSpireHazards || [], pf = M.platforms || [];
  const floors = [3, 7, 11, 15, 19, 23, 27, 31];
  out.count = hz.length;
  out.xs = hz.map(h => h.x);
  out.distinctX = [...new Set(hz.map(h => h.x))].length;
  out.yOffsets = hz.map((h, i) => (pf[floors[i]] ? pf[floors[i]].y - h.y : null));
  // horizontal gap from each tear to its platform: 0 means it overlaps the
  // platform's span, which is what "near the platforms" has to mean.
  out.gaps = hz.map((h, i) => {
    const p = pf[floors[i]]; if (!p) return null;
    const hl = h.x, hr = h.x + h.w, pl = p.x, pr = p.x + p.w;
    return (hr < pl) ? pl - hr : (hl > pr) ? hl - pr : 0;
  });
  // the standing-safe invariant: a player resting ON the platform (feet at p.y)
  // must NOT be inside the damage band, or the tear chips them where they land.
  out.standingSafe = hz.every((h, i) => {
    const p = pf[floors[i]]; if (!p) return true;
    return !(p.y > h.y && p.y < h.y + h.h + 10);
  });

  // ---- the surge, driven end to end ----
  // Not a re-implementation of the shove: a real Spire-labelled void_tear is
  // pushed at the player and updateProjectiles (which owns the void_tear
  // resolver) is left to apply it, so the flag, the velocity and the cap
  // exemption are all exercised as they ship. Math.random is pinned low for one
  // call so the 35% roll fires deterministically.
  const surge = () => {
    const keep = { x: player.x, y: player.y, vx: player.vx, vy: player.vy,
      onGround: player.onGround, hp: player.hp, inv: player.invulnerable,
      hz: game.hazards, rnd: Math.random };
    if (typeof keys === "object" && keys) for (const k of Object.keys(keys)) keys[k] = false;
    const px0 = player.x, py = player.y;
    game.hazards = [{ type: "void_tear", x: px0 - 30, y: py - 40, w: 100, h: 90,
      cx: px0 - 30 + 50, life: 600, maxLife: 600, atk: 1,
      _sourceLabel: "a Spire void-tear" }];
    player.invulnerable = 0; player.onGround = false; player.vx = 0; player.vy = 0;
    Math.random = () => 0.01;            // force the 35% roll AND the low end of the range
    updateProjectiles(16);
    Math.random = keep.rnd;
    const vxAfter = player.vx, flag = (player._riftSurgeUntil | 0) > (game.time | 0);
    let f = 0, peak = 0;
    while (f < 600 && !player.onGround) { peak = Math.max(peak, Math.abs(player.vx)); updatePlayer(16); f++; }
    const px = Math.round(Math.abs(player.x - px0));
    game.hazards = keep.hz; player._riftSurgeUntil = 0;
    Object.assign(player, { x: keep.x, y: keep.y, vx: keep.vx, vy: keep.vy,
      onGround: keep.onGround, hp: keep.hp, invulnerable: keep.inv });
    return { px, frames: f, vxAfter: +vxAfter.toFixed(2), peak: +peak.toFixed(2), flag };
  };
  out.surge = surge();
  out.hardCap = (typeof PLAYER_SPEED_HARD_CAP !== "undefined") ? PLAYER_SPEED_HARD_CAP : null;
  out.measuredOn = game.currentMap;
  out.gapMax = 55;   // SP_GAP_MAX - the jump budget the whole map is built to
  return out;
});

ok('all eight tears still exist', r.count === 8, { count: r.count });
ok('they are no longer stacked in one vertical line',
  r.distinctX >= 6,
  { distinctX: r.distinctX, wasDistinct: 1, xs: r.xs, note: 'shipped build baked all eight to x=500' });
ok('every tear sits ON or beside its platform, not off in empty air',
  r.gaps.every(g => g !== null && g <= 40),
  { gapsPx: r.gaps, worst: Math.max(...r.gaps), note: '0 = overlaps the platform span; shipped build was 110-346px away' });
ok('their heights vary too, instead of a fixed offset',
  new Set(r.yOffsets).size >= 4,
  { offsets: r.yOffsets, wasAlways: 110 });
ok('standing on the platform is still safe - only passing through hurts',
  r.standingSafe, { note: 'band must not contain feet-at-platform-y' });
ok('the real surge fires and sets its cap-exemption window',
  r.surge.flag === true && r.surge.vxAfter !== 0,
  { vxRightAfterTheHit: r.surge.vxAfter, exemptionArmed: r.surge.flag });
ok('the shove now EXCEEDS the speed cap that used to swallow it',
  r.surge.peak > r.hardCap,
  { peakSpeed: r.surge.peak, hardCap: r.hardCap,
    note: 'shipped build could not exceed 10 by construction - every surge above it was clipped the same frame' });
ok('...and it carries the player further than a normal jump gap',
  r.surge.px > r.gapMax,
  { carriedPx: r.surge.px, framesAirborne: r.surge.frames, gapMaxPx: r.gapMax, map: r.measuredOn,
    note: 'a shove that cannot cross the 55px jump budget cannot knock anyone off a ledge' });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
