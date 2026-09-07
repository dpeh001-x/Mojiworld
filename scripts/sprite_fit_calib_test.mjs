// Sprite fit (v0.30.415): the padded attack sets draw their body at the idle's size in REAL play.
// The game undoes an attack set's transparent padding with _ATK_FRAME_SCALE (per type, since
// v0.26.351); v0.30.408 stacked calib state scales on top of that table for four of those types,
// and the five drew 2-5x too big whenever they attacked. This test lets each monster attack the
// player through its own AI and reads the blit it draws while m._frameIsAttack is set, against the
// blit it draws idle; body = blit height x the frame's own content fraction. The forced-frame probe
// the v0.30.408 test used never reached the calib scale, which is how the stacking went unseen.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10201); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const calibSrc = readFileSync(path.join(SERVE_ROOT, 'data', 'anim_calib.js'), 'utf8');
const calib = (() => { const a = calibSrc.indexOf('window.LX_ANIM_CALIB = ') + 'window.LX_ANIM_CALIB = '.length; const b = calibSrc.indexOf('window.LX_ATK_HITBOX', a); return JSON.parse(calibSrc.slice(a, b).replace(/;\s*$/, '')); })();
const sOf = (key, st) => { const c = calib[key] && calib[key][st]; return (c && c.s != null) ? c.s : 1; };
// every v0.30.408 attack scale is gone: the padded types were already sized by _ATK_FRAME_SCALE, and the Ossuary
// Tyrant's rest frames already match its idle in play (the static audit's "three smallest frames" misread it)
for (const key of ['pathsBane', 'tombKeeper', 'echoKnight', 'conductorMech', 'ossuaryTyrant']) ok(`calib ${key}.attack.s is 1 (v0.30.408's scale reverted)`, Math.abs(sOf(key, 'attack') - 1) < 0.001, String(sOf(key, 'attack')));
ok('calib forgewight.attack.s is back at its hand-set 1.26', Math.abs(sOf('forgewight', 'attack') - 1.26) < 0.001, String(sOf('forgewight', 'attack')));
ok('zodiac_cancer carries no walk/attack scale (reverted)', Math.abs(sOf('zodiac_cancer', 'walk') - 1) < 0.001 && Math.abs(sOf('zodiac_cancer', 'attack') - 1) < 0.001, JSON.stringify(calib.zodiac_cancer));
// --- the served build: real attacks -----------------------------------------------------------------------------
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof _monsterFramesFor === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async (keys) => {
    const o = { ver: GAME_VERSION, rows: {}, table: (typeof _ATK_FRAME_SCALE !== 'undefined') ? Object.assign({}, _ATK_FRAME_SCALE) : null }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(400); player.invulnerable = 9e9; player.hp = player.maxHp = 99999;
    const frac = (img) => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let y0 = c.height, y1 = -1; for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 24) { if (y < y0) y0 = y; if (y > y1) y1 = y; } return (y1 - y0 + 1) / c.height; };
    for (const key of keys) {
      try {
        game.paused = true; game.monsters.length = 0;
        spawnMonster(player.x + 90, player.y, key, false); const m = game.monsters.filter((x) => x && x.type === key).pop(); if (!m) { o.rows[key] = { err: 'no spawn' }; continue; }
        m.currentHp = m.maxHp; m.evasion = 0; m.aggroTarget = true; game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2);
        const set = _monsterFramesFor(key); const t0 = performance.now(); while (performance.now() - t0 < 20000 && !['idle', 'attack'].every((st) => (set[st] || []).every((f) => f && f.complete && f.naturalWidth > 0))) await sleep(50);
        const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; const samples = { idle: [], attack: [] }; let cur = null;
        const oDraw = window.drawMonster; window.drawMonster = function (mm) { cur = (mm === m) ? { st: mm._frameIsAttack ? 'attack' : 'idle', best: null } : null; const r = oDraw.apply(this, arguments); if (cur && cur.best) samples[cur.st].push(cur.best); cur = null; return r; };
        P.drawImage = function (im, ...a) { if (cur && this === ctx) { const d = a.length >= 8 ? { w: a[6], h: a[7] } : { w: a[2], h: a[3] }; const t = this.getTransform(); const bh = d.h * t.d; const src = String(im.src || (im._lxSrc && im._lxSrc.src) || ''); if (bh > 10 && (!cur.best || bh > cur.best.h)) cur.best = { h: bh, src, fi: (im._lxFi != null) ? im._lxFi : (im._lxSrc && im._lxSrc._lxFi != null ? im._lxSrc._lxFi : 0) }; } return oI.apply(this, [im, ...a]); };
        game.paused = false; const t1 = performance.now(); while (performance.now() - t1 < 9000) { player.x = m.x - 70; player.vx = 0; await sleep(40); if (samples.attack.length > 40 && samples.idle.length > 20) break; }
        game.paused = true; P.drawImage = oI; window.drawMonster = oDraw;
        // the wind-up draws idle art while the attack flag is already set; the attack frames blit at one height
        // (the box times the padding multiplier times the calib), so keep the samples in that tallest cluster
        if (samples.attack.length) { const hmax = Math.max(...samples.attack.map((x) => x.h)); samples.attack = samples.attack.filter((x) => x.h > hmax * 0.9); }
        const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
        // body on screen = blit height x that frame's content fraction. A slash or flare frame's content is taller than
        // the body, so the attack body is read from the smallest third of the samples (the rest poses), as the audit does
        const low = (arr) => { const s = arr.slice().sort((a, b) => a - b); const k = Math.max(1, Math.floor(s.length / 3)); return s.length ? s[k >> 1] : null; };
        const idleBody = med(samples.idle.map((x) => x.h * frac(set.idle[x.fi] || set.idle[0]))); const atkBody = low(samples.attack.map((x) => x.h * frac(set.attack[x.fi] || set.attack[0])));
        o.rows[key] = { idleN: samples.idle.length, atkN: samples.attack.length, idleBlit: +(med(samples.idle.map((x) => x.h)) || 0).toFixed(1), atkBlit: +(med(samples.attack.map((x) => x.h)) || 0).toFixed(1), idleBody: +(idleBody || 0).toFixed(1), atkBody: +(atkBody || 0).toFixed(1), ratio: (idleBody && atkBody) ? +(atkBody / idleBody).toFixed(3) : null, table: o.table ? (o.table[key] || 1) : null, calibS: (_lxAnimCalib(key, 'attack') || {}).s };
        game.monsters.length = 0;
      } catch (e) { o.rows[key] = { err: String(e && e.message).slice(0, 80) }; }
    }
    return o;
  }, ['pathsBane', 'forgewight', 'tombKeeper', 'echoKnight', 'conductorMech', 'ossuaryTyrant']);
  console.log('build ' + r.ver + '  ' + JSON.stringify(r.rows));
  ok('the padding table no longer carries conductorMech (its set was redrawn)', r.table && !('conductorMech' in r.table), JSON.stringify(r.table));
  for (const key of Object.keys(r.rows)) { const x = r.rows[key]; ok(`${key}: attacking for real, the body it draws is within 25% of its idle body (v0.30.408 drew it ${{ pathsBane: '5.5x', forgewight: '6.7x', tombKeeper: '4.9x', echoKnight: '4.4x', conductorMech: '1.7x', ossuaryTyrant: '1.4x' }[key]})`, !x.err && x.atkN >= 8 && x.idleN >= 8 && x.ratio > 0.75 && x.ratio < 1.25, JSON.stringify(x)); }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
