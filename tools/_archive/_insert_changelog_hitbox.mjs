import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span> Monster Animator — gameplay-hitbox overlay toggle</span></h2>
<p>The boss/monster editor (<code>monster_animator.html</code>) gains a <strong>hitbox</strong> checkbox in the top bar: when on, every state column (idle / walk / attack) draws the entity&rsquo;s <strong>actual gameplay hitbox</strong> as a dashed lime rectangle with a translucent fill and a <code>hitbox w&times;h</code> label (plus a <em>flies</em> tag for lifted mobs) — foot-anchored at the sprite&rsquo;s ground line exactly as in-game. The box uses the game&rsquo;s real math (<code>hbH = DISPLAY_H / (mul &times; sizeFactor)</code>, where mul = 1.5&times;mobScale for monsters / <code>BOSS_DRAW_SCALE</code> for bosses) and deliberately does <strong>NOT</strong> follow the s/dx/dy calibration nudges — the in-game hitbox never moves, so watching the sprite drift against the fixed box is the whole point when calibrating.</p>
<p>Backing data: new <code>monster_hitboxes.js</code> (<code>window.LX_MOB_HITBOX</code>, 121 entries) extracted from the <em>running game&rsquo;s</em> <code>monsterTypes</code> + <code>_lxMobScale</code> + <code>BOSS_DRAW_SCALE</code> (no fragile source parsing); phase-sprite bosses (aetherion2, gravitos2/3/&hellip;) inherit their base entity&rsquo;s box, matching how the game treats them. Verified by an automated 121/121 diff against the live game (one stale value caught &amp; fixed), then pixel-probed on canvas: slime (monster path) and Koopa King (boss path) rects stroke at the exact computed geometry, and the toggle clears them — confirmed with an exact-colour match after the loose first probe false-positived on Koopa&rsquo;s own green shell. <code>node --check</code> clean on all three edited tool files; game file untouched.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
