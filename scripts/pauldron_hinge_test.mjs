// PAULDRON HINGE (per user, 2026-10-01/02: the front pad "should be infront of the shoulder", hinged with the arm - "Option 1" - with
// "an even blackoutline throughout"; Tempest Hauberk's is "the standard"; Worldbreaker's painted arms ride the hero's arms and its
// torso is finished: "fill up the empty patches of brown", then a slim breastplate because the round plate made "the shape of the
// character look weird"). Plated armour leaves its near pad out of the torso draw and draws it again after the front arm, turned
// with the arm; robes and cloaks keep the v0.30.1521 shoulder cover.
//   [1] the hinge table: 24 plated pieces, none for the robes / cloaks (Arcane Vestments keeps the cover), gloves only on Worldbreaker
//   [2] Tempest Hauberk: the torso comes from the cut bake and the pad is drawn once more from the piece; the cover stands down;
//       with window._lxNoPadHinge the old path returns (whole art + cover, no cut)
//   [3] the pad turns with the arm: its angle against the torso differs between rest and mid-swing
//   [4] Worldbreaker's gloves are drawn in the arm bones' frames: the front glove turns as the arm lifts (mage cast)
//   [5] Worldbreaker's worn art is armless: fire where the near forearm was, the far gauntlet gone, the breastplate kept
//   [6] Worldbreaker covers the hero's torso: with the garment painted pure green, rest and walk show almost none of it
//   [7] the Stormcaller / Worldbreaker refit rows are in the Gear Align data
//   [8] no page errors
// The build before fails [1]-[7].   node scripts/pauldron_hinge_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11898);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const errs = [];
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  const rel = path.relative(ROOT, path.isAbsolute(PAGE) ? PAGE : path.join(ROOT, PAGE)).split(path.sep).join('/');
  await page.goto(`http://127.0.0.1:${PORT}/${rel}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof _lxEquipSprite === 'function' && window.LX_EQ_ERASE_DATA, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); window._lxNoGearLight = true; const out = {};
    const H = typeof _LX_PAD_HINGE === 'object' ? _LX_PAD_HINGE : {}, keys = Object.keys(H);
    out.table = { n: keys.length, arcane: !!H['arm:arcane_vestments'], robes: ['sorcerers_robes', 'hurricane_mantle', 'phantom_cloak'].filter((n) => H['arm:' + n]),
      gloves: keys.filter((k) => (H[k][8] || []).length).map((k) => k + ':' + H[k][8].map((g) => g[0]).join('+')), short: keys.filter((k) => (H[k][3].length && H[k][3].length < 16) || !H[k][4].length) };   // an empty P = a pad removed (per user)
    const NAMES = ['tempest_hauberk', 'worldbreaker_bulwark'], eff = (n) => _lxEqErasedImg('arm:' + n) || _lxEquipSprite('armors', n);
    for (let i = 0; i < 300 && !NAMES.every((n) => eff(n) && eff(n).complete && eff(n).naturalWidth && _lxBakedDownscale(eff(n), 256)); i++) await sleep(100);
    const P = CanvasRenderingContext2D.prototype, d0 = P.drawImage;
    const draw = (n, anim, at, cls, S) => { const recs = []; S = S || 2;
      P.drawImage = function (im, ...a) { const t = this.getTransform(); recs.push({ im, ang: Math.atan2(t.b, t.a) }); return d0.call(this, im, ...a); };
      const cv = document.createElement('canvas'); cv.width = 100 * S; cv.height = 120 * S; const c = cv.getContext('2d', { willReadFrequently: true }); c.translate(50 * S, 112 * S); c.scale(S, S);
      const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = { body_top: { spriteId: 'arm:' + n } };
      try { _drawVectorHero(-14, -44, c, { cls: cls || 'warrior', animName: anim, animTime: at, forcedFacing: 1 }); } finally { _LX_EQ_PREVIEW_OVERRIDE = keep; P.drawImage = d0; }
      return { recs, cv }; };
    const warm = async () => { for (let k = 0; k < 3; k++) { for (const n of NAMES) for (const [a, t, c] of [['idle', 0], ['attack_warrior', 0.3], ['attack_mage', 0.5, 'mage'], ['walk', 0.25]]) draw(n, a, t, c);
      for (let w = 0; w < 200 && typeof _lxPadTorsoPending !== 'undefined' && _lxPadTorsoPending > 0; w++) await sleep(50); await sleep(300); } };
    await warm();
    const own = (n, r) => { const s = eff(n), b = _lxBakedDownscale(s, 256); return r.recs.filter((x) => x.im === s || (b && x.im === b)); };
    const cut = (r) => r.recs.filter((x) => x.im instanceof HTMLCanvasElement && x.im.width === 512 && x.im.height === 512);
    { const a = draw('tempest_hauberk', 'idle', 0); window._lxNoPadHinge = true; const b = draw('tempest_hauberk', 'idle', 0); window._lxNoPadHinge = false;
      out.tempest = { on: { own: own('tempest_hauberk', a).length, cut: cut(a).length }, off: { own: own('tempest_hauberk', b).length, cut: cut(b).length } }; }
    const rel = (r) => { const t = cut(r)[0], p = own('tempest_hauberk', r)[0]; return t && p ? +(p.ang - t.ang).toFixed(3) : null; };
    out.turn = { rest: rel(draw('tempest_hauberk', 'idle', 0)), swing: rel(draw('tempest_hauberk', 'attack_warrior', 0.3)), cast: rel(draw('tempest_hauberk', 'attack_mage', 0.5, 'mage')) };
    const glove = (r) => r.recs.filter((x) => x.im instanceof HTMLImageElement && String(x.im.src).startsWith('data:image/webp') && x.im.naturalWidth < 200 && x.im.naturalHeight > 150);
    { const a = glove(draw('worldbreaker_bulwark', 'idle', 0)), b = glove(draw('worldbreaker_bulwark', 'attack_mage', 0.5, 'mage'));
      const front = (g) => g.find((x) => x.im.naturalWidth === 120); out.gloves = { rest: a.length, cast: b.length, turn: front(a) && front(b) ? +(front(b).ang - front(a).ang).toFixed(3) : null }; }
    { const im = new Image(); im.src = window.LX_EQ_ERASE_DATA['arm:worldbreaker_bulwark']; await im.decode();
      const cv = document.createElement('canvas'); cv.width = cv.height = 768; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 768, 768);
      const px = (x, y) => { const d = g.getImageData(x - 2, y - 2, 5, 5).data; const s = [0, 0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 4; k++) s[k] += d[i + k] / 25; return s.map(Math.round); };
      out.art = { forearm: px(250, 470), gauntlet: px(600, 505), breast: px(440, 330) }; }
    { const G0 = window._lxGarmentOf; window._lxGarmentOf = () => ({ base: '#00ff00', mid: '#00ff00', deep: '#00ff00', boot: '#00ff00' });
      // the chest window only (17 units round the point 31 above the feet): the sleeves, leggings and boots are the garment too
      const green = (a, t) => { const d = draw('worldbreaker_bulwark', a, t, null, 6).cv.getContext('2d').getImageData(198, 384, 204, 204).data; let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 150 && d[i] < 110 && d[i + 2] < 110) n++; return n; };
      try { out.cloth = { rest: green('idle', 0), walk: green('walk', 0.25) }; } finally { window._lxGarmentOf = G0; } }
    const C = window.LX_EQ_ATTACH_DATA || {}; out.cal = [C['arm:stormcaller_cloak'], C['arm:worldbreaker_bulwark']].map((v) => v && [v.scaleX, v.scaleY, v.dy]);
    return out; });
  const T = R.table;
  ok('[1] the hinge table: 24 plated pieces, no robes or cloaks (Arcane Vestments keeps the cover), gloves only on Worldbreaker',
    T.n === 24 && !T.arcane && !T.robes.length && T.gloves.length === 1 && T.gloves[0] === 'arm:worldbreaker_bulwark:armL+armR' && !T.short.length, T);
  ok('[2] Tempest Hauberk: torso from the cut bake + the pad once from the piece (cover down); _lxNoPadHinge = whole art + cover, no cut',
    R.tempest.on.own === 1 && R.tempest.on.cut === 1 && R.tempest.off.own === 2 && R.tempest.off.cut === 0, R.tempest);
  ok('[3] the pad turns with the arm: its angle against the torso differs between rest and mid-swing / cast',
    R.turn.rest !== null && R.turn.swing !== null && Math.abs(R.turn.swing - R.turn.rest) > 0.05 && Math.abs(R.turn.cast - R.turn.rest) > 0.05, R.turn);
  ok('[4] Worldbreaker gloves are drawn in the arm frames (both at rest) and the front one turns as the arm lifts',
    R.gloves.rest === 2 && R.gloves.cast >= 1 && R.gloves.turn !== null && Math.abs(R.gloves.turn) > 0.5, R.gloves);
  const fire = (p) => p[3] > 200 && p[0] > 200 && p[0] >= p[1] && p[1] > p[2];
  ok('[5] Worldbreaker worn art is armless: fire where the near forearm was, the far gauntlet gone (clear or fire), the breastplate kept',
    fire(R.art.forearm) && (R.art.gauntlet[3] < 40 || fire(R.art.gauntlet)) && R.art.breast[3] > 200, R.art);
  ok('[6] Worldbreaker covers the hero`s torso: rest and walk show under 400 px of the garment round the chest at 6 px a unit'.split('`').join("'"), R.cloth.rest < 400 && R.cloth.walk < 400, R.cloth);
  ok('[7] the Stormcaller / Worldbreaker refit rows are in the Gear Align data', JSON.stringify(R.cal) === JSON.stringify([[0.789, 0.645, 11.5], [1.028, 0.809, 10.5]]), R.cal);
  ok('[8] no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
