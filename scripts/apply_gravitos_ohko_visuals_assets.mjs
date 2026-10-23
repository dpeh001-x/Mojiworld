// gravitos-ohko-visuals, the assets half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA files are re-synced from origin).
// Thirteen NEW sprites for Gravitos's two collapses (ludo.ai, per user: "make a unique sprite for it using ludo.ai"), all in Sprites/fx:
//   Collapse Rain - grav_rain_meteor (a comet: white-hot head, cyan-violet tail), grav_rain_rift (the tear in the sky), grav_rain_aurora
//   (the curtain behind it), grav_rain_impact (a crystal burst), grav_rain_shelter (the crystal portal a shelter is drawn as),
//   grav_rain_dial (the counter's slim crystal halo), grav_rain_icon (the crystal shield in a shelter);
//   the Singularity - grav_sing_core (the black hole), grav_sing_lens (the lensing ring), grav_sing_wave (a shockwave ring),
//   grav_sing_dial (the Roman-numeral clock face), grav_sing_debris (the debris spiral), grav_sing_burst (the collapse flash).
// Each was trimmed and seated on a transparent canvas with a clear margin (border alpha 0 on every side, measured).
// Table rows, each rebuilt on top of origin's copy (the pipeline re-syncs them first): data/assets_manifest.json (+13 paths, sorted)
// and data/sprite_edges.js (+13 rows, "" = no cut edge). sw.js CACHE +1, relative to whatever origin holds (new filenames need no
// eviction; the bump just starts a clean generation with the art in it).
// GUARDED: the new files must be the reviewed ones (sha256); everything is checked before anything is written. Idempotent.
// LX_ASSET_ROOT points it at a mirror of the repo; LX_GOV_ART_SRC at the folder holding the new files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_GOV_ART_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/rainart/final';
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
  ['fx/grav_rain_aurora.webp', '22b33bea09b8ee945bad99d72d8d3c4a78ba5c6a9a7697b1f12a2f1668978b74'],
  ['fx/grav_rain_dial.webp', '53beca49f121705960ab2f32e12f1492970f2b950ec706c1c33b2b0fa6f0b87a'],
  ['fx/grav_rain_icon.webp', 'd0590ef704d9c8a781e88328602c7a3f775777f1634a7b9999039739d47e1883'],
  ['fx/grav_rain_impact.webp', '6850e2a75d444c6d3841811c41c2e4e6fa957e29e080b770f3b02629dd586501'],
  ['fx/grav_rain_meteor.webp', '0249d300b0ebd0e8519e8be3dba42b925ea445896318639e80e5f95d39eeaa61'],
  ['fx/grav_rain_rift.webp', 'a6f217c139eeecf63257aa3992c839cc0317a12e19cd394c2b37a11d41d4e4ac'],
  ['fx/grav_rain_shelter.webp', 'a30a1671748920d75d1d2b47184220f58306cf9bf1a3132ec1e798ecd5351c55'],
  ['fx/grav_sing_burst.webp', 'fbd94bfbee5a9867725f8e2c724d34ed098b601116c8fd18c1e55e075f541879'],
  ['fx/grav_sing_core.webp', '42e8eb26f5ae20b30e878143eec5e1f77fdbb0974b4f6450bc4d31c35565f851'],
  ['fx/grav_sing_debris.webp', '862a9e2456414ebfade9603cde64eabdb2f9d4a52e1995db1530171812088903'],
  ['fx/grav_sing_dial.webp', 'f1e344adf2630d363d774bf6de9391f63d4b02b7917e6a46e846da584932ceaf'],
  ['fx/grav_sing_lens.webp', 'a1bd0bd8e368afdc4ccd23b89b6c9c64d95060d482e9656b8263a44130826e55'],
  ['fx/grav_sing_wave.webp', '9a12c5a2204a86caa84f8d11571e1db27dddfc6c473dc29c79247f2fdf00d48e'],
];
const MARK = 'gravitos-ohko-visuals';
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
for (const [f] of ART) { if (!(f in edges)) { edges[f] = ''; edAdd++; } }
if (edAdd) {
  const sorted = {}; for (const k of Object.keys(edges).sort()) sorted[k] = edges[k];
  atomic(edF, ed.slice(0, ej) + JSON.stringify(sorted) + ed.slice(ee + 1));
}
let swNote = 'kept';
if (!sw.includes(MARK)) {
  const n = +sw.match(swRe)[1];
  const out = sw.replace(swRe, () => "const CACHE = 'mojiworld-assets-v" + (n + 1) + "';   // " + MARK + ": thirteen new sprites for Gravitos's collapses (grav_rain_*, grav_sing_*). v" + n + ' was: ');
  atomic(swF, out);
  swNote = 'v' + n + ' -> v' + (n + 1);
}
console.log('assets: ' + art.filter(Boolean).length + ' new sprites, manifest +' + manAdd + ', sprite_edges +' + edAdd + ', sw.js ' + swNote);
