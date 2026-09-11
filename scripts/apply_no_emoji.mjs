// No emoji anywhere: every emoji the game draws - canvas or page - becomes a
// custom ludo.ai icon from one atlas.
// =============================================================================
// Per user: "ensure that no emojis are used, if they are they should be changed
// to customised images, use ludo.ai to generate them".
//
// SCALE. 387 distinct emoji (after merging variation-selector and skin-tone
// forms) in 2,531 places: skill / item / quest icon tables, HUD labels
// ("⚔️ ATK"), toasts, buttons and tabs, and the ◀ ▶ on every portal name. They
// reach the screen through 108 fillText sites and 700+ innerHTML / textContent
// writes, and parallel sessions add more every day - so the swap happens at the
// two places every one of them passes through, not at 2,531 call sites.
//
//   CANVAS  CanvasRenderingContext2D fillText / strokeText / measureText are
//           wrapped. A string with no emoji takes the native path untouched (one
//           cached lookup). A string with emoji is laid out as runs: text runs
//           drawn natively, each emoji drawn from the atlas at 1.15 em, honouring
//           textAlign and textBaseline; measureText reports the same width, so
//           pills and plates sized from it still fit.
//   PAGE    One MutationObserver on the document swaps each emoji in a text node
//           for <span class="lx-emo"> showing the atlas tile, sized in em so it
//           follows the font. The emoji character stays INSIDE the span, pushed
//           out of view, so code that reads textContent still sees what it wrote.
//   CANNOT  Attributes (title / placeholder / aria-label / alt), <option> text,
//   HOLD    document.title and alert / confirm / prompt cannot show an image;
//   IMAGES  their emoji are removed instead.
// An emoji missing from the atlas (one a later change adds) falls back to the
// custom sparkle icon, never to the OS glyph. (c) (r) (tm) stay ordinary text.
// Icons: scripts/gen_emoji_icons.mjs (ludo.ai) -> scripts/pack_emoji_atlas.mjs ->
// Sprites/ui/emoji_atlas.webp + data/emoji_atlas.js.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';   // a chain builds in a private copy
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_lxEmojiRuns')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

const RUNTIME = [
  '// v0.30.634 no-emoji - every emoji the game draws becomes a custom ludo.ai icon (per user: "ensure',
  '// that no emojis are used, if they are they should be changed to customised images"). 387 distinct',
  '// emoji in 2,531 places reach the screen through fillText and the DOM, so the swap lives at those',
  '// two chokepoints: canvas text is wrapped (emoji runs drawn from the atlas, measureText agrees), and',
  '// one MutationObserver turns page emoji into <span class="lx-emo"> atlas tiles that keep the',
  '// character inside (so textContent reads are unchanged). Attributes, <option>, the title and',
  '// alert/confirm/prompt cannot hold images, so their emoji are removed. Unknown emoji fall back to',
  '// the custom sparkle tile, never the OS glyph. Atlas: data/emoji_atlas.js (scripts/pack_emoji_atlas.mjs).',
  '(function () {',
  "  if (typeof window === 'undefined' || window._lxEmojiRuns) return;",
  '  const A = window.LX_EMOJI_ATLAS || null;',
  '  const RE = /(?:[\\u{1F1E6}-\\u{1F1FF}]{2})|(?:[#*0-9]\\uFE0F?\\u20E3)|(?:\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?[\\u{1F3FB}-\\u{1F3FF}]?(?:\\u200D\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?[\\u{1F3FB}-\\u{1F3FF}]?)*)/gu;',
  '  const TEST = /[\\u{1F1E6}-\\u{1F1FF}\\u20E3\\p{Extended_Pictographic}]/u;',
  "  const KEEP = new Set(['\\u00A9', '\\u00AE', '\\u2122']);   // (c) (r) (tm) are typography, not emoji",
  "  const key = (e) => Array.from(e.replace(/[\\uFE0E\\uFE0F]/g, '').replace(/[\\u{1F3FB}-\\u{1F3FF}]/gu, '')).map((c) => c.codePointAt(0).toString(16)).join('-');",
  "  const FALLBACK = (A && A.map && A.map['2728'] != null) ? A.map['2728'] : -1;",
  '  const idxOf = (e) => { const k = key(e); return (A && A.map && A.map[k] != null) ? A.map[k] : FALLBACK; };',
  '  // text -> null (no emoji) | [{s}|{e, idx}] runs; bounded cache, the hot path is one Map lookup',
  '  const cache = new Map();',
  '  function runs(text) {',
  "    if (typeof text !== 'string') text = String(text);",
  '    let r = cache.get(text);',
  '    if (r !== undefined) return r;',
  '    r = null;',
  '    if (TEST.test(text)) {',
  '      const out = []; let last = 0, m, any = false; RE.lastIndex = 0;',
  '      while ((m = RE.exec(text))) {',
  '        if (KEEP.has(m[0]) || /^[#*0-9]$/.test(m[0])) continue;',
  '        if (m.index > last) out.push({ s: text.slice(last, m.index) });',
  '        out.push({ e: m[0], idx: idxOf(m[0]) }); any = true;',
  '        last = m.index + m[0].length;',
  '      }',
  '      if (any) { if (last < text.length) out.push({ s: text.slice(last) }); r = out; }',
  '    }',
  '    if (cache.size > 4000) cache.clear();',
  '    cache.set(text, r);',
  '    return r;',
  '  }',
  '  window._lxEmojiRuns = runs;',
  "  const strip = (v) => String(v).replace(RE, (e) => (KEEP.has(e) || /^[#*0-9]$/.test(e)) ? e : '').replace(/ {2,}/g, ' ').replace(/^ +/, '');",
  '  window._lxEmojiStrip = strip;',
  '  // ---- the atlas image ----',
  '  const IMG = new Image(); let READY = false;',
  '  if (A && A.src) {',
  '    IMG.decoding = \'async\';',
  '    IMG.onload = () => {',
  '      READY = true;',
  '      // glyph bakes minted before the atlas decoded would keep a blank tile; drop the known caches',
  "      try { if (window._lxStatusIconBakes && window._lxStatusIconBakes.clear) window._lxStatusIconBakes.clear(); } catch (e) {}",
  "      try { window.dispatchEvent(new Event('lx-emoji-ready')); } catch (e) {}",
  '    };',
  '    IMG.src = A.src;',
  '  }',
  '  window._lxEmojiAtlasImg = IMG;',
  '  // ---- canvas ----',
  '  const fpx = new Map();',
  "  const pxOf = (font) => { let v = fpx.get(font); if (v === undefined) { const m = /(\\d+(?:\\.\\d+)?)px/.exec(font || ''); v = m ? +m[1] : 10; fpx.set(font, v); } return v; };",
  '  function wrap(P) {',
  '    if (!P || P._lxEmojiWrapped) return;',
  '    P._lxEmojiWrapped = true;',
  '    const oFill = P.fillText, oStroke = P.strokeText, oMeasure = P.measureText;',
  '    const draw = function (ctx, rr, x, y, stroke) {',
  '      const px = pxOf(ctx.font), es = px * 1.15, adv = es + px * 0.06;',
  '      let total = 0; const w = new Array(rr.length);',
  '      for (let i = 0; i < rr.length; i++) { w[i] = rr[i].e ? adv : oMeasure.call(ctx, rr[i].s).width; total += w[i]; }',
  "      const al = ctx.textAlign, rtl = ctx.direction === 'rtl';",
  "      let cx = (al === 'center') ? x - total / 2 : (al === 'right' || (al === 'end' && !rtl) || (al === 'start' && rtl)) ? x - total : x;",
  '      const bl = ctx.textBaseline;',
  "      const top = bl === 'middle' ? y - es / 2 : (bl === 'top' || bl === 'hanging') ? y : (bl === 'bottom' || bl === 'ideographic') ? y - es : y - es * 0.82;",
  "      ctx.textAlign = 'left';",
  '      try {',
  '        for (let i = 0; i < rr.length; i++) {',
  '          const q = rr[i];',
  '          if (q.e) {',
  '            if (!stroke && READY && q.idx >= 0) {',
  '              const c = A.cell, sx = (q.idx % A.cols) * c, sy = Math.floor(q.idx / A.cols) * c;',
  '              ctx.drawImage(IMG, sx, sy, c, c, cx + (adv - es) / 2, top, es, es);',
  '            }',
  '          } else if (q.s) (stroke ? oStroke : oFill).call(ctx, q.s, cx, y);',
  '          cx += w[i];',
  '        }',
  '      } finally { ctx.textAlign = al; }',
  '    };',
  '    P.fillText = function (text, x, y, maxWidth) {',
  '      const rr = runs(text);',
  '      if (!rr) return maxWidth === undefined ? oFill.call(this, text, x, y) : oFill.call(this, text, x, y, maxWidth);',
  '      draw(this, rr, x, y, false);',
  '    };',
  '    P.strokeText = function (text, x, y, maxWidth) {',
  '      const rr = runs(text);',
  '      if (!rr) return maxWidth === undefined ? oStroke.call(this, text, x, y) : oStroke.call(this, text, x, y, maxWidth);',
  '      draw(this, rr, x, y, true);',
  '    };',
  '    P.measureText = function (text) {',
  '      const rr = runs(text);',
  '      if (!rr) return oMeasure.call(this, text);',
  "      const px = pxOf(this.font), adv = px * 1.21; let extra = 0, plain = '';",
  '      for (const q of rr) { if (q.e) extra += adv; else plain += q.s; }',
  '      const m = oMeasure.call(this, plain);',
  '      return { width: m.width + extra, actualBoundingBoxLeft: m.actualBoundingBoxLeft, actualBoundingBoxRight: (m.actualBoundingBoxRight || 0) + extra,',
  '        actualBoundingBoxAscent: Math.max(m.actualBoundingBoxAscent || 0, px * 0.9), actualBoundingBoxDescent: Math.max(m.actualBoundingBoxDescent || 0, px * 0.25),',
  '        fontBoundingBoxAscent: m.fontBoundingBoxAscent, fontBoundingBoxDescent: m.fontBoundingBoxDescent,',
  '        emHeightAscent: m.emHeightAscent, emHeightDescent: m.emHeightDescent, alphabeticBaseline: m.alphabeticBaseline,',
  '        hangingBaseline: m.hangingBaseline, ideographicBaseline: m.ideographicBaseline };',
  '    };',
  '  }',
  "  if (typeof CanvasRenderingContext2D !== 'undefined') wrap(CanvasRenderingContext2D.prototype);",
  "  if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') wrap(OffscreenCanvasRenderingContext2D.prototype);",
  '  // ---- page ----',
  '  if (A && A.src) {',
  "    const st = document.createElement('style');",
  "    const K = 1.15, cols = A.cols || 1, rows = A.rows || 1;",
  "    st.textContent = '.lx-emo{display:inline-block;width:' + K + 'em;height:' + K + 'em;vertical-align:-0.22em;margin:0 0.03em;'",
  "      + 'background-image:url(\"' + A.src + '\");background-repeat:no-repeat;background-size:' + (cols * K) + 'em ' + (rows * K) + 'em;'",
  "      + 'overflow:hidden;text-indent:300%;white-space:nowrap;line-height:1;color:transparent;user-select:text;}';",
  "    (document.head || document.documentElement).appendChild(st);",
  '  }',
  "  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'INPUT', 'CANVAS', 'SVG', 'svg']);",
  "  const STRIP = new Set(['OPTION', 'SELECT', 'TITLE', 'OPTGROUP']);",
  '  function doText(node) {',
  '    const v = node.nodeValue;',
  '    if (!v || !TEST.test(v)) return;',
  '    const p = node.parentNode;',
  "    if (!p || SKIP.has(p.nodeName) || (p.classList && p.classList.contains('lx-emo')) || p.isContentEditable) return;",
  '    if (STRIP.has(p.nodeName) || !A || !A.src) { const t = strip(v); if (t !== v) node.nodeValue = t; return; }',
  '    const rr = runs(v);',
  '    if (!rr) return;',
  '    const frag = document.createDocumentFragment();',
  '    for (const q of rr) {',
  '      if (!q.e) { frag.appendChild(document.createTextNode(q.s)); continue; }',
  '      if (q.idx < 0) continue;',
  "      const sp = document.createElement('span');",
  "      sp.className = 'lx-emo';",
  "      sp.setAttribute('aria-hidden', 'true');",
  "      sp.style.backgroundPosition = '-' + ((q.idx % A.cols) * 1.15).toFixed(3) + 'em -' + (Math.floor(q.idx / A.cols) * 1.15).toFixed(3) + 'em';",
  '      sp.textContent = q.e;   // kept for textContent readers; pushed out of view by the class',
  '      frag.appendChild(sp);',
  '    }',
  '    p.replaceChild(frag, node);',
  '  }',
  "  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];",
  '  function doAttrs(el) {',
  '    if (!el.getAttribute) return;',
  '    for (const a of ATTRS) { const v = el.getAttribute(a); if (v && TEST.test(v)) { const t = strip(v); if (t !== v) el.setAttribute(a, t); } }',
  '  }',
  '  function walk(n) {',
  '    if (!n) return;',
  '    if (n.nodeType === 3) { doText(n); return; }',
  '    if (n.nodeType !== 1 || SKIP.has(n.nodeName)) return;',
  "    if (n.classList && n.classList.contains('lx-emo')) return;",
  '    doAttrs(n);',
  '    const tw = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);',
  '    const texts = [];',
  '    let c;',
  '    while ((c = tw.nextNode())) { if (c.nodeType === 3) { if (c.nodeValue && TEST.test(c.nodeValue)) texts.push(c); } else doAttrs(c); }',
  '    for (const t of texts) doText(t);',
  '  }',
  '  // CSS-generated content (::before / ::after) never becomes a text node, so the observer cannot',
  '  // see it: a rule whose content holds an emoji loses the emoji and paints the atlas tile as the',
  '  // pseudo-element background instead (sized in em, like the spans). Runs at start and whenever a',
  '  // stylesheet is added; cross-origin sheets are unreadable and skipped.',
  '  function cssRules(list) {',
  '    for (const r of Array.from(list || [])) {',
  '      if (!r.style) { if (r.cssRules) cssRules(r.cssRules); continue; }',
  "      const c = r.style.getPropertyValue('content');",
  '      if (!c || !TEST.test(c)) continue;',
  "      const rr = runs(c.replace(/^[\"']|[\"']$/g, ''));",
  '      if (!rr) continue;',
  '      const first = rr.find((q) => q.e && q.idx >= 0);',
  "      const rest = rr.filter((q) => !q.e).map((q) => q.s).join('');",
  "      r.style.setProperty('content', JSON.stringify(rest));",
  '      if (!first) continue;',
  '      const K = 1.15;',
  "      r.style.setProperty('background-image', 'url(\"' + A.src + '\")');",
  "      r.style.setProperty('background-repeat', 'no-repeat');",
  "      r.style.setProperty('background-size', (A.cols * K) + 'em ' + (A.rows * K) + 'em');",
  "      r.style.setProperty('background-position', '-' + ((first.idx % A.cols) * K).toFixed(3) + 'em -' + (Math.floor(first.idx / A.cols) * K).toFixed(3) + 'em');",
  "      if (!rest.trim()) { if (!r.style.getPropertyValue('display')) r.style.setProperty('display', 'inline-block'); r.style.setProperty('width', K + 'em'); r.style.setProperty('height', K + 'em'); }",
  "      else r.style.setProperty('padding-left', (K + 0.15) + 'em');",
  '    }',
  '  }',
  '  function cssPass() {',
  '    if (!A || !A.src) return;',
  '    for (const sh of Array.from(document.styleSheets || [])) { let l = null; try { l = sh.cssRules; } catch (e) { continue; } cssRules(l); }',
  '  }',
  '  const mo = new MutationObserver((recs) => {',
  '    for (const r of recs) {',
  "      if (r.type === 'characterData') doText(r.target);",
  "      else if (r.type === 'attributes') doAttrs(r.target);",
  "      else for (const n of r.addedNodes) { if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') cssPass(); else walk(n); }",
  '    }',
  '  });',
  '  const start = () => {',
  '    cssPass();',
  '    walk(document.body);',
  '    if (document.title && TEST.test(document.title)) document.title = strip(document.title);',
  '    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });',
  '  };',
  "  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });",
  '  // native dialogs cannot show an image',
  "  for (const fn of ['alert', 'confirm', 'prompt']) {",
  '    const o = window[fn];',
  "    if (typeof o === 'function') window[fn] = function (msg, ...rest) { return o.call(window, (msg == null) ? msg : strip(msg), ...rest); };",
  '  }',
  '})();',
].join(EOL);

// ---- the atlas script + the runtime at the very top of the main script ----------
sub('atlas + runtime', J('  <script src="data/tile_crops.js"></script>', '<script>'),
  // Its OWN small <script> block, not the top of the main one: an inline script runs only once the
  // parser reaches its </script>, and the main block is ~8 MB - so the menus and loading screen
  // above it would show system emoji until the whole game had parsed. This block runs the moment
  // the atlas script has loaded.
  J('  <script src="data/tile_crops.js"></script>',
    '  <script src="data/emoji_atlas.js"></script>',
    '<script>',
    RUNTIME,
    '</script>',
    '<script>'));

const grew = s.length - n0;
if (grew < 6000 || grew > 16000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: no-emoji runtime - canvas text wrap + page observer + atlas script (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
