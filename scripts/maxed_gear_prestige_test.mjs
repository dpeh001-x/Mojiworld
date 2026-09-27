#!/usr/bin/env node
// Maxed gear, prestige pop (per user: "For the design of the transcended - MAX can be more pop with prestigious feel the
// *10 can be a nice gold black combination"). Static.   node scripts/maxed_gear_prestige_test.mjs [game.html]
import { readFileSync } from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const s = readFileSync(process.argv[2] || path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const css = (sel) => { const m = s.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\]/g, '\$&') + '\s*\{([^}]*)\}')); return m ? m[1] : ''; };
ok('a ★10 piece gets its own badge class', /s >= \(typeof MAX_STARS !== 'undefined' \? MAX_STARS : 10\) \? 'tier-max'/.test(s));
const b = css('.item-star-badge.tier-max');
ok('...gold lettering on black, with a gold rim', /background: #0c0b10/.test(b) && /color: #ffd24a/.test(b) && /border: 1\.5px solid #ffd24a/.test(b));
ok('...its offset is a filter (low-effects mode keeps it)', /filter: drop-shadow\(1\.5px 1\.5px 0/.test(b) && /box-shadow: none/.test(b));
ok('the Forge marks a maxed piece with the prestige stamp', /'<span class="forge-max-stamp' \+ \(it\.transcended \? ' is-transcended' : ''\) \+ '" aria-label="Maxed">/.test(s));
const st = css('.forge-max-stamp');
ok('...gold leaf inked in black, tilted, with a sweeping sheen', /color: #0c0b10/.test(st) && /#ffd24a/.test(st) && /rotate\(-8deg\)/.test(st) && /animation: forgeMaxSheen/.test(st));
ok('...a transcended piece wears an ember rim on the stamp', /\.forge-max-stamp\.is-transcended \{[^}]*rgba\(255, 120, 60/.test(s));
ok('a maxed Forge tile dims only its picture, not its badge or stamp', /div\.classList\.add\('forge-maxed'\)/.test(s) && /\.inv-slot\.forge-maxed > img \{ opacity: 0\.45; \}/.test(s) && !/\(s >= MAX_STARS \? ' opacity:0\.5;' : ''\)/.test(s));
ok('the old 8px pink MAX label is gone', !/color:#ff99dd; text-shadow:0 0 3px #000;">MAX</.test(s));
ok('reduced motion stills the gleam and the sheen', /@media \(prefers-reduced-motion: reduce\) \{ \.item-star-badge\.tier-max, \.forge-max-stamp \{ animation: none; \} \}/.test(s));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
