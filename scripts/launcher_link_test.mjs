// Launcher link (v0.30.x launcher-link): every Windows launcher's "Node.js is missing" fallback opens the public web
// build, https://play.moji-studios.com/ - the Mojiworld.exe stub too, not just Mojiworld.cmd and PLAY_ME_FIRST.txt.
//   node scripts/launcher_link_test.mjs   (MOJI_GAME_FILE=<build.html> to test a private build;
//                                          LX_LINK_ROOT=<dir> to read tools/launcher/MojiworldLauncher.cs from another tree)
// The launcher source this package changes is read from LX_LINK_ROOT (default: this repo); every other launcher and
// packaging file is read from origin/main (the OneDrive working tree can be stale). The exe is compiled into a temp
// folder with build_launcher.ps1's own csc flags and byte-searched; nothing is written into the repo.
import { chromium } from 'playwright-core';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LINK = path.resolve(process.env.LX_LINK_ROOT || ROOT);
const PORT = process.env.PORT || '11450';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PLAY = 'https://play.moji-studios.com/';
const STALE = /raw\.githack\.com|rawcdn\.githack\.com|dpeh001-x\.github\.io/i;
const CS = 'tools/launcher/MojiworldLauncher.cs';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const fromOrigin = (rel) => execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 });
const onOrigin = (rel) => spawnSync('git', ['cat-file', '-e', 'origin/main:' + rel], { cwd: ROOT }).status === 0;
const readSrc = (rel) => (rel === CS ? fs.readFileSync(path.join(LINK, rel)) : fromOrigin(rel)).toString('utf8');

// ---- 1) the launcher sources ------------------------------------------------------------------------------------------
const cs = readSrc(CS);
const hosted = (/const string HOSTED = "([^"]*)";/.exec(cs) || [])[1] || null;
check(hosted === PLAY, 'Mojiworld.exe source: HOSTED (the Node-missing fallback) is ' + PLAY, { hosted });
check(/if \(pick == DialogResult\.Yes\) Open\(HOSTED\);/.test(cs) && /Node\.js was not found/.test(cs), 'the Node-missing dialog still opens HOSTED', null);
const launcherDir = execFileSync('git', ['ls-tree', '--name-only', 'origin/main', 'tools/launcher/'], { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const scan = [...new Set([...launcherDir, CS, 'Mojiworld.cmd', 'serve.bat', 'serve.js', 'scripts/build_portable_zip.mjs', 'scripts/package_playtest_build.mjs',
  'docs/guides/playtest_README.txt', 'steam/main.js', 'steam/preload.js', 'steam/static_server.js', 'steam/launch_args.js', 'steam/package.json'])].filter((r) => r === CS || onOrigin(r));
const stale = [];
for (const rel of scan) readSrc(rel).split(/\r?\n/).forEach((ln, i) => { if (STALE.test(ln)) stale.push(rel + ':' + (i + 1) + ' ' + ln.trim().slice(0, 90)); });
check(stale.length === 0 && scan.length >= 12, `no raw.githack / github.io address left in the launcher + packaging sources (${scan.length} files)`, stale);
const cmd = readSrc('Mojiworld.cmd'), zip = readSrc('scripts/build_portable_zip.mjs');
const cmdLink = (/Node\.js was not found[^\r\n]*\r?\n\s*start "" "([^"]+)"/.exec(cmd) || [])[1] || null;
const zipLink = (/'  (https:\/\/[^']+)',/.exec(zip) || [])[1] || null;
check(cmdLink === PLAY && zipLink === PLAY && hosted === cmdLink, 'Mojiworld.exe, Mojiworld.cmd and PLAY_ME_FIRST.txt all fall back to the same address', { hosted, cmdLink, zipLink });

// ---- 2) the build scripts still name the right files ----------------------------------------------------------------
const ps1 = readSrc('tools/launcher/build_launcher.ps1');
const FLAGS = ['/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/r:System.Windows.Forms.dll',
  '/win32icon:"$root\\steam\\build\\icon.ico"', '/win32manifest:"$root\\tools\\launcher\\app.manifest"', '"$root\\tools\\launcher\\MojiworldLauncher.cs"'];
const missFlags = FLAGS.filter((f) => !ps1.includes(f));
const refs = ['steam/build/icon.ico', 'tools/launcher/app.manifest', CS].filter((r) => !(r === CS ? existsSync(path.join(LINK, r)) : onOrigin(r)));
check(missFlags.length === 0 && refs.length === 0 && /tools\\launcher\\out|Join-Path \$PSScriptRoot 'out'/.test(ps1),
  'build_launcher.ps1 still compiles MojiworldLauncher.cs + app.manifest + icon.ico (files exist) into tools/launcher/out', { missFlags, refs });
check(/const LAUNCHER_EXTRAS = \['serve\.js', 'Mojiworld\.cmd'\];/.test(zip) && /'PLAY_ME_FIRST\.txt'/.test(zip),
  'build_portable_zip.mjs still ships serve.js + Mojiworld.cmd + PLAY_ME_FIRST.txt (the exe is not in the zip)', null);

// ---- 3) the exe, compiled from this source with those flags -----------------------------------------------------------
const csc = [path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),
  path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework/v4.0.30319/csc.exe')].find((p) => existsSync(p));
if (!csc) console.log('SKIP  the compiled exe (no .NET Framework csc.exe on this machine)');
else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lx_launcher_link_'));
  let exe = null, out = '';
  try {
    fs.writeFileSync(path.join(tmp, 'MojiworldLauncher.cs'), fs.readFileSync(path.join(LINK, CS)));
    fs.writeFileSync(path.join(tmp, 'app.manifest'), fromOrigin('tools/launcher/app.manifest'));
    fs.writeFileSync(path.join(tmp, 'icon.ico'), fromOrigin('steam/build/icon.ico'));
    const r = spawnSync(csc, ['/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/out:' + path.join(tmp, 'Mojiworld.exe'),
      '/win32icon:' + path.join(tmp, 'icon.ico'), '/win32manifest:' + path.join(tmp, 'app.manifest'), '/r:System.Windows.Forms.dll',
      path.join(tmp, 'MojiworldLauncher.cs')], { encoding: 'utf8', timeout: 120000 });
    out = ((r.stdout || '') + (r.stderr || '')).trim().slice(0, 400);
    if (r.status === 0 && existsSync(path.join(tmp, 'Mojiworld.exe'))) exe = fs.readFileSync(path.join(tmp, 'Mojiworld.exe'));
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
  const has = (s) => !!exe && (exe.includes(Buffer.from(s, 'utf16le')) || exe.includes(Buffer.from(s, 'latin1')));
  const info = { built: !!exe, bytes: exe ? exe.length : 0, play: has(PLAY), githack: has('raw.githack.com'), csc: out };
  check(!!exe && exe.length > 20000, 'Mojiworld.exe compiles from the source with build_launcher.ps1\'s flags', info);
  check(has(PLAY) && !has('raw.githack.com') && !has('githack'), 'the compiled exe carries ' + PLAY + ' and no raw.githack address', info);
}

// ---- 4) the game: og:url is that address, the marker points at the launchers -------------------------------------------
const GAME_SRC = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
const ogIdx = GAME_SRC.indexOf('<meta property="og:url" content="' + PLAY + '">');
const mark = /<!-- v0\.30\.(?:x|\d+) launcher-link - [\s\S]{0,400}?MojiworldLauncher\.cs[\s\S]{0,200}?-->/.exec(GAME_SRC.slice(Math.max(0, ogIdx), ogIdx + 900));
check(ogIdx > 0 && GAME_SRC.slice(0, 20000).includes('og:url') && !!mark, 'the game names the launchers beside its og:url (' + PLAY + ')', { ogIdx, mark: !!mark });

const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: fromOrigin(rel) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof game === 'object' && typeof player === 'object', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999;
  });
  const t0 = await p.evaluate(() => game.time || 0);
  const wall = Date.now();
  while (Date.now() - wall < 60000 && (await p.evaluate(() => game.time || 0)) - t0 < 60) await p.waitForTimeout(500);
  const st = await p.evaluate(() => ({ og: (document.head.querySelector('meta[property="og:url"]') || {}).content || null,
    map: game.currentMap || (typeof currentMap !== 'undefined' ? currentMap : null), steps: game.time || 0 }));
  check(st.og === PLAY && st.steps - t0 >= 60, 'the page boots and plays, with og:url = ' + PLAY, { ...st, t0 });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
