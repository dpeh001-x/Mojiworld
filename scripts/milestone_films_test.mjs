// The milestone films and the living title (per user: "go ahead with 1, 2 and 3,4 make all of them unique exciting AAA
// cinematic grade"):
//   1. the title: the key art's sky plays as a loop over the 4K still - never asked for before the title menu is up, then
//      playing muted and looping inside .lo-bg, on the art's own coordinates (re-placed on resize), masked across the hills,
//      and torn down when the overlay leaves; reduced motion never loads it;
//   2. the job advancement, the first zodiac kill and the master advancement each play their film with its soundtrack
//      (unmuted, audio decoding) while the scene's score (the theme the film ends on) waits silent;
//   3. each film is warmed while the player is busy (job pick, mastery pick, the sign's last words);
//   4. the films, their SPEC records and the title loop are on disk, and the films are packed for the Steam build.
// The build before fails 1-4.   node scripts/milestone_films_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11891), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const J = (o) => JSON.stringify(o).slice(0, 360);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const CINE = 'steam/higgsfield/cinematics/';
const FILMS = [['advancement_1_done', 'clip_mirror_breaks', 'bgm_interdimensional_ascension.mp3'], ['first_zodiac_kill', 'clip_three_notes', 'bgm_zodiac_sanctum.mp3'],
  ['advancement_2_done', 'clip_distortion_closes', 'The Singularity.mp3']];
const boot = async (ctx) => {
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  const reqs = []; page.on('request', (r) => { if (/title_sky_loop/.test(r.url())) reqs.push(Date.now()); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  return { page, reqs, upAt: Date.now() };
};
try {
  // ---- 1. the title -----------------------------------------------------------------------------------------------------
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const { page, reqs, upAt } = await boot(ctx);
  const early = reqs.filter((t) => t < upAt).length;
  const T = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const get = () => document.getElementById('lo-title-loop');
    for (let i = 0; i < 100 && !(get() && get().readyState >= 2 && get().currentTime > 0.3); i++) await sleep(100);
    const v = get(); if (!v) return { none: true };
    await sleep(1800);   // past the fade-in
    const t0 = v.currentTime; await sleep(600);
    const bg = document.querySelector('#loading-overlay .lo-bg'), W = bg.clientWidth, H = bg.clientHeight, k = Math.max(W / 3840, H / 2144);
    const want = { left: (W - 3840 * k) / 2 + 14 * k, top: (H - 2144 * k) / 2, width: 3811 * k, height: 2144 * 416 / 720 * k };
    const got = { left: parseFloat(v.style.left), top: parseFloat(v.style.top), width: parseFloat(v.style.width), height: parseFloat(v.style.height) };
    return { inBg: v.parentElement === bg, muted: v.muted, loop: v.loop, ready: v.readyState, w: v.videoWidth, h: v.videoHeight, adv: +(v.currentTime - t0).toFixed(2),
      op: getComputedStyle(v).opacity, mask: String(v.style.maskImage || v.style.webkitMaskImage || ''), fit: Object.keys(want).every((q) => Math.abs(want[q] - got[q]) < 1), want, got,
      dur: +v.duration.toFixed(2) };
  });
  ok('1. the title loop is never asked for before the title menu is up', early === 0 && reqs.length > 0, { early, total: reqs.length });
  ok('1. it plays muted and looping inside the title backdrop in HD (1920x624), faded in over the still', !T.none && T.inBg && T.muted && T.loop && T.ready >= 2 && T.adv > 0.3 && T.op === '1'
    && T.w === 1920 && T.h === 624 && Math.abs(T.dur - 16) < 0.1, J(T));
  ok('1. it sits on the key art\'s own pixels and is masked out across the hills', !T.none && T.fit && /linear-gradient/.test(T.mask), J({ fit: T.fit, want: T.want, got: T.got, mask: T.mask }));
  await page.setViewportSize({ width: 1600, height: 640 }); await page.waitForTimeout(400);
  const R = await page.evaluate(() => { const v = document.getElementById('lo-title-loop'), bg = document.querySelector('#loading-overlay .lo-bg'); if (!v) return null;
    const W = bg.clientWidth, H = bg.clientHeight, k = Math.max(W / 3840, H / 2144);
    return { dx: Math.abs(parseFloat(v.style.left) - ((W - 3840 * k) / 2 + 14 * k)), dw: Math.abs(parseFloat(v.style.width) - 3811 * k), dt: Math.abs(parseFloat(v.style.top) - (H - 2144 * k) / 2) }; });
  ok('1. a resize re-places it on the art', !!R && R.dx < 1 && R.dw < 1 && R.dt < 1, J(R));
  const gone = await page.evaluate(async () => { document.getElementById('loading-overlay').classList.add('fade'); await new Promise((r) => setTimeout(r, 300)); return !document.getElementById('lo-title-loop'); });
  ok('1. it is torn down when the title overlay leaves', gone);
  await page.setViewportSize({ width: 1280, height: 720 });
  // ---- 2 + 3. the milestone films ---------------------------------------------------------------------------------------
  const F = await page.evaluate(async (FILMS) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 45; }
    player._tutorialSeen = true; player._gravitosCineSeen = true;
    const ov = () => document.getElementById('story-beat-overlay'), on = () => !!(ov() && ov().classList.contains('on'));
    for (const [beat, clip, score] of FILMS) {
      player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) if (k !== beat) player._storyBeatsSeen[k] = true;
      const r = { clip: String(STORY_BEAT_CLIPS[beat] || '').split('/').pop() };
      _playStoryBeat(beat);
      for (let i = 0; i < 120 && !(document.getElementById('story-beat-clip') && document.getElementById('story-beat-clip').readyState >= 2); i++) await sleep(100);
      const v = document.getElementById('story-beat-clip');
      if (v) { await sleep(1200); Object.assign(r, { src: (v.currentSrc || v.src).split('/').pop(), w: v.videoWidth, h: v.videoHeight, muted: v.muted, bytes: v.webkitAudioDecodedByteCount || 0,
        scoreSilent: _cineBgm.paused || _cineBgm.volume < 0.02, score: decodeURIComponent(String(_cineBgm.src).split('/').pop()) }); }
      for (let i = 0; i < 80 && on(); i++) { ov().click(); await sleep(250); }
      r.closed = !on(); out[beat] = r; await sleep(600);
    }
    // 3. warmed while the player is busy
    const W = (b) => _sbWarmed.has(STORY_BEAT_CLIPS[b]);
    player._storyBeatsSeen = {}; _sbWarmed.clear();
    try { openAdvancement(); } catch (e) { out.advErr = String(e.message); }
    out.warmJob = W('advancement_1_done');
    try { closeAllModals(); } catch (e) {} const am = document.getElementById('advancement-modal'); if (am) am.style.display = 'none';
    const job = Object.keys(JOBS).find((j) => JOBS[j] && (JOBS[j].cls === player.cls || JOBS[j].base === player.cls || JOBS[j].class === player.cls)) || Object.keys(JOBS)[0];
    player.job = job;
    try { openMasterAdvancement(); } catch (e) { out.masterErr = String(e.message); }
    out.warmMaster = W('advancement_2_done');
    try { closeAllModals(); } catch (e) {} if (am) am.style.display = 'none';
    return out;
  }, FILMS);
  for (const [beat, clip, score] of FILMS) {
    const r = F[beat] || {};
    ok(`2. ${beat}: plays ${clip} with its soundtrack while the score (${score}) waits silent`, r.clip === clip + '.mp4' && r.src === clip + '.mp4' && r.w === 1280 && r.h === 720
      && r.muted === false && r.bytes > 0 && r.scoreSilent && r.score === score && r.closed, J(r));
  }
  ok('3. the job and mastery films are warmed while the player chooses', F.warmJob === true && F.warmMaster === true, J({ job: F.warmJob, master: F.warmMaster, e: [F.advErr, F.masterErr] }));
  const html = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8').split(String.fromCharCode(13)).join('');
  ok('3. the first-House film is warmed behind the sign\'s last words', /_sbPreloadClip\('first_zodiac_kill'\);[^\n]*\n\s*setTimeout\(\(\) => \{ _playStoryBeat\('first_zodiac_kill'\); \}, 1800\);/.test(html));
  await ctx.close();
  // ---- 1b. reduced motion ---------------------------------------------------------------------------------------------
  const ctx2 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const b2 = await boot(ctx2); await b2.page.waitForTimeout(5000);
  const rm = await b2.page.evaluate(() => !!document.getElementById('lo-title-loop'));
  ok('1. reduced motion keeps the still: no loop, nothing downloaded', !rm && b2.reqs.length === 0, { el: rm, reqs: b2.reqs.length });
  await ctx2.close();
  // ---- 4. on disk and packed ------------------------------------------------------------------------------------------
  const pkg = readFileSync(path.join(SERVE_ROOT, 'steam', 'package.json'), 'utf8');
  const files = FILMS.map(([, c]) => ({ c, mp4: existsSync(path.join(SERVE_ROOT, CINE + c + '.mp4')), spec: existsSync(path.join(SERVE_ROOT, CINE + c + '.SPEC.md')), pkg: pkg.includes(CINE + c + '.mp4') }));
  ok('4. the three films, their SPEC records and the title loop are on disk; the films are packed for Steam', files.every((f) => f.mp4 && f.spec && f.pkg)
    && existsSync(path.join(SERVE_ROOT, 'backgrounds', 'title_sky_loop.mp4')) && pkg.includes('"backgrounds/**"'), J(files));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log((fail ? 'FAIL(' + fail + ')' : 'PASS(0)') + ' - ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
