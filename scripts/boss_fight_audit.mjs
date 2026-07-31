// Boss-fight structural audit. Fights EVERY boss through the real world step,
// dragging currentHp down so all phase thresholds are crossed, and fails on the
// structural glitches that make a fight unplayable rather than merely unfair:
// crashes, NaN transforms, bosses stranded below the floor or off the map,
// runaway spawns/projectiles/particles, unbreakable crowd control, and bosses
// that cannot be killed.
//   node scripts/boss_fight_audit.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8893)
//
// Three things this MUST replicate from loop(), each of which silently faked a
// result while it was missing:
//   • game.time++      — a frame counter; every cadence and expiry keys off it.
//                        Frozen, Scorpio never burrowed and the 1.5 s Mirror
//                        Shroud never lifted (mirrorSelf read as unkillable).
//   • updatePlayer()   — drives CC timers and the QTE frame. Without it the
//                        stun never ticked down and read as a 49 s stunlock.
//   • currentHp        — the LIVE hp field. Draining m.hp instead crossed no
//                        phase thresholds at all.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8893;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

await page.evaluate(() => {
  window.__step = (dt) => {
    game.time = (game.time | 0) + 1;
    if (typeof updatePlayer === 'function') updatePlayer(dt);
    updateMonsters(dt); updateProjectiles(dt);
    if (typeof emitProjectileTrails === 'function') emitProjectileTrails();
    if (typeof updateMinions === 'function') updateMinions(dt);
    if (typeof updateParticles === 'function') updateParticles(dt);
    if (typeof updateFxInstances === 'function') updateFxInstances(dt);
    if (typeof updateSmoothFx === 'function') updateSmoothFx(dt);
    if (typeof updatePowerupOrbs === 'function') updatePowerupOrbs(dt);
    if (typeof updateMapEvents === 'function') updateMapEvents(dt);
  };
});

const BOSSES = await page.evaluate(() => Object.entries(monsterTypes).filter(([k, t]) => t && t.boss).map(([k]) => k));
const hdr = 'BOSS'.padEnd(25) + 'phase hits  under  air  off  mon proj part stun frz  kill';
console.log(`auditing ${BOSSES.length} bosses\n${hdr}\n${'-'.repeat(hdr.length)}`);

const rows = [];
for (const type of BOSSES) {
  const before = errs.length;
  const r = await page.evaluate((type) => {
    const out = { type };
    try {
      const arena = Object.entries(MAPS)
        .filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some(p => p.w > 900))
        .sort((a, b) => b[1].worldWidth - a[1].worldWidth)[0];
      if (!arena) { out.fatal = 'no arena map'; return out; }
      loadMap(arena[0]);
      const ww = game.mapData.worldWidth;
      const wide = (game.mapData.platforms || []).filter(p => p.w > 900).sort((a, b) => a.y - b.y);
      const gy = wide[0].y;                            // topmost wide slab — where we drop the fighters in
      // The "floor" for strand detection is the DEEPEST surface in the map, not
      // the topmost one. Keying off the top slab flagged Gravitos (340x380,
      // roams the lower platforms) as sunk for 64 s while it was onGround the
      // whole time. Anything below every surface, and not standing on one, is
      // genuinely out of the world.
      const floorY = (game.mapData.platforms || []).reduce((a, p) => Math.max(a, p.y), gy);

      game.monsters.length = 0;
      for (const k of ['projectiles', 'particles', 'hazards', 'minions', 'fxInstances']) if (game[k]) game[k].length = 0;
      game.keys = {};                                  // no input: worst case for CC escape
      player.level = 200; player.maxHp = 999999; player.hp = 999999;
      player.x = ww * 0.5; player.y = gy - 80; player.vx = 0; player.vy = 0;
      player.invulnerable = 0; player._god = false; player.stunTimer = 0; player.frozenTimer = 0;

      const m = spawnMonster(ww * 0.5 + 260, gy - 200, type, true);   // spawn in engagement range
      if (!m || m._suppressed) { out.fatal = 'spawn failed'; return out; }

      const TICKS = 5400;                              // ~90 s
      let off = 0, under = 0, air = 0, hits = 0, phases = 0, prevPhase = null;
      let maxMon = 0, maxProj = 0, maxPart = 0;
      let curStun = 0, maxStun = 0, curFrz = 0, maxFrz = 0, underRun = 0, maxUnderRun = 0;
      let died = false;

      for (let i = 0; i < TICKS; i++) {
        m.currentHp = Math.max(1, Math.floor(m.maxHp * (1 - i / TICKS * 0.995)));
        if (m.hp != null) m.hp = m.currentHp;
        if (game.dying) game.dying = false;
        const hp0 = player.hp;
        try { window.__step(16.667); } catch (e) { out.threw = String(e).slice(0, 140); break; }
        if (player.hp < hp0) hits++;
        player.hp = player.maxHp;
        if (game.monsters.indexOf(m) < 0) { died = true; break; }
        if (![m.x, m.y, m.vx, m.vy].every(Number.isFinite)) { out.nan = true; break; }

        const ph = m.phase != null ? m.phase : m._phase;
        if (ph !== prevPhase) { phases++; prevPhase = ph; }
        if (m.x < -300 || m.x > ww + 300) off++;
        if (m.y < gy - 900) air++;
        // FEET below every surface in the map.
        //
        // Two calibration mistakes were made here before this line settled, both
        // caught by running the detector against a known-bad input rather than
        // trusting that it looked right:
        //   • comparing m.y (the top edge) instead of the feet — a 142 px-tall
        //     Scorpio stranded with her top at 821, in an arena whose deepest
        //     platform is 660, slipped under the threshold while her feet were a
        //     full 300 px through the bottom of the world.
        //   • 200 px of slack — only marginally tighter than the real defect
        //     (~303 px past the floor), so a slightly milder ratchet passed.
        // 100 px sits comfortably between the two populations: the deepest
        // LEGITIMATE position across all 25 bosses is ~310 px ABOVE this line
        // (bosses roam platforms at many heights, and the burrow travels 70 px
        // below whichever one it started from), while the defect sat ~300 px
        // below it.
        //
        // Deliberately NOT gated on !m.onGround: a boss that has drifted under
        // the world keeps a stale onGround=true, which is exactly what to catch.
        if (m.y + m.h > floorY + 100) { under++; underRun++; maxUnderRun = Math.max(maxUnderRun, underRun); } else underRun = 0;
        maxMon = Math.max(maxMon, game.monsters.length);
        maxProj = Math.max(maxProj, (game.projectiles || []).length);
        maxPart = Math.max(maxPart, (game.particles || []).length);
        if ((player.stunTimer | 0) > 0) { curStun++; maxStun = Math.max(maxStun, curStun); } else curStun = 0;
        if ((player.frozenTimer | 0) > 0) { curFrz++; maxFrz = Math.max(maxFrz, curFrz); } else curFrz = 0;
      }

      if (!died && game.monsters.indexOf(m) >= 0) {
        for (let i = 0; i < 400 && game.monsters.indexOf(m) >= 0; i++) {
          try { hitMonster(m, 1e9, false); window.__step(16.667); } catch (e) { break; }
        }
      }
      Object.assign(out, {
        killable: game.monsters.indexOf(m) < 0, phases, hits, off, air, under,
        maxUnderSec: +(maxUnderRun / 60).toFixed(1), maxMon, maxProj, maxPart,
        maxStunSec: +(maxStun / 60).toFixed(1), maxFrzSec: +(maxFrz / 60).toFixed(1),
      });
    } catch (e) { out.fatal = String(e).slice(0, 180); }
    return out;
  }, type);
  r.pageErrs = errs.length - before;
  rows.push(r);
  const p = (v, n) => String(v ?? '-').padStart(n);
  console.log(String(type).padEnd(25) + p(r.phases, 4) + p(r.hits, 6) + p(r.under, 6) + p(r.air, 5) +
    p(r.off, 5) + p(r.maxMon, 5) + p(r.maxProj, 5) + p(r.maxPart, 5) + p(r.maxStunSec, 5) +
    p(r.maxFrzSec, 5) + '  ' + (r.killable ? 'y' : 'NO') +
    (r.threw || r.fatal ? '  ERR ' + (r.threw || r.fatal) : ''));
}

const fails = [];
for (const r of rows) {
  if (r.fatal) fails.push(`${r.type}: ${r.fatal}`);
  if (r.threw) fails.push(`${r.type}: threw — ${r.threw}`);
  if (r.nan) fails.push(`${r.type}: NaN position/velocity`);
  if (!r.killable) fails.push(`${r.type}: could not be killed`);
  if (r.under > 0) fails.push(`${r.type}: sank below the floor (${r.maxUnderSec}s in one stretch)`);
  if (r.off > 0) fails.push(`${r.type}: left the map (${r.off} ticks)`);
  if (r.air > 0) fails.push(`${r.type}: stranded far above the arena (${r.air} ticks)`);
  if (r.maxMon > 60) fails.push(`${r.type}: runaway spawns (${r.maxMon} monsters)`);
  if (r.maxProj > 400) fails.push(`${r.type}: runaway projectiles (${r.maxProj})`);
  if (r.maxStunSec > 8) fails.push(`${r.type}: unbreakable stun (${r.maxStunSec}s with no input)`);
  if (r.maxFrzSec > 8) fails.push(`${r.type}: unbreakable freeze (${r.maxFrzSec}s)`);
  if (r.pageErrs) fails.push(`${r.type}: ${r.pageErrs} page error(s)`);
}
console.log(`\n${rows.length} bosses fought ~90 s each, across every phase`);
if (fails.length) { console.log('FAIL:'); fails.forEach(f => console.log('  ' + f)); }
else console.log('PASS — no crashes, strandings, runaways, CC locks, or unkillable bosses');
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(fails.length || errs.length ? 1 : 0);
