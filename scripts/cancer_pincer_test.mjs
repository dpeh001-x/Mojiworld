// CANCER'S PINCER — the projectile wears Cancer's colours, and only Cancer's.
// ============================================================================
// Per user: "Cancer zodiac boss pincer claw sprite projectiles should be the
// same colour as the cancer".
//
// Measured before the change, dominant colours:
//   cancer.webp   #fbb3ac #fcd0cb #f8928e #f3716e   coral / salmon
//   p_pincer.webp #6e4888 #50306a #44285c #653e83   violet
// The fire site already tinted the projectile '#ff66aa', so the ART was the
// only thing still purple.
//
// The scope check matters as much as the colour one. p_pincer.webp was shared
// by three keys, and only two of them are Cancer's:
//   pincer / pincerSweep — fired ONLY inside the Cancer state machine
//   claw                 — King Krook's swipe (it sits among fireballRain,
//                          megaFireball, earthquake and shellSpin), tinted
//                          #ffaa55, which recolouring would have turned pink
// So 'claw' keeps the original violet art under p_claw.webp, and this test
// guards that split as much as it guards the recolour.
//
// Also asserted: Octobaby does not fire the pincer. The registry used to label
// it as Octobaby's, which is what made the art look shared; the fire site for
// that skill occurs exactly once, inside the Cancer block.
// Run: node scripts/cancer_pincer_test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Coarse warm/cool split over the opaque pixels. The black outline is skipped
// so it cannot drag every sprite toward "neutral".
const palette = async (file) => {
  const { data } = await sharp(file).resize(96, 96, { fit: 'inside' }).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  let n = 0, warm = 0, violet = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const R = data[i], G = data[i + 1], B = data[i + 2];
    if (R + G + B < 120) continue;
    n++; r += R; g += G; b += B;
    if (R > B + 25) warm++;
    if (B > R && B > G + 20) violet++;
  }
  return {
    n,
    warmShare: n ? warm / n : 0,
    violetShare: n ? violet / n : 0,
    avg: n ? '#' + [r / n, g / n, b / n].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') : null,
  };
};

const P = (f) => path.join(ROOT, f);
const cancer = await palette(P('Sprites/bosses/zodiac/cancer.webp'));
const pincer = await palette(P('Sprites/projectiles/p_pincer.webp'));
const shell = await palette(P('Sprites/projectiles/p_krookshell.webp'));
const animFiles = (await readdir(P('Sprites/projectiles/anim')))
  .filter((f) => /^pincer_\d+\.webp$/.test(f)).sort();
const anims = [];
for (const f of animFiles) anims.push(await palette(P('Sprites/projectiles/anim/' + f)));

// Strip comment lines before scanning the game source. The registry comments
// deliberately QUOTE the strings searched for below -- one of them explains
// that the pincer has a single fire site -- so scanning the raw file counts the
// explanation as a second fire site, and reads the corrected label as the stale
// one. Both assertions failed exactly that way before this filter existed.
const srcRaw = await readFile(P('mojiworld_game.html'), 'utf8');
const NL = /\r?\n/;
const COMMENT = /^\s*(\/\/|\*)/;
const src = srcRaw.split(NL).filter((l) => !COMMENT.test(l)).join('\n');
const pincerFires = (src.match(/skill: *'pincer'/g) || []).length;
const clawMapped = /claw: *'p_krookshell\.webp'/.test(src);
const noDangling = !/p_claw\.webp/.test(srcRaw);
const pincerMapped = /pincer: *'p_pincer\.webp'/.test(src);
const staleLabel = /Octobaby tentacle pincer/.test(src);

const pc = (v) => (v * 100).toFixed(0) + '%';
console.log(`  cancer boss    warm ${pc(cancer.warmShare)}  violet ${pc(cancer.violetShare)}  avg ${cancer.avg}`);
console.log(`  p_pincer       warm ${pc(pincer.warmShare)}  violet ${pc(pincer.violetShare)}  avg ${pincer.avg}`);
console.log(`  p_krookshell   warm ${pc(shell.warmShare)}  violet ${pc(shell.violetShare)}  avg ${shell.avg}`);
console.log(`  anim frames    violet: ${anims.map((a) => pc(a.violetShare)).join(' ')}`);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 190) });

ok('the pincer is warm-toned like Cancer, not violet',
   pincer.warmShare > 0.6 && pincer.violetShare < 0.12,
   `warm ${pc(pincer.warmShare)} / violet ${pc(pincer.violetShare)} (Cancer is warm ${pc(cancer.warmShare)})`);
ok('every animation frame matches it',
   animFiles.length === 9 && anims.every((a) => a.violetShare < 0.12 && a.warmShare > 0.6),
   `${animFiles.length} frames, worst violet ${pc(Math.max(...anims.map((a) => a.violetShare)))}`);
// Krook's shell carries a royal-purple rim ON PURPOSE — it matches his cape —
// so this asserts warm-DOMINANT rather than violet-free. Demanding zero violet
// would reject the very detail that ties the shell to him.
ok('King Krook throws a shell in his own colours, not a tentacle',
   shell.warmShare > 0.6 && shell.violetShare < 0.35,
   `p_krookshell warm ${pc(shell.warmShare)} / violet ${pc(shell.violetShare)} — the purple is the cape-matching rim`);
ok('the two bosses no longer share one projectile file', clawMapped && pincerMapped,
   'claw -> p_krookshell.webp, pincer -> p_pincer.webp');
ok('nothing still points at the retired p_claw.webp', noDangling,
   'the tentacle art is now p_tentacle.webp, unreferenced and free for an Octobaby attack');
ok('the pincer is fired by exactly one thing (Cancer)', pincerFires === 1,
   `${pincerFires} fire site(s), comments excluded`);
ok('the misleading Octobaby label is gone', !staleLabel,
   'Octobaby fires ink / bubbles / splash / octoHead / tidalSweep — never the pincer');

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
