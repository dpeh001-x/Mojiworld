// Web build: emoji icons blank, one art-CDN hiccup was final, and one monster's sounds 404'd (launch audit, 2026-09-26).
// ============================================================================
// 1) BLANK EMOJI ICONS ON play.moji-studios.com. data/emoji_atlas.js holds a relative src ("Sprites/ui/emoji_atlas.webp").
//    The Pages deploy rewrites 'Sprites/ to the jsDelivr art CDN only inside the HTML, and Sprites/ is not published on
//    the site itself, so a bare A.src asks the game's own site for the sheet and gets a 404. v0.30.888 fixed that for
//    the canvas image only (its line carries the rewrite bait 'Sprites/'). The page tiles (the .lx-emo CSS background)
//    and the SVG <image> still used the raw path, and .lx-emo hides the emoji character, so every icon in menus, HUD
//    text and dialogs drew as an empty box. Now the atlas IIFE computes ONE resolved URL (the v0.30.888 expression) and
//    all three sinks use it.
// 2) ONE RETRY FOR ART-CDN IMAGES. A transient jsDelivr failure (ERR_BLOCKED_BY_ORB on an NPC sprite) was final: the
//    loader fell through to its .png guess or the procedural body. There is no single image loader (59 `new Image()`
//    sites), but every script-set src passes one door, HTMLImageElement.prototype.src, which the boot image hold already
//    wraps. A small wrapper there - installed only when the deploy rewrite has made the art folders absolute, so local,
//    file:// and Steam builds are untouched - keeps the FIRST error of a CDN image from the page's handlers and asks
//    again 1.2 s later with a cache-busting query. The second outcome reaches the page as before; src reads unchanged.
// 3) MONSTER SOUND 404. sovCrownShard has no audio/monster/mob_sovCrownShard_{hit,die}.mp3, so the per-type probe 404'd
//    on first hit and first death before the family clip took over. The game ships no runtime list of custom clips
//    (data/sfx_manifest.js is the animator's), so a small set marks the type as "no custom clip" (the probe's own
//    null = unavailable contract) and it never asks.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxCdnImageRetry(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 2) the retry, ahead of the atlas IIFE so the atlas sheet itself is covered
const HEAD = J('<script>', '// v0.30.634 no-emoji - every emoji the game draws becomes a custom ludo.ai icon (per user: "ensure');
once(HEAD, J('<script>',
  '// v0.30.1174 emoji-atlas-cdn - ONE RETRY FOR ART-CDN IMAGES (web build only). The web build streams art from jsDelivr, and a',
  '// transient failure there (seen: ERR_BLOCKED_BY_ORB on an NPC sprite) used to be final - the loader fell through to its',
  '// .png guess or the procedural fallback. There is no single image loader, but every script-set src passes this one door',
  '// (the boot image hold wraps it too). The two literals below are rewrite bait: the deploy turns them into the CDN folders,',
  '// and only then is anything installed. A CDN image\'s FIRST error is kept from the page\'s own handlers (a capture listener',
  '// on the image runs first), the same URL is asked again 1.2 s later with a cache-busting query, and whatever that second',
  '// try does reaches the page as usual. src still reads back as the URL the page set.',
  '(function _lxCdnImageRetry() {',
  '  try {',
  "    const bases = ['Sprites/', 'backgrounds/'].filter((b) => /^https?:\\/\\//.test(b));",
  "    if (!bases.length || typeof HTMLImageElement === 'undefined' || window._lxCdnRetry) return;",
  "    const P = HTMLImageElement.prototype, d = Object.getOwnPropertyDescriptor(P, 'src');",
  '    if (!d || !d.set || !d.get) return;',
  '    const onCdn = (v) => { for (let i = 0; i < bases.length; i++) if (v.lastIndexOf(bases[i], 0) === 0) return true; return false; };',
  '    let retries = 0;',
  '    const onErr = function (ev) {',
  '      const u = this._lxCdnAsk;',
  '      if (!u) return;   // v0.30.1174 emoji-atlas-cdn - not a CDN image, or the retry itself failed: the page hears it',
  '      this._lxCdnAsk = null;',
  '      ev.stopImmediatePropagation();',
  '      const img = this, tok = img._lxCdnTok = {};',
  '      setTimeout(() => {',
  '        if (img._lxCdnTok !== tok) return;   // v0.30.1174 emoji-atlas-cdn - the page set another src meanwhile',
  '        retries++;',
  '        const shown = d.get.call(img);',
  "        d.set.call(img, u + (u.indexOf('?') >= 0 ? '&' : '?') + 'lxretry=1');",
  '        img._lxCdnShown = shown; img._lxCdnBust = d.get.call(img);',
  '      }, 1200);',
  '    };',
  "    Object.defineProperty(P, 'src', { configurable: true, enumerable: d.enumerable,",
  '      get() { const r = d.get.call(this); return (this._lxCdnBust && r === this._lxCdnBust) ? this._lxCdnShown : r; },',
  '      set(v) {',
  '        this._lxCdnAsk = null; this._lxCdnTok = null; this._lxCdnBust = null;',
  "        if (typeof v === 'string' && onCdn(v)) {",
  '          this._lxCdnAsk = v;',
  "          if (!this._lxCdnHooked) { this._lxCdnHooked = true; this.addEventListener('error', onErr, true); }",
  '        }',
  '        d.set.call(this, v);',
  '      } });',
  '    window._lxCdnRetry = { bases, count: () => retries };',
  '  } catch (e) {}',
  '})();',
  '// v0.30.634 no-emoji - every emoji the game draws becomes a custom ludo.ai icon (per user: "ensure'), 'the atlas <script> head');

// 1) one resolved atlas URL for the canvas, the page tiles and SVG
once('  const A = window.LX_EMOJI_ATLAS || null;', J('  const A = window.LX_EMOJI_ATLAS || null;',
  "  // v0.30.1174 emoji-atlas-cdn - ONE resolved atlas URL for all three sinks (canvas, the .lx-emo page tiles, SVG). On the web",
  "  // build 'Sprites/' below is rewritten to the art CDN; data/*.js is not, so the bare A.src asked the game's own site",
  '  // (404). v0.30.888 fixed only the canvas image; the page tiles and SVG drew empty boxes.',
  "  const SRC = (A && A.src) ? String(A.src).replace(/^Sprites\\//, 'Sprites/') : '';"), 'the atlas const A');
once(J("    im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', A.src);", "    im.setAttribute('href', A.src);"),
  J("    im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', SRC);   // v0.30.1174 emoji-atlas-cdn - the resolved URL, not A.src",
    "    im.setAttribute('href', SRC);"), 'the SVG image href');
once("    IMG.src = String(A.src).replace(/^Sprites\\//, 'Sprites/');",
  '    IMG.src = SRC;   // v0.30.1174 emoji-atlas-cdn - computed once at the top, shared with the page tiles and SVG', 'the canvas IMG.src');
once("    st.textContent = '.lx-emo{display:inline-block;width:'",
  J('    // v0.30.1174 emoji-atlas-cdn - the tiles\' background is the resolved SRC (was the raw A.src: a 404 on web, every tile blank)',
    "    st.textContent = '.lx-emo{display:inline-block;width:'"), 'the .lx-emo rule head');
once("      + 'background-image:url(\"' + A.src + '\");", "      + 'background-image:url(\"' + SRC + '\");", 'the .lx-emo background-image');

// 3) monster types with no custom clip skip the probe
once(J('function _probeMonsterCustomSfx(type, kind) {', "  const ck = type + '_' + kind;", '  if (_monsterCustomSfx[ck] !== undefined) return;'), J(
  '// v0.30.1174 emoji-atlas-cdn - monster types with NO custom clip in audio/monster/. Probing one only produced a 404 on its first',
  '// hit and first death before the family clip took over; listed here, it goes straight to "unavailable" (null) and never asks.',
  "const _MONSTER_NO_CUSTOM_SFX = new Set(['sovCrownShard']);",
  'function _probeMonsterCustomSfx(type, kind) {', "  const ck = type + '_' + kind;", '  if (_monsterCustomSfx[ck] !== undefined) return;',
  '  if (_MONSTER_NO_CUSTOM_SFX.has(type)) { _monsterCustomSfx[ck] = null; return; }   // v0.30.1174 emoji-atlas-cdn - no file: no 404 probe'),
  '_probeMonsterCustomSfx head');

// leftovers: nothing in the atlas IIFE may still hand the raw A.src to a sink
{
  const a = s.indexOf('  const A = window.LX_EMOJI_ATLAS || null;'), b = s.indexOf("  const SKIP = new Set(['SCRIPT'", a);
  if (a < 0 || b < 0 || b - a > 20000) die('atlas IIFE bounds not found');
  const body = s.slice(a, b);
  if (/(href', A\.src|url\("' \+ A\.src|IMG\.src = String\(A\.src\))/.test(body)) die('a raw A.src sink survived');
}

const grew = s.length - n0;
if (grew < 2500 || grew > 6000) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: emoji-atlas-cdn (+' + grew + ' chars)');
