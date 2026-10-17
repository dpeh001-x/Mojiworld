// resync-guard (v0.30.x resync-guard): a ship chain whose re-sync fails can no longer ship stale tables, and the rows
// the last one reverted are back.
//   node scripts/resync_guard_test.mjs          (MOJI_GAME_FILE=<build.html> for a private build; LX_REPO=<dir> reads
//                                                data/sprite_edges.js, sw.js and the two pipeline scripts from a scratch copy)
// A. the pipeline: scripts/_ship_change.sh stops on a failed re-sync and verifies every re-synced path before applying,
//    and scripts/_ship_resync.sh is driven for real in a scratch git repo (stale index.lock, stale bytes, CRLF checkout).
// B. the data: data/sprite_edges.js differs from origin only in the ten Pisces swing rows; sw.js has its two notes back.
// C. the game: each Pisces swing row equals a LIVE probe of the art origin ships (the same 48x48 drawImage+getImageData
//    path gen_sprite_edges.mjs and sprite_edges_test.mjs use), and the game's own table reader answers every frame.
import { chromium } from 'playwright-core';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, unlinkSync, appendFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.LX_REPO || ROOT;
const PORT = process.env.PORT || '12951';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const rd = (rel) => readFileSync(path.join(REPO, rel), 'utf8').replace(/\r/g, '');
const origin = (rel) => execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 30 });
const BASH = ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find((b) => existsSync(b)) || 'bash';
const sh = (cwd, script) => spawnSync(BASH, ['-c', script], { cwd, encoding: 'utf8' });
const PISCES = ['fx/swing_zodiac_pisces.webp'].concat([0, 1, 2, 3, 4, 5, 6, 7, 8].map((f) => 'fx/anim/swing_zodiac_pisces_' + f + '.webp'));
const edges = (text) => { const w = {}; vm.runInNewContext(text, { window: w }); return w.LX_SPRITE_EDGES; };

// ---- A. the pipeline ----------------------------------------------------------------
const SC = rd('scripts/_ship_change.sh');
const HELPER = path.join(REPO, 'scripts/_ship_resync.sh').split('\\').join('/');
const syn = [path.join(REPO, 'scripts/_ship_change.sh'), HELPER].map((f) => existsSync(f) ? sh(REPO, 'bash -n "' + f.split('\\').join('/') + '"').status : 'missing');
check(syn[0] === 0 && syn[1] === 0, 'both pipeline scripts exist and parse (bash -n)', syn);
check(SC.includes('. scripts/_ship_resync.sh ||'), '_ship_change.sh loads the re-sync helpers, and stops if they are missing', null);
check(!/checkout "\$TIP" -- "\$p" 2>\/dev\/null && break/.test(SC) && SC.includes('lx_resync_one "$TIP" "$p" || return 1'), 'the re-sync no longer swallows a failed checkout: it stops the chain', null);
const iv = SC.indexOf('lx_resync_verify "$TIP" $EXTRA || return 1'), ia = SC.indexOf('node "$LX_APPLY" ||'), ib = SC.indexOf('node "$LX_APPLY2" ||');
check(iv > 0 && iv < ia && ia < ib, 'every re-synced path is hash-verified before either apply runs', { iv, ia, ib });
check(SC.includes('node "$LX_TEST" > "$log" 2>&1') && SC.includes('full output: $(cygpath -w "$log"') && !SC.includes('| tail -3 | tee /dev/stderr'), 'the confirming test keeps its whole output in a log and names it on failure', null);
{
  const R = mkdtempSync(path.join(os.tmpdir(), 'lx_resync_'));
  const g = (...a) => execFileSync('git', a, { cwd: R, stdio: 'pipe' });
  try {
    g('init', '-q'); g('config', 'core.autocrlf', 'true'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
    writeFileSync(path.join(R, 't.txt'), 'row a\nrow b\n'); g('add', 't.txt'); g('commit', '-qm', 'one');
    writeFileSync(path.join(R, 't.txt'), 'row a\nrow B (another session)\n'); g('add', 't.txt'); g('commit', '-qm', 'two');
    writeFileSync(path.join(R, 't.txt'), 'row a\r\nrow b\r\n');           // the stale working copy
    writeFileSync(path.join(R, '.git', 'index.lock'), '');                 // the 0-byte lock a killed git left behind
    const r2 = sh(R, '. "' + HELPER + '"; lx_resync_verify HEAD t.txt');
    check(r2.status !== 0 && /VERIFY FAILED: t\.txt/.test(r2.stderr), 'scratch repo: the stale file fails the hash check against origin', { status: r2.status, err: r2.stderr.slice(0, 200) });
    // lock-proof-resync: the re-sync no longer goes through the index, so a stale lock neither stops it nor is touched by it
    // (scripts/lock_proof_resync_test.mjs covers the rest: the cause reproduced, checkout-identical bytes, the reaper).
    const r1 = sh(R, '. "' + HELPER + '"; LX_RESYNC_SLEEP=0 lx_resync_one HEAD t.txt');
    check(r1.status === 0 && existsSync(path.join(R, '.git', 'index.lock')), 'scratch repo: a stale index.lock no longer blocks the re-sync, and is left where it is', { status: r1.status, err: r1.stderr.slice(0, 300) });
    unlinkSync(path.join(R, '.git', 'index.lock'));
    const r3 = sh(R, '. "' + HELPER + '"; lx_resync_verify HEAD t.txt brand_new.webp');
    const body = readFileSync(path.join(R, 't.txt'), 'utf8');
    check(r3.status === 0 && body.includes('row B') && body.includes('\r\n'), 'scratch repo: the re-synced CRLF copy verifies, a new path is skipped', { status: r3.status, err: r3.stderr.slice(0, 200), body });
    appendFileSync(path.join(R, 't.txt'), 'row c\r\n');                   // changed after the re-sync (another local session)
    const r4 = sh(R, '. "' + HELPER + '"; lx_resync_verify HEAD t.txt');
    check(r4.status !== 0 && /VERIFY FAILED/.test(r4.stderr), 'scratch repo: a file changed after the re-sync is caught too', { status: r4.status });
  } catch (e) { check(false, 'scratch repo runs', String(e.message).slice(0, 200)); }
  finally { try { rmSync(R, { recursive: true, force: true }); } catch (e) {} }
}

// ---- B. the data -----------------------------------------------------------------------
{
  const T0 = edges(origin('data/sprite_edges.js').toString('utf8')), T1 = edges(rd('data/sprite_edges.js'));
  const moved = [...new Set([...Object.keys(T0), ...Object.keys(T1)])].filter((k) => T0[k] !== T1[k]);
  check(PISCES.every((k) => T1[k] === ''), 'sprite_edges: the ten Pisces swing rows are back as v0.30.1785 measured them (clean, "")', PISCES.map((k) => T1[k]));
  check(moved.every((k) => PISCES.includes(k)), 'sprite_edges: no other row differs from origin', moved.filter((k) => !PISCES.includes(k)).slice(0, 5));
  const sw = rd('sw.js'), n82 = sw.indexOf('// v0.30.1782 - v171 -> v172. Pisces'), n85 = sw.indexOf('// v0.30.1785 - v172 -> v173. Pisces'), nAr = sw.indexOf('// arbiter-regen - v171 -> v172.');
  let compiles = true; try { new vm.Script(sw); } catch (e) { compiles = false; }
  check(compiles && n82 > 0 && n82 < n85 && n85 < nAr, 'sw.js: the v0.30.1782 and v0.30.1785 cache notes are back, in order, and it still compiles', { n82, n85, nAr, compiles });
}

// ---- C. the game -----------------------------------------------------------------------
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: origin(rel) }); } catch (e) { r.continue(); }
  });
  // The art origin ships, never a stale working-copy copy: the rows must describe what players download.
  await p.route((u) => /[/]Sprites[/]fx[/](anim[/])?swing_zodiac_pisces(_\d)?[.]webp$/.test(u.pathname), (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    r.fulfill({ status: 200, contentType: 'image/webp', body: origin(rel) });
  });
  if (REPO !== ROOT) await p.route((u) => /[/]data[/]sprite_edges[.]js$/.test(u.pathname), (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(path.join(REPO, 'data/sprite_edges.js')) }));
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _lxEdgesFromTable === 'function' && !!window.LX_SPRITE_EDGES, null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 40;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999;
  });
  const t0 = await p.evaluate(() => game.time || 0);
  for (let i = 0; i < 60 && (await p.evaluate(() => game.time || 0)) - t0 < 30; i++) await p.waitForTimeout(250);
  const R = await p.evaluate(async (keys) => {
    const S = 48, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const probe = (img) => {   // gen_sprite_edges.mjs / sprite_edges_test.mjs, verbatim
      g.clearRect(0, 0, S, S); g.drawImage(img, 0, 0, S, S);
      const d = g.getImageData(0, 0, S, S).data, a = (x, y) => d[(y * S + x) * 4 + 3];
      const scan = (get) => { let n = 0, first = -1, last = -1; for (let i = 0; i < S; i++) if (get(i) > 24) { n++; if (first < 0) first = i; last = i; } return n > 1 ? (n + ':' + first + ':' + last) : ''; };
      const v = [scan((i) => a(0, i)), scan((i) => a(S - 1, i)), scan((i) => a(i, 0)), scan((i) => a(i, S - 1))].join('|');
      return v === '|||' ? '' : v;
    };
    const out = {};
    for (const k of keys) {
      const img = await new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = 'Sprites/' + k; });
      if (img && img.decode) { try { await img.decode(); } catch (e) {} }
      const fromTable = img ? _lxEdgesFromTable(img) : 'no image';
      out[k] = { table: window.LX_SPRITE_EDGES[k], live: img && img.naturalWidth ? probe(img) : 'MISSING', reader: fromTable === undefined ? 'undefined' : JSON.stringify(fromTable) };
    }
    return out;
  }, PISCES);
  for (const k of PISCES) check(R[k].table !== undefined && R[k].table === R[k].live, 'game: ' + k + ' row equals a live probe of the shipped art', R[k]);
  check(PISCES.every((k) => R[k].reader !== 'undefined'), "game: the game's own table reader answers every Pisces swing frame (none falls back to a live probe)", PISCES.map((k) => R[k].reader));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
