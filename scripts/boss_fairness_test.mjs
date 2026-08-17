// Boss fairness + legibility: telegraph floor, Soul Drain's escape, and the
// Singularity anti-spam floor.
//
// Per user, in order: (#2) telegraphs were 180-700ms, a 3.9x spread on the one
// signal the player reads — floor them; (#1) Soul Drain was documented in the
// source as an "unavoidable HP->1 / MP->1 pulse" — give it a line-of-sight
// out; and "Singularity Collapse gets very cheesy at the end where he starts
// spamming — have a hard floor minimum time to recast it".
//
// The load-bearing check here is that the Soul Drain escape is REACHABLE. An
// "out" that the arena geometry never actually grants is worse than no out at
// all, so this sweeps real player positions across the arena and proves both
// that safe spots exist AND that standing in the open is still fatal.
// Run: node scripts/boss_fairness_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS !== 'undefined', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 90; player.hp = player.maxHp = 5e5;
  player._gravitosCineSeen = true;
  loadMap('gravitosArena');
});
await page.waitForTimeout(9000);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};

  // The harness's own segment-vs-slab test, so choosing a shelter spot does not
  // depend on the build under test having the helper. That independence is what
  // lets this same test run against an older build and report a real failure
  // instead of a ReferenceError.
  const losOwn = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0;
    for (const p of (game.mapData.platforms || [])) {
      if (!p || p.type === 'ground') continue;
      let t0 = 0, t1 = 1, ok = true;
      for (const [d, s0, lo, hi] of [[dx, x0, p.x, p.x + p.w], [dy, y0, p.y - 6, p.y + (p.h || 0) + 6]]) {
        if (Math.abs(d) < 1e-9) { if (s0 < lo || s0 > hi) { ok = false; break; } continue; }
        let a = (lo - s0) / d, b = (hi - s0) / d;
        if (a > b) { const t = a; a = b; b = t; }
        if (a > t0) t0 = a;
        if (b < t1) t1 = b;
        if (t0 > t1) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  };

  // ---------- #2: no telegraph under the floor ----------
  // Read from the live source of the AI function rather than a constants table,
  // because the timings ARE literals inside the pattern code.
  const src = String(bossAI);
  const fires = [...src.matchAll(/patternTimer > (\d+) && !m\._(\w+)/g)]
    .map((m) => ({ ms: +m[1], flag: m[2] }));
  out.fires = fires.sort((a, b) => a.ms - b.ms).slice(0, 6);
  out.minFire = fires.length ? Math.min(...fires.map((f) => f.ms)) : null;
  out.fireCount = fires.length;

  // ---------- #1: is the Soul Drain escape reachable? ----------
  out.hasLos = typeof _lxLosBlocked === 'function';
  if (out.hasLos) {
    const plats = (game.mapData.platforms || []).filter((p) => p.type !== 'ground');
    out.platCount = plats.length;
    const gy = (game.mapData.platforms || []).filter((p) => p.type === 'ground')[0].y;
    // Gravitos floor-pinned somewhere central; his centre is what the ray casts from.
    const bx = 700 + 340 / 2, by = (gy - 380) + 380 / 2;
    // sweep every standable surface: the ground line and each platform top
    const spots = [];
    for (let x = 60; x < game.mapData.worldWidth - 60; x += 20) spots.push({ x, y: gy - 44, where: 'ground' });
    for (const p of plats) {
      for (let x = p.x + 10; x < p.x + p.w - 10; x += 20) spots.push({ x, y: p.y - 44, where: 'ledge@' + p.y });
    }
    let safe = 0, exposed = 0; const safeWhere = {};
    for (const sp of spots) {
      const blocked = _lxLosBlocked(bx, by, sp.x + 14, sp.y + 22);
      if (blocked) { safe++; safeWhere[sp.where] = (safeWhere[sp.where] | 0) + 1; } else exposed++;
    }
    out.spots = spots.length; out.safe = safe; out.exposed = exposed;
    out.safeWhere = safeWhere;
    out.safePct = Math.round(100 * safe / Math.max(1, spots.length));
    // standing right next to him in the open must never be safe
    out.pointBlank = _lxLosBlocked(bx, by, bx + 90, by);
  }

  // ---------- #1b: the drain actually respects it, end to end ----------
  const drain = async (placeSafe) => {
    // Use the arena's OWN Gravitos. A hand-spawned one is inert here: its
    // patternTimer never advances and it never falls to the floor, because the
    // boss update is driven by the map's boss registration, not by presence in
    // game.monsters. Reusing the real boss also means this measures the real
    // fight object rather than a lookalike.
    const m = game.monsters.find((x) => x.type === 'gravitos');
    if (!m) return { noBoss: true };
    m.maxHp = m.currentHp = 9e9;
    player._god = false;
    player.hp = player.maxHp;
    const gy2 = (game.mapData.platforms || []).filter((p) => p.type === 'ground')[0].y;
    const plats = (game.mapData.platforms || []).filter((p) => p.type !== 'ground');
    if (placeSafe) {
      // find a spot the helper reports as blocked and stand there
      const bx = m.x + m.w / 2, by = m.y + m.h / 2;
      let found = null;
      for (const p of plats) {
        for (let x = p.x + 10; x < p.x + p.w - 10; x += 10) {
          if (losOwn(bx, by, x + 14, (p.y - 44) + 22)) { found = { x, y: p.y - 44 }; break; }
        }
        if (found) break;
      }
      if (!found) return { noSafeSpot: true };
      player.x = found.x; player.y = found.y;
    } else {
      player.x = m.x + m.w + 120; player.y = gy2 - player.h;   // open ground beside him
    }
    player.vx = 0; player.vy = 0;
    m.patternState = 'soulDrain'; m.patternTimer = 0;
    m._drainAnnounced = false; m._drainFired = false;
    const hp0 = player.hp;
    // The channel gate is patternTimer >= 1500 and the timer advances ~6.3 per
    // rendered frame, so the drain lands around frame 240. Budget well past it.
    for (let i = 0; i < 500; i++) {
      player.vx = 0; player.vy = 0;
      const px = player.x, py = player.y;
      await frame();
      player.x = px; player.y = py;      // hold station through the channel
      if (m._drainFired) break;
    }
    for (let i = 0; i < 8; i++) await frame();
    return { fired: !!m._drainFired, hpBefore: Math.round(hp0), hpAfter: Math.round(player.hp),
             drained: player.hp <= 1 };
  };
  game.paused = false;
  out.exposedRun = await drain(false);
  out.shelteredRun = await drain(true);

  // ---------- singularity floor, measured as behaviour ----------
  // The complaint was not "one-shots come too fast" — the shared gate already
  // spaces them 15-45s. It was that every one of them is Singularity. The three
  // one-shots share a picker that takes whichever timer is MOST overdue, and in
  // phase 3 Singularity's cooldown (9s) is the shortest, so it wins ~always.
  // Pin the shared gate wide open so the picker is the only thing deciding, then
  // read off which one-shot it actually chooses.
  out.singGap = (typeof _GRAV_SING_MIN_GAP === 'number') ? _GRAV_SING_MIN_GAP : null;
  {
    const m = game.monsters.find((x) => x.type === 'gravitos');
    const ONE = { singularity: 1, collapseRain: 1, soulDrain: 1 };
    const seq = []; let last = null;
    if (m) {
      for (let i = 0; i < 5000; i++) {
        m.maxHp = 1e6; m.currentHp = 1e5;        // hold phase 3
        m.aggro = true;
        m._instaTimer = 0; m._rainTimer = 0; m._soulTimer = 0;
        m._lastOhkoAt = -999999; m._ohkoGapRoll = 0;
        player.hp = player.maxHp = 9e8; player.mp = player.maxMp || 100;
        player.x = m.x + m.w + 90; player.y = m.y + m.h - player.h;
        await frame();
        if (m.patternState !== last) { if (ONE[m.patternState]) seq.push(m.patternState); last = m.patternState; }
      }
    }
    let run = 0, maxRun = 0;
    for (const n of seq) { run = (n === 'singularity') ? run + 1 : 0; if (run > maxRun) maxRun = run; }
    const sing = seq.filter((n) => n === 'singularity').length;
    out.oneShots = seq.length;
    out.singShare = seq.length ? Math.round(100 * sing / seq.length) : 0;
    out.maxRunSing = maxRun;
    out.seq = seq.slice(0, 10);
  }
  return out;
});
await browser.close();

console.log(`  telegraphs: ${r.fireCount} gated attacks, fastest ${r.minFire}ms — ${r.fires.map((f) => f.flag + ':' + f.ms).join(', ')}`);
console.log(`  LOS sweep: ${r.safe}/${r.spots} standable spots are sheltered (${r.safePct}%) — ${JSON.stringify(r.safeWhere)}`);
console.log(`  drain in the open:   ${JSON.stringify(r.exposedRun)}`);
console.log(`  drain behind cover:  ${JSON.stringify(r.shelteredRun)}`);
console.log(`  singularity floor: ${r.singGap} frames (${(r.singGap / 60).toFixed(0)}s)`);

check(r.fireCount >= 8, 'the telegraph survey found the boss attacks', r.fireCount);
check(r.minFire >= 350, 'no boss attack fires on a telegraph under 350ms', { fastest: r.minFire, worst: r.fires });
check(r.hasLos, 'the line-of-sight helper exists', r.hasLos);
// The escape must be REACHABLE — the whole point of the change.
check(r.safe > 0, 'Soul Drain has sheltered spots the player can actually stand in', { safe: r.safe, of: r.spots });
check(r.safePct >= 5 && r.safePct <= 70, 'and shelter is meaningful but not everywhere (it is a skill check, not a freebie)', r.safePct);
check(r.pointBlank === false, 'standing next to him in the open is never sheltered', r.pointBlank);
check(!!(r.exposedRun && r.exposedRun.fired && r.exposedRun.drained), 'caught in the open, the drain still takes you to 1 HP', r.exposedRun);
check(!!(r.shelteredRun && r.shelteredRun.fired && !r.shelteredRun.drained), 'behind cover, the drain resolves and does NOT drain you', r.shelteredRun);
check(r.singGap != null && r.singGap >= 15 * 60, 'Singularity has a hard recast floor well above its 9s cooldown', r.singGap);
check(r.oneShots >= 2, 'the one-shot survey saw the boss commit to its big attacks', r.oneShots);
// The regression this guards: base picks Singularity 6/6 times, six in a row.
check(r.maxRunSing <= 1, 'Singularity never fires twice in a row', { maxRun: r.maxRunSing, seq: r.seq });
check(r.singShare <= 60, 'Singularity is no longer the majority of the late fight', { pct: r.singShare, seq: r.seq });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
