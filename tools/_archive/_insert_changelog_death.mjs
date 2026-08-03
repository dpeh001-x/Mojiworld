import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;

// insert above the current top h2 (whatever it is now)
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const anchor = m[0];
if (src.split(anchor).length - 1 !== 1) { console.error('anchor not unique'); process.exit(3); }

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> Death screen: opaque-black panel, simpler look, cute R.I.P tombstone</span></h2>
<p>Per user, reworked the death overlay. The backdrop is now a <strong>near-solid opaque black</strong> (<code>rgba(22,18,30,0.97)</code> &rarr; <code>rgba(0,0,0,0.99)</code> radial) instead of the old translucent pink/purple wash, so the world behind is fully obscured. Simplified the aesthetics: removed the eight floating <code>✦✧★</code> sparkles entirely, and flattened the gradient-clipped &ldquo;oops!&rdquo; title to a clean solid soft-lilac. The crying <code>🥺</code> emoji is replaced by a <strong>ludo.ai-generated cute chibi tombstone</strong> with &ldquo;R.I.P&rdquo; engraved on the stone and a tiny flower at the base (<code>Sprites/ui/death_tombstone.png</code>, transparent PNG, rendered at 132&times;132 with a gentle bob). Respawn button, loss readout, and tap-to-return behaviour are unchanged. Verified live: overlay shows, tombstone decodes, sparkles gone. <code>node --check</code> clean.</p>

`;
src = src.replace(anchor, entry + anchor);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
