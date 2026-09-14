// Re-measure Aquarius' idle frame boxes for the animator manifest.
// ============================================================================
// data/anim_calib_manifest.js records, per entity and state, the alpha content
// box of EVERY frame — monster_animator.html uses them to seat a preview on the
// floor line. Regenerating her idle art moves those boxes, so the entry that
// describes it is stale until it is re-measured. (The game itself never reads
// this file; it is the animator tool's index. So a stale box is a wrong
// PREVIEW, not a wrong fight — worth fixing, not worth panicking over.)
//
// WHY NOT JUST RE-RUN scripts/gen_anim_manifest.mjs. Because it rebuilds all
// 159 entities from whatever the local Sprites tree happens to hold, and this
// working copy is NOT a mirror of origin: origin's manifest already carries a
// newer kingKrook (someone regenerated it while this was in flight). A full
// rebuild here would quietly ship my older Krook boxes over theirs — the exact
// clobber the guarded pipeline exists to prevent. So: measure only the nine
// frames that actually changed, write only that one array, and PROVE nothing
// else moved by deep-comparing every other entity before and after.
//
// frameBox is a verbatim copy of gen_anim_manifest.mjs's, so the numbers are
// the ones a full rebuild would have produced.
import sharp from 'sharp';
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MF = process.env.LX_MANIFEST_FILE || path.join(ROOT, 'data', 'anim_calib_manifest.js');
const KEY = 'zodiac_aquarius', STATE = 'idle';

// verbatim from scripts/gen_anim_manifest.mjs — content box (alpha > 16) and
// solid box (alpha > 235), as [cT, cB, bT, bB]
async function frameBox(p) {
  try {
    const { data, info } = await sharp(await readFile(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, C = info.channels;
    let cT = -1, cB = -1, bT = -1, bB = -1;
    for (let y = 0; y < H; y++) {
      let any = false, solid = false;
      for (let x = 0; x < W; x++) {
        const a = data[(y * W + x) * C + 3];
        if (a > 16) { any = true; if (a > 235) { solid = true; break; } }
      }
      if (any) { if (cT < 0) cT = y; cB = y; }
      if (solid) { if (bT < 0) bT = y; bB = y; }
    }
    return cT < 0 ? null : [cT, cB, bT, bB];
  } catch { return null; }
}

const src = await readFile(MF, 'utf8');
const before = {};
// eslint-disable-next-line no-new-func
new Function('window', src)(before);
const M = before.LX_ANIM_MANIFEST;
if (!M || !M[KEY] || !M[KEY].states || !M[KEY].states[STATE]) { console.error(`ABORT: ${KEY}.${STATE} not in the manifest`); process.exit(1); }
const st = M[KEY].states[STATE];
const n = st.count | 0;
if (n !== 9) { console.error(`ABORT: expected 9 idle frames, manifest says ${n}`); process.exit(1); }

const boxes = [];
for (let i = 0; i < n; i++) {
  const fp = path.join(ROOT, 'Sprites', 'bosses', 'zodiac', STATE, `aquarius_${i}.webp`);
  const b = await frameBox(fp);
  if (!b) { console.error(`ABORT: could not measure ${fp}`); process.exit(1); }
  boxes.push(b);
}
// A loop whose nine boxes are all identical means the art never moves - the
// manifest generator flags that case, so refuse to write it here too.
if (boxes.every((b) => JSON.stringify(b) === JSON.stringify(boxes[0]))) { console.error('ABORT: all nine boxes identical - the loop is not moving'); process.exit(1); }

if (JSON.stringify(st.cb) === JSON.stringify(boxes)) { console.log('already applied (boxes already match the art)'); process.exit(0); }
const old = JSON.stringify(st.cb);

// snapshot every OTHER entity so the write can be proved harmless
const others = {};
for (const k of Object.keys(M)) if (k !== KEY) others[k] = JSON.stringify(M[k]);
const siblingStates = {};
for (const s of Object.keys(M[KEY].states)) if (s !== STATE) siblingStates[s] = JSON.stringify(M[KEY].states[s]);

st.cb = boxes;
const meta = await sharp(path.join(ROOT, 'Sprites', 'bosses', 'zodiac', STATE, 'aquarius_0.webp')).metadata();
st.w = meta.width; st.h = meta.height;

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
const out = src.slice(0, src.indexOf('window.LX_ANIM_MANIFEST = '))
  + 'window.LX_ANIM_MANIFEST = ' + JSON.stringify(M, null, 0) + ';\n'
  + 'window.LX_ANIM_MANIFEST_STAMP = "' + stamp + '";\n';

// re-parse and prove ONLY aquarius.idle changed
const after = {};
// eslint-disable-next-line no-new-func
new Function('window', out)(after);
const M2 = after.LX_ANIM_MANIFEST;
if (Object.keys(M2).length !== Object.keys(M).length) { console.error('ABORT: entity count moved'); process.exit(1); }
for (const k of Object.keys(others)) {
  if (JSON.stringify(M2[k]) !== others[k]) { console.error(`ABORT: ${k} changed and must not have`); process.exit(1); }
}
for (const s of Object.keys(siblingStates)) {
  if (JSON.stringify(M2[KEY].states[s]) !== siblingStates[s]) { console.error(`ABORT: ${KEY}.${s} changed and must not have`); process.exit(1); }
}
if (JSON.stringify(M2[KEY].states[STATE].cb) !== JSON.stringify(boxes)) { console.error('ABORT: the new boxes did not take'); process.exit(1); }

await writeFile(MF + '.tmp', out, 'utf8');
await rename(MF + '.tmp', MF);
console.log(`applied: ${KEY}.${STATE} re-measured, ${Object.keys(others).length} other entities byte-identical`);
console.log(`  was ${old.slice(0, 70)}...`);
console.log(`  now ${JSON.stringify(boxes).slice(0, 70)}...`);
