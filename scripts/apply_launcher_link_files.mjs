// Launcher link, repo half (follow-up to v0.30.1180 launch-meta, 2026-09-27). Game half: apply_launcher_link.mjs.
// ============================================================================
// Runs as LX_APPLY2 after the ship pipeline re-syncs tools/launcher/MojiworldLauncher.cs from origin. Never touches
// mojiworld_game.html.
//  - tools/launcher/MojiworldLauncher.cs: with Node.js missing, the Mojiworld.exe stub offered HOSTED =
//    https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html (the developer preview: branch tip, CDN lag,
//    no share card). HOSTED is now https://play.moji-studios.com/, the address Mojiworld.cmd and PLAY_ME_FIRST.txt use
//    since launch-meta. The header comment says so, and the exe's version resource (AssemblyVersion / FileVersion,
//    still 0.30.433.0) becomes the version this ships in, so a rebuilt exe says which launcher it is.
// The exe itself is NOT in the repo (v0.30.589 took the unsigned stub out of the root; build_launcher.ps1 builds it to
// the git-ignored tools/launcher/out/), not in the portable zip (that ships Mojiworld.cmd) and not in the Steam depot
// (whose Mojiworld.exe is the Electron app). So only the source changes; the next hand build picks it up.
// Version: GAME_VERSION from LX_GAME_FILE; while the game still carries the un-retagged "v0.30.x launcher-link" mark the
// pipeline has not bumped yet, so the shipped version is that + 1. LX_LINK_VERSION=0.30.N overrides.
// ROOT: LX_LINK_ROOT (default the repo). Idempotent per file; once() count guards; atomic tmp + rename. EOL-aware.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.env.LX_LINK_ROOT || 'C:/Users/dpeh0/Mojiworld';
const GAME = process.env.LX_GAME_FILE || path.join(ROOT, 'mojiworld_game.html');
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };

// ---- the version being shipped ----------------------------------------------
const game = fs.readFileSync(GAME, 'utf8');
const gv = /GAME_VERSION = 'v(\d+)\.(\d+)\.(\d+)'/.exec(game);
if (!gv) die('GAME_VERSION not found in ' + GAME);
const pending = game.includes('v0.30.x launcher-link');
const VER = process.env.LX_LINK_VERSION || (gv[1] + '.' + gv[2] + '.' + (Number(gv[3]) + (pending ? 1 : 0)));
if (!/^\d+\.\d+\.\d+$/.test(VER) || VER.split('.').some((n) => Number(n) > 65534)) die('bad version ' + VER);
const TAG = 'v' + VER + ' launcher-link';
console.log('launcher-link files: ROOT ' + ROOT + ', shipping version ' + VER + (pending ? ' (game not bumped yet: +1)' : ''));

// ---- helpers ----------------------------------------------------------------
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
// patch(rel, lo, hi, fn): fn gets { once, J, get, set }; writes only if changed, growth within [lo, hi]
function patch(rel, lo, hi, fn) {
  if (/mojiworld_game\.html$/.test(rel)) die('never the game file');
  const F = path.join(ROOT, rel);
  if (!fs.existsSync(F)) die(rel + ' missing under ' + ROOT);
  let s = fs.readFileSync(F, 'utf8');
  const s0 = s, EOL = eolOf(s), J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  fn({ once, J, get: () => s, set: (v) => { s = v; } });
  if (s === s0) { console.log('  ' + rel + ': already applied'); return; }
  if (s.split('').some((c) => { const u = c.charCodeAt(0); return u >= 0xD800 && u <= 0xDFFF; })) die(rel + ': lone surrogate');
  const grew = s.length - s0.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  atomicWrite(F, s);
  console.log('  ' + rel + ': applied (' + (grew >= 0 ? '+' : '') + grew + ' chars)');
}

// ---- tools/launcher/MojiworldLauncher.cs --------------------------------------
patch('tools/launcher/MojiworldLauncher.cs', 100, 700, ({ once, J, get, set }) => {
  if (get().includes('launcher-link')) return;
  once('//   3. If Node.js is missing entirely, offer the hosted raw.githack build.', J(
    '//   3. If Node.js is missing entirely, offer the hosted build at https://play.moji-studios.com/',
    '//      (' + TAG + ' - it offered the raw.githack developer preview; Mojiworld.cmd and',
    '//      PLAY_ME_FIRST.txt moved to the same address in v0.30.1180).'), 'the header fallback line');
  once('    const string HOSTED = "https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html";', J(
    '    // ' + TAG + ' - the public web build, the same address as Mojiworld.cmd\'s fallback and the',
    '    // game\'s og:url. Was the raw.githack developer preview (branch tip, CDN lag, no share card).',
    '    const string HOSTED = "https://play.moji-studios.com/";'), 'the HOSTED constant');
  // the version resource (Details tab) - which launcher build this is
  let s = get();
  for (const attr of ['AssemblyVersion', 'AssemblyFileVersion']) {
    const re = new RegExp('^\\[assembly: ' + attr + '\\("\\d+\\.\\d+\\.\\d+\\.\\d+"\\)\\]', 'gm');
    const n = (s.match(re) || []).length;
    if (n !== 1) die('MojiworldLauncher.cs: ' + attr + ' matched ' + n);
    s = s.replace(re, () => '[assembly: ' + attr + '("' + VER + '.0")]');
  }
  set(s);
});
console.log('launcher-link files: done');
