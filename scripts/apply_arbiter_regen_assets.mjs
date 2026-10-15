// arbiter-regen, the assets half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA files are re-synced from origin).
// The Tower Arbiter's sets were regenerated without slices (see the header of scripts/apply_arbiter_regen.mjs and
// scripts/gen_arbiter_regen.mjs): idle, walk, swing (attack/towerArbiter), pillar (towerArbitercolumn) and verdict
// (towerArbiterverdict), 9 frames each, same names, same 1500x1300 canvases, the knight at the same size, x and floor row -
// so the hit regions and the frame index are untouched and each set's calibration still describes its art (two of them are
// re-solved below so every state matches the idle, which they did not before either). (His lunge, towerArbiterdash,
// passes the clip detector as shipped and is not touched.) This copies the 45 new WEBPs over the repo copies, then brings the tables that describe
// those pixels up to date, each value measured by its own generator (run on a mirror holding the new frames):
//   - data/sprite_bbox.js (gen_sprite_bbox.mjs top / bottom rows), data/sprite_edges.js (gen_sprite_edges.mjs probe),
//     data/anim_calib_manifest.js (per-frame cb, gen_anim_manifest.mjs; the animator's cache-buster stamp is renewed) and
//     data/boss_resize_manifest.js (per-frame c/s/p, gen_boss_resize_manifest.mjs) for the animator / resizer tools;
//   - sw.js: CACHE generation +1 - the art is REPLACED under its own names, and the local / Steam builds keep same-origin
//     art cache-first, so a returning install would keep drawing the old frames;
//   - data/anim_calib.js: the pillar's and the verdict's s / dx / dy, so his body matches the idle's (see CALIBRATION below),
//     baked as LX_ANIM_PATCH:1 blobs by scripts/apply_anim_patch.mjs;
//   - scripts/boss_frame_repair_test.mjs: its Arbiter rows (sha / probe / table pins of frames replaced here) are retired;
//   - scripts/tower_anim_motion_test.mjs: the pillar's motion floor 6 -> 5 (its old motion was the sliced ray burst) and the
//     verdict's row re-measured on its new inverted-sword art (see below).
// GUARDED: each replaced file must hold EITHER the original bytes (then it is replaced) OR the new bytes (already
// applied); each table value must be EITHER the old value OR the new one. Anything else means someone changed that frame
// on origin after the regen - abort before writing anything rather than put the regen over newer art.
// Idempotent. LX_ASSET_ROOT points it at a mirror of the repo (testing without touching the working copy); LX_ARB_SRC at
// the folder holding the new WEBPs (default fa_reports/arbiter_regen/out).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_ARB_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/arbiter_regen/out';
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
// ==== GENERATED TABLES (scripts/_fx_arbiter_regen_tables.mjs) ====
// FRAMES: [repo path, original bytes, original sha256, new bytes, new sha256]
// PATCHES: [table file, its "window.X = " prefix, path into the object, old value, new value]
const FRAMES = [
  ["Sprites/bosses/idle/towerArbiter_0.webp",86238,"9c0d9bf9e8d57959b69e634ce2ab4124733e6050941a388c71ac9d31fbfd9ead",83352,"4f9520ec209875527797489b2be920ac30a15f369f05b21a9e20eba5744ccee5"],
  ["Sprites/bosses/idle/towerArbiter_1.webp",87076,"7c447ae1668865a1169b06bd16c73a2e7d9d5f7496e99496b006ad4b4095bf4a",81950,"6253df715a828f5df36923aed8038de062c652db5713cf4753093a0e8409f9ea"],
  ["Sprites/bosses/idle/towerArbiter_2.webp",89284,"091eaa3599ee6ff282bc28607dcd6af9146d8abce5537d295c86a6abc6c7a8ba",81502,"0b5d998b4d53e48656fb509403a01c2958abfbfd9199456bf8329601b588b16c"],
  ["Sprites/bosses/idle/towerArbiter_3.webp",84980,"63bfe112ae317b66ca7778e6c035840e2e0c38dcb8abbbc64a432a87f702b65d",84200,"00c2a479b929cd3c53258f26d5be1fee83bd27bf411fe8a60ff2106519c387f9"],
  ["Sprites/bosses/idle/towerArbiter_4.webp",86152,"130323c65edbcb2da0e6b9a6fcaa601ce1221d9b410191195535c9380a88eb57",84144,"fac9c7f71fa709b1a0aeac793d2ef8c3b007b6b9d78adc2196f2a36131e86c35"],
  ["Sprites/bosses/idle/towerArbiter_5.webp",86380,"b56ff438c62765dafba4084c02c1635cbf63c8efe48587c5612a61dfc64d4f5e",81512,"b45c33afba917ea5e8f064f9b4b5bb576fe178e3eadc6b3ce006a88ed664af17"],
  ["Sprites/bosses/idle/towerArbiter_6.webp",86514,"34a871ed62865e11298e81dd17d5c1d31c24729962d5235f1e4bd8a4ce435ba2",81820,"bc86784ffb179bb5232bd89f7128d4d531a266ab90a8f531a796fb51d885ce2f"],
  ["Sprites/bosses/idle/towerArbiter_7.webp",88672,"844ebb42d8b1bac726302fff56a789307ce22367dcb540c0e575ac2b268b5c9f",82762,"07c706060625aabed7f7b36524bca13572ef598ad1b35e38f1d8bdd12b35049b"],
  ["Sprites/bosses/idle/towerArbiter_8.webp",85586,"7c5f1e5541563e5308115d46caf038cc181c6604ec072df0c1ed0ff4cea00367",83998,"d0f09825bcac3805e866350ba65640efc8e6a88de11244dc1549c6e641dc51ba"],
  ["Sprites/bosses/walk/towerArbiter_0.webp",76206,"7022fd4a13853a6b1abcd83cbc5fd4347154a7f1b4671ff91d85e0a0cf68691c",76382,"dea5a2e7a688c1dbd0e202e2722b101bfc9867bcf1cfe7da3d50da4af1daac81"],
  ["Sprites/bosses/walk/towerArbiter_1.webp",75870,"d5cfe1ce82cd78f9eeb5b377f7c955a78fd0df336a8604810a4b4e4238fb71eb",73568,"2d3ab9da4b97b4b68eab9c921901ed62368a94009bca2bea0c3d1b7556ff1a38"],
  ["Sprites/bosses/walk/towerArbiter_2.webp",76194,"9b63fdcad7811159d3ec0447d3b707afad806da9d898b1645b6c89f80f63137f",73774,"4cff14bc8557d16aed8b05b4af789309d4a6bebf1fdd4384fc9d2610a86c3f26"],
  ["Sprites/bosses/walk/towerArbiter_3.webp",75110,"0b06e4259e30b2c988a7b87dc90193b777c11fac499e9685ce80e295d3a38b12",74038,"b095fa7b056a3cc8539491b9277c438721e49d531a013a11f8ea0162cc8d8a6b"],
  ["Sprites/bosses/walk/towerArbiter_4.webp",76966,"3b0a98db82fdc8d1e86ff536cbc18f2bda51a8b1c7601bab08129c688e2279e1",74238,"f10b268c18b0ef57d8bc0fb68a66eefb1179207598a28e1d1b8535279ec27470"],
  ["Sprites/bosses/walk/towerArbiter_5.webp",76694,"c2c924e04c8c66108f13c120a7fb5936e0891111ad31c12ed3286535bb0f914d",73954,"a4266eaa73c87d1b3b9e8f3bfb6763f94e7fe57606a3f43d0afcd1b5c3b9bb66"],
  ["Sprites/bosses/walk/towerArbiter_6.webp",75186,"5d95b544dbabf2874e663306873676b18da71bb6a7eda268733cb922891ee2c9",71464,"da0d217f2c79fde180ec6dfe3e79c43a2febce02508400715b565fcd4917e355"],
  ["Sprites/bosses/walk/towerArbiter_7.webp",75852,"1bde2d599a80372b4f3febefb4f0b9cd9b325bba94a95d55e21bedb7146cc08c",76154,"5452ef0eb66745fd43f5829d7567643ff05c24f8f9ed164755d557031d909b94"],
  ["Sprites/bosses/walk/towerArbiter_8.webp",76224,"145f128ccbca2461fa84cf873c10b54ada59b28dfde7928214f3546b921d6d43",76310,"4f26dca1ee253473df64da732d3ca0d8a6352e5ad04dee042d7b2c309c1a246d"],
  ["Sprites/bosses/attack/towerArbitercolumn_0.webp",33376,"8303fd8432d48eaad5275a6bd62dd0cb1606f86abbe23e4fc8f3603013e9f4c8",35034,"49e2d761ef2b2a92743875f98b4ce9b40ebbdd2ba906e14c6b611d5b0699734c"],
  ["Sprites/bosses/attack/towerArbitercolumn_1.webp",34812,"e343046e879d35e688b50c0d95f2be6c0d9a36b88312cbf6bb216e77b8c19641",33858,"38ebf55d252ee2b05239f0419ab4456f88d06457f5613a66e38d760f615fa7ec"],
  ["Sprites/bosses/attack/towerArbitercolumn_2.webp",28910,"5730f1c2a0b8487b1134910f6eae9c21ee2ac0250bcb5abb2157d58b793d67b8",36438,"efdf537a54ccef303a87a9c788d05a55fe5b980454c33c15fb743e8cac835963"],
  ["Sprites/bosses/attack/towerArbitercolumn_3.webp",31006,"33babc46421b91cc3f1002283b2f594f2a485346b431012587a0fb276bc84fc0",38146,"fa0c7be563f8707690eb2e29c45299cd1ab2abe00664aa4883e2ce1c22ffb59b"],
  ["Sprites/bosses/attack/towerArbitercolumn_4.webp",33926,"485b86042e979ce6dcf9e3b88cbb1fc1f5d5cfb1085ee80b8108c305ae19c24d",41776,"4ff228ec1fa5dd5e57d00c092a28b2e38fa4aebbc10d0b517fafdbfe7bb0ae89"],
  ["Sprites/bosses/attack/towerArbitercolumn_5.webp",67244,"451ba53fd38688fa1646ad63d3b86cc4c59188ef9214fd156e38a3ed3fc72778",47296,"416fd22f7903b4cd941f9440f2ec64a2a9d0f36c17798a37811bacfa913ab73f"],
  ["Sprites/bosses/attack/towerArbitercolumn_6.webp",99104,"c78d05f5e8bbec3c15ad5414539098516e3d7b6f85104858f8ec00700078d6dc",45194,"dbfffa70a80e6a8d25586f1f2ef141d065fd84066cd107bb730de031381f9db2"],
  ["Sprites/bosses/attack/towerArbitercolumn_7.webp",78232,"488bf771e1825f882fac9f168c0011b0f6f3548ce8ab8a71abed99c4e30537c3",42448,"6329e849c27d980d160c4d90c98e6f4da37685f569e013add8424516434432d2"],
  ["Sprites/bosses/attack/towerArbitercolumn_8.webp",45840,"9b60ccef4d8d5ff78e3c1a16c9bf611a94503af32af19e503d50b67d010593d9",36148,"a1a73e0ec7c62a8cbf1797f46ff70a45f4d3418e3c643d4a5856fd55d6ce2095"],
  ["Sprites/bosses/attack/towerArbiterverdict_0.webp",35060,"ad804cfffd018b48f143cbaa7a30ac45444b5b1da855a5b3f6e907fe641de48c",37216,"6493b9aa2fa8f6a15db35c0b3a0cd0add102aad0205d69f890a5e6c9b4ec8ed0"],
  ["Sprites/bosses/attack/towerArbiterverdict_1.webp",35306,"1b46fb8ad91582aa118e768eded435ae0f666bf2e67031f2c01707431230139b",39508,"a02b4248257081fbbde986869d62586e37ce1c32e3a846515116a3da36a05b2f"],
  ["Sprites/bosses/attack/towerArbiterverdict_2.webp",35662,"102d8e6e79a5e662d6b0f3f21810b8db01597795ee5ae3a8d2afb30d574a8e9b",42954,"090300a05ca95ece2510080beac2063d4b868a8eecdcb41f0549f4a097e75c26"],
  ["Sprites/bosses/attack/towerArbiterverdict_3.webp",35776,"87bccea8f56f88ed2edb631a536ded716e919e9fd1d00d0e42f1e4d241631100",44940,"ca008f46f95eedd488ffe8972d69e23a841e534bdb23d777b7293a6775966795"],
  ["Sprites/bosses/attack/towerArbiterverdict_4.webp",34766,"03c3e24f567d1338638e9a84293407073c74f9ea7f0d6ae63550e8b2611d2537",46974,"f0ec2e245aa373234a0f4515952853e0301f7dc269509a0159faa5fba74bad98"],
  ["Sprites/bosses/attack/towerArbiterverdict_5.webp",57680,"6ad49982a07e65eaf755fd138b8479dae929834767d56532244cdf04eb7e16b8",47778,"f5b3eb3e66788b209cd871bef6494f2b388b1c09e587f46b0c7cb9db1a2e08be"],
  ["Sprites/bosses/attack/towerArbiterverdict_6.webp",44084,"78d417716fea768343d634320506ae0f713d31e7379681e841c58d81b79cd318",44110,"4c3aed3d31d06b8cdd7789c3d84d448bc56fe78fcd35e6dcff433b7bfaffaded"],
  ["Sprites/bosses/attack/towerArbiterverdict_7.webp",39442,"f40758bf4fa91a60d97a3a725e5a47fed294c251c7a1f01e687b509f967fb140",41724,"69e434f1f2f757812f8f0218cc6e8c5a8fde1c015cb1b08beefd39f49a87cd4b"],
  ["Sprites/bosses/attack/towerArbiterverdict_8.webp",38356,"cead72a1c2d915307e66f02e63327fee15bafae62bfe7293347078e8642bf463",41596,"51c95f3e210299cc2e572a940fbcd7373301153fc7fbf926228bab55f282c54e"],
  ["Sprites/bosses/attack/towerArbiter_0.webp",45756,"c50ee35e1484adc4836ada3259b203e3cd76f2cff5e21cdc06037d112b940393",47052,"df8a4fd96c366c4c028f2930cb7bb7572c6229f9edb538fedd44949d8e6a88ce"],
  ["Sprites/bosses/attack/towerArbiter_1.webp",75448,"ecc58dc7c579aaac3881eb7706b717509ff5e3ffa7922aad07a7d6a0b2626599",51636,"2e8427d4deb69b8f45adcb978ac5617aa466874a9d99a1dac61d66a7b3c260d4"],
  ["Sprites/bosses/attack/towerArbiter_2.webp",80150,"6ebf4c8d6b4cf4a2d518f0fa92e05ed25e6b23161d4d24ee1a54eade8e643d43",53894,"7a4b11afa43b034c673cbd6ef77dcb7b319b5b1a0df90d4a365779acb02315ce"],
  ["Sprites/bosses/attack/towerArbiter_3.webp",95524,"a34159c6b1725d3f786cef1427e505d1e1979a85e3e69beafb4d34df3566b5b7",75130,"f55c938d2487061f346cfe36ffb92d1fb2f31295149a10118a60ef47d578bc07"],
  ["Sprites/bosses/attack/towerArbiter_4.webp",108432,"f8d5a834b8313f9759bada506d9324f4c7abec3698103c62c78f8d1e6b0075ac",73744,"59fd285c79aca1df699c76a7c2741e5309e1ae18a52905a5cbbf9cf055aeae7e"],
  ["Sprites/bosses/attack/towerArbiter_5.webp",116018,"9961885de4d74c75daaba4af3fbcb8cc20429ae38c8a11629dafea3823f5de0e",93254,"b10f52dec46ca6e4a017df0d1ace65891e45defa88e9b56441eac8ca55a7bcbc"],
  ["Sprites/bosses/attack/towerArbiter_6.webp",182738,"d5e5416ed7acbdada0e639c5f482ee1ea865cb16f4b7b7ab5570d40390b43e6a",114092,"26e938c73d21d589a6f2e5b7e713a02a50e02f9779c794d54e20fc0c336712f9"],
  ["Sprites/bosses/attack/towerArbiter_7.webp",61956,"8530f9e8da70152cefb78efe4f305c50bb7865056477c3bfb014ddadb7f5a68d",84356,"2d9f4fcb73c6d673c5e70c5c63220015a779509384a8fcb37ddde057178d8bd1"],
  ["Sprites/bosses/attack/towerArbiter_8.webp",45462,"3b05e0ef37e8ff5714e34fdcb2184201edba3fbf5eb5d63191ff921edf67b09c",66270,"ed53e58e4a80fa0d221275b378142d7c39bf1302fd1cd9e78f4ee742924a3862"],
];
const PATCHES = [
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_0.webp"],"858,1299,1500,1300","855,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_1.webp"],"590,1299,1500,1300","669,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_2.webp"],"542,1299,1500,1300","630,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_3.webp"],"554,1299,1500,1300","596,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_4.webp"],"607,1299,1500,1300","683,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_5.webp"],"661,1299,1500,1300","580,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_6.webp"],"600,1299,1500,1300","583,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_7.webp"],"602,1299,1500,1300","611,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiter_8.webp"],"859,1299,1500,1300","857,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_1.webp"],"862,1298,1500,1300","942,1298,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_2.webp"],"873,1298,1500,1300","707,1298,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_3.webp"],"873,1298,1500,1300","730,1297,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_4.webp"],"964,1299,1500,1300","704,1298,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_5.webp"],"900,1299,1500,1300","706,1298,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_6.webp"],"861,1299,1500,1300","733,1298,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_7.webp"],"873,1299,1500,1300","778,1298,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbitercolumn_8.webp"],"873,1299,1500,1300","780,1298,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_0.webp"],"750,1299,1500,1300","915,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_1.webp"],"716,1299,1500,1300","916,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_2.webp"],"761,1299,1500,1300","916,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_3.webp"],"787,1299,1500,1300","903,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_4.webp"],"769,1299,1500,1300","900,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_5.webp"],"723,1299,1500,1300","900,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_6.webp"],"753,1299,1500,1300","838,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_7.webp"],"734,1299,1500,1300","916,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/towerArbiterverdict_8.webp"],"711,1299,1500,1300","916,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/idle/towerArbiter_0.webp"],"542,1299,1500,1300","543,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/idle/towerArbiter_1.webp"],"545,1299,1500,1300","543,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/idle/towerArbiter_7.webp"],"542,1299,1500,1300","543,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/idle/towerArbiter_8.webp"],"542,1299,1500,1300","543,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_0.webp"],"542,1299,1500,1300","547,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_1.webp"],"539,1298,1500,1300","568,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_2.webp"],"541,1299,1500,1300","548,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_3.webp"],"540,1299,1500,1300","532,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_4.webp"],"536,1298,1500,1300","549,1298,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_5.webp"],"549,1298,1500,1300","556,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_6.webp"],"535,1299,1500,1300","543,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_7.webp"],"552,1299,1500,1300","542,1299,1500,1300"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/walk/towerArbiter_8.webp"],"535,1299,1500,1300","553,1299,1500,1300"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiter_4.webp"],"|||7:17:23","|||6:17:23"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiter_5.webp"],"|||7:17:23","|||6:17:23"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiter_6.webp"],"|||19:15:35","|||7:17:23"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiter_7.webp"],"|||9:15:27","|||7:17:23"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiter_8.webp"],"|||9:17:27","|||7:17:23"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbitercolumn_4.webp"],"|||7:18:25","|||4:18:22"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbitercolumn_5.webp"],"|||15:16:30","|||4:18:22"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbitercolumn_6.webp"],"|||15:13:27","|||4:18:22"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbitercolumn_7.webp"],"|||8:16:25","|||4:18:22"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbitercolumn_8.webp"],"|||5:15:22","|||4:18:22"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_0.webp"],"|||6:17:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_1.webp"],"|||5:18:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_2.webp"],"|||5:18:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_3.webp"],"|||5:18:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_4.webp"],"|||5:18:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_5.webp"],"|||5:18:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_6.webp"],"|||6:18:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_7.webp"],"|||5:18:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/towerArbiterverdict_8.webp"],"|||5:18:23","|||6:18:24"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_0.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_1.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_2.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_3.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_4.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_5.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_6.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_7.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/idle/towerArbiter_8.webp"],"|||7:17:26","|||6:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/walk/towerArbiter_1.webp"],"|||9:19:31","|||8:20:31"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/walk/towerArbiter_2.webp"],"|||9:19:29","|||7:20:33"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/walk/towerArbiter_3.webp"],"|||8:20:31","|||4:20:23"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/walk/towerArbiter_4.webp"],"|||4:17:20","|||6:21:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/walk/towerArbiter_5.webp"],"|||8:16:26","|||11:19:31"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/walk/towerArbiter_6.webp"],"|||8:19:31","|||3:17:19"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/walk/towerArbiter_7.webp"],"|||11:19:29","|||4:17:26"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/walk/towerArbiter_8.webp"],"|||7:19:31","|||7:17:26"],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",0,0],542,543],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",0,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",1,0],545,543],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",1,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",2,2],546,547],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",2,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",3,2],546,547],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",3,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",4,2],546,547],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",4,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",5,2],546,547],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",5,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",6,2],546,545],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",6,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",7,0],542,543],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",7,2],546,545],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",7,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",8,0],542,543],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","idle","cb",8,3],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",0,0],543,547],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",0,2],547,550],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",0,3],1296,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",1,0],539,568],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",1,2],543,571],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",1,3],1295,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",2,0],541,548],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",2,2],545,550],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",3,0],540,532],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",3,2],544,534],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",4,0],536,549],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",4,2],541,551],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",5,0],549,556],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",5,2],553,559],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",5,3],1294,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",6,0],536,543],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",6,2],539,545],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",6,3],1296,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",7,0],552,542],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",7,2],556,544],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",7,3],1299,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",8,0],535,553],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",8,2],539,556],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","walk","cb",8,3],1299,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",0,0],858,856],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",0,2],859,858],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",1,0],590,669],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",1,2],591,671],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",2,0],542,630],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",2,2],542,634],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",3,0],554,600],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",3,2],560,611],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",4,0],607,683],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",4,2],611,685],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",5,0],662,582],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",5,2],666,607],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",6,0],600,594],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",6,2],601,628],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",7,0],602,614],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",7,2],606,643],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiter","states","attack","cb",8,0],859,857],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",0,1],1298,1299],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",0,3],1296,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",1,0],862,943],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",1,1],1298,1299],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",1,2],865,944],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",1,3],1296,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",2,0],873,708],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",2,1],1298,1299],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",2,2],874,711],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",2,3],1296,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",3,0],873,730],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",3,2],874,735],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",4,0],964,704],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",4,2],966,707],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",4,3],1299,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",5,0],900,706],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",5,2],908,708],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",5,3],1299,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",6,0],861,733],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",6,2],874,735],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",6,3],1299,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",7,0],873,778],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",7,1],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",7,2],874,779],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",7,3],1299,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",8,0],873,780],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",8,1],1299,1298],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",8,2],874,782],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbitercolumn","states","attack","cb",8,3],1299,1297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",0,0],750,916],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",0,2],753,917],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",1,0],717,916],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",1,2],722,918],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",2,0],761,916],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",2,2],764,918],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",3,0],787,903],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",3,2],790,905],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",4,0],769,900],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",4,2],791,902],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",5,0],723,900],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",5,2],726,903],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",6,0],753,838],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",6,2],755,918],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",7,0],734,916],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",7,2],737,918],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",8,0],711,916],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["towerArbiterverdict","states","attack","cb",8,2],714,918],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",0,"c",0],542,543],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",0,"c",2],394,395],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",0,"c",3],1052,1053],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",0,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",0,"s",2],397,398],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",0,"s",3],1049,1050],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJDhITFBQWGh0gIyUnKSwuMDI1NjY2NzY5OTk7PT09PT9APz4+PTw8SERCQEFAPz02NjQ3Nzg8P0NGSk1RUSsoGhkYFhQXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJDhITFBQWGR4hIyUnKiwuMDI1NjY2NzY5OTk7PT09PT8/Pz4+PTw8RkRCQEBAPz02NjU3Nzg7P0NGSk5RUSobGhkYFhQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",1,"c",0],545,543],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",1,"c",2],356,395],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",1,"c",3],1063,1052],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",1,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",1,"s",2],359,398],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",1,"s",3],1061,1049],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhITFBMVGSAgJCYoKy0vMjQ2Nzc3NzY5OTo8Pj4+QEBBQUJDTEw/Pz0+QEFCQ0RFRkVHSU1RVVlcYFhYIyAdGhgWFRQXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhETExQWGR0hIyUnKiwuMDI1NjY2NzY5OTk7PT09PT8/Pz4+Pjw8R0RCQEBAPz02NjU3Nzg7P0NHSk5RUSobGhkXFhQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",2,"c",2],338,396],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",2,"c",3],1064,1051],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",2,"s",0],546,547],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",2,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",2,"s",2],341,399],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",2,"s",3],1062,1049],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",2,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhITFBMVGSAgJCYoKy0wMjU3Nzc3ODY5OTo8Pj4+QEBBQUJDTEw/Pz5AQUNERUZHSElKTFBUWV1fWFpaKyMfGhgWFRQXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHDhETExMWGRwhIyYnKiwuMTM1NjY2NzY5OTk7PD09PT8/Pz4+PTw9SURCQEFAQD43NzY4ODk8QERHS05RUisbGhkYFhQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",3,"c",2],394,398],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",3,"c",3],1049,1059],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",3,"s",0],546,547],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",3,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",3,"s",2],397,401],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",3,"s",3],1046,1056],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",3,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhITFBMWGR0gJCYnKy0vMTQ2NjY3NzY5OTo8PT0+PkBAQD4+Pj09SEU3QkJAPjMzMzE0NDU4PUBER0tPUCkpGhkXFhQXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhIUFBQXHCAhJCYnKy0vMTQ2NjY3NzY4OTo7PT09PT9AQD4/Pj8+Pjk2N0REOTo6Ozo8PD9DR0tPUlZYPDAbGhkXFhQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",4,"c",2],394,398],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",4,"c",3],1049,1058],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",4,"s",0],546,547],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",4,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",4,"s",2],396,401],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",4,"s",3],1046,1055],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",4,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhITFBMWGR0gJCYnKi0vMTQ2NjY3NzY5OTo8PT09PkBAQD4/Pj09SUU3QUJBPzY3NzU3ODg8P0NGSU1QUisbGhkYFhUXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhIUFBQXHyAiJCYnKy0vMTQ2NjY3NzY5OTo7PT0+Pj9AQD4+Pj0+Pjk2NUNCNzg5OTg6Oz5CRkpOUVVXMS8bGhgXFRQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",5,"c",2],394,397],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",5,"c",3],1049,1058],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",5,"s",0],546,547],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",5,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",5,"s",2],396,400],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",5,"s",3],1046,1055],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhITFBMWGR0gJCYnKi0vMTM2NjY3NzY5OTo8PT09PUBAQD4+Pj09SUU3QUJBPzY3NzU3ODg8P0NGSU1QUSsbGhkYFhUXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHDhETExQWGSAhJCYnKi0vMTM2NjY3NzY5OTo7PD09PT9AQD4+Pj09Ozk2NEA/PTQ0NTU2Njk8QERITE9RNSknGhgXFRQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",6,"c",2],384,395],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",6,"c",3],1053,1051],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",6,"s",0],546,545],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",6,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",6,"s",2],386,397],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",6,"s",3],1050,1048],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJDhITFBQWGR0gIyYnKiwuMDM1NjY2NzY5OTo7PT09PT9AQD4/QEtLSkVHSUlJSEBBQUBDQ0VJTVFUWFtcIB0bGhkXFhQXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJDhITExQXGiAgIyUnKiwuMDI1NjY2NzY5OTo7PT09PT8/Pz4+Pjw9SUQ3QUFAQD43NzY4ODk8QENHSk5RUSsbGhkYFhQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",7,"c",0],542,543],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",7,"c",2],332,395],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",7,"c",3],1055,1052],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",7,"s",0],546,545],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",7,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",7,"s",2],334,397],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",7,"s",3],1052,1049],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJDxITFBQWGR0gIyYnKSwuMDI1NjY2NzY5ODk7PT09PT9APz4/P0pKSkZHSUpKSkpFR0ZKS05SV1lRU1QtKSgbGhkXFhQXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJDhITFBQXGyEhIyUnKSwuMDI1NjY2NzY5OTk7PT09PT8/Pz4+Pj1JSURBQkNDQkA6Ojk7OzxAQ0dLTlJVVi8bGhkXFhQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",8,"c",0],542,543],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",8,"c",2],394,395],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",8,"c",3],1052,1053],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",8,"s",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",8,"s",2],397,398],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","idle","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJDxITFBQWGh0hIyYnKSwuMDI1NjY2NzY5ODk7PT09PT9APz4+Pjw8RURCQEFAPjs0NDM1NTY5PUFER0tPUCopGhkYFhQXGRsaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhITFBQXGyEhIyUnKSwuMDI1NjY2NzY5OTk7PT09PT8/Pz4+Pj0+SURBQkNCQkA6Ojk8PD1BRUlMUFNXVzAbGhkXFhQXGhsaDw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",0,"c",0],543,547],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",0,"s",0],547,550],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",0,"s",1],1296,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",0,"s",2],401,398],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhETFBQWGRwhIyUnKSwuMDI1NjY2NjY5OTk7PT09PT4/Pz0+PT08R0RCQEA/Pj02NjY3Nzk8QENHSk5RUionGhkYFhUXGRoaDw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBASExQVGBsgISQmKCstLzE0NjY2NjY5OTk6PDw9PT4/Pz0+PT08RUVCP0BAPz02NjY3Nzg7P0JGSk1QUSonGRgXFhQXGRoZDw4="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",1,"c",0],539,568],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",1,"c",2],379,384],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",1,"c",3],996,1008],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",1,"s",0],543,571],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",1,"s",1],1295,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",1,"s",2],383,386],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",1,"s",3],991,1005],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKDxITFBQXGR0gIyUoKy0wMjY2Njg4Ozw8Pj9AQEFBRERCQ0NDMzQ8Ojg3Nzc2NjExMTEyMjI0Njk8PkFERDw9HxkYGBgaHBwdHAc=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMERMUFBUYHSAhJCcrLTE1Nzg4Ozs/QEJERUZHSElLSDc3NjQzPDs5Nzg4NjU1NjYzMzM0NTc6PUBDRklAQSgdFxYVFBYXGBg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",2,"c",0],541,548],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",2,"c",2],362,407],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",2,"c",3],930,1047],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",2,"s",0],545,550],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",2,"s",2],365,409],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",2,"s",3],926,1043],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",2,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKDxMUFBUYICEUFSUnKi0wMjY3ODk5PT0/QEJDRERHSUlISTc2Nj4+PTs7PDw9PTg5Ojo7PDw8PT09PT4/Njc3GxweHyEjIyMTERA=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACxATFBQWGRwhISUnKSwvMTQ3ODg4ODg7PD0+P0BBQkJDQkIyMjM/Pjo5Ojs8PT4/P0BEREVFRUZIS05RU0krJxgYFxkUEhITExE="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",3,"c",0],540,532],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",3,"c",2],371,368],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",3,"c",3],983,1123],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",3,"s",0],544,534],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",3,"s",2],375,372],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",3,"s",3],979,1118],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",3,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKDxETFBQXGR0hIyUoKi0vMTQ2Nzc4Nzs7PD4/QEBAQ0NDQ0NCQjM8Ojg4OTo6PD0+Pz0+P0NERERHSUxCQionFxcWFhYVFBMUFBQ=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoQFBQWFxwgICEhJigpKy0vMDI0NTY1NDM0NDQ0NTY3ODk6Ozw+QEBAQkNERkdJSktMTk9RVFhcX0A0MTAeHRwaGRcaGhkTEBITExE="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",4,"c",0],536,549],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",4,"c",2],386,340],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",4,"c",3],1094,1057],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",4,"s",0],541,551],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",4,"s",2],390,343],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",4,"s",3],1087,1053],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",4,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMNERMUFBYaICEiJScpKywuMDIzNTU1NTQ2NjY2Nzc3Nzg5OTk6Q0NDQkFAQkJDQkFERUZITFBVWl5iZmc4KykbGRcUGRoaFxISEg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACw8RExMVGSEhJSYoKi0vMjQ3Nzg4ODw8PT5AQEFCQ0RFQzQzMjI+Pjo4OTs9QEJFSUtNUFBRRUdKTU9SOx8aGRgXGRwdHh8eDAo="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",5,"c",0],549,556],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",5,"c",2],361,384],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",5,"c",3],1094,1004],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",5,"s",0],553,559],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",5,"s",1],1294,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",5,"s",2],365,386],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",5,"s",3],1089,1000],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACw8SFBQVGB0gIiQmKCosLjAyNDU1NTU0Nzc3Nzg4ODg5OTo3Nzg5RENBPT5AQEBAQEJESE1SWF1iZ2lJOyonGxkWFBEWGBobGAc=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQ8TFBUWGBweHh8iJSksLzQ2ODg7Oz9AQ0RGR0hJTE1MOjs6OjlBQT49PTw7OTY2Nzg4ODg5Ojs8PT9DRUcnJRcWFhUUFBcZGg0="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",6,"c",0],536,543],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",6,"c",2],374,410],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",6,"c",3],990,1077],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",6,"s",0],539,545],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",6,"s",1],1296,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",6,"s",2],377,413],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",6,"s",3],984,1071],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYNERMUFBYZHCAhJCYpLC4xNDY3Nzg4PDw9P0BBQUJERUVERUU0ND08Ojg4OTk5OTQ0NTU2Nzc4Ojw/QkRGPT4lFxcXFhUWGBoaFAg=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDhASExMXGyAgJCYoKiwvMTM1Njc2NjU3Nzg5Ozs8PD0+Pj4+P0lJSURERENCQEBDQ0NERERFSEtPUlMqHBwbGhgWFRIPDg4PDw4="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",7,"c",0],552,542],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",7,"c",2],365,329],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",7,"c",3],922,1105],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",7,"s",0],556,544],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",7,"s",1],1299,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",7,"s",2],367,331],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",7,"s",3],918,1102],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA4SFBQUGBwgIBUkJyotMDM2Nzg5OTw9P0BCQ0RFR0hJSEk3NjY+Pjw7PD0+P0BBPD0+P0BBQkJDQ0NDOTo6OhsdHyEjJSYnKBU=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALERQWGB4fHyEiFSUnKSssLjAyNDU1NTQzNDQ0NTY4OTs8Pj9AQkNFRkhKSktKSktMTE9SV1tfQD8xMC0sIx0bGRcVEhQXFxMPDw4="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",8,"c",0],535,553],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",8,"c",2],382,315],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",8,"c",3],1006,1072],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",8,"s",0],539,556],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",8,"s",1],1299,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",8,"s",2],386,318],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",8,"s",3],1000,1070],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","walk","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUMEBITFBUXGh8iJCcpLC4wMjU3Nzc3Nzo6Oz0+Pz9AQUJCQUFBMkBAOjc2Njc4ODk6OjtAQEFCQ0VIS05CKCYYGBcXFhYUExITFBM=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA0QEhMUGCAgJSUlJyosLjAzNTY2NjY1ODg5Ozw8PT4+Pz89Pj8+Sj45Oj0/QURHTE9RUlNXTVBTVC0vKScjGhkXFRQXGRoZDw4="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",0,"c",0],858,856],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",0,"c",2],476,477],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",0,"c",3],860,858],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",0,"s",0],859,858],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",0,"s",2],477,480],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",0,"s",3],857,855],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwsLDA8TFRcaHB4gICAhIiMkJCUlJCQqKSYmJSAgICIlKS0wIBcPDQ0PDwk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAsLDRATFhgaHB4gICAhISMkJCUlJCQqKiYlJCAgICIlKSwvMBcPDg0PDwk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",1,"c",0],590,669],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",1,"c",2],506,498],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",1,"c",3],1005,924],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",1,"s",0],591,671],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",1,"s",2],508,501],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",1,"s",3],994,921],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDBQcLDxQWHB0fIiMkISEiFhIPDg0MCwsJChAQDxMlJiYmJiYlJSUlJBoaGhoaGxwdHh4fICAgICEiIiIhGQ0ICQ0PDwk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAgMEBQcHCAgICAgICAgICQkJCQsMDRMTFRcZGxwdKy0tKCcoKBsbGx0eHyAhISMjJCQlJSUkIw8JCQ0PEAk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",2,"c",0],542,630],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",2,"c",2],518,481],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",2,"c",3],989,816],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",2,"s",0],542,634],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",2,"s",2],520,486],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",2,"s",3],982,814],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",2,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEDBATHCEjIyMlJiUmLS4uDxERCQkJCAkJDQ0NDQ0MEBwcFBYlJicnJycmHhkZGRkZGBgZGhsbHB0dHh4fICEhIiMiGw8ICQ0PDwk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBggKCgsLCwsLCwsLCwsLCwsLCwsLEA4MDREYFSgpKyUlIyEeGhkZGRkZGhscHh8gISMjJSYnJycmJQ8LCQ0PEAk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",3,"c",0],554,600],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",3,"c",2],419,360],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",3,"c",3],972,817],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",3,"s",0],560,611],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",3,"s",2],422,365],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",3,"s",3],969,813],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",3,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQgJBgsjJy8zNCQpKSYbFxUWGBsbEhIREhIWFgsLDAwOKCsuMDEwLy8tLCsrLi8wMTI0NTY3ODg3NjUyLywoJyQlHQ4KCQ0PDwk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQFhwiJSYoKSorLS8dGRcXFxYPDQsKCgoKCgoPDw8TFRcoKSkpKSUkIhkZGRkZGRobHB4fICIjJSYnKCgnJhAMCQ0PDwk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",4,"c",0],607,683],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",4,"c",2],374,386],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",4,"c",3],856,989],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",4,"s",0],611,685],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",4,"s",2],381,411],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",4,"s",3],852,985],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",4,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBQIDAwMAAAEBDRYaGh4fJzA2S0pJRkU6Ojk5Ojs7P0JBQEBAQEBBQUFDRERGRkVFREI/PDw8OjczLx4dDwsICQ0PDwk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDAwQEBAUFBQYFBQYGBgYJChAQJCUkJSUjIiEfHh4dHBwbGxwdHh8gITg4Nzc2NldTT0tFQDQvJBwNCgk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",5,"c",0],662,582],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",5,"c",2],368,292],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",5,"c",3],892,893],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",5,"s",0],666,607],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",5,"s",2],376,298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",5,"s",3],888,890],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECg0VFxocHSAiKTI4PEhIR0ZFR0cnLT08QEE/PT4+PTk4OTo9PT8/P0I+Pj88PDg2KygoKSkZGBcICQ0PDwk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCArMjo8KiUiIiIcGxscHx0bGhoZFxYVFRcYGRscEhMSGx8jMTQ0Li0sKysiHBobGxweHyEjJSYoKiwtLiUeEQgICg0ODAk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",6,"c",0],600,594],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",6,"c",2],263,415],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",6,"c",3],1339,1059],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",6,"s",0],601,628],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",6,"s",2],263,418],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",6,"s",3],1333,1055],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAADBQUGBwcICAgICAgIBwICAQIDAwIFBgsZGRYUFBcgJCYmJiYmQjo4ODk6OTc3ND40OFEvWlFiZWJfb3xqXnl5Xks=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4gKzZBSU5SU1VWVikiIyAdHBsYFxUUExISERAQEBgXGSYmJBwdHBkZGRodISMVFBYXGi8xMjMrLCANDAsLCgkICQ0PDwk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",7,"c",0],602,614],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",7,"c",2],271,317],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",7,"c",3],1133,974],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",7,"s",0],606,643],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",7,"s",2],274,321],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",7,"s",3],1131,949],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQAAAAAAAAAAAQAAAAEBAgAAAAEBAwgLDA4SFRcaHB4gICAiIiMkJCUlJCQjIiAoKCgoLi4yMyobGxAPDQ0WFQk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAESUuOD9ESUxNJyEeIBoZFxUTEA8ODAwLCwoLDRATFRYXGBgYGBotMDArKysqKR4gJiQmKCoqICIiEA4MCgkICQ0PDwk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",8,"c",0],859,857],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",8,"c",2],477,428],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",8,"c",3],860,1026],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",8,"s",2],478,431],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",8,"s",3],858,1005],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiter","states","attack","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgoLDA8TFRcaHB4gHyAhISMkJCUlJCQjKCYmJR8gICIlKS0wHxcPDQ0PDwk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwoMDQ8TFRgZGx0fHx8fHyAiJCUnKCEjJScpLDI6XFxSJyEcGBYSDg0PDwk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",0,"c",1],1298,1299],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",0,"c",2],516,519],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",0,"c",3],832,830],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",0,"s",1],1296,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",0,"s",2],517,521],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",0,"s",3],830,828],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCQkMEBIUFhgaGhscHR0eHh4dIyAfHhoaGx8iJicTDAsMDQc=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCQkLDxIUFhgaGhsbHB0eHh0dIiAeHhoaGx8iJiYTDAsMDAc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"c",0],862,943],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"c",1],1298,1299],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"c",2],544,546],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"c",3],1004,970],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"s",0],865,944],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"s",1],1296,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"s",2],546,547],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"s",3],1001,967],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQMGCAkKCgoKCgoMEBIUFxgZGSQjICEhIRcWFxgZGhobGxwcGxsNCQoMDQc=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADCAkLDxETFRcZGRkZGx0uKycjHxgZGhobGxwcHBsNCQkMDQc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"c",0],873,708],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"c",1],1298,1299],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"c",2],548,552],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"c",3],757,790],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"s",0],874,711],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"s",1],1296,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"s",2],550,554],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"s",3],755,788],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",2,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAgICAkNDhAUGBwcHx8fHx4YFhYVFRYXGBgZGhobHBwcHBsMCQoMDQc=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQIDBAUGBgYGBgYGBgYGBgYGBgYGBgYGCQoNDxIfHx8fHx8eFRQUFBUWFhcYGBkZGRoaGhkMCQkMDQc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",3,"c",0],873,730],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",3,"c",2],500,537],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",3,"c",3],753,777],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",3,"s",0],874,735],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",3,"s",2],502,541],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",3,"s",3],751,775],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",3,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMDAwNDxMXGRMdHh4eHhkWFhYWFhcZGhscHR0fHx8fHwwHBwoMDQc=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAwUHCAgICAgICAgICAgICAgJCAsJCgsNHR4gIR4eGxUVFhYWFhcXGBkaGhoaGhoaGRkQCQoMDQc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4,"c",0],964,704],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4,"c",2],498,529],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4,"c",3],815,780],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4,"s",0],966,707],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4,"s",1],1299,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4,"s",2],500,532],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4,"s",3],813,777],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",4,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDg8PEhUXHyEiIyQlLR0cHSAiJCYmKCIhEgsJCg4YGAw=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQMFCwwHBwcHBwcHBwcHBwcHBwcHBwcHCwoMDx0gISEhISEdFhYWFhcYGhscHR0eHh8fHx0PBwkMDQc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5,"c",0],900,706],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5,"c",2],483,523],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5,"c",3],1054,903],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5,"s",0],908,708],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5,"s",1],1299,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5,"s",2],485,525],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5,"s",3],1007,902],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBAQGBgYJCg4PFxcXHyAgICIsLBoWFxsgJSorIyQpHxcXHiIgMVA=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgMDCg0ODxAQEhMMCQcGBgYGBgYGBwcHCAkLDhEUFyAgICAgIBUUFBQWFxkaHB4fICEhHBoLBwkMDQc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6,"c",0],861,733],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6,"c",2],389,548],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6,"c",3],965,981],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6,"s",0],874,735],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6,"s",1],1299,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6,"s",2],410,550],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6,"s",3],931,978],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQQGBgYGBgYGBQUJCg4PFRUXHiIhICAjJRYgIBgbICEfIyYmJCMhEygmJiQ=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQwODxARExMMCAcHBwYGBgYGBgcHCAkLDhIUFyAgIB8gIBUUFBQVFhcYGRoaGxwdHBsLCQkMDQc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"c",0],873,778],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"c",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"c",2],408,564],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"c",3],865,1021],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"s",0],874,779],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"s",1],1299,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"s",2],412,566],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"s",3],791,1019],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBQUFBAQEBAcKCw4TFBcbISAfHx8fIyMWFxocHh8gIyMkHBwKBwoMDQk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkMCwUFBgcHDAsKCAgHBwcHCAkLDxIUFhkhISMjHh4eFBMYGBcXFxgYGRkaGRkZDwkMDQc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"c",0],873,780],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"c",1],1299,1298],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"c",2],465,558],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"c",3],982,942],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"s",0],874,782],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"s",1],1299,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"s",2],466,560],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"s",3],978,938],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbitercolumn","states","attack","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgICAgIFCAkLDxIUFhgaGxoaGxweHhUVRkVDMBobHB0eHR0KBwoMDQc=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECAgEBAAABAgEAAAICAgAFCAkMDxIUFRcZGhoYGhscHjk4MSYfGBkZGRoaGRkUEgkMDQc="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",0,"c",0],750,916],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",0,"c",2],527,541],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",0,"c",3],775,810],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",0,"s",0],753,917],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",0,"s",2],529,543],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",0,"s",3],772,809],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAgMEBAUGBgcHBwgLDQ8QEBERHyIkJCUlJSAiJCQkGhkZGRobHB0dHh4eHh8fHx4dDwsLDg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgoKDBEWGiMjIyIoKBsWFhYWFhcXGBkaGhocHB0dHR0YCQoNDgg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",1,"c",0],717,916],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",1,"c",2],527,531],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",1,"c",3],767,823],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",1,"s",0],722,918],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",1,"s",2],530,533],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",1,"s",3],764,821],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECAgMDBAQFBwcICgsNDhASExMTGRobGx0fISMkJSUkJBoaGhkZGhsbHB0dHh4eHh8fHh4dDgkLDg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAkKDBEWGiMjIyMoKSkXFhYWFhcXGRobHBweHx8fHx0WCQoNDQg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",2,"c",0],761,916],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",2,"c",2],503,535],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",2,"c",3],755,828],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",2,"s",0],764,918],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",2,"s",2],507,537],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",2,"s",3],753,826],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",2,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgHCRcXFxUVFhYUFBUUFhcNDyEkJCIhHx0aGhoaGhoaGxscHR4eHh8fHx8fHx4YDQgLDg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAkKDBEWGiMjIyMqKysWFhYWFhcYGBkaGxsdHh4eHh0ZDAoNDgg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",3,"c",0],787,903],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",3,"c",2],472,544],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",3,"c",3],751,824],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",3,"s",0],790,905],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",3,"s",2],475,546],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",3,"s",3],749,821],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",3,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAwQHDA4dGxkYHBwaGQsMDyEjISEgHx0aGhoaGhoZGhscHR4eHx8fHyAgIB8fDwoLDg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBAkKCxEjIygoKCMqKioXFhYWFhcXGBkaGhscHB0dHRwYCQoNDgg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",4,"c",0],769,900],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",4,"c",2],498,532],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",4,"c",3],753,839],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",4,"s",0],791,902],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",4,"s",2],501,534],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",4,"s",3],751,837],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",4,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQECBhgZGhscHR0bGhoaFQsMECEjIyEgHx0aGhoaGhoaGhscHR4eHx8fICAhICAfDgkLDg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICBAkKDBEWGyoqKisrKyoXFhYWFhcXGRobHBweHh8fHx0UCQoNDQg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",5,"c",0],723,900],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",5,"c",2],447,538],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",5,"c",3],840,828],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",5,"s",0],726,903],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",5,"s",2],448,539],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",5,"s",3],838,826],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMEhshLjc3GxkXFRQWFhAODg4PEBESFBMXLC0tLS0sLCkpKBoaGhobGxwdHR4fHyAhISIfGAgKDg4=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMEBQkKDBEWJSUjIyMqKigWFhYWFhcYGBkaGxsdHR4eHh0ZEAoNDgg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",6,"c",0],753,838],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",6,"c",2],459,544],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",6,"c",3],861,845],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",6,"s",0],755,918],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",6,"s",2],461,545],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",6,"s",3],858,843],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBQUGBwoKCwwNDg4PDw8PDg4OEBMWJycnJycjJCUlGxwcHR4fISInJiQkJCQkHSAODAgLDg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAABAkKCxEWGiMjIyIoKBsWFhYWFhcXGBkaGhscHB0dHRwXCQoNDgg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",7,"c",0],734,916],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",7,"c",2],487,534],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",7,"c",3],859,843],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",7,"s",0],737,918],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",7,"s",2],490,535],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",7,"s",3],856,841],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgMECAkMDQ4PDxAQEBAQEA0JCQsNEBMiIyMlJSAiIyMjGBgYGBobHB0eHyEhIyQlJSUODAgLDg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAkKCxEWGiMjIyIoKBsXFhYWFhcXGBobGxweHh8fHhwUCQoNDgg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",8,"c",0],711,916],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",8,"c",2],530,533],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",8,"c",3],776,843],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",8,"s",0],714,918],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",8,"s",2],533,535],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",8,"s",3],773,842],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["towerArbiterverdict","states","attack","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMEBQcKDA0ODw8PDwsHBgcHBwcHCQsNDxMiIyMlJSAiIyMjGRgYGBkaGxscHB0cHR0eHh4eFwsLDg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAkKCxEWGiMjIyIoKBsWFhYWFhcYGBobGxweHh8fHh0UCQoNDgg="],
];
// ==== END GENERATED ====

// ---- check EVERYTHING before writing ANYTHING, so a guard trip leaves the tree untouched
const plan = [];
for (const [rel, oBytes, oSha, nBytes, nSha] of FRAMES) {
  const dest = path.join(ROOT, rel);
  if (!fs.existsSync(dest)) die(rel + ' missing at ' + dest + ' (re-sync LX_EXTRA first)');
  const cur = fs.readFileSync(dest), curSha = sha(cur);
  if (cur.length === nBytes && curSha === nSha) { console.log('frame: ' + rel + ' already regenerated'); continue; }
  if (cur.length !== oBytes || curSha !== oSha) die(rel + ' is neither the original nor the regen (' + cur.length + ' B, ' + curSha.slice(0, 12) + ') - it changed on origin; regenerate from the new version');
  const srcF = path.join(SRC, rel);
  if (!fs.existsSync(srcF)) die('new file missing: ' + srcF);
  const buf = fs.readFileSync(srcF);
  if (buf.length !== nBytes || sha(buf) !== nSha) die('new file ' + srcF + ' is not the reviewed one (' + buf.length + ' B)');
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
  if (s.includes('arbiter-regen')) console.log('sw.js: already bumped');
  else {
    const re = /^const CACHE = 'mojiworld-assets-v(\d+)';.*$/m, m = s.match(re);
    if (!m || (s.match(new RegExp(re.source, 'gm')) || []).length !== 1) die('sw.js: CACHE line not found once');
    const EOL = s.includes('\r\n') ? '\r\n' : '\n', N = +m[1];
    const line = '// arbiter-regen - v' + N + ' -> v' + (N + 1) + '. 45 Tower Arbiter frames (idle, walk, swing, pillar, verdict) are REPLACED under' + EOL +
      '// their own names (regenerated without slices), so a returning install would keep drawing the old frames for a session.' + EOL +
      "const CACHE = 'mojiworld-assets-v" + (N + 1) + "';   // arbiter-regen: the Arbiter's frames regenerated under their own names. v" + N + ' was: ' + m[0].replace(/^[^/]*\/\/\s*/, '').slice(0, 160);
    swOut = s.replace(m[0], () => line);
  }
}
// ---- CALIBRATION (in-game pass, per user: "after regeneration, calibrate" / "no jumps between states"). Measured in the game
// on the new art, frame 0 of each state against the idle's frame 0, relative to his foot point: his height (plume top to feet),
// his feet line and where his boots stand. Walk 0.989, swing 1.001 and lunge 0.998 of the idle's height
// matched already and stay; the pillar drew him at 0.931 and the verdict (its new inverted-sword art) at 0.995 of the idle, so
// their s is re-solved (pillar 1.9709 -> 2.1176, verdict 2.18 -> 1.9895), feet on the idle's line (dy), and dx puts his HELM
// where the idle's is (the pillar stood 29 px off it on the shipped art too; the swing's helm already matched, 0 px). His boots
// are not the anchor: each set's stance plants them differently (aligning the boots shoved his body 55 px sideways).
// Baked the project's way: an LX_ANIM_PATCH:1 blob per entity through scripts/apply_anim_patch.mjs (frame timings kept).
// [entity, calib block before, calib block after, hitbox block before, hitbox block after]
const CALIB = [["towerArbitercolumn",{"attack":{"s":1.9709,"dx":0.1828,"dy":0.001,"ft":[100,110,120,130,160,140,120,110,110]}},{"attack":{"s":2.1176,"dx":0.146,"dy":0.0023,"ft":[100,110,120,130,160,140,120,110,110]}},null,null],["towerArbiterverdict",{"attack":{"s":2.18,"dx":0.155,"dy":0,"ft":[80,90,100,110,130,150,120,110,110]}},{"attack":{"s":1.9895,"dx":0.0975,"dy":0.0024,"ft":[80,90,100,110,130,150,120,110,110]}},null,null]];
const calF = path.join(ROOT, 'data', 'anim_calib.js');
const readCal = () => { const s = fs.readFileSync(calF, 'utf8'); return JSON.parse(s.slice(s.indexOf('window.LX_ANIM_CALIB = ') + 23, s.indexOf('window.LX_ATK_HITBOX = ')).trim().replace(/;$/, '')); };
const readHb = () => { const s = fs.readFileSync(calF, 'utf8'); return JSON.parse(s.slice(s.indexOf('window.LX_ATK_HITBOX = ') + 22).trim().replace(/;\s*$/, '')); };
const calTodo = [];
{
  const cur = readCal(), hb = readHb();
  for (const [ent, ov, nv, oh, nh] of CALIB) {
    const c = J(cur[ent]), h = J(hb[ent] || null);
    if (c === J(nv) && h === J(nh || null)) { console.log('anim_calib.js: ' + ent + ' already calibrated'); continue; }
    if (c !== J(ov) || h !== J(oh || null)) die('anim_calib.js: ' + ent + ' is ' + c.slice(0, 160) + ' / hitbox ' + h.slice(0, 80) + ', neither the old nor the new calibration - recalibrate on the new values');
    calTodo.push([ent, nv, nh]);
  }
  if (calTodo.length && !fs.existsSync(path.join(ROOT, 'scripts', 'apply_anim_patch.mjs'))) die('scripts/apply_anim_patch.mjs missing');
}

// ---- scripts/boss_frame_repair_test.mjs: its Tower Arbiter rows pinned the v0.30.1776 repairs (sha256, probe pixels, table
// values) of frames this regen replaces, so they are retired (14 SIDES + 20 PATCHES rows, Libra's stay; its live checks
// still spawn the Arbiter and decode every set). The new frames are checked by scripts/arbiter_regen_test.mjs.
const BFRT = path.join(ROOT, 'scripts', 'boss_frame_repair_test.mjs');
let bfrtOut = null;
if (fs.existsSync(BFRT)) {
  const s = fs.readFileSync(BFRT, 'utf8'), EOL = s.includes('\r\n') ? '\r\n' : '\n', L = s.split(/\r?\n/);
  const NOTE = '// arbiter-regen: the Tower Arbiter rows were retired - his sets were regenerated (scripts/arbiter_regen_test.mjs checks them).';
  if (s.includes(NOTE)) console.log('boss_frame_repair_test.mjs: already trimmed');
  else {
    const a = L.findIndex((l) => l.startsWith('const SIDES = [')), b = L.findIndex((l, i) => i > a && l.startsWith('];'));
    const c = L.findIndex((l) => l.startsWith('const PATCHES = [')), d = L.findIndex((l, i) => i > c && l.startsWith('];'));
    if (a < 0 || b < 0 || c < 0 || d < 0) die('boss_frame_repair_test.mjs: SIDES / PATCHES tables not found');
    const n1 = L.slice(a + 1, b).filter((l) => /towerArbiter/.test(l)).length, n2 = L.slice(c + 1, d).filter((l) => /towerArbiter/.test(l)).length;
    if (n1 !== 14 || n2 !== 20) die('boss_frame_repair_test.mjs: expected 14 + 20 Arbiter rows, found ' + n1 + ' + ' + n2 + ' - it changed on origin');
    const keep = L.filter((l, i) => !(((i > a && i < b) || (i > c && i < d)) && /towerArbiter/.test(l)));
    keep.splice(keep.findIndex((l) => l.startsWith('const SIDES = [')), 0, NOTE);
    bfrtOut = keep.join(EOL);
  }
}

// ---- scripts/tower_anim_motion_test.mjs: the pillar's motion floor. Its old set reached 8.88 on that measure mostly through
// the burst of light rays this regen removes (they were the sliced art); the new pillar - the sword raised point to the sky,
// the blade lighting up, lowered again - measures 5.93 in the same region, against 3.58 for the near-static set the floor was
// written to reject. The floor moves 6 -> 5 for the pillar. The VERDICT row follows its new art (per user: the sword held
// inverted, point down at his feet, the flame kindling, blazing and dying back - frame 0 384 px tall at x 676, motion 1.17 from
// the fire alone; floor 1). The Sovereign keeps its row.
const TAMT = path.join(ROOT, 'scripts', 'tower_anim_motion_test.mjs');
let tamtOut = null;
if (fs.existsSync(TAMT)) {
  const s = fs.readFileSync(TAMT, 'utf8');
  const OLD = "region: { x: 347, y: 665, s: 654 }, minMotion: 6 },", NEW = "region: { x: 347, y: 665, s: 654 }, minMotion: 5 },   // arbiter-regen: no ray burst (5.93; the near-static set was 3.58)";
  const OLD2 = "towerArbiterverdict:  { canvas: [1500, 1300], h: 550, bottom: 1300, cx: 651, region: { x: 153, y: 337, s: 996 }, minMotion: 2.5 },";
  const NEW2 = "towerArbiterverdict:  { canvas: [1500, 1300], h: 384, bottom: 1300, cx: 676, region: { x: 153, y: 337, s: 996 }, minMotion: 1 },   // arbiter-regen: per user the sword is held inverted, point down, and the flame does the moving (1.17)";
  if (s.includes(NEW) && s.includes(NEW2)) console.log('tower_anim_motion_test.mjs: already updated');
  else if (s.split(OLD).length !== 2 || s.split(OLD2).length !== 2) die('tower_anim_motion_test.mjs: the pillar / verdict rows changed on origin');
  else tamtOut = s.replace(OLD, () => NEW).replace(OLD2, () => NEW2);
}

// ---- write
for (const [rel, dest, buf, nSha] of plan) {
  atomic(dest, buf);
  if (sha(fs.readFileSync(dest)) !== nSha) die(rel + ' did not verify after the write');
  console.log('frame: ' + rel + ' replaced (sha ' + nSha.slice(0, 12) + ' verified)');
}
for (const t of tables) { atomic(t[0], t[1]); console.log(path.basename(t[0]) + ': ' + t[2] + ' value(s) updated'); }
if (swOut) { atomic(SW, swOut); console.log('sw.js: CACHE bumped'); }
if (bfrtOut) { atomic(BFRT, bfrtOut); console.log('boss_frame_repair_test.mjs: Arbiter rows retired'); }
if (tamtOut) { atomic(TAMT, tamtOut); console.log('tower_anim_motion_test.mjs: pillar floor 6 -> 5, verdict row re-measured'); }
// calibration last: one LX_ANIM_PATCH:1 blob per entity (its whole calib block, and its hitbox block when it owns one - the
// patch is declarative, a blob without hitbox would delete it), baked by the project's own tool (atomic, node --check inside)
for (const [ent, nv, nh] of calTodo) {
  const blob = path.join(ROOT, 'scripts', '_arbiter_regen_patch_' + ent + '.json');
  fs.writeFileSync(blob, JSON.stringify(Object.assign({ LX_ANIM_PATCH: 1, type: ent, calib: nv }, nh ? { hitbox: nh } : {})));
  try { execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'apply_anim_patch.mjs'), blob], { cwd: ROOT, stdio: 'pipe' }); }
  catch (e) { die('apply_anim_patch.mjs failed for ' + ent + ': ' + String(e.stderr || e.message).slice(0, 200)); }
  finally { try { fs.unlinkSync(blob); } catch (e) {} }
  if (J(readCal()[ent]) !== J(nv) || J(readHb()[ent] || null) !== J(nh || null)) die('anim_calib.js: ' + ent + ' did not take the patch');
  console.log('anim_calib.js: ' + ent + ' calibrated ' + J(nv).slice(0, 120));
}
console.log('arbiter-regen assets: ' + plan.length + ' frame(s) replaced');
