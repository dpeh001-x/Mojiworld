// DJ Vinyl's console: circuit lines and nodes in its background (v0.30.x jb-tech).
//   node scripts/jb_tech_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "improve on the background of the UI slight tech feel", "tech lines and nodes feel".
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10515';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };

// ---------- the tile is seamless: every trace leaving an edge comes back in on the opposite edge at the same place ----------
const html = readFileSync(path.join(ROOT, FILE), 'utf8');
const b0 = html.search(/v0\.30\.(x|\d+) jb-tech/), svgs = [...html.slice(b0, b0 + 12000).matchAll(/data:image\/svg\+xml,([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
const tile = svgs[0] || '', W = 260, H = 180;
const pts = [];
for (const [, d] of tile.matchAll(/<path d='([^']+)'/g)) {
  let x = 0, y = 0;
  for (const [, c, a] of d.matchAll(/([MHVLhvl])([-\d. ]+)/g)) {
    const n = (a.match(/-?[\d.]+/g) || []).map(Number);
    if (c === 'M' || c === 'L') { x = n[0]; y = n[1]; } else if (c === 'H') x = n[0]; else if (c === 'V') y = n[0];
    else if (c === 'h') x += n[0]; else if (c === 'v') y += n[0]; else if (c === 'l') { x += n[0]; y += n[1]; }
    pts.push([x, y]);
  }
}
const edge = (p) => p.filter(([x, y]) => x === 0 || x === W || y === 0 || y === H);
const open = edge(pts).filter(([x, y]) => !pts.some(([u, v]) => (x === 0 && u === W && v === y) || (x === W && u === 0 && v === y) || (y === 0 && v === H && u === x) || (y === H && v === 0 && u === x)));
console.log(`tiles ${svgs.length} | traces ${(tile.match(/<path/g) || []).length} nodes ${(tile.match(/<circle/g) || []).length} | edge points ${edge(pts).length} unmatched ${JSON.stringify(open)}`);
check(svgs.length >= 5 && /<path/.test(tile) && (tile.match(/<circle/g) || []).length >= 8, 'the network is lines and nodes: traces with junction and end nodes, in several tiles', svgs.length);
check(edge(pts).length >= 6 && open.length === 0, 'the network tile is seamless - no trace stops dead at a tile edge', open);

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
      game._jukeboxHeard = {}; for (const g of JUKEBOX_TRACKS) for (const t of g.tracks) game._jukeboxHeard[t.id] = true;
      openJukebox();
    });
    await page.waitForTimeout(600);
    return { ctx, page };
  };
  const { ctx, page } = await boot({ viewport: { width: 1280, height: 800 } });
  const layers = () => page.evaluate(() => {
    const bg = (el, pe) => getComputedStyle(el, pe || null).backgroundImage;
    const net = (v) => (v.match(/data:image\/svg\+xml/g) || []).length;
    const m = document.getElementById('jukebox-modal'), deck = m.querySelector('.jb-deck'), list = document.getElementById('jukebox-list'), bgEl = document.getElementById('jukebox-modal-bg');
    return { face: net(bg(m)), deck: net(bg(deck)), list: net(bg(list)), backdrop: net(bg(bgEl, '::before')), nodes: net(bg(deck, '::before')) + net(bg(deck, '::after')), nobackdrop: document.documentElement.classList.contains('lx-nobackdrop') };
  });
  const L = await layers();
  const img = await page.evaluate(async () => {
    const u = getComputedStyle(document.getElementById('jukebox-modal')).backgroundImage.match(/url\("(data:image\/svg\+xml[^"]+)"\)/);
    if (!u) return null; const im = new Image(); im.src = u[1]; try { await im.decode(); } catch (e) { return 'decode failed'; } return [im.naturalWidth, im.naturalHeight];
  });
  console.log('layers', JSON.stringify(L), '| tile', JSON.stringify(img));
  check(L.face === 1 && L.deck === 1 && L.list === 1 && L.backdrop === 1 && L.nodes === 2, 'the network is etched into the faceplate, the deck plate, the pad plate and the backdrop, with lit nodes on the deck', L);
  check(Array.isArray(img) && img[0] === 260 && img[1] === 180, 'the network tile decodes as a 260x180 image', img);
  await page.evaluate(() => document.documentElement.classList.add('lx-nobackdrop'));
  const L2 = await layers();
  check(L2.face === 1 && L2.deck === 1 && L2.list === 1 && L2.backdrop === 1, 'in the low-graphics mode (no shadows) the lines and nodes are still there', L2);
  const anim = () => page.evaluate(() => {
    const d = document.querySelector('#jukebox-modal .jb-deck'), g = document.querySelector('#jukebox-modal .jb-grow');
    return { bus: getComputedStyle(g, '::after').animationName, busOp: getComputedStyle(g, '::after').opacity, a: getComputedStyle(d, '::before').animationName, b: getComputedStyle(d, '::after').animationName, busW: Math.round(g.getBoundingClientRect().width) };
  });
  const idle = await anim();
  await page.evaluate(() => document.querySelector('#jukebox-list .jb-track[data-track-id="lavaCavern"]').click());
  await page.waitForTimeout(500);
  const live = await anim();
  await page.evaluate(() => jukeboxStop()); await page.waitForTimeout(300);
  const stopped = await anim();
  console.log('idle', JSON.stringify(idle), '| live', JSON.stringify(live), '| stopped', JSON.stringify(stopped));
  check(idle.bus === 'none' && idle.busOp === '0' && idle.a === 'none' && idle.b === 'none' && idle.busW >= 80, 'idle: the data bus sits across the top bar, dark; the deck nodes rest', idle);
  check(live.bus === 'jb-bus' && live.busOp === '1' && live.a === 'jb-node' && live.b === 'jb-node', 'playing: a pulse runs along the bus and the deck nodes light up in turn', live);
  check(stopped.bus === 'none' && stopped.a === 'none', 'STOP: the pulse and the nodes go quiet again', stopped);
  const hits = await page.evaluate(() => {
    const at = (el) => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === el || el.contains(h)); };
    const q = (s) => document.querySelector(s);
    return { stop: at(q('#jukebox-stop')), shuffle: at(q('.jb-shuffle')), screen: at(q('#jukebox-now')), knob: at(q('#jukebox-vol')), pad: at(q('#jukebox-list .jb-track')), fan: at(q('.jb-fan')),
      backdrop: document.elementFromPoint(8, innerHeight - 8) === q('#jukebox-modal-bg') };
  });
  console.log('hits', JSON.stringify(hits));
  check(Object.values(hits).every(Boolean), 'the lines and nodes sit behind everything: every control, the screen and the pads take the clicks, and the backdrop still closes it', hits);
  await ctx.close();
  const ph = await boot({ viewport: { width: 842, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const fit = await ph.page.evaluate(() => { const r = document.getElementById('jukebox-modal').getBoundingClientRect(); return { fits: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1, busW: Math.round(document.querySelector('#jukebox-modal .jb-grow').getBoundingClientRect().width) }; });
  console.log('phone', JSON.stringify(fit));
  check(fit.fits, 'on a phone on its side the console still fits the screen', fit);
  await ph.ctx.close();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
