// Class Advancement modal: the cards fit the screen, and overflow is visible.
// =============================================================================
// Per user, with a screenshot of the Berserker / Knight cards clipped at the
// modal frame: "cut off for this job advancement UI please fix".
//
// MEASURED on the live modal at the game's 960x560 canvas (screen px at the
// 1.333 wrapper scale):
//
//   row viewport   314        header stack ~150 (title 56+16, sub 28+14, divider 35)
//   job tier       513 (+199 hidden)   card 684: icon 117, name 47, flavor 165,
//                                      signature 93, basic-skills 71, stats 33
//   job, armed     571 (+257 hidden)   the "click again to become the ..." prompt
//                                      that makes the choice WORK is below the fold
//   master tier    482 (+168 hidden)   card 614-643
//
// The row does scroll (flex: 1 1 auto; overflow-y: auto) but with a thin,
// near-invisible scrollbar on a dark ground, so to a player it is simply cut
// off. Two things are wrong at once: the cards are too tall for the canvas
// this game is designed at, and nothing says "there is more".
//
// THE FIX, all CSS plus a 12-line hint toggler:
//
//   1. COMPACT every block - modal padding 40/32 -> 18/16, the 38px title to
//      26px on a tighter under-rule, subtitle/divider margins halved, card
//      padding 26/22 -> 14/16, flavor 13.5/1.62 -> 12.5/1.45, signature and
//      perk padding trimmed, the desc min-height removed.
//   2. ICON BESIDE THE NAME instead of stacked on top of it: the icon block
//      alone was 117-135px. Inline-block + vertical-align:middle, no DOM change
//      - the two blocks were already siblings.
//   3. MORE OF THE MODAL FOR THE ROW: max-height 92% -> 97%.
//   4. VISIBLE OVERFLOW for the long tail (three-card masters, longer flavor
//      text, the armed confirm block): a gold scrollbar, and a "scroll for
//      more" hint that appears only while the row actually overflows and
//      hides once scrolled to the end. The hint is toggled after each open
//      and after a card is armed (the confirm block adds ~58px).
//
// Nothing about the choice logic, the story beats, the tp-master tier or the
// talent picker (which shares this modal) changes.
//
// Guarded + atomic + idempotent. EOL-aware: this file flips between CRLF and
// LF as different sessions touch it; multi-line anchors are joined with the
// file's own ending, read rather than assumed.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_advOverflowHint')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the frame: padding, title, subtitle, divider -------------------------
sub('modal padding', '    padding: 40px 40px 32px;',
  '    padding: 18px 28px 16px;   /* v0.30.413 adv-fit — was 40/40/32: 72px of a 515px budget */');
sub('modal height', J('    max-height: 92%;', '    display: flex;', '    flex-direction: column;'),
  J('    max-height: 97%;        /* v0.30.413 adv-fit — was 92%: the row needs every px on a 560-tall canvas */', '    display: flex;', '    flex-direction: column;'));
sub('title size', J('    font-size: 38px;', '    font-weight: 900;', '    letter-spacing: 5px;', '    margin: 0 0 6px;'),
  J('    font-size: 26px;        /* v0.30.413 adv-fit — was 38px (56px tall) */', '    font-weight: 900;', '    letter-spacing: 4px;', '    margin: 0 0 2px;'));
sub('title rule', J('    margin-bottom: 16px;', '    padding-bottom: 12px;', '    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5))'),
  J('    margin-bottom: 8px;     /* v0.30.413 adv-fit — was 16 */', '    padding-bottom: 6px;    /* was 12 */', '    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5))'));
sub('subtitle', J('    margin: -4px 0 14px;', '    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);'),
  J('    margin: -2px 0 6px;     /* v0.30.413 adv-fit — was -4/14 */', '    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);'));
sub('divider', J('    margin: 4px auto 30px;', '    width: 56%;'),
  J('    margin: 2px auto 12px;  /* v0.30.413 adv-fit — was 4/30 */', '    width: 56%;'));

// ---- 2. the cards -----------------------------------------------------------
sub('card padding', J('    padding: 26px 22px 22px;', '    background: linear-gradient(180deg, rgba(46,24,76,0.94) 0%, rgba(20,10,38,0.94) 100%);'),
  J('    padding: 14px 16px 14px;   /* v0.30.413 adv-fit — was 26/22/22 */', '    background: linear-gradient(180deg, rgba(46,24,76,0.94) 0%, rgba(20,10,38,0.94) 100%);'));
sub('icon', J('    font-size: 76px !important;', '    margin-bottom: 14px;'),
  J('    /* v0.30.413 adv-fit — the icon sits BESIDE the name now, not stacked above',
    '       it: this block alone measured 117-135px of a 314px row. */',
    '    font-size: 40px !important;',
    '    display: inline-block;',
    '    vertical-align: middle;',
    '    margin: 0 10px 4px 0;',
    '    line-height: 1;'));
sub('name', J('    font-size: 30px !important;', '    letter-spacing: 2.2px !important;', '    margin-bottom: 8px;'),
  J('    font-size: 22px !important;   /* v0.30.413 adv-fit — was 30 */', '    letter-spacing: 2px !important;', '    margin-bottom: 4px;',
    '    display: inline-block;', '    vertical-align: middle;'));
sub('desc', J('    margin-bottom: 16px;', '    min-height: 56px;', '    opacity: 0.92;'),
  J('    margin-bottom: 8px;     /* v0.30.413 adv-fit — was 16 */', '    min-height: 0;          /* was 56px of guaranteed air */', '    opacity: 0.92;'));
sub('stats', J('    padding: 12px 14px !important;', '    font-size: 12px !important;', '    border-radius: 8px;'),
  J('    padding: 8px 12px !important;    /* v0.30.413 adv-fit — was 12/14 */', '    font-size: 11.5px !important;', '    border-radius: 8px;'));
sub('perk', J('    margin-top: 12px !important;', '    padding: 10px 14px !important;'),
  J('    margin-top: 6px !important;      /* v0.30.413 adv-fit — was 12 */', '    padding: 7px 12px !important;    /* was 10/14 */'));
sub('flavor', J('    font-size: 13.5px;', '    line-height: 1.62;', '    letter-spacing: 0.15px;', '    color: #ece6f4;', '    margin: 10px 4px 14px;', '    padding: 12px 14px 12px 16px;'),
  J('    font-size: 12.5px;      /* v0.30.413 adv-fit — was 13.5 / 1.62 / 10-14 margins / 12-16 padding: 165-194px tall */',
    '    line-height: 1.45;', '    letter-spacing: 0.15px;', '    color: #ece6f4;', '    margin: 6px 2px 8px;', '    padding: 8px 12px 8px 14px;'));

// ---- 3. visible overflow: scrollbar + hint -----------------------------------
sub('hint css', '  #advancement-modal .modal > .wm-adv-divider { flex: 0 0 auto; }',
  J('  #advancement-modal .modal > .wm-adv-divider { flex: 0 0 auto; }',
    '  /* v0.30.413 adv-fit — the crest <img> follows the icon size (the renderer',
    '     sizes it 60px inline). */',
    '  #advancement-modal .class-card .cls-icon img { width: 44px !important; height: 44px !important; vertical-align: middle; }',
    '  /* v0.30.413 adv-fit — when the row still overflows (three-card masters, long',
    '     flavor text, the armed confirm block) say so: a gold scrollbar instead of',
    '     the invisible thin default, and a hint that lives only while there is',
    '     more below. Toggled by _advOverflowHint(). */',
    '  #advancement-modal #advancement-options { scrollbar-color: rgba(255,220,140,0.6) rgba(0,0,0,0.28); }',
    '  #advancement-modal #advancement-options::-webkit-scrollbar { width: 9px; }',
    '  #advancement-modal #advancement-options::-webkit-scrollbar-thumb { background: rgba(255,220,140,0.6); border-radius: 5px; }',
    '  #advancement-modal #advancement-options::-webkit-scrollbar-track { background: rgba(0,0,0,0.28); border-radius: 5px; }',
    '  #advancement-modal .adv-scroll-hint {',
    '    flex: 0 0 auto; display: none; text-align: center; margin-top: 6px;',
    '    font-size: 11px; letter-spacing: 2px; color: #ffe89a; opacity: 0.9;',
    '    text-shadow: 0 0 10px rgba(255,220,120,0.6);',
    '    animation: advHintBob 1.6s ease-in-out infinite;',
    '  }',
    '  #advancement-modal .modal.adv-overflowing .adv-scroll-hint { display: block; }',
    '  @keyframes advHintBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(3px); } }'));

// ---- 4. the toggler, and its three call sites --------------------------------
sub('hint fn', 'function _wmAdvHexToRgba(hex, alpha) {',
  J('// v0.30.413 adv-fit — shows the "scroll for more" hint only while the card row',
    '// actually overflows, and hides it once the player has scrolled to the end.',
    '// Called after each open and after a card is armed (the confirm block adds',
    '// ~58px). Idempotent: creates its node once, re-binds the same handler.',
    'function _advOverflowHint() {',
    "  const md = document.querySelector('#advancement-modal .modal');",
    "  const row = document.getElementById('advancement-options');",
    '  if (!md || !row) return;',
    "  let hint = md.querySelector('.adv-scroll-hint');",
    '  if (!hint) {',
    "    hint = document.createElement('div');",
    "    hint.className = 'adv-scroll-hint';",
    "    hint.textContent = '\\u25BC  scroll for more  \\u25BC';",
    '    md.appendChild(hint);',
    '  }',
    "  const more = () => md.classList.toggle('adv-overflowing', row.scrollTop + row.clientHeight < row.scrollHeight - 2);",
    '  row.onscroll = more;',
    '  more();',
    '}',
    'function _wmAdvHexToRgba(hex, alpha) {'));
sub('open sites', "  document.getElementById('advancement-modal').style.display = 'flex';",
  J("  document.getElementById('advancement-modal').style.display = 'flex';",
    '  requestAnimationFrame(_advOverflowHint);   // v0.30.413 adv-fit'), 2);
sub('armed site', '      card._confirmEl = cf;',
  J('      card._confirmEl = cf;', '      requestAnimationFrame(_advOverflowHint);   // v0.30.413 adv-fit — the confirm block just grew the card'));

const grew = s.length - n0;
if (grew < 2500 || grew > 6500) { console.error(`ABORT: content moved ${n0} -> ${s.length} (${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: advancement modal fit (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
