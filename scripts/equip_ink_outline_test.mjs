#!/usr/bin/env node
// Equipment art carries a 1.5px ink outline (2px until the user asked "perhaps make it 1.5 px instead") (per user: "For the item equipment here add a 2px black outline", "this is to
// make it fit the pop punk aesthetic"). Static.   node scripts/equip_ink_outline_test.mjs [game.html]
import { readFileSync } from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const s = readFileSync(process.argv[2] || path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const rule = s.match(/\.inv-slot\[data-attr\] > img, \.equip-slot > img \{ filter: url\(#lx-ink-2px\); \}/);
ok('equipment art in the bag and the equipped slots is filtered through the ink outline', !!rule);
const f = s.match(/<filter id="lx-ink-2px"[\s\S]*?<\/filter>/);
ok('the ink filter is defined once', !!f && s.split('id="lx-ink-2px"').length === 2);
ok('...it grows the silhouette by exactly 1.5px (a max - crisp, not stacked shadows; 2 -> 1.5 per user)', !!f && /<feMorphology in="a" operator="dilate" radius="1.5"/.test(f[0]));
ok('...in the UI ink colour, laid UNDER the art', !!f && /flood-color="#0c0b10"/.test(f[0]) && /<feMergeNode in="outline"\/><feMergeNode in="SourceGraphic"\/>/.test(f[0]));
ok('...and faint glows are cut before growing, so they do not wear dark halos', !!f && /<feFuncA type="linear" slope="2\.5" intercept="-0\.3"\/>/.test(f[0]));
ok('consumables stay unoutlined (only tiles with a stat family, data-attr, are matched)', !/\.inv-slot > img\s*[,{]/.test(s) && !/\.inv-slot img\s*[,{][^}]*lx-ink/.test(s));
ok('the class badge is a span, so the direct-child selector never outlines it', /<span class="item-class-badge\$\{off\}"/.test(s));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
