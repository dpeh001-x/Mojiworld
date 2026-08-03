import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span> 🜂 Transcendence — reforge ★10 gear beyond the cap</span></h2>
<p>New endgame enhancement system, living inside the enhancement UI itself. When a piece reaches <strong>★10</strong>, its maxed preview panel now offers <strong>🜂 Transcendence</strong>: the item restarts at <strong>★0</strong> but bakes <strong>50% of its current ★10 stat totals into its BASE stats</strong> (base &times; 1.08<sup>10</sup> &times; 0.5 &asymp; base &times;1.079). Forged back to ★10 it peaks at <strong>~+133% over the original base</strong> — beyond the old +116% cap. Strictly <strong>once per equipment</strong> (a 🜂 badge marks transcended gear in the enhance grid; a fully re-forged 🜂★10 piece shows a &ldquo;final form&rdquo; notice). Cost: <strong>800◈ setshards</strong> — the pinnacle spend above Heirloom Transfer (500◈), with a full confirm dialog explaining the math before any shards move.</p>
<p>Implementation mirrors <code>getEquipBonus</code>&rsquo;s scaling rules exactly: every star-scaled numeric stat is baked (including affix-written stats); discrete count flags (<code>multishot</code>/<code>burn</code>/<code>extraJumps</code> — never star-scaled) and meta fields (price/tier/rarity/dropLevel) are untouched. Shards deduct before mutation, state re-validates after the confirm await, and the gear cache + save refresh on completion. Verified live end-to-end: panel renders with cost, transcend bakes &times;1.0795 exactly (ATK 100 &rarr; 107.95), ★ resets, 800◈ deducted, second transcend blocked, item re-enhances from ★0, badges render. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
