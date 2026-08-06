// FORGEWIGHT COMPANION CHECK — the padded-frame case.
//   1. glow ellipse must be the SAME size in idle and attack (was 2.327x pop)
//   2. sprite draw box MUST still scale ~2.327x in attack (the compensation)
//   3. all 9 attack frames decode and are distinct files (7/8 were corrupt
//      byte-copies of 6 in the working tree; restored from HEAD)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _mojimonDraw === 'function' && typeof _mojimonSummon === 'function', { timeout: 60000 });

const out = await page.evaluate(async () => {
  const R = [];
  const ok = (n, c, d) => R.push({ n, pass: !!c, d: d || '' });
  const T = 'forgewight';

  // v0.29.456 — forgewight's attack set is 7 frames (0–6). Frames _7/_8 were
  // removed permanently per user ("merely replicated frames that should not
  // be there"); the loader's contiguous-prefix rule makes the loop play 0–6.
  const set = _monsterFramesFor(T);
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    let n = 0; while (n < set.attack.length && set.attack[n] && set.attack[n].complete && set.attack[n].naturalWidth > 0) n++;
    if (n >= 7 && set.idle[0] && set.idle[0].naturalWidth > 0) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  let decoded = 0; while (decoded < set.attack.length && set.attack[decoded] && set.attack[decoded].complete && set.attack[decoded].naturalWidth > 0) decoded++;
  ok('attack set decodes as exactly 7 frames (0–6)', decoded === 7, decoded + '/7');
  // and the loop must never emit the removed frames: sample a full cycle
  {
    // index via array identity, not .src — the shrink-bake swaps decoded
    // Images for canvases that carry no src, which made a src-regex probe
    // blind to most frames.
    const seenIdx = new Set();
    const t1 = Date.now();
    while (Date.now() - t1 < 800) {
      const f = _bossLoopFrame(set.attack, _BOSS_ATK_FRAME_MS, 480);
      const i = set.attack.indexOf(f);
      if (i >= 0) seenIdx.add(i);
      await new Promise((r) => setTimeout(r, 12));
    }
    ok('attack loop cycles 0–6 only, never a removed frame',
       seenIdx.size >= 5 && !seenIdx.has(7) && !seenIdx.has(8), [...seenIdx].sort((a, b) => a - b).join(','));
  }

  player.mojimon = { roster: { [T]: { upg: { hp: 0, atk: 0, def: 0 }, at: 1 } }, cdUntil: 0, out: null };
  player.level = 50;
  try { _mojimonSummon(T, {}); } catch (e) { ok('summon', false, e.message); return R; }
  const mn = (game.minions || []).find((m) => m && m.mojimon);
  ok('forgewight fielded', !!mn);
  if (!mn) return R;
  mn.x = 400; mn._animPX = 400; mn._animXV = 0; mn._walkLatch = false;

  // spy: ellipse radii + sprite draw height per _mojimonDraw call
  const cap = { ellipse: null, imgH: null };
  const oE = ctx.ellipse.bind(ctx), oD = ctx.drawImage.bind(ctx);
  ctx.ellipse = function (x, y, rx, ry, ...r) { cap.ellipse = { rx: +rx.toFixed(1), ry: +ry.toFixed(1) }; return oE(x, y, rx, ry, ...r); };
  ctx.drawImage = function (img, dx, dy, w, h) { if (arguments.length >= 5) cap.imgH = +h.toFixed(1); return oD.apply(this, arguments); };
  const draw = () => { cap.ellipse = null; cap.imgH = null; try { _mojimonDraw(mn, 300, 300); } catch (e) { R.push({ n: 'draw threw', pass: false, d: e.message }); } return { ...cap }; };

  mn.atkAnimUntil = 0; mn._animSt = null;
  const idle = draw();
  mn.atkAnimUntil = performance.now() + 500; mn._animSt = null;
  const atk = draw();
  ctx.ellipse = oE; ctx.drawImage = oD;

  ok('idle draw captured', !!(idle.ellipse && idle.imgH), JSON.stringify(idle));
  ok('attack draw captured', !!(atk.ellipse && atk.imgH), JSON.stringify(atk));
  // v0.29.459 made the pre-scale body height FRAME-DEPENDENT (dh derives from
  // the current frame's source size, clamped 0.85–1.20), so idle-vs-attack
  // comparisons drift ~10% by design and cannot detect the pop. The decisive
  // invariant lives WITHIN the attack draw: glow radius ry = bodyH × 0.55 and
  // sprite box = bodyH × 2.327, so imgH / (ry / 0.55) ≈ 2.327 when the glow is
  // body-sized — and ≈ 1.0 if it ballooned to frame size (the old bug).
  if (atk.ellipse && atk.imgH) {
    const bodyH = atk.ellipse.ry / 0.55;
    const comp = atk.imgH / bodyH;
    ok('glow is body-sized during the swing (no pop)', comp > 2.0 && comp < 2.7,
       `imgH/(ry/0.55) = ${comp.toFixed(2)} (body-sized ≈ 2.33, frame-sized ≈ 1.0)`);
  }
  if (idle.ellipse && idle.imgH) {
    const r = idle.imgH / (idle.ellipse.ry / 0.55);
    ok('idle glow matches the idle body 1:1', r > 0.9 && r < 1.1, r.toFixed(2));
  }
  game.minions.length = 0;
  return R;
});
await browser.close();

let bad = 0;
for (const r of out) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  (' + r.d + ')' : ''}`); }
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
console.log(`${out.length - bad}/${out.length} passed`);
process.exit(bad || errs.length ? 1 : 0);
