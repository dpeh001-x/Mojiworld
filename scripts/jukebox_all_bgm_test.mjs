// DJ Vinyl's jukebox carries, unlocks and plays every BGM in the game.
// ============================================================================
// Per user: "ensure that the jukebox NPCs plays all the available BGM in the game".
//
//   1. EVERY BGM THE GAME PLAYS IS LISTED: every file in _BGM_MAP_FILES, the generic boss theme, the default
//      world theme and the start-page theme are all in JUKEBOX_TRACKS
//   2. EVERY LISTED FILE EXISTS ON ORIGIN (checked with git, not the working copy, which lags plumbing pushes)
//   3. EVERY TRACK CAN BE UNLOCKED: it is either `always` or its file is one _setBossBgm actually plays
//   4. DISCOVERY STILL LOCKS: on a fresh save an ordinary track is locked...
//   5. ...AND THE REAL MAP PATH OPENS THE NEW ONES: _setBossBgm on Bone Graveyard and the Inner Dimension
//   6. THE TWO WITH NO IN-WORLD SOURCE ARE OPEN FROM THE START, in the rendered list too
//   7. THE JUKEBOX PLAYS EVERY TRACK: open it, click every row, and each one becomes the playing track with its
//      own file on the BGM element
//   8. EVERY DJ VINYL OPENS THE SAME CATALOGUE: all jukebox NPCs route to openJukebox
// Run: node scripts/jukebox_all_bgm_test.mjs   (MOJI_GAME_FILE=... for a private build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 13421);
const TITLE = 'audio/Moji is loading.mp3';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 300) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 747 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  page.on('pageerror', () => {});
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);

  const R = await page.evaluate(async (TITLE) => {
    const out = {};
    const tracks = JUKEBOX_TRACKS.flatMap((g) => g.tracks);
    out.nTracks = tracks.length;
    out.files = tracks.map((t) => t.file);
    const listed = new Set(out.files);
    const played = new Set([...Object.values(_BGM_MAP_FILES), 'audio/bgm_boss.mp3', 'audio/bgm_mojiworld.mp3']);
    const src = [...document.scripts].map((sc) => sc.textContent || '').join('\n');
    out.titleInGame = src.includes("'" + TITLE + "'");
    out.unlisted = [...played, TITLE].filter((f) => !listed.has(f));
    out.maps = Object.keys(_BGM_MAP_FILES).length;
    // 3. unlockable
    out.stuck = tracks.filter((t) => !t.always && !played.has(t.file)).map((t) => t.id);
    out.always = tracks.filter((t) => t.always).map((t) => t.id);
    // 4-6. discovery on a fresh save
    game._jukeboxHeard = {};
    out.freshLocked = { boneGraveyard: _isTrackHeard('boneGraveyard'), echoArenas: _isTrackHeard('echoArenas'), town: _isTrackHeard('town') };
    out.freshAlways = { titleTheme: _isTrackHeard('titleTheme'), zodiacHall: _isTrackHeard('zodiacHall') };
    try { _setBossBgm(false, 'boneGraveyard'); } catch (e) { out.err1 = String(e); }
    try { _setBossBgm(true, 'innerDimension'); } catch (e) { out.err2 = String(e); }
    out.afterMaps = { boneGraveyard: _isTrackHeard('boneGraveyard'), echoArenas: _isTrackHeard('echoArenas') };
    game._jukeboxHeard = {};
    openJukebox();
    const rows0 = [...document.querySelectorAll('#jukebox-list .jb-track')];
    out.freshOpenRows = rows0.filter((r) => !r.classList.contains('locked')).map((r) => r.dataset.trackId);
    closeJukebox();
    // 7. play every track
    game._jukeboxHeard = {};
    for (const t of tracks) game._jukeboxHeard[t.id] = true;
    openJukebox();
    const rows = [...document.querySelectorAll('#jukebox-list .jb-track')];
    out.rows = rows.length;
    out.playFails = [];
    for (const row of rows) {
      const id = row.dataset.trackId, t = tracks.find((x) => x.id === id);
      row.click();
      const srcNow = decodeURIComponent((_bgmEl && _bgmEl.src) || '');
      if (!_jukeboxPlaying || _jukeboxPlaying.trackId !== id || !srcNow.endsWith(t.file)) out.playFails.push(id + ' -> ' + (_jukeboxPlaying && _jukeboxPlaying.trackId) + ' ' + srcNow.split('/').slice(-2).join('/'));
    }
    jukeboxStop(); closeJukebox();
    // 8. every jukebox NPC
    const djs = [];
    for (const id of Object.keys(MAPS)) for (const n of (MAPS[id].npcs || [])) if (n && n.role === 'jukebox') djs.push(id + ':' + n.name);
    out.djs = djs;
    out.djRoutes = /npc\.role === 'jukebox'[\s\S]{0,1200}openJukebox\(\)/.test(src);
    return out;
  }, TITLE);

  // 2. existence on origin
  const missing = [];
  for (const f of new Set(R.files)) {
    try { execFileSync('git', ['-C', ROOT, 'cat-file', '-e', 'origin/main:' + f], { stdio: 'ignore' }); } catch (e) { missing.push(f); }
  }
  console.log(`  ${R.nTracks} tracks, ${R.maps} maps with BGM | unlisted ${JSON.stringify(R.unlisted)} | stuck ${JSON.stringify(R.stuck)} | always ${JSON.stringify(R.always)}`);
  console.log(`  fresh ${JSON.stringify(R.freshLocked)} always ${JSON.stringify(R.freshAlways)} after maps ${JSON.stringify(R.afterMaps)} | open rows on a fresh save ${JSON.stringify(R.freshOpenRows)}`);
  console.log(`  rows ${R.rows} play fails ${JSON.stringify(R.playFails)} | DJs ${JSON.stringify(R.djs)} routes ${R.djRoutes} | missing on origin ${JSON.stringify(missing)}`);

  ok('EVERY BGM THE GAME PLAYS IS LISTED: all map themes, the boss and world defaults, and the title theme',
    R.titleInGame && R.unlisted.length === 0,
    `${R.maps} maps checked; unlisted: ${JSON.stringify(R.unlisted)}`);
  ok('EVERY LISTED FILE EXISTS ON ORIGIN', missing.length === 0, `${new Set(R.files).size} files; missing: ${JSON.stringify(missing)}`);
  ok('EVERY TRACK CAN BE UNLOCKED: `always`, or a file _setBossBgm actually plays',
    R.stuck.length === 0, `never-unlockable: ${JSON.stringify(R.stuck)}`);
  ok('DISCOVERY STILL LOCKS: ordinary tracks are closed on a fresh save',
    R.freshLocked.boneGraveyard === false && R.freshLocked.echoArenas === false && R.freshLocked.town === false,
    JSON.stringify(R.freshLocked));
  ok('THE REAL MAP PATH OPENS THE NEW TRACKS: Bone Graveyard and the Inner Dimension',
    R.afterMaps.boneGraveyard === true && R.afterMaps.echoArenas === true && !R.err1 && !R.err2,
    JSON.stringify(R.afterMaps) + (R.err1 || R.err2 ? ' ' + (R.err1 || R.err2) : ''));
  ok('THE TWO WITH NO IN-WORLD SOURCE ARE OPEN FROM THE START, in the rendered list too',
    R.freshAlways.titleTheme && R.freshAlways.zodiacHall && R.freshOpenRows.length === 2 && R.freshOpenRows.includes('titleTheme') && R.freshOpenRows.includes('zodiacHall'),
    `open on a fresh save: ${JSON.stringify(R.freshOpenRows)}`);
  ok('THE JUKEBOX PLAYS EVERY TRACK: each row becomes the playing track with its own file',
    R.rows === R.nTracks && R.playFails.length === 0,
    `${R.rows} rows for ${R.nTracks} tracks; failures ${JSON.stringify(R.playFails)}`);
  ok('EVERY DJ VINYL OPENS THE SAME CATALOGUE',
    R.djs.length >= 1 && R.djRoutes,
    `${R.djs.length} jukebox NPC(s): ${JSON.stringify(R.djs)}; all route to openJukebox: ${R.djRoutes}`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let nbad = 0;
for (const r of res) { if (!r.pass) nbad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(nbad ? `\n${nbad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(nbad ? 1 : 0);
