// No emoji reach the screen: canvas text and page text are checked at the
// source - what the browser itself is asked to draw.
// ============================================================================
// Per user: "ensure that no emojis are used, if they are they should be changed
// to customised images, use ludo.ai to generate them".
//
// An init script installs spies on the NATIVE canvas text calls before any game
// script runs, so whatever the game does on top, the spies see exactly the
// strings that reach the rasteriser. The game is booted, a town with portal
// labels (the ◀ / ▶ on every portal name are canvas text) is loaded, a few
// emoji-bearing toasts are raised, and the inventory / skills panels are opened.
//   1. CANVAS: no string handed to the native fillText / strokeText contains an
//      emoji (baseline: portal labels, name plates and bubbles do)
//   2. CANVAS: the atlas is being drawn (drawImage from the atlas image)
//   3. PAGE: no visible text node contains an emoji outside the icon spans
//      (baseline: toasts, HUD labels, tabs)
//   4. PAGE: icon spans are on the page and show the atlas (non-zero box)
//   5. CONTROL: an element's textContent still reads the emoji it was given
//      (game code that reads labels keeps working)
//   6. ATTRIBUTES: a title attribute set with an emoji comes back without it
//   7. CSS: no stylesheet rule draws an emoji through content (::before / ::after
//      content is never a text node; baseline: 2 rules)
// Run: node scripts/no_emoji_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/no_emoji_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 260) });

const PORT = Number(process.env.PORT || 12411);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
// spies on the NATIVE text calls, installed before any page script
await page.addInitScript(() => {
  const EM = /[\u{1F1E6}-\u{1F1FF}⃣\p{Extended_Pictographic}]/u;
  const KEEP = /^[©®™]$/;
  const has = (t) => { if (typeof t !== 'string' || !EM.test(t)) return false; for (const ch of t) if (EM.test(ch) && !KEEP.test(ch) && !/[#*0-9]/.test(ch)) return true; return false; };
  window.__nat = { fill: [], stroke: [], atlasDraws: 0 };
  const P = CanvasRenderingContext2D.prototype;
  const oF = P.fillText, oS = P.strokeText, oD = P.drawImage;
  P.fillText = function (t, ...a) { if (has(t) && window.__nat.fill.length < 400) window.__nat.fill.push(String(t)); return oF.call(this, t, ...a); };
  P.strokeText = function (t, ...a) { if (has(t) && window.__nat.stroke.length < 400) window.__nat.stroke.push(String(t)); return oS.call(this, t, ...a); };
  P.drawImage = function (img, ...a) { if (img && window._lxEmojiAtlasImg && img === window._lxEmojiAtlasImg) window.__nat.atlasDraws++; return oD.call(this, img, ...a); };
  window.__hasEmoji = has;
});
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
await page.waitForTimeout(1000);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  window.__nat.fill.length = 0; window.__nat.stroke.length = 0; window.__nat.atlasDraws = 0;
  try { loadMap('town', 400); game.paused = false; player._god = true; } catch (e) { out.err = String(e); }
  await sleep(2500);
  // emoji-bearing toasts, like the game raises all the time
  try { showToast('\u{1F525} Test toast with fire', 'epic'); showToast('⚔️ Crossed swords and \u{1F6E1}️ shield', 'rare'); } catch (e) {}
  // walk the camera across the town so portal labels (◀ / ▶) are drawn
  for (let i = 0; i < 40; i++) { game.paused = false; player.x = 60 + i * 60; await sleep(60); }
  await sleep(600);
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const leaks = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const p = n.parentElement; if (!p) continue;
    if (/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(p.nodeName) || p.closest('.lx-emo')) continue;
    if (window.__hasEmoji(n.nodeValue) && vis(p)) leaks.push(n.nodeValue.trim().slice(0, 40));
  }
  const spans = [...document.querySelectorAll('.lx-emo')];
  const visSpans = spans.filter((sp) => vis(sp));
  const bg = visSpans[0] ? getComputedStyle(visSpans[0]).backgroundImage : '';
  // textContent compatibility and attribute stripping
  const probe = document.createElement('div'); probe.textContent = 'Label \u{1F525} here'; document.body.appendChild(probe);
  probe.setAttribute('title', 'Tip \u{1F4A5} text');
  await sleep(200);
  out.page = { leaks: leaks.length, leakSample: leaks.slice(0, 6), spans: spans.length, visibleSpans: visSpans.length, bg: String(bg).slice(0, 60),
               probeText: probe.textContent, probeHasSpan: !!probe.querySelector('.lx-emo'), probeTitle: probe.getAttribute('title') };
  probe.remove();
  out.canvas = { nativeFillWithEmoji: window.__nat.fill.length, nativeStrokeWithEmoji: window.__nat.stroke.length, sample: window.__nat.fill.slice(0, 6), atlasDraws: window.__nat.atlasDraws };
  // stylesheet rules that would draw an emoji through CSS content (never a text node)
  const cssHits = [];
  const scan = (list) => { for (const r of Array.from(list || [])) { if (!r.style) { if (r.cssRules) scan(r.cssRules); continue; } const c = r.style.getPropertyValue('content'); if (c && window.__hasEmoji(c)) cssHits.push((r.selectorText || '?') + ' ' + c); } };
  for (const sh of Array.from(document.styleSheets)) { let l = null; try { l = sh.cssRules; } catch (e) { continue; } scan(l); }
  out.css = { emojiContentRules: cssHits.length, sample: cssHits.slice(0, 4) };
  out.atlas = window.LX_EMOJI_ATLAS ? { icons: Object.keys(window.LX_EMOJI_ATLAS.map).length, ready: !!(window._lxEmojiAtlasImg && window._lxEmojiAtlasImg.complete && window._lxEmojiAtlasImg.naturalWidth > 0) } : null;
  return out;
});
await browser.close(); server.kill();

if (R.err) console.log('  err ' + R.err);
console.log('  atlas: ' + JSON.stringify(R.atlas));
console.log('  canvas: ' + JSON.stringify(R.canvas));
console.log('  page: ' + JSON.stringify(R.page));
console.log('  css: ' + JSON.stringify(R.css));
const C = R.canvas || {}, Pg = R.page || {};
ok('CANVAS: no emoji reaches the native text rasteriser', (C.nativeFillWithEmoji | 0) === 0 && (C.nativeStrokeWithEmoji | 0) === 0, `fill ${C.nativeFillWithEmoji}, stroke ${C.nativeStrokeWithEmoji}; e.g. ${JSON.stringify((C.sample || []).slice(0, 3))}`);
ok('CANVAS: the custom icons are drawn from the atlas', (C.atlasDraws | 0) > 0, `${C.atlasDraws} atlas draws`);
ok('PAGE: no visible text shows an emoji outside the icon spans', (Pg.leaks | 0) === 0, `${Pg.leaks} leaks, e.g. ${JSON.stringify(Pg.leakSample)}`);
ok('PAGE: icon spans are on screen and show the atlas', Pg.visibleSpans > 0 && /emoji_atlas/.test(Pg.bg || ''), `${Pg.spans} spans (${Pg.visibleSpans} visible), background ${Pg.bg}`);
ok('CONTROL: textContent still reads the emoji the game wrote', Pg.probeText === 'Label \u{1F525} here' && Pg.probeHasSpan, `textContent "${Pg.probeText}", swapped for an icon ${Pg.probeHasSpan}`);
ok('ATTRIBUTES: a title set with an emoji comes back without it', Pg.probeTitle === 'Tip text', `title "${Pg.probeTitle}"`);
ok('CSS: no stylesheet rule draws an emoji through content', R.css && R.css.emojiContentRules === 0, `${R.css && R.css.emojiContentRules} rules, e.g. ${JSON.stringify(R.css && R.css.sample)} (baseline: 2)`);
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
