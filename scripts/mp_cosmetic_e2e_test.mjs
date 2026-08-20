// Live END-TO-END test: TWO REAL CLIENTS THROUGH A REAL RELAY.
//
// The earlier mp_title_sync_test stubs the socket — good for the wire shape,
// but it cannot prove a partner actually SEES anything. This one spawns the
// real mp/server.mjs, opens two browsers, joins them to one room, and asks
// Bob's renderer what it paints over Alice's head.
//
// Covers: the earned title, item TINT (dyed gear), and the character-studio
// PAINT layers. Also reports the paint payload's real byte size against the
// relay's 64KB frame cap, since that governs whether paint can ride the wire
// at all.
//   node scripts/mp_cosmetic_e2e_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = null;
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
// the relay serves the game from the repo root too, so one process covers both
const srv = spawn(process.execPath, ['mp/server.mjs'], { stdio: 'ignore', env: { ...process.env, PORT } });
await new Promise(r => setTimeout(r, 2500));
const WS = `ws://localhost:${PORT}`;
const ROOM = 'E2ETITLE';

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const mkPage = async (label) => {
  const p = await (await b.newContext({ viewport: { width: 1100, height: 640 } })).newPage();
  p.on('pageerror', e => errs.push(label + ': ' + String(e).slice(0, 140)));
  await p.addInitScript((u) => { window.MOJI_RELAY_URL = u; }, WS);
  await p.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof mpConnect === 'function' && typeof _mpDrawPeers === 'function',
    null, { timeout: 120000 });
  await p.evaluate(() => {
    const hide = () => { for (const id of ['loading-overlay', 'class-select-modal', 'void-intro-overlay']) {
        const e = document.getElementById(id); if (e) e.style.display = 'none'; } };
    hide(); setInterval(hide, 60);
    player.cls = player.cls || 'warrior';
    window._prologueActive = false;
  });
  return p;
};
const alice = await mkPage('alice');
const bob = await mkPage('bob');
await alice.waitForTimeout(2000);

// ---- Alice puts on everything cosmetic, then both join the same room ----
const paintBytes = await alice.evaluate(() => {
  player.look = player.look || {}; player.look.name = 'Alice';
  player.equippedTitle = 'Conqueror of Mojiworld';
  // a dyed weapon: tint is the existing per-item cosmetic already on the wire
  player.equipped = player.equipped || {};
  player.equipped.weapon = { name: 'Iron Sword', baseName: 'Iron Sword', tint: '#ff3366' };
  // character-studio paint: 192x256 PNG layers, the real storage shape
  const mk = (col) => { const c = document.createElement('canvas');
    c.width = 192; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = col; x.fillRect(20, 30, 150, 190);
    x.fillStyle = '#ffffff'; for (let i = 0; i < 40; i++) x.fillRect(20 + i * 3, 40 + (i % 7) * 9, 2, 40);
    return c.toDataURL('image/png'); };
  player.customPaintLayers = { body_top: mk('#22cc88'), cape: mk('#8844ff'), helmet: mk('#ffaa22') };
  const total = Object.values(player.customPaintLayers).reduce((a, s) => a + s.length, 0);
  return { totalBytes: total, perLayer: Math.round(total / 3), layers: Object.keys(player.customPaintLayers).length };
});
console.log(`PAINT PAYLOAD: ${paintBytes.layers} layers, ${(paintBytes.totalBytes / 1024).toFixed(1)}KB total, ~${(paintBytes.perLayer / 1024).toFixed(1)}KB each (relay frame cap 64KB)`);

await alice.evaluate(([u, r]) => mpConnect(u, 'Alice', r), [WS, ROOM]);
await bob.evaluate(([u, r]) => mpConnect(u, 'Bob', r), [WS, ROOM]);
await alice.waitForTimeout(1200);
// put both on the same map so Bob's renderer will draw her at all
const myMap = await alice.evaluate(() => game.currentMap);
await bob.evaluate((m) => { game.currentMap = m; }, myMap);
await alice.waitForTimeout(4000);   // let the 14Hz state ticks + the 2.5s ping carrier flow

// ---- what did Bob actually receive, and what does he paint? ----
const seen = await bob.evaluate(() => {
  const out = { peerCount: Object.keys(net.peers).length };
  const p = Object.values(net.peers)[0];
  if (!p) return out;
  out.name = p.name; out.ti = p.ti;
  out.eqTint = p.eq && p.eq.weapon ? p.eq.weapon.tn : undefined;
  out.hasPaint = !!(p.cp && Object.keys(p.cp).length);
  out.paintLayers = p.cp ? Object.keys(p.cp).sort() : [];
  // the layers must be real PNG data URLs, not some other string that slipped through
  out.paintIsPng = !!(p.cp && Object.values(p.cp).every(v => typeof v === 'string' && v.indexOf('data:image/png') === 0));
  // force the peer onto our map + into view, then spy the paint
  p.map = game.currentMap; p.x = player.x + 40; p.y = player.y;
  const painted = [];
  const _ft = ctx.fillText;
  ctx.fillText = function (t) { painted.push(String(t)); return _ft.apply(this, arguments); };
  try { _mpDrawPeers(); } catch (e) { painted.push('THREW:' + e); }
  ctx.fillText = _ft;
  out.painted = painted;
  // RENDER PROOF: give the viewer a distinctive paint of their own, then watch
  // what _lxGetCustomPaintSource returns DURING the peer draw. If the swap is
  // wrong the peer renders wearing the viewer's paint - the exact bug the old
  // null-out guarded against - so assert it sees the PEER's bytes, not ours.
  player.customPaintLayers = { body_top: 'data:image/png;base64,VIEWERPAINT' };
  const sawDuringDraw = [];
  const _gs = window._lxGetCustomPaintSource;
  if (typeof _gs === 'function') {
    window._lxGetCustomPaintSource = function (layerId) {
      const v = _gs.apply(this, arguments);
      if (layerId) sawDuringDraw.push(String(v || '').slice(0, 24));
      return v;
    };
    try { _mpDrawPeers(); } catch (e) {}
    window._lxGetCustomPaintSource = _gs;
  }
  player.customPaintLayers = {};
  out.sawViewerPaint = sawDuringDraw.some(v => v.indexOf('VIEWERPAINT') >= 0);
  out.sawPeerPaint = sawDuringDraw.some(v => v.indexOf('data:image/png') === 0 && v.indexOf('VIEWERPAINT') < 0);
  return out;
});

const D = '\u2756';
ok('the two clients actually meet through the real relay', seen.peerCount >= 1, { peers: seen.peerCount });
ok('Bob receives Alice by name', seen.name === 'Alice', { name: seen.name });
ok('TITLE crosses the wire end-to-end', seen.ti === 'Conqueror of Mojiworld', { ti: seen.ti });
ok('TITLE is painted over her head on Bob\'s screen',
  (seen.painted || []).includes(`${D} CONQUEROR OF MOJIWORLD ${D}`), seen.painted);
ok('ITEM TINT (dyed gear) crosses the wire', seen.eqTint === '#ff3366', { tint: seen.eqTint });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
ok('CHARACTER PAINT layers reach the partner', !!seen.hasPaint,
  { hasPaint: seen.hasPaint, layers: seen.paintLayers });
ok('...as real PNG data URLs (the sanitiser let the right thing through)', !!seen.paintIsPng, { png: seen.paintIsPng });
ok('...all three painted layers survived the trip',
  (seen.paintLayers || []).join(',') === 'body_top,cape,helmet', { layers: seen.paintLayers });
ok("RENDER: the partner is drawn with THEIR paint, not the viewer's",
  seen.sawPeerPaint && !seen.sawViewerPaint,
  { sawPeerPaint: seen.sawPeerPaint, sawViewerPaint: seen.sawViewerPaint });

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
