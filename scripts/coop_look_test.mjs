// Co-op LOOK FIDELITY certification (v0.29.x). Two live clients against the
// local relay. Asserts the full customisation travels and renders identically:
//   1. hair dye (hairHue), doll pose (posture) and MSX style pick reach the
//      peer object on the viewer's side
//   2. the peer draw applies them to the swapped lookCustom (captured at the
//      real _drawVectorHero call), with posture range-clamped
//   3. the VIEWER's own hand-painted layers do NOT bleed onto the peer
//      (nulled during the peer draw, restored after)
//   4. a version-skewed peer triggers the one-time "different game version"
//      hint (and only once)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const URL = 'http://localhost:8080/mojiworld_game.html';
const WS  = 'ws://localhost:8080';
const ROOM = 'look' + Math.floor(Math.random() * 1e6);

const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function boot(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 180)));
  page._errors = errors;
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof game === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => {
    try { player.cls = player.cls || 'warrior'; } catch (e) {}
    try { if (player.look) player.look.name = nm; } catch (e) {}
    try { game.paused = false; window._prologueActive = false; } catch (e) {}
  }, name);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Dee');
  const B = await boot(browser, 'Viewer');

  // A: full customisation — dyed spike hair, tan skin, posed limbs, MSX pick.
  await ev(A, () => {
    player.lookCustom = {
      hairId: 'spike', eyeId: 'default', mouthId: 'default', skinIdx: 5,
      hairHue: 120, msxId: 'warrior',
      posture: { head: 10, armFront: 30, footL: 99 },   // footL over-range on purpose (clamp check)
    };
  });

  await ev(A, ({ ws, room }) => mpConnect(ws, 'Dee', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Viewer', room), { ws: WS, room: ROOM });
  await sleep(800);
  // Drive outbound ticks (headless throttles rAF).
  for (const P of [A, B]) await P.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} }, 90); });
  await sleep(1200);

  ok('A connected', await ev(A, () => net.connected));
  ok('B connected', await ev(B, () => net.connected));

  // 1) Wire fidelity — B's peer object carries the full look.
  const wire = await ev(B, () => {
    for (const id in net.peers) {
      const p = net.peers[id];
      if (p && p.look && p.look.h === 'spike') {
        return { hh: p.look.hh, x: p.look.x, p: p.look.p, s: p.look.s, v: p.v, gv: (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : null) };
      }
    }
    return null;
  });
  ok('peer look carries hair dye (hh=120)', wire && wire.hh === 120, wire);
  ok('peer look carries MSX style pick (x=warrior)', wire && wire.x === 'warrior', wire);
  ok('peer look carries posture (head=10, armFront=30)', wire && wire.p && wire.p.head === 10 && wire.p.armFront === 30, wire && wire.p);
  ok('peer state carries matching build version', wire && wire.v === wire.gv, wire && { v: wire.v, gv: wire.gv });

  // 2+3) Draw-time capture — wrap _drawVectorHero on B, seed B's OWN paint
  // layers, run the real _mpDrawPeers, inspect what the peer draw actually used.
  const draw = await ev(B, () => {
    const orig = window._drawVectorHero;
    const caps = [];
    window._drawVectorHero = function () {
      caps.push({
        hairHue: player.lookCustom && player.lookCustom.hairHue,
        hairId: player.lookCustom && player.lookCustom.hairId,
        msxId: player.lookCustom && player.lookCustom.msxId,
        postureHead: (player.lookCustom && player.lookCustom.posture && player.lookCustom.posture.head) ? player.lookCustom.posture.head.angle : null,
        postureFootL: (player.lookCustom && player.lookCustom.posture && player.lookCustom.posture.footL) ? player.lookCustom.posture.footL.angle : null,
        paintDuring: player.customPaintLayers, paintFullDuring: player.customPaint,
      });
      return orig.apply(this, arguments);
    };
    // Seed the viewer's own paint (must NOT bleed onto the peer).
    player.customPaint = 'data:image/png;base64,VIEWER_FULL';
    player.customPaintLayers = { body: 'data:image/png;base64,VIEWER_BODY' };
    // Match maps so the peer is drawable, then run the real draw.
    let err = null;
    try {
      for (const id in net.peers) { const p = net.peers[id]; p.map = game.currentMap; p.x = player.x + 40; p.y = player.y; }
      _mpDrawPeers();
    } catch (e) { err = String(e); }
    window._drawVectorHero = orig;
    const restored = { paint: player.customPaint, layers: player.customPaintLayers && player.customPaintLayers.body };
    player.customPaint = null; player.customPaintLayers = {};
    const peerCap = caps.find(c => c.hairHue === 120) || null;
    return { err, calls: caps.length, peerCap, restored };
  });
  ok('peer draw ran through _drawVectorHero', draw.calls > 0 && !draw.err, draw);
  ok('peer draw used the wire hair dye (hairHue=120) + spike hair', draw.peerCap && draw.peerCap.hairId === 'spike' && draw.peerCap.hairHue === 120, draw.peerCap);
  ok('peer draw used the wire posture, range-clamped (head=10, footL 99→45)', draw.peerCap && draw.peerCap.postureHead === 10 && draw.peerCap.postureFootL === 45, draw.peerCap);
  ok('peer draw validated the MSX pick (msxId=warrior)', draw.peerCap && draw.peerCap.msxId === 'warrior', draw.peerCap);
  ok('viewer\'s own paint did NOT bleed onto the peer (nulled during draw)', draw.peerCap && draw.peerCap.paintDuring === null && draw.peerCap.paintFullDuring === null, draw.peerCap);
  ok('viewer\'s own paint restored after the peer draw', draw.restored.paint === 'data:image/png;base64,VIEWER_FULL' && draw.restored.layers === 'data:image/png;base64,VIEWER_BODY', draw.restored);

  // 4) Version-skew hint — inject a stale-build peer state, expect ONE toast.
  const skew = await ev(B, () => {
    const countToasts = () => Array.from(document.querySelectorAll('.toast')).filter(t => (t.textContent || '').indexOf('different game version') >= 0).length;
    const before = countToasts();
    _mpHandle({ t: 'state', id: 424242, x: 1, y: 1, name: 'OldBuildPal', v: 'v0.1.0' });
    const afterOne = countToasts();
    _mpHandle({ t: 'state', id: 424242, x: 2, y: 2, name: 'OldBuildPal', v: 'v0.1.0' });
    const afterTwo = countToasts();
    return { before, afterOne, afterTwo };
  });
  ok('same-version partner raised NO false version hint', skew.before === 0, skew);
  ok('stale-build peer triggers the version hint', skew.afterOne === skew.before + 1, skew);
  ok('version hint fires only once per peer', skew.afterTwo === skew.afterOne, skew);

  ok('no page errors on A', A._errors.length === 0, A._errors.slice(0, 3));
  ok('no page errors on B', B._errors.length === 0, B._errors.slice(0, 3));
} finally {
  await browser.close();
}
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra !== undefined && !r.pass ? '  ' + JSON.stringify(r.extra) : (r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''))); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
