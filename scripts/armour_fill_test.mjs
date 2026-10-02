// ARMOUR FILLS + SHAPE (per user, 2026-10-02: the cut under the swinging pads "seems to have jagged cutoffs"; Dragon Scale "could have
// been filled with scales not just a plain purple"; Thunderbow Mantle "needs a complete overhaul" and Stormcaller "needs to be redone",
// widened "such that the shoulders and waist fit"; Skyhunter Vest's "white patch"; "some of the armor waist area is too thin").
//   [1] the fill table: 9 pieces, each a decodable image inside the 768 px art; Thunderbow and Stormcaller are no longer hinged (22 rows)
//   [2] Dragon Scale's torso bake paints the shoulder from its fill: purple scale mail where the pad was cut out
//   [3] the torso pass draws a filled bake whole (no cut clip): the drawn torso layer is purple there too
//   [4] the body takes the armour's shape: mid-swing, Tempest Hauberk shows far less of the hero's torso than with _lxNoArmourShape
//   [5] Thunderbow and Stormcaller are armless: their old arm pixels are clear in the worn art
//   [6] Skyhunter's flat white patch is repainted: under 400 flat near-white px in its box (was ~2,500)
//   [7] the widened Gear Align rows (eight plated pieces' waists, and Stormcaller's shoulders)
//   [8] no page errors
// The build before fails [1]-[7].   node scripts/armour_fill_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11899);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const FILLED = ['apocalypse_wargear', 'dragon_scale', 'hunters_tunic', 'leather_vest', 'marksman_leathers', 'plate_armor', 'ragnarok_bulwark', 'skyhunter_vest', 'threadbare_rags'];
const WIDE = { tempest_hauberk: 1.219, worldbreaker_bulwark: 1.182, apocalypse_wargear: 1.15, chain_mail: 1.296, cloth_tunic: 0.982, hunters_tunic: 1.203, apprentice_robe: 1.397, cataclysm_carapace: 1.109, stormcaller_cloak: 1.026 };
try {
  const errs = [];
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  const rel = path.relative(ROOT, path.isAbsolute(PAGE) ? PAGE : path.join(ROOT, PAGE)).split(path.sep).join('/');
  await page.goto(`http://127.0.0.1:${PORT}/${rel}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof _lxEquipSprite === 'function' && window.LX_EQ_ERASE_DATA, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async ({ FILLED, WIDE }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); window._lxNoGearLight = true; const out = {};
    const decode = async (url) => { const im = new Image(); im.src = url; try { await im.decode(); } catch (e) { return null; } return im; };
    // [1]
    const F = typeof _LX_PAD_FILL === 'object' ? _LX_PAD_FILL : {}, H = typeof _LX_PAD_HINGE === 'object' ? _LX_PAD_HINGE : {};
    const fk = Object.keys(F).sort(), bad = [];
    for (const k of fk) { const [x, y, w, h, url] = F[k]; const im = await decode(url); if (!im || im.naturalWidth !== w || im.naturalHeight !== h || x < 0 || y < 0 || x + w > 768 || y + h > 768) bad.push(k); }
    out.table = { fills: fk, bad, rows: Object.keys(H).length, tb: !!H['arm:thunderbow_mantle'], sc: !!H['arm:stormcaller_cloak'] };
    const eff = (n) => _lxEqErasedImg('arm:' + n) || _lxEquipSprite('armors', n);
    const NAMES = ['dragon_scale', 'tempest_hauberk'];
    for (let i = 0; i < 300 && !NAMES.every((n) => eff(n) && eff(n).complete && eff(n).naturalWidth && _lxBakedDownscale(eff(n), 256)); i++) await sleep(100);
    const draw = (n, a, t, S, cls) => { const cv = document.createElement('canvas'); cv.width = 360; cv.height = 420; const c = cv.getContext('2d', { willReadFrequently: true }); c.translate(180, 400); c.scale(S || 6, S || 6);
      const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = { body_top: { spriteId: 'arm:' + n } };
      try { _drawVectorHero(-14, -44, c, { cls: cls || 'warrior', animName: a, animTime: t, forcedFacing: 1 }); } finally { _LX_EQ_PREVIEW_OVERRIDE = keep; }
      return c; };
    for (let k = 0; k < 3; k++) { for (const n of NAMES) { draw(n, 'idle', 0); draw(n, 'attack_warrior', 0.3); }
      for (let w = 0; w < 200 && typeof _lxPadTorsoPending !== 'undefined' && _lxPadTorsoPending > 0; w++) await sleep(50); await sleep(250); }
    // [2] the bake itself, at two art points inside the cut
    const PTS = [[520, 260], [540, 340]];
    { const pd = typeof _lxPadPaths === 'function' ? _lxPadPaths('arm:dragon_scale') : null; const bake = pd ? _lxPadTorso(eff('dragon_scale'), pd) : null;
      out.bake = bake && bake.getContext ? PTS.map(([ax, ay]) => { const d = bake.getContext('2d').getImageData(Math.round(ax * 512 / 768) - 1, Math.round(ay * 512 / 768) - 1, 3, 3).data;
        const s = [0, 0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let q = 0; q < 4; q++) s[q] += d[i + q] / 9; return s.map(Math.round); }) : null; }
    // [3] the torso layer as the game draws it, read back at the same art points through the recorded transform
    { const P2 = CanvasRenderingContext2D.prototype, d0 = P2.drawImage; let rec = null;
      P2.drawImage = function (im, ...a) { if (!rec && im instanceof HTMLCanvasElement && im.width === 512 && im.height === 512 && a.length === 4) rec = { M: this.getTransform(), a }; return d0.call(this, im, ...a); };
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 760; const c = cv.getContext('2d', { willReadFrequently: true }); c.translate(320, 640); c.scale(6, 6);
      const keep = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = { body_top: { spriteId: 'arm:dragon_scale' } };
      try { _lxPadCut = 'arm:dragon_scale'; _drawEquipmentLayer('mid', c, { onlyLayer: 'body_top', pinBone: 'spine' }); }
      catch (e) { out.layerErr = String(e).slice(0, 120); }
      finally { try { _lxPadCut = null; } catch (e) {} _LX_EQ_PREVIEW_OVERRIDE = keep; P2.drawImage = d0; }
      out.layer = rec ? PTS.map(([ax, ay]) => { const [dx, dy, w, h] = rec.a, p = rec.M.transformPoint(new DOMPoint(dx + ax / 768 * w, dy + ay / 768 * h));
        const x = Math.round(p.x), y = Math.round(p.y); if (x < 2 || y < 2 || x > 637 || y > 757) return null;
        const d = c.getImageData(x - 1, y - 1, 3, 3).data, s = [0, 0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let q = 0; q < 4; q++) s[q] += d[i + q] / 9; return s.map(Math.round); }) : null; }
    // [4] the hero's torso in pure green, clip on vs off
    { const G0 = window._lxGarmentOf; window._lxGarmentOf = () => ({ base: '#00ff00', mid: '#00ff00', deep: '#00ff00', boot: '#00ff00' });
      const green = () => { const d = draw('tempest_hauberk', 'attack_warrior', 0.3).getImageData(0, 0, 360, 420).data; let g = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 150 && d[i] < 110 && d[i + 2] < 110) g++; return g; };
      try { const on = green(); window._lxNoArmourShape = true; const off = green(); out.shape = { on, off, fn: typeof _lxArmourSilPath === 'function', n: typeof _LX_ARMOUR_SIL === 'object' ? Object.keys(_LX_ARMOUR_SIL).length : 0 }; }
      finally { window._lxNoArmourShape = false; window._lxGarmentOf = G0; } }
    // [5] [6] the worn art itself
    const artOf = async (n) => { const im = await decode(window.LX_EQ_ERASE_DATA['arm:' + n]); const cv = document.createElement('canvas'); cv.width = cv.height = 768;
      const g = cv.getContext('2d', { willReadFrequently: true }); if (im) g.drawImage(im, 0, 0, 768, 768); return g; };
    { const tb = await artOf('thunderbow_mantle'), sc = await artOf('stormcaller_cloak'); const a = (g, x, y) => g.getImageData(x, y, 1, 1).data[3];
      out.arms = { tb: [a(tb, 244, 424), a(tb, 524, 372)], sc: [a(sc, 536, 344)] }; }
    { const g = await artOf('skyhunter_vest'), d = g.getImageData(430, 300, 110, 180).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; if (d[i + 3] > 200 && Math.min(r, gg, b) > 205 && Math.max(r, gg, b) - Math.min(r, gg, b) < 50) n++; }
      out.patch = n; }
    // [7]
    const C = window.LX_EQ_ATTACH_DATA || {}; out.wide = Object.keys(WIDE).filter((n) => !(C['arm:' + n] && C['arm:' + n].scaleX === WIDE[n])).map((n) => n + ':' + (C['arm:' + n] && C['arm:' + n].scaleX));
    return out; }, { FILLED, WIDE });
  const T = R.table;
  ok('[1] the fill table: 9 decodable pieces inside the art; Thunderbow and Stormcaller not hinged (22 rows)',
    JSON.stringify(T.fills) === JSON.stringify(FILLED.map((n) => 'arm:' + n).sort()) && !T.bad.length && T.rows === 22 && !T.tb && !T.sc, T);
  const purple = (p) => !!p && p[3] > 200 && p[2] > 140 && p[2] > p[0] && p[0] > p[1];
  ok('[2] Dragon Scale`s torso bake has purple scale mail where the pad was cut out'.split('`').join("'"), !!R.bake && R.bake.every(purple), R.bake);
  const opaquePurple = (p) => !!p && p[3] > 200 && p[2] > p[0] && p[0] > p[1];   // drawn at game scale the sample can sit on a scale's dark seam
  ok('[3] the torso pass draws the filled bake whole: the drawn layer is opaque purple there (the cut clip left it clear)', !!R.layer && R.layer.every(opaquePurple), { layer: R.layer, err: R.layerErr });
  ok('[4] the body takes the armour`s shape: Tempest mid-swing shows 400+ fewer torso px than with _lxNoArmourShape'.split('`').join("'"),
    R.shape.fn && R.shape.n === 22 && R.shape.off - R.shape.on > 400, R.shape);
  ok('[5] Thunderbow and Stormcaller are armless: their old arm pixels are clear', R.arms.tb.every((a) => a < 40) && R.arms.sc.every((a) => a < 40), R.arms);
  ok('[6] Skyhunter`s flat white patch is repainted: under 400 flat near-white px in its box'.split('`').join("'"), R.patch < 400, R.patch);
  ok('[7] the widened Gear Align rows (eight waists, Stormcaller`s shoulders)'.split('`').join("'"), !R.wide.length, R.wide);
  ok('[8] no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
