// The class-select preview backdrop is neutral white-grey, has a floor, and is the one the CSS
// draws. Per user: "for the background regenerate it again, make the colour tone more neutral
// white grey and one with a floor for the character."
//
// Re-judges the shipped bytes with the generator's OWN gates (imported, not copied), so the
// numbers that accepted the art are the numbers that guard it.
//
//   node scripts/cs_preview_backdrop_test.mjs [file.html]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { stats, gate } from './gen_cs_preview_backdrop.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
const checks = [];
const count = (needle) => html.split(needle).length - 1;

for (const [variant, file] of [['plain', 'cs_preview_bg.webp'], ['floor', 'cs_preview_bg_floor.webp']]) {
  const p = path.join(ROOT, 'Sprites', 'ui', file);
  let meta = null, st = null, bad = ['unreadable'];
  try {
    const buf = readFileSync(p);
    meta = await sharp(buf).metadata();
    st = await stats(buf); bad = gate(st, variant);
  } catch (e) { bad = [e.message]; }
  checks.push([`${file} is a 512x512 plate`, !!meta && meta.width === 512 && meta.height === 512, meta ? `${meta.width}x${meta.height}` : 'missing']);
  checks.push([`${file} passes the ${variant} gates (neutral, light, filled corners, quiet middle${variant === 'floor' ? ', floor line' : ''})`,
    bad.length === 0, bad.join('; ') || (st && `mean ${st.mean.toFixed(0)}, hue ${st.satPct.toFixed(1)}%, horizon ${st.horizon.toFixed(1)}`)]);
}
// the two variants must actually differ: the floor is a real floor, not a rename
try {
  const a = await stats(readFileSync(path.join(ROOT, 'Sprites', 'ui', 'cs_preview_bg.webp')));
  const b = await stats(readFileSync(path.join(ROOT, 'Sprites', 'ui', 'cs_preview_bg_floor.webp')));
  checks.push(['the floored plate has a stronger floor line than the open one', b.horizon > a.horizon, `open ${a.horizon.toFixed(1)} vs floor ${b.horizon.toFixed(1)}`]);
} catch (e) { checks.push(['the floored plate has a stronger floor line than the open one', false, e.message]); }

// the CSS draws the floored plate, exactly once, inside the preview box rule
const cssBlock = (html.match(/#class-select-modal \.cs-look-preview-wrap \{[^}]*cs_preview_bg[^}]*\}/g) || []);
checks.push(['the preview box rule references the floored plate', cssBlock.length === 1 && /cs_preview_bg_floor\.webp/.test(cssBlock[0]), `${cssBlock.length} rule(s)`]);
checks.push(['no rule still draws the open plate', count("url('Sprites/ui/cs_preview_bg.webp')") === 0, `${count("url('Sprites/ui/cs_preview_bg.webp')")} ref(s)`]);
// and the scrims over it are neutral: no violet or gold wash left in that rule
checks.push(['the scrims over the plate are neutral (no violet, no gold wash)', cssBlock.length === 1 && !/rgba\(255, 220, 140|rgba\(22, 14, 44|rgba\(120, 128, 148/.test(cssBlock[0].replace(/border-color[^;]*;/, ''))]);

let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
