import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const anchor = m[0];
if (src.split(anchor).length - 1 !== 1) { console.error('anchor not unique'); process.exit(3); }

const entry = `<h2>${next} <span class="tag"><span class="pill bug">bug</span> Void-entry eye-zoom now centres on Guguma&rsquo;s eyes</span></h2>
<p>Per user, the cinematic zoom-into-Guguma on Void entry settled slightly <em>below and to the right</em> of his face instead of on the two black-dot eyes. Measured the eye midpoint straight from <code>Guguma.webp</code> pixels (isolating the dark dots inside the yellow face, flanked-by-yellow test to exclude the body outline): <strong>~64.5% / 47.8%</strong> of the sprite box. The old <code>transform-origin: 50% 33%</code> framed the forehead, so at the 6.5&times; end scale the eyes drifted low-right. Because a CSS <code>transform-origin</code> stays screen-fixed at finite scale, solved <code>origin = (0.5 &minus; s&middot;f)/(1 &minus; s)</code> per axis (s = 6.5) to land the eyes dead-centre &rarr; <strong><code>67% / 47%</code></strong>. Verified live: computed origin resolves to (0.671, 0.47) and the eye-midpoint lands within ~1&nbsp;px horizontally / ~7&nbsp;px vertically of frame centre. <code>node --check</code> clean.</p>

`;
src = src.replace(anchor, entry + anchor);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
