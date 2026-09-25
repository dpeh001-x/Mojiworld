// DJ Vinyl's console: one pad per track, each with its own icon (v0.30.x jb-console).
//   node scripts/jb_console_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "make it like DJ console concept where each button on the DJ console plays a specific music", "each BGM
// also has a unique icon", "simple and cute, well mapped and organised".
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10511';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };

// ---------- the icons on disk ----------
const html = readFileSync(path.join(ROOT, FILE), 'utf8');
const i0 = html.indexOf('const JUKEBOX_TRACKS = ['), i1 = html.indexOf('\n];', i0);
const IDS = [...html.slice(i0, i1).matchAll(/id:'([A-Za-z]+)'/g)].map((m) => m[1]);
const art = { missing: [], wrong: [], hashes: new Map() };
for (const id of [...IDS, 'jb_badge']) {
  const f = path.join(ROOT, 'Sprites', 'ui', 'jukebox', id + '.webp');
  if (!existsSync(f)) { art.missing.push(id); continue; }
  const b = readFileSync(f), m = await sharp(b).metadata();
  const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corner = data[3] === 0 && data[(info.width * info.height - 1) * 4 + 3] === 0;
  if (!(m.width === 256 && m.height === 256 && corner)) art.wrong.push(id + ' ' + m.width + 'x' + m.height);
  art.hashes.set(createHash('sha256').update(b).digest('hex'), (art.hashes.get(createHash('sha256').update(b).digest('hex')) || []).concat(id));
}
const dupes = [...art.hashes.values()].filter((v) => v.length > 1);
console.log(`catalogue: ${IDS.length} tracks | icons missing ${JSON.stringify(art.missing)} wrong ${JSON.stringify(art.wrong)} duplicated ${JSON.stringify(dupes)}`);
check(IDS.length === 46 && art.missing.length === 0, 'every one of the 46 tracks has its own icon file, and the console has its badge', art.missing);
check(art.wrong.length === 0, 'each icon is a 256 px square on a transparent background', art.wrong);
check(dupes.length === 0 && art.hashes.size === IDS.length + 1, 'no two tracks share an icon', dupes);

// ---------- in the game ----------
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try {
  const errs = [];
  const boot = async (opts) => {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof openJukebox === 'function' && typeof _bgmEl !== 'undefined', null, { timeout: 120000 });
    await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 30;
      loadMap('town'); await new Promise((s) => setTimeout(s, 2500));
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      // every third track undiscovered
      game._jukeboxHeard = {}; let k = 0; window.__locked = [];
      for (const g of JUKEBOX_TRACKS) for (const t of g.tracks) { if (k++ % 3 === 2 && !t.always) window.__locked.push(t.id); else game._jukeboxHeard[t.id] = true; }
    });
    return { ctx, page };
  };
  { const { ctx, page } = await boot({ viewport: { width: 1280, height: 800 } });
    const r = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
      openJukebox(); await sleep(400);
      const pads = [...document.querySelectorAll('#jukebox-list .jb-track')];
      for (const im of document.querySelectorAll('#jukebox-list .jb-ico')) for (let i = 0; i < 50 && !(im.complete && im.naturalWidth > 0); i++) await sleep(100);
      const zones = [...document.querySelectorAll('#jukebox-list .jb-zone')].map((z) => ({ key: z.dataset.zone, n: z.querySelectorAll('.jb-track').length, keys: [...z.querySelectorAll('.jb-key')].map((e) => e.textContent) }));
      const out = { pads: pads.length, zones, tracks: JUKEBOX_TRACKS.map((g) => g.tracks.length) };
      out.icons = pads.filter((p) => !p.classList.contains('locked')).map((p) => { const im = p.querySelector('.jb-ico'); return { id: p.dataset.trackId, src: im && im.getAttribute('src'), ok: !!(im && im.naturalWidth > 0) }; });
      out.locked = pads.filter((p) => p.classList.contains('locked')).map((p) => ({ id: p.dataset.trackId, text: p.textContent, title: p.title, lock: !!p.querySelector('.jb-lock') }));
      out.lockedWant = window.__locked;
      const names = Object.fromEntries(JUKEBOX_TRACKS.flatMap((g) => g.tracks).map((t) => [t.id, t.name]));
      out.leak = out.locked.filter((l) => l.text.includes(names[l.id]) || l.title.includes(names[l.id])).map((l) => l.id);
      // play a pad
      const pad = document.querySelector('#jukebox-list .jb-track[data-track-id="frozenPeak"]'); pad.click(); await sleep(300);
      const modal = document.getElementById('jukebox-modal');
      out.play = { lit: [...document.querySelectorAll('#jukebox-list .jb-track.playing')].map((p) => p.dataset.trackId), live: modal.classList.contains('jb-live'),
        spin: getComputedStyle(modal.querySelector('.jb-platter')).animationPlayState, label: document.getElementById('jukebox-label').getAttribute('src'),
        title: document.getElementById('jukebox-now-title').textContent, src: decodeURIComponent(_bgmEl.src).split('/').slice(-2).join('/'), idle: document.getElementById('jukebox-now').classList.contains('idle') };
      // a locked pad does nothing
      const lp = document.querySelector('#jukebox-list .jb-track.locked'); lp.click(); await sleep(100);
      out.afterLocked = _jukeboxPlaying && _jukeboxPlaying.trackId;
      // STOP
      document.getElementById('jukebox-stop').click(); await sleep(200);
      out.stop = { lit: document.querySelectorAll('#jukebox-list .jb-track.playing').length, live: modal.classList.contains('jb-live'), spin: getComputedStyle(modal.querySelector('.jb-platter')).animationPlayState, idle: document.getElementById('jukebox-now').classList.contains('idle'), playing: _jukeboxPlaying };
      // SHUFFLE, 25 times: always a found track, never the same one twice running
      out.shuffle = []; let prev = null;
      for (let i = 0; i < 25; i++) { document.querySelector('#jukebox-modal .jb-shuffle').click(); const id = _jukeboxPlaying && _jukeboxPlaying.trackId; out.shuffle.push({ id, repeat: id === prev, locked: window.__locked.includes(id) }); prev = id; }
      // the volume wheel is the music slider
      const w = document.getElementById('jukebox-vol'), slider = document.getElementById('set-bgm');
      slider.value = 50; applySettingsLive(); openJukebox(); await sleep(50);
      w.focus(); w.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); w.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      out.volKeys = { slider: +slider.value, el: +(_bgmEl.volume.toFixed(3)), num: document.getElementById('jukebox-vol-num').textContent, aria: w.getAttribute('aria-valuenow') };
      w.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      document.querySelector('#jukebox-modal .jb-volbtns button').click();
      out.volDown = +slider.value;
      let saved = null; try { saved = JSON.stringify(localStorage).includes('"bgm":45') || JSON.stringify(localStorage).includes('bgm\\":45'); } catch (e) {}
      out.volSaved = saved;
      // layout: every pad inside the window, none overlapping
      const rects = [...document.querySelectorAll('#jukebox-list .jb-track')].map((p) => p.getBoundingClientRect());
      let overlap = 0; for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) { const A = rects[a], B = rects[b]; if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) overlap++; }
      const mr = modal.getBoundingClientRect(); out.layout = { overlap, fits: mr.top >= 0 && mr.bottom <= innerHeight && mr.left >= 0 && mr.right <= innerWidth };
      jukeboxStop(); closeJukebox(); await sleep(100);
      out.closed = { on: document.getElementById('jukebox-modal-bg').classList.contains('on'), tick: _jbTick, paused: game.paused, jbOwner: (typeof _lxPauseOwners === 'function' ? (_lxPauseOwners() || []) : []).some((n) => n && (n.id === 'jukebox-modal-bg' || (n.closest && n.closest('#jukebox-modal-bg')))),
        open: [...document.querySelectorAll('.modal-overlay, [id$="-modal-bg"], [id$="-overlay"]')].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; }).map((e) => e.id).slice(0, 6) };
      return out;
    });
    const tracks = r.tracks;
    console.log('zones', JSON.stringify(r.zones.map((z) => z.key + ':' + z.n)), '| play', JSON.stringify(r.play), '| stop', JSON.stringify(r.stop));
    console.log('shuffle', r.shuffle.map((x) => x.id).join(','), '| vol', JSON.stringify(r.volKeys), 'down', r.volDown, 'saved', r.volSaved, '| layout', JSON.stringify(r.layout), '| closed', JSON.stringify(r.closed));
    check(r.pads === 46 && r.zones.length === 4 && r.zones.map((z) => z.key).join('') === 'ABCD' && r.zones.every((z, i) => z.n === tracks[i]), 'one pad per track, 46, in four colour zones A-D (towns 8, wilds 26, cosmic 7, bosses 5)', r.zones.map((z) => [z.key, z.n]));
    check(r.zones.every((z) => z.keys.every((k, i) => k === z.key + (i + 1))), 'the pads are numbered like a pad bank: A1..A8, B1..B26, C1..C7, D1..D5', r.zones.map((z) => z.keys.slice(0, 3)));
    check(r.icons.every((x) => x.src === `Sprites/ui/jukebox/${x.id}.webp` && x.ok) && new Set(r.icons.map((x) => x.src)).size === r.icons.length, 'every found pad shows its own track\'s icon, loaded', r.icons.filter((x) => !x.ok || x.src !== `Sprites/ui/jukebox/${x.id}.webp`));
    check(r.locked.length === r.lockedWant.length && r.locked.every((l) => l.lock && l.text.includes('???')) && r.leak.length === 0, 'an undiscovered track keeps its pad with a padlock and "???" - its name is not given away', { locked: r.locked.length, want: r.lockedWant.length, leak: r.leak });
    check(r.play.lit.join() === 'frozenPeak' && r.play.live && r.play.spin === 'running' && r.play.label === 'Sprites/ui/jukebox/frozenPeak.webp' && r.play.title === 'Frozen Peak' && r.play.src.endsWith('bgm_frozen_peak.mp3') && !r.play.idle,
      'pressing a pad plays its track: that pad lights, the record spins with its icon on the label, the screen reads it', r.play);
    check(r.afterLocked === 'frozenPeak', 'pressing an undiscovered pad plays nothing', r.afterLocked);
    check(r.stop.lit === 0 && !r.stop.live && r.stop.spin === 'paused' && r.stop.idle && r.stop.playing === null, 'STOP: no pad lit, the record stops, the screen goes idle', r.stop);
    check(r.shuffle.every((x) => x.id && !x.repeat && !x.locked), 'SHUFFLE plays a found track every time, never the one already spinning', r.shuffle.filter((x) => !x.id || x.repeat || x.locked));
    check(r.volKeys.slider === 60 && Math.abs(r.volKeys.el - 0.36) < 0.001 && r.volKeys.num === '60' && r.volKeys.aria === '60', 'the volume wheel IS the music volume: two arrow presses take 50 to 60 and the music follows', r.volKeys);
    check(r.volDown === 45, 'scrolling it down and the - key turn it down (60 -> 55 -> 45)', r.volDown);
    check(r.layout.overlap === 0 && r.layout.fits, 'at 1280x800 the console fits the screen and no two pads overlap', r.layout);
    check(!r.closed.on && r.closed.tick === null && r.closed.jbOwner === false, 'closing it stops its clock and it no longer holds the game paused', r.closed);
    await ctx.close(); }
  // a phone on its side
  { const { ctx, page } = await boot({ viewport: { width: 842, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const r = await page.evaluate(async () => {
      openJukebox(); await new Promise((s) => setTimeout(s, 300));
      const m = document.getElementById('jukebox-modal').getBoundingClientRect(), l = document.getElementById('jukebox-list');
      const x = document.querySelector('#jukebox-modal .jb-x').getBoundingClientRect(), pad = document.querySelector('#jukebox-list .jb-track').getBoundingClientRect();
      const out = { fits: m.top >= 0 && m.bottom <= innerHeight && m.left >= 0 && m.right <= innerWidth, scrolls: l.scrollHeight > l.clientHeight + 20, listH: Math.round(l.clientHeight), close: x.width >= 26 && x.bottom <= innerHeight, pad: [Math.round(pad.width), Math.round(pad.height)] };
      closeJukebox(); return out;
    });
    console.log('phone', JSON.stringify(r));
    check(r.fits && r.scrolls && r.listH >= 120 && r.close && r.pad[0] >= 64 && r.pad[1] >= 56, 'on a phone on its side it fits the screen, the pads scroll in a strip at least 120 px tall, pads stay tappable (64x56+), and it can be closed', r);
    await ctx.close(); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
