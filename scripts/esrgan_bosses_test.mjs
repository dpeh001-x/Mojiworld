// BOSS ART UPSCALED, FREE - confirming test (v0.30.x esrgan-bosses). Per user: "Yes go ahead" (upscale the soft / stretched boss and monster
// art with the local Real-ESRGAN for free; previews reviewed before shipping). On this tree (PORT / MOJI_GAME_FILE from the environment;
// MOJI_SERVE_ROOT overrides the served tree, MOJI_REPO the git checkout):
//   files   : the 444 replaced frames are the reviewed ones (sha256); the KEEP sets stand on their new canvases; every same-size /
//             recipe frame keeps origin's canvas and its alpha byte for byte (origin/main's blob of the frame it replaced)
//   tables  : data/sprite_bbox.js carries every KEEP frame at its new size (the dimension guard would drop a stale row); every
//             data/anim_calib.js row is origin's (7c14a3eed) except the CAL rows, which hold their solved s / dx / dy; no hit box moved
//   sharp   : every touched set is sharper on disk (mean |laplacian| of luma on solid px) than the art it replaced (x1.05 or more)
//   in game : at DPR 2, every frame of every KEEP set at both facings draws its art where origin did (the corners of the set's ink box
//             within 0.5 px, world space, rel. to his foot) with the same player-attack hit region (1 px); its art reaches the screen at
//             >= 0.98 art px per screen px (origin: 0.62-0.82, upscaled on screen); the Tomb Keeper's idle / walk / swing too (origin 0.66 /
//             0.66 / 0.49: its soft-draw bake ignored his calibration scale)
//   suites  : the boss suites still pass: boss_feet_calib (which runs gravitos_feet_plant, boss_anim_integrity, gravitos3_anim, the Sovereign's
//             attack-sets / dash / stand-in and the Arbiter's attack-sets / dash / lunge-ward / sharpness suites), grav_star_fit on this tree's art,
//             sovereign_lunge_dir, arbiter_lunge_facing / swing_pos / regen / verdict_calib (rows that already fail on origin do not count)
//   + no page errors.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process'; import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(HERE, '..'), REPO = process.env.MOJI_REPO || path.resolve(HERE, '..');
const require = createRequire(path.join(path.resolve(HERE, '..'), 'package.json'));
const { chromium } = require('playwright-core'); const sharp = require('sharp'); sharp.cache(false);
const PORT = Number(process.env.PORT || 11716), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 700)}`); if (!ok) bad++; };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const show = (rel, ref) => { try { return execFileSync('git', ['show', (ref || 'origin/main') + ':' + rel], { cwd: REPO, maxBuffer: 1 << 28 }); } catch (e) { return null; } };
// ==== GENERATED (fa_reports/esrb/compose_test.mjs) ====
const BASE_SHA = "7c14a3eedf876879b6a2bdfa235462423889319c";   // the origin commit the replaced frames and rows were measured on
// [repo path, sha256, mode, W, H]
const FRAMES = [
  ["Sprites/bosses/attack/towerSovereignvolley_0.webp","8ecf38bb6532e2d84ad2536d325e92d0dc39a0c41e47dc9150c47362d43ecbcb","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereignvolley_1.webp","abc9998dcd593507ab3a5f08c699b82566981d0176726f7cd44da338543a0589","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereignvolley_2.webp","60ff801ba509438bf3f1e9723744946121953cb4512857a51813f6e4e89dd831","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereignvolley_3.webp","90dfb5d57189a925eb3d0121fcb4f2939625ba2392228599f6ae47e57e5c59e2","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereignvolley_4.webp","489246bb15d1ba5596ef867fe5428f9abb37c2b5773f450f889f23f746a37742","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereignvolley_5.webp","41a5b1cefd197fdc3c00dec25b3e51c9b507fd98e5b7e48566298b020084013a","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereignvolley_6.webp","333096490ea43bc79df55b20cc7fd49bc6c124f88dca8c792dc2df1c088fcb28","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereignvolley_7.webp","bb8d20e6d115057de1674c1fe2372d2b433d4ea3a3a349cce6c28d89766a1955","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereignvolley_8.webp","526be65593e62cbd51caaf81b078c09785087f6a8aa0c5f0e4825eacce93ac71","keep",876,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_0.webp","cc15f2eedfb536bbb20445fa1b7b83058476a8c76e6eb8f99f5114ffb69225f7","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_1.webp","a9dff2c9968b011cd7d40d2877d83b8706a03f06990fc4d59d500dd2d6ffef10","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_2.webp","cb9ac87ab7ed8aa571fc5912c0cc534ff63def6958212a50292c1f668aa98d9f","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_3.webp","86c60a3e07cfbd2ed42b6f6b566232ffcfa2cbce0dac654ab884ffc3a0fe7ac0","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_4.webp","dac1e6dbd9f5ae7a78772bcaea6f15aa659fafb9c10913b792becfd54fdfb0a5","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_5.webp","e4191c7249ecce895d22003ebb1464de6739ab9c353631d216be08c281d87043","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_6.webp","59b392e700e8dc6dd02e9a25c4f163f08665fa571887a42f22fd674315bd5a91","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_7.webp","3b5f2d1f62a925d9f5dcaa0ed2008772b95f59bd806289664e51112420b7d210","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndrain_8.webp","1169d471b5d1f166a2415581ec0ea3439d29f128e7f6df4f2e734b5b3f823656","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereignswing_0.webp","069e736f80eefdc5137d9f0b9b592f00ff933d2d52c2e611b7b8131663ffb82f","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereignswing_1.webp","0c46e0716432b38b371ed5b17da5381fb99afd7f268c7a4d335326f6d55901c9","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereignswing_2.webp","df58d808910551c6931c767482905051ff1be448a0cc3e29fbc25950c59e665e","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereignswing_3.webp","f4c7b5180594f4c08174a212fca99b46a9619f319100d35f4a812759d373fe3d","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereignswing_4.webp","f58eb9620f987ab6eac73dfe4ec618b113595c9539b4f8939bc3939216f7ec6e","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereignswing_5.webp","bec1e9a7fd9e85cb7fdeee7d1bc962ae5d56d1470fb3ac5b073f142abae825fe","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereignswing_6.webp","159f9034050009813962bb27445552238538dc0879ea0c9b4623ff0882aad352","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereignswing_7.webp","56f26e9de9f0a8a02e67c6eab47d8c9b79a1656290bb12111789450d901948a1","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereignswing_8.webp","fa30db168100b71001a9415f505a36ed1d53d2031b216246bceba81a417884e1","keep",1095,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_0.webp","5d26ac64c710b4bb66b1d7c4283bf3d428fde533c7304d30794e00244bc0615a","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_1.webp","3e13ad416d4cf99a19bcccafce5f7c7f84618a6ba00ad3ee5eeac03e8e02f720","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_2.webp","0e84468e6070a49e2ba3990892fc97ca19fabe4e40035df77d38b2688b155e69","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_3.webp","f1c5612fcee6d51e86bdee39fea41491c695fde46c280c577cb1a499eacd1486","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_4.webp","843606ec16888bc431aac33b797119e4550f9607abe990dde5fd2118edc2dca7","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_5.webp","a15a27c30f4d226ac6262ed71779770f67e8dcff45d90ac570c2566d6a4f81fa","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_6.webp","fe11726ee3662ff92fb83a42aac69ae013d6627f62f31e8877b8fcc2936fa402","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_7.webp","fd11bbdc1fffa9dc9e1541dcba3eaecd42b13951d571c6970b32f1bd29f6f5f3","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigncolumn_8.webp","dda35d7edc0dbbee8c3991df13edb8559dcfac5d6f681f5448d8da6ce8bf9bf7","keep",1022,2190],
  ["Sprites/bosses/attack/towerSovereigndash_0.webp","76ccdd4939d1773718da140b0b30c7e565ba96f3f654ccf5ddbb1152f624a43f","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigndash_1.webp","2939f34997a5987d056e68e29b03f1aafedc3043e22d872cb09109e66a969e46","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigndash_2.webp","857ff70d08e0d000867ddcb7e00bb041aad63da8fe621ca9fedaf92aa8ff2cbf","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigndash_3.webp","46331340bf6ce4d809bf5011689a09d0b686d405f92d52e8884e03487dd0595a","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigndash_4.webp","ed91b104ee3fa877b369d30d709637e3f250f133fc5fa0fadcbe078fdf72f28b","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigndash_5.webp","600fb55b6bd3be63a21c63a2aa66b7d887f8832d86114afd59d4bb0df730ae26","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigndash_6.webp","668730791767f7c4272334984a8c545f032cbcbbc49306b45a74bc97dc7a99af","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigndash_7.webp","01e2f0f5df147ba4101f6320ec6097b55a52308041e4b66465e270bf1d5d8913","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigndash_8.webp","eb568db6292080be5aade3fe479b592fc00ff81409aac8969f10eb733c806e60","same",2200,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_0.webp","26344699671e9bf969e3f3a8c4d268c6135eebf97ca37cada2f10e70524ad0f3","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_1.webp","d253c7708454c9ca911522b0d9196c3d832e610be13d4b31c89f051bf995b3b7","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_2.webp","9f508518a6953529ebc00740a67fbca3cc00c874467490b912ee2636eeb551f5","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_3.webp","28e517b945fe678ab7678e53d6aa0ce6e5fa93f21ad3ff3119fa6fa25b1e37ad","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_4.webp","df31df4b84eb5de589e1725bf0b7a314f6bb9807563c10fc1fcafbdec304ed51","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_5.webp","ce8b09d4442e3d1206f848688902acc4716991f45f40b7273dd178b52ba1e21e","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_6.webp","239af755545b37a2aabcf84c574be2d6a701f2506fb99c56bd225c06b2c135f2","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_7.webp","e5535987cca9c649fdd38f36a6d9327a5e538b868459248645d212d312f1975c","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereigncollapse_8.webp","e66c3c1588d22ce1e053d4e3edf60141a6b1b4c0cbdfd165433cfd71af185200","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_0.webp","fb3ffd0ca6dba74c15c9ebea86732ce7c9e524b284a6bb342be03276fee1ae2c","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_1.webp","155771c649b64e1b896d8e8997fecc1e275ceccdb23edf5153152607c05d8a99","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_2.webp","1b7e682b79c069a3c7289c2be85f2fc170fc9b14324f5f472cc77f44948b1f41","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_3.webp","ecdd5c6826e371649baa618e196ace36f7db79d3b6c9f594879b83e3ca5f6c57","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_4.webp","c10549649c5d917bb59e6aff1a7f78b16840df70966a3f1aecde90f56664d22a","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_5.webp","f5310d274cf2e95f8ca963e4753d991f6ebc981b32e19ba0151d9770b125b900","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_6.webp","a4cef5defd75a84013935a798f7b39d415963a791523726e722ac23a896c193e","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_7.webp","d532286af1c1cf93e8ed9b43b38336012380882a5445d72098adce20a7da62ac","same",1656,1314],
  ["Sprites/bosses/attack/towerSovereign_8.webp","2c7c400a02086914e7826b938b9d6c33de7a0d61877d71d7a45e1487f88a8e19","same",1656,1314],
  ["Sprites/bosses/idle/aetherion_0.webp","679698ce4cd30eb5e9c059bab65fc50f085dc8fecfcec4068d2ca0eef120a4f1","keep",2650,2120],
  ["Sprites/bosses/idle/aetherion_1.webp","7cd3c4dab2e21684129149cef5e7d759def5ab837b2f0464155811309d730c7b","keep",2650,2120],
  ["Sprites/bosses/idle/aetherion_2.webp","ac8594afd99fe6f5ad2593061494d9608f66434cb696d3b4bc4d9e6adee96545","keep",2650,2120],
  ["Sprites/bosses/idle/aetherion_3.webp","5e2df4a8a18ec1546a074693619c89160d8e47dafc63535760df6df10d42c26e","keep",2650,2120],
  ["Sprites/bosses/idle/aetherion_4.webp","70d063874e9feb3e483ba81a2a69f34e01a5396f1fa2aa7c4356c5fd0552a9ec","keep",2650,2120],
  ["Sprites/bosses/idle/aetherion_5.webp","fca59ec596664bcf07620ae9eedfae57c40a040dfd8306d6085f499cec2b31a7","keep",2650,2120],
  ["Sprites/bosses/idle/aetherion_6.webp","3128b1b74dfa270dd917e3bbf282761c6c18b2db86a08158b7f48da211f3bf54","keep",2650,2120],
  ["Sprites/bosses/idle/aetherion_7.webp","cdf8db18ec00cf5198ff9a2b96df81c9596adfba320e1fd28116e12d6d93d40f","keep",2650,2120],
  ["Sprites/bosses/idle/aetherion_8.webp","ef589edb890e74a9190e2eb1fa7801191de25b0b210573af54a5da037723e454","keep",2650,2120],
  ["Sprites/bosses/attack/aetherion_0.webp","f79c69aff5af5141c5f1be102b8a9b2ee3c53b1fb104ec174f0f9d9bdf94ddca","keep",1648,2120],
  ["Sprites/bosses/attack/aetherion_1.webp","f79c69aff5af5141c5f1be102b8a9b2ee3c53b1fb104ec174f0f9d9bdf94ddca","keep",1648,2120],
  ["Sprites/bosses/attack/aetherion_2.webp","dc4eff1fcdb7f544af139843330f639464a99e8c269ab4c99bfc1931852a34df","keep",1648,2120],
  ["Sprites/bosses/attack/aetherion_3.webp","03f31863055e4a41985b74147c83fa43346c2eb993d77cd6877a61bc4a9a2930","keep",1648,2120],
  ["Sprites/bosses/attack/aetherion_4.webp","a2a60669dd8df3afa14aec8e87413a339a340f990e36d2d7531ae817bb2d93a1","keep",1648,2120],
  ["Sprites/bosses/attack/aetherion_5.webp","8ea6682afe2bc2fe308aa67d7053e8a5148e5a157c8e46ba0ff8080e5d862f08","keep",1648,2120],
  ["Sprites/bosses/attack/aetherion_6.webp","d1b8257116c40fab17885a854dd4550cc05f03d74171a7927ff0ee93d7342f77","keep",1648,2120],
  ["Sprites/bosses/attack/aetherion_7.webp","ef72009237ad1f5dbe375df43821f48da1eaa862a52957202a9082f86e7084ff","keep",1648,2120],
  ["Sprites/bosses/attack/aetherion_8.webp","ef72009237ad1f5dbe375df43821f48da1eaa862a52957202a9082f86e7084ff","keep",1648,2120],
  ["Sprites/bosses/idle/legosaurus_0.webp","5305604f853c5f1acda5b8b27b935ed9fea045a1f07b61c577da391d56428d0f","keep",1645,956],
  ["Sprites/bosses/idle/legosaurus_1.webp","fc5d052b803dd34f73dcc42ef2fbf05e4f534999879b3d8f2e0466e83f1c301b","keep",1645,956],
  ["Sprites/bosses/idle/legosaurus_2.webp","1a6f3d9d42ae5b2caccd3c10e587b69a0cb0ea9e0839e7bb9d73457449814a28","keep",1645,956],
  ["Sprites/bosses/idle/legosaurus_3.webp","7b1786dd0251cf52bade3dc7172d2127c0e3cf94a79d28161727b133819a71e5","keep",1645,956],
  ["Sprites/bosses/idle/legosaurus_4.webp","f53bf59cd9190c815cc7f28c6e8e64a548b7ebfd0ed8c6e602c7da52da478972","keep",1645,956],
  ["Sprites/bosses/idle/legosaurus_5.webp","348bbca7d7216f9ddbe6b142ee2395e8ec459f8b4411d41bb0f099c7fdd7ef2f","keep",1645,956],
  ["Sprites/bosses/idle/legosaurus_6.webp","f6f0ed124a29d64b8a452ffa4addc259362b211c5eaf1c9d93c671f552b44f9f","keep",1645,956],
  ["Sprites/bosses/idle/legosaurus_7.webp","217b60af0a4cfd9de694b4b59f6ceb5545435467b289bbf1da3ad98e1c7816bd","keep",1645,956],
  ["Sprites/bosses/idle/legosaurus_8.webp","4b99d0e991a7b78f9a45d65fa9a423181c1f4952da16637d5da375f2f23b071f","keep",1645,956],
  ["Sprites/bosses/walk/legosaurus_0.webp","a4d72172c5c5fc0b7ae53970e7f4340bc4ea4c2ef0211bd6233e9973127527e4","keep",1733,1006],
  ["Sprites/bosses/walk/legosaurus_1.webp","d2ff8e1318339ecda9e038de20aa2ac26860d31abc662b398e9f06c98a4f6de0","keep",1733,1006],
  ["Sprites/bosses/walk/legosaurus_2.webp","ccab58b6dbad368e8d36901d22f868d2333e351cdcdb393db94b83e6f2056aeb","keep",1733,1006],
  ["Sprites/bosses/walk/legosaurus_3.webp","f8fffe71150ca1c382e642fcb8706d2785be1d511b742a2db04322d3a2896adf","keep",1733,1006],
  ["Sprites/bosses/walk/legosaurus_4.webp","abf56c520e88148a9f1dfb5d1aede374c4a1da6464a4ba2fd9dba7876499e4d7","keep",1733,1006],
  ["Sprites/bosses/walk/legosaurus_5.webp","c736ff7bd46f3e1dbca204695a38add0ad598d4fcbc442e5d8f468385666d117","keep",1733,1006],
  ["Sprites/bosses/walk/legosaurus_6.webp","046053f9caf32716ca2e7d83aba31d32dd76dc976cfdb9153ab58d63dd2f1d68","keep",1733,1006],
  ["Sprites/bosses/walk/legosaurus_7.webp","a66fc7c8e1db8d4084d915bac697d698334534b9f75e6aec9b422ff3f566b4f2","keep",1733,1006],
  ["Sprites/bosses/walk/legosaurus_8.webp","28a37cdaa63b16a53316f2bda2a45218d5b0ff73230eb3d6973fe0d14e345e14","keep",1733,1006],
  ["Sprites/bosses/attack/legosaurus_0.webp","bf04631def1273a228523ccde385a287ea7b4e88740078e862ac4fea88c6fa94","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus_1.webp","6e821b1a6fdb3d8f8791c25442a17022bfa7a66d4c722094e3399fa8521d6ac9","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus_2.webp","4a20e2802d7026bbf7ba5dc7369db7a398511e6d6500c34f9d8eb3992b1a94c1","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus_3.webp","f18daca5bbb8fc22a4083bc32c84b56eec639508a7da451851e172fe86f4815c","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus_4.webp","55b86e864d15d97009ca522f2329c5e041eeba33aaf0dd69fe713d8134477511","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus_5.webp","7a1c03ae0a8304d7bfea2e1e28c22b2539407a8a5b29ae45f63a9f9677ab7176","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus_6.webp","3fd1bffd7c219ae070b6dddd57e48656a36e1dc8044eddca685e84f2199328e8","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus_7.webp","c404ff0503d8e9d1e8eb5f3c2449432c008c643e0fb1056fb90909acc54c9249","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus_8.webp","e49e268c03496c827b069f9181f2cce747254df9232549ffb06a352d9bea5ce2","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_0.webp","56b171ad08fc0c1b4288e90a1fea2ce5394cabceaa9357cdec5f7081c486cbdf","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_1.webp","97a9c8a03d8453972e5c80cb6765c84893aeffc75b0ab13664540e80222e1e66","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_2.webp","6326a36a0ccdcce4513a8baf4e55dd4c836803c1fdecc9f226e8199433fb850e","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_3.webp","67a3165159f79e752e887cab3fe5d20e8b5c2f23e99c24e9edd9c60a71ed19d8","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_4.webp","50c2a1e55f40489af4d676ae401794752f8d6a9efcdd274a05b16007883a9d23","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_5.webp","06d1d3d2b92d330949f74207a1959323fe6387284405406186bc331032c95d5d","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_6.webp","0b36a48d9c65d210adf0d54f0d6558f32e62d1ae2d73f6739e7c9894977b66c8","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_7.webp","34911514b4d0580ae5a91c755a6197abad89bb0ebe67b3f617a78506f8bdcc6f","keep",1645,956],
  ["Sprites/bosses/attack/legosaurusdash_8.webp","22bd90a2e357837803a56ae30683ff98dc8d4d2c36041e7c485e4f0f3296b897","keep",1645,956],
  ["Sprites/bosses/legosaurus.webp","9b536a91dd1bc5ba84d14e6618cb9100f4e8ad1316b65ac35fe866f9f2444725","keep",1645,956],
  ["Sprites/bosses/attack/legosaurus.webp","e49e268c03496c827b069f9181f2cce747254df9232549ffb06a352d9bea5ce2","keep",1645,956],
  ["Sprites/bosses/attack/towerArbitercolumn_0.webp","868d5092d681b403c48984730f12891b377c0f5f6ece8b2165f143bda7b042ce","keep",910,2080],
  ["Sprites/bosses/attack/towerArbitercolumn_1.webp","41929a4dd8a7d968254839268d85d52d6ff7252b4e14da289d1e4553dc6b38b5","keep",910,2080],
  ["Sprites/bosses/attack/towerArbitercolumn_2.webp","1d5308289520cbc8a94fbef2526845515e2db7c6904d600111d5fec200fbfd0c","keep",910,2080],
  ["Sprites/bosses/attack/towerArbitercolumn_3.webp","5cfd6ddcae3e2b9878eee24d7e6a3fffbd0bf2310da3118f3e55af2a2a8a4261","keep",910,2080],
  ["Sprites/bosses/attack/towerArbitercolumn_4.webp","f6e0edec9a24a68e310f2d17bc96f0a4d1a8406a92186ad5ea0ba435d1479a35","keep",910,2080],
  ["Sprites/bosses/attack/towerArbitercolumn_5.webp","5313a40da0b1114b3c4284350f769b47afeeb399451d760fc27e9d7ebe56ed50","keep",910,2080],
  ["Sprites/bosses/attack/towerArbitercolumn_6.webp","7bc5a6518a31aafddc361d6bc5ccb6d5c9cb2877e9da401ba44a3a35b6324ba2","keep",910,2080],
  ["Sprites/bosses/attack/towerArbitercolumn_7.webp","6b6199518b7f459666750cb5f18ab506f360c7206f3d9988fad73f79a08523b5","keep",910,2080],
  ["Sprites/bosses/attack/towerArbitercolumn_8.webp","fffb2d227076629d98c62514dc420f77ef3377735643666c914a58a9d9450251","keep",910,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_0.webp","1fc890fe455e0361aef847e02a00fe3df8eaf92977d7923e32423e1c314b4d48","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_1.webp","9d6be4ecb1956fa62388bfc453b671789fc35073d36817e186e9afddeedc894f","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_2.webp","fadd9d1e4d0ddeb52c99b2abd92b24ce492f08cb78bfe4a63339b9557faf731d","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_3.webp","31f0d9094f7ea02fd54b549452deeace2ceebc38e36b796d5889920653a51649","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_4.webp","678469f71fe65b1f8d6e239a30f297d7bfd0eba343a3396f0a64bf283304be4f","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_5.webp","e2c72b306b42b147aac49190a8d7bb017b0c5976b5018a1de90c192711d55c16","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_6.webp","abe27abe30714d45c3aaeb0e4c7756395c759e817a7443fe2aeb1b394b8170d9","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_7.webp","b57638ea8d39cef31c86140974af405d4b781c1e5a1f4ac1e33034cf1f58686c","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiterverdict_8.webp","9c097772bf49030fe5a8edccaf65cd53b266cab27e29941e43a76204a6bebf1e","keep",650,2080],
  ["Sprites/bosses/attack/towerArbiter_0.webp","ef2bd6519d97386a30e0c66c79f8812330f7847b3642de21fcfbd6ba9c9ac51e","keep",1365,2080],
  ["Sprites/bosses/attack/towerArbiter_1.webp","0952f1424299ec8d0f2d508dff9fcc669c66fee13da47457bf54766c8ac1c191","keep",1365,2080],
  ["Sprites/bosses/attack/towerArbiter_2.webp","265177cb9e3caa72650c9ea26170b859d157d6a77aeced9c19d56b26c7c00755","keep",1365,2080],
  ["Sprites/bosses/attack/towerArbiter_3.webp","406cffb21628db6af850800ad2d39370f405d6114570166e50cc2b7caf9031c5","keep",1365,2080],
  ["Sprites/bosses/attack/towerArbiter_4.webp","11118dc646b390504f62d81adf98120f1702d420d812c5b1084996c2433f2d9d","keep",1365,2080],
  ["Sprites/bosses/attack/towerArbiter_5.webp","17965f8a4305d4ee2af577df803e0e591170f6c8a7a58c5dfa82c9e4c0e1f4bc","keep",1365,2080],
  ["Sprites/bosses/attack/towerArbiter_6.webp","378f5609508e669583b90f55b3ae4decc31c184b4fdbefb80021581fe0aefcbf","keep",1365,2080],
  ["Sprites/bosses/attack/towerArbiter_7.webp","af17bb1940e3b8a53a8e62cbe4b4499831885267424b5c230781c19794837dc1","keep",1365,2080],
  ["Sprites/bosses/attack/towerArbiter_8.webp","81d935033ea6d323c6d58013d051d2eeccf1045adfa9c204a1e996d3c9cb0a5d","keep",1365,2080],
  ["Sprites/monsters/attack/pathsBane_0.webp","261bbfc6eeb8fccc72c70789605f4300052983380b1adb3fb2cb9a5e442b70a3","keep",1260,1280],
  ["Sprites/monsters/attack/pathsBane_1.webp","e240b4d0b39fe3f0e92fa945370f4188396ccf34d534b87a51263e73c037302e","keep",1260,1280],
  ["Sprites/monsters/attack/pathsBane_2.webp","e4b729bb5dae53cbb7b61c76e5af6f10b805f22e5fded8c7a8873f41fb9a5ae4","keep",1260,1280],
  ["Sprites/monsters/attack/pathsBane_3.webp","19d192a3f9ff47e374df416440334a143aef94c9492262607976568d56206684","keep",1260,1280],
  ["Sprites/monsters/attack/pathsBane_4.webp","bc110319a53b448b25901e09ea19c1fdeec1f46fa048d7da58a4a2536234669a","keep",1260,1280],
  ["Sprites/monsters/attack/pathsBane_5.webp","0221e2b282113dbbbe60b9fbb673b24b51c9fd252f048fb1b4bb335ffad2c75a","keep",1260,1280],
  ["Sprites/monsters/attack/pathsBane_6.webp","92f75c3d660fe584ac5ccffa34450f6ce6b0feec3f7c2ab35e1540b716c0c2a7","keep",1260,1280],
  ["Sprites/monsters/attack/pathsBane_7.webp","1687e74f84f486487ee982cf8a64e8704c5274367712095e55b5353535cd605d","keep",1260,1280],
  ["Sprites/monsters/attack/pathsBane_8.webp","7d667f32cf7f19ef63b49e7240bf812fa1a19d77cfbd74998407737349861d3f","keep",1260,1280],
  ["Sprites/bosses/attack/gravitos2soul_0.webp","c6bd110a33a9edc88acf3ccb219c6181c2e2b730c08fd53bacfb5327b631190d","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2soul_1.webp","f73accc0f6ff40c76ebdcb9db5fe3756a45067d204981f294f5a5cf5fce3988c","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2soul_2.webp","156fda5a97178850f4b53a237877fae3cb496c2572d9c542d2fd23e290932f7d","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2soul_3.webp","4867dfc5a7d178e4d1255843ddac2d5a208a3027ced5d53a8b25974f118ebf0d","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2soul_4.webp","31f790b81e5cbeddaa3efc5828d21d02184dbde398a69a3706b599bba28c1b6d","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2soul_5.webp","82a6359d495860bb847edc859d63fa6c513470f9dc1f2305727867321d5fe1d7","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2soul_6.webp","2b8f2d8dd746af81cb489b97862a6d9a2a04f973b554ad6319f6adf370540c44","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2soul_7.webp","a8144d5ba841c83ca2c6d6954c60198fd8cd0c20aed37aea19bada13bf494d9c","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2soul_8.webp","ca988d9c114af0a3c219bea7561f9c8600bfbac65a57570532773ac7317c662a","same",1656,1445],
  ["Sprites/bosses/attack/gravitos2star_0.webp","16fa4d25c8565a019552e768d039851fa6f27c74c35f00d909da8360483014cf","same",1656,1516],
  ["Sprites/bosses/attack/gravitos2star_1.webp","c918ed2ec61bbbb7e06a7da3635a0205181e274a64439d20b3808ce0458f4b05","same",1656,1516],
  ["Sprites/bosses/attack/gravitos2star_2.webp","4b1458847de27b663df1b4d7f402ad6ce2c4153f343b5d3293e48e293d8b73c4","same",1656,1516],
  ["Sprites/bosses/attack/gravitos2star_3.webp","13a663ee8b6fbcfd6c280b57ccb0a241c6d261b975de11bccd6b4157b4a4fab7","same",1656,1516],
  ["Sprites/bosses/attack/gravitos2star_4.webp","eb4d62bb71b9300eec12d0b738e6e91e5ab09c11f4bd6586e2f2f6a5fd8b64c5","same",1656,1516],
  ["Sprites/bosses/attack/gravitos2star_5.webp","6fbdc028da8bef7589b12080571551012e4e35705f622b8e23c0c5c04c85a078","same",1656,1516],
  ["Sprites/bosses/attack/gravitos2star_6.webp","813b9db8a2f05932c494bf2b9a6fa4c200eb64f84d8296ebae59e7135d78356b","same",1656,1516],
  ["Sprites/bosses/attack/gravitos2star_7.webp","2821b58ba01ee6a5c59a2cad3a844972eed440086fb74eb2a7cb0fbeddec4d3d","same",1656,1516],
  ["Sprites/bosses/attack/gravitos2star_8.webp","9b94b411dead242311870e91a09b136f7e578b7aefcd205b5c41ef7e4ad58f97","same",1656,1516],
  ["Sprites/bosses/attack/gravitos_0.webp","f606b7b313c40ac1b6c863def189285bdec3cf313c3006c23008631cfaab5e8d","same",1656,1505],
  ["Sprites/bosses/attack/gravitos_1.webp","863697b3cfb82316698e8ec9535ae1be1d853439629e68e33e4c184d36dfe95d","same",1656,1505],
  ["Sprites/bosses/attack/gravitos_2.webp","c0fcd86c57a05da0fee2ad6fe47406180cb567e5b416d5e4e2c26f8f2c627c6d","same",1656,1505],
  ["Sprites/bosses/attack/gravitos_3.webp","64f92d2200ddf248f47d849e45656b631085c8826f84fcbfbdd18635dfc788fb","same",1656,1505],
  ["Sprites/bosses/attack/gravitos_4.webp","871c4ded4d126e9482de2ed0a06f63d66a6f92622f6eb3b381521f5b51903d58","same",1656,1505],
  ["Sprites/bosses/attack/gravitos_5.webp","c35a9c7584c9ddf6924d7345ce9b03fd87e559245a065f42539d1b5526f56c11","same",1656,1505],
  ["Sprites/bosses/attack/gravitos_6.webp","c578196f2f50772d217061ac2af05e7911e3b5b9f0d62e43190daa7f867e443b","same",1656,1505],
  ["Sprites/bosses/attack/gravitos_7.webp","17eae12966f0bdfff973868a41eeef22334300528f3642c5358f2d39b54595c8","same",1656,1505],
  ["Sprites/bosses/attack/gravitos_8.webp","b0ca9ad226cff8d9ecf8d9f93e267e52df1d4c38140a10f500b2378e25a92924","same",1656,1505],
  ["Sprites/bosses/attack/gravitospunch_0.webp","037e82c446680f2390c3e26d1c7f50748d24fa97b36900cd344bdbfd60caabf1","same",1960,1505],
  ["Sprites/bosses/attack/gravitospunch_1.webp","11cf6ac6c64e8019353734496101b740685d9f470731754b596c83198e692788","same",1960,1505],
  ["Sprites/bosses/attack/gravitospunch_2.webp","5c0a0e06e2fd2b5960dff4c9cf930618d7d2d8938737f78be0943b4e0c5ad968","same",1960,1505],
  ["Sprites/bosses/attack/gravitospunch_3.webp","030e65af4ce52ea41bcbdbdd67b7ed487b44c20cdbee62a4449903cd792e52c9","same",1960,1505],
  ["Sprites/bosses/attack/gravitospunch_4.webp","dd50c16494568bef202676444975daffcfee9580db468f4b505645bd839d0fed","same",1960,1505],
  ["Sprites/bosses/attack/gravitospunch_5.webp","a31666267078dd3fd51993140ba8789d8351c9bfb03d4f8def5daa37b77cc21f","same",1960,1505],
  ["Sprites/bosses/attack/gravitospunch_6.webp","9f779c863e18c1073baaba9df61b780a6ffc181bf2a0e163bfa053cf8b456883","same",1960,1505],
  ["Sprites/bosses/attack/gravitospunch_7.webp","ee353eeaf0c8e407858ed5888da471df82705682a7abddd25ba1c548ff2a7f15","same",1960,1505],
  ["Sprites/bosses/attack/gravitospunch_8.webp","4dbb1af321eb8e071232f88543d2b6d8fd3e3b818e719ab6f8eee1a24bf0367f","same",1960,1505],
  ["Sprites/bosses/attack/gravitossoul_0.webp","7a76d8d8d17eeceddc7220b2c74e63978892e0f5d508e72b8a869459be0512c9","same",1656,1505],
  ["Sprites/bosses/attack/gravitossoul_1.webp","47357d80727ceb40bd9e87c90c7d4b2494a5c7e0b9a683e692bd2be9d6f12a7c","same",1656,1505],
  ["Sprites/bosses/attack/gravitossoul_2.webp","ee79d72b62059e455ee9296e1827bab9a7b4438066b89bbd8b5f60c0f21f5ccf","same",1656,1505],
  ["Sprites/bosses/attack/gravitossoul_3.webp","4aa3706c6aeff2f99a4978205033c4f1153862a5ec0bc6c1409ba25fd664fcea","same",1656,1505],
  ["Sprites/bosses/attack/gravitossoul_4.webp","6e6f4e3f6dcd8a9d7925c956b14c2d70d03fc540adf3258996ff6c53596a581d","same",1656,1505],
  ["Sprites/bosses/attack/gravitossoul_5.webp","c722e1f2a34cef183915203d23a266c4fdc0fcb9461d4b7f1d9aff46a3b6ab3c","same",1656,1505],
  ["Sprites/bosses/attack/gravitossoul_6.webp","75c4915557fbbca377357352835cfb0c51de5f272421a00bf14df2f29db19613","same",1656,1505],
  ["Sprites/bosses/attack/gravitossoul_7.webp","c449155df32ad9c81a78361ddcbe5e5e06f16eda7cd961911bf2c42cc371d12f","same",1656,1505],
  ["Sprites/bosses/attack/gravitossoul_8.webp","fe9a47317962ce501c4ca45eef5c42621592a51474eed783ea9ec149aa27b19a","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_0.webp","1bc2b649cb913492af5ed7d19f6a38dc75f770d0fe9f8aa37539c80e958c7eb3","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_1.webp","34aaa36f6538428233bb358aea78585d76624bae635cd40e48419337453e651d","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_2.webp","11e297baadd9e96448d2ba68917877f2cf84d4f7d96e54dd36c80c2df2bab504","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_3.webp","9698fafc8b867524fd90106db11e76e671acfb4046aea2ca2735bb4ba3a5d23e","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_4.webp","6d91c4229131c27cf6a49133132f5a6895922c8bfffde03492bd2d1f7fedefea","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_5.webp","bd42cb174050f6e1552f1b6d884f551025c90d5e08624b783bd7dd807ac0f55f","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_6.webp","2ac3eb840a8fb1531f4390216e33064f40b4c926c8104ca35d5d688d229b5f9a","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_7.webp","1a8b931dd4fe887fefaca47a9dc0b1aa91b25e25e8e06bff456ad835b4724da7","same",1656,1505],
  ["Sprites/bosses/attack/gravitoslaser_8.webp","9a87c0f0d73faaad1c806e881e6f711db56f4547154826b524f50bbeb2f34fa6","same",1656,1505],
  ["Sprites/bosses/idle/miraFallen_0.webp","6c9df0854493244ebf882ee4663d1893ee5a5b142a9352399162e64a41885c15","recipe",2240,1480],
  ["Sprites/bosses/idle/miraFallen_1.webp","fe18d75c4f3ca7abe149c8fe55069fe869ec9c69d7214faea2ecd866d6129afd","recipe",2240,1480],
  ["Sprites/bosses/idle/miraFallen_2.webp","5ee2c5854b6fdeebf480aeaaedaeeda8cada9b5b3b453afc0a2a3ba00e5b2f26","recipe",2240,1480],
  ["Sprites/bosses/idle/miraFallen_3.webp","5f89596744dd9f9fb8763576b09e181039edac94ed2e0861bea5c0ec3a037df6","recipe",2240,1480],
  ["Sprites/bosses/idle/miraFallen_4.webp","75f123774f2670637a903d3c63db65cb5249c6ba642aea7c171a4bec378918e0","recipe",2240,1480],
  ["Sprites/bosses/idle/miraFallen_5.webp","9a20aafab53c40d0dcef5c63d9f7344af4f6fec8700666d86c85e4830282bde9","recipe",2240,1480],
  ["Sprites/bosses/idle/miraFallen_6.webp","e7cf7a38782938c00ac5a4c519a7225d3371ce979ab9eeff836fc528f34fc647","recipe",2240,1480],
  ["Sprites/bosses/idle/miraFallen_7.webp","f1828192d29c17ea9d137d49b33669ec852e146f9cabb0b2f9c5edca40489331","recipe",2240,1480],
  ["Sprites/bosses/idle/miraFallen_8.webp","c546b3b3403a7647bffa379899dbd7f4a4dc6be5896d749204a23c67043b83b5","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_0.webp","a266b9f9430e3710af56e2e2e2051da61a5d5e541549c0372a26aebc053b3a1a","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_1.webp","badaf9837928eba8127d8886261132266aa5de0866c8bb3b61772e4c89fd2b92","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_2.webp","2fe7c23b42c682b64e9e82676c0219cb0246ad5b45a0d668517f4ef505854c63","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_3.webp","7b37477ec3cb4c24a37c69d664ce332b8ac5f340d89bd3f52eb94c5e2ce9b7d2","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_4.webp","53f22ab821f874af5f25eda39cb01051ae518c9faf781ba1425acc30f1a25e50","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_5.webp","7693651a16509032c901bbe89bc82f886a46cd497f3390f70663987f8b21e958","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_6.webp","4f4668bd4ec56ac17a392e846b78fe26945f2e1d073f0f5401cd13d31d3ea584","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_7.webp","d6186a0b5c0647cdc681549c6065f793aa9b45af424289e21febf15bdbd23c9b","recipe",2240,1480],
  ["Sprites/bosses/walk/miraFallen_8.webp","ea56316770036b52c6c281f4f71078f14fa122dac0113f98652e860f02bbeb8e","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_0.webp","5cede2abcaf417d4157ffc1c70089890b30f756b522f969401c0e5d26e0a342a","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_1.webp","ddfd0a166df9b8440c62846203ffe53e2e2222a7b5bd86e6a956058daf896d90","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_2.webp","fbaa18c2d64aaaa785edc80a6d86db4f51d4524b6faa535be432276081098b1e","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_3.webp","c729db3dd3409d2c8b7d0102670604828d31adaa2b21b5abe7aac41e266b10c7","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_4.webp","87389cd59506bcf823aef32ee43ffdc15a5ee46b9a8fd2939d9ffddc0bd04c1f","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_5.webp","11ca7f581197850ebcad45f0546122e7f0012eda4b7ad35bf4b969dfa55d5c76","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_6.webp","06ebd4fbb4444df457c354b0a74f7d5140251537dc0f90bf3c0ad861121401f2","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_7.webp","e21b90e0e0e2a3096970bf6e6e02f4aaad22e99bc68aa432aebcecfd96173aea","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_8.webp","03c2ef9ec5a941dda93a3b46d7ab4ea7aeed3ca52f6a0c7cd0bc08a4f99e86e0","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_9.webp","4cb0d73adac116d6e9f553a869c887dc6b44224f5f4db87595432950aa0ce356","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_10.webp","548522fd2a1b696d42783e80ce87471e4992ec3d840140606c120c28074758ff","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_11.webp","96c8000af8fb20d369d1724b7323689f801462c797d395073f0ff402f4c3d2ea","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_12.webp","f9f07d8a593f20bdcf1d7732c2f9130b37274b8b70a31a15fe1c300396aa4889","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_13.webp","4c9d6c6f80e599b9b507ce561f2df1df27bfecedfd6cf60ed16ca90c21e94afe","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_14.webp","15c76600c1bb7c376fa45b659a95a399371ff4f223d28d390a8e37878e44992a","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallen_15.webp","23817ae9d06bbeaf91e4ed645d1752f00a50568ebd097d6c1ec456b56b956344","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_0.webp","398105e071fca82ce94d794374364c67e71418709a55fe24102be4a94b8ec70d","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_1.webp","0a3de1331b3b3ec3e5a431a3c1912929ac16b3aeb340db8e671ac89aabb5df01","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_2.webp","8fb8371703cf7f3ed09cbd745fdffd7032c23623f2c5d19c11f9eb32900a5f00","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_3.webp","9a76bf0da735050adcd0e1879b699a0d6441b02da65942afed85c01963a0ff04","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_4.webp","b9599f83bb6def610ced98dd584731570d6a38dfbb87206bdd8253ba9b8e20c3","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_5.webp","308cb74d302938626d6526edf95ce66a63dc65d0611246fd032b95d522ba1c7d","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_6.webp","eeeb528ce259ed3315d2046c46456c409caa9059abff87494e3e9d1c82c98ed6","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_7.webp","eb67838fb0d237cb4a0b3d62c7d8828542619827704d0137ce9dde6799cb6347","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_8.webp","d0710445eaac73293ca98e1478732aafdeeb6c70c3c9d5c8c6dd6b2c992d794c","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_9.webp","c6bb198445b76601ce689b85b8084842709ae100495933796675502c2fc63a6c","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_10.webp","94d9e904e0b1328fdd711c68fa0150a77db28e8213bc9b3096896abae484e53b","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_11.webp","d81286a534978793d3f3c7e0270f84eaccdb1261458763442e990cca8abfa923","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_12.webp","7180871dbf5778b837feb1984d02873214a6996ace66d1c9786ca822cf589e10","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_13.webp","e8d1c85d013a3ee127ae2e872a436984c5be59fd6bcaf095eead7468606ca58c","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_14.webp","8404e1afc971983e43ef7fa0f893888e4508015289813b5ff2ce1f30caa71fd3","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencast_15.webp","12a053d5dc3c50c31a5dd2fbcd0370929079d7163662d1e6d094a1b70b410056","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_0.webp","8a1624843e491532e9220c3ba83d289e41803cf6fbdb9335215e5e4c13e24d13","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_1.webp","56d3e690ce39585ef4053fe0e182a542505f15565541945b0ed1eb783d55bd6a","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_2.webp","3f098d4151466863c6608eec7b5d20967c87e43ca094849c38960d3aa039619f","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_3.webp","572cd06d404aa0ae626fbbe174d16faf97036eb3e033f20816a35fdbef64806e","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_4.webp","3df9afd3a4d11be343c19ddcb73cc89d150f96cc6d70230b1b63fbf0844fda9e","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_5.webp","366a6c17143cf39618e6f8099cd0c793438189cf1f42a579833a1d163736b452","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_6.webp","2989ea00a863f5c1137e90f7c20977ee8e7c0564ea29df62ba95fae107f302c7","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_7.webp","3eca972f5cf28b94a2b2516d76ce6e28bb0fbeb59a159925db3ef1b3f07a53f3","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_8.webp","5ec93b5c989c7980e40288b09fe65c44cfad9a1da9325e31e18982cf034557c5","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_9.webp","7dbdce2bb0a96f7f81d038bffdcd356005a6ea5193b0003210a519756a0847ef","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_10.webp","1cd0c0a3b3a6e1bf65fdef98b608f99a824b711beabadffcc1b1f0c0b5d7540c","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_11.webp","24d92f2a0962812801852c6ba6ac2c56d5ee6d77f28c1716a50f898733ad1fae","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_12.webp","ad3eb7fc3500c5d00980bc58c5084cc795758c58a71ac79fb8f76b1cf63018bb","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_13.webp","6cbdcd503671a072339574f25c3a07d11e721d785c95818dc19fc62b3491d880","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_14.webp","8fc18c78c2dada1fe6eceb2bce62acc8a88a4f279db1efd9b608b768d6551375","recipe",2240,1480],
  ["Sprites/bosses/attack/miraFallencollapse_15.webp","6ae07b4f1688ccfa1de68524310ae7d9d52bdd0d224ff2e9461602ec60ffb068","recipe",2240,1480],
  ["Sprites/bosses/idle/aetherion2_0.webp","9028efa8ece5029c456c1248b6e59f4050e2b72988f87e2a73c5691004d22a53","recipe",1656,1204],
  ["Sprites/bosses/idle/aetherion2_1.webp","01ae603c03e2c16d3cd108fd51e91b0a0cec3094f507671e235a7b5482e93df8","recipe",1656,1204],
  ["Sprites/bosses/idle/aetherion2_2.webp","9ac7e8eaaff5d2c6f8263f7b88739e647a852ed8fa7def55b3d622f55d4f07b3","recipe",1656,1204],
  ["Sprites/bosses/idle/aetherion2_3.webp","dae6c88725364d0aec6fa8d3a5aaa130a0e96c489c20a91708b6fb9bff2c674f","recipe",1656,1204],
  ["Sprites/bosses/idle/aetherion2_4.webp","e12e48a7f5d19152758c6205e9a3cba82b949bfef0391ef1fdac78bb37283c35","recipe",1656,1204],
  ["Sprites/bosses/idle/aetherion2_5.webp","11bda183b73736ac70e500e0e0739359177136568ae0dba0829069c7b4e414b6","recipe",1656,1204],
  ["Sprites/bosses/idle/aetherion2_6.webp","ce0a62e21376ccd5789ab28f65131c05fe53b1e0d66d3a4246edcd91ce23ba69","recipe",1656,1204],
  ["Sprites/bosses/idle/aetherion2_7.webp","5d64494d46167b069bf314cf4b3c2d4b6f44bc66465f68bb2f7227aa0728465e","recipe",1656,1204],
  ["Sprites/bosses/idle/aetherion2_8.webp","e1f10d313d1a2701576da88e0f9eecdde04f592342be732ebd7d257f907d3941","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_0.webp","ba3ca05583e8e1b1b52e124a14e7c1ae4e65dd2de465befffcd3069480bea8e6","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_1.webp","ed59c8d81e664f59c23d32cab3f1d2d1f159ecc200989e04c9d0a46a661172f7","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_2.webp","91116ed45e013af81b93f151439a9adf94c29bf1005f8780bd1e9087ca9e3b89","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_3.webp","410ba3610ef71ac3f98ff6e41f2c552ad97096b3cd0fc0f0ad7a0d63430f3b3a","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_4.webp","59360d15f5cd1c8e94c7ec7cb27d7fb91472d3e97eb626602aad9b19fabf2d87","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_5.webp","cc31ca736e22badcc9f8a55c45410f8119587d6d77e13104911a71eaee1fc85f","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_6.webp","5c811d01f72c451cae67eed2afe3ba38069543f105e557f03fe0f654eb9ef19e","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_7.webp","0150528874f9ad8a6be5680e88c52e853151874a371599d400e1cf38ea44e874","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_8.webp","46dd1ee59af259597e10f35916a2b213e34aa74678b0478497ec7ed806461e6b","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_9.webp","825e45e5ab95985bb4c220a60dea9ff72ef8daf24d1ef92bca05303f724e9dfc","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_10.webp","98a08844b96a3bf45c69b368621fb16d2f2f2c3a7b89950284887dcd91d6b66b","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_11.webp","fbaa77d23197ccc62958ec9186c7364738339dba9e0440daba9ab0702642f3ca","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_12.webp","3090dd5cdba50746fd26947f015fe083371d29bc5d3d4c0897e0b99dfab874ee","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_13.webp","05ff02473cfa4e2abe584991d502850e966ccfd33f0b7dc0567f2ab9e11f6c22","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_14.webp","1fa362fe14d954a1e61e8d455e4768a81e7fe95b29d7fb63462b1208894d733f","recipe",1656,1204],
  ["Sprites/bosses/walk/aetherion2_15.webp","ca5e78ace0882b8100f06b233d8e7cd826616d4f6a160e32752e45a57bd6d1f4","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_0.webp","2f5a7e9be7ad6a11b8fa9b71ec5b72ceeded9666dda766008480d6ab01748ade","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_1.webp","585e93ad24d33a1beeabfe4d10c28be7030f382a06998989ba6d68cfa962c381","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_2.webp","e602d36a35b97b448699c7a8fd24f61ccab87d08db6387e94bd1bf4c425188b8","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_3.webp","c844033e9cc7ea78bbdbaaa61717367f985e8a8ad1e1fc0062587b3d7069d8e3","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_4.webp","4f51911a7066799f661ae3e3b5909ed994cc47c70f9b8a01b763c93ed81e159e","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_5.webp","20a46dd4a5ab9dc84c0bbc2256502c1d053d9cb5e9717787a64ff129f2328470","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_6.webp","7f6f9db62477727638fe86f1bd58ffa9cb38a6aee76cd4e6270821579c3e92ab","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_7.webp","7b945fe9fbddc359b54f7def5beb12b296a3046bc1b159fd36a916fe1712bbfa","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2_8.webp","85b2e3b81ffd101a7488b97620424f6b4fcff921ff2348d0d3cc2d2f44730adc","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_0.webp","14ff50b69ed4cf58d21182332789fab8157bb7c94eb21fc4e611b0349310e867","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_1.webp","dae4ff922aa3feb2846b3eedaacb96153bbd57567238b5ecb8e380a60c74ea29","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_2.webp","79cf6edc2bde2ff2fa9bfb9107555b14eb6a793ab4e81a173e9541cbdb3f84c6","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_3.webp","b666433d7d8dcdd31a80758dbc60c63e5995118020e8d1cab794f0db597e191d","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_4.webp","704640b97086f78f84fdae471263e06f93c175e4cdc8ccfeba3e6075b3abd470","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_5.webp","0d9acd29ae774c402f5cdad7b4d2b2763476274235c923b19e30f8404d559439","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_6.webp","5ce3e867a59a7a72a682e085fd2af479d5e53b4aca8c932d2b77eb0b944abb28","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_7.webp","9c8a96a104acee0daaa8e8555d3b3a1c6f2551a875069a4e363e75184b8fbd41","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_8.webp","14593e4d2be36bae8fb1aa5b877fdb188dd33dd6e191ad9d0466237ff2643864","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_9.webp","88b9112546f2ecb5796b29b96a19f820e25e30e75ba89fe31abdd63cea2898bf","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_10.webp","b6d46fbfa8909879ad5974dde16506e3729d71ad3fb9ffb64e48ecfbc5925222","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_11.webp","f42da61ba0f0002e681fc550ad8a14c55169326644b1f761b2eef23a55f066da","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_12.webp","66c2402b0c42520d66ab2f8350939eabcbdaabcb1fcd75429b4171454182b788","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_13.webp","1adc27ecd3f7fda340cac147fd1ca73fab723644e5682283d43fa4697f6942a8","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_14.webp","8d7a3eabec3e70d9ca4582ebcfa2cd7b2033ef49df5292818faf3c145dbff5b6","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2fracture_15.webp","341ce13ecfa53c61968e8c72174b613d0865c3e46cc9e49a7b82b550fe5c0b88","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_0.webp","4889e2a66852b9da438f36a7a3aa1195a10a27d5d6662109770d58924cd0886b","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_1.webp","b8db082096715b8c9acbe021cc4c5b824eae5e6e5282059a8f6af9e13e6f30b1","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_2.webp","b495f2282de3c897ae5439c41f3a4e5247e49a9800c0b30c15765023325a57a7","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_3.webp","1d73bfc72e30472493fe25741534644a0994d361b02c174d8762782347ef1dbf","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_4.webp","3176e013194c3c96feae3214bd0a6d5a18d25b474ae361b09b3e5b6e27b8225c","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_5.webp","8a483966be713440bece325f0c57a1d75f6261d543877bd0da0ab24fd1fd3426","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_6.webp","fbac98f86f24d3e60fa260cfaaf23a1b4f1b126b24772fd77dc3411a742c0d7c","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_7.webp","7c3de933be3c6348686a57d8bd9bb112f9a92cab328bc04fba71bddb30882634","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_8.webp","2afb2884f0e6f011f06968768a6261991b0d8b5883e3b19be1765cc458dbce7d","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_9.webp","90f9cc5781960654ab6e2f4de72ac7f404a577837e1c3641ce67cc3c7b786be1","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_10.webp","b91d3943859835e5227768190260d5bdb1fc017eb0c6862eca28abf5a92c9e59","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_11.webp","179b730668846fd70d9be2add8808dd8ad2a1f10cfb83bf2266912437e370f17","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_12.webp","6632da97bb0397e3470d6f2ae4796d88abd18a40fea2551347c21b558b9dc2ab","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_13.webp","b4a11bb75c13a51e36ea93b0e56b4ac638d0a7be265dbf318f3da5c9c387b6c9","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_14.webp","e4093f5610f05efa632d99c6a0145ee2456a1055fe32b7a3e5182fa9309c10a5","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2lance_15.webp","4557559773ea565e158803e5ff94140f68971aa1d27ae93f7c243173eb3b654b","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_0.webp","7dfbfe8132be6940100350ed67aeea110e717c54b852287f36f7688add283d20","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_1.webp","8ca70fda6b66916c8ea795b780fc2208185a6a3616e9591ef13c36945201ce90","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_2.webp","ccc851127b0726c6613f9eb985fbc0ce080879040e9efe7dcd7af9eb013e3782","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_3.webp","53d3fe6766c7dd818007097852dc0f711000126e02ff6b96f3494737cb46b8b6","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_4.webp","c447b2e8918e015a237dd5591bbe0d1e4dbcd10da3cc8c9a62879702a0daf2eb","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_5.webp","18b8aa915f8c5bb5a27c7c31ed77e611a240db2d29827e37c37bf705389523a6","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_6.webp","27360f016227c56dead064d2c2ab3f60db1e32a503deef096214dc0616c30cc0","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_7.webp","b1f0ff3c8bd958156eedd0e28007972f364cb12b64dbf2c3ba10d7e75100ad65","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_8.webp","37884e5eb0417628dfdf0e6f2625419789e44b19e777c4767913e35dd976abb8","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_9.webp","ebcaa2a9d0ebb07a8bfe900de9b6b226962550a1b7a66e3dc3e22343d6242c67","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_10.webp","6014350d7a5681eeea4b1cc617947a296d11073c504dabb5e841268fc01ecea4","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_11.webp","8ea636f68e111f1073f0c657bc8a823d714989597f81ea98f6dd8157c77c3a28","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_12.webp","5518c051521f7e0160cd03ba7f146a4620cc74568262a31fe8a42d79a5543ffe","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_13.webp","c39de1b0b470d6b3bb5f554410efdf1fe51b83af67bdef9524a15dbd7928e257","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_14.webp","30c104c0a6ba268a064851f65024d8378a1e3c96d78dc50c8d88ee9f03aa312c","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_15.webp","a5b6518ca3898fc6757c52705018fb0816917c9cc027f2ec87fa13b0e7a9c92e","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_16.webp","609f960e5530d7b69777bd3a9d41e46204a3d75b24f950e6264ebf7605ba2a91","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_17.webp","db76c8de6b625d508ca95fd7377553e0f7e39b3183a93e89aca3aba63053fd62","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_18.webp","302e6add1203fe1dd8f764bc9b4440d20cd16834a0cfdf211d2fade45a0ed10e","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_19.webp","1cbc33d4f5d197d5a97a9e22b83d308c7ec402f1da42fd2cfc75f95c071884ef","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_20.webp","7dd2846ca5fa90dc46b4457e031a7f1a9acd2f273033aa460121e9993e79c868","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_21.webp","91cfeafdc03d45b405b2c2002ec8bce9da0d0b5f89a811c347264f1745cc15bd","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_22.webp","2f6464ba4068f36a4ab26e3cecc9593200dc4f1f0585f4af05f1baa385924293","recipe",1656,1204],
  ["Sprites/bosses/attack/aetherion2astral_23.webp","463f96c236c4c01db6556296521fb3edff5badda9a4d411800d78c0ca1b9a66d","recipe",1656,1204],
  ["Sprites/bosses/attack/gravitos2laser_0.webp","d7f0996ebb391e42e0a2b2a2c5292466a8c9ec67c4322bcc6c1fb66670126d7e","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2laser_1.webp","6cd23a23a2ea545c7ed9b802d3bee3d9e38c6d2ba79978511fde5d62c719376d","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2laser_2.webp","629b24323032bd8c9b42b2cc5b450e022077afe134bf52b504db28948cbbba87","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2laser_3.webp","b4721c046fa097374a2a7eaa60e0a045336531050f191aff11b434b73481657c","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2laser_4.webp","0a5c8ba4d62fb95ee0d7280d996579424163fcd90f2151d120a9f858f7fcd859","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2laser_5.webp","86cc0ea1916de8359cc26250fb529b662241a2c37e2bebc7672aa8da65396f8e","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2laser_6.webp","5b3133fa30dd4405375bafbe7c772b0004df15223be394850135689c5beed197","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2laser_7.webp","8399a6e1b2475f9edfff3c628e26cdbd425498b38c16bcef1d4fd076c1d95533","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2laser_8.webp","c80746b87fcca143f5bb9e5b58980e3abee04370824f7d5ee3a1d3dc7a59ccd2","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_0.webp","e954787271d21d471617012204467af7ad93af9c8ca67a62fa24b082a0feb302","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_1.webp","ca18ac10c2be26530cf48ba424f9169c31415796a6b4254b58cb748ef891dcf6","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_2.webp","cd41bc2dfc5b3abca2f998bce4f30e126bdef960c3dbe44a9012b752be75b46e","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_3.webp","0a2d5bbc89e5d028ce80de88a3fa9649fd081a194a08453037d2265c07d695bb","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_4.webp","c605d6ff996679335e0d931a58928055a98be9d03f139586d20460ec20c016a0","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_5.webp","ff7f915934bd57a16f33bb44596aa8f05b296b12db01076934c327e60d6b8c9f","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_6.webp","c18b256ed6694a4ba1f3a0bfa908e2306b20f22b40fe224d58c94e4b25b2ad6e","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_7.webp","c3b3ced2fb08365e430a55328c44a9524f6c3ea9eba1480e8ed0e0e169d33640","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2punch_8.webp","e02d656d367990947e977250e880bc351b42a395aef79e9ee60a9c4c1bedea8b","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_0.webp","d2e86ce072e73af6c6c4a7ea8933b9bda1399d7e79f123adeee353d6c3501058","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_1.webp","6a1b1817801b9495e6793ba619bcdb7c5059cfd4a2b6dcf4ac71439e420edcc5","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_2.webp","65a36e60c94f97716926f75795119b66e0b6e35ab662de8cd1fc290b9ce58287","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_3.webp","691ab95d8e040aa8776b4f1ad1ea4abfa6f199d9ea3a8af52370a15624510dce","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_4.webp","1e2ae6ed74e0724e27b65ef1cf7903237632915b79514a012ad3823d2b1679cf","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_5.webp","b333dacc1aa76d3b38332b76a5abefb816ee9d93010adba925b9f619355efc12","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_6.webp","4ee0c3002765a25e209439c97436603a2b1d1da8abcb37a9309472688430f9b8","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_7.webp","e0ce6fb8ff666cde8c5701e34ee50451628d77439d626ebe7c27860f2528d1d1","recipe",1656,1445],
  ["Sprites/bosses/attack/gravitos2_8.webp","4bb1f3866bddbf39be8a39579226520cf7efba464fdbb17656f6de2897e3ed0e","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_0.webp","24f92382c459fd57b86aa86472f154ad8098d91a7a3a74fb4319fddc486bc5b3","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_1.webp","630dd1cab5c0f51ff48d0e63f43b48542c33b70ab18fc22e9b293c1f4fb5f9bb","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_2.webp","b4e5c1de87d9db8957f4d62be7e0b494dee4e727631090f834d9f84184986161","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_3.webp","78b844e57ff8d3f16a63c12946a5e5cbbab633cd3e65b370f5d36f21aed562e7","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_4.webp","5edd87ad27fab9ac29af0307e2a6859191f2b8e2e9661fe25bfb9b7054efbc85","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_5.webp","643a06b547b20ed83a14f210685740c00dad3398bc0b00c42246c81e9f04d4d8","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_6.webp","7f394a802dc9db6a5d4499978fe4f623959823a80adc4104c548eaa6b9bfb6e8","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_7.webp","92603c89d680e923720b27b370a439e369a1e2f4a0174c435a6af8345e8b0bd1","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_8.webp","1ec9f246b9a8d46b9e6dc8120434be6fdd4fb6f809e6af6e7cff2a949dc5151b","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_9.webp","77ef4eb402e488ec70991646c9f12841f5d43871c92e54f20fcf11d80af4d4ee","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_10.webp","598b3b4289e757648a0e2bc729108b5ac8f29ad7d26985a30c8d055bf5b409b6","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_11.webp","479ea8e81cb1ec7b91d6c01a1b3aa4f39334f650a2f9fa3b84d4bde15c3824c6","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_12.webp","87402ab7759003b11867554cdc94507b7644ff3dce0b239d3f30c4d549839f95","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_13.webp","69536beaeb9e465d5b998a2280b17162b5accf63a47cbc9d64d9d9f32a3d4a42","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_14.webp","120f3aee9976ae88fd9bbd2097c525a14df0afae829b30a560a3cc77b8372f57","recipe",1656,1445],
  ["Sprites/bosses/walk/gravitos2_15.webp","afffda88ed012dfcf22f22108202a055382b8c0a110f08070afadc0cdf3021f0","recipe",1656,1445],
  ["Sprites/bosses/idle/kingKrook_0.webp","a581fe7ff332c7f8a75d0c89398f9a7038d11ddf13c9519593ee92188fa06c8e","recipe",960,960],
  ["Sprites/bosses/idle/kingKrook_1.webp","74ab337dd3d0ea6cfb95d5e173b0a1941677fd4ebeda0cf0f2e30e567a050056","recipe",960,960],
  ["Sprites/bosses/idle/kingKrook_2.webp","ea2df465e3482224c07e55eb496468c61ae5eb67f368608e53a2688e92185c66","recipe",960,960],
  ["Sprites/bosses/idle/kingKrook_3.webp","d5099cd54cf437c87b6d5eaa0f7949797b844b983c445306e59dbe810e9d937c","recipe",960,960],
  ["Sprites/bosses/idle/kingKrook_4.webp","b0209df13d4509cdc44d99abe5a6aeda2e605f2a0f1d8920cf7d9098736fb0c2","recipe",960,960],
  ["Sprites/bosses/idle/kingKrook_5.webp","dad25243716d5775a4a32d9838d72f3050df42b207d820eb634d894f2db2e78f","recipe",960,960],
  ["Sprites/bosses/idle/kingKrook_6.webp","6abcade53ab4525e6f5952b32783b5e01ce530c974193060edc5774cd998f0b6","recipe",960,960],
  ["Sprites/bosses/idle/kingKrook_7.webp","19469c5d49c014b29faaa2ae7749082429edc6a9ffdde19e8ee6ec32abb5eeb4","recipe",960,960],
  ["Sprites/bosses/idle/kingKrook_8.webp","a1897a5e58bef7d33079b94167b9165e384e916501cc1d8e4a1317ffe142edfa","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_0.webp","7d107fe1737e22675d9f4093f57d6489f7c43a96cf42f261291a969f79fb232c","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_1.webp","98d7219c4661d80963077e8d9e5064ee33a250578364d94b26353803f96dd634","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_2.webp","2837a76baedade523a5a2f69466256a53a3b10a17dc90ecfc05a2147e615588a","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_3.webp","34d70d7ee751d037949aa6f7460c398ff91c63d383f929afeb8a9d8ee838f219","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_4.webp","726ab76edcf7f65e7a4f7420b12fd3c1331b738b610479069b493589699398ee","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_5.webp","661a9d4374df78625c2bbbdd8569e8be3d9825e2a5c3f8dc346b50033289d392","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_6.webp","5bd3c252a606880147ba19b9ae7eda5ceda14b6f0c6bbd93990157e95c8d0434","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_7.webp","48d1580e7ebfe5e0f05c8623d97e34bd6bf8153f46db5873493b60237219a398","recipe",960,960],
  ["Sprites/bosses/walk/kingKrook_8.webp","107b83ddd64f439e3c5da7c8c6e08898c5793bc9f9689879830fbc809e5c7905","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_0.webp","74e7c8dbe840de30d861b65f1dcc824f76ab6472ca1a7b7a03f73cbc536d3467","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_1.webp","beb81783816bb275418c8af0381d68496f09be718e2a40bd10b4560573001e5c","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_2.webp","01272e5fe104ec8b59a1e00044b42e363e57d0e124ff148586b71483f3b5a1f1","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_3.webp","754116729d22aad140b7af8e4064ee8f08da3479e212336d26eaa092603c7617","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_4.webp","7f74d7d6808e5a6f674eec071e6977dbd791244e2f2c2a7f824210ea8e166c57","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_5.webp","93ed532434562e84d27f7caa3e0d135dfbe6ed2e090d193caf4e74a925c70db0","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_6.webp","9b466b35835d269bb4f2b41bbf098a467f0a4b867b0fb50bb94eaf9b47dd2e28","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_7.webp","09ae719ccedc43971eb5d420b3036821540f8c74554236235cb2ffe1d24a3e89","recipe",960,960],
  ["Sprites/bosses/attack/kingKrook_8.webp","164cf0dfda69b4a541530c43008def000cfe346c997e0fe9a423cb58e7629b3b","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_0.webp","28028392bd4f0b6c59a3fcba1f679552837d8fa15c4767628db0668d7e15a6b6","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_1.webp","f46b5deecd7c0a26ff3e93493725e2c7596f661a2846a6281ed83fa25f41bec1","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_2.webp","94fae08b0cc37e1844f861c1515e6b561531ac85441194a99b58a3abb66241d9","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_3.webp","59c98a08621dae6f2a41c7e1709b06e82796f0957e333694da55f3927420ed46","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_4.webp","f3b39518248684e0583669887f466b55944b465c9fe14d3bc020f4d0d8656d89","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_5.webp","27c7df63479320c8ddaa68652e9e96895e540cbb01adf52c565bad593f6c01bb","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_6.webp","7c3cb18db19f7805b2904520dda68fa7cd9d05616b9a0b99e93109e99cdd8a03","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_7.webp","977e8f92e5a2f07ad81f0042196cae9e86aa772d875ca9c5f89551f3da4bd10b","recipe",960,960],
  ["Sprites/bosses/attack/kingKrookstomp_8.webp","78f7505d3f18d993cb5d8a78273163342397d801ac2dc71dc5e8c3e4285499b6","recipe",960,960],
];
// [entity, state, solved {s, dx, dy}]
const CAL = [["towerSovereignvolley","attack",{"s":1.0503,"dx":0.008406,"dy":0.0194}],["towerSovereigndrain","attack",{"s":0.9508,"dx":0.004862,"dy":0.0611}],["towerSovereignswing","attack",{"s":0.9463,"dx":0.026009,"dy":0.0227}],["towerSovereigncolumn","attack",{"s":0.9135,"dx":0.003241,"dy":0.0202}],["towerArbiter","attack",{"s":1.565471,"dx":0.031551,"dy":0.006812}],["towerArbitercolumn","attack",{"s":1.939755,"dx":0.16564,"dy":0.004191}],["towerArbiterverdict","attack",{"s":1.822413,"dx":0.065597,"dy":0.004156}],["aetherion","attack",{"s":1.6,"dx":-0.051236,"dy":-0.01}],["legosaurus","idle",{"s":0.573491,"dx":-0.000122,"dy":0.022284}],["legosaurus","walk",{"s":0.572887,"dx":-0.000298,"dy":0.016846}],["legosaurus","attack",{"s":0.573491,"dx":-0.000102,"dy":0.019416}]];
// KEEP sets: how they are driven, origin canvas width at k (OW), the cut (cropL) and the new width (W); per frame and facing origin's
// union ink box corners (ink, canvas fractions) in world px rel. to his foot + his hit region [x, y, w, h] rel. to his foot (fa_reports/esrb/probe.mjs on origin 7c14a3eed)
const DRAW = [
  {"id":"sov_volley","T":"towerSovereign","dir":"attack","key":"towerSovereignvolley","how":"key:volley","mob":false,"OW":2760,"cropL":1094,"W":876,"ink":[0.411836,0.625571,0.698068,0.990868],"pins":[{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]},{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]},{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]},{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]},{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]},{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]},{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]},{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]},{"R":[-173.964,-352.606,189.798,15.718,[-317.006,-600.436,634.011,604.973]],"L":[173.964,-352.606,-189.798,15.718,[-317.006,-600.436,634.011,604.973]]}]},
  {"id":"sov_drain","T":"towerSovereign","dir":"attack","key":"towerSovereigndrain","how":"key:drain","mob":false,"OW":2760,"cropL":1017,"W":1022,"ink":[0.395531,0.538052,0.711353,1],"pins":[{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]},{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]},{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]},{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]},{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]},{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]},{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]},{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]},{"R":[-177.212,-357.29,186.131,64.361,[-286.974,-543.553,573.949,547.661]],"L":[177.212,-357.29,-186.131,64.361,[-286.974,-543.553,573.949,547.661]]}]},
  {"id":"sov_swing","T":"towerSovereign","dir":"attack","key":"towerSovereignswing","how":"key:swing","mob":false,"OW":2760,"cropL":1029,"W":1095,"ink":[0.395531,0.564688,0.746981,1],"pins":[{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]},{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]},{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]},{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]},{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]},{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]},{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]},{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]},{"R":[-175.972,-367.988,226.447,27.47,[-285.616,-540.981,571.232,545.069]],"L":[175.972,-367.988,-226.447,27.47,[-285.616,-540.981,571.232,545.069]]}]},
  {"id":"sov_column","T":"towerSovereign","dir":"attack","key":"towerSovereigncolumn","how":"key:column","mob":false,"OW":2760,"cropL":1017,"W":1022,"ink":[0.395531,0.571537,0.711353,1],"pins":[{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]},{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]},{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]},{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]},{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]},{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]},{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]},{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]},{"R":[-171.633,-350.872,177.456,24.873,[-275.716,-522.23,551.432,526.176]],"L":[171.633,-350.872,-177.456,24.873,[-275.716,-522.23,551.432,526.176]]}]},
  {"id":"arb_swing","T":"towerArbiter","dir":"attack","key":"towerArbiter","how":"key:","mob":false,"OW":2400,"cropL":397,"W":1365,"ink":[0.19,0.442308,0.709333,1],"pins":[{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]},{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]},{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]},{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]},{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]},{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]},{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]},{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]},{"R":[-224.042,-434.122,256.117,12.88,[-222.783,-473.619,380.001,484.519]],"L":[224.042,-434.122,-256.117,12.88,[-157.218,-473.619,380.001,484.519]]}]},
  {"id":"arb_column","T":"towerArbiter","dir":"attack","key":"towerArbitercolumn","how":"key:column","mob":false,"OW":2400,"cropL":777,"W":910,"ink":[0.344,0.54,0.682667,1],"pins":[{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]},{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]},{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]},{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]},{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]},{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]},{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]},{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]},{"R":[-109.184,-443.067,278.8,13.784,[-276.047,-586.855,470.855,600.362]],"L":[109.184,-443.067,-278.8,13.784,[-194.807,-586.855,470.855,600.362]]}]},
  {"id":"arb_verdict","T":"towerArbiter","dir":"attack","key":"towerArbiterverdict","how":"key:verdict","mob":false,"OW":2400,"cropL":777,"W":650,"ink":[0.352667,0.642308,0.565333,1],"pins":[{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]},{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]},{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]},{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]},{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]},{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]},{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]},{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]},{"R":[-81.042,-320.691,147.855,13.063,[-259.348,-551.354,442.371,564.044]],"L":[81.042,-320.691,-147.855,13.063,[-183.023,-551.354,442.371,564.044]]}]},
  {"id":"ae1_idle","T":"aetherion","dir":"idle","key":"aetherion","how":"idle","mob":false,"OW":2650,"cropL":0,"W":2650,"ink":[0.298913,0.527547,0.705314,0.89434],"pins":[{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]},{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]},{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]},{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]},{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]},{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]},{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]},{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]},{"R":[-274.405,-286.7,136.548,10.021,[-143.59,-442.744,293.491,450.024]],"L":[274.405,-286.7,-136.548,10.021,[-149.9,-442.744,293.491,450.024]]}]},
  {"id":"ae1_attack","T":"aetherion","dir":"attack","key":"aetherion","how":"base","mob":false,"OW":2650,"cropL":504,"W":1648,"ink":[0.211353,0.421887,0.791063,1],"pins":[{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]},{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]},{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]},{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]},{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]},{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]},{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]},{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]},{"R":[-322.967,-469.11,270.657,4.48,[-316.211,-558.285,551.158,573.768]],"L":[322.967,-469.11,-270.657,4.48,[-234.947,-558.285,551.158,573.768]]}]},
  {"id":"lego_idle","T":"legosaurus","dir":"idle","key":"legosaurus","how":"idle","mob":false,"OW":1645,"cropL":0,"W":1645,"ink":[0.12234,0.283883,0.814894,1],"pins":[{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]},{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]},{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]},{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]},{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]},{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]},{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]},{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]},{"R":[-284,-292.522,236.8,20.421,[-262.506,-299.957,475.456,303.933]],"L":[284,-292.522,-236.8,20.421,[-212.95,-299.957,475.456,303.933]]}]},
  {"id":"lego_walk","T":"legosaurus","dir":"walk","key":"legosaurus","how":"walk","mob":false,"OW":1733,"cropL":0,"W":1733,"ink":[0.188889,0.290435,0.792929,1],"pins":[{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]},{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]},{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]},{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]},{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]},{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]},{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]},{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]},{"R":[-233.834,-293.48,220.168,16.274,[-212.289,-291.696,440.032,293.66]],"L":[233.834,-293.48,-220.168,16.274,[-227.743,-291.696,440.032,293.66]]}]},
  {"id":"lego_attack","T":"legosaurus","dir":"attack","key":"legosaurus","how":"base","mob":false,"OW":1645,"cropL":0,"W":1645,"ink":[0.06383,0.124542,0.993617,1],"pins":[{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-328,-364.339,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[328,-364.339,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]}]},
  {"id":"lego_dash","T":"legosaurus","dir":"attack","key":"legosaurusdash","how":"ldash","mob":false,"OW":1645,"cropL":0,"W":1645,"ink":[0.007447,0,0.993617,1],"pins":[{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]},{"R":[-370.4,-418.764,371.2,18.236,[-289.818,-309.877,600.438,292.003]],"L":[370.4,-418.764,-371.2,18.236,[-310.62,-309.877,600.438,292.003]]}]},
  {"id":"pb_attack","T":"pathsBane","dir":"attack","key":"pathsBane","how":"mobatk","mob":true,"OW":1260,"cropL":0,"W":1260,"ink":[0.093651,0.142187,0.979365,0.989062],"pins":[{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]},{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]},{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]},{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]},{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]},{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]},{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]},{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]},{"R":[-176.262,-348.296,209.024,25.176,[-111.15,-261.25,222.3,247.5]],"L":[176.262,-348.296,-209.024,25.176,[-111.15,-261.25,222.3,247.5]]}]},
];
const ENTS = ["towerSovereign","towerArbiter","aetherion","legosaurus","pathsBane","tombKeeper","gravitos","miraFallen","kingKrook"];
const TOMB = [{"id":"tk_idle","T":"tombKeeper","dir":"idle","key":"tombKeeper","how":"idle","mob":true},{"id":"tk_walk","T":"tombKeeper","dir":"walk","key":"tombKeeper","how":"walk","mob":true},{"id":"tk_attack","T":"tombKeeper","dir":"attack","key":"tombKeeper","how":"mobatk","mob":true}];
const SUITE_FILES = ["boss_feet_calib_test.mjs","sovereign_lunge_dir_test.mjs","arbiter_lunge_facing_test.mjs","arbiter_swing_pos_test.mjs","arbiter_regen_test.mjs","arbiter_verdict_calib_test.mjs"];
// ==== END GENERATED ====
const BASE = BASE_SHA;
// ---- files + canvases + alpha
{ const wrong = [], canv = [], alpha = [];
  for (const [rel, nSha, mode, W, H] of FRAMES) {
    const f = path.join(ROOT, rel); if (!existsSync(f)) { wrong.push(rel + ' missing'); continue; }
    const b = readFileSync(f); if (sha(b) !== nSha) wrong.push(rel);
    const md = await sharp(b).metadata(); if (md.width !== W || md.height !== H) canv.push(rel + ' ' + md.width + 'x' + md.height);
    if (mode !== 'keep') { const o = show(rel, BASE); if (!o) { alpha.push(rel + ' not on base'); continue; }
      const al = async (x) => { const r = await sharp(x).ensureAlpha().raw().toBuffer(); const o2 = Buffer.alloc(r.length >> 2); for (let i = 0; i < o2.length; i++) o2[i] = r[i * 4 + 3]; return o2; };
      const a1 = await al(b), a0 = await al(o); if (a1.length !== a0.length || !a1.equals(a0)) alpha.push(rel); } }
  check(!wrong.length, `files: all ${FRAMES.length} replaced frames are the reviewed ones (sha256)`, wrong.slice(0, 6));
  check(!canv.length, 'files: the KEEP sets stand on their new canvases (1.6-2x, cut horizontally), every other frame on its own', canv.slice(0, 6));
  check(!alpha.length, 'files: every same-size / recipe frame keeps the alpha of the frame it replaced, byte for byte', alpha.slice(0, 6)); }
// ---- tables
{ const s = readFileSync(path.join(ROOT, 'data', 'sprite_bbox.js'), 'utf8'), i = s.indexOf('window.LX_SPRITE_BBOX = '), T = JSON.parse(s.slice(i + 24, s.indexOf('};', i) + 1)), stale = [];
  for (const [rel, , mode, W, H] of FRAMES) { if (mode !== 'keep') continue; const r = T[rel.replace(/^Sprites\//, '')]; const p = r ? r.split(',') : []; if (+p[2] !== W || +p[3] !== H) stale.push(rel + ' ' + r); }
  check(!stale.length, 'tables: sprite_bbox carries every KEEP frame at its new size', stale.slice(0, 6));
  const parse = (txt) => { const a = txt.indexOf('window.LX_ANIM_CALIB = '), b = txt.indexOf('window.LX_ATK_HITBOX = ');
    return { cal: JSON.parse(txt.slice(a + 23, b).trim().replace(/;$/, '')), hb: JSON.parse(txt.slice(b + 22).trim().replace(/;\s*$/, '')) }; };
  const now = parse(readFileSync(path.join(ROOT, 'data', 'anim_calib.js'), 'utf8')), was = parse(String(show('data/anim_calib.js', BASE))), diff = [];
  const want = new Map(CAL.map(([e, st, v]) => [e + '.' + st, v]));
  const mine = (e) => ENTS.some((p) => e === p || (e.indexOf(p) === 0 && /^[a-z]/.test(e.slice(p.length))));   // the touched bosses' rows (others are other packages')
  for (const e of new Set([...Object.keys(now.cal), ...Object.keys(was.cal)].filter(mine))) for (const st of new Set([...Object.keys(now.cal[e] || {}), ...Object.keys(was.cal[e] || {})])) {
    const a = (was.cal[e] || {})[st], b = (now.cal[e] || {})[st], w = want.get(e + '.' + st);
    if (w) { if (!b || b.s !== w.s || b.dx !== w.dx || b.dy !== w.dy || JSON.stringify(Object.assign({}, a, { s: 0, dx: 0, dy: 0 })) !== JSON.stringify(Object.assign({}, b, { s: 0, dx: 0, dy: 0 }))) diff.push(e + '.' + st + ' ' + JSON.stringify(b)); }
    else if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(e + '.' + st + ' moved'); }
  check(!diff.length, `tables: every calibration row of the touched bosses is the base's except the ${CAL.length} solved KEEP rows (s / dx / dy only)`, diff.slice(0, 8));
  const hbm = [...new Set([...Object.keys(now.hb), ...Object.keys(was.hb)].filter(mine))].filter((e) => JSON.stringify(now.hb[e]) !== JSON.stringify(was.hb[e]));
  check(!hbm.length, 'tables: no hit box entry of the touched bosses moved', hbm); }
// ---- sharper on disk
{ const lap = async (buf) => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height; const L = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; let s = 0, n = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4; if (data[i + 3] < 250) continue; s += Math.abs(4 * L(i) - L(i - 4) - L(i + 4) - L(i - W * 4) - L(i + W * 4)); n++; } return s / Math.max(1, n); };
  const soft = [], by = new Map(); for (const r of FRAMES) { const k = r[0].replace(/_\d+\.webp$/, ''); if (!by.has(k)) by.set(k, r); }   // frame 0 (or the still) of each set
  for (const [set, [rel]] of by) { const o = show(rel, BASE), n = readFileSync(path.join(ROOT, rel)); if (!o) continue; let a = await lap(o), b = await lap(n);
    const md = await sharp(n).metadata(), mo = await sharp(o).metadata(); if (md.height !== mo.height) a = await lap(await sharp(o).resize(Math.round(mo.width * md.height / mo.height), md.height, { kernel: 'lanczos3' }).png().toBuffer());   // a KEEP set: against the old art enlarged to the new canvas (what the screen showed)
    if (!(b >= a * 1.05)) soft.push(set.replace('Sprites/', '') + ' ' + a.toFixed(1) + '->' + b.toFixed(1)); }
  check(!soft.length, `sharp: all ${by.size} touched sets are sharper on disk than the art they replaced (mean |laplacian| x1.05+; a KEEP set against the old art enlarged to its canvas)`, soft.slice(0, 8)); }
// ---- in game, DPR 2: every KEEP frame where origin drew it, same hit region, art kept at screen resolution; the Tomb Keeper unstretched
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue(); const b = show(rel); if (b) r.fulfill({ status: 200, contentType: 'font/woff2', body: b }); else r.continue(); });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('lx_render_scale', '2'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxDrawSoft === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) { el.classList.add('fade'); el.style.display = 'none'; } }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player._god = true; player.invulnerable = 999999; player.maxHp = player.hp = 9e9;
    loadMap('tower_b5', 200); await W8(1500); game.paused = false; game.monsters = [];
    // spies: his foot (as the draw rounds it) at the top of his draw, the art blit inside it (rect + transform + the canvas blitted)
    window.__m = null; let inB = false, foot = null;
    const wrap = (name, mob) => { const o = window[name]; window[name] = function (a0, a1, a2, a3) { const mm = mob ? a0 : a1, sx = mob ? a1 : a2, sy = mob ? a2 : a3; if (mm !== window.__m) return o.apply(this, arguments);
      try { const t = ctx.getTransform(), fx = Math.round(sx + mm.w / 2), fy = Math.round(sy + mm.h); foot = { x: t.a * fx + t.c * fy + t.e, y: t.b * fx + t.d * fy + t.f, z: Math.hypot(t.a, t.b), wx: mm.x + mm.w / 2, wy: mm.y + mm.h }; } catch (e) {}
      const args = Array.from(arguments); if (!mob && window.__fset && window.__fi != null && args[0] && window.__fset.includes(args[0]) && window.__fset[window.__fi]) args[0] = window.__fset[window.__fi];
      inB = true; window.__cur = null; try { return o.apply(this, args); } finally { inB = false; const c = window.__cur; if (c) { c.foot = foot; try { const b = _atkMonBox(mm); c.hb = b && b !== mm ? [b.x - foot.wx, b.y - foot.wy, b.w, b.h] : null; } catch (e) {} window.__last = c; } } }; };
    wrap('_drawBossSprite', false); wrap('_drawMonsterSprite', true);
    { const oS = window._monsterStateFrame; window._monsterStateFrame = function (mm) { const r = oS.apply(this, arguments); if (mm === window.__m && window.__fset && window.__fi != null && r && window.__fset.includes(r) && window.__fset[window.__fi]) return window.__fset[window.__fi]; return r; }; }
    const oD = window._lxDrawSoft; window._lxDrawSoft = function (c, img, dx, dy, dw, dh) { try { if (inB && !window.__cur && c === ctx) { const s = String((img && (img.src || (img._lxSrc && img._lxSrc.src))) || ''); const q = s.match(/(bosses|monsters)\/(idle|walk|attack)\/([A-Za-z0-9]+)_(\d+)\.webp/);
      if (q) { const t = c.getTransform(), W = dw == null ? img.width : dw, H = dh == null ? img.height : dh, P = (x, y) => [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f];
        window.__cur = { art: q[2] + '/' + q[3] + '_' + q[4], q: [P(dx, dy), P(dx + W, dy), P(dx, dy + H)], face: window.__m.facing }; } } } catch (e) {} return oD.apply(this, arguments); };
    { const P = CanvasRenderingContext2D.prototype, oDI = P.drawImage; P.drawImage = function (im) { try { const c = window.__cur; if (inB && c && !c.blit && this === ctx && arguments.length >= 5) { const t = this.getTransform(), n = arguments.length, dh = n === 5 ? arguments[4] : arguments[8]; c.blit = [im.height, Math.abs(dh) * Math.hypot(t.c, t.d)]; } } catch (e) {} return oDI.apply(this, arguments); }; }
  });
  const drive = async (it, face) => page.evaluate(async ({ it, face }) => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
    game.monsters = []; const Gp = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, b) => b.w - a.w)[0], bx = Gp ? Gp.x + Gp.w / 2 : 1000, gy = Gp ? Gp.y : game.mapData.worldHeight - 60;
    const m = spawnMonster(bx, gy - 260, it.T, !it.mob, false); m.currentHp = m.maxHp = 9e9; m.invulnerable = true; m._wardNextAt = 1e12; m._bigMeleeCd = 1e9; m._columnCd = 1e9; m._hgCd = 1e9; m._bdCd = 1e12; window.__m = m;
    const S0 = () => it.mob ? ((_monsterFramesFor(it.T) || {})[it.dir]) : (it.dir === 'idle' ? BOSS_IDLE_FRAMES : it.dir === 'walk' ? BOSS_WALK_FRAMES : BOSS_ATTACK_FRAMES)[it.key];
    for (let i = 0; i < 900; i++) { try { if (!it.mob) _lxBossArtWant(it.T, true); } catch (e) {} const a = S0(); if (a && a.length && (it.mob ? a.every((x) => x && ((x.complete && x.naturalWidth > 0) || x.tagName === 'CANVAS')) : _lxFtReadyN(a) >= a.length)) break; await W8(100); }
    const oAI = window.bossAI; window.bossAI = function (mm) { if (mm === m) return; return oAI.apply(this, arguments); };
    for (let k = 0; k < 15; k++) { m.patternState = 'idle'; m.vx = 0; m.x = bx - m.w / 2; m.facing = face; await frame(); }
    const set = S0(), n = set ? set.length : 0, got = {}; window.__fset = set; window.__fi = 0; let i = 0, tries = 0; const t0 = performance.now();
    while (n && performance.now() - t0 < 90000) {
      i++; m._wardNextAt = 1e12; m._wardUntil = 0; m.facing = face; player.y = gy - player.h; player.vx = 0; player.invulnerable = 999999; player.hp = player.maxHp; player.x = m.x + m.w / 2 + face * 420 - player.w / 2;
      const now = performance.now(), how = it.how;
      if (how === 'walk') { m.vx = 1.7 * face; if (Math.abs(m.x + m.w / 2 - bx) > 300) m.x = bx - m.w / 2 - face * 250; m.patternState = 'idle'; m._frameIsAttack = false; m._awD = (m._awD || 0) + 5; m._awX = m.x; m._awT = game.time | 0; }
      else { m.x = bx - m.w / 2; m.vx = 0; }
      if (how === 'idle') { m.patternState = 'idle'; m.patternTimer = 0; m._frameIsAttack = false; m.atkAnimUntil = null; }
      else if (how === 'base') { m._bossAtkKey = null; m._bossAtkUntil = 0; m._frameIsAttack = true; m.patternState = 'attack'; m.atkAnimUntil = now + 800; }
      else if (how.startsWith('key:')) { m._bossAtkKey = it.T + how.slice(4); if ((game.time | 0) > (m._bossAtkUntil | 0) - 2) m._bossAtkUntil = (game.time | 0) + 240; m._frameIsAttack = true; m.patternState = 'attack'; }
      else if (how === 'ldash') { m._braceDashing = true; m._bdPhase = 'dash'; m._bdVx = 0; m._bdDir = face; m._bdTravel = 0; m._bdGored = true; m.vy = 0; m.patternState = 'attack'; m._frameIsAttack = true; m.atkAnimUntil = now + 800; }
      else if (how === 'mobatk') { m.atkAnimUntil = now + 900; m._swingUntil = now + 900; m._frameIsAttack = true; }
      window.__last = null; await frame();
      const c = window.__last; if (!c || !new RegExp('^' + it.dir + '/' + it.key + '_\\d+$').test(c.art) || c.face !== face || !c.foot || i <= 8) continue;
      const f = +c.art.split('_').pop(); if (f === window.__fi && !got[f]) { const z = c.foot.z; got[f] = { tl: [(c.q[0][0] - c.foot.x) / z, (c.q[0][1] - c.foot.y) / z], tr: [(c.q[1][0] - c.foot.x) / z, (c.q[1][1] - c.foot.y) / z], bl: [(c.q[2][0] - c.foot.x) / z, (c.q[2][1] - c.foot.y) / z], hb: c.hb, d: c.blit ? c.blit[0] / c.blit[1] : null }; }
      if (++tries > 30 || got[window.__fi]) { tries = 0; let nx = window.__fi + 1; while (nx < n && got[nx]) nx++; if (nx >= n) break; window.__fi = nx; }
    }
    window.__fset = null; window.__fi = null; window.bossAI = oAI; m._bossAtkKey = null; m._braceDashing = false; m._frameIsAttack = false; m.atkAnimUntil = null;
    return { n, got };
  }, { it, face });
  const far = [], hbs = [], low = [], miss = [];
  for (const it of DRAW) for (const face of [1, -1]) {
    const r = await drive(it, face), side = face > 0 ? 'R' : 'L';
    for (let f = 0; f < it.pins.length; f++) {
      const g = r.got[f], pin = it.pins[f][side]; if (!g) { miss.push(it.id + side + f); continue; }
      // the set's ink box corners (origin canvas fractions) -> this canvas: u' = (u * OWfull - cropL) / W
      const at = (u, v) => { const up = (u * it.OW - it.cropL) / it.W; return [g.tl[0] + (g.tr[0] - g.tl[0]) * up + (g.bl[0] - g.tl[0]) * v, g.tl[1] + (g.tr[1] - g.tl[1]) * up + (g.bl[1] - g.tl[1]) * v]; };
      const a = at(it.ink[0], it.ink[1]), b = at(it.ink[2], it.ink[3]), d = Math.max(Math.abs(a[0] - pin[0]), Math.abs(a[1] - pin[1]), Math.abs(b[0] - pin[2]), Math.abs(b[1] - pin[3]));
      if (!(d <= 0.5)) far.push(it.id + side + f + ' ' + d.toFixed(2));
      const h = g.hb && pin[4] ? Math.max(...g.hb.map((v, k) => Math.abs(v - pin[4][k]))) : 99; if (!(h <= 1)) hbs.push(it.id + side + f + ' ' + h.toFixed(2));
      if (!(g.d >= 0.98)) low.push(it.id + side + f + ' ' + (g.d == null ? 'null' : g.d.toFixed(2)));
    }
  }
  check(!miss.length && !far.length, `in game: every frame of the ${DRAW.length} KEEP sets draws its art where origin did at both facings (the set's ink box corners within 0.5 px)`, { miss: miss.slice(0, 6), far: far.slice(0, 8) });
  check(!miss.length && !hbs.length, 'in game: the same player-attack hit region on every frame (1 px)', hbs.slice(0, 8));
  check(!miss.length && !low.length, 'in game: every KEEP frame reaches the screen at >= 0.98 art px per screen px at DPR 2 (no upscale on screen)', low.slice(0, 8));
  const tk = [];
  for (const it of TOMB) { const r = await drive(it, 1); const ds = Object.values(r.got).map((g) => g.d); if (!ds.length || ds.some((d) => !(d >= 0.98))) tk.push(it.id + ' ' + ds.map((d) => d && d.toFixed(2)).join(',')); }
  check(!tk.length, "in game: the Tomb Keeper's idle / walk / swing reach the screen at >= 0.98 art px per screen px (were 0.66 / 0.66 / 0.49)", tk);
} finally { await browser.close(); srv.kill(); }
check(!errs.length, 'no page errors', errs.slice(0, 4));
// ---- SUITES, 2 at a time on their own port blocks (a suite may use PORT+1..+3 for its own sub-suites) (a load-flaky row must fail in every run to count: up to 3 runs, as boss_feet_calib_test)
const passed = (out) => { const lines = out.trim().split(/\r?\n/), last = lines.slice(-3).join(' | ');
  return { ok: /(^|\s)all \d+ passed/.test(last) || /(^|\s)(\d+)\/\2 (checks )?passed/.test(last), fails: lines.filter((l) => /^FAIL/.test(l.trim())), last: lines[lines.length - 1] || '' }; };
const runSuite = (file, port) => new Promise((res) => { const p = spawn(process.execPath, [file], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), MOJI_REPO: REPO, SERVE_ROOT: ROOT, MOJI_SERVE_ROOT: ROOT }) });
  let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; }); const kill = setTimeout(() => { try { p.kill(); } catch (e) {} }, 1800000);
  p.on('exit', () => { clearTimeout(kill); res(passed(out)); }); });
const rowKey = (l) => l.trim().replace(/^FAIL\s+/, '').split(/\s{2,}/)[0];
// rows that fail on origin's own build before this package (measured on origin, every run): arbiter_regen_test's frame sha list went stale with
// v0.30.1815 (his frames re-encoded sharp) and its arbiter_dash sub-suite has load-sensitive timing rows; arbiter_verdict_calib_test reports
// arbiter_regen_test as one row. They do not count; every other row that fails in all runs does.
const KNOWN = { 'arbiter_regen_test.mjs': [/^the 45 idle \/ walk \/ swing \/ pillar \/ verdict frames are the regenerated ones/, /^arbiter_dash_test\.mjs still passes/], 'arbiter_verdict_calib_test.mjs': [/^the Arbiter suites still pass/] };
// grav_star_fit_test serves Gravitos's art + data tables from origin/main by design; run it on THIS tree's art + tables (a local copy)
let STAR = null; { const src = existsSync(path.join(HERE, 'grav_star_fit_test.mjs')) ? readFileSync(path.join(HERE, 'grav_star_fit_test.mjs'), 'utf8') : '';
  const A = "cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }))";
  if (src.split(A).length === 2) { STAR = path.join(HERE, '_esrgan_bosses_star_fit_' + process.pid + '.mjs'); writeFileSync(STAR, src.split(A).join("cache.set(rel, require('node:fs').readFileSync(path.join(ROOT, rel)))").replace("import { existsSync } from 'node:fs';", "import { existsSync } from 'node:fs'; import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);")); } }
const SUITES = [...SUITE_FILES.map((f) => [f, path.join(HERE, f)]), ["grav_star_fit_test.mjs (this tree's art + tables)", STAR]];
const one = async ([name, file], port) => {
  if (!file || !existsSync(file)) return [name, false, 'suite not found', []];
  let res = null, every = null, runs = 0;
  for (let a = 0; a < 3; a++) { runs++; res = await runSuite(file, port); if (res.ok) break; if (!res.fails.length) continue; const keys = new Set(res.fails.map(rowKey)); every = every ? new Set([...every].filter((k) => keys.has(k))) : keys; if (!every.size) break; }
  const left = res.ok ? [] : every === null ? ['(no run reported: ' + res.last.slice(0, 80) + ')'] : [...every].filter((k) => !(KNOWN[name] || []).some((re) => re.test(k)));
  return [name, res.ok || !left.length, res.last + (runs > 1 ? ', run ' + runs : ''), left];
};
const results = []; let next = 0;
await Promise.all([0, 1].map(async (w) => { while (next < SUITES.length) { const s = SUITES[next++]; results.push(await one(s, PORT + 2 + 4 * w)); } }));
for (const [name, ok, last, left] of results.sort((a, b) => a[0].localeCompare(b[0]))) check(ok, `${name} still passes (${last})`, left.map((k) => k.slice(0, 240)));
if (STAR) try { unlinkSync(STAR); } catch (e) {}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
