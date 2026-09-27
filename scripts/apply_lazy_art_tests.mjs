// Lazy art, test half (v0.30.x lazy-art). Game half: apply_lazy_art.mjs.
// ============================================================================
// Runs as LX_APPLY2 after the ship pipeline re-syncs these files from origin. Never touches mojiworld_game.html.
// Boss frame sets and far maps' backdrops now load when they are wanted (entering the map, a portal neighbour, a boss
// spawn or summon), and the boot image hold is on for localhost too. Four suites assumed every piece of art was already
// on the page a few seconds after boot; each now asks for exactly the art it inspects, the way the game does, and waits
// for it to land. On an eager build (no _lxBossArtWant / _lxWantImg) every insertion is a no-op.
//  - scripts/boss_card_art_test.mjs: asks for Leo's art and waits for his WHOLE idle set (it waited on frame 0 only, then
//    required every frame baked).
//  - scripts/boss_frame_warm_test.mjs: asks for Gravitos's, Leo's and Virgo's sets and waits for them to land before the
//    spawn-time warm is measured (asking loads; it does not warm - _lxWarmed stays _lxWarmBossFrames's), so the edge
//    probe and the warm-vs-cold first draw compare decoded frames against loaded-but-undecoded ones, as at an eager boot.
//  - scripts/bg_retry_test.mjs: asks for the Clockwork Underpass backdrop before waiting on it.
//  - scripts/boot_hold_test.mjs: check C flips - localhost has the hold now (it parks lazy art on every build).
// Left alone (they fail on origin already): see the ship notes.
// Idempotent per file; once() count guards; atomic tmp + rename. EOL-aware.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.env.LX_TESTS_ROOT || 'C:/Users/dpeh0/Mojiworld';
const TAG = 'v0.30.x lazy-art';
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
// patch(rel, lo, hi, fn): fn gets { once, J, get }; skipped when the file already carries the lazy-art mark
function patch(rel, lo, hi, fn) {
  if (/mojiworld_game\.html$/.test(rel)) die('never the game file');
  const F = path.join(ROOT, rel);
  if (!fs.existsSync(F)) die(rel + ' missing under ' + ROOT);
  let s = fs.readFileSync(F, 'utf8');
  if (/v0\.30\.(?:x|\d+) lazy-art/.test(s)) { console.log('  ' + rel + ': already applied'); return; }
  const s0 = s, EOL = eolOf(s), J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  fn({ once, J, get: () => s });
  const grew = s.length - s0.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  atomicWrite(F, s);
  console.log('  ' + rel + ': applied (+' + grew + ' chars)');
}
console.log('lazy-art tests: ROOT ' + ROOT);

patch('scripts/boss_card_art_test.mjs', 200, 700, ({ once, J }) => {
  once('  const set = ZODIAC_IDLE_FRAMES.leo || [];', J(
    '  const set = ZODIAC_IDLE_FRAMES.leo || [];',
    '  // ' + TAG + ' - boss art loads when wanted: ask for Leo\'s, and wait for the whole idle set (the check below bakes every frame)',
    "  if (typeof _lxBossArtWant === 'function') { _lxBossArtWant('zodiac_leo'); for (let i = 0; i < 300 && !(set.length && set.every((im) => im && im.complete && im.naturalWidth > 0)); i++) await sleep(100); }"),
    "the Leo idle-set wait");
});

patch('scripts/boss_frame_warm_test.mjs', 500, 1400, ({ once, J }) => {
  once('  out.hasWarm = (typeof _lxWarmBossFrames === \'function\');', J(
    '  out.hasWarm = (typeof _lxWarmBossFrames === \'function\');',
    '  // ' + TAG + ' - boss art loads when wanted. Ask for the sets measured below and let them LAND first, as an eager boot had',
    '  // them: asking loads, it does not warm (_lxWarmed is _lxWarmBossFrames\'s alone), so "start cold" still holds, and the',
    '  // first-draw comparison is decoded (warmed) frames against loaded-but-undecoded ones, not against frames still in flight.',
    "  if (typeof _lxBossArtWant === 'function') {",
    "    for (const t of ['gravitos', 'zodiac_leo', 'zodiac_virgo']) _lxBossArtWant(t);",
    '    const _in = () => [BOSS_ATTACK_FRAMES.gravitos, BOSS_IDLE_FRAMES.gravitos, BOSS_WALK_FRAMES.gravitos, BOSS_ATTACK_FRAMES.gravitospunch,',
    '      ZODIAC_IDLE_FRAMES.leo, ZODIAC_ATTACK_FRAMES.leo, ZODIAC_ATTACK_FRAMES.virgo].every((a) => (a || []).every((im) => im && im.complete));',
    '    for (let i = 0; i < 900 && !_in(); i++) await sleep(100);',
    '  }'), 'the warm probe head');
});

patch('scripts/bg_retry_test.mjs', 100, 400, ({ once }) => {
  once('    const up = BG_IMAGES.clockworkUnderpass; const t0 = performance.now();',
    "    const up = BG_IMAGES.clockworkUnderpass; if (up && typeof _lxWantImg === 'function') _lxWantImg(up, true); const t0 = performance.now();   // " + TAG + ' - a far backdrop loads when wanted',
    'the Underpass wait');
});

patch('scripts/boot_hold_test.mjs', 50, 500, ({ once }) => {
  once('//   C  localhost                                 - the hold must not exist (local art, harnesses, the packaged app)',
    '//   C  localhost                                 - the hold exists here too (' + TAG + ': it parks lazy art on every build)',
    'the C header line');
  once("  check(await C.evaluate(() => typeof window._lxBootHold === 'undefined'), 'C: on localhost the hold does not exist');",
    "  check(await C.evaluate(() => !!window._lxBootHold && typeof window._lxBootHold.want === 'function'), 'C: on localhost the hold exists too (it parks boss frames and far backdrops)');   // " + TAG,
    'check C');
});
console.log('lazy-art tests: done');
