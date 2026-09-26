// Launch meta, repo half (pre-launch infra audit #4, #7, #9, #10, #12, #13, #14, 2026-09-27). Game half: apply_launch_meta.mjs.
// ============================================================================
// Runs as LX_APPLY2 after the ship pipeline re-syncs these files from origin. Never touches mojiworld_game.html.
//  - .github/workflows/deploy-pages.yml: Pages published .gitignore, render.yaml and package*.json, and every file under
//    steam/higgsfield/ (the review page, thumbs). Now those are excluded and steam/ keeps only files the game names as a
//    quoted path (computed from the game on every deploy). The data/*.js <script src> tags get ?v=<GAME_VERSION>, so the
//    HTML and its tables cannot skew for the 10 minutes Pages caches them. The Sprites/audio/backgrounds CDN rewrite is
//    untouched.
//  - README.md: the stale "Reset save (T)" (T is the co-op ping) and "Dev console: hold 1+2+3" rows go; the Download
//    section says "(first release coming soon)" while the repo has no release.
//  - steam/package.json: version = the GAME_VERSION being shipped (was 0.30.930); the depot/zip filter gains the new
//    manifest.webmanifest + its 512px icon (the depot test 404-fails any fetched file the filter leaves out), and
//    "!Sprites/**/_*backup*/**" keeps the two tracked art backups out of the depot and the zip, as audio's already were.
//  - Mojiworld.cmd ("Node missing" fallback) and PLAY_ME_FIRST.txt (written by build_portable_zip.mjs) point at
//    https://play.moji-studios.com/ instead of raw.githack.
//  - scripts/build_portable_zip.mjs: "!" filter entries (e.g. "!audio/**/_*backup*/**") were copied like folders
//    (ENOENT abort - no zip was ever built) and "audio/**" swept the local backup folders in. "!" entries are now
//    exclusions every copy honours; --out <dir> stages somewhere other than scripts/_tmp_portable.
//  - scripts/dev_lock_test.mjs, scripts/dev_surface_and_intro_test.mjs: open the public host with ?devlock=1 (they
//    asserted the lock on the public web, which is what the game half turns off).
//  - manifest.webmanifest, robots.txt: CREATED at ROOT when missing (an existing different file is left alone).
// Version: GAME_VERSION from LX_GAME_FILE; while the game still carries the un-retagged "v0.30.x launch-meta" marks the
// pipeline has not bumped yet, so the shipped version is that + 1. LX_META_VERSION=0.30.N overrides.
// Idempotent per file; once() count guards; atomic tmp + rename. EOL-aware.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.LX_META_ROOT || 'C:/Users/dpeh0/Mojiworld';
const GAME = process.env.LX_GAME_FILE || path.join(ROOT, 'mojiworld_game.html');
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };

// ---- the version being shipped ----------------------------------------------
const game = fs.readFileSync(GAME, 'utf8');
const gv = /GAME_VERSION = 'v(\d+)\.(\d+)\.(\d+)'/.exec(game);
if (!gv) die('GAME_VERSION not found in ' + GAME);
const pending = game.includes('v0.30.x launch-meta');
const VER = process.env.LX_META_VERSION || (gv[1] + '.' + gv[2] + '.' + (Number(gv[3]) + (pending ? 1 : 0)));
if (!/^\d+\.\d+\.\d+$/.test(VER)) die('bad version ' + VER);
const TAG = 'v' + VER + ' launch-meta';
console.log('launch-meta files: ROOT ' + ROOT + ', shipping version ' + VER + (pending ? ' (game not bumped yet: +1)' : ''));

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
// patch(rel, lo, hi, fn): fn gets { once, J, EOL, get, set }; writes only if changed, growth within [lo, hi]
function patch(rel, lo, hi, fn) {
  if (/mojiworld_game\.html$/.test(rel)) die('never the game file');
  const F = path.join(ROOT, rel);
  if (!fs.existsSync(F)) die(rel + ' missing under ' + ROOT);
  let s = fs.readFileSync(F, 'utf8');
  const s0 = s, EOL = eolOf(s), J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  fn({ once, J, EOL, get: () => s, set: (v) => { s = v; } });
  if (s === s0) { console.log('  ' + rel + ': already applied'); return; }
  const grew = s.length - s0.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  atomicWrite(F, s);
  console.log('  ' + rel + ': applied (' + (grew >= 0 ? '+' : '') + grew + ' chars)');
}
function create(rel, body) {
  const F = path.join(ROOT, rel);
  if (fs.existsSync(F)) { console.log('  ' + rel + (fs.readFileSync(F, 'utf8') === body ? ': already there' : ': exists with other content - left as is')); return; }
  atomicWrite(F, body);
  console.log('  ' + rel + ': created');
}
async function releaseExists() {
  if (process.env.LX_META_RELEASES === '0') return false;
  if (process.env.LX_META_RELEASES === '1') return true;
  try {
    const r = await fetch('https://api.github.com/repos/dpeh001-x/Mojiworld/releases?per_page=1', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mojiworld-launch-meta' }, signal: AbortSignal.timeout(10000) });
    if (r.ok) { const j = await r.json(); if (Array.isArray(j)) return j.length > 0; }
  } catch (e) {}
  try { return /refs\/tags\//.test(execFileSync('git', ['ls-remote', '--tags', 'https://github.com/dpeh001-x/Mojiworld.git'], { encoding: 'utf8', timeout: 30000 })); } catch (e) {}
  return null;
}
// ---- 1) the Pages deploy ------------------------------------------------------
patch('.github/workflows/deploy-pages.yml', 1500, 4500, ({ once, J, get }) => {
  if (get().includes('launch-meta')) return;
  const I = '          ', C = '            ';
  once(I + 'rsync -a ./ _site/ \\', J(
    I + '# ' + TAG + ' - repo plumbing never ships either: .gitignore / .gitattributes, render.yaml (the standby relay',
    I + '# blueprint), package*.json and any mp*/ relay folder. steam/ is trimmed to what the game loads further down.',
    I + 'rsync -a ./ _site/ \\',
    C + "--exclude '/.gitignore' \\",
    C + "--exclude '/.gitattributes' \\",
    C + "--exclude '/render.yaml' \\",
    C + "--exclude '/package.json' \\",
    C + "--exclude '/package-lock.json' \\",
    C + "--exclude '/mp*/' \\"), 'the rsync line');
  once(I + 'touch _site/.nojekyll', J(
    I + 'touch _site/.nojekyll',
    '',
    I + '# ' + TAG + ' - steam/ ships ONLY what the game itself loads. A file under steam/ stays when its path is written',
    I + '# as a quoted string in mojiworld_game.html (the story-beat, prologue, Everdawn and Gravitos cinematics); everything',
    I + '# else goes (the review page, thumbs/, a clip nothing plays any more). Computed from the game on every deploy, so a',
    I + '# new clip ships with the push that wires it in.',
    I + 'if [ -d _site/steam ]; then',
    I + '  kept=0; dropped=0',
    I + '  while IFS= read -r f; do',
    I + '    rel="${f#_site/}"',
    I + '    if grep -qF -e "\'${rel}\'" -e "\\"${rel}\\"" -e "\\`${rel}\\`" mojiworld_game.html; then',
    I + '      kept=$((kept + 1))',
    I + '    else',
    I + '      rm -f "$f"; dropped=$((dropped + 1))',
    I + '    fi',
    I + '  done < <(find _site/steam -type f)',
    I + '  find _site/steam -depth -type d -empty -delete',
    I + '  echo "steam/: shipped ${kept} file(s) the game loads, dropped ${dropped}"',
    I + 'fi',
    '',
    I + '# ' + TAG + ' - the data/*.js tables load as data/<name>.js?v=<GAME_VERSION>. Pages serves the HTML and',
    I + '# the tables with max-age=600, so for ten minutes after a deploy a browser could pair the new HTML with old tables;',
    I + '# a versioned URL is a new cache key the moment the HTML changes. The committed file keeps the plain paths.',
    I + 'GAME_VER="$(grep -oE "GAME_VERSION = \'v[0-9.]+\'" mojiworld_game.html | head -1 | grep -oE "v[0-9.]+" || true)"',
    I + '[ -n "${GAME_VER}" ] || GAME_VER="${GITHUB_SHA:0:12}"',
    I + 'for f in _site/index.html _site/mojiworld_game.html; do',
    I + '  sed -i -E "s#(<script src=\\"data/[A-Za-z0-9_.-]+\\.js)\\"#\\1?v=${GAME_VER}\\"#g" "$f"',
    I + 'done',
    I + 'echo "data/*.js versioned ?v=${GAME_VER}: $(grep -cE \'<script src="data/[^"]+[?]v=\' _site/index.html) script line(s)"'), 'touch .nojekyll');
});

// ---- 2) README -----------------------------------------------------------------
const rel = await releaseExists();
console.log('  releases on GitHub: ' + (rel === null ? 'unknown (check failed) - treated as none' : rel ? 'yes' : 'none'));
patch('README.md', -200, 100, ({ J, EOL, get, set }) => {
  let s = get();
  for (const row of ['| Reset save (confirms) | `T` |', '| Dev console | hold `1` + `2` + `3` |']) {
    const n = s.split(row + EOL).length - 1;
    if (n > 1) die('README: row matched ' + n + ': ' + row);
    if (n === 1) s = s.replace(row + EOL, '');
  }
  const LINK = '[**Releases**](https://github.com/dpeh001-x/Mojiworld/releases)', SOON = ' (first release coming soon)';
  if (s.split(LINK).length - 1 !== 1) die('README: Releases link not found once');
  if (!rel && !s.includes(LINK + SOON)) s = s.replace(LINK, () => LINK + SOON);
  if (rel && s.includes(LINK + SOON)) s = s.replace(LINK + SOON, () => LINK);
  set(s);
});

// ---- 3) steam/package.json -------------------------------------------------------
patch('steam/package.json', -20, 200, ({ once, EOL, get, set }) => {
  const I = '          ';
  if (!get().includes('"manifest.webmanifest"')) once(I + '"assets/apple-touch-icon.png",', [I + '"assets/apple-touch-icon.png",', I + '"assets/mojiworld_icon_512.png",', I + '"manifest.webmanifest",'].join(EOL), 'the apple-touch-icon filter entry');
  // two art backups are tracked under Sprites/ (projectiles/_backup, ui/hud/_icon_backup; the game loads neither) - kept out like audio's
  if (!get().includes('"!Sprites/**/_*backup*/**"')) once(I + '"!audio/**/_*backup*/**",', [I + '"!audio/**/_*backup*/**",', I + '"!Sprites/**/_*backup*/**",'].join(EOL), 'the audio backup exclusion');
  const re = /^ {2}"version": "[^"]*",/m, s = get();
  if ((s.match(/^ {2}"version": "/gm) || []).length !== 1) die('steam/package.json: top-level version line not found once');
  set(s.replace(re, () => '  "version": "' + VER + '",'));
  try { const p = JSON.parse(get()); if (p.version !== VER) die('steam/package.json: version did not take'); } catch (e) { die('steam/package.json no longer parses: ' + e.message); }
});

// ---- 4) Mojiworld.cmd ----------------------------------------------------------
patch('Mojiworld.cmd', -40, 0, ({ once, get }) => {
  if (get().includes('start "" "https://play.moji-studios.com/"')) return;
  once('start "" "https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html"', 'start "" "https://play.moji-studios.com/"', 'the hosted-build fallback');
});
// ---- 5) scripts/build_portable_zip.mjs -----------------------------------------
patch('scripts/build_portable_zip.mjs', 1200, 3500, ({ once, J, get }) => {
  if (get().includes('launch-meta')) return;
  once('//   --node:  node.exe to bundle (default: the running process.execPath)', J(
    '//   --node:  node.exe to bundle (default: the running process.execPath)',
    '//   --out:   stage + zip under <dir> instead of scripts/_tmp_portable (only <dir>/Mojiworld and the zip are replaced)'), 'the usage lines');
  once(J("const STAGE_ROOT = path.join(ROOT, 'scripts', '_tmp_portable');", "const STAGE = path.join(STAGE_ROOT, 'Mojiworld');", 'const args = process.argv.slice(2);'), J(
    'const args = process.argv.slice(2);',
    "const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : null;   // " + TAG,
    "const STAGE_ROOT = OUT || path.join(ROOT, 'scripts', '_tmp_portable');",
    "const STAGE = path.join(STAGE_ROOT, 'Mojiworld');"), 'the stage paths');
  once("const LAUNCHER_EXTRAS = ['serve.js', 'Mojiworld.cmd'];", J(
    "const LAUNCHER_EXTRAS = ['serve.js', 'Mojiworld.cmd'];",
    '// ' + TAG + ' - a "!" entry is an electron-builder EXCLUSION (e.g. "!audio/**/_*backup*/**", the local audio',
    '// regeneration backups). The loop below used to copy it like a folder - cpSync("!audio/**/_*backup*") threw ENOENT, so',
    '// no zip was ever built - and "audio/**" swept those backups in. Now every "!" glob is skipped by every copy.',
    'const _globRe = (g) => new RegExp(\'^\' + g.split(\'/\').map((seg) => seg === \'**\' ? \'\\u0000\'',
    '  : seg.replace(/[.+^${}()|[\\]\\\\]/g, \'\\\\$&\').replace(/\\*/g, \'[^/]*\').replace(/\\?/g, \'[^/]\')).join(\'/\')',
    '  .replace(/\\u0000\\//g, \'(?:.*/)?\').replace(/\\/\\u0000$/, \'(?:/.*)?\').replace(/\\u0000/g, \'.*\') + \'$\');',
    "const EXCLUDE = filter.filter((e) => e.startsWith('!')).map((e) => _globRe(e.slice(1)));",
    "const excluded = (rel) => { const r = rel.split(path.sep).join('/'); return EXCLUDE.some((re) => re.test(r)); };"), 'the launcher extras line');
  once("fs.rmSync(STAGE_ROOT, { recursive: true, force: true });", "fs.rmSync(OUT ? STAGE : STAGE_ROOT, { recursive: true, force: true });   // " + TAG + " - never empty a caller's --out folder", 'the stage wipe');
  once("const cpDir = (rel) => { fs.cpSync(path.join(ROOT, rel), path.join(STAGE, rel), { recursive: true }); };",
    "const cpDir = (rel) => { fs.cpSync(path.join(ROOT, rel), path.join(STAGE, rel), { recursive: true, filter: (src) => !excluded(path.relative(ROOT, src)) }); };   // " + TAG, 'cpDir');
  once(J('const cpFile = (rel) => {', '  const dst = path.join(STAGE, rel);'), J('const cpFile = (rel) => {', '  if (excluded(rel)) return;   // ' + TAG, '  const dst = path.join(STAGE, rel);'), 'cpFile');
  once('for (const entry of filter) {', J('for (const entry of filter) {', "  if (entry.startsWith('!')) continue;   // " + TAG + ' - an exclusion (EXCLUDE above), not a path'), 'the filter loop');
  once("  'Problems? The hosted version always works, no download needed:',", "  'Problems? The web version always works, no download needed:',", 'PLAY_ME_FIRST hosted line');
  once("  '  https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html',", "  '  https://play.moji-studios.com/',", 'PLAY_ME_FIRST link');
  once('  const zipPath = path.join(STAGE_ROOT, zipName);', J('  const zipPath = path.join(STAGE_ROOT, zipName);', '  fs.rmSync(zipPath, { force: true });   // ' + TAG + ' - 7za "a" adds to an old zip of the same name instead of replacing it'), 'the zip path');
});

// ---- 6) the two dev-lock tests: the public host needs ?devlock=1 now ---------------
patch('scripts/dev_lock_test.mjs', 200, 900, ({ once, J, get }) => {
  if (get().includes('launch-meta')) return;
  once("  { const { ctx, page } = await open(PUBLIC, '?dev=1');", "  { const { ctx, page } = await open(PUBLIC, '?dev=1&devlock=1');   // " + TAG + ' - the public web shows the lock only with ?devlock=1', 'the public open');
  once('  // ---- the Steam app: never, even with the flag', J(
    '  // ---- ' + TAG + ' - the public web without ?devlock=1: no lock at all',
    "  { const { ctx, page } = await open(PUBLIC, '?dev=1');",
    '    const s = await state(page);',
    "    check(s.lock === null && !s.surface && !s.console, 'without ?devlock=1 the public web shows no lock (" + TAG + ")', s);",
    '    await ctx.close(); }',
    '  // ---- the Steam app: never, even with the flag'), 'the Steam block');
});
patch('scripts/dev_surface_and_intro_test.mjs', 100, 600, ({ once, get }) => {
  if (get().includes('launch-meta')) return;
  once('  await page.goto(`http://${host}:${PORT}/mojiworld_game.html?dev=1`, {', '  await page.goto(`http://${host}:${PORT}/mojiworld_game.html?dev=1&devlock=1`, {   /* ' + TAG + ' - the public lock needs ?devlock=1 */', 'the probe goto');
  once("check(pub.pre.icon === true, 'the lock icon IS on the public link for testers (v0.30.894)", "check(pub.pre.icon === true, 'with ?devlock=1 (" + TAG + ") the lock icon IS on the public link for testers (v0.30.894)", 'the public icon check');
});

// ---- 7) new files ----------------------------------------------------------------
create('manifest.webmanifest', JSON.stringify({
  name: 'Mojiworld \u2014 The Everdawn Cycle',
  short_name: 'Mojiworld',
  description: 'A 2D action-platformer RPG in your browser: four classes, roguelite loot, boss fights and drop-in co-op with a friend.',
  id: './', start_url: './', scope: './',
  display: 'fullscreen', display_override: ['fullscreen', 'standalone'], orientation: 'landscape',
  background_color: '#0c0b10', theme_color: '#0c0b10',
  icons: [
    { src: 'assets/favicon-32.png', sizes: '32x32', type: 'image/png' },
    { src: 'assets/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    { src: 'assets/mojiworld_icon_512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
}, null, 2) + '\n');
create('robots.txt', ['# Mojiworld - https://play.moji-studios.com/ (launch-meta)', 'User-agent: *', 'Allow: /', ''].join('\n'));
console.log('launch-meta files: done');
