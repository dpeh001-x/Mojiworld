// boss-frame-repair, the assets half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA files are re-synced from origin).
// Some boss frames had art cut off by a hard straight vertical line, and the game draws frames whole (see the header of
// scripts/apply_boss_frame_repair.mjs). This copies the repaired WEBPs (same names, same canvas sizes) over the repo copies,
// then brings the tables that describe those pixels up to date:
//   - data/sprite_edges.js: Libra's attack 5/6 no longer touch the right border, so their right-edge probe is empty now
//     (values from gen_sprite_edges.mjs's own probe - headless Edge, drawImage 48x48, alpha > 24 - run on the new files);
//   - data/sprite_bbox.js: gen_sprite_bbox.mjs's top / bottom scan for any frame whose top row moved (the bottom row - the
//     floor line - never moves: the repair refuses to add ink below it);
//   - data/anim_calib_manifest.js (per-frame cb, gen_anim_manifest.mjs) and data/boss_resize_manifest.js (per-frame c/s/p,
//     gen_boss_resize_manifest.mjs) for the animator / resizer tools: the repaired frames' boxes and row profiles, measured
//     with those generators' own thresholds; the animator's cache-buster stamp is renewed. (The game itself draws boss frames
//     as authored - _BOSS_FRAME_TRUST_ALL - so a moved content top changes no on-screen size.)
//   - sw.js: CACHE generation +1 - the art is REPLACED under its own names, and the local / Steam builds keep same-origin
//     art cache-first, so a returning install would keep drawing the old frames (the web build streams art from the CDN,
//     pinned per deploy, which needs nothing).
// GUARDED: each replaced file must hold EITHER the original bytes (then it is replaced) OR the repaired bytes (already
// applied); each table value must be EITHER the old value OR the new one. Anything else means someone changed that frame
// on origin after the repair - abort before writing anything rather than put a repair of the OLD art over the new one.
// Idempotent. LX_ASSET_ROOT points it at a mirror of the repo (testing without touching the working copy); LX_BFR_SRC at
// the folder holding the repaired WEBPs (default fa_reports/bosscut/repaired).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_BFR_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/bosscut/repaired';
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
// ==== GENERATED TABLES (scripts/_fx_boss_frame_repair_gen.mjs) ====
// [repo path, original bytes, original sha256, repaired bytes, repaired sha256]
const FRAMES = [
  ["Sprites/bosses/attack/towerArbiter_6.webp",172442,"65de7dc1640c64fdcb9068fc0e8db7a6aa3be0af9c8dd85b2864c15a982713f4",182738,"d5e5416ed7acbdada0e639c5f482ee1ea865cb16f4b7b7ab5570d40390b43e6a"],
  ["Sprites/bosses/attack/towerArbitercolumn_1.webp",31792,"ac8b125482a2b21c787c3de106faa8d686cf5197fb33098c4ab40cf118495c7f",34812,"e343046e879d35e688b50c0d95f2be6c0d9a36b88312cbf6bb216e77b8c19641"],
  ["Sprites/bosses/attack/towerArbitercolumn_2.webp",28848,"d432911426d68f04b3708dc956420499fae940e9aed78927afa806a6a8fa7eb2",28910,"5730f1c2a0b8487b1134910f6eae9c21ee2ac0250bcb5abb2157d58b793d67b8"],
  ["Sprites/bosses/attack/towerArbitercolumn_4.webp",34532,"bcc950ba3d65ed9bf115d24ea3f77cb6a91dc1c99ecfef66a6c0569bd384b9f1",33926,"485b86042e979ce6dcf9e3b88cbb1fc1f5d5cfb1085ee80b8108c305ae19c24d"],
  ["Sprites/bosses/attack/towerArbitercolumn_5.webp",66426,"ee03a3961206c7bc5592167669a3261c8fbf3301862ee726a51ebc9a8b55e180",67244,"451ba53fd38688fa1646ad63d3b86cc4c59188ef9214fd156e38a3ed3fc72778"],
  ["Sprites/bosses/attack/towerArbitercolumn_6.webp",87402,"b7ee586704f5e431142331403e99973c769de01e4cc20966f595619f4672e5a3",99104,"c78d05f5e8bbec3c15ad5414539098516e3d7b6f85104858f8ec00700078d6dc"],
  ["Sprites/bosses/attack/towerArbitercolumn_7.webp",77720,"cc26e1101af907cba809f045ed5f7f87613907c0d9bf6ef8d7ed508fa2a28d22",78232,"488bf771e1825f882fac9f168c0011b0f6f3548ce8ab8a71abed99c4e30537c3"],
  ["Sprites/bosses/attack/towerArbitercolumn_8.webp",44008,"afd6a7f859deda552088626c6680b6d598878a51a0f567d73a80b177bbea75b2",45840,"9b60ccef4d8d5ff78e3c1a16c9bf611a94503af32af19e503d50b67d010593d9"],
  ["Sprites/bosses/attack/towerArbiterverdict_5.webp",58184,"75b17221327f0677cca2ca3ebf4671da161d7056c2242ce0adb9d5a18f827f8d",57680,"6ad49982a07e65eaf755fd138b8479dae929834767d56532244cdf04eb7e16b8"],
  ["Sprites/bosses/attack/towerArbiterverdict_6.webp",43854,"9699e879198eb7536fad6042abf01aca399d452e589be16c6c491fef7a37536f",44084,"78d417716fea768343d634320506ae0f713d31e7379681e841c58d81b79cd318"],
  ["Sprites/bosses/attack/towerArbiterverdict_7.webp",39386,"c8ab15ab53ff9906945fcd480a61942e3c6be496ee7539f112bab42b80248de1",39442,"f40758bf4fa91a60d97a3a725e5a47fed294c251c7a1f01e687b509f967fb140"],
  ["Sprites/bosses/zodiac/attack/libra_5.webp",269910,"2475443e10de1163a1f86f6eaa4025c37f9bc0d85c2c0ffafb8916eead9579e4",249878,"414a3f291d36b35a1a5f559e2ad864724fe6bb1b4f71413bd26ac40ff0cf65f4"],
  ["Sprites/bosses/zodiac/attack/libra_6.webp",260160,"def4309338f243e6d390b3529c4c3309d39cfc4dadd23fb801e86d00fdfa7d7c",239390,"b4946cfa7697be41d5066c16c34290d2ce4e7023e85d818d54283ad442d04774"],
];
// [table file, its "window.X = " prefix, path into the object, old value, new value]
const PATCHES = [
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",6],{"c":[600,1299,263,1133],"s":[601,1299,263,1133],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAADBQUGBwcICAgICAgIBwICAQIDAwIFBgsZGRYUFBcgJCYmJiYmQjo4ODk6OTc3ND40OFEvWlFjY2Ffb21sXnNzXks="},{"c":[600,1299,263,1339],"s":[601,1299,263,1333],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAADBQUGBwcICAgICAgIBwICAQIDAwIFBgsZGRYUFBcgJCYmJiYmQjo4ODk6OTc3ND40OFEvWlFiZWJfb3xqXnl5Xks="}],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_1.webp"],"941,1298,1500,1300","862,1298,1500,1300"],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",1],[941,1298,943,1296],[862,1298,865,1296]],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1],{"c":[941,1298,544,883],"s":[943,1296,546,882],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCQkMEBIUFxgZGSQjICEhIRcWFxgZGhobGxwcGxsNCQoMDQc="},{"c":[862,1298,544,1004],"s":[865,1296,546,1001],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQMGCAkKCgoKCgoMEBIUFxgZGSQjICEhIRcWFxgZGhobGxwcGxsNCQoMDQc="}],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2],{"c":[873,1298,548,755],"s":[874,1296,550,753],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAgICAkNDhAUGBwcHx8fHh4YFhYVFRYXGBgZGhobHBwcHBsMCQoMDQc="},{"c":[873,1298,548,757],"s":[874,1296,550,755],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAgICAkNDhAUGBwcHx8fHx4YFhYVFRYXGBgZGhobHBwcHBsMCQoMDQc="}],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4],{"c":[964,1299,498,804],"s":[966,1299,500,802],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDg8PEhUXHyEiIyQlKx0cHSAiJCYmKCIhEgsJCg4YGAw="},{"c":[964,1299,498,815],"s":[966,1299,500,813],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDg8PEhUXHyEiIyQlLR0cHSAiJCYmKCIhEgsJCg4YGAw="}],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbitercolumn_5.webp"],"|||11:16:26","|||15:16:30"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_5.webp"],"876,1299,1500,1300","900,1299,1500,1300"],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",5],[876,1299,908,1299],[900,1299,908,1299]],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5],{"c":[876,1299,483,865],"s":[908,1299,485,803],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEDBQYHBwcJCg4PFxcXHyAgICIsLBoWFxsgJSorIyQpHx4fJyYgHz0="},{"c":[900,1299,483,1054],"s":[908,1299,485,1007],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBAQGBgYJCg4PFxcXHyAgICIsLBoWFxsgJSorIyQpHxcXHiIgMVA="}],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbitercolumn_6.webp"],"|||10:16:26","|||15:13:27"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_6.webp"],"873,1299,1500,1300","861,1299,1500,1300"],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",6],[873,1299,874,1299],[861,1299,874,1299]],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6],{"c":[873,1299,483,865],"s":[874,1299,521,803],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGBwcHBwcHBgYJCg4PFRUXHichICAkJhYkJBgbISEgIyQkJCEgCRsfHhc="},{"c":[861,1299,389,965],"s":[874,1299,410,931],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQQGBgYGBgYGBQUJCg4PFRUXHiIhICAjJRYgIBgbICEfIyYmJCMhEygmJiQ="}],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbitercolumn_7.webp"],"|||9:15:25","|||8:16:25"],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7],{"c":[873,1299,465,865],"s":[874,1299,466,791],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBQUFBAQEBAcKCw4TFBcbISAfHx8fIyMWFxocHh8gIyMkHBwKBwoMDQk="},{"c":[873,1299,408,865],"s":[874,1299,412,791],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBQUFBAQEBAcKCw4TFBcbISAfHx8fIyMWFxocHh8gIyMkHBwKBwoMDQk="}],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8],{"c":[873,1299,465,883],"s":[874,1299,466,882],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgICAgIFCAkLDxIUFhgaGxoaGxweHhUVNTU4MBobHB0eHR0KBwoMDQc="},{"c":[873,1299,465,982],"s":[874,1299,466,978],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgICAgIFCAkLDxIUFhgaGxoaGxweHhUVRkVDMBobHB0eHR0KBwoMDQc="}],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",5],{"c":[723,1299,447,831],"s":[726,1299,448,827],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMEhshLjc3GxkXFRQWFhAODg4PEBESFBMXLC0tLS0sLCkpKBoaGhobGxwdHR4fHyAhISIfGAgKDg4="},{"c":[723,1299,447,840],"s":[726,1299,448,838],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMEhshLjc3GxkXFRQWFhAODg4PEBESFBMXLC0tLS0sLCkpKBoaGhobGxwdHR4fHyAhISIfGAgKDg4="}],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",6],{"c":[753,1299,459,856],"s":[755,1299,461,855],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBQUGBwoKCwwNDg4PDw8PDg4OEBMWJycnJycjJCUlGxwcHR4fISInJiQkJCQkHSAODAgLDg8="},{"c":[753,1299,459,861],"s":[755,1299,461,858],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBQUGBwoKCwwNDg4PDw8PDg4OEBMWJycnJycjJCUlGxwcHR4fISInJiQkJCQkHSAODAgLDg8="}],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",7],{"c":[734,1299,487,856],"s":[737,1299,490,855],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgMECAkMDQ4PDxAQEBAQEA0JCQsNEBMiIyMlJSAiIyMjGBgYGBobHB0eHyEhIyQlJSUODAgLDg8="},{"c":[734,1299,487,859],"s":[737,1299,490,856],"p":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgMECAkMDQ4PDxAQEBAQEA0JCQsNEBMiIyMlJSAiIyMjGBgYGBobHB0eHyEhIyQlJSUODAgLDg8="}],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/zodiac/attack/libra_5.webp"],"|16:11:42|2:24:36|19:14:38","||2:24:36|19:14:38"],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["zodiac_libra","states","attack","f",5],{"c":[0,1105,33,1105],"s":[0,1105,36,1105],"p":"AwMEBQYJCgsMDA4ODg4ODg4NDAwLCwoKDA0NDA8XIC0vMEBCZmRmO0BVVVVUUU1KRkFAXl1XUk9gW1pSV2dkt7/CwcSxj3JaV1ZUVV1ocWxxd32Cb3F0dWtnaGhoZmZmZ2hpamZnZzAqLC0vMC4tLConFBYXJycmJSgpKiooGBc="},{"c":[0,1105,33,1065],"s":[0,1105,36,1056],"p":"AwMEBQYJCgsMDA4ODg4ODg4NDAwLCwoKDA0NDA8XIC0vMEBCZmRmO0BVVVVUUU1KRkFAXl1XUk9gW1pSV2dkt7i5tbWxiXBaV1ZUVV1ocWxxd32Cb3F0dWtnaGhoZmZmZ2hpamZnZzAqLC0vMC4tLConFBYXJycmJSgpKiooGBc="}],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/zodiac/attack/libra_6.webp"],"|15:11:33|2:24:37|20:14:38","||2:24:37|20:14:38"],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["zodiac_libra","states","attack","f",6],{"c":[0,1105,58,1105],"s":[0,1105,62,1105],"p":"AwMEBQYJCgsMDA0ODg4ODQ0MCwoJCAgKDA0NDRAZIC0wMEBCZWRmO0BXV1ZUVFRRS0lIWlhVUlBPWFNTWmJeud6+vb+siHZcV1RUVl9qc2tvc3h7fnN1dmdoaWtsbW5vbGxpamZnZ0cqLC0vMC4tLCoVFBYXJycmJSgpKiooGBc="},{"c":[0,1105,58,1067],"s":[0,1105,62,1057],"p":"AwMEBQYJCgsMDA0ODg4ODQ0MCwoJCAgKDA0NDRAZIC0wMEBCZWRmO0BXV1ZUVFRRS0lIWlhVUlBPWFNTWmJeudK1s7GrhnJcV1RUVl9qc2tvc3h7fnN1dmdoaWtsbW5vbGxpamZnZ0cqLC0vMC4tLCoVFBYXJycmJSgpKiooGBc="}],
];
// ==== END GENERATED ====

// ---- check EVERYTHING before writing ANYTHING, so a guard trip leaves the tree untouched
const plan = [];
for (const [rel, oBytes, oSha, nBytes, nSha] of FRAMES) {
  const dest = path.join(ROOT, rel);
  if (!fs.existsSync(dest)) die(rel + ' missing at ' + dest + ' (re-sync LX_EXTRA first)');
  const cur = fs.readFileSync(dest), curSha = sha(cur);
  if (cur.length === nBytes && curSha === nSha) { console.log('frame: ' + rel + ' already repaired'); continue; }
  if (cur.length !== oBytes || curSha !== oSha) die(rel + ' is neither the original nor the repair (' + cur.length + ' B, ' + curSha.slice(0, 12) + ') - it changed on origin; repair the new version');
  const srcF = path.join(SRC, rel);
  if (!fs.existsSync(srcF)) die('repaired file missing: ' + srcF);
  const buf = fs.readFileSync(srcF);
  if (buf.length !== nBytes || sha(buf) !== nSha) die('repaired file ' + srcF + ' is not the reviewed one (' + buf.length + ' B)');
  plan.push([rel, dest, buf, nSha]);
}
// a GENERATED one-line JSON table: patch values at a path, keep key order, header and anything after the object
const J = (v) => JSON.stringify(v);
const tables = [];
for (const rel of [...new Set(PATCHES.map((q) => q[0]))]) {
  const f = path.join(ROOT, rel); if (!fs.existsSync(f)) die(rel + ' missing');
  const s = fs.readFileSync(f, 'utf8'), prefix = PATCHES.find((q) => q[0] === rel)[1];
  const i = s.indexOf(prefix); if (i < 0 || s.indexOf(prefix, i + 1) >= 0) die(rel + ': table prefix not found once');
  const j0 = i + prefix.length, j1 = s.indexOf(';', s.lastIndexOf('}'));
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
  if (!n) { console.log(rel + ': already current'); continue; }
  let tail = s.slice(j1);
  if (rel === 'data/anim_calib_manifest.js') {   // the animator's cache-buster: renew it with the frames it busts
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
    const re = /window\.LX_ANIM_MANIFEST_STAMP = "\d+";/; if (!re.test(tail)) die(rel + ': no stamp');
    tail = tail.replace(re, 'window.LX_ANIM_MANIFEST_STAMP = "' + stamp + '";');
  }
  tables.push([f, s.slice(0, j0) + J(obj) + tail, n]);
}
// sw.js: one CACHE generation up (once)
const SW = path.join(ROOT, 'sw.js');
let swOut = null;
{
  const s = fs.readFileSync(SW, 'utf8');
  if (s.includes('boss-frame-repair')) console.log('sw.js: already bumped');
  else {
    const re = /^const CACHE = 'mojiworld-assets-v(\d+)';.*$/m, m = s.match(re);
    if (!m || (s.match(new RegExp(re.source, 'gm')) || []).length !== 1) die('sw.js: CACHE line not found once');
    const EOL = s.includes('\r\n') ? '\r\n' : '\n', N = +m[1];
    const line = '// boss-frame-repair - v' + N + ' -> v' + (N + 1) + '. Libra\'s attack frames 5-6 and the Tower Arbiter\'s sliced column / verdict / swing frames are REPLACED under' + EOL +
      '// their own names (the art a straight line had cut off, repaired), so a returning install would keep drawing the old frames for a session.' + EOL +
      "const CACHE = 'mojiworld-assets-v" + (N + 1) + "';   // boss-frame-repair: sliced boss frames repaired under their own names. v" + N + ' was: ' + m[0].replace(/^[^/]*\/\/\s*/, '').slice(0, 160);
    swOut = s.replace(m[0], () => line);
  }
}
// ---- write
for (const [rel, dest, buf, nSha] of plan) {
  atomic(dest, buf);
  if (sha(fs.readFileSync(dest)) !== nSha) die(rel + ' did not verify after the write');
  console.log('frame: ' + rel + ' replaced (sha ' + nSha.slice(0, 12) + ' verified)');
}
for (const t of tables) { atomic(t[0], t[1]); console.log(path.basename(t[0]) + ': ' + t[2] + ' value(s) updated'); }
if (swOut) { atomic(SW, swOut); console.log('sw.js: CACHE bumped'); }
console.log('boss-frame-repair assets: ' + plan.length + ' frame(s) replaced');
