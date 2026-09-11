// Portals stand ON their floor: nothing a portal draws reaches below its feet line.
//
// Per user (v0.30.614): "ensure that portals are placed slightly higher vertically such that they
// dont overlap the floor or platform". The portal art (Sprites/world/portal.webp) bakes a soft grey
// ground shadow under its crystal capsule, and four "push it lower" rounds (v0.30.580-585) had
// seated the plain portal 11px below its original line, so capsule and shadow sank into terrain
// v4's cap. This draws the real drawPortals() onto the game canvas under an identity transform,
// once over black and once over white (the context is opaque, so coverage is recovered from the
// pair rather than read as alpha; that keeps the dark-red boss tint from skewing the edge),
// for each portal kind (plain, boss, town) at the top, middle and bottom of its bob, and reads the
// pixels back: nothing is drawn on or below the feet line, the capsule's opaque bottom rests within
// 5px above it, and the name label covers no more than 12px of the portal's top.
//   node scripts/portal_seat_test.mjs        MOJI_SERVE_ROOT / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11661); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const KINDS = ['plain', 'boss', 'town'];
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof drawPortals === 'function' && typeof MAPS === 'object' && typeof LX_WORLD === 'object' && LX_WORLD && LX_WORLD.portal && _lxWorldReady(LX_WORLD.portal), null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate((KINDS) => {
    const ids = Object.keys(MAPS);
    const dests = { plain: ids.find((k) => MAPS[k] && !MAPS[k].isTown && !MAPS[k].isBossArena), boss: ids.find((k) => MAPS[k] && MAPS[k].isBossArena), town: ids.find((k) => MAPS[k] && MAPS[k].isTown && !MAPS[k].isBossArena) };
    const FEET = 400, X0 = 200, DX = 300, CW = 1200, CH = 600;
    const saved = { portals: game.portals, camX: game.camera.x, time: game.time, px: player.x, py: player.y };
    const out = { dests, FEET, kinds: {}, labels: {}, alpha: ctx.getContextAttributes ? ctx.getContextAttributes().alpha : null };
    const pass = (near, bg) => {   // drawPortals alone over a solid background, world y = canvas y
      game.portals = KINDS.map((k, i) => ({ x: X0 + i * DX, y: FEET, dest: dests[k], name: 'Test ' + k }));
      game.camera.x = 0;
      player.x = near >= 0 ? X0 + near * DX - player.w / 2 : -9000; player.y = FEET - player.h;
      let lbl = null; const od = ctx.drawImage;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage = function (im, ...a) { if (near >= 0 && im && im === game.portals[near]._lblSprite) lbl = a.slice(); return od.call(this, im, ...a); };
      try { drawPortals(); } finally { ctx.drawImage = od; }
      const d = ctx.getImageData(0, 0, CW, CH).data;
      ctx.restore();
      return { d, lbl };
    };
    // Coverage from two renders: over black a pixel reads a*c, over white a*c + (1-a)*255, so
    // a = 1 - (white - black) / 255 whatever the tint (additive glow reads as its brightness).
    const draw = (near) => {
      const b = pass(near, '#000'), w = pass(near, '#fff'), A = new Float32Array(CW * CH);
      for (let p = 0, i = 0; p < A.length; p++, i += 4) A[p] = Math.max(0, Math.min(1, 1 - ((w.d[i] - b.d[i]) + (w.d[i + 1] - b.d[i + 1]) + (w.d[i + 2] - b.d[i + 2])) / 765));
      return { A, lbl: b.lbl };
    };
    try {
      for (const [phase, ang] of [['top', -Math.PI / 2], ['mid', 0], ['bottom', Math.PI / 2]]) {
        game.time = ang / 0.03;   // drawPortals: bob = sin(game.time * 0.05 * 0.6) * 1.5
        const { A } = draw(-1);
        KINDS.forEach((k, i) => {
          const cx = X0 + i * DX; let lowAny = -1, lowBody = -1, topBody = -1;
          for (let y = 0; y < CH; y++) for (let x = cx - 75; x <= cx + 75; x++) { const a = A[y * CW + x]; if (a > 0.024) lowAny = y; if (a > 0.35) { lowBody = y; if (topBody < 0) topBody = y; } }
          (out.kinds[k] = out.kinds[k] || []).push({ phase, lowAny, lowBody, topBody });
        });
      }
      game.time = 0;
      KINDS.forEach((k, i) => { const { lbl } = draw(i); out.labels[k] = lbl ? { y: lbl[1], h: 26 } : null; });
    } finally { game.portals = saved.portals; game.camera.x = saved.camX; game.time = saved.time; player.x = saved.px; player.y = saved.py; }
    return out;
  }, KINDS);
  const F = r.FEET;
  console.log('destinations', JSON.stringify(r.dests), ' context alpha:', r.alpha);
  for (const k of KINDS) {
    const rows = r.kinds[k]; console.log(k.padEnd(6), JSON.stringify(rows));
    ok(`${k}: nothing is drawn on or below the feet line, at the top, middle and bottom of the bob`, rows.every((q) => q.lowAny >= 0 && q.lowAny < F), rows.map((q) => q.lowAny - F));
    ok(`${k}: the capsule rests on the floor (its bottom, coverage > 0.35, within 5px above the feet line)`, rows.every((q) => q.lowBody >= F - 5 && q.lowBody < F), rows.map((q) => q.lowBody - F));
    const L = r.labels[k], top = rows[1].topBody;
    ok(`${k}: the name label covers at most 12px of the portal's top`, !!L && (L.y + L.h) - top <= 12, L ? { labelBottom: L.y + L.h - F, portalTop: top - F } : 'no label drawn');
  }
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
