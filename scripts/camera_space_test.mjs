// v0.29.475 â€” coordinate-space consistency inside the camera translate.
//
// Written because v0.29.474 converted the rainbowStair DRAW to world Y and
// left its CULL in screen space: once the tower camera passed ~60px every step
// failed the cull and the trail stopped rendering entirely â€” worse than the
// misplacement it replaced. A source-match test would have passed. This drives
// the real functions with the camera scrolled and counts draws, which is the
// only thing that catches a half-applied coordinate change.
//
//   node serve.js 8841 && node scripts/camera_space_test.mjs 8841 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8841';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('drawSmoothFx') === 'function' && typeof eval('_mpDrawPeers') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

// Shared harness: run a draw fn with the camera at camY and count ctx calls.
const probe = (what) => page.evaluate((what) => {
  const g = eval('game'), CTX = eval('ctx'), N = eval('net');
  const VH = eval('H');                        // not `H` â€” TDZ shadowing
  const saved = { camY: g.camera.y, camX: g.camera.x, fx: g.smoothFx, peers: N.peers,
                  myId: N.myId, ws: N.ws, connected: N.connected, pings: N._pings };
  N.myId = 1; N.connected = true; N.ws = { readyState: 1, send() {} };
  const p0 = eval('player'); if (!p0.cls) p0.cls = 'warrior';
  let drew = 0;
  const o = { di: CTX.drawImage, fr: CTX.fillRect, f: CTX.fill, ft: CTX.fillText, arc: CTX.arc, st: CTX.stroke };
  const spy = function () { drew++; };
  const on = () => { CTX.drawImage = spy; CTX.fillRect = spy; CTX.fill = spy; CTX.fillText = spy; CTX.arc = spy; CTX.stroke = spy; };
  const off = () => { CTX.drawImage = o.di; CTX.fillRect = o.fr; CTX.fill = o.f; CTX.fillText = o.ft; CTX.arc = o.arc; CTX.stroke = o.st; };

  const run = (camY, worldY) => {
    g.camera.y = camY; g.camera.x = 0;
    if (what === 'stair') {
      g.smoothFx = [{ type: 'rainbowStair', x: 400, y: worldY, hue: 200,
                      life: 40, maxLife: 60, delay: 0, size: 20 }];
    } else if (what === 'peer') {
      N.peers = { 7: { id: 7, name: 'V', map: g.currentMap, x: 400, y: worldY, _rx: 400, _ry: worldY,
                       hp: 100, maxHp: 100, cls: 'warrior', _last: performance.now(), level: 5, facing: 1 } };
    } else {
      N.peers = {};
      N._pings = [{ x: 400, y: worldY, born: performance.now(), mine: true, name: 'P' }];
    }
    drew = 0; on();
    try { (what === 'stair' ? eval('drawSmoothFx') : eval('_mpDrawPeers'))(); } catch (e) {}
    off();
    return drew;
  };
  const mid = run(2000, 2000 + VH / 2);        // camera scrolled; subject mid-viewport
  const flat = run(0, VH / 2);                 // baseline, no scroll
  const away = run(2000, 100);                 // genuinely above the viewport
  g.camera.y = saved.camY; g.camera.x = saved.camX; g.smoothFx = saved.fx;
  N.peers = saved.peers; N.myId = saved.myId; N.ws = saved.ws; N.connected = saved.connected;
  N._pings = saved.pings;
  return { mid, flat, away };
}, what);

const stair = await probe('stair');
ok('STAIR: the trail renders with the tower camera scrolled 2000px (the v0.29.474 regression)', stair.mid > 0, stair);
ok('STAIR: still renders on a flat map', stair.flat > 0, stair);
ok('STAIR: still culled when genuinely off-screen', stair.away === 0, stair);

const peer = await probe('peer');
ok('PEER: renders with the camera scrolled 2000px', peer.mid > 0, peer);
ok('PEER: still renders flat', peer.flat > 0, peer);
ok('PEER: still culled when genuinely off-screen', peer.away === 0, peer);

const ping = await probe('ping');
ok('PING: the map marker renders with the camera scrolled 2000px', ping.mid > 0, ping);
ok('PING: still renders flat', ping.flat > 0, ping);

// Source guard: no drawer inside the camera translate may subtract camera.y.
const src = await page.evaluate(() => {
  const s = [...document.querySelectorAll('script')].map(x => x.textContent).join('\n');
  return {
    stairCullWorld: /syy < _camY - 60 \|\| syy > _camY \+ H \+ 60/.test(s),
    pingWorld: /const py = pg\.y;/.test(s),
    noPeerDouble: !/const sy = p\._ry - \(\(game\.camera/.test(s),
    noPingDouble: !/const py = pg\.y - \(\(game\.camera/.test(s),
    lastHitBoth: (s.match(/lastHitTime: player\.lastHitTime,/g) || []).length,
  };
});
ok('the stair CULL now compares in world space, like its draw', src.stairCullWorld, src);
ok('the ping marker uses world Y', src.pingWorld && src.noPingDouble, src);
ok('no drawer inside the translate still subtracts camera.y', src.noPeerDouble && src.noPingDouble, src);
ok('lastHitTime is snapshotted at both boss-swap sites', src.lastHitBoth === 2, src);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);

