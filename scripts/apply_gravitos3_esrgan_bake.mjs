// gravitos3-esrgan, the assets half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA files are re-synced from origin).
// It does NOT trust that re-sync: every text file it edits is rebuilt from origin's blob + its rows, and every frame's current version
// is checked on origin (THE BASE IS ORIGIN'S BLOB, the boss-feet-calib rule).
// Per user: "Ship it" - the free local Real-ESRGAN redo of Gravitos form 3 replaces the paid-upscale frames of v0.30.1828 (gravitos3-hq),
// whose face re-invented its mouth / nose lines on every frame (shimmer).
//   ART - all 69 Gravitos form-3 frames REPLACED under their own names on unchanged canvases, made from the same pre-v0.30.1828
//     originals (6dda52bc9): HR bilateral deblock -> crop + push-pull edge bleed -> realesrgan-x4plus-anime x4 -> v0.30.1828's exact
//     single lanczos3 reduction with each set's approved transform folded in -> FLOOR (no px darker than the original's darkest px within
//     2 px, minus 2 levels: the model crushed near-black) -> EDGE (2 px inside the outline: px darker than the original lifted 60% / 30%
//     toward it: the model's dark rim on flames) -> the same luminance unsharp (sigma 1, amount 0.5, thr 2) -> the same WebP q94 smart
//     deblock with LOSSLESS alpha. Alpha = v0.30.1828's byte for byte (so feet, size, reach and outline-built tables stay).
//   TABLES - each pixel-derived row re-measured by its own generator on a mirror holding the new frames (only rows that moved).
//   sw.js CACHE +1 (the art is replaced under its own names).
//   TEST - scripts/gravitos3_hq_test.mjs reads the frames' checksums from this file when it exists (it read apply_gravitos3_hq_bake.mjs).
// GUARDED: each replaced frame must hold EITHER v0.30.1828's bytes OR the new ones; each table value EITHER the old OR the new value; the
// test line EITHER its old OR its new text - anything else aborts before writing. Idempotent. LX_ASSET_ROOT points it at a mirror of the
// repo; LX_G3E_SRC at the folder holding the new WEBPs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_G3E_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/g3e/final';
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
// ==== GENERATED TABLES (fa_reports/g3e/tables_e.mjs) ====
// FRAMES: [repo path, v0.30.1828 bytes, v0.30.1828 sha256, new bytes, new sha256]
// PATCHES: [table file, its "window.X = " prefix, path into the object, old value, new value]
const FRAMES = [
  ["Sprites/bosses/idle/gravitos3_0.webp",231962,"c4c1010036f8e5465ecf105973a1f171d61a7c672f263a485657300eead1a67d",205556,"4713a4048c8f2657e47d1d44cdf450babfd0844ae78a80ac0ac2c3300bc38f2d"],
  ["Sprites/bosses/idle/gravitos3_1.webp",233780,"08f50137cc6c57417131268197c1ffd3d9501c76da1cb27cbe4399fca593d2d5",207262,"e9d87408f796157e7c6a3a98d8362d44ea0c79e207e915f4a0a4a1588210eb22"],
  ["Sprites/bosses/idle/gravitos3_2.webp",236184,"f0d2a10cd3974c2f1b39ae507dd1955288f8f89430d867c41457b6805d0404f3",207940,"36be39c6f9109f534b9e85f23e24b1f75bfa81330d103082e08d9752b9dfa194"],
  ["Sprites/bosses/idle/gravitos3_3.webp",232196,"cef4411ab84bb59ef3c7a99da640a1313fdb12ca164d63c15f708ff07488b27f",208868,"6e3d66eeb033a09574056e8846eebc461131971c4a41ec52d3c2ee4f19fd8f87"],
  ["Sprites/bosses/idle/gravitos3_4.webp",236004,"6f34ffa081233d56d4a8d1b9cc598dc86dae8b5ebe86fe618d2f6213a1f01e3a",211392,"5323f9a33347f2ae0899db4404dd144a297ac0864c62ae5150247d5c2b822865"],
  ["Sprites/bosses/idle/gravitos3_5.webp",242222,"0d7fc8d38a3533e032b33d2c23a93c7c3f953bbdb0021341fe3f0e89353219b0",220950,"896a8dcb3981dd613c3adf9a5f53dd93f39909f8d240d794569fc9a053eeb44f"],
  ["Sprites/bosses/idle/gravitos3_6.webp",245254,"232ab8e8d594b3c1fc2d109a5ed2d56cd8bf5c356653364bedbca89c8c96ef3c",222884,"1d7ed027d2072e277c806b6522f007cd2afed3c432d3094ff457ab8c04817137"],
  ["Sprites/bosses/idle/gravitos3_7.webp",233466,"92db427d7da863f8f5c6591bd398c832f20ef6d26534db96d9917cc469c96a79",210526,"67f3595ad81a5e188f6785d20afa06a680183605b75c4c83b008b9717cbbac02"],
  ["Sprites/bosses/idle/gravitos3_8.webp",226172,"a0c6922be07ab14bc7e0a240ff1181d0d8ede5332e059539256ecf1ba7b24f9c",197564,"a5b7cce1d3084be46a4e0ec0522cb2c58140665a71ce15b03bf5b5b6c3f3c16f"],
  ["Sprites/bosses/walk/gravitos3_0.webp",219024,"7394814863a31f1f392d6e1729c29b98d7e47ea29efaab786cce65c1a9dac3ca",202412,"7e5b96948af4ac98c949e7e5db176396126b0dcd31895cb97a2ed6f0e0e09367"],
  ["Sprites/bosses/walk/gravitos3_1.webp",205342,"b5c6e5d978aedb514a6eb7b61867ede5364b8c3389ba89655d400fa7e743396a",191796,"0a410ddfa0cbd4dbc59854743d78decc6f1a51b4763d38a759b1876638d5902c"],
  ["Sprites/bosses/walk/gravitos3_10.webp",194272,"79126bb830dd40b6348939fb566a6a556b0cef03d394759689a800162b034faf",180798,"40100fea4617c1043788b4694ebddaefc0b9df18e40b2db871fd1e3664304c37"],
  ["Sprites/bosses/walk/gravitos3_11.webp",195264,"f8b529616ccbab6ed106ab287ec3b7c98342047d87109c91893f2ccfa2beb102",180570,"ca3ce490fce39aa7a051f944af1dbd8d798d897ac27ad9e0435aba10b206c8fa"],
  ["Sprites/bosses/walk/gravitos3_12.webp",200168,"3ee399872aa49ca59addbccd515d8b56684dfa70e12510481cb0f8f42222be20",186266,"2d86fa3b016010a6c3e313062589199fc046a0dfbf7f1e693d6a9d028686548b"],
  ["Sprites/bosses/walk/gravitos3_13.webp",201972,"da0eb954c91f0b230669eb92d2598f440b0dd9512ad3b248a90ce1679b380e4a",186832,"52ca851357ebd1c8923d0bd3e2bbdf8ec446e1cee0f186f9415224b6175e01b8"],
  ["Sprites/bosses/walk/gravitos3_14.webp",206178,"0d32c316f5d5c5aa7d18377dc76c5573df57dab504ea92f834b7523d6381d823",189146,"7e2c08f421acba802a468070761ae02b71306d8f371777b6fe9f3cc526cd9537"],
  ["Sprites/bosses/walk/gravitos3_2.webp",201142,"634cc919203756078fb5a786f68c829c3d636e1c4b527aa75fbc7f005682b691",186012,"542385654deca353fff9254253fc0e82154233534bcbdb7beb18000a32e8c108"],
  ["Sprites/bosses/walk/gravitos3_3.webp",194030,"a69c05bc006790a23d92ee140e26c2476c09c77347b0faf062a6236a8ececbab",181024,"41595ead011443ad7257cd08316116160f3b0787376c74d13ea7b57deae9719e"],
  ["Sprites/bosses/walk/gravitos3_4.webp",193836,"e12bebb43da70a85a9cd55dec6664abe0acf4f1e801ccf8830f2fd4d4265d4cf",181290,"fe198282ea2045280325cc59efbee4331e88efdf5fc8aab99433c4b43dd59729"],
  ["Sprites/bosses/walk/gravitos3_5.webp",195366,"cdfeda5f8c735dc43789ec154357624d05b9fdf5180be5edfd485f26955b441e",180036,"a430897c753685acec1d3ea24b7bbd33050316a8fc58c4398d36e30ffe5f5270"],
  ["Sprites/bosses/walk/gravitos3_6.webp",192692,"713dab11ef8e806345c8a09f08915a6ff1f4d7d8934c3b74cf152c78edc84650",178946,"fdac522761bfbcb27e9e8e1eaf0899bf68b5674747e84e84db8d9c906220a0cb"],
  ["Sprites/bosses/walk/gravitos3_7.webp",193074,"7ac22ba382f2fe7890097d2ef87de6096531261774bcf84bb745329f953bb85f",177110,"30892ecd67ebba6f2e5e460c4da2e70d6e9e0bfb53a686c65cdfdabbf4a4d4eb"],
  ["Sprites/bosses/walk/gravitos3_8.webp",193274,"229ae46e327f09a4abbb89fb9ab273d840cd9151108d91f16293649e79f695c0",177238,"20e80967db8d5fb3c56616802409cbd43f3ad5110005804772fd3f09ad0a4be6"],
  ["Sprites/bosses/walk/gravitos3_9.webp",198768,"93962638f5e2435e56379579da2a9d0953fc9f819e1a51680b738bf967bb52a9",181456,"28dec85ecaf0480775719d2d39e9206fe619f321a5d743311a5da248e42a55cf"],
  ["Sprites/bosses/attack/gravitos3_0.webp",216160,"0f2e2311f1d2659f575235c71884a8c5652d92e0d10c0f99e9bea9ba64a11ac7",190764,"d95d616da2549f298cd88d5e6a6a95d354f8434da5d37d3a3bd28433126e5cd3"],
  ["Sprites/bosses/attack/gravitos3_1.webp",207994,"a3d2f9a71372eedb3b3bea5f33ac87e347d2b3888c77b023a6c436c5bf4b0858",189374,"039f5f3ac3482364f0227c34a365ea4af1da5468ea436099c1e9cab72a95c6f7"],
  ["Sprites/bosses/attack/gravitos3_2.webp",199170,"b25e26080f954f8dcbe0e21d82a6309c32065f40a60ea308362ea5fb77dd2eea",177004,"b7774f0573e4db0de7f60b76203f14bd6d4df8b67a3b1b5d5837339c7bb2e8f8"],
  ["Sprites/bosses/attack/gravitos3_3.webp",199154,"b980a00469d8149b325c6a4fadda6724ab468b8d954a3a1cfd78ee1ebadf640b",173798,"d8a6f5ceee419747cbe575abd6d9477b87b71cb413752c8a7b540815ac35ee1a"],
  ["Sprites/bosses/attack/gravitos3_4.webp",196132,"cec1afb75b45258f0d22a4a51965ba3ffe52a6edf5f9f9f64e749d6e077cac1d",168288,"6b5c29cd585f0f1326ccaa4908291fb2259b212d15e459078f0b5fd4ac5ee21f"],
  ["Sprites/bosses/attack/gravitos3_5.webp",257898,"a2aed96f87ba1ad7902875263a7cb8e0a59b1e4a67c220c047f998b562a0ec92",213020,"44c009392bf344aa5e079eed161bf0c18739dd8d652b084f4c994fbba42ccdcf"],
  ["Sprites/bosses/attack/gravitos3_6.webp",273844,"fea91c102d19fa3bf7e4b40f9cc7f38d3f4cc6c4c20aa57be877a71a55cdcf97",211634,"273963338ab9a426fca4ab78272e26f962d77d777d78ceb6d959f368aff60211"],
  ["Sprites/bosses/attack/gravitos3_7.webp",258068,"265aac4b289c54643ca36eb9b7fa5e8d05e743035855317f772b7db930f0d7b2",214802,"6e167940def22068201f9e44ec68665abde38d7e3cfe3d00c737fe9787686e18"],
  ["Sprites/bosses/attack/gravitos3_8.webp",218082,"59d79792a346491b9941c15a4063a18bd277d6c64c082941da1a634a5c1f2692",187988,"3fddd125b9c47b4eea8851fea07961992e8de5b7d06827e7386580cee0e7c75e"],
  ["Sprites/bosses/attack/gravitos3laser_0.webp",215142,"78faf0cdbb41492bf96e3e66356c3678f0cf1cf40eef0272dc2c1f62fe1d2948",191072,"ac82fdb0c495a6bae4643d204513115641e4cbcfc9ed1a68bf3172864acfb9fb"],
  ["Sprites/bosses/attack/gravitos3laser_1.webp",206746,"0e47852744446785e77a04f4312afa52d30d171ba3e435ef661f1accc6612ca9",181312,"2cbc6fe6fd52770a373820ad179c73a0657de2266af9aa990b31b010af3c7fe1"],
  ["Sprites/bosses/attack/gravitos3laser_2.webp",214070,"8e162ff6c0ac6fbfc252fb75e0cc3441a0c2e0a53538003ebf23769056777a60",188232,"89a83263e809611554f0135799f4bf99f5b2497d51e5460724a13bcb99b117f8"],
  ["Sprites/bosses/attack/gravitos3laser_3.webp",215916,"3730d47be92c04c3d3d8158bd6fa04bc418080c1ef8b672539fae1bff4152a21",188732,"76ade68c9b10d03a5fed7fd3bd5a1770cd9d375cbc65414b090ce511d38957d3"],
  ["Sprites/bosses/attack/gravitos3laser_4.webp",246208,"da5d04bf6fd6817ae3d79d5fdab3d0d151310d627eb57c276f3d647961d60c5d",211086,"6dab1ac3c55af7ca3a3b3eeb49c8d6ca5c8af497a8513bff0284ccb92de1aab1"],
  ["Sprites/bosses/attack/gravitos3laser_5.webp",271556,"526d4dba161c5b1dabbc1f0b913104345c48c7e3c51a641aec47a782c20cb8e5",232798,"bafece546280329393a4bd992aeca6161e81df33b916a1018db8e46b643aa625"],
  ["Sprites/bosses/attack/gravitos3laser_6.webp",288594,"f1c8682f102097bf1bdaec8192344ba56ef199b1f62ae8529cf50d25555d33c0",232420,"835aeba9fb77222d6cc2f6a18b150da03ac88c9aa0c138201693ec43a6651c28"],
  ["Sprites/bosses/attack/gravitos3laser_7.webp",250272,"447f85cd80b1a0560deb2dcafd2d526c5d8d3478ba1479f25ad81009c10e4054",217064,"d45ddbeacbe42e5a33eefd5cfaabd4b8b0d614f35f5b668f764c78d30396ab8c"],
  ["Sprites/bosses/attack/gravitos3laser_8.webp",218558,"07a5a894e75ec1821b0274b0ef28c0ef3e59f1134243fbab1170f2deabae0c50",193244,"3442cf8cc524aff1745840efbee51f2111428de87a224aad5fafb3cbcbe57a35"],
  ["Sprites/bosses/attack/gravitos3punch_0.webp",214412,"a9886e6891cd079313592c414934c1be517baf374c06606481b9d697dd89fc84",190450,"41b82399781626f295b67a8212546fc24f6ed17bed5122b70619bf257cbc5703"],
  ["Sprites/bosses/attack/gravitos3punch_1.webp",183380,"2f04ba1c3809a02420d59d053284ee8ba79a7d770e41a31b622f8ad180d340ef",159278,"6e383aa60875e01e7ff0cfb269ef17b396baf16604c8854a9f40b8df033d4d69"],
  ["Sprites/bosses/attack/gravitos3punch_2.webp",178898,"da1c74a2981c4d1d5b8e345439a4a294726e4842d60332ac3f46b21fac19a064",160348,"2e9452186b14c594d9eba0c74801d1b90723e6bfed0e52ca92df4ab7e884cc56"],
  ["Sprites/bosses/attack/gravitos3punch_3.webp",182468,"e2ec1014de6db55c137dad038ba5d173097240b698d95b9ed1f25a0328161aaa",156896,"e4826441ab53745ba29f9a2adf9d307a23e72d81dbe0e5d3d24555f589d7a0bc"],
  ["Sprites/bosses/attack/gravitos3punch_4.webp",205460,"57e760cf0fd562f49c1dfd4292c0e637166458f89ff0976305a1dc15d8844fff",173714,"3639adb805cfa3932c26b02cde12b7103c743282c29041dddd33b22ee00ea7ac"],
  ["Sprites/bosses/attack/gravitos3punch_5.webp",252140,"31fcb6f3d058182c65ffd8af44d1158829359cdd1685e2afd2abef766154b40b",203462,"9570068eb2e944fd0d288a4fe154da4f4cb24be6e90e9882dcb0a1a7466d5ed1"],
  ["Sprites/bosses/attack/gravitos3punch_6.webp",296666,"ed1b853a848eb8da0d5cbfc44e632b357425b4db8152d5af8e69c7358645bba3",243012,"1d3a7ab997843507e835927b7204b6adbf1572cae71d909c0fa19c93b1df200b"],
  ["Sprites/bosses/attack/gravitos3punch_7.webp",294040,"19aff5326d72f7d6262cf649733a91268ee1ad61d76f684f9e67f7db9dc11a77",250900,"aca34dd2fb6bc3f1bca49fdab917dfc84cc7b4a399ded5a1c764885409c2e739"],
  ["Sprites/bosses/attack/gravitos3punch_8.webp",179348,"7db7a5f416b7836737ceb1f7e70698bf1e30bfec5daa88aad11282da4fdb4ae8",158020,"f857b4448a9c2f58f0c46d9592065031abcdc7866b29779687e64524b436eede"],
  ["Sprites/bosses/attack/gravitos3soul_0.webp",208790,"3b9aa4ec141f386dc79406e2eadfa787921b73fd5ffbc3d01584117a7271af0a",183982,"b029eede68fcb89534a037f3044c46929b5bcb3a38beec565003720c319366ae"],
  ["Sprites/bosses/attack/gravitos3soul_1.webp",218156,"c73b5f60c3ead7d83111865629fbb63f4d9057be779f31572f70008419540f99",193910,"9e9abab6f290b398becf5f2840d40d845a5cbadf1ee1b62573e21d14356603f6"],
  ["Sprites/bosses/attack/gravitos3soul_2.webp",291902,"9af9c293ce04dceefdf970b44e4d8af38471f951cfa171e9685835f4d25ab3aa",251090,"7a982dd8dba55e5d4140acf48c122ab6f891ce504b3a4f8b00ad5e5d2c0dabb9"],
  ["Sprites/bosses/attack/gravitos3soul_3.webp",290798,"d15bf6c902cdf7e8edc80da3bb17e1c0f290be0e3b2d04eb830e2bd0bcaabcb4",241180,"8b8cc745c0f5fe0fc39071bb02a2b6e9885be502ef2997fe988907ed27e5b253"],
  ["Sprites/bosses/attack/gravitos3soul_4.webp",282246,"cda25c7f6afb6b59dc6c1ebf1e2f861bd0fc8a54ca42d485cbcad308cb0eafcb",231028,"116cd84b37cd6054e0d5b65c634b80873656998c59bc30b5073b1c82ad623446"],
  ["Sprites/bosses/attack/gravitos3soul_5.webp",251162,"a6a480f13f5eb9412b2d7ff490ffc1130697e281417f89045ac8a9224f43665b",218102,"561522229702f79553cc06b49422e6571f636691f6164a40c7af0dd3c24aa1ac"],
  ["Sprites/bosses/attack/gravitos3soul_6.webp",225448,"4fc925b289e0ef6aed9093de9d5df8c5ce3d2c7b9830875dd5c90c7a8e5a56d2",195038,"5960df26b709172b26120301bb6afc7028d8739f346ad8c086a1376b1c55a71e"],
  ["Sprites/bosses/attack/gravitos3soul_7.webp",160246,"4377d500c4d605cc53ff018ea967fb31ff6c1cc173567bb58afd0f5fe18c87ec",130998,"877908721e9b20bb490f7a847738d5924c34dfbfe5149c41f31ab2d5fafd2322"],
  ["Sprites/bosses/attack/gravitos3soul_8.webp",213428,"86ee9c2468bdd5b636ddf4b6f42ffa9c1f500e5c1a3e6b106e07d059841b9293",183812,"46ebe9ef34bfd418b7d8b1ed3d476d447011ff7cbf09523788baff4a370136f1"],
  ["Sprites/bosses/attack/gravitos3star_0.webp",229764,"42e06a2fb9815444c6df6abca901eacb2a69abc38eee11702a1bc0724ed545af",205072,"1dd14864016f9d2665cf5fae0d4eebe407762f1a4a49d5cf7178c5c5ca92b0d2"],
  ["Sprites/bosses/attack/gravitos3star_1.webp",238298,"5a117829b3934ecb55e4f5127d316d51c69ffd5df39154fc9ef299e6048d7766",214354,"872f63bab5a60ee3407aeb8627c088660770ba7e8586192e72c83bcf84b3732f"],
  ["Sprites/bosses/attack/gravitos3star_2.webp",167020,"cdc4d0d0dbbc86c21e641c438c808183957b1a3fbd346b6365e1f5714169d19e",144972,"13e036124abb1d5d124db616b3bb436d02e7af806e99db94f4e170ba9d2ed1aa"],
  ["Sprites/bosses/attack/gravitos3star_3.webp",184588,"5318d4dcabf64344f329b6a0125dccc857e53de56edb7736dabef784480c2d01",156040,"510c5b4577200874142c14432c7e4bff2bb99c4df085512e55bd1a116d19dd1c"],
  ["Sprites/bosses/attack/gravitos3star_4.webp",199696,"b9e0e4a9ec882c660dc398afc91add54f782ce690f80c6a7f68496c79df4da4f",167892,"733bec076e35cf1310d87e4542b9aa0a40115b26a99245e1ee262869534f9f3a"],
  ["Sprites/bosses/attack/gravitos3star_5.webp",238880,"89c4a796fbfb532bd1dd353b2feab79b22f535ba6959e886ef5b9e11b6f60b07",201124,"faf9670b92c61d5570512ed9baa7937438bc5bc488f63a5611deffc0a81cf369"],
  ["Sprites/bosses/attack/gravitos3star_6.webp",423786,"b71d532fe18db0203973006791971fe168d74713cb7ea7d87ed4fa68d40bc9da",392260,"0018a72a04608624092113b27f81ca3b0a4afc02677744720f9c2c8eaf172208"],
  ["Sprites/bosses/attack/gravitos3star_7.webp",358744,"e5285ec6b3846b3d66e69a7e2a7c4995200191cfec6f0cc933558a77dc280180",332018,"0d60e40ba55c49bea442d7c4aec2334a644d41ffd7a8884b11b9687294ed26a4"],
  ["Sprites/bosses/attack/gravitos3star_8.webp",235278,"9b112c261518b8d04b455295bb3fbab111a3482d0bbb0502bbc1d4dc1bb871f4",205882,"6ac308e32c416c57f9defdcdd16db90c8575f67197af9610dfa5502a46c52061"],
];
const PATCHES = [
];
// ==== END GENERATED ====
const objEnd = (s, j0) => { let d = 0, q = false; for (let k = j0; k < s.length; k++) { const ch = s[k]; if (q) { if (ch === String.fromCharCode(92)) k++; else if (ch === '"') q = false; continue; } if (ch === '"') q = true; else if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) return k + 1; } } return -1; };
const REPO = process.env.MOJI_REPO || 'C:/Users/dpeh0/Mojiworld', BASE = process.env.LX_BASE_REF || 'origin/main';
const git = (args, input) => execFileSync('git', args, { cwd: REPO, maxBuffer: 1 << 28, input, stdio: ['pipe', 'pipe', 'pipe'] });
const baseTxt = new Map();
const baseOf = (rel) => { if (!baseTxt.has(rel)) { let b = null; try { b = git(['show', BASE + ':' + rel]); } catch (e) { die(rel + ': not readable on ' + BASE); } baseTxt.set(rel, b.toString('utf8')); } return baseTxt.get(rel); };
// ---- every frame on BASE must be the exact v0.30.1828 one its new version replaces, else abort (origin changed it: re-make it)
{ const want = FRAMES.map((q) => q[0]), ids = new Map();
  for (const l of git(['ls-tree', BASE, '--', ...want]).toString().split('\n')) { const m = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(l.trim()); if (m) ids.set(m[2], m[1]); }
  const miss = want.filter((r) => !ids.has(r)); if (miss.length) die('frames not on ' + BASE + ': ' + miss.slice(0, 3).join(', '));
  const out = git(['cat-file', '--batch'], want.map((r) => ids.get(r)).join('\n') + '\n'); let o = 0, already = 0;
  for (const [rel, oBytes, oSha, nBytes, nSha] of FRAMES) {
    const nl = out.indexOf(10, o), n = +out.subarray(o, nl).toString().split(' ')[2], b = out.subarray(nl + 1, nl + 1 + n); o = nl + 1 + n + 1;
    const h = sha(b); if (n === nBytes && h === nSha) { already++; continue; }   // BASE already holds the new frame (shipped)
    if (n !== oBytes || h !== oSha) die(rel + ': ' + BASE + ' holds neither the v0.30.1828 frame this one replaces nor the new frame (' + n + ' B) - re-make it');
  }
  console.log('frames: the ' + want.length + ' v0.30.1828 frames verified on ' + BASE + (already ? ' (' + already + ' already new there)' : '')); }
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
  if (s.includes('gravitos3-esrgan')) { console.log('sw.js: already bumped on ' + BASE + ' (written as its blob)'); swOut = s; }
  else {
    const re = /^const CACHE = 'mojiworld-assets-v(\d+)';.*$/m, m = s.match(re);
    if (!m || (s.match(new RegExp(re.source, 'gm')) || []).length !== 1) die('sw.js: CACHE line not found once');
    const EOL = s.includes('\r\n') ? '\r\n' : '\n', N = +m[1];
    const line = '// gravitos3-esrgan - v' + N + ' -> v' + (N + 1) + '. Gravitos\'s ' + FRAMES.length + ' form-3 frames are REPLACED under their own names (re-made with a steadier upscaler),' + EOL +
      '// so a returning install would keep drawing the v0.30.1828 frames for a session.' + EOL +
      "const CACHE = 'mojiworld-assets-v" + (N + 1) + "';   // gravitos3-esrgan: Gravitos form-3 frames re-made under their own names. v" + N + ' was: ' + m[0].replace(/^[^/]*\/\/\s*/, '').slice(0, 160);
    swOut = s.replace(m[0], () => line);
  }
}
// ---- TEST PINS (each pair: old text -> new text, from BASE's blob; anything else aborts)
const PINS = [
  ["scripts/gravitos3_hq_test.mjs", [
    ["  let A2 = ''; try { A2 = readFileSync(path.join(HERE, 'apply_gravitos3_hq_bake.mjs'), 'utf8'); } catch (e) {}",
     "  // gravitos3-esrgan: the 69 frames were re-made (free Real-ESRGAN, same canvases and outline) - their checksums now live in the newer bake\n  let A2 = ''; for (const f of ['apply_gravitos3_esrgan_bake.mjs', 'apply_gravitos3_hq_bake.mjs']) { try { A2 = readFileSync(path.join(HERE, f), 'utf8'); break; } catch (e) {} }"],
  ]],
];
const pinOut = [];
for (const [rel, pairs] of PINS) {
  let src = baseOf(rel); const eol = src.includes('\r\n') ? '\r\n' : '\n', E = (t) => t.split('\n').join(eol); let did = 0;
  for (const [o, n] of pairs) { const O = E(o), N = E(n), no = src.split(O).length - 1, nn = src.split(N).length - 1;
    if (nn === 1 && no === 0) continue; if (no !== 1) die(rel + ': a pin is neither its old nor its new text (' + o.slice(0, 70) + ')'); src = src.replace(O, () => N); did++; }
  pinOut.push([path.join(ROOT, rel), src, did, rel]);
}
// ---- write: frames, tables, sw.js, test pins
for (const [rel, dest, buf, nSha] of plan) {
  atomic(dest, buf);
  if (sha(fs.readFileSync(dest)) !== nSha) die(rel + ' did not verify after the write');
}
console.log('frames: ' + plan.length + ' written (' + (FRAMES.length - plan.length) + ' already new)');
for (const t of tables) { atomic(t[0], t[1]); console.log(path.basename(t[0]) + ': ' + t[2] + ' value(s) updated'); }
if (swOut) { atomic(SW, swOut); console.log('sw.js: CACHE written'); }
for (const [f, src, did, rel] of pinOut) { if (!fs.existsSync(path.dirname(f))) die('no dir for ' + rel); atomic(f, src); console.log(rel + ': ' + (did ? did + ' pin text(s) moved' : 'pins already moved on ' + BASE + ' (written as its blob)')); }
console.log('gravitos3-esrgan assets: done');
