// Guguma's welcome cinematic, on the first walk out of the Void.
//
// Per user: "wire this in to when the character first enters everdawn central
// from the void". The interesting cases are all about WHEN it does NOT fire —
// arriving in town from anywhere else, or arriving a second time — so those
// are driven here rather than asserted from the source.
//   node scripts/everdawn_welcome_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const CLIP = 'steam/higgsfield/cinematics/clip_everdawn_welcome.mp4';
ok('the clip ships', existsSync(CLIP) && statSync(CLIP).size > 500000,
   { mb: existsSync(CLIP) ? +(statSync(CLIP).size / 1048576).toFixed(1) : 0 });
ok('...and is committed', execFileSync('git', ['ls-files', '--', CLIP], { encoding: 'utf8' }).trim() === CLIP, {});

// Every cinematic is enumerated by name in extraResources, so one that is not
// listed simply does not ship to Steam — silently, because the runtime falls
// back. clip_sundered_deep was already in exactly that state when this landed.
const pkg = JSON.parse(readFileSync('steam/package.json', 'utf8'));
const filt = JSON.stringify(pkg);
ok('the clip is in the Steam packaging filter (unlisted clips do not ship)',
   filt.includes('clip_everdawn_welcome.mp4'), {});
ok('...and so is clip_sundered_deep.mp4, which the game references but was never listed',
   filt.includes('clip_sundered_deep.mp4'), {});

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
const bad = [];
page.on('response', (res) => { if (res.status() >= 400 && /clip_everdawn_welcome/.test(res.url())) bad.push(res.status()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _playEverdawnWelcome === 'function', { timeout: 120000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const out = {};
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  const ovId = 'everdawn-welcome-overlay';
  const showing = () => !!document.getElementById(ovId);
  const clear = () => { const o = document.getElementById(ovId); if (o) o.remove(); };
  const settle = () => new Promise(r2 => setTimeout(r2, 400));
  player._storyBeatsSeen = player._storyBeatsSeen || {};

  // arriving in town from somewhere that is NOT the Void must do nothing
  delete player._storyBeatsSeen.everdawn_welcome;
  clear();
  loadMap('forest'); await settle();
  loadMap('town');   await settle();
  out.fromForest = showing();
  out.flagAfterForest = !!player._storyBeatsSeen.everdawn_welcome;
  clear();

  // The real path: Void -> Everdawn Central, with the game RUNNING, because
  // that is the actual situation — a player walking through a portal. The
  // cinematic restores whatever pause state it found rather than forcing
  // unpause (forcing it would resume play underneath an open modal), so the
  // starting state has to be realistic for the restore to mean anything.
  delete player._storyBeatsSeen.everdawn_welcome;
  game.paused = false;
  loadMap('void'); await settle();
  game.paused = false;
  // Short wait on purpose: the overlay is built synchronously inside loadMap,
  // and the wake ramp releases at 260 ms, so the usual 400 ms settle would
  // sample the ramp only after it had already finished.
  loadMap('town'); await new Promise(r2 => setTimeout(r2, 60));
  out.fromVoid = showing();
  out.flagAfterVoid = !!player._storyBeatsSeen.everdawn_welcome;
  const ov = document.getElementById(ovId);
  const vid = ov ? ov.querySelector('video') : null;
  out.hasVideo = !!vid;
  out.src = vid ? (vid.getAttribute('src') || '') : '';
  out.muted = vid ? vid.muted : null;          // it must NOT be muted: he speaks
  out.paused = !!game.paused;                  // game held while it plays
  out.hasSkipHint = !!(ov && /skip/i.test(ov.textContent || ''));
  // The wake is done by the ENGINE, not the clip: an image-to-video model
  // starts AT its start frame, so "open on black and brighten" is not really
  // available to it — the first cut that tried got drawn eyelashes instead.
  // The video therefore starts dark and soft and comes up in CSS.
  out.wakeStart = vid ? { opacity: vid.style.opacity, filter: vid.style.filter } : null;
  await new Promise(r2 => setTimeout(r2, 600));
  out.wakeEnd = vid ? { opacity: vid.style.opacity, filter: vid.style.filter } : null;
  // it must decode, not 404
  out.decodes = vid ? await new Promise((res) => {
    if (vid.readyState >= 1) return res(true);
    vid.addEventListener('loadedmetadata', () => res(true), { once: true });
    vid.addEventListener('error', () => res(false), { once: true });
    setTimeout(() => res(vid.readyState >= 1), 8000);
  }) : false;
  out.duration = vid && isFinite(vid.duration) ? Math.round(vid.duration * 10) / 10 : null;

  // clicking dismisses it and hands the game back
  if (ov) ov.click();
  await new Promise(r2 => setTimeout(r2, 700));
  out.closed = !showing();
  out.unpaused = !game.paused;

  // second trip through the Void must NOT replay it
  loadMap('void'); await settle();
  loadMap('town'); await settle();
  out.replays = showing();
  clear();
  game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('from Void:', r.fromVoid, '| from forest:', r.fromForest, '| replays:', r.replays);
console.log('video:', JSON.stringify({ src: r.src, muted: r.muted, decodes: r.decodes, duration: r.duration }));
console.log('paused during:', r.paused, '| closed on click:', r.closed, '| unpaused after:', r.unpaused);

ok('walking from the Void into Everdawn Central plays the welcome', r.fromVoid === true, {});
ok('arriving in town from anywhere else does NOT (you pass through town constantly)',
   r.fromForest === false && r.flagAfterForest === false, { shown: r.fromForest, flag: r.flagAfterForest });
ok('it is once per save — a second trip through the Void stays quiet', r.replays === false, {});
ok('the overlay carries the clip', r.hasVideo === true && /clip_everdawn_welcome\.mp4$/.test(r.src), { src: r.src });
ok('the clip DECODES (not a 404 behind a black rectangle)', r.decodes === true, { duration: r.duration });
ok('it plays with SOUND — he speaks a line, muting it throws the scene away', r.muted === false, { muted: r.muted });
ok('the game is held while it plays', r.paused === true, {});
ok('it offers a skip hint', r.hasSkipHint === true, {});
ok('the wake starts dark and soft (the engine does the waking, not the clip)',
   !!r.wakeStart && r.wakeStart.opacity === '0' && /brightness\(0\.12\)/.test(r.wakeStart.filter),
   r.wakeStart);
ok('...and comes up to full brightness', !!r.wakeEnd && r.wakeEnd.opacity === '1'
   && /brightness\(1\)/.test(r.wakeEnd.filter), r.wakeEnd);
ok('clicking closes it', r.closed === true, {});
ok('...and hands the game back running (it restores the pause state it found)',
   r.unpaused === true, { pausedAfter: !r.unpaused });
ok('no 404 for the clip', bad.length === 0, bad.slice(0, 3));
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
