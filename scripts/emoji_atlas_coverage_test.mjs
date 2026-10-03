// EVERY PICTOGRAPH THE GAME CAN DRAW IS IN THE EMOJI ATLAS (bughunt bootdata-1, 2026-10-02).
// The page/canvas emoji engine maps each \p{Extended_Pictographic} character through data/emoji_atlas.js and draws the SPARKLE tile for one
// that is not a key - "never the OS glyph" - so a toast, a quest icon or a tutorial box that names an uncovered character shows a sparkle
// where the writer meant something else (King Gloopaloo's toasts, the Canary quest, the tour's Y hint and TRY IT box all did).
// This reads the game source WITHOUT running it: every string / template literal of every inline <script>, the static HTML text, every
// <style> `content:` value and every string in data/*.js, applies the engine's own matcher and key rule, and fails on a character the
// atlas does not carry. A hand-rolled JS lexer (strings, templates with nesting, comments, regex literals) - no parser dependency.
//   node scripts/emoji_atlas_coverage_test.mjs [page.html]
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = path.resolve(process.argv[2] || path.join(ROOT, 'mojiworld_game.html'));
const html = fs.readFileSync(page, 'utf8');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };

// ---- the atlas ----
const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'emoji_atlas.js'), 'utf8'), sb);
const MAP = (sb.window.LX_EMOJI_ATLAS || {}).map || {};
// ---- the engine's own matcher and key rule (mojiworld_game.html, the no-emoji IIFE) ----
const RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2})|(?:[#*0-9]️?⃣)|(?:\p{Extended_Pictographic}[︎️]?[\u{1F3FB}-\u{1F3FF}]?(?:‍\p{Extended_Pictographic}[︎️]?[\u{1F3FB}-\u{1F3FF}]?)*)/gu;
const KEEP = new Set(['©', '®', '™']);
const keyOf = (e) => Array.from(e.replace(/[︎️]/g, '').replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')).map((c) => c.codePointAt(0).toString(16)).join('-');
function uncovered(text) {
  const out = []; RE.lastIndex = 0; let m;
  while ((m = RE.exec(text))) { if (KEEP.has(m[0]) || /^[#*0-9]$/.test(m[0])) continue; const k = keyOf(m[0]); if (MAP[k] == null) out.push(k); }
  return out;
}

// ---- a small JS lexer: yields the COOKED text of every string and template-literal chunk ----
function decode(raw) {   // \uXXXX, \u{X...}, \xHH and the one-char escapes; anything else keeps the char
  return raw.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]))/g, (m, a, b, c, d) => {
    if (a) return String.fromCodePoint(parseInt(a, 16)); if (b) return String.fromCharCode(parseInt(b, 16)); if (c) return String.fromCharCode(parseInt(c, 16));
    return ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' })[d] ?? d;
  });
}
function lexStrings(src) {
  const out = []; let i = 0; const n = src.length; let last = '';
  const KW = /^(return|typeof|case|do|else|in|of|new|delete|void|throw|instanceof|yield|await)$/;
  const regexOK = () => !last || /^[(,=:\[!&|?{;+\-*%<>~^]$/.test(last) || KW.test(last) || last === '=>';
  function tpl() {   // i is just past the opening backtick
    let from = i;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { out.push(decode(src.slice(from, i))); i++; last = '`'; return; }
      if (c === '$' && src[i + 1] === '{') { out.push(decode(src.slice(from, i))); i += 2; run(true); from = i; continue; }
      i++;
    }
  }
  function run(untilBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === '"' || c === "'") {
        const from = i + 1; i++;
        while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
        out.push(decode(src.slice(from, i))); i++; last = c; continue;
      }
      if (c === '`') { i++; tpl(); continue; }
      if (c === '/' && regexOK()) {
        i++; let cls = false;
        while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '\n') break; if (cls) { if (d === ']') cls = false; } else if (d === '[') cls = true; else if (d === '/') break; i++; }
        i++; while (i < n && /[a-z]/i.test(src[i])) i++; last = 'regex'; continue;
      }
      if (c === '{') { depth++; last = '{'; i++; continue; }
      if (c === '}') { if (depth === 0 && untilBrace) { i++; return; } depth = Math.max(0, depth - 1); last = '}'; i++; continue; }
      if (/[A-Za-z_$]/.test(c)) { let j = i + 1; while (j < n && /[\w$]/.test(src[j])) j++; last = src.slice(i, j); i = j; continue; }
      if (/[0-9]/.test(c)) { let j = i + 1; while (j < n && /[\w.]/.test(src[j])) j++; last = '0'; i = j; continue; }
      last = c; i++;
    }
  }
  run(false);
  return out;
}

// ---- gather the text ----
const sources = [];   // {where, texts[]}
const reBlock = /<(script|style)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi; let m, stripped = ''; let last = 0, nb = 0;
while ((m = reBlock.exec(html))) {
  stripped += html.slice(last, m.index); last = m.index + m[0].length; nb++;
  if (m[1].toLowerCase() === 'script') { if (!/\ssrc=/.test(m[2] || '')) sources.push({ where: 'script block ' + nb, texts: lexStrings(m[3]) }); }
  else { const cs = []; m[3].replace(/content\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (_, v) => { cs.push(decode(v.slice(1, -1))); return _; }); sources.push({ where: 'style block ' + nb, texts: cs }); }
}
stripped += html.slice(last);
const entity = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
sources.push({ where: 'static HTML text', texts: entity(stripped.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '\n')).split('\n') });
const dataDir = path.join(ROOT, 'data');
for (const f of fs.readdirSync(dataDir).filter((x) => x.endsWith('.js') && x !== 'emoji_atlas.js')) {
  const t = fs.readFileSync(path.join(dataDir, f), 'utf8'); if (t.length > 4e6) continue;
  sources.push({ where: 'data/' + f, texts: lexStrings(t) });
}
let strings = 0; const bad = [];
for (const s of sources) for (const t of s.texts) { strings++; const u = uncovered(t); if (u.length) bad.push({ where: s.where, keys: u, text: t.slice(0, 80) }); }

check(Object.keys(MAP).length > 300, 'the atlas loads (' + Object.keys(MAP).length + ' glyphs)');
check(strings > 20000, 'the lexer read the whole game (' + strings + ' strings / text runs over ' + sources.length + ' sources)');
// the lexer must have seen the strings it is meant to guard, or a desync would pass vacuously
const flat = sources.flatMap((s) => s.texts).join('\n');
check(/KING GLOOPALOO LUNGES/.test(flat) && /The Canary Did Not Sing/.test(flat) && /tt-box/.test(flat) && /CODEX/.test(flat), 'it saw the four strings this test was written for');
check(bad.length === 0, 'every pictograph in a string, template, CSS content or static text is a key of the emoji atlas (an uncovered one draws as the sparkle tile)',
  bad.slice(0, 6).map((b) => b.keys.join('+') + ' in ' + b.where + ': ' + JSON.stringify(b.text)).join(' | '));
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
