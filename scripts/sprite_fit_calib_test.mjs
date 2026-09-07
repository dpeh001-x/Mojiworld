// Sprite fit (v0.30.408): the sets the audit flagged as drawn small in one state now carry a
// calib state scale that restores the body to the idle's size. Checks the calib values, then in
// the served build blits a forced attack frame and an idle frame for each monster and compares
// their body heights the way the smith-golem test does (the same drawn frame scale, the same foot
// line). scripts/sprite_fit_audit.mjs is the finder; this pins what it found.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10201); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const calibSrc = readFileSync(path.join(SERVE_ROOT, 'data', 'anim_calib.js'), 'utf8');
const calib = (() => { const a = calibSrc.indexOf('window.LX_ANIM_CALIB = ') + 'window.LX_ANIM_CALIB = '.length; const b = calibSrc.indexOf('window.LX_ATK_HITBOX', a); return JSON.parse(calibSrc.slice(a, b).replace(/;\s*$/, '')); })();
// what the audit measured: the state's body height as a share of the idle's, before any calib
const WANT = { conductorMech: { attack: 1.69 }, echoKnight: { attack: 2.11 }, forgewight: { attack: 2.90 }, ossuaryTyrant: { attack: 1.40 }, pathsBane: { attack: 3.42 }, tombKeeper: { attack: 2.29 }, zodiac_cancer: { walk: 1.37, attack: 1.43 } };
for (const key of Object.keys(WANT)) for (const st of Object.keys(WANT[key])) { const s = calib[key] && calib[key][st] && calib[key][st].s; ok(`calib ${key}.${st}.s = ${WANT[key][st]}`, typeof s === 'number' && Math.abs(s - WANT[key][st]) < 0.02, String(s)); }
// --- the served build: a forced attack frame blits a body the idle's size --------------------------------------
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof _monsterFramesFor === 'function' && typeof _lxAnimCalib === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async (keys) => {
    const o = { ver: GAME_VERSION, rows: {} }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true;
    const blit = (m, frame, isAttack) => { const orig = _monsterStateFrame; window._monsterStateFrame = (mm) => { mm._frameIsAttack = isAttack; return frame; }; const c = []; const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; P.drawImage = function (im, ...a) { const d = a.length >= 8 ? { x: a[4], y: a[5], w: a[6], h: a[7] } : { x: a[0], y: a[1], w: a[2], h: a[3] }; if (this === ctx) { const t = this.getTransform(); d.sy = t.d; d.ty = t.f; c.push(d); } return oI.apply(this, [im, ...a]); }; try { drawMonster(m); } catch (e) { c.push({ err: String(e && e.message) }); } finally { P.drawImage = oI; window._monsterStateFrame = orig; } const big = c.filter((d) => !d.err && d.w > 10).sort((a, b) => b.w * b.h - a.w * a.h)[0]; return big ? { h: big.h * big.sy, bottom: (big.y + big.h) * big.sy + big.ty } : { err: (c.find((d) => d.err) || {}).err || 'no blit' }; };
    for (const key of keys) {
      try {
        spawnMonster(player.x + 200, player.y, key, false); const m = game.monsters.filter((x) => x && x.type === key).pop(); if (!m) { o.rows[key] = { err: 'no spawn' }; continue; }
        m.currentHp = m.maxHp; m.facing = 1; game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2);
        const set = _monsterFramesFor(key); const idle = (set.idle || [])[0], atk = (set.attack || [])[0];
        const t0 = performance.now(); while (performance.now() - t0 < 20000 && !([idle, atk].every((f) => f && f.complete && f.naturalWidth > 0))) await sleep(50);
        if (!idle || !atk || !idle.naturalWidth || !atk.naturalWidth) { o.rows[key] = { err: 'frames not loaded' }; game.monsters.splice(game.monsters.indexOf(m), 1); continue; }
        // the body's share of each frame's content, from the art itself (alpha box), so the comparison is body vs body
        const box = (img) => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let y0 = c.height, y1 = -1; for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 24) { if (y < y0) y0 = y; if (y > y1) y1 = y; } return { top: y0 / c.height, h: (y1 - y0 + 1) / c.height }; };
        const bi = box(idle), ba = box(atk); const di = blit(m, idle, false), da = blit(m, atk, true);
        // feet = where the art's lowest opaque row lands on screen (frame bottom minus the frame's empty margin below the content)
        const feet = (d, b) => d.bottom - d.h * (1 - (b.top + b.h));
        o.rows[key] = { s: (_lxAnimCalib(key, 'attack') || {}).s, idleBody: +(di.h * bi.h).toFixed(1), atkBody: +(da.h * ba.h).toFixed(1), ratio: +((da.h * ba.h) / (di.h * bi.h)).toFixed(3), feetDelta: +(feet(da, ba) - feet(di, bi)).toFixed(1), err: di.err || da.err };
        game.monsters.splice(game.monsters.indexOf(m), 1);
      } catch (e) { o.rows[key] = { err: String(e && e.message).slice(0, 80) }; }
    }
    return o;
  }, ['conductorMech', 'echoKnight', 'forgewight', 'ossuaryTyrant', 'pathsBane', 'tombKeeper']);
  console.log('build ' + r.ver + '  ' + JSON.stringify(r.rows));
  for (const key of Object.keys(r.rows)) { const x = r.rows[key]; ok(`${key}: a forced attack frame 0 blits a body within 15% of the idle's (was ${{ conductorMech: '59%', echoKnight: '47%', forgewight: '43%', ossuaryTyrant: '72%', pathsBane: '29%', tombKeeper: '44%' }[key]}), feet within 8 px of the idle's`, !x.err && x.ratio > 0.85 && x.ratio < 1.15 && Math.abs(x.feetDelta) <= 8, JSON.stringify(x)); }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
