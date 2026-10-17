// esrgan-maps, the assets half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA files are re-synced from origin).
// It does NOT trust that re-sync: every text file it edits is rebuilt from origin's blob + its rows, and every replaced file's
// original is checked on origin (THE BASE IS ORIGIN'S BLOB, the boss-feet-calib rule).
// Per user: upscale the stretched map backdrops, the Dawn Gate and two effects for free with the local Real-ESRGAN, drawn size and
// anchor identical, previews approved before shipping.
//   ART - 30 files REPLACED under their own names: 18 map plates (1152-1456 px -> 2912-class, exact old aspect), the town's Dawn
//     Gate (x2), the Dawn crest (696x733 -> 1034x1089, aspect to 0.003%) and the Arcane Burst shockwave (9 frames + still, x2).
//     Each: deblock (bilateral) -> Real-ESRGAN x4 in four tile-shifted passes blended (no tile seams) -> ONE lanczos3 to the new
//     size -> tone match to the original (local means: shadows not crushed, no cast) -> light luminance unsharp (1 / 0.5 / 2) ->
//     WebP q94 + smart deblock (sprites: LOSSLESS alpha = the original outline resampled, never through the model; their soft
//     edge band eases back to the original colour). Model per plate as reviewed (see the table).
//   TABLES - data/sprite_bbox.js (the gate's row is size-guarded: new size, same bounds x2) and data/sprite_edges.js rows that a
//     live probe of the new art changes; sw.js CACHE +1 (the art is replaced under its own names).
// GUARDED: each replaced file must hold EITHER origin's bytes OR the new ones; each table value EITHER the old OR the new value -
// anything else aborts before writing. Idempotent. LX_ASSET_ROOT points it at a mirror; LX_ESRM_SRC at the folder of new files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_ESRM_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/esrm/final';
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
// ==== GENERATED TABLES (fa_reports/esrm/compose.mjs) ====
// FILES: [repo path, original bytes, original sha256, new bytes, new sha256]
// PATCHES: [table file, its "window.X = " prefix, path into the object, old value, new value]
const FILES = [
  ["backgrounds/bg_v3_forest.webp",952040,"fad04fc92cdd7f2dedb396448367ffdf62db18510960a7408b6da96cd66c99f4",482892,"9e01e9b2bec6d2f4c6152a05b70b5740972980034a12162c60c5689099a79e84"],
  ["backgrounds/bg_v3_meadow.webp",90230,"cfdc9b8f275014ee5034053a20a815597ba359503f629c4ae5fae04af526b1bd",376580,"da1a284317ade2bb571c8ac1bb1d5bd096bfe25f403d2358fe6c9aebe1555729"],
  ["backgrounds/bg_v3_misty.webp",94248,"3dd87ff5422d0560f2435d90ee7cc108108e29361decf7bfdca09159abc39dec",342888,"3c44e1a956e5f58498e817b5b0245326c4f7bf3a8feaf63171d74911c894f140"],
  ["backgrounds/bg_v3_dungeon.webp",80960,"8dd3da182f231cc2e058cf530ec157429387b88ecd29405a708dc27985b5df5d",284764,"0cc795a12ee19fd233fa52ba5e152e2e2f4d62522e5a40bd75e536fd525682e1"],
  ["backgrounds/bg_v3_cinematic_underwater_1.webp",66842,"e417656e835f6d3de27df611502419aecda758e94a3c5d1de6b2ac89a34c006a",261776,"0a852d31374f9a50e003bd4232d204062fae7ad65c7d962499ce32368360c682"],
  ["backgrounds/bg_v3_cinematic_underwater_2.webp",117086,"e9f1b06a7d2f6334b1523dc83000e6477fb65e898673afb64830eee83f237224",448114,"3baa4fed05fc8e2354794a4442a4690812746de7eb7f64bbd06ce24e7c8d4d03"],
  ["backgrounds/bg_v4_elderwoodGrove.webp",123892,"7119f29985dfd26c247f36408649f15f5de3b72b2859ef555eb84dc8bf6e5d60",366636,"e29a18e7a5773edc827149600f89e991bc87f87dc72607ddb87f76a1aef4e9af"],
  ["backgrounds/bg_v4_verdantHaven.webp",133590,"c4d79ea478be16cbdebb8122dd51650c52d01b5ede1be3b76b51ec44d8de2a24",439452,"1373a0795f66fa09d1ccee05724cca04e7541658e59b4f7284203ec40fc3b9aa"],
  ["backgrounds/bg_v4_fieryHideout.webp",110768,"aeb9bbb8bf335698093bbcabc24529dece354b0aa6f3cd44c582a6d06e675f40",329138,"2836b1122aabc0ef833952542b15679adfb2a3a88591a6a666632de1aa35ece7"],
  ["backgrounds/bg_v4_bloomhaven.webp",181926,"b77652514e3f37f9dd2089589b25be197ef016ce61967124ff63c2c2ab87a79f",630340,"7c9ac6c34c6ac82f233f3200570011d7a7a95dd9b6bccf0ad05fa99cc6be6ff8"],
  ["backgrounds/bg_v4_gloomsporeVerge.webp",87342,"2f1176e8f9fb68b8c4897b08b4de90a776cf245291ecea7836efa2da02f052ac",263208,"f19f4a4b9410c44f44f9e7a146213530bccd7431434d81df3b4f5a7e266e43b0"],
  ["backgrounds/bg_v4_mossyReaches.webp",106988,"a59e1df421b123cb2e2e4603acd366f42cf262cec5a2d82ad1d355e3ab5e950f",309890,"ef3da31365e4d70ab458a54485976f96c59e9588676c23fab8bae43b0be87f68"],
  ["backgrounds/bg_v4_sunderedCatacomb.webp",106060,"9d670aa5367c83396b16c6cce0e9ac4aa97e573de6e696fb5548f4c49480658c",347842,"14278382f8eb511b31d5b5e539131c051ae94955471228ecea77329e72735feb"],
  ["backgrounds/bg_v4_hallOfEchoes.webp",92604,"d27f79e85ed225aea19fe5be4ef280f7db482ff8bbb5a17e33d3a650faeca0f0",262282,"45628967e0b6ea73f2036d7bfbab3dc1ac413ca3876497a0df823d5d2e456cd0"],
  ["backgrounds/bg_v4_stormCrest.webp",91650,"e214c0df9cb43cfebf42f422bcb3a60d22b9208e2ec2b193c1f47fc79da39873",294144,"f71844761869c762e34e94335564e20ad5ae4675af84fffcc7591aeed560b66c"],
  ["backgrounds/bg_v4_ossuarySprawl.webp",205460,"aa50ffe2296d935f2d3a7e9ef6e93f505db8ceb11857c6848e47bfaed629ce90",731420,"7d9770c31367d8137dfc36cd04280b16917cf892d5a092651ee99e08002881d6"],
  ["backgrounds/bg_v4_glasswindSteppe.webp",102298,"eede057af1a33d351c9feecf68f17ca6827914073d3f4aa67faf42ab44fd8dd5",292302,"6e9868ba8a6f273e5e9698a0ea96445f787d0e0022f9ffacd094af26ae8a7102"],
  ["backgrounds/bg_v4_glasswindSteppe2.webp",126088,"c096e4f58e39dc4a7ca0bead1ee613cbf0cbab805178a1d1c793ee42fb5273a3",320918,"f959795cff57ccda9761e44eb5edb271b11ac898515b1fb25e1428c42b99da68"],
  ["backgrounds/title_keyart_c.webp",98130,"246b10c67ff05026906f729a9a0a775e0a12281f58fa783291f7be87a95fbb19",339804,"cb897940676de337e46b929090e21a5f5ac0a2810d695147ec328ce2a45aff34"],
  ["Sprites/ui/death_keyart.webp",32874,"4d689a098e69fce1b1dfb8e5b6158715c225875017788cf33a80661950c31009",1112760,"84b1588bcfbfd2550d378c598f441038e37e8da5ab94a0af6fbeb22c964a25ae"],
  ["Sprites/objects/town_dawn_gate.webp",165064,"7226e7fa7608044fb9f946cead73ff0d29460dd9c05398fdb0c0fb165b256c9b",129906,"778b0ea2bf2d1dd482158bf646d1288cd2eb530f1df7b38934bceefb0872e9c9"],
  ["Sprites/fx/dawn_crest.webp",175122,"92f8e808d5a25bd62f0f5a3656aeec562165956fa2ae1da4ee90ff400d6ec45d",346972,"20a3b6342467cdb0e7f1ed3c6be21a3413730923dbd56c37ff5ae58bd8bd7cf0"],
  ["Sprites/fx/arcane_shockwave.webp",118044,"e3c707e4816c4732d3c48583da8c4a53a2ec84a5b4cee523683ae0a804b0c606",258920,"28111f3c619cd40ad629180dcebaf225dfe6c170adbc6195838c3eece395e30a"],
  ["Sprites/fx/anim/arcane_shockwave_0.webp",71918,"ed95a9b77572280b582d8d63f404d3ad74cf7156990b5c3918dfb94eca438965",194718,"b224b6a6deb29bd38f30f655d329e2902fc64f41a50180cdd79029f09fa00cb3"],
  ["Sprites/fx/anim/arcane_shockwave_1.webp",73434,"bc18565234ea2ff7815420f69ddad7514c56b39fa313b28e96497d4fbd4470d8",198092,"88b8dd1b0f55b1251f09e993446835004982dee879303da0e056511beb25bbad"],
  ["Sprites/fx/anim/arcane_shockwave_2.webp",75472,"1a9c0a1501b4767d75b31b98e7e6ec94b446eab6a9143dd4af8c2b3060f5ec06",203504,"ab184883ffc3188afee1565baef0d1d7cb8a78f6bfbc3f0e72e31f395c0cd9c6"],
  ["Sprites/fx/anim/arcane_shockwave_3.webp",93944,"beb31084a1519e3f542820f55cb7cf7f184209af7f86fa3aa545d56e1b610d3a",237030,"6c4c265212056e8b6f4092c784ad15f62432e2741e2b7ce09ec5d1c1c69b0448"],
  ["Sprites/fx/anim/arcane_shockwave_4.webp",98926,"652aea4bb431afc5bc1a513ae64b9b17e40d74b42cf9d2e369cfc3fe1ebcd8e9",241430,"83b39204a158e45157e43eca89276332934f9553e87a9f46de8361d097a826dc"],
  ["Sprites/fx/anim/arcane_shockwave_5.webp",84826,"67cd4bb79eb036c145240d59b5929a0e7c52cfd5455b3b45ec1228328442b7d8",210884,"ac45bf9395d9589c6260a4622d4f88fa91ec82479b3c945ae94f71efd4f083f1"],
  ["Sprites/fx/anim/arcane_shockwave_6.webp",79234,"d434e625ec14e7a0d9567d4de02c796e2fa70f9a73d8080714848090cb0971f5",202814,"b5b605b4ef737f48bbc5e7b905e82d04ad1325bbc85509886fd5093785d59313"],
  ["Sprites/fx/anim/arcane_shockwave_7.webp",74260,"a02597962b9de7992c4b4ccf5e2359faab5aeab00d230c2f91531298d3c35636",200444,"7e8dc4a27c98a0a7d5934751f8fff70813676c6cb9e05525973416161db79776"],
  ["Sprites/fx/anim/arcane_shockwave_8.webp",70732,"1d9454d52521d8928e4c6593ec4fc2aff4d840a2d4f08ff2fe5e0874d1cb9c05",193510,"22f784ac192a68ebb7a2c576631c31f9c6f12cd30ebadc92672c3f93c287f478"],
];
const PATCHES = [
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["objects/town_dawn_gate.webp"],"24,464,760,489","49,929,1520,978"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["fx/arcane_shockwave.webp"],"4:24:27|5:20:25||5:21:25","3:24:27|5:20:25||5:21:25"],
];
// ==== END GENERATED ====
const objEnd = (s, j0) => { let d = 0, q = false; for (let k = j0; k < s.length; k++) { const ch = s[k]; if (q) { if (ch === String.fromCharCode(92)) k++; else if (ch === '"') q = false; continue; } if (ch === '"') q = true; else if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) return k + 1; } } return -1; };
const REPO = process.env.MOJI_REPO || 'C:/Users/dpeh0/Mojiworld', BASE = process.env.LX_BASE_REF || 'origin/main';
const git = (args, input) => execFileSync('git', args, { cwd: REPO, maxBuffer: 1 << 28, input, stdio: ['pipe', 'pipe', 'pipe'] });
const baseTxt = new Map();
const baseOf = (rel) => { if (!baseTxt.has(rel)) { let b = null; try { b = git(['show', BASE + ':' + rel]); } catch (e) { die(rel + ': not readable on ' + BASE); } baseTxt.set(rel, b.toString('utf8')); } return baseTxt.get(rel); };
// ---- every file's ORIGINAL on BASE must be the exact one its new version was made from, else abort (origin changed it: re-make it)
{ const want = FILES.map((q) => q[0]), ids = new Map();
  for (const l of git(['ls-tree', BASE, '--', ...want]).toString().split('\n')) { const m = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(l.trim()); if (m) ids.set(m[2], m[1]); }
  const miss = want.filter((r) => !ids.has(r)); if (miss.length) die('files not on ' + BASE + ': ' + miss.slice(0, 3).join(', '));
  const out = git(['cat-file', '--batch'], want.map((r) => ids.get(r)).join('\n') + '\n'); let o = 0, already = 0;
  for (const [rel, oBytes, oSha, nBytes, nSha] of FILES) {
    const nl = out.indexOf(10, o), n = +out.subarray(o, nl).toString().split(' ')[2], b = out.subarray(nl + 1, nl + 1 + n); o = nl + 1 + n + 1;
    const h = sha(b); if (n === nBytes && h === nSha) { already++; continue; }
    if (n !== oBytes || h !== oSha) die(rel + ': ' + BASE + ' holds neither the original this file was made from nor the new file (' + n + ' B) - re-make it from the new version');
  }
  console.log('files: the ' + want.length + ' originals verified on ' + BASE + (already ? ' (' + already + ' already new there)' : '')); }
// ---- check EVERYTHING before writing ANYTHING, so a guard trip leaves the tree untouched
const plan = [];
for (const [rel, , , nBytes, nSha] of FILES) {
  const dest = path.join(ROOT, rel);
  const cur = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
  if (cur && cur.length === nBytes && sha(cur) === nSha) continue;
  const srcF = path.join(SRC, rel);
  if (!fs.existsSync(srcF)) die('new file missing: ' + srcF);
  const buf = fs.readFileSync(srcF);
  if (buf.length !== nBytes || sha(buf) !== nSha) die('new file ' + srcF + ' is not the reviewed one (' + buf.length + ' B)');
  plan.push([rel, dest, buf, nSha]);
}
const J = (v) => JSON.stringify(v);
const tables = [];
for (const rel of [...new Set(PATCHES.map((q) => q[0]))]) {
  const f = path.join(ROOT, rel);
  const s = baseOf(rel), prefix = PATCHES.find((q) => q[0] === rel)[1];
  const i = s.indexOf(prefix); if (i < 0 || s.indexOf(prefix, i + 1) >= 0) die(rel + ': table prefix not found once');
  const j0 = i + prefix.length, j1 = objEnd(s, j0); if (j1 < 0) die(rel + ': table object not closed');
  const src = s.slice(j0, j1), obj = JSON.parse(src);
  if (J(obj) !== src) die(rel + ": table is not its generator's compact JSON");
  let n = 0;
  for (const [, , at, ov, nv] of PATCHES.filter((q) => q[0] === rel)) {
    let o = obj; for (const k of at.slice(0, -1)) { o = o == null ? undefined : o[k]; }
    const k = at[at.length - 1];
    if (o == null || !(k in o)) die(rel + ': no entry ' + at.join('.'));
    if (J(o[k]) === J(nv)) continue;
    if (J(o[k]) !== J(ov)) die(rel + ': ' + at.join('.') + ' is ' + J(o[k]).slice(0, 80) + ', neither the old nor the new value');
    o[k] = nv; n++;
  }
  tables.push([f, n ? s.slice(0, j0) + J(obj) + s.slice(j1) : s, n, rel]);
}
// sw.js: one CACHE generation up (once)
const SW = path.join(ROOT, 'sw.js');
let swOut = null;
{
  const s = baseOf('sw.js');
  if (s.includes('esrgan-maps')) { console.log('sw.js: already bumped on ' + BASE + ' (written as its blob)'); swOut = s; }
  else {
    const re = /^const CACHE = 'mojiworld-assets-v(\d+)';.*$/m, m = s.match(re);
    if (!m || (s.match(new RegExp(re.source, 'gm')) || []).length !== 1) die('sw.js: CACHE line not found once');
    const EOL = s.includes('\r\n') ? '\r\n' : '\n', N = +m[1];
    const line = '// esrgan-maps - v' + N + ' -> v' + (N + 1) + '. ' + FILES.length + ' art files (18 map backdrops, the Dawn Gate, the Dawn crest, the arcane shockwave) are' + EOL +
      '// REPLACED under their own names (AI-upscaled), so a returning install would keep drawing the old soft art for a session.' + EOL +
      "const CACHE = 'mojiworld-assets-v" + (N + 1) + "';   // esrgan-maps: 30 art files upscaled under their own names. v" + N + ' was: ' + m[0].replace(/^[^/]*\/\/\s*/, '').slice(0, 160);
    swOut = s.replace(m[0], () => line);
  }
}
// ---- write: files, tables, sw.js
for (const [rel, dest, buf, nSha] of plan) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  atomic(dest, buf);
  if (sha(fs.readFileSync(dest)) !== nSha) die(rel + ' did not verify after the write');
}
for (const [f, txt, n, rel] of tables) { atomic(f, txt); console.log(rel + ': ' + (n ? n + ' row(s) patched' : 'already current on ' + BASE + ' (written as its blob)')); }
atomic(SW, swOut);
console.log('applied: esrgan-maps assets (' + plan.length + ' of ' + FILES.length + ' files written, ' + (FILES.length - plan.length) + ' already new)');
