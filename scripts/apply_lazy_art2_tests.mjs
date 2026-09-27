// Lazy art 2, test half (v0.30.x lazy-art2). Game half: apply_lazy_art2.mjs.
// ============================================================================
// Runs as LX_APPLY2 after the ship pipeline re-syncs these files from origin. Never touches mojiworld_game.html.
// Monster, NPC, tile and prop sheets now load for the map the player is on and its portal neighbours (and when a
// monster spawns, a draw finds no sheet, or a dex portrait needs one), and the world streamer warms only the current
// map and its neighbours. Suites that assumed every sheet arrives at boot now ask for exactly the sheets they inspect,
// the way the game does; the streamer suite checks the new reach. On an eager build (no _lxArt2Want) every inserted
// line is a no-op and the old checks run.
//  - scripts/echoknight_plant_test.mjs: asks for the six monsters it measures and waits for all six sheets (it waited on
//    Echo Knight's only, from the boot burst) and for the boot image hold to let go, which that burst implied.
//  - scripts/monster_sprite_heal_test.mjs: asks for every monster sheet right after load - the boot burst this test
//    reproduces (two blocked types, the loader's backoff retry and the draw-time heal) - before waiting on 80 of them.
//  - scripts/mob_float_clamp_test.mjs: a survey of every loaded monster sheet - asks for all of them and waits for them.
//  - scripts/world_stream_test.mjs: "ALL maps warmed" and "every monster type's frames requested" become "only this map and
//    its portal neighbours warmed, not the world" and "no every-monster-type sweep" (and it no longer waits 260 s for a
//    sweep that does not come); the projectile / FX / summon checks are unchanged.
// Left alone (they fail on origin already, identically with and without lazy-art2): see the ship notes.
// Idempotent per file; once() count guards; atomic tmp + rename. EOL-aware.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.env.LX_TESTS_ROOT || 'C:/Users/dpeh0/Mojiworld';
const TAG = 'v0.30.x lazy-art2';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const eolOf = (s) => ((s.match(/\r\n/g) || []).length > (s.match(/\n/g) || []).length / 2 ? '\r\n' : '\n');
function atomicWrite(F, s) {
  fs.writeFileSync(F + '.tmp', s, 'utf8');
  if (fs.readFileSync(F + '.tmp', 'utf8') !== s) die('tmp readback differs: ' + F);
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { fs.renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code + ' ' + F);
}
// patch(rel, lo, hi, fn): fn gets { once, J }; skipped when the file already carries the lazy-art2 mark
function patch(rel, lo, hi, fn) {
  if (/mojiworld_game\.html$/.test(rel)) die('never the game file');
  const F = path.join(ROOT, rel);
  if (!fs.existsSync(F)) die(rel + ' missing under ' + ROOT);
  let s = fs.readFileSync(F, 'utf8');
  if (/v0\.30\.(?:x|\d+) lazy-art2/.test(s)) { console.log('  ' + rel + ': already applied'); return; }
  const s0 = s, EOL = eolOf(s), J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  fn({ once, J });
  const grew = s.length - s0.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  atomicWrite(F, s);
  console.log('  ' + rel + ': applied (+' + grew + ' chars)');
}
console.log('lazy-art2 tests: ROOT ' + ROOT);
const SIX = "['echoKnight', 'boneGolem', 'grumpsquid', 'seastar', 'future_lyra', 'slime']";

patch('scripts/echoknight_plant_test.mjs', 500, 1500, ({ once, J }) => {
  const W = 'await page.waitForFunction(() => MONSTER_SPRITE_META.echoKnight && MONSTER_SPRITE_META.echoKnight.bboxBottomY != null, null, { timeout: 60000 });';
  once(W, J(
    "await page.evaluate(() => { if (typeof _lxArt2WantMon === 'function') for (const t of " + SIX + ") _lxArt2WantMon(t, true); });   // " + TAG + ' - a monster sheet loads when wanted: ask for the six measured below',
    W,
    '// ' + TAG + ' - and the boot image hold has let go (the menu is up): the old wait for the boot burst implied it, and',
    '// until then the attack frames the spawn below builds are queued behind the title',
    'await page.waitForFunction(() => ' + SIX + '.every((t) => MONSTER_SPRITES[t] && MONSTER_SPRITES[t].naturalWidth > 0 && MONSTER_SPRITE_META[t])',
    '  && (!window._lxBootHold || window._lxBootHold.stats().open), null, { timeout: 90000 });'),
    'the Echo Knight sheet wait');
});

patch('scripts/monster_sprite_heal_test.mjs', 200, 600, ({ once, J }) => {
  const W = '  await page.waitForFunction(() => Object.keys(MONSTER_SPRITES).length >= 80, null, { timeout: 90000 });';
  once(W, J(
    "  await page.evaluate(() => { if (typeof _lxArt2Want === 'function') for (const t of MONSTER_SPRITE_TYPES) _lxArt2Want('mon:' + t); });   // " + TAG + ' - sheets load when wanted: ask for all, the boot burst this test reproduces',
    W), 'the boot-burst wait');
});

patch('scripts/world_stream_test.mjs', 500, 1500, ({ once, J }) => {
  once('  const t0 = Date.now();', J(
    "  const LAZY2 = await page.evaluate(() => typeof _lxArt2Want === 'function');   // " + TAG + ' - the streamer warms this map and its portal neighbours only',
    '  const t0 = Date.now();'), 'the sweep timer');
  once('  }, null, { timeout: 260000, polling: 1000 }).catch(() => {});',
    '  }, null, { timeout: LAZY2 ? 15000 : 260000, polling: 1000 }).catch(() => {});   // ' + TAG, 'the all-maps wait');
  once('  ok(`ALL maps warmed in background', J(
    '  if (LAZY2) ok(`only this map and its portal neighbours warmed, not the world (${maps.warmed}/${maps.total})`, maps.warmed > 0 && maps.warmed <= 12, maps);   // ' + TAG,
    '  else ok(`ALL maps warmed in background'), 'the all-maps check');
  once('    null, { timeout: 60000, polling: 1000 }).catch(() => {});',
    '    null, { timeout: LAZY2 ? 1000 : 60000, polling: 1000 }).catch(() => {});   // ' + TAG, 'the monster-frames wait');
  const M = "  ok('every monster type\\'s anim frames requested', regs.monFrames >= regs.monTypes * 0.95, regs);";
  once(M, J(
    "  if (LAZY2) ok('no every-monster-type sweep: frames only for the monsters met (' + regs.monFrames + ' of ' + regs.monTypes + ')', regs.monFrames < regs.monTypes * 0.5, regs);   // " + TAG,
    '  else' + M.slice(1)), 'the monster-frames check');
});
patch('scripts/mob_float_clamp_test.mjs', 250, 800, ({ once, J }) => {
  const W = 'await page.waitForTimeout(7000);';
  once(W, J(
    "await page.evaluate(() => { if (typeof _lxArt2Want === 'function') for (const t of MONSTER_SPRITE_TYPES) _lxArt2Want('mon:' + t); });   // " + TAG + ' - sheets load when wanted: this survey reads them all',
    W,
    "await page.waitForFunction(() => typeof _lxArt2Want !== 'function' || MONSTER_SPRITE_TYPES.every((t) => MONSTER_SPRITES[t]), null, { timeout: 90000 }).catch(() => {});   // " + TAG), 'the settle wait');
});
console.log('lazy-art2 tests: done');
