// gravitos3-hq, the assets + calibration half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA files are re-synced from origin).
// It does NOT trust that re-sync: every text file it edits is rebuilt from origin's blob + its rows, and every frame's original is checked
// on origin (THE BASE IS ORIGIN'S BLOB, the boss-feet-calib rule).
// Per user: "lets use the current calibrations as I see on the current link's, just need to make the sprite art of the gravitos3 more HQ",
// then method A from a sample sheet: "Remove the compression blocks, AI upscale, shrink back, light sharpen" (the slight face shimmer accepted).
//   ART - all 69 Gravitos form-3 frames REPLACED under their own names on unchanged canvases: each deblocked (bilateral), AI-upscaled
//     to 4K, reduced ONCE (lanczos) onto its canvas with its set's approved transform folded in, lightly sharpened (luminance unsharp
//     sigma 1, amount 0.5, threshold 2) and saved as lossy WebP q94 + smart deblock with LOSSLESS alpha. The alpha is the approved
//     alignment's byte for byte: origin's for idle / walk / supernova; for the slam / fire beam / punch / soul drain the approved
//     "default-aligned" re-bake (one uniform transform per set so its frame 0 stands where idle's does: x1.0062 / x1.0065 / x1.0061 about
//     the back heel, dx -2.2 / -3 / -1.65 art px; the soul drain dx -3 px). Then the tables that describe those pixels, each value from its
//     own generator on a mirror holding the new frames (data/sprite_bbox.js, sprite_edges.js, anim_calib_manifest.js + its stamp,
//     boss_resize_manifest.js), and sw.js CACHE +1 (the art is replaced under its own names).
//   CALIBRATION - data/anim_calib.js through scripts/apply_anim_patch.mjs (LX_ANIM_PATCH:1): form 3's ONE calibration dy 0.0129 -> 0.0259
//     (the user-approved depth) on every body state; his supernova s 1.3 -> 1.0485 (idle's drawn size on its own canvas), dy -> 0.0259;
//     its player-attack hit region scaled x1.3/1.0485 so it stays the same box in the world. s, timings and the other hit boxes kept.
//   TEST PINS - gravitos3_anim_test (the supernova is no longer drawn enlarged: it joins the one-body check), gravitos_feet_plant_test
//     (form 3's floor pins at the new depth) and boss_feet_calib_test (form 3's floor expectation).
// GUARDED: each replaced frame must hold EITHER origin's bytes OR the new ones; each table value EITHER the old OR the new value; each
// calibrated state EITHER the old OR the new s/dx/dy; each test pin EITHER its old OR its new text - anything else aborts before writing.
// Idempotent. LX_ASSET_ROOT points it at a mirror of the repo; LX_G3HQ_SRC at the folder holding the new WEBPs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_G3HQ_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/g3hq/final';
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
// ==== GENERATED TABLES (fa_reports/g3hq/tables_g3.mjs) ====
// FRAMES: [repo path, original bytes, original sha256, new bytes, new sha256]
// PATCHES: [table file, its "window.X = " prefix, path into the object, old value, new value]
const FRAMES = [
  ["Sprites/bosses/idle/gravitos3_0.webp",169278,"01b7b54470785a55e28498fd0e6225f00d8b26eb6b3b28b0616283f64130f028",231962,"c4c1010036f8e5465ecf105973a1f171d61a7c672f263a485657300eead1a67d"],
  ["Sprites/bosses/idle/gravitos3_1.webp",171458,"3376b8d3c2762ada0c3324638afd6ae3f73d69ab5002020950efb844fab37323",233780,"08f50137cc6c57417131268197c1ffd3d9501c76da1cb27cbe4399fca593d2d5"],
  ["Sprites/bosses/idle/gravitos3_2.webp",176504,"c449b5250a2b6be0e72ba317db395a4e8b02a4b2f52e83ba0bb9a282979065a8",236184,"f0d2a10cd3974c2f1b39ae507dd1955288f8f89430d867c41457b6805d0404f3"],
  ["Sprites/bosses/idle/gravitos3_3.webp",177436,"27de3d1cb7cfb150a5a2418706dc751b2c9fc9c8f4e61ab1f70bec4fedec079f",232196,"cef4411ab84bb59ef3c7a99da640a1313fdb12ca164d63c15f708ff07488b27f"],
  ["Sprites/bosses/idle/gravitos3_4.webp",179502,"cfc6cc925ddf46a94f66b72cf3c30c1eef185ef46cea91a3789ba08124129376",236004,"6f34ffa081233d56d4a8d1b9cc598dc86dae8b5ebe86fe618d2f6213a1f01e3a"],
  ["Sprites/bosses/idle/gravitos3_5.webp",191336,"8f6f071740c93d16f76051e0c0df2ba9538ab69889ab9cc3b011af0ad3e7f1ac",242222,"0d7fc8d38a3533e032b33d2c23a93c7c3f953bbdb0021341fe3f0e89353219b0"],
  ["Sprites/bosses/idle/gravitos3_6.webp",190660,"1e65703b2430d92aff47e285fe3f3ebaa746724891246b16e9d8c42c5d138c8f",245254,"232ab8e8d594b3c1fc2d109a5ed2d56cd8bf5c356653364bedbca89c8c96ef3c"],
  ["Sprites/bosses/idle/gravitos3_7.webp",181524,"012758c4a3d6ecc26713ccbf026da2c9ff7158f5a97e5f6ba6e45e4e48aed21b",233466,"92db427d7da863f8f5c6591bd398c832f20ef6d26534db96d9917cc469c96a79"],
  ["Sprites/bosses/idle/gravitos3_8.webp",165232,"e58c95db6c72e0421c43b36940356c60f3bd91c706c3fd71137ce4dc0a02623f",226172,"a0c6922be07ab14bc7e0a240ff1181d0d8ede5332e059539256ecf1ba7b24f9c"],
  ["Sprites/bosses/walk/gravitos3_0.webp",213922,"a575526ddfb92b3824b1f058da9385d9a2ce5cdc6adac254ad43c4c8a485e505",219024,"7394814863a31f1f392d6e1729c29b98d7e47ea29efaab786cce65c1a9dac3ca"],
  ["Sprites/bosses/walk/gravitos3_1.webp",203492,"3ba90783679a8fbac827956b9d171cf36424291faf5140656fc1e5847a3a04e6",205342,"b5c6e5d978aedb514a6eb7b61867ede5364b8c3389ba89655d400fa7e743396a"],
  ["Sprites/bosses/walk/gravitos3_10.webp",189610,"7132b087f3b9686aca74b68953c406a8210880c0051299a6592fd5b52e73798f",194272,"79126bb830dd40b6348939fb566a6a556b0cef03d394759689a800162b034faf"],
  ["Sprites/bosses/walk/gravitos3_11.webp",189096,"b06a1dd5d47fa7c5fdda86c034032473292e16dc656ff0d4744b7f4647851bc0",195264,"f8b529616ccbab6ed106ab287ec3b7c98342047d87109c91893f2ccfa2beb102"],
  ["Sprites/bosses/walk/gravitos3_12.webp",194216,"fec3ddb78fc4e751444fe5f77b2b32c69344873039400d81cea92a52c3657e69",200168,"3ee399872aa49ca59addbccd515d8b56684dfa70e12510481cb0f8f42222be20"],
  ["Sprites/bosses/walk/gravitos3_13.webp",194658,"2f0b75bff8f311af48551290dcf4ec99befeeeb2dc2c201f6c53a493963a5d66",201972,"da0eb954c91f0b230669eb92d2598f440b0dd9512ad3b248a90ce1679b380e4a"],
  ["Sprites/bosses/walk/gravitos3_14.webp",203374,"73873504e6e9710df3a1baf5268133cdd6555b500739376f9666515f1b480419",206178,"0d32c316f5d5c5aa7d18377dc76c5573df57dab504ea92f834b7523d6381d823"],
  ["Sprites/bosses/walk/gravitos3_2.webp",191840,"3c6d2de907fb50c038aba190b0904106c81e8702460476b76b25a143bc33ffdc",201142,"634cc919203756078fb5a786f68c829c3d636e1c4b527aa75fbc7f005682b691"],
  ["Sprites/bosses/walk/gravitos3_3.webp",186402,"be9d8464a4d4125d78397926d97783ef4e5a6c1e237642963640002d7ca3266f",194030,"a69c05bc006790a23d92ee140e26c2476c09c77347b0faf062a6236a8ececbab"],
  ["Sprites/bosses/walk/gravitos3_4.webp",192082,"4e4d3a4b9ff752e3c227b024e3df31f284e5de2fe9a74f0f41b73ee0cc90c95c",193836,"e12bebb43da70a85a9cd55dec6664abe0acf4f1e801ccf8830f2fd4d4265d4cf"],
  ["Sprites/bosses/walk/gravitos3_5.webp",189742,"7f46bafa6b67677f9ae7dd64c4d2b7f296fa098ffeb812cc31e1de1d97ce36d9",195366,"cdfeda5f8c735dc43789ec154357624d05b9fdf5180be5edfd485f26955b441e"],
  ["Sprites/bosses/walk/gravitos3_6.webp",195472,"13f925e126a75eaa617d0d34e5f515dc258cf1995e945ea6681cbe0c30447114",192692,"713dab11ef8e806345c8a09f08915a6ff1f4d7d8934c3b74cf152c78edc84650"],
  ["Sprites/bosses/walk/gravitos3_7.webp",193306,"7a0d8d7e05732bfd09ffcfd513cd0e8177a13b5f1305e7f40814362e3611fd59",193074,"7ac22ba382f2fe7890097d2ef87de6096531261774bcf84bb745329f953bb85f"],
  ["Sprites/bosses/walk/gravitos3_8.webp",188280,"467cb3ad71c37fe39f3a22feb9632d0834ab92582fd037cab112ae3e2a73053c",193274,"229ae46e327f09a4abbb89fb9ab273d840cd9151108d91f16293649e79f695c0"],
  ["Sprites/bosses/walk/gravitos3_9.webp",189478,"9235ed19c1fb2026371c4d3999b784955b2369ea716d528d46fb5b374da82fc3",198768,"93962638f5e2435e56379579da2a9d0953fc9f819e1a51680b738bf967bb52a9"],
  ["Sprites/bosses/attack/gravitos3_0.webp",166128,"bb2dca66bde5593e7b46da9d500e175603876bc27068c380a69eaa1d97ae2ada",216160,"0f2e2311f1d2659f575235c71884a8c5652d92e0d10c0f99e9bea9ba64a11ac7"],
  ["Sprites/bosses/attack/gravitos3_1.webp",167888,"850d8523d1de2d6be4be695130e40c6c20610c021fe0ebd6610eea96712dedc4",207994,"a3d2f9a71372eedb3b3bea5f33ac87e347d2b3888c77b023a6c436c5bf4b0858"],
  ["Sprites/bosses/attack/gravitos3_2.webp",156578,"34c0fd700f97d4e83ce790e37fcf6edfd1056285118ebca27e2bc2cfac53fa9a",199170,"b25e26080f954f8dcbe0e21d82a6309c32065f40a60ea308362ea5fb77dd2eea"],
  ["Sprites/bosses/attack/gravitos3_3.webp",156688,"b35a66f7f53ccb7b7025dba1d35be53b574eb48e31958a248ca8c1b6807362a7",199154,"b980a00469d8149b325c6a4fadda6724ab468b8d954a3a1cfd78ee1ebadf640b"],
  ["Sprites/bosses/attack/gravitos3_4.webp",153924,"07638cf841605f04dc0903adb66fa8a5c2f2ad9dc45ae5d0f8af94756cc38e3d",196132,"cec1afb75b45258f0d22a4a51965ba3ffe52a6edf5f9f9f64e749d6e077cac1d"],
  ["Sprites/bosses/attack/gravitos3_5.webp",213972,"7fe15f240b9618fa8806e10d1d736ce1c74ed853146813520e0bbc7d3baebda5",257898,"a2aed96f87ba1ad7902875263a7cb8e0a59b1e4a67c220c047f998b562a0ec92"],
  ["Sprites/bosses/attack/gravitos3_6.webp",215848,"54ad9907927f832778560940138f9ce264ebde1c7eea8537b5e3f4e44926a32f",273844,"fea91c102d19fa3bf7e4b40f9cc7f38d3f4cc6c4c20aa57be877a71a55cdcf97"],
  ["Sprites/bosses/attack/gravitos3_7.webp",218024,"932042ab908f46630196e48c02d7e75ac8bc78d0555fc066ca4d67e90df8fe12",258068,"265aac4b289c54643ca36eb9b7fa5e8d05e743035855317f772b7db930f0d7b2"],
  ["Sprites/bosses/attack/gravitos3_8.webp",166280,"1fba857b0cb5d954d06407982d59cc8a872e9c92420af6f8090a7260b37fb648",218082,"59d79792a346491b9941c15a4063a18bd277d6c64c082941da1a634a5c1f2692"],
  ["Sprites/bosses/attack/gravitos3laser_0.webp",169882,"20358737c34556ce1b278bc253396d953d35ad189ad4f26ab9f2b1709a280912",215142,"78faf0cdbb41492bf96e3e66356c3678f0cf1cf40eef0272dc2c1f62fe1d2948"],
  ["Sprites/bosses/attack/gravitos3laser_1.webp",162458,"5a8b63b52ec747c601137f3c767ca894ac1137414656946b72b7c1dec5206d62",206746,"0e47852744446785e77a04f4312afa52d30d171ba3e435ef661f1accc6612ca9"],
  ["Sprites/bosses/attack/gravitos3laser_2.webp",172172,"e2a8886dfc154dd67dda867daf9baa3bb9cb7367dbe4291a1affadf176fda7cc",214070,"8e162ff6c0ac6fbfc252fb75e0cc3441a0c2e0a53538003ebf23769056777a60"],
  ["Sprites/bosses/attack/gravitos3laser_3.webp",172588,"2c69c3355cbe73c845a4cee2660da34bdee2cdc60647a9fa7834c6faa94d402d",215916,"3730d47be92c04c3d3d8158bd6fa04bc418080c1ef8b672539fae1bff4152a21"],
  ["Sprites/bosses/attack/gravitos3laser_4.webp",211562,"595927261160a302bdaf14f5175c492800e81c346ab7a8495e56ef87b99a7738",246208,"da5d04bf6fd6817ae3d79d5fdab3d0d151310d627eb57c276f3d647961d60c5d"],
  ["Sprites/bosses/attack/gravitos3laser_5.webp",242486,"bb4edf4f8956ccfe5fdf3273221debea1befd6cc8b1fdd7ca0171a1831cfc91d",271556,"526d4dba161c5b1dabbc1f0b913104345c48c7e3c51a641aec47a782c20cb8e5"],
  ["Sprites/bosses/attack/gravitos3laser_6.webp",253586,"a097c1aa30c4bc721539b0a939ea39e10060d21dc4c3b0f286fb25e5ad1f64ea",288594,"f1c8682f102097bf1bdaec8192344ba56ef199b1f62ae8529cf50d25555d33c0"],
  ["Sprites/bosses/attack/gravitos3laser_7.webp",229900,"ec996a0d83e588b3b6650aa98b7d99dcbc4841e21a62a017b6f44a6599989d93",250272,"447f85cd80b1a0560deb2dcafd2d526c5d8d3478ba1479f25ad81009c10e4054"],
  ["Sprites/bosses/attack/gravitos3laser_8.webp",166156,"4f433c25f5c95620ff5e6f8d23473f809cfc7393cd8879cea587012d7e9a5744",218558,"07a5a894e75ec1821b0274b0ef28c0ef3e59f1134243fbab1170f2deabae0c50"],
  ["Sprites/bosses/attack/gravitos3punch_0.webp",168110,"40662ec20a53a4addae75cd5813c0ae9bc4d3b5fa0001c76cacea568b74826e2",214412,"a9886e6891cd079313592c414934c1be517baf374c06606481b9d697dd89fc84"],
  ["Sprites/bosses/attack/gravitos3punch_1.webp",147002,"461ea815c17623f48394f896df7d99c5ec951cb20a5c132017e1f274314fffaa",183380,"2f04ba1c3809a02420d59d053284ee8ba79a7d770e41a31b622f8ad180d340ef"],
  ["Sprites/bosses/attack/gravitos3punch_2.webp",147206,"cd6f9d146716307bfeddaffc511d19d8959e217dbc31e8556001c7abd835dae1",178898,"da1c74a2981c4d1d5b8e345439a4a294726e4842d60332ac3f46b21fac19a064"],
  ["Sprites/bosses/attack/gravitos3punch_3.webp",145208,"ab2526dd11da712fec7630b564587ed76f1d6d1e21d1a5621e1a9ea4ea6eef62",182468,"e2ec1014de6db55c137dad038ba5d173097240b698d95b9ed1f25a0328161aaa"],
  ["Sprites/bosses/attack/gravitos3punch_4.webp",194856,"ba03035d4b20f10fa5a60cd578ad89852c5390bcb7433b11d594afabd2ccfcd2",205460,"57e760cf0fd562f49c1dfd4292c0e637166458f89ff0976305a1dc15d8844fff"],
  ["Sprites/bosses/attack/gravitos3punch_5.webp",246846,"e93262d66a265d582ed64eeaced57c0e59505f88843d6298bdfb855fed306426",252140,"31fcb6f3d058182c65ffd8af44d1158829359cdd1685e2afd2abef766154b40b"],
  ["Sprites/bosses/attack/gravitos3punch_6.webp",319592,"02e07713187e6bc1d7e1d46bbaa76b401f6dc5c66411147ac0155b5b80766345",296666,"ed1b853a848eb8da0d5cbfc44e632b357425b4db8152d5af8e69c7358645bba3"],
  ["Sprites/bosses/attack/gravitos3punch_7.webp",319100,"2d5bbdc773c29195d18c4ee4d679f8c8cb61cf0fc27d838330631a2cb4db3a01",294040,"19aff5326d72f7d6262cf649733a91268ee1ad61d76f684f9e67f7db9dc11a77"],
  ["Sprites/bosses/attack/gravitos3punch_8.webp",145754,"d3a992e5573bcfc07b8720771034221691bfa57f31eb5a75df341208b0553fde",179348,"7db7a5f416b7836737ceb1f7e70698bf1e30bfec5daa88aad11282da4fdb4ae8"],
  ["Sprites/bosses/attack/gravitos3soul_0.webp",161918,"96fe128a89b18dcb9461c4b0d8965e9af8b09755e72d44966e01f603769327f0",208790,"3b9aa4ec141f386dc79406e2eadfa787921b73fd5ffbc3d01584117a7271af0a"],
  ["Sprites/bosses/attack/gravitos3soul_1.webp",183166,"e495a7dd47677984cc9100ca0d3e6731cb3be928eb432ef6f8745c127e18a75f",218156,"c73b5f60c3ead7d83111865629fbb63f4d9057be779f31572f70008419540f99"],
  ["Sprites/bosses/attack/gravitos3soul_2.webp",275458,"ac5596c8d5c18124d24de63a2626c67ab328a786708eb9f38fb9aa4d13d2f28f",291902,"9af9c293ce04dceefdf970b44e4d8af38471f951cfa171e9685835f4d25ab3aa"],
  ["Sprites/bosses/attack/gravitos3soul_3.webp",276798,"492dab107bc42eaae77c0b35c2f4ddc0b04fafbc4807b2ec4dc77c587a8a4be6",290798,"d15bf6c902cdf7e8edc80da3bb17e1c0f290be0e3b2d04eb830e2bd0bcaabcb4"],
  ["Sprites/bosses/attack/gravitos3soul_4.webp",264912,"25be91e1ab97991b139532e0c6e8b785ea12186deaca36b21e5b90ecea44ba37",282246,"cda25c7f6afb6b59dc6c1ebf1e2f861bd0fc8a54ca42d485cbcad308cb0eafcb"],
  ["Sprites/bosses/attack/gravitos3soul_5.webp",234528,"b1d0b3985d29194c97e36d063cf77c4d195fb3a5a5512588a61c90c539c0923d",251162,"a6a480f13f5eb9412b2d7ff490ffc1130697e281417f89045ac8a9224f43665b"],
  ["Sprites/bosses/attack/gravitos3soul_6.webp",206508,"cbbc9fa27a78a221673e2b4f604df06d40eafff6d4978c728d8da85360ddeeea",225448,"4fc925b289e0ef6aed9093de9d5df8c5ce3d2c7b9830875dd5c90c7a8e5a56d2"],
  ["Sprites/bosses/attack/gravitos3soul_7.webp",129830,"211357c28a081a4d926f2d15fa2dff272bf65d3f4342f5c58f7c107aab83157a",160246,"4377d500c4d605cc53ff018ea967fb31ff6c1cc173567bb58afd0f5fe18c87ec"],
  ["Sprites/bosses/attack/gravitos3soul_8.webp",175104,"da010850f69d3d7a4e967d5d77387ac6c1e9dac281154936fb688d5664a85aa4",213428,"86ee9c2468bdd5b636ddf4b6f42ffa9c1f500e5c1a3e6b106e07d059841b9293"],
  ["Sprites/bosses/attack/gravitos3star_0.webp",173644,"f8090e38a42d40906be5646b8808da7fe84c43c3d6147b2b712081cb7f0f74ec",229764,"42e06a2fb9815444c6df6abca901eacb2a69abc38eee11702a1bc0724ed545af"],
  ["Sprites/bosses/attack/gravitos3star_1.webp",180950,"aad6e9807ecca75e9b084bf6c777cbae347dbe53d7989f6e9da8ce5200226920",238298,"5a117829b3934ecb55e4f5127d316d51c69ffd5df39154fc9ef299e6048d7766"],
  ["Sprites/bosses/attack/gravitos3star_2.webp",160412,"2d4f4192db516ce33b1aa361ce78f8eb8424541c5c3e34eb29a3ec245397d1c3",167020,"cdc4d0d0dbbc86c21e641c438c808183957b1a3fbd346b6365e1f5714169d19e"],
  ["Sprites/bosses/attack/gravitos3star_3.webp",173154,"e14f5ddf52742f7ef2eef2cc33a15814824e832f4174812b580308e10eefa4c9",184588,"5318d4dcabf64344f329b6a0125dccc857e53de56edb7736dabef784480c2d01"],
  ["Sprites/bosses/attack/gravitos3star_4.webp",188766,"ba0149a01f10f1201c1e3600eb44439a9fd4f0cecbcdab277b4bb23fac2309da",199696,"b9e0e4a9ec882c660dc398afc91add54f782ce690f80c6a7f68496c79df4da4f"],
  ["Sprites/bosses/attack/gravitos3star_5.webp",196590,"43081dcf88db37076f74bb443a7abe9c018cdcbf1b7102031ecf6c4b716b61e1",238880,"89c4a796fbfb532bd1dd353b2feab79b22f535ba6959e886ef5b9e11b6f60b07"],
  ["Sprites/bosses/attack/gravitos3star_6.webp",454220,"db624f33ddae4fb071331e72a4a734206b87866730955150de2768c784130111",423786,"b71d532fe18db0203973006791971fe168d74713cb7ea7d87ed4fa68d40bc9da"],
  ["Sprites/bosses/attack/gravitos3star_7.webp",375968,"d8c6bec6befc6fcfa3ee11a209ce2997e7cdcc4867462b987f843fd444531826",358744,"e5285ec6b3846b3d66e69a7e2a7c4995200191cfec6f0cc933558a77dc280180"],
  ["Sprites/bosses/attack/gravitos3star_8.webp",177788,"e8ca0253c6042bf24e0251b378845ce3a04f01c47c94ca2f6bc65861f7f3d5f6",235278,"9b112c261518b8d04b455295bb3fbab111a3482d0bbb0502bbc1d4dc1bb871f4"],
];
const PATCHES = [
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_0.webp"],"309,1213,2174,1214","303,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_1.webp"],"317,1213,2174,1214","312,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_2.webp"],"318,1213,2174,1214","312,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_3.webp"],"317,1213,2174,1214","312,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_4.webp"],"320,1213,2174,1214","314,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_5.webp"],"276,1213,2174,1214","270,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_6.webp"],"184,1213,2174,1214","178,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_7.webp"],"161,1213,2174,1214","154,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3_8.webp"],"327,1213,2174,1214","322,1213,2174,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_0.webp"],"315,1213,2250,1214","309,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_1.webp"],"306,1213,2250,1214","300,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_2.webp"],"312,1213,2250,1214","306,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_3.webp"],"308,1213,2250,1214","303,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_4.webp"],"313,1213,2250,1214","307,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_5.webp"],"287,1213,2250,1214","281,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_6.webp"],"288,1213,2250,1214","282,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_7.webp"],"302,1213,2250,1214","296,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3laser_8.webp"],"317,1213,2250,1214","311,1213,2250,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_0.webp"],"314,1213,2004,1214","308,1213,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_1.webp"],"344,1211,2004,1214","339,1211,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_2.webp"],"343,1212,2004,1214","337,1212,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_3.webp"],"334,1211,2004,1214","328,1211,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_4.webp"],"348,1206,2004,1214","343,1206,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_5.webp"],"175,1213,2004,1214","170,1213,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_6.webp"],"174,1213,2004,1214","167,1213,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_7.webp"],"155,1213,2004,1214","148,1213,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3punch_8.webp"],"334,1213,2004,1214","328,1213,2004,1214"],
  ["data/sprite_bbox.js","window.LX_SPRITE_BBOX = ",["bosses/attack/gravitos3soul_4.webp"],"132,1213,1714,1214","133,1213,1714,1214"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/gravitos3laser_1.webp"],"|||4:20:28","|||5:19:28"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/gravitos3laser_5.webp"],"|||23:12:35","|||22:12:35"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/gravitos3laser_7.webp"],"|||19:12:35","|||18:12:35"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/gravitos3punch_6.webp"],"|||21:2:35","|||23:1:35"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/gravitos3soul_1.webp"],"|||9:18:31","|||10:18:31"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/gravitos3soul_2.webp"],"|||13:12:31","|||12:12:31"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/gravitos3soul_3.webp"],"|||23:8:38","|||24:8:38"],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/attack/gravitos3soul_4.webp"],"|||20:13:39","|||19:13:39"],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",0,0],309,303],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",0,2],314,309],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",1,0],318,312],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",1,2],327,321],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",2,0],318,313],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",2,2],323,318],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",3,0],318,312],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",3,2],322,317],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",4,0],320,314],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",4,2],325,319],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",5,0],276,270],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",5,2],280,274],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",5,3],1212,1211],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",6,0],185,179],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",6,2],190,184],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",7,0],161,154],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",7,2],166,160],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",8,0],328,322],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3","states","attack","cb",8,2],337,332],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",0,0],315,309],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",0,2],321,315],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",1,0],306,301],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",1,2],312,306],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",2,0],312,307],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",2,2],317,312],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",3,0],309,303],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",3,2],314,308],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",4,0],313,307],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",4,2],319,313],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",5,0],287,281],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",5,2],292,286],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",6,0],288,282],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",6,2],292,286],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",7,0],302,297],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",7,2],311,305],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",8,0],317,311],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3laser","states","attack","cb",8,2],322,317],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",0,0],314,308],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",0,2],319,314],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",1,0],344,339],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",1,2],349,344],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",2,0],343,338],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",2,2],349,343],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",2,3],1209,1208],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",3,0],334,329],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",3,2],344,339],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",4,0],348,343],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",4,2],359,354],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",5,0],178,172],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",5,2],277,272],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",6,0],177,171],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",6,2],197,191],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",7,0],155,148],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",7,2],156,150],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",8,0],334,328],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3punch","states","attack","cb",8,2],339,334],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3soul","states","attack","cb",0,2],318,319],
  ["data/anim_calib_manifest.js","window.LX_ANIM_MANIFEST = ",["gravitos3soul","states","attack","cb",8,0],309,310],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",0,"c",0],309,303],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",0,"c",2],655,651],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",0,"c",3],1533,1534],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",0,"s",0],314,309],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",0,"s",2],659,656],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",0,"s",3],1528,1530],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAwQGDQ8QERIRDxMUFRYaGxweHyQ6WVtcXF1gYWRkZWVlZWVmSUpmZmZmZ2dnZyknKSkqLS4vMTI1NjY2NjY2NjUgGBgXFhcXFhYWFhUUExIRFhcXGBgYGBgXFxYVEg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBAQNDxAREhIQExQUFhcaGx4fJDpZW1xcXWBhYWVlZWZmZmZmSmZnZ2dnZ2doaCgnKSoqLS4wMjM2NjY2NjY2NjUgGBgXFhcXFhYWFhUUExIRFxcYGBgZGBgXFxYVEw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",1,"c",0],318,312],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",1,"c",2],618,614],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",1,"c",3],1561,1562],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",1,"s",0],327,321],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",1,"s",2],621,617],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",1,"s",3],1556,1558],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwUGDQ8REhMVFRUWGBscHB4hMzdbXF5hZGVmZ2doaGlpampra2xsbW1tbm5MGhkxNTYdHiAhIiIjKCkqKisrKywWGBcXFhUXFxYWFhUVFBMRExYXFxgYGBgXFhYUEg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAUMDhARExQVFhYYGxwcHR4hN1tcXV5iZWZnZ2hpaWpqa2tsbG1tbm5ubmExGTEyNhwdHiEiIiImKCkqKisrLCwWGBgXFhcXFxYWFhUVFBMRFBcXGBgYGBgXFxYVEw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",2,"c",0],318,313],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",2,"c",2],600,596],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",2,"c",3],1581,1583],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",2,"s",0],323,318],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",2,"s",2],604,600],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",2,"s",3],1576,1578],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",2,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwUMDhARExkZGxcaHB0dHiAjJDheX2VmZ2hpamprbGxtbm9vcF1HXHFyY0VFRURCOjseHiAhIiIjJikqKyssLCwXGBgYFxYXFxYWFhQVFBMSERcXGBgYGBgXFxYVEw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQYNDxESFBocFxoaHR0eHyAjM15fZWdnaGlqa2tsbW1ub3BwcV1JXXJkRkZGRUQ6OzseHiEhIiMmKCorKywsLCwXGBgYFxYXFxYWFhQVFBMSExcXGBgZGRgXFxYVEw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",3,"c",0],318,312],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",3,"c",2],610,606],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",3,"c",3],1574,1576],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",3,"s",0],322,317],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",3,"s",2],615,611],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",3,"s",3],1569,1571],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",3,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgUFDg8REhQZGBgWGRwcHR4iIjddXl9lZmdoaGlqamtrbGxtbm5bW1twcERERENCOTo6HiAhIiQkKCkqKisrLCwWGBgYFxYXFxYWFhUVFBMSERcXGBgYGBgXFxYVEg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAUNDxASFBkWGBYZHBwdHiAjN11eX2NmZ2hpaWpqa2tsbW1ub29bW1twRUVERENCQjsgHiEhIiQoKCoqKyssLCwXGBgYFxgYFxYWFhUVFBMSExcXGBgZGRgXFxYVEw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",4,"c",0],320,314],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",4,"c",2],604,600],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",4,"c",3],1582,1584],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",4,"s",0],325,319],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",4,"s",2],609,604],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",4,"s",3],1578,1580],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",4,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgQFDQ8REhMVFhgWGRwdHR4kJDleX2FmZ2hpamprbGxtbW5ub3BwXFxxcUVFRURDQzs7JiYlJCQnKCkqKisrLCsWGBgYFxgXFxYWFhUVFBMSExcXGBgYGBgXFxYVEw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwUMDhARExQWFxgWHBwdHh8lOV5fYGNnaGlqa2tsbG1ubm9vcHBdXFxyRkZFRURDQzw8JiYkJCUoKCkqKyssLCwWGBgYFxgXFxYWFhUVFBMSFBcXGBgZGRgXFxYVEw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",5,"c",0],276,270],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",5,"c",2],197,191],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",5,"c",3],2134,2141],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",5,"s",0],280,274],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",5,"s",1],1212,1211],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",5,"s",2],202,196],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",5,"s",3],2012,2018],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJFSksLTtAQkRLTk5NTlBRUTg2NDc4ODM6NUqDhoWFhYWFh4mRq6impaSjoqOkpYeHh4aGhISDg4aGXlhWVFJONzEsLCweHh4cGBYXFxcWFhcbFBMSExcXGBgYGBgXFhYVEw8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcQKCssOT5DQ0lNT09OUFFSUjc1Nzg5NDo6SoOHh4aGhoZzinusq6inpaWko6SmpoiIiIeHhYSEhIeHXFhWVFI+Ni8sLCweHh4aGBYXFxYWFhcbFBMSFhcXGBgZGRgXFxYVEw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",6,"c",0],185,179],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",6,"c",2],184,177],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",6,"c",3],2137,2141],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",6,"s",0],190,184],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",6,"s",2],203,196],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",6,"s",3],2012,2017],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAABYiJS01Oz5CRUg3NTIxMzU4Ojo7Ojo6NjY1MDAwMDIyMzQ8PU2PkXtwaHByc3mYoKampqWlpKSkpYeIiIeHhoODg4aGh4deWldUUDAsLCwgHhsbGRcYFxYWFhUVFBMSFhcXGBgYGBgXFxYVEw8=","AAAAAAAAAAAAAAAAAAAAAAAADCEkKTM5PkFESDg2NDAzNTc6Ozs5Ozs3NjYwLzAwMDIzMzU8Tk+Rknxxb3FzdoOapKinpqalpaWmpoiIiIiIhYSEhIeHh4heWlZUTi8sLS0fHhsbGBcYFxYWFhYVFBMSFhcXGBgZGRgXFxYVEw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",7,"c",0],161,154],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",7,"c",2],192,185],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",7,"c",3],2136,2141],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",7,"s",0],166,160],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",7,"s",2],201,195],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",7,"s",3],2013,2017],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAAeJiovNTs/QjMvLS8wLy4xNjk8NjM1OTk5NTI1NTEwMDIzNDU4Pk+TiWxnamloZGGoqKenpqWlpKSlpoiIiIiHh4aFhIaGh4eHWlRTUEwtLCwiIiAeHRwYFxcWFhYVFBMSFhcXGBgYGBgXFxYVEg8=","AAAAAAAAAAAAAAAAAAAAABskKS40OT5BQy8uLjEwLy80ODs8NjU4Ojo2MTM1MTEwMDM0NDY4T1CUfGxnamlpY2Wpqainp6ampaWmp4mJiYiIh4aGhIeHiIiIV1RTTzIsLS0jIh8eHRsYFxcWFhYVFBMSFhcXGBgZGRgXFxYVEw8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",8,"c",0],328,322],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",8,"c",2],561,556],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",8,"c",3],1613,1615],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",8,"s",0],337,332],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",8,"s",2],566,562],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",8,"s",3],1608,1610],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3","states","attack","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIEBQ0PERIUFBYWGRcdHh4gJigqQWdoaW1wcXJzc3R0dXV2dnd4eHhkT2RtbDQxMDAwGzY3IiIjKCgqKysrKywWFhgYFxYXFxcWFhYVFRQTEhYXGBgYGBgYFxcWFBI=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMFDA4QERMUFhYZGRodHh8mKClBZ2lpbXBxcnN0dHR1dnZ3d3h5eWVQUGVtbTMxMDAxMzc4IiMnKCgqKyssLCwWGBgYFxYYGBcWFhYVFRQTEhcXGBgZGRkYFxcWFBI="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",0,"c",0],315,309],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",0,"c",2],699,694],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",0,"c",3],1567,1568],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",0,"s",0],321,315],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",0,"s",2],702,697],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",0,"s",3],1563,1564],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgIEBw0PEBAQDhITExUYGRodHh4xVVZXWFlcXF9gYGBhYWFhYUdFYmJiYmJiYmImJScnKyssLi4hMzQ0NDQ0MzMfFxcWFRUWFhUVFRQTEhIQFRYWFxcXFxcWFRUTEg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAgQGDQ4PEBAPDxITExYZGR0dHiNVVldYWVpcXWBgYWFhYmJiYkguYmJjY2NjYyclJScoKywuLy8kNDQ0NDQ0NDMfFxcWFRYWFhUVFRQTEhIQFhYWFxcXFxcWFhUUEg8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",1,"c",0],306,301],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",1,"c",2],659,654],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",1,"c",3],1618,1620],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",1,"s",0],312,306],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",1,"s",2],663,658],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",1,"s",3],1613,1614],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACBAYODxASEhYVFhYWGhobHB4gIVpeX2BjZGRlZWZnZ2hoaGlMTEtLa2xsWlkwJj9APxkaICAhISEkJycnJycpKSsXFxcWFRcWFhUVFRQUExIRExYWFxcXFxcWFhUTEg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDBQ0PEBESFhYWFhYaGhscHSAgWltfYGFkZGVmZmdnaGhpaWpNTUtsbGxsWlonJkBAGxkaICEhISInJycnKCgqKisXFxcWFxcWFhUVFRQUExIRFhYWFxcXFxcWFhUUEg8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",2,"c",0],312,307],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",2,"c",2],643,638],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",2,"c",3],1640,1641],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",2,"s",0],317,312],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",2,"s",2],649,644],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",2,"s",3],1635,1637],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",2,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAUNDxASGhoXFxcYGxscHCAiOF5gYGRlZmZnaGlpamtsT09OTExMQE5LRzExMRoYGBgZHB8gICIlJSYmJiYmKCkpFhYVFRQWFRUVFRQUExIRExYWFhcXFxcWFRUTEg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBQcPEBITGhgYGBgbGxscHSA2O2BhZGVmZ2doaWpqa2xsT09MTE1BT09LRjExGhkYGRkZHB8gICIlJiYmJiYoKCkqFhYVFRYWFRUVFRQUExIRExYWFxcXFxcWFhUUEg8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",3,"c",0],309,303],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",3,"c",2],647,642],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",3,"c",3],1685,1687],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",3,"s",0],314,308],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",3,"s",2],652,648],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",3,"s",3],1681,1683],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",3,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACBQYOEBESGhgXFxgaGxscHSE1OGFiY2doamxub3BxcnJzVlVRUVFQXV1cXDEvGhkYGBgZHB8fISIlJSUmJiYoKCkrFhYVFhYWFRUVFRQTExIQExYWFxcXFxcWFhUTEg8=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBQ0PERIaGhcYGBgaGxwcISE5X2JjZ2hqbG1vcHFyc3NzVlVSUVFRXl1dXDEvGhkYGBkcHh8gIiIlJSYmJiYoKCsrFhYVFhYWFRUVExQTExIQFhYXFxcXFxcWFhUUEg8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",4,"c",0],313,307],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",4,"c",2],596,591],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",4,"c",3],2191,2197],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",4,"s",0],319,313],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",4,"s",2],601,596],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",4,"s",3],2054,2058],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",4,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQYPEBMcHh8bGxsbHh8hKT1BQm1vcXV3rKytra6urq+NjImJiouampqamjIwHR0cGxgYHB4fICAlJSUmJiYoKCksFxYWFRYWFhUVFRQUExISFhYWFx0dJydMT09NOiw=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBg4QEhsdHx8bGxseHyEiLEJCbG9xc3d7ra6urq+vsI+NjIqKi4ybm5ubZzIxHR0cGhgZHh8gICIlJiYmJiYpKSosFxcWFRYWFhUVFRQUExISFhYWFx4dJydNUFBNOiw="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",5,"c",0],287,281],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",5,"c",2],440,434],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",5,"c",3],2192,2199],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",5,"s",0],292,286],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",5,"s",2],444,438],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",5,"s",3],2050,2055],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgYLDSEsLDIzNTY4MzI1NTU2Nz4+RlGQjo+AoJ+fn5COjIuKioqLjI2cm5uaYl1EOx8eGRkZGRoaICEiIiMlKCgoKSkrFhYYGBgXFhcXFhYWFRUUExIRFhYXFxgYGB46OkU=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBAsMISssLDM0Njc4MjI2NjY3OURGSpGRkH+QoaCgoJGOjYyLi4yNjZ2dnJubXkZEKB4dGRoaGhodISIiIyMmKCkpKSkrFhYYGBgXFhcXFhYWFRUUExIRFhYXFxgYGB46OkY="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",6,"c",0],288,282],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",6,"c",2],441,434],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",6,"c",3],2224,2229],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",6,"s",0],292,286],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",6,"s",2],446,440],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",6,"s",3],2050,2056],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgYLDSArLDEzNTY4MjE0NTU2N0NFSUqJiot7fY6fn5COjYuLioqLjI2cm5uaUT8yIR4dHRkZGRofICEhIiQnJygoKCgrFhcYGBgXFhcXFhYVFRUcHBQVFhYZGxwhOjtIV2U=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBAsMHyssLDM0Njg4MjI1NjY3OkVGSomKjIx+laCgoJGOjYyLi4yMjZ2dnJubTDQyHh0dHRkZGRogISEhIicnKCgoKCgrFhgYGBgXFhcXFhYWFRUcHBQVFhcZGxwhOiJJV2U="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",7,"c",0],302,297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",7,"c",2],509,503],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",7,"c",3],2200,2206],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",7,"s",0],311,305],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",7,"s",2],513,507],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",7,"s",3],2052,2058],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACCRETHiMlJigoKCgqKyssLTA+QnZ4eXt8fX+AgoNoco6NjI2NS1lYV1NQMjEvGhkYGBgZGR8gICIjJiYmJycnKSoVFxcXFhUWFhUVFRQUExISExUWFhcXODw+Pz8/Nyw=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIHCRMdIiQmJygoKCgrKywtLj5CQ3d5e3x+f4CCg4Naj46OjY5eWllYVVNPMjEbGhkZGRkZHh8gIiMjJiYnJycnKioXFxcXFhUWFhUVFRUUExISExUWFxcXODwiQEA/OCw="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",8,"c",0],317,311],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",8,"c",2],704,700],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",8,"c",3],1562,1563],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",8,"s",0],322,317],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",8,"s",2],710,706],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",8,"s",3],1557,1558],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3laser","states","attack","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgIDBg0ODxAQDg4OEhMVFRkaHR0xOFVWV1hZWVpcX2BgYGFhYWFHRWFhYWFhYWFPJiUoKCosLi8vIjI0NTU0NDQfHhwXFxYVFxYVFhUUFBMSERIWFxcXFxcXFhUUExE=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAgMFDA4PEBERDg4SExUVFhobHR4xOFZXWFlaWl1dYGFhYWFhYWFFRWFhYmJiYmInJiYoKS0tLy8vMjI1NTU1NDQfHhcXFxYXFxYWFhQUFBMSERYWFxcXGBgXFhUVExE="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",0,"c",0],314,308],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",0,"c",2],573,570],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",0,"c",3],1443,1446],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",0,"s",0],319,314],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",0,"s",2],578,575],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",0,"s",3],1439,1441],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMFDhAREhITERQVFRcbHB4fITc3YGFiY2RlaGtsbG1tbW1tUDNTbm5ubm9vb2AqKSwtMDIyNDYnOjo6Ojo6Ojk4GhkZGBkZGBgXFxcWFRQSGBgZGhoaGhoZGBcWFBA=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAwQHDxAREhMRFBUWFxgcHR4hIjdgYWJjZGVnaWxtbW1ubm5uUDRub29vb29vcC0qKSwtMjI0NTc6Ozs7Ozs6Ojk4GhkZGBkZGBgXFxcWFRQSGBkZGhoaGhoZGBgWFBA="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",1,"c",0],344,339],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",1,"c",2],488,484],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",1,"c",3],1399,1401],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",1,"s",0],349,344],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",1,"s",2],493,489],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",1,"s",3],1394,1396],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgcQERMWGyAhHh0dISEhIiMlJjEyYmNkZWZnaGtsbG1ub29wcVpaWlliX15cSyUjIRsaGyspKywvMDI2ODo7PD0eHx8eHR0cGh0hISEhIB8bGhoaGhoZGBUQDws=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBw8QEhUbHCEeHh0gISEiIyUmLjJiY2RlZmdoaWxtbW5vcHBxcltaWlljX15cSyUiHRsbGysqKywwMTI3OTo8PT4fHx8eHR0cGh0iIiEhIB8bGhoaGhoZGBUQDws="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",2,"c",0],343,338],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",2,"c",2],474,470],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",2,"c",3],1410,1412],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",2,"s",0],349,343],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",2,"s",1],1209,1208],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",2,"s",2],479,476],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",2,"s",3],1404,1405],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",2,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwgQEhUcHSMkIB8fIyMkJCgrLDNlZmdoaW1ub3BxcnN0dXVdXFtgYGBfXUw8IR8cGhkaGyUmJywtLzM2Nzg6PD4hHh8gIB8eHiIiISQkIiIgHxoaGhkYFxQQDws=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCBARFBsdHiQgIB8jIyQkJCorLUlmZ2hpa25vcHFydHR1dXVdXFthYWBfTUw8IR4bGhkaGyYmKywuMzQ3ODk7PT4hHiAgHx8fHiIiIiQkIyIhHhoaGhoZFxQQDww="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",3,"c",0],334,329],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",3,"c",2],524,521],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",3,"c",3],1455,1457],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",3,"s",0],344,339],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",3,"s",2],531,528],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",3,"s",3],1450,1452],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",3,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCQoTGyIlJicnJCMlKSoqKi0tLklKS2doaWprbW1wcXNzY2JdXFtZUE1KSUhGRENCJSQjHiMxMTIzMTY3ODk5QUJDIiQkISAfHCIjIyIhIB8bGhoaGhoZGBUQDws=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEIChMUHCQmJyckJCMmKioqLC0uNEpLTGhpamxtbm5xc3N0Y2NdXFtaTk1KSUlFRENCJSQdHyYyMTMzMjc4ODk6QUNDIiQkISAfICMkJCIhIB8bGhoaGhoZGBUQDwo="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",4,"c",0],348,343],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",4,"c",2],582,579],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",4,"c",3],1971,1977],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",4,"s",0],359,354],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",4,"s",2],589,586],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",4,"s",3],1935,1940],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",4,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQgJEhMbISUmJyMiIyUmKSo0NDMyMzQ1SUpMUVJTWHKtrYV+fn5/gICBgUIzMC8vMzQ0MzMzNjUxLzE2Nzk5QUJDQyIjIiEgJSUjJiUjIiEfGhoaGhoZFxQSDwk=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQkRExoiHiYmJyMiJSYmKio0NDMzNDVISUtRUlNTcHWuroZ+f3+AgIGCRzUyMC8zMzQ0NDM0NjUxLzE3ODk5QUNERCMjIyEgJSUkJiUjIiEfGhoaGhoZFxQSDwg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",5,"c",0],178,172],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",5,"c",2],222,217],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",5,"c",3],1919,1924],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",5,"s",0],277,272],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",5,"s",2],228,222],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",5,"s",3],1884,1888],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAQUHCAkKCwwOEBEVGxwcHB4mJygqLC8+Pj8/NjQ1Nz9UYWJiNmVmbG2srq+wsaCVlZWVmai2t7ejlYyLiomIhoWEgoB9fHx+Vk9MSUVDQD9BQ0RERDc2NTU2NygqK1JQTUlCQUE/PkJGS09PLgg=","AAAAAAAAAAAAAAAAAAAAAAAABAYHCAkLDA4PEBIbGxwcHR8nKCkrLT8+Pz43NDU2OVJWYmI2N2Zmba2vsLGysqCWlpaWnK23uLibkIyLi4qJh4aEg4B+fXt/Vk9MSUVDQT9CQ0REODc1NTU2NyYqUlJQTUlCQkE/P0JGTFBQLwg="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",6,"c",0],177,171],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",6,"c",2],36,29],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",6,"c",3],1910,1915],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",6,"s",0],197,191],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",6,"s",2],41,34],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",6,"s",3],1870,1875],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAQUQERQUGCclIyEgHh0dHh4eHh4lLi80RUVEQkFAPj0+QERFQ0NTVFRWW1GVlaGkp7nEyNDb39/Sx8O8i4pRU1NKRENDRUdITE1LR0VDQkFAQkRFRUZfXVpEQT88Ojk5OTk3OiYqLCczMzItKBo=","AAAAAAAAAAAAAAAAAAAAAAAABA8RFBQWKCckIiAfHh0eHh4eHiUnLy81RkVDQkFAPT5AQUVFQ0NUVVVbXFSWoqOmqrvHy9Pg4N3Px8ONi4pTU1NHRUNERUdJTU1KRkVEQkJBQ0RFRUdgXVtEQT88Ojk6OTk4OyYrLCgzMzItJxs="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",7,"c",0],155,148],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",7,"c",2],50,43],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",7,"c",3],1899,1903],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",7,"s",0],156,150],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",7,"s",2],55,48],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",7,"s",3],1863,1867],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAIBAgcICQsMDQ4PEBETGBkZGRkaGxwdLi4oKi0uLzQuMDAwMDA0NTY3OzxQUVNZWltdSpSUgJW3vLyZlIuKiks7Ozs7PDw8PTw5NS8uLzE2Nzk6QkNDRDQ0NjY2Nzg6OzstKCQjGxsaGhoZGBYhHgw=","AAAAAAAAAAAAAAAAAAAAAgIABQgJCgwNDQ4PEBIUGRkZGRobHB0eLy8qLS0uNC8wMDAwMTI1NTY7PFFRUlRaW1xdTpWVgLa7vb2WkIqKij47Ozs8PDw9PTo5NC8vMDI3ODk6QkNERDQ0NjY2ODk6OzstKCQjHBsaGhoZGBYhHgw="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",8,"c",0],334,328],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",8,"c",2],485,482],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",8,"c",3],1353,1355],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",8,"s",0],339,334],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",8,"s",2],492,489],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",8,"s",3],1349,1350],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3punch","states","attack","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGBw8RFBUbHCAdHR8gISEiJSYsLjBgYWJkZGdpaWlqa2tDRUVKSUlJSUg7QEA/PTw7PjtDQkFAQUVEQUFBOjc1Nh0cHBwbGhkaGhkYGBwcGxoYGRkaGhoZGBcUERA=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQHDxASFRscIB0dHSAhISIkJictMDBhYmRlZWlpamtrbGxGRkVKSkpJSUg7QUA/PTw7PzpDQkFAQ0ZDQkFBOTY2Nh0cHBwbGhkaGhkYGBwcGxoYGRkaGhoZGRcUERA="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",0,"c",2],427,424],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",0,"c",3],1305,1302],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",0,"s",0],318,319],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",0,"s",2],432,429],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",0,"s",3],1300,1297],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",0,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwUHERMUFRYWExkZGx8gISMlJy1JcXJzdXZ5en5/gICAgYGBgTtfgoKCgoKDg2szMDQ0NTk6PT4uQ0RERUVEREREJx4eHRwdHRwbHBwaGRgXFhwdHh4fHx8eHRwbGRY=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwUHERMUFRYWExkZGR8gISMlJy1JcXJzdXZ5en5/gICAgYGBgTtfgoKCgoKDg2ozMDM0NTk6PT4uQ0RERUVEREREJx4eHRwdHRwbHBwaGRgWFhwdHh4fHx8eHRwbGRY="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",1,"c",2],183,180],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",1,"c",3],1490,1487],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",1,"s",2],188,185],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",1,"s",3],1485,1481],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",1,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMOESQyMjU3P0JDPj08QUJDREVcX2Sztre4k3t6e3xva2loUkRmYl9hbHV3goJZMS4wLyomISEiIyorKywxMjIzNTU2NjY2Hh4dHBsdHRwcHBsaGRgYFh0dHh4fHx8eHRwbGRY=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMOESQyMjQ3P0JDPj08QUJDREVcX2Sztbe4k3t6e3xva2loUkRmYl9hbHV3goJZMS4wLyomISEiIyorKywxMjIzNTU2NjY2Hh4dHBsdHRwcHBsaGRgXFh0dHh4fHx8eHRwbGRY="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",2,"c",2],72,69],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",2,"c",3],1647,1642],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",2,"s",2],178,175],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",2,"s",3],1490,1487],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",2,"p"],"AAAAAAAAAAAAAAAMGR4jMSwYFhgYGRkZGRkYGBYVJyk0NjdAQ1paV09NTU1LSklNYmZouru7fIqLi31ta2ppU0ReXl9ibnaDg49dMi4xMComISElJykqKiswMTEyNDQ1NTY2Hh4dHBweHR0cHBwbGhkYFhgdHTM6Oh0dHR4eGxk=","AAAAAAAAAAAAAAAMGR4jMSwYFhgZGRkZGRgYFxYVJyk0NjdAQ1paV09NTU1LSklNYmZnuru7fIqLi31ta2ppU0ReXl9ibXaDg49dMi4xMComISElJygqKiswMTEyNDQ1NTY2Hh4dHBwdHR0cHBwbGhkYFhgdHTM6Hh0dHR4eGxk="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",3,"c",2],74,71],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",3,"c",3],1688,1685],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",3,"s",2],79,76],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",3,"s",3],1677,1674],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",3,"p"],"AAAAAAAAAAAAAAAABxAXGQ4QEhISEhERERESExMXJyw2OUBDRVpaW1JPTU9OTExPY2lqvr+XmLGrq3JubGtqakJfX2Bjb3d6hIWUXjAxMS8oIyImLS40MzMxMjIyMjMzMzY3NywsLCwsKyoqKiorLCwsLCwsLS0tLDI0NzkeMi8=","AAAAAAAAAAAAAAAABxAXGQ4QEhISEhERERESExMXJyw2OUBDRVpaWlJPTU9OTExPY2lqvr+XmLGrq3JubGtqakJfX2Bjb3h6hIWUXjAxMS8oIyIlLS40MzMxMjIyMjMzMzY3NywsLCwsKyoqKSorLCwsLCwsLS0tLDI0NzkeMi8="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",4,"c",2],120,117],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",4,"c",3],1680,1677],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",4,"s",2],127,124],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",4,"s",3],1667,1664],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",4,"p"],"AAAAAAAAAAAAAAAAAAAKDAgGBgYGBgcICQoKCwwVGBkwO0FFR0lLWlpRTlBPTk5PZWtsbcXFyLe2tbSzn6CgoFZGYGBiZXF6hoaXl18wMTEvJyUhIysyNjlHSTw5NTQ1ODo+QEFCQyYlJSUoKCgoKSkpKCclJCQmKCowMjU1Hx4=","AAAAAAAAAAAAAAAAAAAKDAgGBgYGBgcICQoKCwwVGBkwO0FFR0lLWlpRTlBPTk5PZWtsbcTFyLe2tbSzn6CgoFZGYGBiZXF6hoaXl18vMTEvJyUhIysyNjlHSTw5NTQ1ODo+QEFCQyYlJSUoKCgoKSkpKCclJCQmKCowMjUgHx4="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",5,"c",2],148,145],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",5,"c",3],1561,1558],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",5,"s",2],153,150],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",5,"s",3],1556,1553],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",5,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEDAwMEBBMXLDA7QkRFSEtNSEpISktMTU9jaGqmpZeYmpqbm52eqqmnhX14cnBud4OCkpKQMWFhX19eWYqYnqKlrq2lZWZoalhZWls/QEA/Hx4gICAhIiIjIyMjGR0dHh4fHx8eHRwbGRY=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEDAwMEBBMXLDA7QkRFSEtMSEpISklMTU9jaGqmpZeYmpqbm52eqqinhX14cnBud4OCkpKQMWFhX19eWYqYnqKlrq2lZWZoalhZWls/QEA/Hx4gICAhIiIjIyMjGR0dHh4fHx8eHRwbGRY="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",6,"c",2],148,145],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",6,"c",3],1560,1557],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",6,"s",2],153,150],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",6,"s",3],1555,1552],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",6,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAxIVLDA7Q0RGSEtNSEZFSUlMTU9jaGqlkYF7j4+Pi42PkZKAfX17e3p2eIOCkpKQkZCQjntmamyEiYyMf5eWlGBgSElKSzo6Hh4eHBweHh8gICAaGRgaFx0dHh4fHx8eHRwbGRY=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAxIVLDA7Q0RGSEtNR0ZFSUlMTU9jaGqlkYF7j4+Pi42PkZKAfX17e3p2eIOCkpKQkZCQjntnamyEiYyMf5eWlWBgSElKSzo6Hh4eHBweHh8gICAaGRgaFx0dHh4fHx8eHRwbGRY="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",7,"c",2],160,157],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",7,"c",3],1549,1546],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",7,"s",2],164,161],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",7,"s",3],1544,1541],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",7,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQgPFSk2OHiLjpGUllteo6apq62ytLe4urylinuLi3FxcnJycnFwb3p6eXaCgpKSkJCQkI6MioZ3d3d3d3d3dnZ0c3FuamZeWldWVVVVRERDQkFAQCYkIyIeHh4fHx8eHRwbGRY=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQgPFSk2OICLjpGUllteo6apq62ytLe4urulinuLi3FxcnJycnFwb3p6eXaCgpKSkJCQkI6MioZ3d3d3d3d3dnZ0c3FuamZeW1dVVVVVRERDQkFAQD0kIyIeHh4fHx8eHRwbGRY="],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",8,"c",0],309,310],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",8,"c",2],376,373],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",8,"c",3],1356,1353],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",8,"s",2],381,378],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",8,"s",3],1351,1348],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["gravitos3soul","states","attack","f",8,"p"],"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACBgYRExUWGBkcHB4fIyMkJSkqLDJ6e3+BhYaHiImJiouMjI2NPUCPkJCQW1lWVDY2Njg6O0FCKysuMjIyMzY2NjY2Hh4eHRweHRwcGxsbGhgXFhwdHh4fHx8eHRwbGRY=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACBgYRExUWGBkcHB4eIyMkJSkqLDJ6e3+BhYaHiImJiouMjI2NPUCPkJCRW1lWVDY2Njg6O0FCKysuMjIyMzY2NjY2Hh4eHRweHRwcGxsbGhgXFhwdHh4fHx8eHRwbGRY="],
];
// ==== END GENERATED ====
const objEnd = (s, j0) => { let d = 0, q = false; for (let k = j0; k < s.length; k++) { const ch = s[k]; if (q) { if (ch === String.fromCharCode(92)) k++; else if (ch === '"') q = false; continue; } if (ch === '"') q = true; else if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) return k + 1; } } return -1; };
const REPO = process.env.MOJI_REPO || 'C:/Users/dpeh0/Mojiworld', BASE = process.env.LX_BASE_REF || 'origin/main';
const git = (args, input) => execFileSync('git', args, { cwd: REPO, maxBuffer: 1 << 28, input, stdio: ['pipe', 'pipe', 'pipe'] });
const baseTxt = new Map();
const baseOf = (rel) => { if (!baseTxt.has(rel)) { let b = null; try { b = git(['show', BASE + ':' + rel]); } catch (e) { die(rel + ': not readable on ' + BASE); } baseTxt.set(rel, b.toString('utf8')); } return baseTxt.get(rel); };
// ---- every frame's ORIGINAL on BASE must be the exact one its new version was made from, else abort (origin changed it: re-make it)
{ const want = FRAMES.map((q) => q[0]), ids = new Map();
  for (const l of git(['ls-tree', BASE, '--', ...want]).toString().split('\n')) { const m = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(l.trim()); if (m) ids.set(m[2], m[1]); }
  const miss = want.filter((r) => !ids.has(r)); if (miss.length) die('frames not on ' + BASE + ': ' + miss.slice(0, 3).join(', '));
  const out = git(['cat-file', '--batch'], want.map((r) => ids.get(r)).join('\n') + '\n'); let o = 0, already = 0;
  for (const [rel, oBytes, oSha, nBytes, nSha] of FRAMES) {
    const nl = out.indexOf(10, o), n = +out.subarray(o, nl).toString().split(' ')[2], b = out.subarray(nl + 1, nl + 1 + n); o = nl + 1 + n + 1;
    const h = sha(b); if (n === nBytes && h === nSha) { already++; continue; }   // BASE already holds the new frame (shipped)
    if (n !== oBytes || h !== oSha) die(rel + ': ' + BASE + ' holds neither the original this frame was made from nor the new frame (' + n + ' B) - re-make it from the new version');
  }
  console.log('frames: the ' + want.length + ' originals verified on ' + BASE + (already ? ' (' + already + ' already new there)' : '')); }
// ---- check EVERYTHING before writing ANYTHING, so a guard trip leaves the tree untouched
const plan = [];
for (const [rel, , , nBytes, nSha] of FRAMES) {
  const dest = path.join(ROOT, rel);
  const cur = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
  if (cur && cur.length === nBytes && sha(cur) === nSha) { continue; }
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
  const j0 = i + prefix.length, j1 = objEnd(s, j0);
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
  if (!n) { console.log(rel + ': already current on ' + BASE + ' (written as its blob)'); tables.push([f, s, 0]); continue; }
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
  const s = baseOf('sw.js');
  if (s.includes('gravitos3-hq')) { console.log('sw.js: already bumped on ' + BASE + ' (written as its blob)'); swOut = s; }
  else {
    const re = /^const CACHE = 'mojiworld-assets-v(\d+)';.*$/m, m = s.match(re);
    if (!m || (s.match(new RegExp(re.source, 'gm')) || []).length !== 1) die('sw.js: CACHE line not found once');
    const EOL = s.includes('\r\n') ? '\r\n' : '\n', N = +m[1];
    const line = '// gravitos3-hq - v' + N + ' -> v' + (N + 1) + '. Gravitos\'s ' + FRAMES.length + ' form-3 frames are REPLACED under their own names (re-drawn sharp),' + EOL +
      '// so a returning install would keep drawing the old soft frames for a session.' + EOL +
      "const CACHE = 'mojiworld-assets-v" + (N + 1) + "';   // gravitos3-hq: Gravitos form-3 frames re-drawn under their own names. v" + N + ' was: ' + m[0].replace(/^[^/]*\/\/\s*/, '').slice(0, 160);
    swOut = s.replace(m[0], () => line);
  }
}
// [entity, state, old {s,dx,dy}, new {s,dx,dy}] - the user-approved "default-aligned" form-3 calibration (F3, manifest3)
const CAL = [
  ['gravitos3', 'idle', { s: 1.04, dx: 0, dy: 0.0129 }, { s: 1.04, dx: 0, dy: 0.0259 }],
  ['gravitos3', 'walk', { s: 1.04, dx: 0, dy: 0.0129 }, { s: 1.04, dx: 0, dy: 0.0259 }],
  ['gravitos3', 'attack', { s: 1.04, dx: 0, dy: 0.0129 }, { s: 1.04, dx: 0, dy: 0.0259 }],
  ['gravitos3laser', 'attack', { s: 1.04, dx: 0, dy: 0.0129 }, { s: 1.04, dx: 0, dy: 0.0259 }],
  ['gravitos3punch', 'attack', { s: 1.04, dx: 0, dy: 0.0129 }, { s: 1.04, dx: 0, dy: 0.0259 }],
  ['gravitos3soul', 'attack', { s: 1.04, dx: 0, dy: 0.0129 }, { s: 1.04, dx: 0, dy: 0.0259 }],
  ['gravitos3star', 'idle', { s: 1.04, dx: 0, dy: 0.0129 }, { s: 1.04, dx: 0, dy: 0.0259 }],
  ['gravitos3star', 'walk', { s: 1.04, dx: 0, dy: 0.0129 }, { s: 1.04, dx: 0, dy: 0.0259 }],
  ['gravitos3star', 'attack', { s: 1.3, dx: 0, dy: 0.0163 }, { s: 1.0485, dx: 0, dy: 0.0259 }],
];
// [entity, state, old box, new box] - fractions of his drawn box (m._visH = targetH x calib s): x1.3/1.0485 keeps the world box
const HB = [['gravitos3star', 'attack', { w: 1.0536, h: 1.0025, ox: 0.0718, oy: 0.0359 }, { w: 1.30632, h: 1.24297, ox: 0.08902, oy: 0.04451 }]];
const calF = path.join(ROOT, 'data', 'anim_calib.js');
if (!fs.existsSync(calF)) die('data/anim_calib.js missing');
const parseCal = (s) => { const a = s.indexOf('window.LX_ANIM_CALIB = '), b = s.indexOf('window.LX_ATK_HITBOX = ');
  if (a < 0 || b < 0) die('data/anim_calib.js: unexpected shape');
  return { src: s, calib: JSON.parse(s.slice(a + 23, b).trim().replace(/;$/, '')), hitbox: JSON.parse(s.slice(b + 22).trim().replace(/;\s*$/, '')) }; };
const sdd = (v) => (v ? { s: +v.s, dx: +v.dx, dy: +v.dy } : null);
const same = (a, b) => !!a && !!b && a.s === b.s && a.dx === b.dx && a.dy === b.dy;
const box = (v) => (v ? { w: +v.w, h: +v.h, ox: +v.ox, oy: +v.oy } : null);
const sameB = (a, b) => !!a && !!b && a.w === b.w && a.h === b.h && a.ox === b.ox && a.oy === b.oy;
const read = () => parseCal(fs.readFileSync(calF, 'utf8'));
const before = parseCal(baseOf('data/anim_calib.js'));
const todo = new Map();   // entity -> { cal: [[state, new]], hb: [[state, new]] }
const want = (ent) => { if (!todo.has(ent)) todo.set(ent, { cal: [], hb: [] }); return todo.get(ent); };
for (const [ent, st, ov, nv] of CAL) {
  const cur = sdd(before.calib[ent] && before.calib[ent][st]);
  if (same(cur, nv)) continue;
  if (!same(cur, ov)) die('anim_calib.js: ' + ent + '.' + st + ' is ' + J(cur) + ', neither the old ' + J(ov) + ' nor the new ' + J(nv));
  want(ent).cal.push([st, nv]);
}
for (const [ent, st, ov, nv] of HB) {
  const cur = box(before.hitbox[ent] && before.hitbox[ent][st]);
  if (sameB(cur, nv)) continue;
  if (!sameB(cur, ov)) die('anim_calib.js: hitbox ' + ent + '.' + st + ' is ' + J(cur) + ', neither the old ' + J(ov) + ' nor the new ' + J(nv));
  want(ent).hb.push([st, nv]);
}
// ---- TEST PINS (each pair: old text -> new text, from BASE's blob; anything else aborts)
const PINS = [
  ["scripts/gravitos_feet_plant_test.mjs", [
    ["//      (forms 1-2) / 1-5 px (form 3) into the floor",
     "//      (forms 1-2) / 7-14 px (form 3) into the floor"],
    ["sinks past 18 / 23 / 18 px (forms 1 / 2 / 3) at its median",
     "sinks past 18 / 23 / 24 px (forms 1 / 2 / 3) at its median"],
    ["  const FAR_PIN = { 1: [4, 10], 2: [4, 10], 3: [1, 5] }, NEAR_PIN = { 1: 18, 2: 23, 3: 18 };   // boss-feet-calib: forms 1 / 2 floor push (+5 / +6 px)",
     "  const FAR_PIN = { 1: [4, 10], 2: [4, 10], 3: [7, 14] }, NEAR_PIN = { 1: 18, 2: 23, 3: 24 };   // boss-feet-calib: forms 1 / 2 floor push (+5 / +6 px); gravitos3-hq: form 3's one calibration 0.013 deeper (measured far 9-12, near 21)"],
    ["/ 1-5 px (form 3) into the floor (median over its frames)'",
     "/ 7-14 px (form 3) into the floor (median over its frames)'"],
    ["sinks past 18 / 23 / 18 px (forms 1 / 2 / 3; median)'",
     "sinks past 18 / 23 / 24 px (forms 1 / 2 / 3; median)'"],
  ]],
  ["scripts/boss_feet_calib_test.mjs", [
    ["const FLOOR_EXP = { 1: 4, 2: 4, 3: -2 };   // Gravitos idle far heel under the platform top per form (this build; origin: -1 / -2 / -2 - form 3 is not in this package)",
     "const FLOOR_EXP = { 1: 4, 2: 4, 3: 7 };   // Gravitos idle far heel under the platform top per form (this build; origin: -1 / -2 / -2; form 3: gravitos3-hq stands it 0.013 deeper, the approved depth)"],
  ]],
  ["scripts/gravitos3_anim_test.mjs", [
    ["//   - ONE SIZE: every set shares idle's calibration (s, dx, dy); only the star cast is bigger (s >= 1.2)",
     "//   - ONE SIZE: every set shares idle's calibration (s, dx, dy); the star cast keeps its own row at idle's drawn size (s 1.0485 on its wider canvas, gravitos3-hq)"],
    ["//     within 6 px of idle's; the star cast puts it >= 15% higher (the enlarged form, scaled about his feet)",
     "//     within 6 px of idle's - the star cast too since gravitos3-hq (the user-approved alignment draws it at idle's size)"],
    ["check(CAL.gravitos3star.attack.s >= 1.2 && (CAL.gravitos3star.attack.dx || 0) === 0, 'ONE SIZE: only the star cast is enlarged', CAL.gravitos3star.attack);",
     "check(CAL.gravitos3star.attack.s === 1.0485 && (CAL.gravitos3star.attack.dx || 0) === 0 && CAL.gravitos3star.attack.dy === ref.dy, 'ONE SIZE: the star cast is drawn at idle\\'s size (s 1.0485 on its own canvas, idle\\'s dy)', CAL.gravitos3star.attack);"],
    ["    // Idle and the star search the whole torso; every other set searches +-50 px round idle's core, because a set whose",
     "    // Idle searches the whole torso; every other set (the star cast too, gravitos3-hq) searches +-50 px round idle's core, because a set whose"],
    ["    const I0 = out.idle, near = I0 && I0.n && name !== 'star';",
     "    const I0 = out.idle, near = I0 && I0.n;"],
    ["const I = R.idle, near = ['walk', 'attack', 'laser', 'punch', 'soul'].filter(",
     "const I = R.idle, near = ['walk', 'attack', 'laser', 'punch', 'soul', 'star'].filter("],
    ["check(!!(R.star && R.star.n && I && I.n) && R.star.up >= I.up * 1.15, 'IN GAME: the star cast draws him enlarged (core >= 15% higher above his feet)', { idle: I && I.up, star: R.star && R.star.up });",
     "check(!!(R.star && R.star.n && I && I.n) && Math.abs(R.star.up - I.up) <= 6, 'IN GAME: the star cast draws him at idle\\'s size (core height within 6 px of idle\\'s, gravitos3-hq)', { idle: I && I.up, star: R.star && R.star.up });"],
  ]],
];
const pinOut = [];
for (const [rel, pairs] of PINS) {
  let src = baseOf(rel); const eol = src.includes('\r\n') ? '\r\n' : '\n', E = (t) => t.split('\n').join(eol); let did = 0;
  for (const [o, n] of pairs) { const O = E(o), N = E(n), no = src.split(O).length - 1, nn = src.split(N).length - 1;
    if (nn === 1 && no === 0) continue; if (no !== 1) die(rel + ': a pin is neither its old nor its new text (' + o.slice(0, 70) + ')'); src = src.replace(O, () => N); did++; }
  pinOut.push([path.join(ROOT, rel), src, did, rel]);
}
// ---- write: frames, tables, sw.js, test pins, then the calibration
for (const [rel, dest, buf, nSha] of plan) {
  atomic(dest, buf);
  if (sha(fs.readFileSync(dest)) !== nSha) die(rel + ' did not verify after the write');
}
console.log('frames: ' + plan.length + ' written (' + (FRAMES.length - plan.length) + ' already new)');
for (const t of tables) { atomic(t[0], t[1]); console.log(path.basename(t[0]) + ': ' + t[2] + ' value(s) updated'); }
if (swOut) { atomic(SW, swOut); console.log('sw.js: CACHE written'); }
for (const [f, src, did, rel] of pinOut) { if (!fs.existsSync(path.dirname(f))) die('no dir for ' + rel); atomic(f, src); console.log(rel + ': ' + (did ? did + ' pin text(s) moved' : 'pins already moved on ' + BASE + ' (written as its blob)')); }
atomic(calF, before.src);   // origin's anim_calib.js is what the patcher edits, never a stale working copy
if (!todo.size) console.log('gravitos3-hq calibration: already applied');
else {
  const PATCHER = path.join(ROOT, 'scripts', 'apply_anim_patch.mjs');
  if (!fs.existsSync(PATCHER)) die('scripts/apply_anim_patch.mjs missing');
  const norm = (blk) => { const o = {}; for (const [k, v] of Object.entries(blk || {})) if (!(+v.s === 1 && +v.dx === 0 && +v.dy === 0 && !v.fs && !v.ft)) o[k] = v; return o; };
  for (const [ent, w] of todo) {
    const cal = JSON.parse(J(before.calib[ent])), hb = before.hitbox[ent] ? JSON.parse(J(before.hitbox[ent])) : null;
    for (const [st, nv] of w.cal) Object.assign(cal[st], nv);   // only s/dx/dy move; ft / ftAuto ride along
    for (const [st, nv] of w.hb) Object.assign(hb[st], nv);
    const blob = Object.assign({ LX_ANIM_PATCH: 1, type: ent, calib: cal }, hb ? { hitbox: hb } : {});
    const bf = path.join(ROOT, 'scripts', '_gravitos3_hq_patch_' + ent + '.json');
    fs.writeFileSync(bf, J(blob));
    try { execFileSync(process.execPath, [PATCHER, bf], { cwd: ROOT, stdio: 'pipe' }); }
    catch (e) { atomic(calF, before.src); die('apply_anim_patch.mjs failed for ' + ent + ': ' + String(e.stderr || e.message).slice(0, 200)); }
    finally { try { fs.unlinkSync(bf); } catch (e) {} }
    const after = read();
    const okEnt = J(norm(after.calib[ent])) === J(norm(cal)) && J(after.hitbox[ent] || null) === J(hb);
    const others = Object.keys(Object.assign({}, before.calib, after.calib)).filter((k) => k !== ent).every((k) => J(after.calib[k]) === J(before.calib[k]))
      && Object.keys(Object.assign({}, before.hitbox, after.hitbox)).filter((k) => k !== ent).every((k) => J(after.hitbox[k]) === J(before.hitbox[k]));
    if (!okEnt || !others) { atomic(calF, before.src); die('anim_calib.js: ' + ent + ' did not take the patch cleanly (restored) ' + J(after.calib[ent]).slice(0, 200)); }
    before.calib = after.calib; before.hitbox = after.hitbox;
    console.log('anim_calib.js: ' + ent + ' ' + w.cal.map(([st, nv]) => st + ' -> ' + J(nv)).join(', ') + (w.hb.length ? '; hitbox ' + w.hb.map(([st, nv]) => st + ' -> ' + J(nv)).join(', ') : ''));
  }
  console.log('gravitos3-hq calibration: baked');
}
console.log('gravitos3-hq assets: done');
