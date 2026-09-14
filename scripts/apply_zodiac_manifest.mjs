// Re-measure one entity's frame boxes for the animator manifest.
// ============================================================================
//   node scripts/apply_zodiac_manifest.mjs <manifestKey> <spriteName> <states...>
//   node scripts/apply_zodiac_manifest.mjs zodiac_cancer cancer idle walk attack
//
// The general form of scripts/apply_aquarius_manifest.mjs, which did exactly
// this for one entity and one state. Cancer needed all three states, and a
// second copy of the same logic was the wrong answer.
//
// WHAT THIS IS FOR. data/anim_calib_manifest.js records the alpha content box
// of EVERY frame, and monster_animator.html uses them to seat a preview on the
// floor line. New art moves those boxes, so the entry describing it is stale
// until re-measured. The game itself never reads this file — a stale box is a
// wrong PREVIEW, not a wrong fight.
//
// WHY NOT JUST RE-RUN scripts/gen_anim_manifest.mjs. It rebuilds all 159
// entities from whatever the local Sprites tree holds, and a working copy is
// not a mirror of origin — when this was first needed, origin already carried a
// newer kingKrook, so a full rebuild would have quietly shipped older Krook
// boxes over someone else's work. Measure only what changed, write only that,
// and PROVE the rest is untouched by deep-comparing every other entity.
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
const [KEY, SPRITE, ...STATES] = process.argv.slice(2);
if (!KEY || !SPRITE || !STATES.length) {
  console.error('usage: apply_zodiac_manifest.mjs <manifestKey> <spriteName> <state...>');
  process.exit(1);
}

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
if (!M || !M[KEY] || !M[KEY].states) { console.error(`ABORT: ${KEY} not in the manifest`); process.exit(1); }

// snapshot everything that must NOT move
const others = {};
for (const k of Object.keys(M)) if (k !== KEY) others[k] = JSON.stringify(M[k]);
const siblingStates = {};
for (const s of Object.keys(M[KEY].states)) if (!STATES.includes(s)) siblingStates[s] = JSON.stringify(M[KEY].states[s]);

let changed = 0;
const report = [];
for (const STATE of STATES) {
  const st = M[KEY].states[STATE];
  if (!st) { console.error(`ABORT: ${KEY}.${STATE} not in the manifest`); process.exit(1); }
  const n = st.count | 0;
  if (n < 1) { console.error(`ABORT: ${KEY}.${STATE} has count ${n}`); process.exit(1); }
  const boxes = [];
  for (let i = 0; i < n; i++) {
    const fp = path.join(ROOT, 'Sprites', 'bosses', 'zodiac', STATE, `${SPRITE}_${i}.webp`);
    const b = await frameBox(fp);
    if (!b) { console.error(`ABORT: could not measure ${fp}`); process.exit(1); }
    boxes.push(b);
  }
  // The manifest generator flags a state whose boxes are all identical as
  // degenerate; refuse to write one here for the same reason.
  if (boxes.length > 1 && boxes.every((b) => JSON.stringify(b) === JSON.stringify(boxes[0]))) {
    console.error(`ABORT: all ${boxes.length} boxes of ${KEY}.${STATE} are identical - that loop is not moving`);
    process.exit(1);
  }
  if (JSON.stringify(st.cb) === JSON.stringify(boxes)) { report.push(`${STATE}: already current`); continue; }
  st.cb = boxes;
  const meta = await sharp(path.join(ROOT, 'Sprites', 'bosses', 'zodiac', STATE, `${SPRITE}_0.webp`)).metadata();
  st.w = meta.width; st.h = meta.height;
  changed++;
  report.push(`${STATE}: re-measured ${boxes.length} frames`);
}

if (!changed) { console.log(`already applied (${report.join('; ')})`); process.exit(0); }

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
const out = src.slice(0, src.indexOf('window.LX_ANIM_MANIFEST = '))
  + 'window.LX_ANIM_MANIFEST = ' + JSON.stringify(M, null, 0) + ';\n'
  + 'window.LX_ANIM_MANIFEST_STAMP = "' + stamp + '";\n';

// re-parse and prove ONLY the named states of the named entity changed
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

await writeFile(MF + '.tmp', out, 'utf8');
await rename(MF + '.tmp', MF);
console.log(`applied: ${KEY} — ${report.join('; ')}; ${Object.keys(others).length} other entities byte-identical`);
