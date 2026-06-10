import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill bug">bug</span> Transcendence hardening — agent test pass (10/10) + 2 audit fixes</span></h2>
<p>Ran the new 🜂 Transcendence system through a two-agent verification: a live tester drove the full lifecycle in-game (happy path with exact stat assertions, cancel path, insufficient shards, sub-★10 rejection, double-transcend block, re-enhancement, equipped <code>getEquipBonus</code> effective stats, save/load round-trip incl. a mid-test reload, UI badges, console-error sweep — <strong>10/10 PASS</strong>), while a static auditor traced every integration seam (reforge, heirloom transfer, save serialization, item-cloning paths, stat displays, achievements, UI wiring). No exploits found — the once-per-item flag survives reforge cloning, heirloom is capped at ★10, and saves round-trip the bake intact.</p>
<p>Two audit findings fixed: <strong>(1)</strong> Reforging a transcended item would have <em>irreversibly incinerated the 800◈ bake</em> — the Reforge Bench strips every affix-capable stat key (a pre-existing quirk), and since the transcended flag survives, the item could never re-bake. 🜂 gear is now <strong>reforge-ineligible</strong>, stated in the reforge confirm dialog: its reborn base stats are permanent. <strong>(2)</strong> The bake's 2-decimal rounding silently zeroed the premium on small percent stats (lifesteal 0.03 &times; 1.0795 rounded straight back to 0.03) — fractional stats now bake at 4&nbsp;decimals (0.03 &rarr; 0.0324). Verified live: lifesteal retains its premium, and a transcended affixed Lv60 weapon reports &ldquo;none equipped right now&rdquo; to the Reforge Bench. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
