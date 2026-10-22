// hazard-themed-art, the assets half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA files are re-synced from origin).
// Five NEW sprites for the themed ceiling hazards (ludo.ai, per user: "use ludo.ai to generate if required"): the falling looks
// Sprites/projectiles/p_hz_{skull,ribbone,bonechunk,ember}.webp (trimmed, seated on a transparent 512 square at 88%) and the bone ground rune Sprites/fx/meteor_marker_bone.webp: a FLAT
// decal (per user: less 3D, the floors are flat) in the fiery rune's own canvas, 1088x512, at its full width x 5-1079 and centred on
// its centre line (y 184-403), so it draws in the same place and width, as a shallower oval.
// Table rows, each rebuilt on top of origin's copy (the pipeline re-syncs them first): data/assets_manifest.json (+5 paths, sorted)
// and data/sprite_edges.js (+5 rows, "" = no cut edge: every sprite has a fully transparent margin). sw.js CACHE +1, relative to
// whatever origin holds (new filenames need no eviction; the bump just starts a clean generation with the art in it).
// GUARDED: the new files must be the reviewed ones (sha256); everything is checked before anything is written. Idempotent.
// LX_ASSET_ROOT points it at a mirror of the repo; LX_HZART_SRC at the folder holding the new files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_HZART_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/hazart/final';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const atomic = (f, data) => {
  fs.writeFileSync(f + '.tmp', data);
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { fs.renameSync(f + '.tmp', f); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing on ' + f + ': ' + lastErr.code);
};
// [path under Sprites/, sha256] - the reviewed files
const ART = [
  ['projectiles/p_hz_skull.webp', '47cc0664d748a145330989789074090c25c19589bd9a11b335cc0f9b9803f7ae'],
  ['fx/meteor_marker_bone.webp', '7dac1748ff91f3cb7d0facd8066c0d18ee3692534ce77f2286c31f29b6b9aa17'],
  ['projectiles/p_hz_ribbone.webp', 'd395b9caaf430e0f394ad8ec465f34015a6c55a4be0cf262f094f911f33ea59f'],
  ['projectiles/p_hz_bonechunk.webp', '7bbd82879fccea72a62d207f728dcaa09eb8f16cf6d84f8589e07e1d4d8d8197'],
  ['projectiles/p_hz_ember.webp', '57924ed13ce451817687853c76fbc85f5a15d61e618b3ea9ff420ac0a7601065'],
];
const MARK = 'hazard-themed-art';
const P = (r) => path.join(ROOT, r);

// ---- check everything first ----
const art = [];
for (const [f, h] of ART) {
  const dst = P('Sprites/' + f);
  if (fs.existsSync(dst)) { if (sha(fs.readFileSync(dst)) !== h) die(dst + ' exists and is not the reviewed file'); art.push(null); continue; }
  const b = fs.readFileSync(path.join(SRC, path.basename(f)));
  if (sha(b) !== h) die(f + ' in ' + SRC + ' is not the reviewed file');
  art.push([dst, b]);
}
const manF = P('data/assets_manifest.json');
const man = JSON.parse(fs.readFileSync(manF, 'utf8'));
if (!Array.isArray(man) || man.length < 5000) die('manifest shape');
const edF = P('data/sprite_edges.js');
const ed = fs.readFileSync(edF, 'utf8');
const EH = 'window.LX_SPRITE_EDGES = ';
const ei = ed.indexOf(EH), ej = ed.indexOf('{', ei), ee = ed.lastIndexOf('}');
if (ei < 0 || ej < 0 || ee < ej || ed.slice(ee + 1).replace(/\r/g, '') !== ';\n') die('sprite_edges shape');
const edges = JSON.parse(ed.slice(ej, ee + 1));
if (Object.keys(edges).length < 5000) die('sprite_edges too small');
const swF = P('sw.js');
const sw = fs.readFileSync(swF, 'utf8');
const swRe = /const CACHE = 'mojiworld-assets-v(\d+)';   \/\/ /;
const swHits = sw.split(/const CACHE = 'mojiworld-assets-v\d+';/).length - 1;
if (swHits !== 1 || !swRe.test(sw)) die('sw.js CACHE line matched ' + swHits);

// ---- write ----
for (const a of art) if (a) atomic(a[0], a[1]);
let manAdd = 0;
for (const [f] of ART) { const r = 'Sprites/' + f; if (!man.includes(r)) { man.push(r); manAdd++; } }
if (manAdd) { man.sort(); atomic(manF, JSON.stringify(man)); }
let edAdd = 0;
for (const [f] of ART) { const k = f; if (!(k in edges)) { edges[k] = ''; edAdd++; } }
if (edAdd) {
  const sorted = {}; for (const k of Object.keys(edges).sort()) sorted[k] = edges[k];
  atomic(edF, ed.slice(0, ej) + JSON.stringify(sorted) + ed.slice(ee + 1));
}
let swNote = 'kept';
if (!sw.includes(MARK)) {
  const n = +sw.match(swRe)[1];
  const out = sw.replace(swRe, () => "const CACHE = 'mojiworld-assets-v" + (n + 1) + "';   // " + MARK + ': five new themed ceiling-hazard sprites (p_hz_*, meteor_marker_bone). v' + n + ' was: ');
  atomic(swF, out);
  swNote = 'v' + n + ' -> v' + (n + 1);
}
console.log('assets: ' + art.filter(Boolean).length + ' new sprites, manifest +' + manAdd + ', sprite_edges +' + edAdd + ', sw.js ' + swNote);
