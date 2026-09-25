// Wardrobe paint reaches a partner WHOLE (v0.30.1004). Two real clients through
// the real relay:
//   PORT=8080 node mp/server.mjs      (from a root holding the build + art)
//   node scripts/coop_paint_sync_test.mjs
// Alice wears a full-body paint + five painted layers at the studio's real size
// (192x256), dense enough to weigh what real brushwork weighs (34-48 KB each),
// plus one "uploaded photo" layer too heavy for any frame. Asserts: Bob receives
// every piece, the heavy one downscaled; no frame nears the relays' 64 KB cap;
// Bob DRAWS her full-body paint + layers (and not his own); an edit re-sends
// only the piece that changed; a cleared piece disappears; a lost frame is
// asked for and recovered; and her own save keeps every stroke.
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 8080;
const URL = 'http://localhost:' + PORT + '/mojiworld_game.html', WS = 'ws://localhost:' + PORT;
const ROOM = 'paint' + Math.floor(Math.random() * 1e6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x });
async function boot(browser, name) {
  const page = await (await browser.newContext()).newPage();
  page._err = []; page.on('pageerror', (e) => page._err.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => {
    ['loading-overlay', 'class-select-modal', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    window._prologueActive = false; window._lxBootGateDone = true; game.paused = false;
    player.cls = player.cls || 'warrior'; if (player.look) player.look.name = nm;
    window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} }, 70);
  }, name);
  return page;
}
// Seeded brushwork: n soft dots in the body area. photo=true fills every pixel
// with noise, the way an uploaded photo does - far past any single frame.
const PAINT = (seed, n, photo) => {
  let r = seed >>> 0; const rnd = () => ((r = Math.imul(r ^ (r >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const c = document.createElement('canvas'); c.width = 192; c.height = 256; const x = c.getContext('2d');
  if (photo) { const d = x.createImageData(192, 256); for (let i = 0; i < d.data.length; i++) d.data[i] = (rnd() * 256) | 0; x.putImageData(d, 0, 0); }
  for (let i = 0; i < n; i++) { x.fillStyle = 'hsla(' + ((rnd() * 360) | 0) + ',80%,55%,' + (0.4 + rnd() * 0.6).toFixed(2) + ')';
    x.beginPath(); x.arc(30 + rnd() * 132, 30 + rnd() * 200, 1 + rnd() * 6, 0, 7); x.fill(); }
  return c.toDataURL('image/png');
};
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  // ---- Alice paints BEFORE Bob arrives: a new peer must get everything ------
  const worn = await A.evaluate((P) => {
    const PAINT = eval(P);
    player.customPaint = PAINT(1, 220);
    player.customPaintLayers = { body_top: PAINT(2, 200), cape: PAINT(3, 180), helmet: PAINT(4, 140), hair: PAINT(5, 150), legL: PAINT(6, 0, true) };
    window.__sent = []; const s0 = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) { try { const m = JSON.parse(d); if (m.t === 'ping' && (m.cps || m.cpp || m.cp)) window.__sent.push({ k: m.cpp || (m.cps ? 'HDR' : 'cp'), n: d.length }); } catch (e) {}
      if (window.__dropNext && d.indexOf('"cpp":"' + window.__dropNext + '"') >= 0) { window.__dropNext = null; return; }
      return s0.call(this, d); };
    const kb = (s) => +(s.length / 1024).toFixed(1);
    const o = { paint: kb(player.customPaint) }; for (const k in player.customPaintLayers) o[k] = kb(player.customPaintLayers[k]);
    return o;
  }, PAINT.toString());
  console.log('Alice wears (KB):', JSON.stringify(worn));
  await A.evaluate(({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 });
  await B.evaluate(({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM });
  await B.waitForFunction(() => net.myId != null, null, { timeout: 10000 });
  await sleep(4500);
  const alice = await A.evaluate(() => ({ full: player.customPaint, layers: player.customPaintLayers, id: net.myId }));
  const got = await B.evaluate((id) => { const p = net.peers[id] || {};
    return { full: p.cpFull || null, layers: p.cp || {} }; }, alice.id);
  const want = Object.keys(alice.layers).sort();
  ok('Bob received every painted layer', JSON.stringify(Object.keys(got.layers).sort()) === JSON.stringify(want), Object.keys(got.layers).sort());
  ok('Bob received the full-body paint', got.full === alice.full, got.full ? (got.full.length / 1024).toFixed(1) + 'KB' : null);
  const exact = want.filter((k) => alice.layers[k].length <= 56 * 1024);
  ok('pieces that fit arrive byte-identical', exact.length >= 4 && exact.every((k) => got.layers[k] === alice.layers[k]), exact);
  const heavy = got.layers.legL;
  ok('the photo layer arrives downscaled, still a PNG', !!heavy && heavy.indexOf('data:image/png') === 0 && heavy.length <= 56 * 1024 && heavy !== alice.layers.legL,
    heavy ? (heavy.length / 1024).toFixed(1) + 'KB' : null);
  const maxFrame = await A.evaluate(() => Math.max(0, ...window.__sent.map((f) => f.n)));
  ok('no frame near the 64 KB relay cap', maxFrame > 0 && maxFrame < 60 * 1024, (maxFrame / 1024).toFixed(1) + 'KB');

  // ---- Bob DRAWS her paint, not his own ------------------------------------
  const draw = await B.evaluate((id) => {
    player.customPaint = 'data:image/png;base64,BOB_FULL'; player.customPaintLayers = { cape: 'data:image/png;base64,BOB_CAPE' };
    const p = net.peers[id]; p.map = game.currentMap; p.x = player.x + 40; p.y = player.y;
    const seen = []; const orig = window._drawVectorHero;
    window._drawVectorHero = function () { seen.push({ full: player.customPaint, top: player.customPaintLayers && player.customPaintLayers.body_top }); return orig.apply(this, arguments); };
    let err = null; try { _mpDrawPeers(); } catch (e) { err = String(e); }
    window._drawVectorHero = orig;
    const after = { full: player.customPaint, cape: player.customPaintLayers && player.customPaintLayers.cape };
    return { err, seen: seen.map((s) => ({ full: s.full && s.full.slice(0, 40) + ':' + s.full.length, top: s.top && s.top.length })), after };
  }, alice.id);
  const dAlice = draw.seen.find((s) => s.full && s.full.indexOf('BOB') < 0);
  ok('Bob draws Alice in her full-body paint + layers', !draw.err && !!dAlice && dAlice.full.endsWith(':' + alice.full.length) && dAlice.top === alice.layers.body_top.length, draw);
  ok('Bob\'s own paint restored after', draw.after.full === 'data:image/png;base64,BOB_FULL' && draw.after.cape === 'data:image/png;base64,BOB_CAPE', draw.after);
  await B.evaluate(() => { player.customPaint = null; player.customPaintLayers = {}; });

  // ---- an edit re-sends only the piece that changed ------------------------
  const newCape = await A.evaluate((P) => { const PAINT = eval(P); window.__sent.length = 0;
    player.customPaintLayers = Object.assign({}, player.customPaintLayers, { cape: PAINT(33, 190) }); return player.customPaintLayers.cape; }, PAINT.toString());
  await sleep(1500);
  const edit = await A.evaluate(() => window.__sent.map((f) => f.k));
  ok('an edit re-sends only the changed piece', JSON.stringify(edit) === JSON.stringify(['HDR', 'cape']), edit);
  ok('Bob wears the new cape', (await B.evaluate((id) => (net.peers[id].cp || {}).cape, alice.id)) === newCape);

  // ---- clearing a piece clears it on Bob's side ----------------------------
  await A.evaluate(() => { player.customPaint = null; const l = Object.assign({}, player.customPaintLayers); delete l.helmet; player.customPaintLayers = l; });
  await sleep(1200);
  const cleared = await B.evaluate((id) => ({ full: net.peers[id].cpFull || null, helmet: !!(net.peers[id].cp || {}).helmet }), alice.id);
  ok('cleared full-body paint + helmet vanish for Bob', !cleared.full && !cleared.helmet, cleared);

  // ---- a lost frame is asked for and recovered -----------------------------
  const newHair = await A.evaluate((P) => { const PAINT = eval(P); window.__dropNext = 'hair';
    player.customPaintLayers = Object.assign({}, player.customPaintLayers, { hair: PAINT(55, 150) }); return player.customPaintLayers.hair; }, PAINT.toString());
  await sleep(900);
  const lost = await A.evaluate(() => window.__dropNext === null);
  await sleep(4500);
  ok('a dropped piece is asked for and recovered', lost && (await B.evaluate((id) => (net.peers[id].cp || {}).hair, alice.id)) === newHair, lost);

  // ---- and it stays: Alice's own save keeps every stroke --------------------
  const kept = await A.evaluate(() => { const before = player.customPaintLayers, same = (o) => !!o && Object.keys(before).length === Object.keys(o).length && Object.keys(before).every((k) => o[k] === before[k]);
    if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow(); else saveState();
    const sv = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); const inSave = sv.player || sv;
    player.customPaintLayers = {}; loadState();
    return { inSave: same(inSave.customPaintLayers), reloaded: same(player.customPaintLayers) }; });
  ok('her save keeps every painted layer, and they load back', kept.inSave && kept.reloaded, kept);
  ok('no page errors', !A._err.length && !B._err.length, [...A._err, ...B._err].slice(0, 3));
} catch (e) {
  ok('test ran to completion', false, String(e.message || e).slice(0, 160));
} finally { await browser.close(); }
for (const r of res) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.n + (r.x !== undefined ? '  [' + JSON.stringify(r.x).slice(0, 300) + ']' : ''));
const bad = res.filter((r) => !r.pass).length;
console.log(bad ? bad + ' FAILED' : 'ALL ' + res.length + ' PASS'); process.exit(bad ? 1 : 0);
