// In-game hitbox coverage + state-size probe (the finder behind the v0.30.415 hitbox review and the coverage pass).
// attack the player, hook drawImage on the game canvas, and for each draw map the drawn image's VISIBLE pixels
// (alpha box, cached per image object - so transparent padding never counts) through the draw rect and the
// canvas transform to screen space. Compare that visible box with the hitbox (m.x/y/w/h, camera-relative,
// times the render scale). Reports per type/state: visible height (design px), hitbox coverage of the visible
// height, the share of the art above the hitbox top, and the body height per state relative to idle.
//   PORT, OUT (json path), ONLY=type,type
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const ROOT = process.env.MOJI_SERVE_ROOT || 'C:/Users/dpeh0/Mojiworld'; const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html'; const PORT = Number(process.env.PORT || 10261); const OUT = process.env.OUT;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
page.on('console', (m) => { if (/^\[probe\]/.test(m.text())) console.log(m.text().slice(0, 160)); });
await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof monsterTypes === 'object', null, { timeout: 180000 }); await page.waitForTimeout(6000);
const r = await page.evaluate(async (only) => {
  const o = { ver: GAME_VERSION, types: {} }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
  try { loadMap('forest', 300); } catch (e) {} await sleep(500); player.invulnerable = 9e9; player.hp = player.maxHp = 999999; player.level = 99;
  const groundY = player.y + player.h;
  // visible box of any drawn image object, cached
  const boxCache = new WeakMap();
  const contentBox = (im) => { let b = boxCache.get(im); if (b !== undefined) return b; const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; if (!(w > 1 && h > 1)) return null; try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) { const row = y * w * 4; for (let xx = 0; xx < w; xx++) { if (d[row + xx * 4 + 3] > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } } } b = x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h }; } catch (e) { b = null; } boxCache.set(im, b); return b; };
  const list = only.length ? only : Object.keys(monsterTypes).filter((t) => monsterTypes[t] && !/^(pqConductor|towerArbiter|towerSovereign)$/.test(t));
  const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; const oDraw = window.drawMonster;
  for (const type of list) {
    const def = monsterTypes[type]; const isBoss = !!(def.boss || def.isBoss || /^zodiac_/.test(type));
    try {
      game.paused = true; game.monsters.length = 0; game.projectiles = []; player.x = 300; player.y = groundY - player.h; player.vx = 0;
      let m; try { spawnMonster(player.x + 420, groundY - (def.h || 40), type, isBoss); m = game.monsters.filter((x) => x && x.type === type).pop(); } catch (e) { o.types[type] = { err: 'spawn: ' + String(e.message).slice(0, 60) }; continue; }
      if (!m) { o.types[type] = { err: 'no spawn' }; continue; }
      m.currentHp = m.maxHp; m.isElite = false; m.isMiniBoss = false; m._stagger = 0; m.evasion = 0; m.aggroTarget = true; m._wardUntil = 0; m.invulnerable = 0;
      const t0 = performance.now(); while (performance.now() - t0 < 6000) { const set = (typeof _monsterFramesFor === 'function') ? _monsterFramesFor(type) : null; const fr = set ? [].concat(set.idle || [], set.walk || [], set.attack || []) : []; if (!fr.length || fr.every((f) => f && (f.complete !== false) && (f.naturalWidth || f.width) > 0)) break; await sleep(100); }
      const samples = []; let cur = null;
      window.drawMonster = function (mm) { const t = ctx.getTransform(); cur = (mm === m && !(mm._stagger > 0)) ? { st: mm._frameIsAttack ? 'attack' : ((typeof _mobWalking === 'function' && _mobWalking(mm)) ? 'walk' : 'idle'), best: null, hb: { x: (mm.x - game.camera.x) * t.a + t.e, y: (mm.y - (game.camera.y || 0)) * t.d + t.f, w: mm.w * t.a, h: mm.h * t.d }, sc: t.a } : null; const r = oDraw.apply(this, arguments); if (cur && cur.best) samples.push(Object.assign({ st: cur.st, hb: cur.hb, sc: cur.sc }, cur.best)); cur = null; return r; };
      P.drawImage = function (im, ...a) { if (cur && this === ctx) { const nine = a.length >= 8; const sx = nine ? a[0] : 0, sy = nine ? a[1] : 0, sw = nine ? a[2] : (im.naturalWidth || im.width), sh = nine ? a[3] : (im.naturalHeight || im.height), dx = nine ? a[4] : a[0], dy = nine ? a[5] : a[1], dw = nine ? a[6] : (a[2] || sw), dh = nine ? a[7] : (a[3] || sh); const src = String(im.src || (im._lxSrc && im._lxSrc.src) || ''); if (/\/(fx|vfx|projectiles|summons|ui)\//.test(src)) return oI.apply(this, [im, ...a]); const b = contentBox(im); if (b && dw > 8 && dh > 8) { const t = this.getTransform(); const px = (x, y) => ({ x: x * t.a + y * t.c + t.e, y: x * t.b + y * t.d + t.f }); const vx0 = dx + (b.x0 - sx) * dw / sw, vx1 = dx + (b.x1 - sx) * dw / sw, vy0 = dy + (b.y0 - sy) * dh / sh, vy1 = dy + (b.y1 - sy) * dh / sh; const c1 = px(vx0, vy0), c2 = px(vx1, vy1); const v = { x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y), w: Math.abs(c2.x - c1.x), h: Math.abs(c2.y - c1.y) }; if (!cur.best || v.h > cur.best.v.h) cur.best = { v }; } } return oI.apply(this, [im, ...a]); };
      game.paused = false;
      // far (walk), then adjacent (attack); idle samples come from the pauses in between
      const t1 = performance.now(); while (performance.now() - t1 < 2200) { player.x = m.x - 380; player.vx = 0; await sleep(40); }
      const t2 = performance.now(); while (performance.now() - t2 < 3600) { player.x = m.x - (m.w > 120 ? m.w * 0.6 : 70); player.vx = 0; await sleep(40); if (samples.filter((s) => s.st === 'attack').length > 60) break; }
      game.paused = true; P.drawImage = oI; window.drawMonster = oDraw;
      const by = { idle: [], walk: [], attack: [] }; for (const s of samples) by[s.st].push(s);
      const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
      const low = (arr) => { const s = arr.slice().sort((a, b) => a - b); const k = Math.max(1, Math.floor(s.length / 3)); return s.length ? s[k >> 1] : null; };
      const sc = samples.length ? samples[0].sc : 1;
      const stat = (arr, rest) => { if (!arr.length) return null; const hs = arr.map((s) => s.v.h); const H = (rest ? low(hs) : med(hs)); const pick = arr.filter((s) => Math.abs(s.v.h - H) < H * 0.06); const q = pick.length ? pick : arr; const above = med(q.map((s) => (s.hb.y - s.v.y) / s.v.h)); const cover = med(q.map((s) => s.hb.h / s.v.h)); const wr = med(q.map((s) => s.hb.w / s.v.w)); const top = med(q.map((s) => (s.hb.y - s.v.y) / sc)); const bottom = med(q.map((s) => (s.v.y + s.v.h - (s.hb.y + s.hb.h)) / sc)); const dxc = med(q.map((s) => ((s.v.x + s.v.w / 2) - (s.hb.x + s.hb.w / 2)) / sc)); return { n: arr.length, visH: +(H / sc).toFixed(1), visW: +(med(q.map((s) => s.v.w)) / sc).toFixed(1), aboveFrac: +above.toFixed(3), coverage: +cover.toFixed(3), widthRatio: +wr.toFixed(3), artAboveBoxPx: +top.toFixed(1), artBelowBoxPx: +bottom.toFixed(1), dxCenter: +dxc.toFixed(1) }; };
      const idle = stat(by.idle, false), walk = stat(by.walk, false), attack = stat(by.attack, true);
      o.types[type] = { boss: isBoss, box: { w: m.w, h: m.h }, idle, walk, attack, walkVsIdle: (idle && walk) ? +(walk.visH / idle.visH).toFixed(3) : null, attackVsIdle: (idle && attack) ? +(attack.visH / idle.visH).toFixed(3) : null };
      console.log('[probe] ' + type + ' ' + JSON.stringify({ box: m.h, idle: idle && idle.visH, walk: walk && walk.visH, attack: attack && attack.visH, cover: idle && idle.coverage, above: idle && idle.aboveFrac }));
      game.monsters.length = 0; game.projectiles = [];
    } catch (e) { P.drawImage = oI; window.drawMonster = oDraw; o.types[type] = { err: String(e && e.message).slice(0, 80) }; }
  }
  return o;
}, (process.env.ONLY || '').split(',').filter(Boolean));
writeFileSync(OUT, JSON.stringify(r, null, 1)); console.log('wrote ' + OUT + ' (' + Object.keys(r.types).length + ' types)'); await browser.close(); server.kill();
