import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');

// next version = max existing + 1
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;

const anchor = `<h2>v0.26.811 `;   // current top entry
if (src.split(anchor).length - 1 !== 1) { console.error('anchor not unique'); process.exit(2); }

const entry = `<h2>${next} <span class="tag"><span class="pill bug">bug</span> Removed every procedural-circle fallback from boss/monster projectiles</span></h2>
<p>Per user, bosses no longer ever render as plain <em>circles</em> when attacking. Audit found that every boss/monster projectile sprite (60+ <code>LX_MOB_PROJ</code> keys, the 4 <code>LX_FX</code> beam/shard assets, and all <code>_PROJ_SPRITE_BLIT</code> entries) <strong>already exists on disk and decodes</strong> &mdash; so nothing needed generating. The circles were purely <strong>pre-decode fallbacks</strong>: <code>ctx.arc()</code> blobs drawn for the brief window before a sprite finished decoding (most visible on a boss&rsquo;s very first volley in a fresh session). Deleted the procedural-circle <code>else</code> blocks from <code>mspore</code> (orange cluster), <code>mdark</code> (purple bolt), <code>mtoxic</code> (green blob), <code>firebomb</code> (Koopa&rsquo;s orange ball), and <code>shard</code> (glow arc + diamond). Also fixed the shared <code>_PROJ_SPRITE_BLIT</code> blit branch so themed boss projectiles (<code>spore</code>, <code>bubble</code>, <code>comet</code>, <code>deathOrb</code>, <code>octoHead</code>, <code>zodiac</code>, <code>taurus_boulder</code>, <code>cancerBubble</code>, &hellip;) no longer fall through to the generic default-ellipse circle while decoding &mdash; they now blit the sprite as soon as it is ready and draw nothing before that. Net effect: a projectile that isn&rsquo;t decoded yet is invisible for a frame instead of flashing a circle. Verified post-reload: all affected sprites <code>ready</code>, blit-guard live in <code>drawProjectiles</code>, firebomb arc gone, no console errors. <code>node --check</code> clean.</p>

`;

src = src.replace(anchor, entry + anchor);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
