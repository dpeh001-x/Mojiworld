// Octobaby's phase 2 is an EVENT, per user ("For #4 can help implement with
// octobaby") and the Dead Cells lesson behind it.
//
// The old 50% mark was a toast, a flash and `m.speed = 0.6`: the same attacks
// kept coming at nearly the same rate, so the phase existed only as a number.
// The bar this has to clear is that the fight actually CHANGES — the head goes
// untouchable and silent, the legs leave their orbit and hunt, the head returns
// somewhere else, and a new attack exists afterwards that did not before.
// Every one of those is checked against the live boss.
// Run: node scripts/octobaby_phase_event_test.mjs [file.html]
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
  player.level = 90;
  loadMap('octopusGrotto');
});
await page.waitForTimeout(9000);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};
  const head = game.monsters.find((x) => x.type === 'octobaby');
  if (!head) return { noBoss: true, saw: [...new Set(game.monsters.map((x) => x.type))] };
  const legs = game.monsters.filter((x) => /^octoLeg/.test(x.type));
  out.legCount = legs.length;
  player.hp = player.maxHp = 9e8; player._god = false;
  // Far enough that "the legs left their orbit" is unambiguous: if the player
  // stands near the head, legs converging on the player are still near the head
  // and the two states are not distinguishable by distance.
  player.x = head.x - 650; player.y = head.y;

  // Record every projectile at the moment it is created. Polling
  // game.projectiles misses the sweep entirely: it spawns at floor level right
  // where the player is standing, collides on its first frame, and is spliced
  // out before any poll can see it — so the array says "never fired" about an
  // attack that fired and connected.
  const pushed = [];
  const _origPush = game.projectiles.push.bind(game.projectiles);
  game.projectiles.push = function (...a) {
    for (const x of a) if (x) pushed.push({ skill: x.skill, w: x.w, h: x.h, vx: x.vx, y: x.y, h2: x.h });
    return _origPush(...a);
  };

  const legSpread = () => {
    const xs = legs.map((l) => l.x + l.w / 2);
    return Math.round(Math.max(...xs) - Math.min(...xs));
  };
  // How far the legs sit from the head — the orbit signature.
  const legDistFromHead = () => Math.round(legs.reduce((acc, l) =>
    acc + Math.hypot((l.x + l.w / 2) - (head.x + head.w / 2), (l.y + l.h / 2) - (head.y + head.h / 2)), 0) / legs.length);
  const legDistFromPlayer = () => Math.round(legs.reduce((acc, l) =>
    acc + Math.hypot((l.x + l.w / 2) - (player.x + player.w / 2), (l.y + l.h / 2) - (player.y + player.h / 2)), 0) / legs.length);

  // ---------- before the transition ----------
  let projBefore = 0;
  for (let i = 0; i < 260; i++) {
    head.currentHp = head.maxHp * 0.9;       // hold above the 50% line
    player.hp = player.maxHp;
    await frame();
    projBefore += game.projectiles.filter((p) => p.owner === 'enemy').length;
  }
  out.before = { legOrbit: legDistFromHead(), legToPlayer: legDistFromPlayer(), spread: legSpread(),
                 headX: Math.round(head.x), enraged: !!head._enraged };
  out.sweepBefore = pushed.some((p) => p.skill === 'tidalSweep');

  // ---------- trip the transition ----------
  head.currentHp = head.maxHp * 0.4;
  const trace = [];
  let immuneFrames = 0, headShotsDuringEvent = 0, sankTo = 0;
  let frenzyLegToPlayer = 1e9, frenzyLegOrbit = 0;
  const startX = head.x;
  // Only the HEAD's own attacks count below. Filtering on owner === 'enemy'
  // instead counts the legs, which are SUPPOSED to be firing during the frenzy,
  // and reports it as "the submerged head is still shooting".
  const HEADSK = (p) => p.skill === 'bubble' || p.skill === 'octoHead';
  // Wait on the STATE, not on a frame count. The event advances on real dt, and
  // ms-per-frame swings with machine load — a fixed budget that comfortably
  // reached beat 3 on one run stalled in beat 2 on the next, which looks exactly
  // like a stuck boss and is not.
  let sawBeat3 = false;
  for (let i = 0; i < 4000; i++) {
    if (sawBeat3 && !(head._octoEvt | 0)) break;
    if ((head._octoEvt | 0) === 3) sawBeat3 = true;
    head.currentHp = head.maxHp * 0.4;
    player.hp = player.maxHp;
    const before = game.projectiles.filter(HEADSK).length;
    await frame();
    const evt = head._octoEvt | 0;
    if (evt) {
      immuneFrames += (head.invulnerable > 0) ? 1 : 0;
      const after = game.projectiles.filter(HEADSK).length;
      if (after > before) headShotsDuringEvent++;
      sankTo = Math.max(sankTo, Math.round(head._octoSink || 0));
    }
    if (evt === 2) {
      frenzyLegToPlayer = Math.min(frenzyLegToPlayer, legDistFromPlayer());
      frenzyLegOrbit = Math.max(frenzyLegOrbit, legDistFromHead());
    }
    if (!trace.length || trace[trace.length - 1][0] !== evt) trace.push([evt, i]);
  }
  out.trace = trace;
  out.immuneFrames = immuneFrames;
  out.headShotsDuringEvent = headShotsDuringEvent;
  out.sankTo = sankTo;
  out.frenzy = { legToPlayer: frenzyLegToPlayer === 1e9 ? null : frenzyLegToPlayer, legOrbit: frenzyLegOrbit };
  out.movedArena = Math.round(Math.abs(head.x - startX));
  out.after = { legOrbit: legDistFromHead(), evt: head._octoEvt | 0, immune: head.invulnerable | 0 };

  // ---------- the new move must actually fire ----------
  let sawSweep = false;
  head._octoSweepT = 30;                      // bring the first one forward
  for (let i = 0; i < 700 && !sawSweep; i++) {
    head.currentHp = head.maxHp * 0.4;
    player.hp = player.maxHp;
    await frame();
    sawSweep = pushed.some((p) => p.skill === 'tidalSweep');
  }
  out.sawSweep = sawSweep;
  const sw = pushed.find((p) => p.skill === 'tidalSweep');
  if (sw) {
    const gy = (game.mapData.platforms || []).filter((p) => p.type === 'ground')[0];
    out.sweep = { w: sw.w, h: sw.h, vx: +sw.vx.toFixed(1),
                  aboveGround: gy ? Math.round(gy.y - (sw.y + sw.h2)) : null };
  }
  game.projectiles.push = _origPush;
  return out;
});
await browser.close();

console.log(`  legs: ${r.legCount}   before: ${JSON.stringify(r.before)}`);
console.log(`  event trace (state,frame): ${JSON.stringify(r.trace)}`);
console.log(`  during: immuneFrames=${r.immuneFrames} headShots=${r.headShotsDuringEvent} sank=${r.sankTo}px  frenzy=${JSON.stringify(r.frenzy)}`);
console.log(`  after: movedArena=${r.movedArena}px ${JSON.stringify(r.after)}   sweep=${JSON.stringify(r.sweep || null)}`);

check(!r.noBoss, 'Octobaby is in the arena', r.saw);
check(r.legCount === 4, 'all four tentacles are present', r.legCount);
// The transition must be a real sequence, not an instant flag flip.
check(r.trace.some((t) => t[0] === 1) && r.trace.some((t) => t[0] === 2) && r.trace.some((t) => t[0] === 3),
      'the transition plays all three beats: submerge, frenzy, surface', r.trace);
check(r.immuneFrames > 60, 'the head is untouchable while it is submerged', r.immuneFrames);
check(r.headShotsDuringEvent === 0, 'and it fires nothing while submerged', r.headShotsDuringEvent);
check(r.sankTo >= 40, 'the submerge is visible, not just a flag', r.sankTo);
// The arena change: legs leave orbit and close on the player.
check(r.frenzy.legToPlayer !== null && r.frenzy.legToPlayer < r.before.legToPlayer,
      'the tentacles break orbit and close on the player', { frenzy: r.frenzy.legToPlayer, before: r.before.legToPlayer });
check(r.frenzy.legOrbit > r.before.legOrbit * 1.5,
      'and they genuinely leave the head, not just drift', { frenzy: r.frenzy.legOrbit, orbit: r.before.legOrbit });
check(r.movedArena > 400, 'the head surfaces somewhere else entirely', r.movedArena);
check(r.after.evt === 0 && r.after.immune === 0, 'the event ends and the boss is hittable again', r.after);
check(Math.abs(r.after.legOrbit - r.before.legOrbit) < r.before.legOrbit * 0.5,
      'the tentacles snap back into formation afterwards', { after: r.after.legOrbit, before: r.before.legOrbit });
// The new move.
check(r.sweepBefore === false, 'TIDAL SWEEP does not exist before the transition', r.sweepBefore);
check(r.sawSweep === true, 'TIDAL SWEEP fires after it', r.sawSweep);
check(!!(r.sweep && r.sweep.aboveGround !== null && Math.abs(r.sweep.aboveGround) < 40),
      'and it travels at floor level, so jumping is the answer', r.sweep);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
