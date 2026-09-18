// The Block (A) icon, in the skill icons' style - the game-file half: it fills its slot like a skill icon.
// ============================================================================
// Per user: "regenerate the block A icon for all classes to better suit the icons in a similar style to the skill icons".
// The art is regenerated (scripts/gen_block_icons.mjs; installed by apply_block_icons_files.mjs). Side by side in the
// hotbar, the old slot also broke the set another way: every skill icon is painted at 116% of its 40 px slot (see
// _applySkillIcon - background-size 116%, the slot clips), while the Block icon was a 24 px <img> under its label.
// It now fills its slot the same way, with its "Block" chip and the A key on top like every slot's cost chip and key.
// The mobile deck's Block button keeps its own sizing.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) block-icons/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, a, b) => { const c = s.split(a).length - 1; if (c !== 1) { console.error('ABORT ' + label + ': matched ' + c + ', expected 1'); process.exit(1); } s = s.replace(a, b); };

sub('slot css', '  /* Centred icon — sized for the 40 px slot. Subtle hover lift on the',
  J('  /* v0.30.895 block-icons — THE BLOCK ICON FILLS ITS SLOT like every skill icon (per user: "regenerate the block A icon',
    '     ... in a similar style to the skill icons"). Each skill icon is painted at 116% of its slot (_applySkillIcon: a',
    '     116% background, clipped by the slot); the Block icon was a 24 px picture under its label. Same size and crop',
    '     now, with the "Block" chip and the A key painting on top as every slot\'s cost chip and key do. */',
    '  .skill-slot.defense .skill-icon { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; filter: none; }',
    '  .skill-slot.defense .skill-icon img[data-lx-block-icon] { width: 116% !important; height: 116% !important; max-width: none; flex: none; }',
    '  /* Centred icon — sized for the 40 px slot. Subtle hover lift on the'));

sub('art note', "const _LX_BLOCK_ICON = { rogue: 'block_rogue', archer: 'block_archer', warrior: 'block_warrior', mage: 'block_mage' };",
  J('// v0.30.895 block-icons — REPAINTED IN THE SKILL ICONS\' STYLE (per user): die-cut stickers with a white edge and a thin',
    '// black outline, flat vibrant colours (scripts/gen_block_icons.mjs), each showing what that class\'s block actually looks',
    '// like in game (Sprites/fx/block_<class>): the warrior\'s golden shield of light, the rogue\'s violet smoke burst, the',
    '// mage\'s light-blue rune ward, the archer\'s green wind gust; a steel shield before a class is chosen.',
    "const _LX_BLOCK_ICON = { rogue: 'block_rogue', archer: 'block_archer', warrior: 'block_warrior', mage: 'block_mage' };"));

const grew = s.length - n0;
if (grew < 900 || grew > 2400) { console.error('ABORT: size moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: block-icons (+' + grew + ' chars)');
