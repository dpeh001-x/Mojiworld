// SUMMONS STAND ON THE FLOOR WHEN THE BROWSER CANNOT READ THE ART'S PIXELS (per user: "ensure that summons foot especially the lich are positioned on the floor line or below.
// They are still levitating above the floor line"). On the live deploy the art comes from the CDN and a packaged build runs from file://: a tainted canvas, so getImageData throws and the
// summon measures (content box, content bottom, feet gap) all fell back to "the frame's bottom" - the transparent padding (12% of the frame, ~13 px) held every undead above the floor.
//   table : data/sprite_bbox.js carries LX_SUMMON_BOX, a row for every file under Sprites/summons, equal to the measures recomputed from the art (sampled files)
//   live  : the same undead (static, walk, attack) and both wolves, measured through the REAL draw twice - served over http (readback works) and opened from file:// (readback blocked) -
//           the lowest foot ink sits 0 to 12 px below the floor line in both, and the two agree within 3 px
//   node scripts/summon_feet_table_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { readFileSync, readdirSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10351);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) : '')); };
// ---- table
const js = readFileSync(path.join(ROOT, 'data/sprite_bbox.js'), 'utf8'), m = js.match(/^window\.LX_SUMMON_BOX = (.*);$/m); const T = m ? JSON.parse(m[1]) : {};
const files = []; const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith('_')) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(webp|png)$/.test(e.name)) files.push(path.relative(path.join(ROOT, 'Sprites'), p).split('\\').join('/')); } }; walk(path.join(ROOT, 'Sprites', 'summons'));
ok('data/sprite_bbox.js carries LX_SUMMON_BOX with a row for every file under Sprites/summons', files.length > 100 && files.every((f) => T[f]), { files: files.length, rows: Object.keys(T).length, missing: files.filter((f) => !T[f]).slice(0, 4) });
const lowest = async (rel, thr) => { const { data, info } = await sharp(path.join(ROOT, 'Sprites', rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); for (let y = info.height - 1; y >= 0; y--) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] >= thr) return { y, H: info.height }; return { y: -1, H: info.height }; };
let rowsOk = true; const bad = []; for (const f of ['summons/zombie.webp', 'summons/skeleton.webp', 'summons/anim/zombie_walk_3.webp', 'summons/anim/skeleton_attack_5.webp', 'summons/anim/werewolf_walk_2.webp', 'summons/anim/wolf_attack_4.webp']) {
  const a = (T[f] || '').split(',').map(Number), l = await lowest(f, 41), l64 = await lowest(f, 65); if (!(a[3] === l.H && a[4] === l.y && a[1] === l64.y)) { rowsOk = false; bad.push([f, a.join(','), l.y, l64.y]); } }
ok('sampled rows equal the measures recomputed from the art (bottom alpha > 64, cb alpha > 40, H)', rowsOk, bad);
// ---- live (twice)
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const medianOf = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
async function run(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  try {
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof raiseMinion === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
    const R = await page.evaluate(async () => {
      const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
      try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('warrior'); player.level = 60; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
      loadMap('forest', 200); await W8(2500); game.paused = false; game.monsters = [];
      const ground = Math.max(...(game.mapData.platforms || []).filter((p) => p.type === 'ground').map((p) => p.y));
      const rows = []; let tag = null; const od = CanvasRenderingContext2D.prototype.drawImage, ds = window._lxDrawSoft;
      const push = (img, dy, dh) => { try { if (tag && tag.pet && !(Math.abs(tag.pet.vy || 0) < 0.3 && Math.abs(tag.pet.vx || 0) < 0.3)) return; const k = _lxSpriteKeyOf(img); if (tag && k && /^summons\//.test(k)) rows.push({ tag, k, dy, dh, floor: tag.pet ? tag.pet.y + 36 * (tag.pet.scale || 1) : tag.floor }); } catch (e) {} };   // a pet's floor is read AT the draw (its AI wanders onto platforms)
      CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) { if (tag && tag.t === 'u' && a.length === 4) push(img, a[1], a[3]); return od.apply(this, [img, ...a]); };
      window._lxDrawSoft = function (c, img, dx, dy, dw, dh) { if (tag && tag.t === 'p') push(img, dy, dh); return ds.apply(this, arguments); };
      // undead: one at a time, static / walk / attack
      for (const type of ['skeleton', 'zombie']) for (const st of ['static', 'walk', 'attack']) {
        game.minions = []; raiseMinion(player.x + 120, ground, type, 9e6, 1); const mn = game.minions[0]; mn.spawn = 0; for (let t = 0; t < 40; t++) await frame();
        for (let t = 0; t < 70; t++) { mn.life = 9e6; mn.spawn = 0; mn.cd = 99999; if (st === 'walk') { mn.vx = (Math.floor(t / 35) % 2 ? -1.6 : 1.6); mn.facing = mn.vx > 0 ? 1 : -1; } else if (st === 'attack') { mn.vx = 0; mn._atkAnimUntil = (game.time | 0) + 30; mn._atkAnimAt = performance.now() - (t % 9) * 90; mn.cd = 450; } else mn.vx = 0;
          tag = { t: 'u', n: type + '/' + st, floor: mn.y + mn.h }; await frame(); }
      }
      game.minions = [];
      // wolves (the ranger's pet, the apex werewolf): drawn straight through drawWolf on a stationary pet object - a live pet's AI wanders and leaps, which no floor line can follow
      for (const [n, scale, sprite] of [['wolf', 2.4, undefined], ['werewolf', 2.8, 'werewolf']]) for (const st of ['idle', 'walk', 'bite']) {
        for (let t = 0; t < 36; t++) { const pet = { x: player.x + 110, y: ground - 36 * scale, vx: st === 'walk' ? 1.6 : 0, vy: 0, facing: 1, hp: 1e9, maxHp: 1e9, life: 9e6, maxLife: 9e6, cdAtk: st === 'bite' ? 1200 - (t % 9) * 80 : 0, scale, sprite };
          tag = { t: 'p', n: n + '/' + st, floor: pet.y + 36 * scale }; ctx.save(); try { drawWolf(pet); } finally { ctx.restore(); } tag = null; await frame(); }
      }
      CanvasRenderingContext2D.prototype.drawImage = od; window._lxDrawSoft = ds; tag = null;
      return { rows, ground, readable: (() => { try { const c = document.createElement('canvas').getContext('2d'); c.drawImage(LX_SUMMON.zombie, 0, 0); c.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; } })() };
    });
    const cache = {}, per = {};
    for (const r of R.rows) { const k = r.k; if (!cache[k]) cache[k] = await lowest(k, 128); const L = cache[k]; if (L.y < 0) continue; const bottom = r.dy + r.dh * (L.y + 1) / L.H; (per[r.tag.n] = per[r.tag.n] || []).push(bottom - r.floor); }
    return { per, readable: R.readable, errs };
  } finally { await page.close(); }
}
try {
  const http = await run(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`), file = await run('file:///' + path.join(ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html').split('\\').join('/') + '?dev=1');
  ok('over http the art is readable, from file:// it is not (the two modes really differ)', http.readable === true && file.readable === false, { http: http.readable, file: file.readable });
  const names = Object.keys(http.per).sort(); const rep = {};
  for (const n of names) { const a = http.per[n], b = file.per[n] || []; rep[n] = { http: a.length ? +medianOf(a).toFixed(1) : null, file: b.length ? +medianOf(b).toFixed(1) : null, n: [a.length, b.length] }; }
  ok('every undead state and both wolves were sampled in both modes (3+ draws each: a loaded machine draws fewer frames)', names.length >= 12 && names.every((n) => http.per[n].length >= 3 && (file.per[n] || []).length >= 3), rep);
  ok('over http the lowest foot ink sits on or just under the floor line (0 to 12 px below) for every state', names.every((n) => { const v = medianOf(http.per[n]); return v >= -0.5 && v <= 12; }), rep);
  ok('from file:// (readback blocked) it does too - no summon stands on its padding above the floor', names.every((n) => { const v = medianOf(file.per[n] || [99]); return v >= -0.5 && v <= 12; }), rep);
  ok('and the two modes agree within 3 px per state', names.every((n) => Math.abs(medianOf(http.per[n]) - medianOf(file.per[n] || [99])) <= 3), rep);
  ok('no page errors in either mode', http.errs.length === 0 && file.errs.length === 0, { http: http.errs.slice(0, 2), file: file.errs.slice(0, 2) });
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
