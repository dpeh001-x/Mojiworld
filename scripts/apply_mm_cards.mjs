// The MojiMon tab's two top cards, made cute.
// v0.30.1109 (per user: "needs more POP feel"): the look was redone as pop comic - pink, black and yellow - in
// _mm_cards.css.txt, with the pane head moved into it (.mmc-shell / .mmc-top). The notes below describe the first, cute pass.
// v0.30.1114 (per user: "reduce the amount of white", "hot pink less", "MOJIMON can be better designed"): raspberry over hot
// pink, no white edges or tiles, and the head as a comic logo lockup (.mmc-brand / .mmc-plate / per-letter <b>).
// ============================================================================
// Per user, on the "⛓ MOJIMON" rules card and the "Summon cooldown" card: "These buttons and fonts can be
// stylised, polished to be more artistic and appealing"; on the first sample: "Can be further improved and made
// cuter, but good attempt".
//   - the rules card becomes HOW TO BIND: three pastel stepping-stones with paw prints between them - 1 MASTER
//     (target icon; 10,000 big and gold, kills of one species), 2 BIND (magic wand; get close to a wild one, complete
//     the binding sequence), 3 TEAM UP (handshake; a pink pill "15x your max HP", a gold pill "50% of your ATK").
//     Same facts, same constants; the header above already says MOJIMON, so the card names what it explains;
//   - the cooldown card becomes a summon clock: a ring round your H-slot MojiMon's own sprite (the MojiMon logo
//     when none is set) with a little H keycap, mint and pinging when READY ("Slippy is ready to play!"), peach and
//     refilling while it rests; upgrade points on a gold star; Dismiss a pink candy button ("Dismiss Slippy");
//   - plush cards: a stitched seam inside a soft border, star-dot sprinkles, pink and sky glows, two twinkling
//     sparkles; Fredoka for headings and numbers, Nunito for words (both bundled). Icons are the game's own emoji
//     set. Borders, outlines and gradients carry the look, so the low-graphics mode keeps it.
// On a narrow pane the cards stack and the steps become rows. #mojimon-cd keeps its id, data-until and READY / m:ss
// text, so the countdown ticker works as before; it now also drains the ring.
//
// Guarded + atomic + idempotent. EOL-aware. The stylesheet is scripts/_mm_cards.css.txt.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) mm-cards/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;
const once = (label, a, z) => { if (count(a) !== 1) die(label + ' matched ' + count(a)); s = s.replace(a, () => z); };

// 1. the stylesheet, injected once by the renderer
const CSS = readFileSync(path.join(HERE, '_mm_cards.css.txt'), 'utf8').replace(/\r\n/g, '\n').trim();
if (!CSS.includes('#u-pane-mojimon .mmc-card') || /[^\x00-\x7e\n\u2014]/.test(CSS)) die('the stylesheet file looks wrong');
const HELPER = [
  '// v0.30.1007 mm-cards — the MojiMon tab\'s two top cards, cute (per user: "stylised, polished to be more artistic and',
  '// appealing", then "made cuter"). Their stylesheet, added once. See scripts/apply_mm_cards.mjs.',
  'function _mmCardsCss() {',
  "  if (document.getElementById('mm-cards-css')) return;",
  "  const st = document.createElement('style'); st.id = 'mm-cards-css';",
  '  st.textContent = ' + JSON.stringify(CSS) + ';',
  '  document.head.appendChild(st);',
  '}',
  '',
].join(EOL);
once('helper', '// U-panel tab renderer. Rebuilt on every interaction (roster is tiny); the', HELPER + '// U-panel tab renderer. Rebuilt on every interaction (roster is tiny); the');
const HEAD = 'function renderMojiMonPanel() {' + EOL + "  const host = document.getElementById('u-pane-mojimon');" + EOL + '  if (!host) return;';
once('call', HEAD, HEAD + EOL + '  _mmCardsCss();');

// 2. the markup: the row of two cards
const A0 = '    \'<div style="display:flex; gap:10px; align-items:stretch; margin-bottom:10px;">\' +', A1 = '  if (!rosterKeys.length) {';
if (count(A0) !== 1 || count(A1) !== 1) die('cards anchors ' + count(A0) + '/' + count(A1));
const j0 = s.indexOf(A0), j1 = s.indexOf(A1);
if (!(j1 > j0 && j1 - j0 < 3000)) die('cards bounds ' + j0 + '..' + j1);
const old = s.slice(j0, j1);
for (const must of ['15× your max HP', 'MOJIMON_ATK_MULT * 100', 'id="mojimon-cd"', '_mojimonUi.dismiss()']) if (!old.includes(must)) die('the cards moved: no ' + must);
const step = (n, cls, ico, name, body) => "    '<div class=\"mmc-step " + cls + "\"><div class=\"mmc-sh\"><span class=\"mmc-ico\">" + ico + "<b class=\"mmc-n\">" + n + "</b></span><span class=\"mmc-st\">" + name + "</span></div>" + body + "</div>' +";
const CARDS = [
  "    // v0.30.1007 mm-cards — HOW TO BIND as three pastel stepping-stones; the summon clock as a ring round your buddy.",
  "    '<div class=\"mmc-row\">' +",
  "    '<div class=\"mmc-card mmc-how\"><div class=\"mmc-h\"><img class=\"mmc-logo\" src=\"Sprites/ui/mojimon_logo.webp\" alt=\"\"><span class=\"mmc-ht\">How to bind</span></div><div class=\"mmc-steps\">' +",
  step(1, 's1', '🎯', 'Master', "<div class=\"mmc-big\">' + MOJIMON_KILLS_REQ.toLocaleString() + '</div><div class=\"mmc-t\">kills of one species</div>"),
  "    '<div class=\"mmc-link\" aria-hidden=\"true\">🐾</div>' +",
  step(2, 's2', '🪄', 'Bind', "<div class=\"mmc-big\">Get close</div><div class=\"mmc-t\">to a wild one, then complete the binding sequence</div>"),
  "    '<div class=\"mmc-link\" aria-hidden=\"true\">🐾</div>' +",
  step(3, 's3', '🤝', 'Team up', "<div class=\"mmc-chip hp\">💖 <b>15× your max HP</b></div><div class=\"mmc-chip atk\">⚔ <b>' + Math.round(MOJIMON_ATK_MULT * 100) + '% of your ATK</b></div><div class=\"mmc-t\">using its own species\\u2019 attack pattern</div>"),
  "    '</div></div>' +",
  "    '<div class=\"mmc-card mmc-cd ' + (cdLeft > 0 ? 'cooling' : 'ready') + '\" style=\"--p:' + Math.min(1, cdLeft / MOJIMON_CD_MS).toFixed(4) + '\">' +",
  "    (function () {   // the buddy in the ring: the H-slot MojiMon, else the one out, else the MojiMon logo",
  "      const _k = (mm.assigned && mm.roster[mm.assigned]) ? mm.assigned : ((mm.out && mm.out.type) || null);",
  "      const _t = _k ? (monsterTypes[_k] || {}) : null;",
  "      const _sp = (_k && typeof _monsterDexSprite === 'function') ? _monsterDexSprite(_k, _t) : null;",
  "      const _nm = _k ? (_t.name || _k) : '';",
  "      return '<div class=\"mmc-cdtop\"><div class=\"mmc-ring\">' +",
  "        '<img class=\"mmc-buddy\" src=\"' + ((_sp && _sp.src) ? _sp.src : 'Sprites/ui/mojimon_logo.webp') + '\" alt=\"\">' +",
  "        '<kbd title=\"H - the quick-summon key\">H</kbd></div><div class=\"mmc-cdtx\">' +",
  "        '<div class=\"mmc-lbl\">Summon</div>' +",
  "        '<div id=\"mojimon-cd\" data-until=\"' + mm.cdUntil + '\">' + (cdLeft > 0 ? fmtCd(cdLeft) : 'READY') + '</div>' +",
  "        '<div class=\"mmc-sub\">' + (cdLeft > 0 ? '💤 resting until the next summon' : (_nm ? esc(_nm) + ' is ready to play!' : 'ready when you are')) + '</div></div></div>';",
  "    })() +",
  "    '<div class=\"mmc-div\"></div>' +",
  "    '<div class=\"mmc-pts\"><div class=\"mmc-star\"><b>' + pts + '</b></div><div><div class=\"mmc-ptl\">Upgrade points</div><div class=\"mmc-sub\">1 per 5 levels · per mon · free respec</div></div></div>' +",
  "    (mm.out ? '<button type=\"button\" class=\"mmc-dismiss\" onclick=\"_mojimonUi.dismiss()\">👋 Dismiss ' + esc(((monsterTypes[mm.out.type] || {}).name) || mm.out.type) + '</button>' : '') +",
  "    '</div></div>';",
  '',
].join(EOL);
s = s.slice(0, j0) + CARDS + s.slice(j1);

// 3. the countdown ticker drains the ring too
const TICK = "      el.textContent = left > 0 ? fmtCd(left) : 'READY';";
once('ticker', TICK, TICK + EOL + "      { const _cd = el.closest('.mmc-cd'); if (_cd) _cd.style.setProperty('--p', Math.min(1, left / MOJIMON_CD_MS).toFixed(4)); }   // v0.30.1007 mm-cards");

if ([...s].some((c) => { const n = c.codePointAt(0); return n >= 0xD800 && n <= 0xDFFF; })) die('lone surrogate');
const grew = s.length - n0;
if (grew < 5000 || grew > 16000) die('size moved ' + grew);
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
console.log('applied: mm-cards (+' + grew + ' chars)');
