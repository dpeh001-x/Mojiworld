// Live test: THE SOVEREIGN FALLS — the B10 defeat cinematic. Per user:
// "Generate a video using higgsfield when the towersovereign is slain at the
// b10 map, the towersovereign dissolves and disintegrates only to see the
// amnesiac laid kneeling down unconscious" / "make it dramatic and cinematic
// 720p" / "ensure that sound is generated as well".
//
// Graded: the clip beside the game at 720p with a real AUDIO track, the kill
// chain wiring (only the Sovereign, and completion always reached), real
// UNMUTED playback, the floor held under the overlay and released after,
// skip, the warm fetch, and fail-open with no soft-lock.
//   node scripts/sovereign_fall_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const clipPath = 'steam/higgsfield/cinematics/clip_sovereign_fall.mp4';
const clipBytes = existsSync(clipPath) ? readFileSync(clipPath) : null;
ok('the clip ships beside the game', !!clipBytes, clipPath);
// An mp4 with sound carries a 'soun' handler atom — the "ensure that sound is
// generated as well" half that can be graded from the file itself.
ok('the clip carries an AUDIO track (sound was generated)',
  !!clipBytes && clipBytes.includes(Buffer.from('soun')), '');
// 720p, per the brief and the house economy note (never 1080p). The avc1
// VisualSampleEntry carries the coded size as two big-endian 16-bit fields at
// +28 / +30 from the box type. 'avc1' also appears in ftyp's compatible-brand
// list, so scan every hit and take the first whose numbers can be a video.
let dims = null;
if (clipBytes) {
  for (let i = 0; (i = clipBytes.indexOf(Buffer.from('avc1'), i)) >= 0 && !dims; i++) {
    const w = clipBytes.readUInt16BE(i + 28), h = clipBytes.readUInt16BE(i + 30);
    if (w >= 16 && w <= 8192 && h >= 16 && h <= 8192) dims = { w, h };
  }
}
ok('720p (1280x720), as asked', !!dims && dims.w === 1280 && dims.h === 720, dims);

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
// No --mute-audio: audibility is part of what this grades.
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const ctx1 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx1.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _sovereignFallCutscene === 'function' || typeof drawSuperBossBar === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  out.fnExists = typeof _sovereignFallCutscene === 'function';
  const km = String(typeof _expeditionMobKilled === 'function' ? _expeditionMobKilled : '');
  // Only the Sovereign takes the cut; the legacy zodiac final boss still
  // completes the plain way, and completion is reached down every path.
  out.onlySovereign = km.includes("m.type === 'towerSovereign' && typeof _sovereignFallCutscene === 'function'");
  out.completes = km.includes('_done = true; _completeExpedition();');
  out.catchCompletes = km.includes('catch (e) { _after(); }');
  out.plainStillThere = /_completeExpedition\(\);\s*\r?\n\s*return;/.test(km);
  // The warm belongs to spawnMonster, not to the expedition's own boss spawn — he can be put on
  // a floor by routes that never touch it (the Boss Rush, the Echo Keeper).
  const sp = String(typeof spawnMonster === 'function' ? spawnMonster : '');
  out.warmWired = sp.includes('clip_sovereign_fall.mp4') && sp.includes('_lxSovCineWarm');
  const kmAll = String(typeof killMonster === 'function' ? killMonster : '');
  out.deathHook = kmAll.includes("m.type === 'towerSovereign' && !m._isMirage && !m._sovFallPlayed");
  return out;
});
ok('the cutscene helper exists', r.fnExists, '');
ok('kill chain: only the Sovereign gets the cut', r.onlySovereign, r);
ok('kill chain: the run still completes after it (and on a throw)', r.completes && r.catchCompletes, r);
ok('kill chain: the plain completion path survives for the zodiac boss', r.plainStillThere, r);
ok('the clip is warmed whenever the Sovereign is spawned, by any route', r.warmWired, r);
ok('the death itself plays it — the hook is in killMonster', r.deathHook, r);

await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3000);
const live = await page.evaluate(() => new Promise((resolve) => {
  const out = { doneFired: false };
  out.pausedBefore = !!(window.game && game.paused);
  if (window.game) game.paused = false;
  _sovereignFallCutscene(() => { out.doneFired = true; out.pausedAfter = !!(window.game && game.paused); });
  const ov = document.getElementById('sovereign-fall-cine');
  out.overlay = !!ov;
  out.heldDuring = !!(window.game && game.paused);        // the floor is held under the overlay
  out.cineHold = !!(window.game && typeof game._cineHoldUntil === 'number' && game._cineHoldUntil > Date.now());
  const vid = ov && ov.querySelector('#sov-fall-vid');
  out.srcRight = !!(vid && /clip_sovereign_fall\.mp4$/.test(vid.src));
  const poll = setInterval(() => {
    if (vid && !vid.paused && vid.currentTime > 0.05) {
      clearInterval(poll);
      out.played = true;
      out.unmuted = vid.muted === false;
      out.volume = vid.volume;
      const sk = ov.querySelector('#sov-fall-skip'); if (sk) sk.click();
      setTimeout(() => { out.overlayGone = !document.getElementById('sovereign-fall-cine'); resolve(out); }, 300);
    }
  }, 100);
  setTimeout(() => { clearInterval(poll); out.played = out.played || false; resolve(out); }, 15000);
}));
ok('overlay mounts with the clip wired', live.overlay && live.srcRight, live);
ok('the real clip actually PLAYS (currentTime advances)', live.played === true, live);
ok('AUDIBLE: playback is unmuted at volume 0.9', live.unmuted === true && live.volume >= 0.85, live);
ok('the floor is HELD under the overlay, and the watchdog told about it',
  live.heldDuring === true && live.cineHold === true, live);
ok('...and released when the scene ends', live.pausedAfter === false, live);
ok('skip fires onDone and removes the overlay', live.doneFired && live.overlayGone, live);

// INTEGRATION: the real kill path. A Sovereign death inside an active
// expedition must open the scene and hold completion until it ends — and a
// zodiac final boss must still complete the plain way, with no scene at all.
const integ = await page.evaluate(() => new Promise((resolve) => {
  const out = {};
  const _realComplete = window._completeExpedition, _realPin = window._renderExpeditionQuestPin;
  const _realGrant = window._lxGrantExpeditionFloorExp;
  let completed = 0;
  window._completeExpedition = () => { completed++; };
  window._renderExpeditionQuestPin = () => {};
  const restore = () => { window._completeExpedition = _realComplete; window._renderExpeditionQuestPin = _realPin; window._lxGrantExpeditionFloorExp = _realGrant; };
  game.expedition = { active: true, floor: 10 };
  const sov = { isBoss: true, _expeditionBoss: true, _expeditionFinalBoss: true, type: 'towerSovereign' };
  _expeditionMobKilled(sov);
  out.completedImmediately = completed;          // must be 0 — the scene comes first
  setTimeout(() => {
    const ov = document.getElementById('sovereign-fall-cine');
    out.sceneOpened = !!ov;
    out.completedDuringScene = completed;        // still 0 — the run ends when the scene does
    if (ov) ov.click();                          // skip it
    setTimeout(() => {
      out.completedAfterScene = completed;       // now 1
      // the legacy zodiac final boss: plain completion, no scene
      game.expedition = { active: true, floor: 10 };
      _expeditionMobKilled({ isBoss: true, _expeditionBoss: true, type: 'towerZodiac', zodiacSign: 'aries' });
      out.zodiacCompleted = completed;           // 2, synchronously
      out.zodiacScene = !!document.getElementById('sovereign-fall-cine');
      restore(); game.expedition = null;
      resolve(out);
    }, 400);
  }, 2200);
  setTimeout(() => { restore(); game.expedition = null; resolve(out); }, 12000);
}));
ok('INTEGRATION: a Sovereign kill on B10 opens the scene', integ.sceneOpened === true, integ);
ok('INTEGRATION: completion waits for the scene, then lands',
  integ.completedImmediately === 0 && integ.completedDuringScene === 0 && integ.completedAfterScene === 1, integ);
ok('INTEGRATION: a zodiac final boss still completes plainly, with no scene',
  integ.zodiacCompleted === 2 && integ.zodiacScene === false, integ);

// THE REAL DEATH PIPELINE. Everything above drives the hooks directly; this spawns an actual
// Sovereign on an actual map and kills him through killMonster, with no expedition anywhere — the
// Boss Rush's shape, since _bossRushRoster() is every boss in the MojiDex and so carries him.
const ctx3 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page3 = await ctx3.newPage();
const errs3 = []; page3.on('pageerror', e => errs3.push(String(e).slice(0, 160)));
await page3.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page3.waitForFunction(() => typeof killMonster === 'function' && typeof spawnMonster === 'function',
  null, { timeout: 120000 });
await page3.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
const real = await page3.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = {};
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
  try { loadMap('boss'); } catch (e) { out.err = 'loadMap ' + e.message; return out; }
  await sleep(1800);
  game.paused = false; player.invulnerable = 9e9;
  if (game.monsters) game.monsters.length = 0;
  const m = spawnMonster(400, 300, 'towerSovereign', true, false);
  out.spawned = !!m && m.type === 'towerSovereign';
  if (!m) return out;
  m._echoBoss = true; m._rushBoss = true;              // the rush's tags: a sandboxed re-fight
  out.noExpedition = !(game.expedition && game.expedition.active);
  // His first fall is not a death — revivesOnce brings him back at 30%.
  m.currentHp = 0;
  try { killMonster(m); } catch (e) { out.err1 = String(e).slice(0, 140); }
  await sleep(1900);
  out.revived = m._revivedOnce === true;
  out.sceneAfterRevive = !!document.getElementById('sovereign-fall-cine');
  // The real one.
  m.currentHp = 0;
  try { killMonster(m); } catch (e) { out.err2 = String(e).slice(0, 140); }
  out.claimedSync = m._sovFallPlayed === true;
  await sleep(1900);
  out.sceneOnDeath = !!document.getElementById('sovereign-fall-cine');
  out.heldDuring = !!game.paused;
  // Fire-once: put him back on the field and kill him again — no second scene.
  if (game.monsters && game.monsters.indexOf(m) < 0) game.monsters.push(m);
  m.currentHp = 0;
  try { killMonster(m); } catch (e) {}
  await sleep(1900);
  out.overlays = document.querySelectorAll('#sovereign-fall-cine').length;
  const ov = document.getElementById('sovereign-fall-cine'); if (ov) ov.click();
  await sleep(400);
  out.cleared = !document.getElementById('sovereign-fall-cine');
  out.released = !game.paused;
  return out;
});
ok('REAL KILL: a Sovereign spawns on a live map', real.spawned === true && real.noExpedition === true, real);
ok('REAL KILL: his first fall reanimates him and plays nothing',
  real.revived === true && real.sceneAfterRevive === false, real);
ok('REAL KILL: the real death opens the scene, with no expedition in sight',
  real.sceneOnDeath === true && real.claimedSync === true, real);
ok('REAL KILL: it holds the floor, then releases it', real.heldDuring === true && real.released === true, real);
ok('REAL KILL: it fires exactly once per monster', real.overlays === 1 && real.cleared === true, real);
ok('REAL KILL: no page errors down the death pipeline', errs3.length === 0, errs3.slice(0, 3));

const ctx2 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page2 = await ctx2.newPage();
await page2.route('**/clip_sovereign_fall.mp4', route => route.abort());
await page2.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => typeof _sovereignFallCutscene === 'function', null, { timeout: 120000 });
const fo = await page2.evaluate(() => new Promise((resolve) => {
  const t0 = performance.now();
  if (window.game) game.paused = false;
  _sovereignFallCutscene(() => resolve({ done: true, ms: Math.round(performance.now() - t0),
    overlayGone: !document.getElementById('sovereign-fall-cine'), stillPaused: !!(window.game && game.paused) }));
  setTimeout(() => resolve({ done: false, ms: 9000 }), 9000);
}));
ok('FAIL-OPEN: a blocked clip completes the run anyway, no soft-lock', fo.done && fo.ms < 6000, fo);
ok('...and leaves neither an overlay nor a stuck pause behind',
  fo.overlayGone !== false && fo.stillPaused === false, fo);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
