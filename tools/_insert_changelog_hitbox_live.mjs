import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> Animator hitbox overlay now tracks the live mob plant-scale</span></h2>
<p>Follow-up to the v0.26.866 hitbox toggle: for monsters, the overlay&rsquo;s size multiplier is now computed <strong>live</strong> (1.5 &times; current plant-scale) instead of from the baked snapshot. It mirrors the game&rsquo;s exact <code>_lxMobScale</code> merge — localStorage <code>lx_mob_scale</code> (the R-key Monster Plant editor) over baked <code>mob_offsets.js</code> (<code>LX_MOB_SCALE_DATA</code>, now loaded by the animator page) over 1, clamped [0.3,&nbsp;4] — with the same cache pattern: invalidated by the cross-tab <code>storage</code> event (edit a scale in the game tab, the animator&rsquo;s hitbox updates live) and on entity-select / hitbox-toggle for same-tab edits. When a type&rsquo;s scale &ne; 1 the label appends <code>&middot; scale N</code> so you can see why the box differs. Bosses keep the snapshot mul (<code>BOSS_DRAW_SCALE</code> has no localStorage channel). Also self-heals the snapshot-drift class of bug (a stale baked <code>mul</code> no longer matters for monsters).</p>
<p>Verified live on the slime: baked baseline (scale 1.48) rect strokes at the exact expected geometry; a <code>lx_mob_scale</code> override of 3 shrinks the box to the exact computed 53&times;65&nbsp;px at top-y&nbsp;533 (full-region pixel-bounds scan — an earlier single-line probe &ldquo;failure&rdquo; was just landing in a dash gap); removing the override restores the baseline exactly. <code>node --check</code> clean; game file untouched.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
