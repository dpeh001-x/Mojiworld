// RELEASE 15c (bug hunt round 15, part C - audio and films) stays fixed. Chrome plays with sound (no --mute-audio, autoplay
// allowed); every Music / SFX / Mute change goes through the real Settings controls; what is checked is each media element's
// volume / muted / paused (a headless run cannot listen):
//   [1] the nine story films (prologue daggers + punch, Gravitos's entry, Guguma's rebirth, the ending, the Sovereign's fall,
//       "It's him", Gravitos's shadow, his defeat) take the Music slider (40% -> 0.4) and go silent on Mute
//   [2] the Everdawn welcome film takes Mute and the slider, the town music is silent under it (3 s in, past the mix
//       watchdog) and comes back after it
//   [3] Mute in Background reaches films: a kill film, Gravitos's voice line and the captains' teaser go muted AND paused on
//       blur and resume (sound back, time moving) on focus; a story-beat clip with sound stays muted past its 400 ms timer;
//       a film's backstop counts foreground time only; a film that played and was skipped stays spent
//   [4] the SFX slider reaches per-monster clips (audio/monster/): a loaded clip follows 0% / 50%, one loaded at 0% follows
//       the slider up, one still loading during a slider move plays at today's level
//   [5] the town theme started right after the menu appears is not reset by the auth gate's 2.5 s warm-up load()
//   [6] a film whose file fails (404) is not spent: the captains' teaser, a kill film and the welcome film are unseen again
//   node release15c_test.mjs        PORT / SERVE_ROOT (the repo to serve) override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15100), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b) => Math.abs(a - b) < 0.02;
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1400, height: 820 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const ev = (f, a) => page.evaluate(f, a);
// the real Settings panel: sliders by input events (what dragging does), Mute by a click on its switch
async function setAudio(o) {
  await ev(() => { try { closeAllModals(); } catch (e) {} openSettingsModal(); });
  await sleep(150);
  if (o.bgm != null) await page.fill('#set-bgm', String(o.bgm));
  if (o.sfx != null) await page.fill('#set-sfx', String(o.sfx));
  if (o.mute != null && (await ev(() => document.getElementById('set-mute').classList.contains('on'))) !== o.mute) await page.click('#set-mute');
  await sleep(150);
  await ev(() => { try { closeSettingsModal(); } catch (e) {} try { closeAllModals(); } catch (e) {} });
  await sleep(150);
}
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  // [5] the menu is up: start the town theme at once, as Continue inside 2.5 s does (_finishHide: menu music stops, startBgm)
  await page.waitForFunction(() => window._lxBootMenuSeen === true, null, { timeout: 240000, polling: 50 });
  const t5 = await ev(async () => {
    const t0 = performance.now(); try { window._lxMenuBgmStop(0); } catch (e) {}
    _bgmEl.muted = false; _bgmEl.volume = 0.5; try { await _bgmEl.play(); } catch (e) {}
    const at = Math.round(performance.now() - t0); await new Promise((r) => setTimeout(r, 3800));
    return { at, paused: _bgmEl.paused, t: Math.round(_bgmEl.currentTime * 10) / 10 };
  });
  ok('[5] the town theme started as the menu appears is still playing 3.8 s later (the 2.5 s warm-up load() left it alone)', !t5.paused && t5.t > 2, t5);
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof player !== 'undefined', null, { timeout: 240000 });
  await ev(async () => {
    try { _bgmEl.pause(); } catch (e) {}
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    window.__unseen = new Set(['everdawn_welcome', 'captains_teaser', 'mira_ashes', 'gravitos_awaken', 'mira_aetherion', 'zodiac_twelve_done']);
    player._storyBeatsSeen = new Proxy({}, { get: (t, k) => (k in t) ? t[k] : !window.__unseen.has(k), has: () => true });
    player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.level = 60; player._god = true; player.maxHp = player.hp = 9e6;
    try { closeAllModals(); } catch (e) {}
    loadMap('forest', 300); game.paused = false; await new Promise((r) => setTimeout(r, 1500));
  });
  console.log('build', await ev(() => GAME_VERSION));
  // [1] the nine story films
  const NINE = [['_prologueDaggerCutscene', 'plg-dagger-vid'], ['_prologuePunchCutscene', 'plg-punch-vid'], ['_gravitosEntryCutscene', 'grav-entry-vid'],
    ['_gugumaRebirthCutscene', 'gug-reb-vid'], ['_gugumaToyboxCutscene', 'gug-toy-vid'], ['_sovereignFallCutscene', 'sov-fall-vid'],
    ['_amnesiacItsHimCutscene', 'amn-ih-vid'], ['_gravitosShadowRevealCutscene', 'grav-shd-vid'], ['_gravitosDefeatCutscene', 'grav-def-vid']];
  const film = (fn, vid) => ev(async ([fn, vid]) => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    try { window[fn](() => {}, () => {}); } catch (e) { return { err: String(e).slice(0, 80) }; }
    let v = null; const t0 = performance.now();
    while (performance.now() - t0 < 9000) { v = document.getElementById(vid); if (v && v.volume !== 1 && v.readyState >= 2) break; await w(100); }
    const r = v ? { vol: Math.round(v.volume * 100) / 100, muted: v.muted } : { missing: true };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(250);
    const left = v && v.isConnected; if (left) { try { v.closest('div[id]').click(); } catch (e) {} }
    await w(300); try { game.paused = false; } catch (e) {} return r;
  }, [fn, vid]);
  for (const [mute, bgm] of [[false, 40], [true, 40]]) {
    await setAudio({ bgm, mute });
    const got = {}; for (const [fn, vid] of NINE) got[fn.replace(/Cutscene$/, '').replace(/^_/, '')] = await film(fn, vid);
    const good = Object.values(got).every((r) => !r.err && !r.missing && (mute ? (r.muted === true) : (r.muted === false && near(r.vol, 0.4))));
    ok(mute ? '[1] Mute: all nine story films are silent' : '[1] Music 40%: all nine story films play at 0.4 (not 0.9)', good, got);
  }
  await setAudio({ bgm: 90, mute: false });
  // [2] the Everdawn welcome film
  const beds = () => ev(() => [_bgmEl, _bgmBossEl, ...Object.values(_bgmMapEls || {})].filter((e) => e && !e.paused && !e.muted && e.volume > 0.02).map((e) => String(e.currentSrc || e.src).split('/').pop()));
  const welcome = (wait) => ev(async (wait) => {
    delete player._storyBeatsSeen.everdawn_welcome; const r0 = _playEverdawnWelcome();
    await new Promise((r) => setTimeout(r, wait)); const v = document.querySelector('#everdawn-welcome-overlay video');
    return { r0, vol: v ? Math.round(v.volume * 100) / 100 : null, muted: v ? v.muted : null, playing: v ? !v.paused && v.currentTime > 0.2 : null };
  }, wait);
  const esc = async () => { await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await sleep(900); await ev(() => { game.paused = false; }); };
  await setAudio({ bgm: 40, mute: true });
  const w1 = await welcome(1200); await esc();
  ok('[2] welcome film on Mute: silent', w1.r0 === true && w1.muted === true, w1);
  await setAudio({ bgm: 40, mute: false });
  await ev(async () => { loadMap('town', 300); game.paused = false; });
  let pre = []; for (let i = 0; i < 40 && !pre.length; i++) { await sleep(250); pre = await beds(); }
  const w2 = await welcome(3200); const during = await beds(); await esc(); await sleep(2600); const after = await beds();
  ok('[2] welcome film at Music 40%: plays at 0.4 with sound; the town music is silent under it (3 s in) and back after it',
    pre.length > 0 && w2.r0 === true && near(w2.vol, 0.4) && w2.muted === false && w2.playing && during.length === 0 && after.length > 0, { pre, ...w2, during, after });
  await setAudio({ bgm: 90, mute: false });
  await ev(async () => { loadMap('forest', 300); game.paused = false; await new Promise((r) => setTimeout(r, 800)); });
  // [3] Mute in Background: films and a film's voice go muted and paused, and come back
  const bgCycle = (open, pick) => ev(async ([open, pick]) => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), S = (e) => e ? { muted: e.muted, paused: e.paused, t: Math.round(e.currentTime * 10) / 10 } : null;
    try { closeAllModals(); } catch (e) {} game.paused = false; (new Function(open))();
    const get = () => (new Function('return ' + pick))(); let e = null; const t0 = performance.now();
    while (performance.now() - t0 < 12000) { e = get(); if (e && !e.paused && e.currentTime > 0.5) break; await w(100); }
    const a = S(e); window.dispatchEvent(new Event('blur')); await w(300); const b = S(e); await w(1200); const c = S(e);
    window.dispatchEvent(new Event('focus')); await w(900); const d = S(e);
    return { a, b, c, d };
  }, [open, pick]);
  const held = (r) => r.a && !r.a.paused && !r.a.muted && r.b.muted && r.b.paused && r.c.t === r.b.t && !r.d.muted && !r.d.paused && r.d.t > r.c.t;
  const k1 = await bgCycle('_lxPlayKillFilm(LX_KILL_FILMS.sundered_smith)', 'game._lxKillFilmEl'); await esc();
  const k1s = await ev(() => ({ seen: player._storyBeatsSeen.mira_ashes, ov: !!document.getElementById('kill-film-overlay') }));
  ok('[3] kill film (clip_mira_ashes): muted and paused on blur, sound and time back on focus', held(k1), k1);
  ok('[3] ...and once played and skipped it stays spent', k1s.seen === true && !k1s.ov, k1s);
  const k2 = await bgCycle('_lxPlayKillFilm(LX_KILL_FILMS._gravitosAwaken)', 'game._lxKillFilmVo'); await esc();
  ok("[3] Gravitos's voice line (vo_gravitos_awaken): muted and paused on blur, back on focus", held(k2), k2);
  const k3 = await bgCycle('_lxPlayCaptainsTeaser()', "document.querySelector('#captains-teaser-overlay video')"); await esc();
  ok("[3] the captains' teaser: muted and paused on blur, back on focus", held(k3), k3);
  const bs = await ev(async () => {
    if (typeof _lxFilmBackstop !== 'function') return { none: true };
    const w = (ms) => new Promise((r) => setTimeout(r, ms)); let at = 0; const t0 = performance.now();
    _lxFilmBackstop(() => { at = performance.now() - t0; }, 1500); await w(300); window.dispatchEvent(new Event('blur')); await w(2500);
    window.dispatchEvent(new Event('focus')); const atFocus = at; await w(1900); return { atFocus, at: Math.round(at) };
  });
  ok("[3] a film's backstop counts foreground time only (1.5 s with 2.5 s away fires ~4 s in, not at 1.5 s)", !bs.none && bs.atFocus === 0 && bs.at > 3500, bs);
  // [4] the SFX slider and the per-monster clips
  const clip = (ck, load) => ev(async ([ck, load]) => {
    const [ty, kd] = ck.split('_'); if (load) { delete _monsterCustomSfx[ck]; _probeMonsterCustomSfx(ty, kd); }
    for (let i = 0; i < 80 && !(_monsterCustomSfx[ck] && typeof _monsterCustomSfx[ck] === 'object'); i++) await new Promise((r) => setTimeout(r, 100));
    const a = _monsterCustomSfx[ck]; return a && typeof a === 'object' ? Math.round(a.volume * 1000) / 1000 : 'none:' + String(a);
  }, [ck, load]);
  await setAudio({ sfx: 70 }); const s70 = await clip('bat_hit', true);
  await setAudio({ sfx: 0 }); const s0 = await clip('bat_hit', false);
  await setAudio({ sfx: 50 }); const s50 = await clip('bat_hit', false);
  ok('[4] a loaded per-monster clip (mob_bat_hit) follows the SFX slider: 70% 0.315, 0% 0, 50% 0.225', s70 === 0.315 && s0 === 0 && s50 === 0.225, { s70, s0, s50 });
  await setAudio({ sfx: 0 }); const z0 = await clip('axolotl_hit', true); await setAudio({ sfx: 60 }); const z60 = await clip('axolotl_hit', false);
  ok('[4] a clip loaded at 0% (mob_axolotl_hit) is not stuck silent: 60% -> 0.27', z0 === 0 && z60 === 0.27, { z0, z60 });
  await page.route('**/mob_anglerfish_hit.mp3', async (r) => { await sleep(2500); await r.continue(); });   // still loading when the slider moves
  await setAudio({ sfx: 0 }); await ev(() => { delete _monsterCustomSfx.anglerfish_hit; _probeMonsterCustomSfx('anglerfish', 'hit'); });
  await setAudio({ sfx: 80 }); const p0 = await clip('anglerfish_hit', false);
  const p1 = await ev(async () => { _lastMonsterHitSfxTime = 0; _playMonsterSfx({ type: 'anglerfish' }, 'hit'); await new Promise((r) => setTimeout(r, 150)); const a = _monsterCustomSfx.anglerfish_hit; return { vol: Math.round(a.volume * 1000) / 1000, playing: !a.paused }; });
  ok('[4] a clip still loading during a slider move (mob_anglerfish_hit; loaded at the old 0) plays at the new level (80% -> 0.36)', p0 === 0 && p1.vol === 0.36 && p1.playing, { p0, ...p1 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await setAudio({ sfx: 70 });
  // [6] a film whose file fails is not spent
  for (const f of ['clip_four_captains.mp4', 'clip_mira_aetherion.mp4', 'clip_everdawn_welcome.mp4']) await page.route('**/' + f, (r) => r.fulfill({ status: 404, body: 'gone' }));
  const lost = async (open, key, ov) => ev(async ([open, key, ov]) => {
    try { closeAllModals(); } catch (e) {} game.paused = false; delete player._storyBeatsSeen[key]; (new Function(open))();
    await new Promise((r) => setTimeout(r, 2500));
    return { seen: player._storyBeatsSeen[key], ov: !!document.getElementById(ov), paused: !!game.paused, open: player._lxFilmOpen || null };
  }, [open, key, ov]);
  const l1 = await lost('_lxPlayCaptainsTeaser()', 'captains_teaser', 'captains-teaser-overlay');
  const l2 = await lost('_lxPlayKillFilm(LX_KILL_FILMS.miraFallen)', 'mira_aetherion', 'kill-film-overlay');
  const l3 = await lost('_playEverdawnWelcome()', 'everdawn_welcome', 'everdawn-welcome-overlay');
  const unspent = (r) => r.seen === false && !r.ov && !r.paused && !r.open;
  ok("[6] a 404 film is not spent - the captains' teaser plays next time", unspent(l1), l1);
  ok('[6] ...a kill film (clip_mira_aetherion) plays next time', unspent(l2), l2);
  ok('[6] ...the Everdawn welcome film plays next time', unspent(l3), l3);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  // [3] a story-beat clip with sound (zodiac_twelve_done) stays muted in the background past its 400 ms timer
  const sb = await ev(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)); try { closeAllModals(); } catch (e) {} game.paused = false;
    delete player._storyBeatsSeen.zodiac_twelve_done; _playStoryBeat('zodiac_twelve_done');
    let v = null; const t0 = performance.now(); while (performance.now() - t0 < 12000) { v = document.getElementById('story-beat-clip'); if (v && !v.paused && v.currentTime > 0.3) break; await w(100); }
    if (!v) return { none: true };
    const a = v.muted; window.dispatchEvent(new Event('blur')); await w(1300); const b = v.muted;
    window.dispatchEvent(new Event('focus')); await w(900); const c = v.muted;
    try { document.getElementById('story-beat-overlay').classList.remove('on'); _sbDetachClip(); _cineScoreStop(0, true); } catch (e) {} game.paused = false;
    return { a, b, c };
  });
  ok('[3] a story-beat clip with sound stays muted in the background (its 400 ms timer no longer unmutes it) and sounds again on return', sb.a === false && sb.b === true && sb.c === false, sb);
  const bad = errs.filter((e) => !/Failed to load|NotSupported|AbortError|play\(\) request|NotAllowed/i.test(e));
  ok('no page errors', bad.length === 0, bad.slice(0, 3));
} catch (e) { ok('harness: ' + String(e && e.message || e).slice(0, 200), false); }
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
