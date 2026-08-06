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

  const set = _monsterFramesFor(T);
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    let n = 0; while (n < set.attack.length && set.attack[n] && set.attack[n].complete && set.attack[n].naturalWidth > 0) n++;
    if (n >= 9 && set.idle[0] && set.idle[0].naturalWidth > 0) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  let decoded = 0; while (decoded < set.attack.length && set.attack[decoded] && set.attack[decoded].complete && set.attack[decoded].naturalWidth > 0) decoded++;
  ok('all 9 attack frames decode', decoded >= 9, decoded + '/9');

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
  if (idle.ellipse && atk.ellipse) {
    const same = Math.abs(atk.ellipse.ry - idle.ellipse.ry) < 1 && Math.abs(atk.ellipse.rx - idle.ellipse.rx) < 1;
    ok('glow is body-sized in BOTH states (no pop)', same, `idle ry=${idle.ellipse.ry} atk ry=${atk.ellipse.ry}`);
  }
  if (idle.imgH && atk.imgH) {
    const ratio = atk.imgH / idle.imgH;
    ok('sprite box still compensates ~2.327x in attack', ratio > 2.0 && ratio < 2.7, `h ${idle.imgH} -> ${atk.imgH} (${ratio.toFixed(2)}x)`);
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
