#!/usr/bin/env node
// Calibration strip: renders each (state, frame) of a monster/boss ALONE
// through the real pipeline (animator drawState, current calib) and tiles
// them with guide lines at the idle head-top / ground plus 10% rules.
// Used to verify frame-set consistency after art changes (v0.29.213+).
//   node scripts/anim_strip.mjs <type> <out.png>
// Needs the local server: PORT=8080 node mp/server.mjs
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:8080/monster_animator.html', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__core && window.__app, null, { timeout: 30000 });
await p.evaluate(() => { window.__core.edgesTouched = () => null; });   // clean strips: no inset/captions
const dataUrl = await p.evaluate(async (type) => {
  window.__app.select(type);
  await new Promise(r => setTimeout(r, 3000));
  const MS = { idle: 130, walk: 80, attack: 48 };
  const ent = window.__app.MAN[type];
  const origStates = ent.states;
  const states = ['idle', 'walk', 'attack'].filter(s => origStates[s]);
  const refState = states[0];
  const cv = document.querySelector('canvas');
  const paint1 = (st, t) => { ent.states = { [st]: origStates[st] }; window.__app._setNow(t); window.__app.paint(); };
  paint1(refState, 1);
  const col0 = window.__app.columns()[0];
  const gY = col0.groundY;
  const sctx = cv.getContext('2d');
  const dref = sctx.getImageData(0, 0, cv.width, gY).data;
  let refTop = -1;
  for (let y = 0; y < gY && refTop < 0; y++) {
    let m = 0; for (let x = 0; x < cv.width; x++) m += dref[(y * cv.width + x) * 4 + 3];
    if (m > 2500) refTop = y;
  }
  const idleH = gY - refTop;
  const cropTop = Math.max(0, refTop - Math.round(idleH * 0.55));
  const srcH = gY - cropTop, srcW = Math.min(cv.width, Math.round(srcH * 0.75));
  const sx = Math.round(cv.width / 2 - srcW / 2);
  const fw = 150, fh = Math.round(fw * srcH / srcW);
  const out = document.createElement('canvas');
  out.width = fw * 9 + 60; out.height = fh * states.length + 70;
  const g = out.getContext('2d');
  g.fillStyle = '#151a26'; g.fillRect(0, 0, out.width, out.height);
  g.font = '600 13px system-ui';
  const sc = fh / srcH;
  states.forEach((st, row) => {
    const oy = 30 + row * fh;
    g.fillStyle = '#8a97ad'; g.save(); g.translate(12, oy + fh / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(st, 0, 0); g.restore();
    for (let f = 0; f < 9; f++) {
      paint1(st, f * MS[st] + 1);
      const ox = 30 + f * fw;
      g.drawImage(cv, sx, cropTop, srcW, srcH, ox, oy, fw, fh);
      for (let k = 0; k <= 12; k++) {
        const y = oy + fh - k * idleH * 0.1 * sc;
        if (y < oy) break;
        g.strokeStyle = (k === 10) ? 'rgba(125,219,160,0.9)' : (k === 0 ? 'rgba(125,219,160,0.7)' : 'rgba(125,160,219,0.18)');
        g.beginPath(); g.moveTo(ox, y); g.lineTo(ox + fw, y); g.stroke();
      }
      g.fillStyle = '#8a97ad'; g.fillText(String(f), ox + 4, oy + 16);
    }
  });
  ent.states = origStates;
  return out.toDataURL('image/png');
}, process.argv[2]);
const fs = await import('fs');
fs.writeFileSync(process.argv[3], Buffer.from(dataUrl.split(',')[1], 'base64'));
await b.close();
console.log('saved', process.argv[3]);
