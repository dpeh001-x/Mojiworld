import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> ⚒ Enhancement Forge redesign — the anvil takes centre-stage</span></h2>
<p>Brok&rsquo;s Enhancement UI rebuilt around a <strong>dedicated Forge Stage</strong>. The anvil — previously a decorative corner sprite hidden <em>behind</em> the content — now sits centre-stage in its own ember-lit chamber (radial forge-glow floor, vignette walls). The <strong>selected item floats above the anvil</strong> with a gentle bob and warm glow, and the <strong>success/fail Ludo animation now plays right there</strong> — large (224px), anchored to the stage floor over the anvil, exactly where the player&rsquo;s eye is already parked — instead of flashing over the modal title. The spark-burst ring is re-centred on the anvil too; the strike animation, fail-flash, and celebration overlay all carry over.</p>
<p><strong>Sleeker everything else:</strong> two-column layout — <em>gear rack</em> (left, scrollable tile grid in its own inset panel) &middot; <em>stage + stat preview</em> (right, preview scrolls independently below the stage). The bulky 8-line &ldquo;How forging works&rdquo; block is condensed into a one-line info strip under the title (🪙 balance &middot; ★0-5 safe &middot; ★5-8 may drop ★ &middot; ★8-10 dangerous &middot; each ★ = ×1.08) — the per-item success %, risk badge, and stat deltas were already in the preview card, so nothing is lost. An empty stage shows &ldquo;Pick gear from the rack — Brok will set it on the anvil.&rdquo; Transcendence panel, journal logic, and all forge math untouched.</p>
<p>Verified live end-to-end: stage/anvil/fx/sparks all parented to the stage, anvil centred on the stage floor, selected item floats directly above it, hint toggles with selection, preview + forge button render in the right column, the success anim shows centre-stage with the anvil strike, and the fail anim shows with the red fail-flash. Fx centring measured at 0.0px delta from stage centre. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
