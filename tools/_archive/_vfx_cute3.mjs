// Update lava_drop / quake_ring / lightning_pillar prompts in the master
// generator: explicit ~3px solid BLACK outline + a touch of cute (plump
// rounded shapes, glossy bubbly highlights, sparkle accents — no faces, the
// hazards still need to read as danger).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../scripts/generate_mob_vfx.mjs', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  { old: `  lightning_pillar: 'a vertical ELECTRIC LIGHTNING PILLAR striking downward: a jagged white-blue bolt inside a glowing yellow energy column with crackling forked arcs and bright sparks, tall and narrow.',`,
    neu: `  lightning_pillar: 'a CUTE vertical ELECTRIC LIGHTNING PILLAR striking downward: a chunky rounded white-blue cartoon bolt with plump zig-zag segments inside a soft glowing golden energy column, a few chubby little forked arcs and tiny star sparkles around it, tall and narrow. Every shape wrapped in a THICK even ~3px solid BLACK outline. Playful kawaii energy, rounded corners, glossy bubbly highlights — still clearly a danger zone, NO face.',` },
  { old: `  quake_ring:       'an expanding GROUND-QUAKE shockwave seen TOP-DOWN: concentric cracked-earth rings with rising dust and tumbling rubble, a warm orange-tan seismic glow, mostly EMPTY in the centre (a ring, not a disc).',`,
    neu: `  quake_ring:       'a CUTE expanding GROUND-QUAKE shockwave ring seen TOP-DOWN: a plump rounded ring of warm tan cracked-earth chunks and chubby tumbling pebbles with puffy little dust clouds, a soft orange seismic glow, mostly EMPTY in the centre (a ring, not a disc). Every chunk and puff wrapped in a THICK even ~3px solid BLACK outline. Playful kawaii energy, rounded cartoon rocks, glossy highlights — still clearly a danger zone, NO face.',` },
  { old: `  lava_drop:        'a falling MOLTEN LAVA droplet: a glossy teardrop blob of bright orange-gold magma with a white-hot core, small trailing splatter beads above it, dripping downward, glowing hot.',`,
    neu: `  lava_drop:        'a CUTE falling MOLTEN LAVA droplet: one plump glossy teardrop blob of bright orange-gold magma with a white-hot squishy core, two or three chubby little splatter beads trailing above it, dripping downward with a warm glow. Every blob wrapped in a THICK even ~3px solid BLACK outline. Playful kawaii energy, round squishy shapes, big glossy highlights — still clearly hot and dangerous, NO face.',` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' prompts updated.');
