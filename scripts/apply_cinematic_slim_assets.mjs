// cinematic-slim, the assets half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA clips are re-synced from origin).
// ==== THE SWITCH (scripts/cinematic_slim_test.mjs and scripts/apply_cinematic_slim.mjs read these two lines) ====
//   SKIP_C2PA = false : replace all ten clips; the six in C2PA_CLIPS lose their C2PA manifest (per user, 2026-09-27).
//   SKIP_C2PA = true  : replace only the four clips with no C2PA manifest; the six keep their original bytes.
const SKIP_C2PA = false;
const C2PA_CLIPS = ['clip_prologue_punch', 'clip_gravitos_s1', 'clip_amnesiac_s1', 'clip_forge_s1', 'clip_100640', 'clip_093232'];
// ================================================================================================================
// steam/higgsfield/cinematics/<clip>.mp4 <- the re-encoded copy in LX_CINE_SRC (default fa_reports/cine_out).
// The ten biggest clips the game plays (100.4 MiB together, 6-16 MB each, both prologue clips every new player sees
// among them) were re-encoded: H.264 High / yuv420p, libx264 veryslow, CRF 19-26 picked per clip as the highest one
// whose SSIM vs the original is >= 0.985; same resolution, fps, frame count and duration; the AAC audio stream-copied
// untouched; +faststart (8 of the 10 had their index at the END of the file, so a browser had to fetch the tail before
// the first frame). All ten: 22.5 MiB together, every clip 43-92% smaller.
// C2PA: the six in C2PA_CLIPS carry a C2PA manifest (uuid box; c2pa.created by BytePlus_ModelArk, digitalSourceType
// trainedAlgorithmicMedia). Its hash binding cannot survive a re-encode, so a replaced clip carries none.
// GUARDED: each replaced repo file must hold EITHER the original bytes (then it is replaced) OR the new bytes (already
// applied). Anything else means someone changed that clip on origin after the re-encode - abort (before writing
// anything) rather than put a re-encode of the OLD clip over their new one. Every copy is re-verified by size + sha256.
// No sw.js bump: .mp4 is not in sw.js's ASSET_RE, so the service worker never holds these clips.
// Idempotent. LX_ASSET_ROOT points it at a mirror of the repo (for testing without touching the working copy).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_CINE_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/cine_out';
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

// [clip, original bytes, original sha256, new bytes, new sha256]
const CLIPS = [
  ['clip_prologue_pov', 10930646, '743dd759696471fa97c9549745777032883f831c0259108b9424da1a2be70ae2', 3252565, '9cd294085375dca95f8efd8193e88cc5524432bb1f0586d01312b493695f0ada'],
  ['clip_prologue_punch', 10632244, 'f6904dd08e5e0449d7eb77ddfda0ba190e61d5894d44ce9c20b16b91dbfaf229', 2787067, '768f215fcb30376db9aa96c53154a11edde6113df5634e36eec09e991bd01265'],
  ['clip_gravitos_s1', 16656262, '03f96b294d9a55352631f9aff1a9a5070b56d0a4f59223e7655bcedf1b4df4fb', 3284315, '11a179177838487250a1dc29a921438106c96fdda9a18247107815e78e5e05c8'],
  ['clip_amnesiac_s1', 13253038, '794d8d9f507f767acc7c071dedcec21c2159d808e13834c6a85e3bb9c3176173', 1007370, 'e7887f7a42115688e44b8924f507be6bde85d815668416d95bb32fbf63278678'],
  ['clip_forge_s1', 12457778, '4a8d114b39db0c6eade9f46ee5fd280af891098ec28c7d67dbdb00222868d562', 2740964, '99359284361829ca5f7d37f1a566e6e666a8a10ee03f2026233f8597a6c71842'],
  ['clip_100640', 11344763, 'd950a850f023d869542a7b108fdbecaf08e9e12e9af2cd18c3558c37c2480ec5', 1943823, '7335901a2f9cd2b9dee54a55c18e52a85e15ad2ac9486251616369b50890771c'],
  ['clip_everdawn_welcome', 8570023, '74bc26eeb58fd4579f66ef103f6ab44e1a464940f8aab5950e5d6ec51d353a29', 1467241, 'b9ced78cfb19b8297439ee37f0be0f245ffb0dd1a721e05decc6236a4c003161'],
  ['clip_gravitos_defeat_dragonknight', 7816393, 'd92973e8f90c3d37c6ae9cb9dc3da2a1bad94e55ae60ba3fc06d0672b5e09a4f', 1020655, '584e569f58e5c5550b7bf06c6243e8350b24d568653a1073064b6726f93e0b3e'],
  ['prologue_void_transcend', 7196124, '0a49d1bc02859aa6fb0d9da1609ba47bced19b06954421e3a796250f81e03fd5', 2394417, 'e36d33d1a1140431aa5c6a7346f4a97ac59ce211393e44e064e423ad09b924f6'],
  ['clip_093232', 6383255, '8c3e9fdbc86e2cc54ab507365981e847808b9ee94cab0f96c6a7703d9cad3fcb', 3645102, 'f045c3abe622bef55548d0f38f487bb071700eece3e8345dd3114700fa18f572'],
];
if (C2PA_CLIPS.some((n) => !CLIPS.find((c) => c[0] === n))) die('C2PA_CLIPS names a clip not in CLIPS');

// check ALL of them before writing ANY, so a guard trip leaves the tree untouched
const plan = [];
for (const [name, oBytes, oSha, nBytes, nSha] of CLIPS) {
  if (SKIP_C2PA && C2PA_CLIPS.includes(name)) { console.log('clip: ' + name + ' left as is (C2PA, SKIP_C2PA = true)'); continue; }
  const dest = path.join(ROOT, 'steam', 'higgsfield', 'cinematics', name + '.mp4');
  if (!fs.existsSync(dest)) die(name + '.mp4 missing at ' + dest + ' (re-sync LX_EXTRA first)');
  const cur = fs.readFileSync(dest);
  const curSha = sha(cur);
  if (cur.length === nBytes && curSha === nSha) { console.log('clip: ' + name + ' already the re-encode'); continue; }
  if (cur.length !== oBytes || curSha !== oSha) die(name + '.mp4 is neither the original nor the re-encode (' + cur.length + ' B, ' + curSha.slice(0, 12) + ') - it changed on origin; re-encode from the new version');
  const srcF = path.join(SRC, name + '.mp4');
  if (!fs.existsSync(srcF)) die('re-encode missing: ' + srcF);
  const buf = fs.readFileSync(srcF);
  if (buf.length !== nBytes || sha(buf) !== nSha) die('re-encode ' + srcF + ' is not the verified one (' + buf.length + ' B)');
  plan.push([name, dest, buf, oBytes, nBytes, nSha]);
}
for (const [name, dest, buf, oBytes, nBytes, nSha] of plan) {
  atomic(dest, buf);
  const back = fs.readFileSync(dest);
  if (back.length !== nBytes || sha(back) !== nSha) die(name + '.mp4 did not verify after the write');
  console.log(`clip: ${name}.mp4 replaced ${(oBytes / 1048576).toFixed(2)} -> ${(nBytes / 1048576).toFixed(2)} MiB (sha ${nSha.slice(0, 12)} verified)`);
}
console.log('cinematic-slim assets: ' + plan.length + ' replaced (SKIP_C2PA = ' + SKIP_C2PA + ')');
