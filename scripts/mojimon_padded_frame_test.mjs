// FORGEWIGHT COMPANION CHECK — the padded-frame case.
//   1. glow ellipse must be the SAME size in idle and attack (was 2.327x pop)
//   2. sprite draw box MUST still scale ~2.327x in attack (the compensation)
//   3. all 9 attack frames decode and are distinct files (7/8 were corrupt
//      byte-copies of 6 in the working tree; restored from HEAD)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
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

  // v0.29.480 (3da6d04c) removed the class-coloured under-glow ellipse per user
  // ("i just want the monster tinted"), so the glow can no longer pop: assert it
  // stays gone, and pin the compensation on the SPRITE blit itself. The blit is
  // identified by identity (the canvas _mojimonTinted[Frame] returned) — other
  // 5-arg drawImage calls (HUD icons, 64px) follow it — and measured against the
  // body height the draw stamps on mn._visH before the padded-frame scale.
  const cap = { ellipse: 0, imgH: null, bodyH: null };
  let sprOut = null;
  const oTF = window._mojimonTintedFrame, oT = window._mojimonTinted;
  window._mojimonTintedFrame = function () { return (sprOut = oTF.apply(this, arguments)); };
  window._mojimonTinted = function () { return (sprOut = oT.apply(this, arguments)); };
  const oE = ctx.ellipse.bind(ctx), oD = ctx.drawImage.bind(ctx);
  ctx.ellipse = function () { cap.ellipse++; return oE.apply(null, arguments); };
  ctx.drawImage = function (img, dx, dy, w, h) { if (arguments.length >= 5 && sprOut && img === sprOut && cap.imgH == null) cap.imgH = +h.toFixed(1); return oD.apply(this, arguments); };
  const draw = () => { cap.ellipse = 0; cap.imgH = null; sprOut = null; try { _mojimonDraw(mn, 300, 300); } catch (e) { R.push({ n: 'draw threw', pass: false, d: e.message }); } cap.bodyH = mn._visH; return { ...cap }; };

  mn.atkAnimUntil = 0; mn._animSt = null;
  const idle = draw();
  mn.atkAnimUntil = performance.now() + 500; mn._animSt = null;
  const atk = draw();
  ctx.ellipse = oE; ctx.drawImage = oD;
  window._mojimonTintedFrame = oTF; window._mojimonTinted = oT;

  ok('idle draw captured', !!(idle.imgH && idle.bodyH), JSON.stringify(idle));
  ok('attack draw captured', !!(atk.imgH && atk.bodyH), JSON.stringify(atk));
  ok('no under-glow ellipse in either state (removed v0.29.480, so it cannot pop)', idle.ellipse === 0 && atk.ellipse === 0, idle.ellipse + '/' + atk.ellipse);
  // the compensation: the padded attack frame's box is scaled ~2.327x the body
  // (_ATK_FRAME_SCALE.forgewight) so the creature keeps its idle size.
  if (atk.imgH && atk.bodyH) {
    const comp = atk.imgH / atk.bodyH;
    ok('attack sprite box scales ~2.327x the body (padded-frame compensation)', comp > 2.0 && comp < 2.7,
       `imgH/bodyH = ${comp.toFixed(2)} (_ATK_FRAME_SCALE = ${_ATK_FRAME_SCALE[T]})`);
  }
  if (idle.imgH && idle.bodyH) {
    const r = idle.imgH / idle.bodyH;
    ok('idle sprite box is the body 1:1', r > 0.9 && r < 1.1, r.toFixed(2));
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
