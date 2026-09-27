// Cinematics re-encoded smaller (v0.30.x cinematic-slim): the replaced clips on disk are the re-encodes and keep their
// picture size / fps / duration / audio, and every clip still loads through the game's own cinematic path in Chrome.
// Follows the SKIP_C2PA / C2PA_CLIPS switch at the top of scripts/apply_cinematic_slim_assets.mjs: with SKIP_C2PA true,
// the C2PA clips must still be the untouched originals (manifest and all).
//   node scripts/cinematic_slim_test.mjs      (MOJI_GAME_FILE=<build.html> to test a private build;
//                                              LX_ASSET_ROOT=<repo mirror> to check a mirror's clips + sw.js instead)
import { chromium } from 'playwright-core';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, openSync, readSync, closeSync, fstatSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AROOT = process.env.LX_ASSET_ROOT ? path.resolve(process.env.LX_ASSET_ROOT) : ROOT;
const PORT = process.env.PORT || '11440';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const CINE = 'steam/higgsfield/cinematics/';
const mib = (b) => (b / 1048576).toFixed(2);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const A2 = readFileSync(path.join(ROOT, 'scripts', 'apply_cinematic_slim_assets.mjs'), 'utf8');
const swm = A2.match(/^const SKIP_C2PA = (true|false);/gm) || [], c2m = A2.match(/^const C2PA_CLIPS = \[([^\]]*)\];/gm) || [];
if (swm.length !== 1 || c2m.length !== 1) { console.error('the SKIP_C2PA / C2PA_CLIPS switch was not found once in apply_cinematic_slim_assets.mjs'); process.exit(1); }
const SKIP_C2PA = /true/.test(swm[0]), C2PA_CLIPS = (c2m[0].match(/'([^']+)'/g) || []).map((q) => q.slice(1, -1));
console.log('switch: SKIP_C2PA = ' + SKIP_C2PA + ', C2PA clips: ' + C2PA_CLIPS.join(' '));

// [clip, original bytes, new bytes, new sha256, original duration (s), width, height, the game path that plays it]
const CLIPS = [
  ['clip_prologue_pov', 10930646, 3252565, '9cd294085375dca95f8efd8193e88cc5524432bb1f0586d01312b493695f0ada', 6.082993, 1280, 720, 'dagger'],
  ['clip_prologue_punch', 10632244, 2787067, '768f215fcb30376db9aa96c53154a11edde6113df5634e36eec09e991bd01265', 6.06, 1280, 720, 'punch'],
  ['clip_gravitos_s1', 16656262, 3284315, '11a179177838487250a1dc29a921438106c96fdda9a18247107815e78e5e05c8', 8.057007, 1280, 720, 'beat'],
  ['clip_amnesiac_s1', 13253038, 1007370, 'e7887f7a42115688e44b8924f507be6bde85d815668416d95bb32fbf63278678', 8.057007, 1280, 720, 'beat'],
  ['clip_forge_s1', 12457778, 2740964, '99359284361829ca5f7d37f1a566e6e666a8a10ee03f2026233f8597a6c71842', 8.057007, 1280, 720, 'beat'],
  ['clip_100640', 11344763, 1943823, '7335901a2f9cd2b9dee54a55c18e52a85e15ad2ac9486251616369b50890771c', 8.057007, 1280, 720, 'beat'],
  ['clip_everdawn_welcome', 8570023, 1467241, 'b9ced78cfb19b8297439ee37f0be0f245ffb0dd1a721e05decc6236a4c003161', 8.041667, 1920, 1080, 'everdawn'],
  ['clip_gravitos_defeat_dragonknight', 7816393, 1020655, '584e569f58e5c5550b7bf06c6243e8350b24d568653a1073064b6726f93e0b3e', 6.082993, 1280, 720, 'defeat'],
  ['prologue_void_transcend', 7196124, 2394417, 'e36d33d1a1140431aa5c6a7346f4a97ac59ce211393e44e064e423ad09b924f6', 5.041667, 1280, 720, 'void'],
  ['clip_093232', 6383255, 3645102, 'f045c3abe622bef55548d0f38f487bb071700eece3e8345dd3114700fa18f572', 8.064, 1280, 720, 'beat'],
];
const moovFirst = (f) => {   // +faststart: the index (moov) precedes the media (mdat)
  const fd = openSync(f, 'r'), size = fstatSync(fd).size, b = Buffer.alloc(16); let off = 0, seen = [];
  try { while (off < size && seen.length < 12) { readSync(fd, b, 0, 16, off); let n = b.readUInt32BE(0); const t = b.toString('latin1', 4, 8); if (n === 1) n = Number(b.readBigUInt64BE(8)); if (n === 0) n = size - off; if (n < 8) break; seen.push(t); off += n; } } finally { closeSync(fd); }
  return seen.indexOf('moov') >= 0 && seen.indexOf('moov') < seen.indexOf('mdat');
};

// the six originals that carry a C2PA manifest (what SKIP_C2PA = true must leave byte for byte)
const C2PA_ORIG_SHA = {
  clip_prologue_punch: 'f6904dd08e5e0449d7eb77ddfda0ba190e61d5894d44ce9c20b16b91dbfaf229', clip_gravitos_s1: '03f96b294d9a55352631f9aff1a9a5070b56d0a4f59223e7655bcedf1b4df4fb',
  clip_amnesiac_s1: '794d8d9f507f767acc7c071dedcec21c2159d808e13834c6a85e3bb9c3176173', clip_forge_s1: '4a8d114b39db0c6eade9f46ee5fd280af891098ec28c7d67dbdb00222868d562',
  clip_100640: 'd950a850f023d869542a7b108fdbecaf08e9e12e9af2cd18c3558c37c2480ec5', clip_093232: '8c3e9fdbc86e2cc54ab507365981e847808b9ee94cab0f96c6a7703d9cad3fcb',
};

// 1) the files on disk
for (const [name, oB, nB, nSha, oDur, w, h] of CLIPS) {
  const f = path.join(AROOT, CINE + name + '.mp4');
  const buf = existsSync(f) ? readFileSync(f) : null;
  if (SKIP_C2PA && C2PA_CLIPS.includes(name)) {
    check(!!buf && buf.length === oB && sha(buf) === C2PA_ORIG_SHA[name] && buf.subarray(0, 65536).includes('c2pa'), `${name}.mp4 left untouched with its C2PA manifest (SKIP_C2PA)`, { bytes: buf ? buf.length : null, want: oB });
    continue;
  }
  check(!!buf && buf.length === nB && sha(buf) === nSha, `${name}.mp4 on disk is the re-encode (${mib(nB)} MiB, was ${mib(oB)})`, { bytes: buf ? buf.length : null, want: nB });
  let pr = null; try { pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate', '-of', 'json', f], { encoding: 'utf8' })); } catch (e) {}
  const v = pr && pr.streams.find((s) => s.codec_type === 'video'), a = pr && pr.streams.find((s) => s.codec_type === 'audio');
  const dur = pr ? Number(pr.format.duration) : NaN;
  const info = v ? { codec: v.codec_name, pix: v.pix_fmt, size: v.width + 'x' + v.height, fps: v.r_frame_rate, audio: a && a.codec_name, dur, faststart: buf ? moovFirst(f) : null } : { probe: 'failed' };
  check(!!v && v.codec_name === 'h264' && v.pix_fmt === 'yuv420p' && v.width === w && v.height === h && v.r_frame_rate === '24/1' && !!a && a.codec_name === 'aac'
    && Math.abs(dur - oDur) <= 0.05 && info.faststart === true, `${name}: h264 yuv420p ${w}x${h} 24 fps, audio kept, duration within 50 ms of ${oDur} s, index up front`, info);
}
// 2) every clip (replaced or not) through the game's own path
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  // the clips come from the asset root under test (a mirror, or the working copy); a clip missing there, from origin
  await p.route((u) => u.pathname.includes('/' + CINE) && u.pathname.endsWith('.mp4'), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    const f = path.join(AROOT, rel);
    if (AROOT === ROOT && existsSync(f)) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'video/mp4', body: existsSync(f) ? readFileSync(f) : execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _sbAttachClip === 'function' && typeof _prologuePunchCutscene === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
  });
  for (const [name, , , , oDur, w, h, how] of CLIPS) {
    const res = await p.evaluate(async ([name, how]) => {
      const want = '/' + name + '.mp4', sleep = (ms) => new Promise((s) => setTimeout(s, ms));
      const OVS = ['prologue-dagger-cine', 'prologue-punch-cine', 'prologue-void-cine', 'gravitos-defeat-cine', 'everdawn-welcome-overlay'];
      let sel;
      try {
        if (how === 'beat') {   // the story-beat backdrop: _sbAttachClip(<the beat whose clip this is>)
          const id = Object.keys(STORY_BEAT_CLIPS).find((k) => STORY_BEAT_CLIPS[k].endsWith(want));
          if (!id) return { err: 'not in STORY_BEAT_CLIPS' };
          if (!game._storyBeatEls) game._storyBeatEls = { overlay: document.getElementById('story-beat-overlay') };
          _sbAttachClip(id); sel = '#story-beat-clip';
        } else if (how === 'dagger') { _prologueDaggerCutscene(() => {}); sel = '#plg-dagger-vid'; }
        else if (how === 'punch') { _prologuePunchCutscene(() => {}); sel = '#plg-punch-vid'; }
        else if (how === 'void') { _prologueVoidCutscene(() => {}); sel = '#plg-void-vid'; }
        else if (how === 'defeat') { _gravitosDefeatCutscene(() => {}); sel = '#grav-def-vid'; }
        else if (how === 'everdawn') { player._storyBeatsSeen.everdawn_welcome = false; _playEverdawnWelcome(); sel = '#everdawn-welcome-overlay video'; }
      } catch (e) { return { err: String(e).slice(0, 160) }; }
      let v = null; const t0 = Date.now();
      while (Date.now() - t0 < 30000) { v = document.querySelector(sel); if (v && (v.readyState >= 1 || v.error)) break; await sleep(100); }
      const r = v ? { rs: v.readyState, src: String(v.currentSrc || v.src || '').replace(/^.*[/]steam[/]/, 'steam/'), w: v.videoWidth, h: v.videoHeight, dur: v.duration, err: v.error ? v.error.code : null } : { missing: sel };
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));   // skip it, as a player would
      if (how === 'beat') _sbDetachClip();
      await sleep(600);
      for (const id of OVS) document.getElementById(id)?.remove();
      player._storyBeatsSeen.everdawn_welcome = true; game.paused = false;
      return r;
    }, [name, how]);
    check(res.rs >= 1 && !res.err && String(res.src).endsWith('/' + name + '.mp4') && res.w === w && res.h === h && Math.abs(res.dur - oDur) < 0.1,
      `${name} loads its metadata in Chrome through the game's own path (${how})`, res);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
