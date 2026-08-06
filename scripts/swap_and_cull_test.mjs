// v0.29.474 â€” three fixes, asserted by BEHAVIOUR:
//   1. A boss execute that writes player.hp directly (no broadcast) must land
//      on the fielded MojiMon instead of vanishing. Broadcast hits must NOT be
//      double-charged.
//   2. Co-op peers must be drawn in raw world Y (the camera translate is
//      already applied), so they stay visible on vertical maps.
//   3. The monster cull must use the rendered sprite box, not the hitbox.
//
//   node serve.js 8837 && node scripts/swap_and_cull_test.mjs 8837 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8837';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('drawMonster') === 'function' && typeof eval('_mpDrawPeers') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

// NOTE: the boss-execute redirect (charging a direct player.hp write to the
// fielded MojiMon) was written, tested, and then REVERTED before shipping —
// it regressed mojimon_behaviour_test 10/11 -> 9/11 because a full boss
// execute one-shots the companion and dismisses it mid-fight. Whether that is
// the right balance is a design decision, not a bug fix, so it is not asserted
// here. What DID ship from that area is the airborne-flag snapshot, below.
const src = await page.evaluate(() => {
  const s = [...document.querySelectorAll('script')].map(x => x.textContent).join('\\n');
  return { swapKeepsFlags: (s.match(/onGround: player\.onGround,/g) || []).length };
});
ok('both swap sites snapshot the airborne flags (warp no longer leaks them)', src.swapKeepsFlags === 2, { sites: src.swapKeepsFlags });

// === 2. peers use raw world Y ==============================================
const peer = await page.evaluate(() => {
  const s = [...document.querySelectorAll('script')].map(x => x.textContent).join('\n');
  return {
    rawWorldY: /const sy = p\._ry \+ _bob;/.test(s),
    doubleGone: !/const sy = p\._ry - \(\(game\.camera/.test(s),
    cullIsCameraRelative: /sy < _pCamY - 60 \|\| sy > _pCamY \+ H \+ 60/.test(s),
    stairRaw: /const syy = fx\.y;/.test(s),
  };
});
// RUNTIME proof, not just a source match: render a peer with the camera
// scrolled 2000px down (a tower map) and count draw calls. The source check
// alone would pass on a build where the convention was right but the cull was
// still wrong, so this drives the real function.
const vis = await page.evaluate(() => {
  const g = eval('game'), CTX = eval('ctx'), N = eval('net');
  const VH = eval('H');                       // not `H` — TDZ shadowing
  const saved = { peers: N.peers, camY: g.camera.y, camX: g.camera.x,
                  myId: N.myId, ws: N.ws, connected: N.connected };
  // _mpDrawPeers bails unless co-op looks active; without this the FLAT
  // baseline reads 0 too and the probe "proves" a working fix broken.
  N.myId = 1; N.connected = true; N.ws = { readyState: 1, send() {} };
  const p0 = eval('player'); if (!p0.cls) p0.cls = 'warrior';
  let drew = 0;
  const o = { di: CTX.drawImage, fr: CTX.fillRect, f: CTX.fill, ft: CTX.fillText, arc: CTX.arc };
  const spy = function () { drew++; };
  const run = (camY, peerWorldY) => {
    g.camera.y = camY; g.camera.x = 0;
    N.peers = { 7: { id: 7, name: 'Vert', map: g.currentMap, x: 400, y: peerWorldY,
                     _rx: 400, _ry: peerWorldY, hp: 100, maxHp: 100, cls: 'warrior',
                     _last: performance.now(), level: 10, facing: 1 } };
    drew = 0;
    CTX.drawImage = spy; CTX.fillRect = spy; CTX.fill = spy; CTX.fillText = spy; CTX.arc = spy;
    try { eval('_mpDrawPeers')(); } catch (e) {}
    CTX.drawImage = o.di; CTX.fillRect = o.fr; CTX.fill = o.f; CTX.fillText = o.ft; CTX.arc = o.arc;
    return drew;
  };
  const vertical = run(2000, 2000 + VH / 2);   // tower map, peer mid-viewport
  const offTop = run(2000, 200);               // genuinely above the viewport
  const flat = run(0, VH / 2);                 // baseline
  g.camera.y = saved.camY; g.camera.x = saved.camX; N.peers = saved.peers;
  N.myId = saved.myId; N.ws = saved.ws; N.connected = saved.connected;
  return { vertical, offTop, flat };
});
ok('a peer RENDERS on a vertical map (camera.y 2000) — the actual bug', vis.vertical > 0, vis);
ok('and still renders on a flat map', vis.flat > 0, vis);
ok('and is still culled when genuinely off-screen', vis.offTop === 0, vis);

ok('peers are drawn in raw world Y', peer.rawWorldY);
ok('the double camera.y subtraction is gone', peer.doubleGone);
ok('the peer cull compares in the same space it draws in', peer.cullIsCameraRelative);
ok('the rainbow-stair FX no longer subtracts the camera twice', peer.stairRaw);

// === 3. the cull uses the visual box =======================================
const cull = await page.evaluate(() => {
  const g = eval('game');
  const CTX = eval('ctx');
  const saved = { mapData: g.mapData, monsters: g.monsters, camX: g.camera.x, camY: g.camera.y };
  g.mapData = { platforms: [{ type: 'ground', x: 0, y: 600, w: 5000, h: 40 }], worldWidth: 5000 };
  g.camera.x = 0; g.camera.y = 0;
  let drew = 0;
  const oDI = CTX.drawImage, oFR = CTX.fillRect, oF = CTX.fill;
  const spy = function () { drew++; };
  const mk = (x) => ({ type: 'kingKrook', x, y: 460, w: 120, h: 130, currentHp: 500, maxHp: 500,
                       def: 0, isBoss: true, facing: 1, _visW: 260, _visH: 260 });
  const run = (x) => {
    drew = 0;
    CTX.drawImage = spy; CTX.fillRect = spy; CTX.fill = spy;
    try { eval('drawMonster')(mk(x)); } catch (e) {}
    CTX.drawImage = oDI; CTX.fillRect = oFR; CTX.fill = oF;
    return drew;
  };
  const VW = eval('W');   // not `W` — TDZ shadowing
  // A boss whose HITBOX is just past the right edge but whose SPRITE still
  // overlaps it: pre-fix this was culled with ~69px on screen.
  const justPast = run(VW + 10);
  const wellPast = run(VW + 600);       // genuinely gone â€” must still cull
  const onScreen = run(VW / 2);
  g.mapData = saved.mapData; g.monsters = saved.monsters;
  g.camera.x = saved.camX; g.camera.y = saved.camY;
  return { justPast, wellPast, onScreen, VW };
});
ok('a boss fully on screen still draws', cull.onScreen > 0, cull);
ok('a boss whose SPRITE still overlaps the edge is no longer culled', cull.justPast > 0, cull);
ok('a boss genuinely off screen is still culled (no wasted draws)', cull.wellPast === 0, cull);

ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);

