import { writeFileSync as _wfShot } from 'node:fs';
// The OHKO pass: no parry, the zone is the counter, quiet around the collapse,
// and Gravitos's comets seal healing with a visible status.
// ============================================================================
// Per user: "ensure that the OHKO attack cannot be parried, ensure that it
// can be properly evaded by going into the safe zone, space out attacks such
// that there is no continuous attacks from the boss during and right after
// the OHKO attacks" + "for gravitos make some specific projectiles prevent
// healing effects when land - make sure to have a status that tells players
// that they are heal locked".
//
//   1. PARRY: with the parry window armed (_ohkoParry > 0) and the player
//      outside every zone, the collapse still lands (baseline: negated)
//   2. ZONE: standing in the zone survives (control - the counter works)
//   3. SOVEREIGN QUIET AFTER: with volley + drain due, nothing fires for
//      2 s after the collapse resolves (baseline: fires within ~1 s)
//   4. GRAVITOS QUIET AFTER: after the singularity pattern ends, the regular
//      pattern picker holds for >= 2 s (baseline: idle picks the next pattern
//      as soon as cycleBase elapses, ~0.65-1.1 s)
//   5. HEAL LOCK: a comet landing seals healing - a direct hp raise is
//      refused, a potion is refused, hp can still go DOWN, and the seal
//      expires (baseline: no lock)
//   6. STATUS: while sealed the buff bar shows a HEAL LOCKED pill
//   7. CONTROL: an unlocked player heals normally afterwards
// Run: node scripts/ohko_pass_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/ohko_pass_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });

const PORT = Number(process.env.PORT || 11561);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.classList.add('fade'); });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  try { loadMap('forest'); game.paused = false; player._god = true; } catch (e) {}
  await sleep(1200);
  game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
  const floor = player.y + player.h;
  const MH = getMaxHp();
  // a phase-1 Gravitos far away: a collapse hit is the survivable -99% branch
  const gv = spawnMonster(player.x + 900, player.y, 'gravitos', true);
  await sleep(3600); game.paused = false;
  if (gv) { gv.phase = 1; gv.speed = 0; }
  const hold = () => { if (gv) { gv.x = player.x + 900; gv.y = player.y; } };
  // rows 1-2 only: the boss present (the resolver reads its phase for the
  // -99% branch) but doing nothing - its singularity exit scrubs EVERY
  // singularity hazard, the stand-in included, before it can resolve.
  const inert = () => { hold(); if (gv) { gv.patternState = 'idle'; gv.patternTimer = 0; gv._sgSpawned = false; gv._instaTimer = 99999; gv._rainTimer = 99999; gv._soulTimer = 99999; gv._ohkoQueued = null; gv._ohkoWarnUntil = null; } };

  const resolveWith = async (zones, place, armParry) => {
    game.hazards = game.hazards.filter((h) => h.type !== 'gravitos_singularity');
    const h = { type: 'gravitos_singularity', x: 0, y: 0, w: 4000, h: 2000, cx: player.x + 400, cy: floor - 200,
                life: 60, maxLife: 210, atk: 99999, safeZones: zones };   // life to spare: the run-up must never reach 0 on its own
    game.hazards.push(h);
    player._god = true; player.hp = MH; player.invulnerable = 0;
    // A fixed run-up. Counting life down to 1 raced the tick: a double-tick frame took it 2 -> 0 and the
    // collapse resolved under god mode before the parry was armed - the flaky 'no damage' with no resolver stamp.
    for (let f = 0; f < 12; f++) { place(); inert(); game.paused = false; await sleep(16); }
    place();
    player._ohkoParry = armParry ? 250 : 0;
    player._god = false;
    const hp0 = player.hp;
    // A hit during the run-up grants 1000 ms of i-frames, and the resolver's
    // PHASED branch (invulnerable >= 900) drops to 1 HP instead of killing -
    // a costed clutch, not the parry under test. Zero it at the resolve.
    player.invulnerable = 0; player.hitStun = 0;
    game.hitStop = 0;   // a pending hit-stop holds the world tick for up to 150 ms
    h.life = 1; game.paused = false;
    let resolvedIn = null;
    for (let f = 0; f < 90; f++) { inert(); game.paused = false; await sleep(16); if (!game.hazards.includes(h)) { resolvedIn = f + 1; break; } }
    const frac = player.hp / hp0;
    player._god = true; player._ohkoParry = 0;
    return { hit: frac < 0.5, frac: +frac.toFixed(3), resolvedIn, resolverRan: (player.invulnerable | 0) >= 500, gvState: gv ? gv.patternState : null, gvPhase: gv ? gv.phase : null, hazardsAfter: game.hazards.map((x) => x.type).join(',') };
  };
  const zoneAtPlayer = { x: player.x - 30, y: floor - 70, w: 100, h: 70 };
  const farZone = { x: player.x + 600, y: floor - 70, w: 100, h: 70 };
  const stand = () => { player.x = zoneAtPlayer.x + 35; player.y = floor - player.h; player.vx = 0; player.vy = 0; };
  // 1. parry armed, no zone under the player -> must still be hit
  out.parry = await resolveWith([farZone], stand, true);
  // 2. standing in the zone -> survives
  out.zone = await resolveWith([zoneAtPlayer], stand, false);

  // 4. GRAVITOS quiet after: run the real singularity pattern to its end, then time the next pattern
  player._god = true; player.hp = MH;
  if (gv) {
    // The COLLAPSE RAIN is the case with no quiet at all on the old build: the
    // 8 s trail is measured from the CAST, and a rain runs ~17 s, so its next
    // pattern could start within cycleBase (~0.65-1.1 s) of the last box.
    // (The singularity was already ~2.2 s quiet by the same arithmetic, so it
    // cannot discriminate.) Enter the rain at its last tick with the cast
    // stamped 20 s ago, exactly the state a real rain leaves behind.
    gv.patternState = 'collapseRain'; gv._rainIdx = 4; gv.patternTimer = 17000;
    gv._ohkoWarnUntil = null; gv._ohkoQueued = null;
    gv._instaTimer = 99999; gv._rainTimer = 99999; gv._soulTimer = 99999;   // no further OHKO queues
    gv._lastOhkoAt = (game.time | 0) - 1200; gv._lastSkillAt = -999999;
    let endedAt = null, nextAt = null;
    for (let f = 0; f < 700; f++) {
      hold(); game.paused = false; await sleep(16);
      if (endedAt == null && gv.patternState !== 'collapseRain') endedAt = game.time | 0;
      if (endedAt != null && gv.patternState !== 'idle') { nextAt = game.time | 0; break; }
      if (endedAt != null && (game.time | 0) - endedAt > 600) break;   // 10 s of quiet is enough to prove it
    }
    out.gravQuiet = { spawned: true, ended: endedAt != null, gapFrames: (nextAt != null && endedAt != null) ? nextAt - endedAt : null, next: gv.patternState };
    gv.patternState = 'idle'; gv.patternTimer = 0;
  }

  // 5-7. HEAL LOCK via a comet landing
  game.projectiles.length = 0; game.hazards.length = 0;
  player._god = false; player.hp = MH; player.invulnerable = 0;
  // Pick a raw damage whose mitigated loss (the live armour model + difficulty
  // curve, the same two calls the impact path makes) lands between 1 and 40%
  // of max HP: a 400 stand-in killed a fresh character and the death watchdog
  // respawned into the Void six seconds later - mid-way through the Sovereign
  // telegraph, on both builds. The comet must land; it must never kill.
  const _est = (d) => { try { return _diffDmg(Math.max(1, Math.floor(d * (typeof _defAbsorbMul === 'function' ? _defAbsorbMul(1) : 1)))); } catch (e) { return d; } };
  let cometDmg = 400;
  for (const d of [400, 300, 200, 150, 100, 60, 40, 25, 15, 8, 4, 2]) { cometDmg = d; if (_est(d) <= MH * 0.4) break; }
  // A real comet carries m.atk * 1.5 and a phase band with a 25% floor; a
  // 1-damage stand-in was zeroed by DEF before the impact path ran, so the
  // "landing" never counted. Give it real damage, and clear it after the hit
  // so nothing else moves hp during the heal probes.
  const comet = { x: player.x + player.w / 2 - 27, y: player.y + player.h / 2 - 27, vx: 0, vy: 0, w: 54, h: 54, life: 60,
                  damage: cometDmg, owner: 'enemy', skill: 'comet', color: '#cc66ff', noGravity: true, homing: false, stunHit: 0 };
  // stamp what the live push stamps, if this build stamps it
  const src = (typeof _lxHealLockApply === 'function');
  if (src) { comet._healLockMs = 10000; comet._sourceLabel = 'a Gravitos comet'; }   // what the live push stamps (10 s per user; the chain greps the push site)
  game.projectiles.push(comet);
  for (let f = 0; f < 20 && game.projectiles.includes(comet); f++) { hold(); game.paused = false; await sleep(16); }
  game.projectiles.length = 0; player.invulnerable = 0;
  const lockedNow = (typeof _lxHealLocked === 'function') ? _lxHealLocked() : false;
  const hpAfterHit = player.hp;
  player.hp = hpAfterHit + 200;                       // a direct heal
  const healedDirect = player.hp - hpAfterHit;
  if (!player.consumables) player.consumables = {};
  player.consumables.hp_small = 3;
  const hpBeforePotion = player.hp;
  try { useConsumable('hp_small'); } catch (e) {}
  await sleep(50);
  const healedPotion = player.hp - hpBeforePotion;
  player.hp = player.hp - 50;                        // damage must still apply
  const wentDown = player.hp === hpBeforePotion + healedPotion - 50;
  const pill = !!document.querySelector('.moji-buff-pill[data-buff="healLock"]');
  const pillText = (document.querySelector('.moji-buff-pill[data-buff="healLock"] .buff-label') || {}).textContent || '';
  // OVERHEAD COUNTDOWN (per user): the label and the tenths are separate
  // fillTexts on the main canvas while sealed, and the tenths tick down.
  // God mode keeps a stray hit from moving hp under the later probes; the
  // seal does not read it.
  player._god = true;
  const _oft = CanvasRenderingContext2D.prototype.fillText;
  window._hlDrawn = [];
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, mw) { if (this === ctx) { window._hlDrawn.push(String(t)); if (t === 'HEAL LOCK') { const m = this.getTransform(); window._hlPos = { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; } } return _oft.call(this, t, x, y, mw); };
  const _snap = async () => {
    window._hlDrawn.length = 0; hold(); game.paused = false; await sleep(60);
    const d = window._hlDrawn.slice(); const i = d.indexOf('HEAL LOCK');
    return { label: i >= 0, secs: (i >= 0 && /^[0-9]+[.][0-9]s$/.test(d[i + 1] || '')) ? parseFloat(d[i + 1]) : null };
  };
  const ohA = await _snap(); await sleep(700); const ohB = await _snap();   // the crop comes after the hit number has faded
  try {   // a crop of the live frame around the label, for a look at the thing itself
    const _cv = ctx.canvas, _k = _cv.width / (typeof W === 'number' && W > 0 ? W : _cv.width);
    const _p = window._hlPos || { x: 160, y: 120 };
    const _oc = document.createElement('canvas'); _oc.width = 320; _oc.height = 200;
    _oc.getContext('2d').drawImage(_cv, _p.x - 120 * _k, _p.y - 70 * _k, 320 * _k, 200 * _k, 0, 0, 320, 200);   // _hlPos is already in device pixels
    out._shot = _oc.toDataURL('image/png');
  } catch (e) { out._shot = null; }
  const lockF = (player._healLockUntil | 0) - (player._healLockAt | 0);
  // expiry: jump the clock past the seal
  if (player._healLockUntil) game.time = (player._healLockUntil | 0) + 5;
  const hpBeforeLate = player.hp;
  player.hp = hpBeforeLate + 120;
  const healedLate = player.hp - hpBeforeLate;
  const ohC = await _snap();
  CanvasRenderingContext2D.prototype.fillText = _oft;
  out.heal = { lockedNow, healedDirect, healedPotion, wentDown, pill, pillText, healedLate, until: player._healLockUntil | 0, cometDmg, lost: MH - hpAfterHit, maxHp: MH, died: !!game.dying || player.hp <= 0, lockF, overhead: { a: ohA, b: ohB, afterExpiry: ohC } };
  player._god = true; player.hp = MH;
  game.monsters.length = 0;

  // 3. SOVEREIGN quiet after the collapse
  const m = spawnMonster(player.x + 700, player.y, 'towerSovereign', true);
  if (m) {
    await sleep(3600); game.paused = false;
    m._expeditionFinalBoss = true; m._sovPhase = 1; m._sovShielded = false; m._sovExposedUntil = 0; m._sovSpentUntil = 0;
    const t0 = game.time | 0;
    m._sovereignOhkoTick = t0; m._sovereignHomingAt = t0; m._sovereignDrainAt = t0;
    game.hazards.length = 0; game.projectiles.length = 0;
    let hz = null;
    for (let i = 0; i < 30 && !hz; i++) { game.paused = false; m.x = player.x + 700; m.y = player.y; await sleep(35); hz = game.hazards.find((x) => x.type === 'gravitos_singularity'); }
    if (hz) {
      // Let the telegraph run to its NATURAL resolve. Forcing life to 2 right
      // after the cast made the baseline look quiet too: its timers were
      // pushed 60 frames past a resolve that was still 300 frames away.
      player._god = true;
      let resolvedAt = null, firstAttackAt = null;
      for (let f = 0; f < 700; f++) {
        m.x = player.x + 700; m.y = player.y; m._sovSpentUntil = 0;   // SPENT would mute the volley on its own; remove it so only the quiet window speaks
        game.paused = false; await sleep(16);
        if (resolvedAt == null && !game.hazards.includes(hz)) resolvedAt = game.time | 0;
        if (resolvedAt != null && firstAttackAt == null) {
          const atk = game.projectiles.some((p) => p.owner === 'enemy') || game.hazards.some((x) => x.type === 'sovereign_drain_pillar');
          if (atk) firstAttackAt = game.time | 0;
        }
        if (firstAttackAt != null || (resolvedAt != null && (game.time | 0) - resolvedAt > 400)) break;
      }
      out.sovQuiet = { resolved: resolvedAt != null, gapFrames: (firstAttackAt != null && resolvedAt != null) ? firstAttackAt - resolvedAt : null,
        state: { castToResolve: resolvedAt != null ? resolvedAt - t0 : null, map: game.currentMap, bossInList: game.monsters.includes(m), homingIn: (m._sovereignHomingAt | 0) - (resolvedAt | 0), drainIn: (m._sovereignDrainAt | 0) - (resolvedAt | 0), quietIn: (m._sovCollapseUntil | 0) - (resolvedAt | 0) } };
    } else out.sovQuiet = { err: 'sovereign collapse never fired' };
    game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
  }
  return out;
});
await browser.close(); server.kill();

console.log(`  parry armed, out of zone: hit=${R.parry.hit} (hp ${R.parry.frac}, resolved in ${R.parry.resolvedIn} frames, resolver ran ${R.parry.resolverRan}, gravitos ${R.parry.gvState}/p${R.parry.gvPhase}, hazards after [${R.parry.hazardsAfter}])   in zone: hit=${R.zone.hit}`);
console.log(`  sovereign quiet: ${JSON.stringify(R.sovQuiet)}   gravitos quiet: ${JSON.stringify(R.gravQuiet)}`);
if (R._shot && process.env.MOJI_SHOT) { try { _wfShot(process.env.MOJI_SHOT, Buffer.from(R._shot.split(',')[1], 'base64')); console.log('  overhead crop -> ' + process.env.MOJI_SHOT); } catch (e) { console.log('  overhead crop failed: ' + e.message); } }
delete R._shot;
console.log(`  heal lock: ${JSON.stringify(R.heal)}`);
if (R.heal && R.heal.died) console.log('  !! the comet probe KILLED the player - later rows are not trustworthy');
ok('the collapse cannot be parried (parry armed, outside every zone: still hit)', R.parry.hit, `hp ${R.parry.frac} (baseline: PARRIED, no damage)`);
ok('CONTROL: standing in the safe zone survives', !R.zone.hit);
ok('Sovereign: no volley / pillar for 2 s after the collapse resolves',
   R.sovQuiet && R.sovQuiet.resolved && (R.sovQuiet.gapFrames == null || R.sovQuiet.gapFrames >= 110),
   R.sovQuiet ? `first attack ${R.sovQuiet.gapFrames == null ? 'none in 400f' : R.sovQuiet.gapFrames + 'f'} after resolve (timers: patched +150f, baseline +60f; the volley pose adds ~44f)` : 'no data');
ok('Gravitos: the regular rotation holds >= 2 s after a collapse rain ends',
   R.gravQuiet && R.gravQuiet.spawned && R.gravQuiet.ended && (R.gravQuiet.gapFrames == null || R.gravQuiet.gapFrames >= 110),
   R.gravQuiet ? `next pattern ${R.gravQuiet.gapFrames == null ? 'none within 10 s' : R.gravQuiet.gapFrames + 'f'} after the hazard resolved -> ${R.gravQuiet.next}` : 'no data');
ok('a comet landing seals healing: direct heal refused, potion refused, damage still lands, seal expires',
   R.heal.lockedNow && R.heal.healedDirect === 0 && R.heal.healedPotion <= 0 && R.heal.wentDown && R.heal.healedLate > 0,
   `locked ${R.heal.lockedNow}, direct +${R.heal.healedDirect}, potion +${R.heal.healedPotion}, down ${R.heal.wentDown}, after expiry +${R.heal.healedLate}`);
ok('STATUS: the buff bar shows a HEAL LOCKED pill while sealed', R.heal.pill && /heal/i.test(R.heal.pillText), `pill ${R.heal.pill} "${R.heal.pillText}"`);
ok('CONTROL: healing works again once the seal expires', R.heal.healedLate > 0, `+${R.heal.healedLate}`);
ok('the seal lasts 10 s', R.heal.lockF >= 590 && R.heal.lockF <= 620, `${R.heal.lockF} frames (baseline: no seal)`);
{
  const o = R.heal.overhead || {}, a = o.a || {}, b = o.b || {};
  ok('COUNTDOWN: HEAL LOCK and the tenths draw over the character while sealed, and tick down',
     a.label && a.secs != null && b.secs != null && b.secs < a.secs,
     `label ${a.label}, ${a.secs}s then ${b.secs}s ~0.7 s later (baseline: nothing drawn)`);
  ok('CONTROL: the countdown is gone once the seal expires', !(o.afterExpiry || {}).label, `label after expiry: ${(o.afterExpiry || {}).label}`);
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
