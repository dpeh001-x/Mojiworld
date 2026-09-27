#!/usr/bin/env node
// Maxed gear, prestige pop (per user: "For the design of the transcended - MAX can be more pop with prestigious feel the
// *10 can be a nice gold black combination"). Static.   node scripts/maxed_gear_prestige_test.mjs [game.html]
import { readFileSync } from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const s = readFileSync(process.argv[2] || path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
// the body of the first rule whose selector is exactly `sel`
const css = (sel) => { const i = s.indexOf(sel + ' {'); if (i < 0) return ''; const j = s.indexOf('}', i); return s.slice(i + sel.length + 2, j); };
ok('a ★10 piece gets its own badge class', s.includes("s >= (typeof MAX_STARS !== 'undefined' ? MAX_STARS : 10) ? 'tier-max'"));
const b = css('  .item-star-badge.tier-max');
ok('...gold lettering on black, with a gold rim', b.includes('background: #0c0b10') && b.includes('color: #ffd24a') && b.includes('border: 1.5px solid #ffd24a'));
ok('...its offset is a filter (low-effects mode keeps it)', b.includes('filter: drop-shadow(1.5px 1.5px 0') && b.includes('box-shadow: none'));
ok('the Forge marks a maxed piece with the prestige stamp', s.includes(`'<span class="forge-max-stamp' + (it.transcended ? ' is-transcended' : '') + '" aria-label="Maxed">`));
const st = css('  .forge-max-stamp');
ok('...gold leaf inked in black, tilted, with a sweeping sheen', st.includes('color: #0c0b10') && st.includes('#ffd24a') && st.includes('rotate(-8deg)') && st.includes('animation: forgeMaxSheen'));
ok('...a transcended piece wears an ember rim on the stamp', css('  .forge-max-stamp.is-transcended').includes('rgba(255, 120, 60'));
ok('a maxed Forge tile dims only its picture, not its badge or stamp', s.includes("div.classList.add('forge-maxed')") && s.includes('.inv-slot.forge-maxed > img { opacity: 0.45; }') && !s.includes("(s >= MAX_STARS ? ' opacity:0.5;' : '')"));
ok('the old 8px pink MAX label is gone', !s.includes('color:#ff99dd; text-shadow:0 0 3px #000;">MAX<'));
ok('reduced motion stills the gleam and the sheen', s.includes('@media (prefers-reduced-motion: reduce) { .item-star-badge.tier-max, .forge-max-stamp { animation: none; } }'));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
