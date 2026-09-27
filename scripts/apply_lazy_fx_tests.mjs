// Lazy FX, test half (v0.30.x lazy-fx). Game half: apply_lazy_fx.mjs.
// ============================================================================
// Runs as LX_APPLY2 after the ship pipeline re-syncs these files from origin. Never touches mojiworld_game.html.
// Skill effects, projectiles, summons and gear icons are now parked until the character, the map in play, a cast or a
// draw asks for them, and the world streamer's phase 1 no longer requests every projectile / effect / summon animation
// set. Suites that assumed every set streams in after the world opens check the new contract instead. On an eager build
// (no _lxFxWant) every inserted line is a no-op and the old checks run.
//  - scripts/world_stream_test.mjs: "all projectile anim sets requested", "all FX anim sets requested" and "summon anim
//    sets requested" become "no every-set sweep" checks (sets only for what is in play).
// Idempotent per file; once() count guards; atomic tmp + rename. EOL-aware.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.env.LX_TESTS_ROOT || 'C:/Users/dpeh0/Mojiworld';
const TAG = 'v0.30.x lazy-fx';
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
// patch(rel, lo, hi, fn): fn gets { once, J }; skipped when the file already carries the lazy-fx mark
function patch(rel, lo, hi, fn) {
  if (/mojiworld_game\.html$/.test(rel)) die('never the game file');
  const F = path.join(ROOT, rel);
  if (!fs.existsSync(F)) die(rel + ' missing under ' + ROOT);
  let s = fs.readFileSync(F, 'utf8');
  if (/v0\.30\.(?:x|\d+) lazy-fx/.test(s)) { console.log('  ' + rel + ': already applied'); return; }
  const s0 = s, EOL = eolOf(s), J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  const re = (rx, rep, lo, hi, what) => { const n = (s.match(rx) || []).length; if (n < lo || n > hi) die(rel + ': ' + what + ' matched ' + n); s = s.replace(rx, (...a) => rep(EOL, ...a)); };
  fn({ once, J, re });
  const grew = s.length - s0.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  atomicWrite(F, s);
  console.log('  ' + rel + ': applied (+' + grew + ' chars)');
}
console.log('lazy-fx tests: ROOT ' + ROOT);
// the suites that inspect one sprite directly (see eager() below); each failed on the lazy build and passes as before with
// its art eager (compared against origin, same harness)
const EAGER_SUITES = ['apotheosis_ring', 'aries_ember', 'barnaby_fist', 'boss_column_sprite', 'boss_proj_sprite_coverage', 'cast_aura_load',
  'dash_class_lightning', 'decode_pin', 'doombringer_fire', 'fireball2x', 'grav_smooth', 'gravitos_shadow_bolt', 'gravitos_well_depth',
  'laserring_art', 'mticket_aspect', 'mwrap_anim', 'proj_sprite_flip', 'shin_projectiles', 'shockwave_anim', 'soulorb_upright', 'taurus_gore']
  .map((n) => 'scripts/' + n + '_test.mjs');

patch('scripts/world_stream_test.mjs', 400, 1500, ({ once, J }) => {
  once("  ok('all projectile anim sets requested', regs.proj >= regs.projKeys, regs);", J(
    "  const LAZYFX = await page.evaluate(() => typeof _lxFxWant === 'function');   // " + TAG + ' - a set is asked for by whoever will play it',
    "  if (LAZYFX) ok('no every-set sweep: projectile anim sets only for what is in play (' + regs.proj + ' of ' + regs.projKeys + ')', regs.proj < regs.projKeys * 0.5, regs);   // " + TAG,
    "  else ok('all projectile anim sets requested', regs.proj >= regs.projKeys, regs);"), 'the projectile sets check');
  once("  ok('all FX anim sets requested', regs.fx >= regs.fxKeys, regs);", J(
    "  if (LAZYFX) ok('no every-set sweep: effect anim sets only for what is in play (' + regs.fx + ' of ' + regs.fxKeys + ')', regs.fx < regs.fxKeys * 0.5, regs);   // " + TAG,
    "  else ok('all FX anim sets requested', regs.fx >= regs.fxKeys, regs);"), 'the FX sets check');
  once("  ok('summon anim sets requested', regs.summons > 0, regs);", J(
    "  if (LAZYFX) ok('summon anim sets only for the character\\'s summons (' + regs.summons + ')', regs.summons <= 12, regs);   // " + TAG,
    "  else ok('summon anim sets requested', regs.summons > 0, regs);"), 'the summon sets check');
});
// Suites that inspect one effect / projectile / summon / gear sprite directly (registered and decoded, drawn at a size, a
// blit route): their pages run with that art eager (window._lxFxEager, set before the game runs - the build's own switch,
// like ?lxfx=0). What they test is the art and its draw; scripts/lazy_fx_test.mjs covers when it loads.
function eager(rel) {
  patch(rel, 100, 1200, ({ re }) => {
    // the page's own line (a launch may share it: "const browser = ...; const page = await browser.newPage(...)")
    re(/^([ \t]*)(?:[^\r\n]*;\s*)?(?:const|let|var)\s+(\w+)\s*=\s*await\s+[^;\r\n]*\bnewPage\([^\r\n]*$/gm,
      (EOL, m, ind, v) => m + EOL + ind + 'await ' + v + ".addInitScript(() => { window._lxFxEager = true; });   // " + TAG + ' - this suite inspects the art itself: it stays eager here',
      1, 4, 'the newPage line');
  });
}
for (const rel of EAGER_SUITES) eager(rel);
console.log('lazy-fx tests: done');
