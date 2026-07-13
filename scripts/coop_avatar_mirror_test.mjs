// AVATAR MIRROR certification — runs the game against the REAL Cloudflare
// worker source (wrangler dev / miniflare on :8787, same code as production)
// and proves player A's avatar is reproduced on player B's screen from the
// wire alone:
//   1. field-by-field: the look + equipment B's peer draw APPLIES deep-equal
//      A's actual lookCustom + equipped visuals
//   2. visually: crops A's own hero from A's canvas and A's avatar as drawn
//      on B's canvas, side by side (scratch_avatar_mirror.png)
import { chromium } from 'playwright-core';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const WS  = process.env.MIRROR_WS || 'ws://localhost:8787';
const ROOM = 'mirror' + Math.floor(Math.random() * 1e9);

const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function boot(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
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

const LOOK = { hairId: 'spike', eyeId: 'default', mouthId: 'default', skinIdx: 5, hairHue: 120, msxId: null, posture: { head: 10, armFront: 30 } };
const WEAPON = { name: 'Eclipse Daggers', baseName: 'Eclipse Daggers' };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Dee');
  const B = await boot(browser, 'Viewer');
  await ev(A, ({ look, weapon }) => {
    player.lookCustom = JSON.parse(JSON.stringify(look));
    player.equipped = player.equipped || {};
    player.equipped.weapon = JSON.parse(JSON.stringify(weapon));
  }, { look: LOOK, weapon: WEAPON });

  await ev(A, ({ ws, room }) => mpConnect(ws, 'Dee', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Viewer', room), { ws: WS, room: ROOM });
  await sleep(1000);
  for (const P of [A, B]) await P.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} }, 90); });
  await sleep(2500);

  ok('A connected via REAL worker code', await ev(A, () => net.connected));
  ok('B connected via REAL worker code', await ev(B, () => net.connected));

  // 1) Field-by-field mirror: what B's peer draw APPLIES == A's ground truth.
  const applied = await ev(B, () => {
    const orig = window._drawVectorHero;
    let cap = null;
    window._drawVectorHero = function () {
      if (player.lookCustom && player.lookCustom.hairId === 'spike') {
        cap = {
          look: JSON.parse(JSON.stringify(player.lookCustom)),
          eq: JSON.parse(JSON.stringify(_LX_EQ_PREVIEW_OVERRIDE || {})),
        };
      }
      return orig.apply(this, arguments);
    };
    try {
      for (const id in net.peers) { const p = net.peers[id]; p.map = game.currentMap; p.x = player.x + 60; p.y = player.y; }
      _mpDrawPeers();
    } catch (e) {} finally { window._drawVectorHero = orig; }
    return cap;
  });
  const lookMirror = applied && applied.look
    && applied.look.hairId === LOOK.hairId && applied.look.eyeId === LOOK.eyeId
    && applied.look.mouthId === LOOK.mouthId && applied.look.skinIdx === LOOK.skinIdx
    && applied.look.hairHue === LOOK.hairHue && applied.look.msxId === LOOK.msxId
    && applied.look.posture && applied.look.posture.head && applied.look.posture.head.angle === 10
    && applied.look.posture.armFront && applied.look.posture.armFront.angle === 30;
  ok('B applies EXACTLY A\'s look (hair/eyes/mouth/skin/dye/style/pose)', lookMirror, applied && applied.look);
  const eqMirror = applied && applied.eq && applied.eq.weapon
    && (applied.eq.weapon.baseName === WEAPON.baseName || applied.eq.weapon.name === WEAPON.name);
  ok('B applies EXACTLY A\'s equipment (Eclipse Daggers)', eqMirror, applied && applied.eq);

  // 2) Visual mirror: neutral card behind each avatar, then crop both.
  const CARD = { w: 140, h: 160 };
  const shotA = await ev(A, ({ w, h }) => {
    const cv = document.querySelector('canvas'); const c = cv.getContext('2d');
    const sx = player.x - game.camera.x, sy = player.y - ((game.camera && game.camera.y) || 0);
    const x0 = Math.round(sx + player.w / 2 - w / 2), y0 = Math.round(sy + player.h - h + 14);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#241a38'; c.fillRect(x0, y0, w, h); c.restore();
    try { drawPlayer(); } catch (e) {}
    return { x0, y0 };
  }, CARD);
  const drawPeerCard = ({ w, h }) => {
    let peer = null;
    for (const id in net.peers) { const p = net.peers[id]; if (p && p.look && p.look.h === 'spike') peer = p; }
    if (!peer) return null;
    peer.map = game.currentMap; peer.x = player.x + 60; peer.y = player.y; peer._rx = peer.x; peer._ry = peer.y; peer.anim = 'idle';
    const sx = peer._rx - game.camera.x, sy = peer._ry - ((game.camera && game.camera.y) || 0);
    const x0 = Math.round(sx + 14 - w / 2), y0 = Math.round(sy + 44 - h + 14);
    const cv = document.querySelector('canvas'); const c = cv.getContext('2d');
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#241a38'; c.fillRect(x0, y0, w, h); c.restore();
    try { _mpDrawPeers(); } catch (e) {}
    return { x0, y0 };
  };
  // The equipment art lazy-loads on first sight and pops in on a later frame
  // (same as real play at 60 fps). Drive several draw frames, waiting for the
  // weapon webp to report ready, then take the final repaint for the crop.
  let shotB = null;
  for (let i = 0; i < 6; i++) {
    shotB = await ev(B, drawPeerCard, CARD);
    const ready = await ev(B, () => { try { const im = _lxEquipSprite('weapons', 'eclipse_daggers'); return !!(im && im.complete && im.naturalWidth); } catch (e) { return false; } });
    if (ready && i > 0) { shotB = await ev(B, drawPeerCard, CARD); break; }
    await sleep(1200);
  }
  const wpnReady = await ev(B, () => { try { const im = _lxEquipSprite('weapons', 'eclipse_daggers'); return !!(im && im.complete && im.naturalWidth); } catch (e) { return false; } });
  ok('partner-side weapon art lazy-loaded and drawn', wpnReady, { wpnReady });
  ok('rendered both sides for the visual mirror', !!(shotA && shotB), { shotA, shotB });
  if (shotA && shotB) {
    // Crop straight off each game canvas via a temp canvas (no page.screenshot —
    // headless hangs on webfont loading).
    const cropDataUrl = ({ x0, y0, w, h }) => {
      const src = document.querySelector('canvas');
      const t = document.createElement('canvas'); t.width = w; t.height = h;
      t.getContext('2d').drawImage(src, x0, y0, w, h, 0, 0, w, h);
      return t.toDataURL('image/png');
    };
    const durlA = await ev(A, cropDataUrl, { x0: shotA.x0, y0: shotA.y0, w: CARD.w, h: CARD.h });
    const durlB = await ev(B, cropDataUrl, { x0: shotB.x0, y0: shotB.y0, w: CARD.w, h: CARD.h });
    const { writeFile } = await import('node:fs/promises');
    await writeFile('scratch_mirror_a.png', Buffer.from(durlA.split(',')[1], 'base64'));
    await writeFile('scratch_mirror_b.png', Buffer.from(durlB.split(',')[1], 'base64'));
  }
  ok('no page errors on A', A._errors.length === 0, A._errors.slice(0, 3));
  ok('no page errors on B', B._errors.length === 0, B._errors.slice(0, 3));
} finally {
  await browser.close();
}
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
