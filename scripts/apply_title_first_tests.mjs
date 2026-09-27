// Title first, test half (v0.30.x title-first). Game half: apply_title_first.mjs.
// ============================================================================
// Runs as LX_APPLY2 after the ship pipeline re-syncs these files from origin. Never touches mojiworld_game.html.
// The title menu no longer waits for the boot gate's first-paint set (the towns' backdrops, the town NPC sheets, the
// start map's preload): it comes up once the page and its own art are in, and that set streams in right after it.
// Four suites timed things against the old, later title. On a build without title-first (no window._lxTitleFirst) every
// inserted line is a no-op and the old checks run.
//  - boot_gate_test: "gated set fully loaded at reveal" -> at reveal, or (title-first) streamed in right after it.
//  - boot_gate_pause_test: the Void's entry beat (a chirp ~3 s after the boot loads the Void) now plays while the title
//    is already up - the suite lets it finish before it counts sounds; and after the sprite hold the ready gate may
//    still wait (bounded, 20 s cap) for the start map's art, which arrives after the menu now - it polls for the release.
//  - boot_version_test: the front page is up only until the page has loaded - it samples it on a throttled line, as
//    soon as the version line is filled (it waited for DOMContentLoaded + 1.5 s, by which time the menu is up).
//  - boot_prologue_test: "TOWN background loaded before reveal" -> before reveal, or (title-first) when the world opens.
// Idempotent per file; once() count guards; atomic tmp + rename. EOL-aware.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.env.LX_TESTS_ROOT || 'C:/Users/dpeh0/Mojiworld';
const TAG = 'v0.30.x title-first';
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
// patch(rel, lo, hi, fn): fn gets { once, J }; skipped when the file already carries the title-first mark
function patch(rel, lo, hi, fn) {
  if (/mojiworld_game\.html$/.test(rel)) die('never the game file');
  const F = path.join(ROOT, rel);
  if (!fs.existsSync(F)) die(rel + ' missing under ' + ROOT);
  let s = fs.readFileSync(F, 'utf8');
  if (/v0\.30\.(?:x|\d+) title-first/.test(s)) { console.log('  ' + rel + ': already applied'); return; }
  const s0 = s, EOL = eolOf(s), J = (...L) => L.join(EOL);
  const once = (a, b, what) => { a = a.split('\n').join(EOL); const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  fn({ once, J });
  const grew = s.length - s0.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  atomicWrite(F, s);
  console.log('  ' + rel + ': applied (+' + grew + ' chars)');
}
console.log('title-first tests: ROOT ' + ROOT);

patch('scripts/boot_gate_test.mjs', 400, 2000, ({ once, J }) => {
  once('  await b.close();\n  return { snap, tReveal, errs };', J(
    '  // ' + TAG + ' - with title-first the menu no longer waits for the first-paint set: it streams in right after (unthrottled run)',
    '  let tf = false, gatedAfter = null;',
    '  try { tf = await page.evaluate(() => !!window._lxTitleFirst); } catch (e) {}',
    '  if (tf && !throttleKbps && snap && snap.revealed) { const t1 = Date.now(); while (Date.now() - t1 < 90000) { const g = await page.evaluate(() => { const s = window._lxBootStats; return !!(s && s.gated >= s.gatedTotal); }); if (g) { gatedAfter = Date.now() - t1; break; } await new Promise(r => setTimeout(r, 250)); } }',
    '  await b.close();',
    '  return { snap, tReveal, errs, tf, gatedAfter };'), 'bootOnce tail');
  once("ok('gated set fully loaded at reveal', fast.snap && fast.snap.gated >= fast.snap.gatedTotal, fast.snap);", J(
    "ok('gated set fully loaded at reveal (title-first: streamed in right after it)', fast.snap && (fast.snap.gated >= fast.snap.gatedTotal || (fast.tf && fast.gatedAfter != null)),   // " + TAG,
    '   Object.assign({}, fast.snap, { titleFirst: fast.tf, gatedAfterMs: fast.gatedAfter }));'), 'the gated-set check');
});

patch('scripts/boot_gate_pause_test.mjs', 400, 2000, ({ once, J }) => {
  once("await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && a.classList.contains('shown'); },\n  null, { timeout: 90000 });", J(
    "await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && a.classList.contains('shown'); },",
    '  null, { timeout: 90000 });',
    "// " + TAG + " - the menu can be up before the Void's entry beat (Guguma's eye-zoom and its chirp, ~3 s after the boot loads the",
    '// Void) has played: let it finish, so the sounds counted below are the ones a keypress makes',
    "await page.waitForFunction(() => { const o = document.getElementById('void-intro-overlay'); return !o || !o.classList.contains('show'); }, null, { timeout: 20000 }).catch(() => {});"),
    'the title wait');
  once('  window._lxSpriteWatch = [];\n  await new Promise(r => setTimeout(r, 1800));', J(
    '  window._lxSpriteWatch = [];',
    '  await new Promise(r => setTimeout(r, 1800));',
    '  // ' + TAG + ' - the ready gate that follows may still wait (bounded, 20 s cap) for the start map\'s art, which arrives after the menu now',
    '  { const t0 = Date.now(); while (window._lxTitleFirst && window._lxSpriteGateHolding && Date.now() - t0 < 25000) await new Promise(r => setTimeout(r, 200)); }'),
    'the release wait');
});

patch('scripts/boot_version_test.mjs', 400, 2400, ({ once, J }) => {
  once('await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: \'domcontentloaded\', timeout: 60000 });', J(
    '// ' + TAG + ' - the front page is up only until the page has loaded (the title menu no longer waits for the town art): a slow',
    '// line keeps it up long enough to sample, and the sample is taken as soon as the version line is filled, not after load',
    'const __cdp = await p.context().newCDPSession(p);',
    "await __cdp.send('Network.enable'); await __cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 2e6, uploadThroughput: 1e6 });",
    'await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: \'commit\', timeout: 60000 });'), 'the goto');
  once("await p.waitForFunction(() => !!document.getElementById('lo-boot-version'), null, { timeout: 30000 });\nawait p.waitForTimeout(1500);", J(
    "await p.waitForFunction(() => { const e = document.getElementById('lo-boot-version'); return !!(e && e.textContent.trim()); }, null, { timeout: 60000 });   // " + TAG,
    'await p.waitForTimeout(300);'), 'the front-page wait');
  once('// ── MAIN MENU', J(
    "await __cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });   // " + TAG + ' - full speed again',
    '// ── MAIN MENU'), 'the menu section');
});

patch('scripts/boot_prologue_test.mjs', 400, 2400, ({ once, J }) => {
  once("  ok('TOWN background loaded before reveal', fetched.townBg, fetched);", J(
    "  // " + TAG + " - with title-first the town's backdrop streams in after the menu; it must be in when the world opens",
    "  const __tf = await page.evaluate(() => !!window._lxTitleFirst);",
    "  const __townCheck = (atWorld) => ok('TOWN background loaded before reveal (title-first: before the world opens)', fetched.townBg || (__tf && atWorld), Object.assign({}, fetched, { titleFirst: __tf, atWorld }));",
    '  if (!__tf) __townCheck(false);'), 'the town-backdrop check');
  once("  ok('class select opens after naming', true);", J(
    "  ok('class select opens after naming', true);",
    '  if (__tf) {   // ' + TAG + ' - the world opens when the loading overlay fades (after the commence gate)',
    "    await page.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return !o || o.classList.contains('fade'); }, null, { timeout: 150000 }).catch(() => {});",
    "    __townCheck(await page.evaluate(() => { try { const b = BG_IMAGES.everdawnCentral; return !!(b && (b._loaded || (b.complete && b.naturalWidth > 0))); } catch (e) { return false; } }));",
    '  }'), 'the class-select step');
});

// sprite_gate_retry_test: its save had no version, so loadState read it as an old format and started a new hero in the
// Void - while the boot prepared the save's map (town) anyway, which is what the suite's watched NPC frames came from.
// The boot now prepares the map the world is on; the save gets its version, so the world really is in town.
patch('scripts/sprite_gate_retry_test.mjs', 100, 900, ({ once, J }) => {
  once("const SAVE = JSON.stringify({ player: { cls: 'warrior', level: 5,", J(
    '// ' + TAG + ' - v: 1, or loadState reads the save as an old format and starts a new hero in the Void (not town)',
    "const SAVE = JSON.stringify({ v: 1, t: Date.now(), player: { cls: 'warrior', level: 5,"), 'the save fixture');
});
