#!/usr/bin/env node
// BAKE DEFAULT ATTACK FRAME TIMING for every boss attack set that has none.
// ============================================================================
// Per user: "for bosses during their attack phase make sure the animation
// sprites have slightly longer intervals and hold critical sprite frames
// longer to make attacks not feel rushed".
//
// The game already has a per-frame timing channel: an `ft` array (ms per
// frame) on a calib state, authored in monster_animator.html, walked by
// _lxFtWalk in the game and mirrored by the animator's playback. Where it is
// absent the game falls back to a flat 48ms per frame - a nine-frame swing in
// 432ms, every frame equal, the strike gone as fast as the windup. This bakes
// a default `ft` into data/anim_calib.js for each boss attack set that has no
// authored timing, so BOTH the game and the animator play it the same way.
//
// The rule, fitted to the eight timings the artist already authored (which
// all ramp to a peak at frames 4-5 of nine):
//   base 60ms  (the "slightly longer" interval; was 48)
//   strike frame       x2.2   the critical frame, held
//   frames either side x1.5   commit and follow-through
//   first frame        x1.2   anticipation
//   last frame         x1.6   settle
// The strike is the middle frame, nudged to the frame AFTER the apex when the
// manifest's per-frame boxes show a clear one (the apex is the frame with the
// greatest vertical extent - a raised weapon - and the strike follows it).
// A nine-frame set totals 720ms.
//
// Baked entries carry `ftAuto: true`. The animator's export drops unknown
// fields, so a timing the artist touches loses the flag and is treated as
// authored from then on - never overwritten here.
//   node scripts/gen_attack_timing.mjs            bake (atomic write)
//   node scripts/gen_attack_timing.mjs --check    exit 1 if the file is stale
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// MOJI_CALIB_FILE / MOJI_MANIFEST_FILE read elsewhere (a scratch copy of the
// tip, so a stale working copy never leaks in); MOJI_CALIB_OUT writes elsewhere.
const CALIB = process.env.MOJI_CALIB_FILE || path.join(ROOT, 'data', 'anim_calib.js');
const OUT = process.env.MOJI_CALIB_OUT || CALIB;
const MANIFEST = process.env.MOJI_MANIFEST_FILE || path.join(ROOT, 'data', 'anim_calib_manifest.js');
const CHECK = process.argv.includes('--check');
// v0.30.1337 - --group=monster / --group=boss limits the bake (and the check) to one group
const GROUP = (process.argv.find((a) => a.startsWith('--group=')) || '').slice(8) || null;

export const LX_ATK_BASE_MS = 60;
export const LX_ATK_HOLD = { strike: 2.2, side: 1.5, first: 1.2, last: 1.6 };
// v0.30.1347 boss-pick - THE STRIKE, PICKED FROM THE ART, for the boss sets whose apex guess drifted off it (per user: "fix
// the three drifted boss timings too"). Their baked timings no longer matched the rule, and the rule itself was
// wrong for two of them once the art was looked at:
//   kingKrook             f4 - the claw fully out (stored f6 was him pulling it back; the rule agrees on f4)
//   towerSovereignswing   f5 - the fire arc sweeping round (stored f4 was the staff still overhead, the rule's f6
//                              the follow-through)
//   towerSovereignvolley  f6 - the staff thrust and the blast (stored f6 was right; the rule's f4 is the flame
//                              still building)
// Boss damage runs on its pattern clocks, not on these frames: this only moves which pose the loop holds longest.
// The rest of the generated boss sets are picked just below; hand-set timings are never touched.
export const LX_BOSS_STRIKE_BY_TYPE = { kingKrook: 4, towerSovereignswing: 5, towerSovereignvolley: 6 };
// v0.30.1355 boss-pick - EVERY OTHER GENERATED BOSS SET, picked from its art the same way (per user: "review the other 45 boss
// attack sets too"; 16 of the 45 are hand-set and are left as authored). 23 already held their blow; six did not:
//   gravitos3        f4 -> f5  the orb still charging -> the fire beam blasting out
//   king             f6 -> f3  the crown spike flourish after it -> the ice spray at full length
//   sundered_smith   f4 -> f5  the hammer overhead -> the slam
//   zodiac_aries     f2 -> f4  rearing up -> the fire vortex
//   zodiac_capricorn f6 -> f4  a plain stance -> the lunge in its ice burst
//   zodiac_virgo     f4 -> f6  an ordinary wingbeat -> the radiance (it peaks on f7-f8, but a boss strike keeps two
//                              frames of settle after it, the rule every 720 ms boss swing is built on)
// kingKrookstomp's picker runs on its pattern clock (_krookStompFrame), so its pick only shows in the animator.
Object.assign(LX_BOSS_STRIKE_BY_TYPE, {
  aetherion: 4, aetherion2: 4, gravitos2: 6, gravitos2punch: 4, gravitos2soul: 4, gravitos3: 5,
  gravitos3laser: 4, king: 3, kingKrookstomp: 6, mooma: 5, octobaby: 6, pqConductor: 6,
  sundered_smith: 5, towerSovereign: 6, towerSovereigncollapse: 4, towerSovereigncolumn: 2, towerSovereigndrain: 5, young_confused_barnaby: 4,
  zodiac_aquarius: 6, zodiac_aries: 4, zodiac_capricorn: 4, zodiac_gemini: 4, zodiac_leo: 4, zodiac_libra: 6,
  zodiac_pisces: 4, zodiac_sagittarius: 6, zodiac_scorpio: 6, zodiac_taurus: 4, zodiac_virgo: 6,
});
// v0.30.1382 virga-flap - Virga's attack set is redrawn (per user: a full wing-flap strike, "a bird that is levitating mid air").
// Its blow is now f4: both wings driven fully down, the ring of light at its widest (f2 is the wings raised and glowing,
// f3 the ring's first flash, f5 the wings sweeping back out). Still two frames of settle after it and more.
Object.assign(LX_BOSS_STRIKE_BY_TYPE, { zodiac_virgo: 4 });
// v0.30.1463 barnaby-punch - Barnaby's punch is redrawn from his idle (per user: "fully lunge like in gravitos"): f0 is the
// idle, f1-5 cock the burning fist back, f6 drives it through, f7-8 are the full lunge. Its blow is f6, the drive with the
// fire streaking off the knuckles - still two frames of settle after it. His boxer haymaker plays the set on its own clock
// (_barnabyPunchFrame); this timing is the contact / telegraphed-swing / animator loop.
Object.assign(LX_BOSS_STRIKE_BY_TYPE, { young_confused_barnaby: 6 });

// cb entries are [top, bottom, bodyTop, bodyBottom] in source pixels (see
// scripts/gen_anim_manifest.mjs). Returns the default dwell array for n frames.
export function defaultAttackFt(n, cb, frameH, strikeAt) {
  if (!(n > 1)) return null;
  let strike = Math.round((n - 1) / 2);
  if (Array.isArray(cb) && cb.length === n && frameH > 0) {
    let apex = -1, best = Infinity, lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const b = cb[i]; if (!Array.isArray(b) || b.length < 2) { apex = -1; break; }
      const top = +b[0];
      if (top < best) { best = top; apex = i; }
      lo = Math.min(lo, top); hi = Math.max(hi, top);
    }
    // only trust the apex when the extent actually moves (> 3% of the frame)
    // and it sits inside the swing, not on the resting first/last frames
    if (apex >= 1 && apex <= n - 3 && (hi - lo) / frameH > 0.03) strike = Math.min(n - 3, Math.max(2, apex + 1));
  }
  if (Number.isInteger(strikeAt) && strikeAt >= 0 && strikeAt < n) strike = strikeAt;   // v0.30.1347 boss-pick - the art's own blow
  const ft = new Array(n);
  for (let i = 0; i < n; i++) {
    let k = 1;
    if (i === strike) k = LX_ATK_HOLD.strike;
    else if (Math.abs(i - strike) === 1) k = LX_ATK_HOLD.side;
    if (i === 0) k = Math.max(k, LX_ATK_HOLD.first);
    if (i === n - 1) k = Math.max(k, LX_ATK_HOLD.last);
    ft[i] = Math.round(LX_ATK_BASE_MS * k);
  }
  return ft;
}

// v0.30.382 - THE MONSTER RULE, INDIVIDUALISED (per user: "improving the smoothness
// of the monster animation sprite time interval, it should be well timed with the
// attack, should not be rushed, and should not be spammy" / "the frames should be
// individualised per monster so do look into the attack frames especially").
// Every one of the 110 monster attack sets has per-frame content boxes in the
// manifest, and the apex (the frame whose content top is highest - a raised claw,
// a reared body) sits anywhere from frame 0 to 8 across them. So each set gets its
// own timing from its own frames:
//   base 72ms (the shared mob cadence; fatDragon keeps its authored 96)
//   strike = the frame after the apex when the apex is clear (>= 3% of the frame
//            height); a late apex (the last two frames) makes the strike the frame
//            before the settle; a flat set (a pulse, a spit) strikes mid-sequence
//   strike hold = 1.8x + 2.5x the apex prominence, capped at 2.8x - a snail that
//            rears 39% of its frame holds its strike 2.8x, a squid that barely
//            moves 1.8x
//   sides x1.5, first frame x1.2, last x1.6, as the bosses
// The game walks the result ONCE per attack (v0.30.382, _monsterStateFrame).
export const LX_MOB_ATK_BASE_MS = 72;
export const LX_MOB_ATK_BASE_BY_TYPE = { fatDragon: 96 };
// v0.30.1337 strike-pick - THE STRIKE IS PICKED FROM THE ART, NOT GUESSED (per user: "re-pick the strike frames from the art
// too"). The apex rule below (strike = the frame after the highest content top) was right for half the sets and wrong
// for the other half: a raised weapon is the WIND-UP (Gary rearing back, the Ossuary Tyrant's bone overhead, the Tomb
// Keeper's spear), and a set whose effects linger put the strike on its recovery pose (Stormkitty, Grave Reaver,
// Seraph, Rotter). Every monster attack set was reviewed frame by frame on 2026-09-28 and its blow recorded here - the
// contact, the impact, the release, or a burst at its biggest. 55 of the 108 generated sets moved. A set missing
// from this table (new art) falls back to the apex rule and the bake names it: pick its frame and add it here.
// Hand-set timings (conductorMech, forgewight) are never touched, so they are not listed. Only the strike's POSITION
// comes from here; how long it is held still follows the art's prominence below.
// v0.30.1401 pathsBane 5 -> 4: his attack was redrawn (per user - one scythe, swung); his blow is the full crescent, frame 4.
export const LX_MOB_STRIKE_BY_TYPE = {
  anglerfish: 4, archon: 4, axolotl: 5, bellowsbat: 5, blightElder: 5, blockEle: 3, blockGary: 4,
  blockHupo: 3, blockPopo: 4, blockRhirhi: 3, blockTigreal: 4, boneGolem: 3, boneWraith: 4, bonebosn: 5,
  brinekraken: 5, cherub: 5, cinderling: 6, cloudbun: 5, clownfish: 4, cookie: 3, coralImp: 5,
  cosmicMochi: 5, deranged_kuro: 4, drownedCur: 4, echoKnight: 4, elderbark: 3, emberling: 5, expressTicketMech: 6,
  fatDragon: 6, fatLizard: 4, frog: 5, frostkin: 3, future_lyra: 5, glasswindHare: 5, goblinMauler: 5,
  goblinScout: 4, graveReaver: 4, grumpsquid: 4, gummy: 4, honeyBuzz: 6, horny: 4, jellyfish: 4,
  lanternWisp: 4, lichkin: 5, mayo: 5, meloncholy: 3, mirageStalker: 4, mournshade: 3, mummy: 7,
  mushpup: 6, mushroom: 6, nimbusFox: 6, nougatBear: 6, octoLegFreeze: 6, octoLegPoison: 7, octoLegSkillLock: 5,
  octoLegStun: 4, orange: 3, ossuaryTyrant: 3, pathsBane: 4, pearlSprite: 4, petalfly: 3, pinechad: 3,
  potato_uncle: 6, pufferfish: 4, razorgale: 5, sandhusk: 4, scorpion: 5, seahorse: 5, seasponge: 4,
  seastar: 4, sepulchreHound: 4, seraph: 5, shardlich: 5, skeleton: 3, skywisp: 6, slime: 4,
  smithgolem: 4, snail: 5, sparkSprite: 3, sparkling: 4, spectreCannoneer: 5, sproutle: 6, stoneling: 5,
  stormKitty: 4, stump: 4, thornmaw: 4, thunderMole: 4, ticketMech: 4, tidefish: 5, tideling: 6,
  tidepoolTurtle: 3, tombKeeper: 5, tombWraith: 5, towerHexer: 3, towerOssifer: 3, towerSeer: 4, towerShardling: 4,
  towerStalker: 4, towerStormcaller: 6, towerWarden: 4, towerWisp: 4, vigil_vermillion: 6, voltipup: 3, willeo: 5,
  wraith: 5, young_bloodthirsty_vermillion: 4, zombie: 4,
};
// v0.30.1551 strike-pick - Libra's Scale Lanterns and Scale Stormcallers (their art landed with v0.30.1503) came in without a pick,
// so their attacks fell back to the flat default pace and gen_attack_timing --check failed. From the art: the blue lantern's
// flame flares inside its ring of light on f3, the gold lantern's starburst is f3, and the Stormcaller's lightning leaves
// the fist on f4 (f3 is the fist still charging).
Object.assign(LX_MOB_STRIKE_BY_TYPE, { scaleLanternA: 3, scaleLanternB: 3, scaleStormcaller: 4 });
// bughunt bootdata-3 - the two sets that arrived after Libra's (Lady Honk's bow, v0.30.1582, and Elder Arlen's Coronation of Ruin, v0.30.1591)
// came in without a pick too, so --check failed again. From the art: Lady Honk's arrow is drawn on f3 and LEAVES the bow on f4 (beak open,
// glowing trail; f5 is the spray after it); the Ruin set's burst builds through f3-f5 and is at its biggest on f6 (the same frame as his
// ordinary cast, vigil_vermillion 6).
Object.assign(LX_MOB_STRIKE_BY_TYPE, { lady_honk: 4, vigil_vermillionruin: 6 });
export const LX_MOB_HOLD = { strikeMin: 1.8, strikeSlope: 2.5, strikeMax: 2.8, side: 1.5, first: 1.2, last: 1.6, pulse: 1.8, clearApex: 0.03 };
export function defaultMobAttackFt(n, cb, frameH, base, strikeAt) {
  if (!(n > 1)) return null;
  base = base > 0 ? base : LX_MOB_ATK_BASE_MS;
  let strike = Math.round((n - 1) / 2), prom = 0;
  if (Array.isArray(cb) && cb.length === n && frameH > 0) {
    let apex = -1, best = Infinity, lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const b = cb[i]; if (!Array.isArray(b) || b.length < 2) { apex = -1; break; }
      const top = +b[0];
      if (top < best) { best = top; apex = i; }
      lo = Math.min(lo, top); hi = Math.max(hi, top);
    }
    if (apex >= 0) prom = (hi - lo) / frameH;
    if (prom >= LX_MOB_HOLD.clearApex) {
      if (apex >= 1 && apex <= n - 3) strike = Math.min(n - 3, Math.max(2, apex + 1));
      else if (apex >= n - 2) strike = n - 2;
    }
  }
  if (Number.isInteger(strikeAt) && strikeAt >= 0 && strikeAt < n) strike = strikeAt;   // v0.30.1337 strike-pick - the art's own blow
  const strikeHold = prom < LX_MOB_HOLD.clearApex ? LX_MOB_HOLD.pulse : Math.min(LX_MOB_HOLD.strikeMax, LX_MOB_HOLD.strikeMin + prom * LX_MOB_HOLD.strikeSlope);
  const ft = new Array(n);
  for (let i = 0; i < n; i++) {
    let k = 1;
    if (i === strike) k = strikeHold;
    else if (Math.abs(i - strike) === 1) k = LX_MOB_HOLD.side;
    if (i === 0) k = Math.max(k, LX_MOB_HOLD.first);
    if (i === n - 1) k = Math.max(k, LX_MOB_HOLD.last);
    ft[i] = Math.round(base * k);
  }
  return ft;
}
function main() {
  const src = readFileSync(CALIB, 'utf8');
  const m = src.match(/^([\s\S]*?)window\.LX_ANIM_CALIB = ([\s\S]*?);\r?\nwindow\.LX_ATK_HITBOX = ([\s\S]*?);\r?\n$/);   // a CRLF checkout too
  if (!m) { console.error('anim_calib.js: unexpected layout'); process.exit(2); }
  const header = m[1], calib = JSON.parse(m[2]), hitbox = JSON.parse(m[3]);
  const man = readFileSync(MANIFEST, 'utf8');
  const M = JSON.parse(man.slice(man.indexOf('{'), man.lastIndexOf('}') + 1));
  let baked = 0, kept = 0, stale = 0;
  const unpicked = [], cur0 = (k) => calib[k] && calib[k].attack && Array.isArray(calib[k].attack.ft) && !calib[k].attack.ftAuto;   // hand-set
  const report = [];
  for (const key of Object.keys(M).sort()) {
    const e = M[key];
    if (!e || (e.group !== 'boss' && e.group !== 'monster') || !e.states || !e.states.attack) continue;   // v0.30.382 - monsters too
    if (GROUP && e.group !== GROUP) continue;
    const st = e.states.attack;
    const n = st.count | 0;
    if (e.group === 'monster' && n > 1 && !(cur0(key)) && !(key in LX_MOB_STRIKE_BY_TYPE)) unpicked.push(key);
    if (n < 2) continue;
    const cur = calib[key] && calib[key].attack;
    if (cur && Array.isArray(cur.ft) && !cur.ftAuto) { kept++; continue; }   // authored: never touched
    const ft = e.group === 'boss' ? defaultAttackFt(n, st.cb, st.h, LX_BOSS_STRIKE_BY_TYPE[key]) : defaultMobAttackFt(n, st.cb, st.h, LX_MOB_ATK_BASE_BY_TYPE[key], LX_MOB_STRIKE_BY_TYPE[key]);   // v0.30.382; strike-pick
    if (!ft) continue;
    const same = cur && Array.isArray(cur.ft) && cur.ft.length === ft.length && cur.ft.every((v, i) => v === ft[i]) && cur.ftAuto === true;
    if (same) continue;
    stale++;
    if (!CHECK) {
      calib[key] = calib[key] || {};
      calib[key].attack = Object.assign({}, calib[key].attack || {}, { ft, ftAuto: true });
      baked++;
      report.push(key + ': ' + ft.join('/'));
    }
  }
  if (unpicked.length) console.log('no art-picked strike (apex rule used) - pick one and add it to LX_MOB_STRIKE_BY_TYPE: ' + unpicked.join(' '));
  if (CHECK) {
    if (stale) { console.error(`gen_attack_timing --check: ${stale} attack set(s) lack the default timing - run node scripts/gen_attack_timing.mjs`); process.exit(1); }
    console.log(`gen_attack_timing --check: ok (${kept} authored kept)`);
    return;
  }
  if (!baked) { console.log(`nothing to bake (${kept} authored kept)`); return; }
  const out = header + 'window.LX_ANIM_CALIB = ' + JSON.stringify(calib, null, 2) + ';\n'
    + 'window.LX_ATK_HITBOX = ' + JSON.stringify(hitbox, null, 2) + ';\n';
  const tmp = OUT.replace(/\.js$/, '') + '.tmp.js';   // node --check wants a .js extension
  writeFileSync(tmp, out);
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
  renameSync(tmp, OUT);
  console.log(`baked ${baked} attack timing(s), kept ${kept} authored`);
  for (const r of report) console.log('  ' + r);
}
if (process.argv[1] && /gen_attack_timing\.mjs$/.test(process.argv[1])) main();
