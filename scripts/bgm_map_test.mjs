// Map music (v0.30.406): every map plays its track after the readiness gate.
// The gate (v0.30.361) called load() on the map's music element while loadMap's
// fade-in was already playing it; load() pauses a playing element, so a track
// still buffering when the gate reached its music step - a first visit to a
// 5 MB track - came up at full volume and paused: silence for the whole stay.
// Audio responses are delayed here so every first visit hits that window.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
//   BGM_DELAY (ms, default 2500) delays audio responses; BGM_SWEEP=all visits every map.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10181); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT; const DELAY = Number(process.env.BGM_DELAY || 2500);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); const page = await browser.newPage();
await page.route('**/audio/**', async (route) => { await new Promise((r) => setTimeout(r, DELAY)); try { await route.continue(); } catch (e) {} });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _setBossBgm === 'function' && typeof _lxReadyGate === 'function' && typeof _bgmMapEl === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  // a veteran save: every story beat seen (so no cutscene owns the mix on arrival), the loading score handed back
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { if (typeof _cineScoreStop === 'function') _cineScoreStop(1, false); } catch (e) {} try { if (typeof _lxMenuBgmStop === 'function') _lxMenuBgmStop(); } catch (e) {} player.level = 99; });
  await page.waitForTimeout(800);
  // visit a map the way the game does (loadMap runs the gate and the fade), then read what is audible
  const visit = (id) => page.evaluate(async (id) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const n0 = (window._lxReadyGateLog || []).length;
    try { loadMap(id); } catch (e) { return { id, err: String(e && e.message).slice(0, 80) }; }   // the map's own entry point: a fixed x lands in a pit on some maps, and a fall death respawns in the Void
    await sleep(50); if (game.currentMap !== id) return { id, err: 'redirected to ' + game.currentMap };
    player.hp = player.maxHp; player.invulnerable = 9e9;
    const t0 = performance.now(); while ((window._lxReadyGateLog || []).length <= n0 && performance.now() - t0 < 9000) await sleep(100);
    await sleep(2500);
    if (game.currentMap !== id) return { id, err: 'left for ' + game.currentMap + ' during the wait' };
    const md = (typeof MAPS !== 'undefined' && MAPS[id]) || {}; const el = _bgmActiveMapEl || (md.isBossArena ? _bgmBossEl : _bgmEl);
    const want = (typeof _BGM_MAP_FILES !== 'undefined' && _BGM_MAP_FILES[id]) || (md.isBossArena ? 'audio/bgm_boss.mp3' : 'audio/bgm_mojiworld.mp3');
    const t1 = el ? el.currentTime : -1; await sleep(700);
    return { id, want, src: el ? decodeURIComponent((el.src || '').replace(/^.*\/audio\//, 'audio/')) : null, paused: el ? el.paused : null, ready: el ? el.readyState : -1, vol: el ? +el.volume.toFixed(2) : -1, t: el ? +el.currentTime.toFixed(2) : -1, adv: el ? +(el.currentTime - t1).toFixed(2) : 0, gate: (window._lxReadyGateLog || []).slice(-1)[0] };
  }, id);
  const playing = (r) => r && !r.err && r.src === r.want && r.paused === false && r.vol > 0.1 && r.adv > 0.3;
  // 1. the report: a first visit to Verdant Hollow, its 5 MB track still buffering when the gate tunes the music
  const vh = await visit('verdantHollow');
  console.log('verdantHollow ' + JSON.stringify(vh));
  ok('a first visit to Verdant Hollow plays bgm_bloom.mp3 after the gate (not paused, volume up, time advancing)', playing(vh), JSON.stringify({ src: vh.src, paused: vh.paused, ready: vh.ready, vol: vh.vol, adv: vh.adv, gateBgm: vh.gate && vh.gate.bgm }));
  // 2. the sweep: one map per distinct track (each a first visit, so each hits the same window), plus the default and boss fallbacks
  const ids = await page.evaluate((all) => { const seen = new Set(); const out = []; for (const k of Object.keys(_BGM_MAP_FILES)) { if (!(typeof MAPS !== 'undefined' && MAPS[k])) continue; const f = _BGM_MAP_FILES[k]; if (!all && seen.has(f)) continue; seen.add(f); out.push(k); } for (const k of (all ? Object.keys(MAPS) : ['forest', 'mushroom'])) if (!out.includes(k) && MAPS[k]) out.push(k); return out.filter((k) => k !== 'verdantHollow'); }, process.env.BGM_SWEEP === 'all');
  const bad = [], skipped = []; let n = 0;
  for (const id of ids) { const r = await visit(id); n++; if (r.err) { skipped.push(id + ':' + r.err); continue; } if (!playing(r)) bad.push(id + ' ' + JSON.stringify({ want: r.want, src: r.src, paused: r.paused, ready: r.ready, vol: r.vol, adv: r.adv })); }
  console.log('swept ' + n + ' maps' + (skipped.length ? '; loadMap threw on ' + skipped.join(', ') : ''));
  ok('every swept map plays the track the table names, at volume, advancing (' + (n - skipped.length) + ' maps)', bad.length === 0 && n - skipped.length >= 30, bad.join(' | '));
  // 3. a first visit whose map beat DOES fire: the cutscene silences the beds, and the hand-back after it closes brings the map theme up
  const beat = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); player._storyBeatsSeen = {}; const ov = document.getElementById('story-beat-overlay');
    try { loadMap('verdantHollow'); } catch (e) { return { err: String(e && e.message).slice(0, 80) }; }   // its continent-arrival beat is a scored cinematic
    player.hp = player.maxHp; player.invulnerable = 9e9; let fired = false; const t0 = performance.now(); while (performance.now() - t0 < 6000) { if (ov && ov.classList.contains('on')) { fired = true; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); } else if (fired) break; await sleep(250); }
    await sleep(3000); const el = _bgmActiveMapEl || _bgmEl; const t1 = el.currentTime; await sleep(700);
    return { fired, src: decodeURIComponent((el.src || '').replace(/^.*\/audio\//, 'audio/')), paused: el.paused, vol: +el.volume.toFixed(2), adv: +(el.currentTime - t1).toFixed(2), cine: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null };
  });
  ok('a map beat that fires on arrival hands the mix back to the map theme when it closes', !beat.err && beat.fired === true && beat.src === 'audio/bgm_bloom.mp3' && beat.paused === false && beat.vol > 0.1 && beat.adv > 0.3 && beat.cine === false, JSON.stringify(beat));
  // 4. every file the table names is served
  const served = await page.evaluate(async () => { const out = []; for (const f of [...new Set(Object.values(_BGM_MAP_FILES))]) { try { const r = await fetch(f, { method: 'HEAD' }); if (r.status !== 200) out.push(f + ':' + r.status); } catch (e) { out.push(f + ':err'); } } return out; });
  ok('every track the table names is served (HTTP 200)', served.length === 0, served.join(' '));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
