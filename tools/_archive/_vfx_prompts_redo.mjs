// Rewrite scripts/generate_mob_vfx.mjs prompts: enforce the house art style
// (painterly cel-shaded anime + bold dark outline + glossy, explicitly NOT
// chunky-western-cartoon / NOT watercolor) and fold in the lava pair so one
// script owns all of Sprites/vfx/.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../scripts/generate_mob_vfx.mjs', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

// 1) PREFIX
const pOld = src.match(/const PREFIX = '[\s\S]*?Must read clearly at small in-game size\. ';/);
if (!pOld) { console.error('PREFIX anchor FAIL'); process.exit(2); }
const pNew = `const PREFIX = 'Game VFX sprite for a cute 2D side-scroller RPG in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no character, no ground tile. 768x768 square canvas. ' +
  'ABSOLUTELY NO TEXT of any kind: no letters, words, numbers, runes or watermark — wordless imagery only. ' +
  'STYLE (critical, match the game art exactly): soft painterly cel-shaded ANIME style with a bold clean DARK OUTLINE around the main shapes, ' +
  'glossy highlights, vibrant saturated colors, smooth soft gradients and additive glow. ' +
  'NOT pixel-art, NOT blocky, NOT thick chunky western-cartoon outlines, NOT flat watercolor, NOT photoreal. ' +
  'CRITICAL FRAMING: the ENTIRE effect must sit fully inside the frame, centered, at roughly 70% scale, ' +
  'with a generous EMPTY TRANSPARENT MARGIN on all four sides — nothing may touch, run off, or be cropped ' +
  'at the canvas edges. Must read clearly at small in-game size. ';`;
src = src.replace(pOld[0], pNew);

// 2) lava pair added to the VFX table
const vAnchor = `  dash_streak:      'a horizontal SPEED-DASH motion streak firing LEFT-TO-RIGHT: sharp white-to-violet motion-blur lines and a sweeping afterimage swoosh that tapers to a point on the right, strong sense of fast lunging movement.',`;
const c = src.split(vAnchor).length - 1;
if (c !== 1) { console.error('VFX anchor FAIL: ' + c); process.exit(2); }
src = src.replace(vAnchor, vAnchor + `
  // v0.26.897 — lava pair folded in from gen_lava.mjs so one script owns Sprites/vfx/
  lava_drop:        'a falling MOLTEN LAVA droplet: a glossy teardrop blob of bright orange-gold magma with a white-hot core, small trailing splatter beads above it, dripping downward, glowing hot.',
  lava_pool:        'a bubbling MOLTEN LAVA pool seen TOP-DOWN: a circular flat disc of bright orange-gold magma with a white-hot swirling centre, thin darker crust flecks at the rim, small rising glossy lava bubbles, glowing hot.',`);

if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: prompts rewritten + lava pair added.');
