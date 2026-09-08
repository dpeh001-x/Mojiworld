// Smith golem: ONE body size, ONE foot line, NO cutoffs - and no per-frame scale.
// ============================================================================
// History, because this file used to assert the opposite. v0.30.403 measured the
// CHEST GEM per attack frame, read frames 3-7 as 63-92% of the body, and baked a
// calib fs[] of up to 1.58x to "restore" them. The gem foreshortens when the
// golem turns (attack 3-5) and hides behind the arm (6-7): the body never shrank.
// Measured on the grey stone body the 27 frames were already within a few
// percent - so fs[] WAS the pulse, and frame 6 at 1.58x overshot as a cutoff.
// The re-canvas (scripts/recanvas_smithgolem.mjs) keeps one scale, centres the
// body and puts every ink bottom on one row; the calib carries no fs.
// v0.30.435+: the frames are a CUT-OUT RIG of the static sprite
// (scripts/gen_smithgolem_cutout.mjs) - one body, one face, one hammer under small
// affine transforms - on a 1280x1024 canvas (the slam needs 128px each side).
// Every frame therefore keeps both eyes: a turned-away pose (the old attack
// frames 3-4) cannot come back without this test seeing it.
//   ART   - stone-body height within 6% of the idle mean for all 27 frames;
//           zero edge pixels; >= 30px margin on every side; one ink-bottom row;
//           all 27 frames 1280x1024; two red eyes in the head band of every frame
//   CALIB - no fs on smithgolem attack (timing ft may stay)
//   BUILD - forced idle 0 / attack 0 / attack 3 / attack 6 blit within 4% of
//           one height, bottoms within 3px; prints the heights (--probe use)
//   node scripts/smithgolem_scale_test.mjs   (MOJI_GAME_FILE overrides the build)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { findEyes } from './lib/sprite_warp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false); const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10136);
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
async function stone(p, atk) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  let t = -1, b = -1, l = -1, r = -1, edge = 0, st = -1, sb = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, a = data[o + 3];
    if (a > 16) { if (t < 0) t = y; b = y; if (l < 0 || x < l) l = x; if (x > r) r = x; if (y === 0 || y === H - 1 || x === 0 || x === W - 1) edge++; }
    if (a >= 200) { const R = data[o], G = data[o + 1], B = data[o + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B); if ((mx ? (mx - mn) / mx : 0) < 0.22 && (R + G + B) / 3 > 120) { if (st < 0) st = y; sb = y; } } }
  // eyes: saturated-red column runs (>= 8px) in the head band, head columns only (the hammer's lava sits further right)
  // the attack lunges +40px and leans +9deg, carrying the head ~140px right: widen the window there (the slam hammer sits at the floor, outside the head band rows)
  const ox = Math.round((W - 1024) / 2), cols = new Uint8Array(W), x0 = 220 + ox - (atk ? 60 : 0), x1 = 620 + ox + (atk ? 160 : 0);
  for (let y = st + 40; y < st + 170; y++) for (let x = x0; x < x1; x++) { const o = (y * W + x) * 4; if (data[o + 3] > 128 && data[o] > 170 && data[o + 1] < 110 && data[o + 2] < 100) cols[x] = 1; }
  let eyes = 0, run = 0; for (let x = 0; x <= W; x++) { if (x < W && cols[x]) run++; else { if (run >= 8) eyes++; run = 0; } }
  const pair = findEyes(data, W, H);   // the two eyes as a pair: their spacing is a rigid facial measure, immune to dust and hammer
  return { W, H, edge, l, r, t, b, stoneH: sb - st + 1, margin: Math.min(l, W - 1 - r, t), eyes, spacing: pair ? pair.spacing : 0 };
}
const rows = []; for (const s of ['idle', 'walk', 'attack']) for (let i = 0; i < 9; i++) rows.push({ s, i, m: await stone(path.join(ROOT, 'Sprites/monsters', s, `smithgolem_${i}.webp`), s === 'attack') });
const ref = rows.filter(r => r.s === 'idle').reduce((a, r) => a + r.m.stoneH, 0) / 9;
// idle/walk are the cut-out rig: the grey-stone span is the body. The attack is a ludo.ai
// set (2026-09-08 pass) whose dust and hammer highlights inflate that span, so its body size is
// pinned by the EYE SPACING instead - the static's 146px, within 5% in every frame.
const REF_SPACING = (await stone(path.join(ROOT, 'Sprites/monsters/smithgolem.webp'), false)).spacing;
ok('idle + walk: grey-stone body height within 6% of the idle mean (no per-frame rescale needed)', rows.filter(r => r.s !== 'attack').every(r => Math.abs(r.m.stoneH / ref - 1) <= 0.06), rows.filter(r => r.s !== 'attack').map(r => (100 * r.m.stoneH / ref).toFixed(0) + '%').join(' '));
ok('attack: both eyes found as a pair in every frame and their spacing within 5% of the static sprite (one head size, never turned away)', REF_SPACING > 0 && rows.filter(r => r.s === 'attack').every(r => r.m.spacing > 0 && Math.abs(r.m.spacing / REF_SPACING - 1) <= 0.05), 'ref ' + REF_SPACING + ' / ' + rows.filter(r => r.s === 'attack').map(r => r.m.spacing).join(','));
ok('no frame touches its canvas edge and every side keeps >= 30px', rows.every(r => r.m.edge === 0 && r.m.margin >= 30), 'min margin ' + Math.min(...rows.map(r => r.m.margin)));
const bottoms = [...new Set(rows.map(r => r.m.b))]; ok('every ink bottom sits on one row', bottoms.length === 1, 'rows ' + bottoms.join(','));
ok('all 27 frames are 1280x1024 (128px added each side for the slam; the body stays centred)', rows.every(r => r.m.W === 1280 && r.m.H === 1024), [...new Set(rows.map(r => r.m.W + 'x' + r.m.H))].join(','));
ok('idle + walk face the camera in every frame: exactly two red eyes in the head band (the attack is covered by the eye-pair rule above)', rows.filter(r => r.s !== 'attack').every(r => r.m.eyes === 2), rows.filter(r => r.s !== 'attack').map(r => r.m.eyes).join(''));
const cs = readFileSync(path.join(ROOT, 'data', 'anim_calib.js'), 'utf8'); const calib = JSON.parse(cs.slice(cs.indexOf('window.LX_ANIM_CALIB = ') + 23, cs.indexOf('window.LX_ATK_HITBOX')).trim().replace(/;\s*$/, ''));
ok('the calib carries NO per-frame scale for the smith golem (the pulse is gone at its source)', !(calib.smithgolem && calib.smithgolem.attack && calib.smithgolem.attack.fs), JSON.stringify(calib.smithgolem || null).slice(0, 120));

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof _monsterFramesFor === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true;
    spawnMonster(player.x + 200, player.y, 'smithgolem', false); const m = game.monsters.filter((x) => x && x.type === 'smithgolem').pop(); if (!m) return Object.assign(o, { err: 'no golem' });
    m.currentHp = m.maxHp; m.facing = 1; game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2);
    const set = _monsterFramesFor('smithgolem'); const t0 = performance.now();
    while (performance.now() - t0 < 20000 && !(set.attack.every((f) => f && f.complete && f.naturalWidth > 0) && set.idle.every((f) => f && f.complete && f.naturalWidth > 0))) await sleep(50);
    const orig = window._monsterStateFrame;
    const blit = (frame, atk) => { window._monsterStateFrame = (mm) => { mm._frameIsAttack = atk; return frame; }; const c = []; const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage;
      P.drawImage = function (im, ...a) { if (this !== ctx) return oI.call(this, im, ...a); if (a.length >= 8) c.push({ w: a[6], h: a[7], bottom: a[5] + a[7] }); else if (a.length >= 4) c.push({ w: a[2], h: a[3], bottom: a[1] + a[3] }); return oI.call(this, im, ...a); };
      try { drawMonster(m); } catch (e) { P.drawImage = oI; return { err: String(e).slice(0, 80) }; } P.drawImage = oI;
      const big = c.filter((d) => d.h > 40).sort((a, b) => b.h - a.h)[0]; return big || { err: 'no blit' }; };
    o.i0 = blit(set.idle[0], false); o.a0 = blit(set.attack[0], true); o.a3 = blit(set.attack[3], true); o.a6 = blit(set.attack[6], true);
    // What the PLAYER sees: the dest rect above misses the calib's ctx.scale, so
    // also read the rendered pixels - clear the canvas, draw the golem, box the ink.
    const cv = ctx.canvas;
    // The game canvas is opaque, so paint a sentinel colour first and box every pixel that differs from it.
    const ink = (frame, atk) => { window._monsterStateFrame = (mm) => { mm._frameIsAttack = atk; return frame; };
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = 'rgb(255,0,255)'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore();
      try { drawMonster(m); } catch (e) { return { err: String(e).slice(0, 80) }; }
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let t = -1, bt = -1;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const k = (y * cv.width + x) * 4; if (Math.abs(d[k] - 255) + d[k + 1] + Math.abs(d[k + 2] - 255) > 60) { if (t < 0) t = y; bt = y; } }
      return { h: bt - t + 1, bottom: bt }; };
    o.px = { i0: ink(set.idle[0], false), w4: ink(set.walk[4], false), a0: ink(set.attack[0], true), a3: ink(set.attack[3], true), a6: ink(set.attack[6], true) };
    window._monsterStateFrame = orig; game.monsters.splice(game.monsters.indexOf(m), 1);
    return o;
  });
  console.log('build ' + r.ver + '  drawn heights idle0 ' + JSON.stringify(r.i0) + '  atk0 ' + JSON.stringify(r.a0) + '  atk3 ' + JSON.stringify(r.a3) + '  atk6 ' + JSON.stringify(r.a6));
  const hs = [r.i0, r.a0, r.a3, r.a6]; const good = hs.every((x) => x && !x.err && x.h > 0);
  const hmax = good ? Math.max(...hs.map((x) => x.h)) : 0, hmin = good ? Math.min(...hs.map((x) => x.h)) : 0;
  ok('the served build blits idle 0 and attack 0/3/6 within 4% of one height (no pulse)', good && (hmax - hmin) / hmax <= 0.04, good ? hs.map((x) => x.h.toFixed(1)).join(' / ') : JSON.stringify(hs));
  ok('the feet stay on one line (bottoms within 3px)', good && Math.max(...hs.map((x) => x.bottom)) - Math.min(...hs.map((x) => x.bottom)) <= 3, good ? hs.map((x) => x.bottom.toFixed(1)).join(' / ') : '');
  const px = r.px || {}; const pv = ['i0', 'w4', 'a0', 'a3', 'a6'].map((k) => px[k]); const pgood = pv.every((x) => x && !x.err && x.h > 20);
  console.log('rendered ink heights (what the player sees) idle0/walk4/atk0/atk3/atk6: ' + (pgood ? pv.map((x) => x.h).join(' / ') : JSON.stringify(px)));
  // idle/walk (the rig) render at one height. The painted attack frames raise the hammer over
  // the head and throw chips, so their INK is taller - the body under it is pinned by the
  // eye-pair rule above. On screen they may only be taller than idle (never smaller), by <= 30%.
  const ih = pgood ? px.i0.h : 0;
  ok('rendered on screen, idle and walk are one height within 6% (the pulse is gone for the player)', pgood && Math.abs(px.w4.h / ih - 1) <= 0.06, pgood ? px.i0.h + ' / ' + px.w4.h : '');
  ok('rendered on screen, attack frames are never smaller than idle and at most 30% taller (raised hammer, chips)', pgood && ['a0', 'a3', 'a6'].every((k) => px[k].h >= ih * 0.97 && px[k].h <= ih * 1.3), pgood ? ['a0', 'a3', 'a6'].map((k) => px[k].h).join(' / ') + ' vs idle ' + ih : '');
  ok('rendered ink bottoms sit on one line (within 3px)', pgood && Math.max(...pv.map((x) => x.bottom)) - Math.min(...pv.map((x) => x.bottom)) <= 3, pgood ? pv.map((x) => x.bottom).join(' / ') : '');
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
