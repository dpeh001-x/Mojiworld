// The NPC interact prompt: a translucent pill with a key cap N and a Talk label
// that eases in and out, instead of bare yellow text that pops.
// ============================================================================
// Per user: "The N talk should be much more aesthetically designed - make it
// semi translucent".
//
//   1. PILL: next to an NPC the prompt draws N and Talk as separate labels, and
//      the frame holds a fill in the prompt's translucent ink before them
//      (baseline: one bare '[N] Talk' string, no such fill)
//   2. TRANSLUCENT: that fill's alpha is 0.5 (baseline: no pill at all)
//   3. FADE: the first near frame is dimmer than full, and after stepping away
//      the prompt keeps drawing for several frames at falling alpha, then stops
//      (baseline: full the first frame, gone the frame you leave)
//   4. CONTROL: away from every NPC nothing is drawn
// Run: node scripts/talk_prompt_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/talk_prompt_test.mjs   (baseline)
//      MOJI_SHOT=<png> saves a crop around the prompt
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

const PORT = Number(process.env.PORT || 11811);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  try { loadMap('town', 400); game.paused = false; player._god = true; } catch (e) { out.err = String(e); }
  await sleep(2500);
  const npcs = (game.npcs || []).filter((n) => n && typeof n.x === 'number');
  out.npcCount = npcs.length;
  if (!npcs.length) return out;
  const npc = npcs[0];
  // an ordered op log per frame: fills (style) and texts (string, alpha, device position)
  const _of = CanvasRenderingContext2D.prototype.fill, _ot = CanvasRenderingContext2D.prototype.fillText;
  window._ops = [];
  CanvasRenderingContext2D.prototype.fill = function (...a) { if (this === ctx) window._ops.push({ op: 'fill', style: String(this.fillStyle), alpha: this.globalAlpha, f: game.time | 0 }); return _of.apply(this, a); };
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, mw) {
    if (this === ctx) { const m = this.getTransform(); window._ops.push({ op: 'text', t: String(t), alpha: this.globalAlpha, f: game.time | 0, px: m.a * x + m.c * y + m.e, py: m.b * x + m.d * y + m.f }); }
    return _ot.call(this, t, x, y, mw);
  };
  const settle = async () => { let last = -1; for (let i = 0; i < 60; i++) { game.paused = false; await sleep(50); const c = Math.round(game.camera.x); if (c === last) return; last = c; } };
  const isPrompt = (t) => t === 'Talk' || t === '[N] Talk';
  const frames = (ops) => [...new Set(ops.map((o) => o.f))].sort((a, b) => a - b);
  const analyse = (ops) => frames(ops).map((f) => {
    const L = ops.filter((o) => o.f === f);
    const ti = L.findIndex((o) => o.op === 'text' && isPrompt(o.t));
    const hasN = L.some((o) => o.op === 'text' && o.t === 'N');
    const before = ti >= 0 ? L.slice(0, ti) : [];
    const ink = [...before].reverse().find((o) => o.op === 'fill' && /^rgba\(14, ?8, ?26, ?0\.5\)$/.test(o.style));
    return { f, text: ti >= 0 ? L[ti].t : null, alpha: ti >= 0 ? +L[ti].alpha.toFixed(3) : null, hasN, inkFill: ink ? ink.style : null, px: ti >= 0 ? L[ti].px : null, py: ti >= 0 ? L[ti].py : null };
  });

  // far first: a spot at least 120 px from every NPC
  let farX = 60; for (let x = 60; x < (game.mapData.worldWidth || 2800) - 60; x += 20) { if (npcs.every((n) => Math.abs(n.x - x) >= 120)) { farX = x; break; } }
  player.x = farX - player.w / 2; player.vx = 0; await settle();
  for (let i = 0; i < 25; i++) { game.paused = false; await sleep(16); }   // any fade left over from the spawn spot has finished
  window._ops.length = 0; for (let i = 0; i < 12; i++) { game.paused = false; await sleep(20); }
  out.far = { frames: frames(window._ops).length, promptFrames: analyse(window._ops).filter((r) => r.text).length };

  // step in: the first frames of the approach, then a settled sample
  window._ops.length = 0;
  player.x = npc.x - player.w / 2 + 10; player.vx = 0;
  for (let i = 0; i < 4; i++) { game.paused = false; await sleep(20); }
  const early = analyse(window._ops).filter((r) => r.text);
  await settle();
  window._ops.length = 0; for (let i = 0; i < 12; i++) { game.paused = false; await sleep(20); }
  const nearRows = analyse(window._ops);
  const nearPrompt = nearRows.filter((r) => r.text);
  out.near = { frames: nearRows.length, promptFrames: nearPrompt.length, text: nearPrompt[0] ? nearPrompt[0].text : null, hasN: nearPrompt.every((r) => r.hasN), inkFill: nearPrompt[0] ? nearPrompt[0].inkFill : null, alphaMid: nearPrompt.length ? nearPrompt[Math.floor(nearPrompt.length / 2)].alpha : null, firstAlpha: early[0] ? early[0].alpha : null };
  try {   // a crop around the label for a look at the thing itself
    const p = nearPrompt[Math.floor(nearPrompt.length / 2)] || null;
    if (p) { const cv = ctx.canvas, k = cv.width / (typeof W === 'number' && W > 0 ? W : cv.width); const oc = document.createElement('canvas'); oc.width = 520; oc.height = 340;   // 2x so the pill can be judged
      oc.getContext('2d').drawImage(cv, p.px - 130 * k, p.py - 70 * k, 260 * k, 170 * k, 0, 0, 520, 340); out._shot = oc.toDataURL('image/png'); }
  } catch (e) { out._shot = null; }

  // step away: what happens to the prompt over the next frames
  window._ops.length = 0;
  player.x = npc.x + 110 - player.w / 2; player.vx = 0;   // out of range but still on screen, as a walk-away is
  for (let i = 0; i < 30; i++) { game.paused = false; await sleep(20); }
  const away = analyse(window._ops);
  const tail = away.filter((r) => r.text);
  out.away = { frames: away.length, promptFrames: tail.length, alphas: tail.map((r) => r.alpha).slice(0, 12), goneAtEnd: away.length > 2 && !away[away.length - 1].text && !away[away.length - 2].text };
  CanvasRenderingContext2D.prototype.fill = _of; CanvasRenderingContext2D.prototype.fillText = _ot;
  return out;
});
await browser.close(); server.kill();

if (R._shot && process.env.MOJI_SHOT) { try { writeFileSync(process.env.MOJI_SHOT, Buffer.from(R._shot.split(',')[1], 'base64')); console.log('  prompt crop -> ' + process.env.MOJI_SHOT); } catch (e) { console.log('  crop failed: ' + e.message); } }
delete R._shot;
console.log('  npcs: ' + R.npcCount + (R.err ? '  err ' + R.err : ''));
console.log('  far: ' + JSON.stringify(R.far) + '\n  near: ' + JSON.stringify(R.near) + '\n  away: ' + JSON.stringify(R.away));
const n = R.near || {}, a = R.away || {};
ok('PILL: N and Talk are separate labels over a fill in the prompt ink', n.promptFrames > 0 && n.text === 'Talk' && n.hasN && !!n.inkFill, `text "${n.text}", key cap ${n.hasN}, ink fill ${n.inkFill} (baseline: "[N] Talk", no fill)`);
ok('TRANSLUCENT: the pill fill is at half alpha', !!n.inkFill && /0\.5\)$/.test(n.inkFill), `${n.inkFill || 'no pill'}`);
const alphasFalling = a.alphas && a.alphas.length >= 3 && a.alphas[a.alphas.length - 1] < a.alphas[0];
ok('FADE: eases in below full, and keeps drawing at falling alpha for several frames after stepping away, then stops', n.firstAlpha != null && n.firstAlpha < 0.6 && alphasFalling && a.goneAtEnd, `first near alpha ${n.firstAlpha}; after leaving ${a.promptFrames} frames ${JSON.stringify(a.alphas)}; gone at end ${a.goneAtEnd} (baseline: full at once, 0 frames after leaving)`);
ok('CONTROL: away from every NPC nothing is drawn', R.far && R.far.frames > 0 && R.far.promptFrames === 0, `prompt frames far away: ${R.far && R.far.promptFrames}`);
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
