// MONSTERS KEEP THEIR FEET ON THE FLOOR WHEN THE BROWSER CANNOT READ THE ART'S PIXELS (per user: "ensure that monsters, summons and bosses foot (if not flying) is always on or below the floorline").
// A padded swing frame (pathsBane, fatDragon, the Forgewight, Tomb Keeper, ...) is planted by ITS OWN content bottom, read through _spriteContentBox; with the readback blocked (the CDN deploy, a
// file:// build) the box was null and the frame kept the idle's offset - pathsBane's attack floated 16.5 px above the floor. _spriteContentBox now falls back to the baked bbox rows
// (LX_SPRITE_BBOX for monsters / bosses, LX_SUMMON_BOX for summons), scaled to the raster that is drawn.
//   live : each type drawn through the real _drawMonsterSprite, idle / walk / attack, once over http (readable) and once from file:// (blocked): the lowest foot ink (alpha >= 128, read from the art by key)
//          sits on or below the floor line (>= -0.5 px) in both modes and the two agree within 8 px
//   node scripts/blocked_readback_plant_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10361);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
const TYPES = ['pathsBane', 'fatDragon', 'forgewight', 'tombKeeper', 'echoKnight', 'cosmicMochi', 'slime'];
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const lowCache = {}; const low = async (key) => { if (key in lowCache) return lowCache[key]; let r = null; try { const { data, info } = await sharp(path.join(ROOT, 'Sprites', key)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); for (let y = info.height - 1; y >= 0 && !r; y--) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] >= 128) { r = { y, H: info.height }; break; } } catch (e) {} return (lowCache[key] = r); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function run(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  try {
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawMonsterSprite === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
    const R = await page.evaluate(async (TYPES) => {
      const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
      try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('warrior'); player.level = 60; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
      Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 }); loadMap('forest', 200); await W8(2500); game.paused = false; game.monsters = [];
      const readable = (() => { try { const c = document.createElement('canvas').getContext('2d'); const im = Object.values(MONSTER_SPRITES).find((i) => i && (i.naturalWidth || i.width)); c.drawImage(im, 0, 0); c.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; } })();
      const gy = Math.max(...(game.mapData.platforms || []).filter((p) => p.type === 'ground').map((p) => p.y)), rows = []; let cur = null, inDraw = null, inSoft = 0;
      const ds = window._lxDrawSoft, od = CanvasRenderingContext2D.prototype.drawImage, wrapM = window._drawMonsterSprite;
      const record = (img, dy, dh) => { try { if (!cur || !inDraw) return; const k = _lxSpriteKeyOf(img); if (!k || k.indexOf(cur.type) < 0 || !/^monsters\//.test(k)) return; const rel = inDraw.T.inverse().multiply(ctx.getTransform()); rows.push({ k, st: cur.st, type: cur.type, dy, dh, rd: rel.d, rf: rel.f, floor: inDraw.floor }); } catch (e) {} };
      window._lxDrawSoft = function (c, img, dx, dy, dw, dh) { inSoft++; try { record(img, dy, dh); return ds.apply(this, arguments); } finally { inSoft--; } };
      CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) { if (!inSoft && a.length >= 4) record(img, a.length === 8 ? a[5] : a[1], a.length === 8 ? a[7] : a[3]); return od.apply(this, [img, ...a]); };
      window._drawMonsterSprite = function (m, sx, sy) { const prev = inDraw; inDraw = { T: ctx.getTransform(), floor: sy + m.h }; try { return wrapM.apply(this, arguments); } finally { inDraw = prev; } };
      for (const type of TYPES) for (const st of ['idle', 'walk', 'attack']) {
        game.monsters = []; const m = spawnMonster(560, gy - 400, type, false, false); m.currentHp = m.maxHp = 9e9; m._bigMeleeCd = 1e9; m.aggroTarget = null;
        for (let i = 0; i < 90 && !(m.onGround || (m.y + m.h >= gy - 1)); i++) { player.x = 330; player.y = gy - player.h; await frame(); }
        const t0 = performance.now(); while (performance.now() - t0 < (st === 'idle' ? 1800 : 2400)) { player.x = 330; player.y = gy - player.h; m.currentHp = m.maxHp;
          if (st === 'walk') { m.vx = (Math.floor((performance.now() - t0) / 900) % 2 ? -1.3 : 1.3); m.facing = m.vx > 0 ? 1 : -1; } else m.vx = 0;
          if (st === 'attack') { m.atkAnimUntil = performance.now() + 300; m._swingUntil = performance.now() + 300; } cur = { type, st }; await frame(); }
        cur = null; game.monsters = [];
      }
      window._lxDrawSoft = ds; CanvasRenderingContext2D.prototype.drawImage = od; window._drawMonsterSprite = wrapM; return { rows, readable };
    }, TYPES);
    const per = {}; for (const r of R.rows) { const L = await low(r.k); if (!L) continue; const g = r.rf + r.rd * (r.dy + r.dh * (L.y + 1) / L.H) - r.floor; if (Math.abs(g) > 400) continue; (per[r.type + '/' + r.st] = per[r.type + '/' + r.st] || []).push(g); }
    return { per, readable: R.readable, errs };
  } finally { await page.close(); }
}
// the zodiac arena boss: Aquarius, a ground sign whose art carries 173 empty rows under its feet, hung ~58 px above the floor (the canvas bottom was planted)
async function runAquarius(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawZodiacBoss === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
    const rows = await page.evaluate(async () => { const W8 = (ms) => new Promise((r) => setTimeout(r, ms)); try { _lxBootGateDone = true; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; applyClass('warrior'); player._god = true; player.invulnerable = 9e9; player.level = 90; window._perfTick = () => {}; loadMap('zod_aquarius', 200); await W8(3500); game.paused = false;
      const out = []; let inD = null; const ds = window._lxDrawSoft, wb = window._drawBossSprite; window._lxDrawSoft = function (c, img, dx, dy, dw, dh) { try { if (inD) { const k = _lxSpriteKeyOf(img); if (k && /zodiac\/idle/.test(k) && /aquarius/.test(k)) { const rel = inD.T.inverse().multiply(ctx.getTransform()); out.push({ k, dy, dh, rd: rel.d, rf: rel.f, floor: inD.floor }); } } } catch (e) {} return ds.apply(this, arguments); };
      window._drawBossSprite = function (sp, m, sx, sy) { const prev = inD; inD = { T: ctx.getTransform(), floor: sy + m.h }; try { return wb.apply(this, arguments); } finally { inD = prev; } };
      const t0 = performance.now(); while (performance.now() - t0 < 5000) { const b = game.monsters.find((m) => m.zodiacSign); if (b) { b.currentHp = b.maxHp = 9e9; b.vx = 0; } await new Promise((r) => requestAnimationFrame(r)); } window._lxDrawSoft = ds; window._drawBossSprite = wb; return out; });
    const gaps = []; for (const r of rows) { const L = await low(r.k); if (L) gaps.push(r.rf + r.rd * (r.dy + r.dh * (L.y + 1) / L.H) - r.floor); } return gaps;
  } finally { await page.close(); }
}
try {
  const http = await run(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`), file = await run('file:///' + path.join(ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html').split('\\').join('/') + '?dev=1');
  ok('over http the art is readable, from file:// it is not', http.readable === true && file.readable === false, { http: http.readable, file: file.readable });
  const names = []; for (const t of TYPES) for (const s of ['idle', 'walk', 'attack']) names.push(t + '/' + s); const rep = {};
  for (const n of names) { const a = http.per[n] || [], b = file.per[n] || []; rep[n] = [a.length ? +med(a).toFixed(1) : null, b.length ? +med(b).toFixed(1) : null, a.length, b.length]; }
  const thin = names.filter((n) => (http.per[n] || []).length < 3 || (file.per[n] || []).length < 3).map((n) => [n, rep[n]]);
  ok('every type and state was sampled in both modes (3+ draws each: a loaded machine draws fewer frames)', thin.length === 0, thin);
  ok('over http every type stands on or below the floor line in idle / walk / attack', names.every((n) => med(http.per[n] || [-99]) >= -0.5), rep);
  ok('from file:// (readback blocked) it does too - pathsBane\'s padded swing no longer floats 16 px', names.every((n) => med(file.per[n] || [-99]) >= -0.5), rep);
  const off = names.filter((n) => Math.abs(med(http.per[n] || [-99]) - med(file.per[n] || [99])) > 8).map((n) => [n, rep[n]]);
  ok('and the two modes agree within 8 px per state (the baked bottom row needs two opaque pixels in a row, the runtime scan one)', off.length === 0, off);
  { const a = await runAquarius(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`); ok('Aquarius (a ground zodiac boss) stands on or just under the floor line, not 58 px above it', a.length >= 10 && med(a) >= -0.5 && med(a) <= 12, { n: a.length, median: a.length ? +med(a).toFixed(1) : null }); }
  ok('no page errors in either mode', http.errs.length === 0 && file.errs.length === 0, { http: http.errs.slice(0, 2), file: file.errs.slice(0, 2) });
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
