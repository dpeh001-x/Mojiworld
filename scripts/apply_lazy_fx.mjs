// Skill effects, projectiles, summons and gear icons load for the character and the map in play, not all of them after
// the title (pre-launch audits 2026-09-26: asset #2, perf #2; third part of lazy-art / lazy-art2).
// ============================================================================
// With boss frames, backdrops and map art lazy, ~60 MB still streamed in right behind the title: every skill effect
// sprite (Sprites/fx, 226 files, ~35 MB), every gear icon (Sprites/equipment + items, ~24 MB), every projectile
// (~12 MB), every summon and every boon icon - for all four classes and every monster in the game. Then, once the world
// was open, the world streamer's phase 1 asked for EVERY projectile, effect and summon animation set (~120 MB more).
// They were left eager on purpose: a skill's first cast must not pop in. Now they wait, and are asked for early enough:
//   1) the marks (_lxFxMark): the static sprites of LX_FX, LX_MOB_PROJ, LX_PLAYER_PROJ, LX_BULT_PROJ, LX_MOB_CAST,
//      LX_SUMMON and LX_ITEMS are marked _lxLazy when created, so lazy-art's boot image hold PARKS them until asked.
//      Kept eager (_LX_FX.eager): what anyone can trigger any time - the boon procs, the parry, the generic monster
//      telegraphs and swing, the boss bar, the meteor marker, Deadeye's line, the smoke puff (Mirror Step), two generic
//      monster shots, the potions. ?lxfx=0 (or window._lxFxEager set before the page runs) keeps all of it eager - the
//      suites that inspect one sprite directly use it (apply_lazy_fx_tests.mjs).
//   2) the asks (_lxFxWant): right after the title and on every class / job / master change, the art of every skill the
//      character can take (a MEASURED table: each skill of each class, job and master cast in turn, recording the
//      sprites and animation sets it touched), the class's hit sparks and stance, and anything named for the class, job
//      or master; equipped gear; every monster of the map being entered (at high priority) and of its portal neighbours
//      (its shot, cast flash and shot loop, what its definition names, its name-keyed swing / column art, a boss's
//      measured shots and effects and his shackle sigils) - on map entry, in spawnMonster and when a boss is summoned.
//      Last resorts: castSkill asks for the skill's art, and every ready check (_lxFxReady, _lxMobProjReady,
//      _lxPlayerProjReady, _lxSummonReady, _lxMobCastReady, _itemReady) asks for a parked sprite it is shown - the
//      draw keeps its existing fallback for those frames.
//   3) animation sets are requested by those same asks, paced three a beat (one while fighting); the world streamer's
//      every-set sweep now runs only with the hold off (?lxhold=0, which also turns every mark above off).
//   4) panels: itemIconHtml hands a parked or loading gear icon to the panel as an <img> that fetches the file itself
//      (inventory, shop, equipment, crafting and reforge render once), the emoji if the file is missing. The boon icon
//      sweep at boot is gone with the hold on: boonIconHtml's <img> and the orb's first draw load their own.
//   5) the map veil (lazy-art's _lxReadyGate) also waits, bounded, for the map's monster shots and effects.
// Needs lazy-art + lazy-art2 (the hold API, _lxWantImg, _lxLazyWantMap, _LX_ART2). Guarded + atomic + idempotent.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxFxWant(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
if (!s.includes('function _lxLazyWantMap(') || !s.includes('function _lxArt2Want(') || !s.includes('function _lxWantImg(')) die('lazy-art / lazy-art2 are not on this build');
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const each = (a, b, n, what) => { const k = s.split(a).length - 1; if (k !== n) die(what + ' matched ' + k + ' (want ' + n + ')'); s = s.split(a).join(b); };
const after = (a, add, what) => once(a, J(a, ...add), what);
const before = (a, add, what) => once(a, J(...add, a), what);
// the whole line an anchor sits in (its trailing comment included), for an insert after that line
const lineOf = (a, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); const i = s.indexOf(a), b = s.lastIndexOf('\n', i) + 1; let e = s.indexOf('\n', i); if (e < 0) e = s.length; return s.slice(b, e).replace(/\r$/, ''); };
const T = 'v0.30.1234 lazy-fx';

// 1) the state and the mark - after lazy-art2's registry, before the first loader it marks (LX_VFX / LX_MOB_PROJ)
const EAGER_FX = ['ui_bossbar_fill', 'ui_bossbar_frame', 'parry_riposte', 'nova_ring', 'bloom_burst', 'echo_slash', 'time_ripple',
  'crescendo_hit', 'execute_mark', 'skin_ward', 'coin_burst', 'doppel_flash', 'rampage_aura', 'overflow_arc', 'frost_bloom',
  'tg_swing', 'tg_smash', 'tg_dash', 'fx_heavyswing', 'fx_groundshock', 'quake_ring', 'boss_shield', 'meteor_marker',
  'meteor_marker_blue', 'deadeye_tracer', 'smoke_puff'];   // smoke_puff: Mirror Step's decoy puff (a boon) checks it loaded before spawning
const EAGER_RX = '/^Sprites\\/(?:fx\\/(?:' + EAGER_FX.join('|') + ')|projectiles\\/(?:mstormorb|mstone)|items\\/(?:(?:small|medium|large)_(?:red|blue)_potion|elixir|status_cure_remedy))\\.(?:webp|png)$/';
after(J('function _lxArt2Settled(id) {',
  '  const ims = []; for (const k of _lxArt2MapKeys(id)) for (const im of (_LX_ART2.reg[k] || [])) ims.push(im);',
  "  if (typeof _lxImgSettled !== 'function') return Promise.resolve(ims.length);",
  '  return Promise.all(ims.map(_lxImgSettled)).then(() => ims.length);',
  '}'), [
  '// ' + T + ' - SKILL, SHOT, SUMMON AND GEAR ART waits for whoever uses it, like map art (lazy-art2): the static sprites of',
  '// LX_FX, LX_MOB_PROJ, LX_PLAYER_PROJ, LX_BULT_PROJ, LX_MOB_CAST, LX_SUMMON and LX_ITEMS are marked _lxLazy when created,',
  '// so the hold above PARKS them until asked (_lxFxWant): the character\'s skills and gear, the monsters of the map in play',
  '// and next door, a cast, and - last resort - any ready check that finds one parked. eager: art anyone can trigger any',
  '// time (boon procs, the parry, generic telegraphs, the boss bar, generic shots, potions).',
  'const _LX_FX = { eager: ' + EAGER_RX + ',',
  '  // ' + T + ' - off: this art stays eager (?lxfx=0, or window._lxFxEager set before the page runs - the suites that inspect',
  '  // one sprite directly); the hold\'s other lazy art is unchanged',
  "  off: !!window._lxFxEager || /[?&]lxfx=0\\b/.test(location.search || ''),",
  '  open: false, later: [], laterT: 0, animQ: [], animT: 0, anim: Object.create(null), cast: Object.create(null),',
  '  mob: Object.create(null), mobHi: Object.create(null), mobLo: Object.create(null), c: undefined, j: undefined, m: undefined, eq: Object.create(null) };',
  'function _lxFxMark(img, path) {',
  "  if (!img || typeof path !== 'string' || !window._lxBootHold || _LX_FX.off || _LX_FX.eager.test(path)) return img;   // " + T + ' - ?lxhold=0 / ?lxfx=0: eager, as before',
  '  img._lxLazy = true;',
  '  try { _LX_ART2.path.set(path, img); } catch (e) {}   // ' + T + ' - the boot loader\'s DEFERRED list leaves it to its ask',
  '  return img;',
  '}'], 'lazy-art2\'s _lxArt2Settled');

// 1) the marks: before each registry's src (the three projectile loaders share one line; LX_FX and LX_MOB_CAST another)
each("    img.src = 'Sprites/projectiles/' + f;", J(
  "    _lxFxMark(img, 'Sprites/projectiles/' + f);   // " + T + ' - parked until a skill, a monster or a draw asks',
  "    img.src = 'Sprites/projectiles/' + f;"), 3, 'the projectile loaders (LX_MOB_PROJ, LX_PLAYER_PROJ, LX_BULT_PROJ)');
each('    img.src = _fullPath;', J(
  '    _lxFxMark(img, _fullPath);   // ' + T + ' - parked until a skill, a monster or a draw asks',
  '    img.src = _fullPath;'), 2, 'the LX_FX / LX_MOB_CAST loaders');
before("    img.src = 'Sprites/summons/' + f;", [
  "    _lxFxMark(img, 'Sprites/summons/' + f);   // " + T + ' - parked until the skill that summons it is castable'], 'the LX_SUMMON loader');
before("    img.src = f.includes('/') ? f : ('Sprites/items/' + f);", [
  "    _lxFxMark(img, f.includes('/') ? f : ('Sprites/items/' + f));   // " + T + ' - parked until worn or shown in a panel'], 'the LX_ITEMS loader');

// 2) the measured tables (scratch harness: every skill cast in each class / job / master context against pinned dummies,
//    170 frames each; every boss 600 frames in his arena, plus the fire sites a sample does not reach)
const SKILL_T = [
  "  arcaneBurst: 'fa:arcane_burst fa:arcane_shockwave fx:arcane_burst fx:arcane_shockwave',",
  "  archbishop_grail: 'fa:archbishop_grail fx:archbishop_grail fx:celestial_aurora',",
  "  archbishop_ult: 'fa:archbishop_ult fx:archbishop_ult fx:holy_ring',",
  "  arrowRain: 'fx:arrow_rain pp:arrow',",
  "  arrowShot: 'pp:arrow',",
  "  backstab: 'fx:backstab',",
  "  ballista_ult: 'bp:bult_ballista fa:ballista_ult fx:ballista_ult sm:ballista_turret',",
  "  ballista_volley: 'fa:ballista_volley fx:ballista_volley pp:arrow',",
  "  beastmaster_pack: 'fa:beastmaster_pack fx:beastmaster_pack',",
  "  beastmaster_ult: 'fa:beastmaster_ult fx:beastmaster_ult sa:werewolf sm:werewolf',",
  "  blink: 'fx:blink',",
  "  bloodlust: 'fx:bloodlust',",
  "  celestialAurora: 'fx:celestial_aurora',",
  "  chargedShot: 'fx:charged_shot pp:arrow',",
  "  crusader_aegis: 'bp:bult_holyorb fa:crusader_aegis fx:crusader_aegis',",
  "  crusader_ult: 'fa:bastion_aura fa:bastion_pillar fa:crusader_ult fx:bastion_aura fx:bastion_pillar fx:crusader_ult',",
  "  darkPulse: 'fx:hexmaster_darkpulse fx:smoke_puff sa:skeleton sa:zombie sm:skeleton sm:zombie',",
  "  deathBlossom: 'fx:death_blossom fx:death_blossom1',",
  "  doombringer_apoc: 'fa:doombringer_apoc fx:doombringer_apoc fx:dust_ring sm:sword',",
  "  doombringer_ult: 'bp:bult_doomfire fa:doombringer_ult fx:doombringer_ult pa:p_doom_fireball',",
  "  dragoon_skylance: 'fa:dragoon_skylance fx:dragoon_impact fx:dragoon_skylance',",
  "  dragoon_ult: 'bp:bult_dragoon fa:dragoon_ult fx:dragoon_ult',",
  "  eagleEye: 'fx:eagle_eye',",
  "  elemental: 'fx:archmage_elemental fx:elemental_link',",
  "  elementalArrows: 'fx:elemental_arrows pp:arrow sa:wolf sa:wolf_alpha sa:wolf_sky',",
  "  elementalist_cascade: 'fa:cascade_fire fa:cascade_ice fa:cascade_lightning fa:cascade_void fa:elementalist_cascade fx:cascade_fire fx:cascade_ice fx:cascade_lightning fx:cascade_void fx:elementalist_cascade fx:fireball',",
  "  elementalist_ult: 'bp:apo_fire bp:apo_ice bp:apo_lightning bp:apo_void bp:bult_elementalist fa:elementalist_ult fx:apo_ring fx:elementalist_ult pa:p_apo_fire pa:p_apo_ice pa:p_apo_lightning pa:p_apo_void',",
  "  evadeRoll: 'fx:evade_burst pp:arrow',",
  "  fireball: 'fx:fireball_ring pp:fireball',",
  "  flurry: 'fx:flurry',",
  "  groundSlam: 'fa:ground_slam fx:dust_ring fx:ground_slam',",
  "  guardian: 'fa:knight_guardian fx:knight_guardian',",
  "  hexmaster_grandhex: 'bp:hexmaster_hexorb fa:hexmaster_grandhex fx:hexmaster_grandhex pa:p_hexmaster_hexorb',",
  "  hexmaster_ult: 'bp:bult_hexorb fa:hexmaster_ult fx:hexmaster_ult',",
  "  holyLight: 'fx:holy_light',",
  "  holyShield: 'fa:holy_shield fa:holy_wave fx:holy_shield fx:holy_wave',",
  "  iceSpike: 'fx:ice_spike fx:ice_spike_ring pp:icespike',",
  "  magicBolt: 'fx:magic_bolt pa:bolt pp:mage_orb',",
  "  marksman_oneshot: 'fa:deadeye_hit fa:marksman_oneshot fx:deadeye_reticle fx:marksman_oneshot',",
  "  marksman_ult: 'bp:bult_deadeye_exec bp:bult_marksman fa:deadeye_execute fa:deadeye_hit fa:marksman_ult fx:deadeye_execute fx:deadeye_reticle fx:marksman_ult',",
  "  meteor: 'fx:meteor pa:meteor pp:meteor',",
  "  multiShot: 'fx:multi_shot pp:arrow',",
  "  necromancer_harvest: 'fa:soul_vortex fx:soul_vortex fx:soul_vortex1 pa:p_necromancer_soulorb',",
  "  necromancer_ult: 'bp:bult_holyorb fa:necro_maelstrom fa:necromancer_ult fx:necro_maelstrom fx:necromancer_ult pa:p_necromancer_soulorb',",
  "  nightreaper_mark: 'fa:nightreaper_eclipse fx:nightreaper_eclipse fx:smoke_puff',",
  "  nightreaper_ult: 'bp:bult_nightreaper fa:nightreaper_ult fx:nightreaper_ult',",
  "  phantom_cut: 'fx:phantom_cut fx:smoke_puff',",
  "  phantom_ult: 'bp:bult_phantom fa:phantom_ult fx:phantom_ult',",
  "  powerStrike: 'fx:power_strike pa:warrior_shockwave pp:warrior_shockwave',",
  "  rampage: 'fa:warcry fx:rampage fx:rampage_pulse fx:warcry',",
  "  rush: 'fx:rush',",
  "  sage_meteorshower: 'fa:sage_meteorshower fx:fireball fx:sage_meteorshower',",
  "  sage_ult: 'bp:bult_sage fa:sage_meteor_impact fa:sage_ult fx:sage_meteor_impact fx:sage_ult',",
  "  shadowStrike: 'fx:shadow_strike',",
  "  shadowlord_clones: 'fa:clone_strike fa:shadowlord_clones fx:clone_sigil fx:clone_strike fx:shadowlord_clones sa:clone_center sa:clone_left sa:clone_right sm:clone_center sm:clone_left sm:clone_right',",
  "  shadowlord_ult: 'fa:shadowlord_ult fx:shadowlord_ult',",
  "  shinobi_seal: 'fa:shinobi_seal fx:shinobi_seal',",
  "  shinobi_ult: 'fa:shinobi_ult fx:shinobi_ult',",
  "  skyhunter_gale: 'bp:gale_skyhunter fa:skyhunter_gale fx:skyhunter_gale sa:wolf_sky',",
  "  skyhunter_ult: 'bp:bult_skyhunter fa:skyhunter_ult fx:skyhunter_ult sa:eagle sm:eagle',",
  "  sleight: 'fa:phantom_voidrift fx:phantom_voidrift fx:phantom_voidrift2',",
  "  smokeBomb: 'fx:shin_shuriken fx:shin_shuriken2 pp:kunai pp:shuriken',",
  "  smokeDash: 'fx:smoke_dash',",
  "  snipe_railgun: 'fx:railshot',",
  "  soulSiphon: 'fx:hexmaster_summon pa:p_necromancer_soulorb sa:skeleton sa:zombie sm:skeleton sm:zombie',",
  "  throwDagger: 'fx:throw_dagger',",
  "  warCry: 'fa:warcry fx:fx_warcry_mark fx:warcry',",
  "  warlord_ult: 'bp:bult_warlord fa:warlord_ult fx:warlord_ult pa:p_ult_warlord',",
  "  warlord_warcry: 'fa:warlord_banner fx:warlord_banner fx:warlord_banner_planted pa:shockwave pp:shockwave',",
  "  wildBond: 'fx:wild_bond sa:werewolf sa:wolf sm:wolf',",
];
const BOSS_T = [
  "  aetherion: 'fa:ae_evolve fa:fx_shard fa:fx_voidbeam fx:ae_evolve fx:fx_shard fx:fx_voidbeam mp:deathOrb mp:maeshard mp:voidring pa:deathOrb pa:maeshard pa:meteor pa:voidring',",
  "  gravitos: 'fa:grav_impact fa:gravitos_riftring fa:gravitos_voidrift fa:singularity fx:grav_impact fx:gravitos_riftring fx:gravitos_slamring fx:gravitos_slamzone fx:gravitos_voidrift mp:comet mp:gravbolt mp:gravdrop mp:shock mp:voidring mp:wave pa:comet pa:gravdrop pa:voidring pa:wave',",
  "  king: 'mp:goo mp:splash pa:goo pa:splash',",
  "  kingKrook: 'mp:claw mp:mfirebomb pa:firebomb',",
  "  mirrorSelf: 'mp:msplinter pa:msplinter',",
  "  mooma: 'mp:shock mp:spore pa:spore',",
  "  octobaby: 'mp:bubble mp:mink mp:octoHead mp:octoLeg mp:splash mp:tidalSweep pa:bubble pa:mink pa:octoHead pa:octoLeg',",
  "  pqConductor: 'fx:fx_col_conductor mp:mticket',",
  "  sundered_smith: 'mp:forgeHammer mp:quake pa:meteor pa:quake',",
  "  towerArbiter: 'fx:fx_col_arbiter',",
  "  towerSovereign: 'fx:fx_col_sovereign mp:msovereign pa:msovereign',",
  "  young_confused_barnaby: 'fx:fx_col_barnaby mp:barnFist pa:meteor',",
  "  zodiac_aquarius: 'mp:droplet mp:waterPillar mp:wave mp:whirl pa:droplet pa:wave pa:whirl',",
  "  zodiac_aries: 'mp:fire mp:zodiac mp:zodiacHoming pa:meteor pa:zodiac',",
  "  zodiac_cancer: 'mp:cancerBubble mp:pincer mp:pincerSweep mp:tsunami pa:cancerBubble pa:pincer pa:tsunami',",
  "  zodiac_capricorn: 'mp:ice mp:icePillar mp:stalactite pa:ice pa:icePillar pa:stalactite',",
  "  zodiac_gemini: 'mp:gemini_shard pa:gemini_shard',",
  "  zodiac_leo: 'fa:fx_leo_slam fx:fx_leo_slam mp:roar mp:starbeam mp:starburst pa:meteor pa:roar pa:starbeam pa:starburst',",
  "  zodiac_libra: 'mp:scale pa:scale',",
  "  zodiac_pisces: 'mp:bubble mp:droplet mp:whirl pa:bubble pa:droplet pa:whirl',",
  "  zodiac_sagittarius: 'mp:arrowRain mp:markedShot mp:starbeam pa:markedShot pa:starbeam',",
  "  zodiac_scorpio: 'mp:venom pa:meteor pa:venom',",
  "  zodiac_taurus: 'fa:tg_dash_zodiac_taurus fx:fx_taurus_gore mp:quake mp:taurus_boulder pa:quake pa:taurus_boulder',",
  "  zodiac_virgo: 'mp:radiantLance',",
];

// 2) the tables and the asks - next to the class FX pre-warm they extend
before('let _lxFxWarmCls = null, _lxFxWarmJob = null, _lxFxWarmMaster = null;', [
  '// ' + T + ' - what each skill draws, MEASURED: every skill of every class, job and master cast in turn against pinned',
  '// dummies, recording every sprite and animation set it touched. fx: LX_FX, fa: its _fxAnimFrames set, pp: LX_PLAYER_PROJ,',
  '// bp: LX_BULT_PROJ, pa: a _projAnimFrame set, sm: LX_SUMMON, sa: a summon\'s walk + attack sets. The class\'s hit sparks and',
  '// stance, and any sprite named for the class, job or master, come by rule (_lxFxClassTags); a skill this table misses',
  '// still asks at its first cast (castSkill), and a sprite at its first draw (the ready checks).',
  'const _LX_FX_SKILL = {', ...SKILL_T, '};',
  '// ' + T + ' - a boss\'s own shots and effects: measured (600 frames in his arena) plus the fire sites a sample does not',
  '// reach; the rest of any monster\'s art comes by rule (_lxFxMobTags)',
  'const _LX_FX_BOSS = {', ...BOSS_T, '};',
  'function _lxFxOwn(o, k) { return !!(o && k && Object.prototype.hasOwnProperty.call(o, k)); }',
  '// ' + T + ' - a tag\'s registry image (null for an animation set or an unknown key)',
  'function _lxFxImg(tag) {',
  '  const k = tag.slice(3);',
  '  try {',
  '    switch (tag.slice(0, 2)) {',
  "      case 'fx': return _lxFxOwn(LX_FX, k) ? LX_FX[k] : null;",
  "      case 'pp': return _lxFxOwn(LX_PLAYER_PROJ, k) ? LX_PLAYER_PROJ[k] : null;",
  "      case 'bp': return _lxFxOwn(LX_BULT_PROJ, k) ? LX_BULT_PROJ[k] : null;",
  "      case 'mp': return _lxFxOwn(LX_MOB_PROJ, k) ? LX_MOB_PROJ[k] : null;",
  "      case 'mc': return _lxFxOwn(LX_MOB_CAST, k) ? LX_MOB_CAST[k] : null;",
  "      case 'sm': return _lxFxOwn(LX_SUMMON, k) ? LX_SUMMON[k] : null;",
  "      case 'it': return _lxFxOwn(LX_ITEMS, '_pending_' + k) ? LX_ITEMS['_pending_' + k] : null;",
  '    }',
  '  } catch (e) {}',
  '  return null;',
  '}',
  '// ' + T + ' - ask for one tag. hi (a map being entered, a monster appearing): a sprite at once, ahead of the background',
  '// stream; an animation set at the FRONT of a queue paced like the old sweep (three sets a beat when calm, one while the',
  '// player fights), so it never competes with a boss\'s frames under the veil. hi === 2 (a cast): a set at once too.',
  '// Otherwise it waits for the menu (the title files go first, as lazy-art2\'s asks do), then joins the back of the queue.',
  'function _lxFxWant(tag, hi) {',
  '  if (!tag || !window._lxBootHold || _LX_FX.off) return;',
  '  const F = _LX_FX;',
  '  if (!hi && !F.open) {',
  '    try { F.open = !!window._lxBootHold.stats().open; } catch (e) {}',
  '    if (!F.open) { if (F.later.indexOf(tag) < 0) F.later.push(tag); if (!F.laterT) F.laterT = setTimeout(_lxFxLater, 400); return; }',
  '  }',
  '  const p = tag.slice(0, 2);',
  "  if (p === 'fa' || p === 'pa' || p === 'sa') {",
  '    const st = F.anim[tag];',
  '    if (st === 2) return;',
  '    if (hi === 2) { _lxFxAnimGo(tag); return; }',
  '    if (st === 1) { const i = hi ? F.animQ.indexOf(tag) : -1; if (i > 0) { F.animQ.splice(i, 1); F.animQ.unshift(tag); } return; }',
  '    F.anim[tag] = 1; if (hi) F.animQ.unshift(tag); else F.animQ.push(tag);',
  '    if (!F.animT) F.animT = setTimeout(_lxFxAnimStep, 60);',
  '    return;',
  '  }',
  '  const im = _lxFxImg(tag);',
  "  if (im && typeof _lxWantImg === 'function') _lxWantImg(im, hi);",
  '}',
  'function _lxFxLater() {',
  '  const F = _LX_FX; F.laterT = 0;',
  '  try { F.open = !!window._lxBootHold.stats().open; } catch (e) { F.open = true; }',
  '  if (!F.open) { F.laterT = setTimeout(_lxFxLater, 400); return; }',
  '  for (const t of F.later.splice(0)) _lxFxWant(t);',
  '}',
  'function _lxFxAnimGo(tag) {',
  '  _LX_FX.anim[tag] = 2;',
  '  const k = tag.slice(3);',
  '  try {',
  "    if (tag[0] === 'f') { if (typeof _fxAnimFrames === 'function') _fxAnimFrames(k); }",
  "    else if (tag[0] === 'p') { if (typeof _projAnimFrame === 'function') _projAnimFrame(k); }",
  "    else if (typeof _summonAnimFrame === 'function') { _summonAnimFrame(k, 'walk'); _summonAnimFrame(k, 'attack'); }",
  '  } catch (e) {}',
  '}',
  'function _lxFxAnimStep() {',
  '  const F = _LX_FX; F.animT = 0;',
  "  const n = (typeof _lxCombatHot === 'function' && _lxCombatHot()) ? 1 : 3;",
  '  for (let i = 0; i < n && F.animQ.length;) { const t = F.animQ.shift(); if (F.anim[t] === 2) continue; _lxFxAnimGo(t); i++; }',
  '  if (F.animQ.length) F.animT = setTimeout(_lxFxAnimStep, 180);',
  '}',
  '// ' + T + ' - the art this character can cast: every skill of its class, job and master (learned or not - any of them',
  '// can go on the bar), the class\'s hit sparks and stance, anything named for the class, job or master, and the rank /',
  '// variant sprites beside a listed one (death_blossom1, shin_shuriken2, soul_vortex1, phantom_voidrift2)',
  'function _lxFxClassTags() {',
  "  const out = [], c = (typeof player !== 'undefined' && player) ? player.cls : null;",
  '  if (!c) return out;',
  '  const add = (t) => { if (out.indexOf(t) < 0) out.push(t); };',
  '  try {',
  "    const rx = new RegExp('(^|_)(?:' + [c, player.job, player.master].filter(Boolean).join('|') + ')(?:_|\\\\d|$)');",
  "    for (const k in LX_FX) if (rx.test(k)) { add('fx:' + k); if (_FX_ANIM_KEYS.has(k)) add('fa:' + k); }",
  '    for (const id in SKILLS) {',
  '      const sk = SKILLS[id];',
  '      if (!sk || sk.cls !== c || (sk.job && sk.job !== player.job) || (sk.master && sk.master !== player.master)) continue;',
  "      for (const t of (_LX_FX_SKILL[id] || '').split(' ')) if (t) add(t);",
  '    }',
  "    for (const t of out.slice()) if (t.indexOf('fx:') === 0) { const b = t.slice(3); for (const k in LX_FX) if (k !== b && k.indexOf(b) === 0 && /^_?\\d+$/.test(k.slice(b.length))) add('fx:' + k); }",
  '  } catch (e) {}',
  '  return out;',
  '}',
  'function _lxFxWantClass() { for (const t of _lxFxClassTags()) _lxFxWant(t); }',
  '// ' + T + ' - castSkill re-runs every frame a key is held: once per skill (its table row, at once)',
  'function _lxFxWantSkill(id, hi) {',
  '  if (!id || _LX_FX.cast[id]) return;',
  '  _LX_FX.cast[id] = 1;',
  "  for (const t of (_LX_FX_SKILL[id] || '').split(' ')) if (t) _lxFxWant(t, hi);",
  '}',
  'function _lxFxWantGear() {',
  "  try { const eq = player.equipped || {}; for (const sl in eq) { const it = eq[sl], k = it && _itemKey(it); if (k) _lxFxWant('it:' + k); } } catch (e) {}",
  '}',
  '// ' + T + ' - one compare a frame (from _lxPrewarmClassFx): a class, job or master change, or a gear slot that changed',
  'function _lxFxTick() {',
  "  if (!window._lxBootHold || _LX_FX.off || typeof player === 'undefined' || !player) return;",
  '  const F = _LX_FX;',
  '  if (player.cls !== F.c || player.job !== F.j || player.master !== F.m) { F.c = player.cls; F.j = player.job; F.m = player.master; _lxFxWantClass(); }',
  '  const eq = player.equipped;',
  '  if (eq) { let ch = false; for (const sl in eq) if (F.eq[sl] !== eq[sl]) { F.eq[sl] = eq[sl]; ch = true; } if (ch) _lxFxWantGear(); }',
  '}',
  '// ' + T + ' - right after the title (the hold lets go): the saved character\'s skills and gear, frame loop or not',
  '(function _lxFxBoot() {',
  '  const go = () => { try { const H = window._lxBootHold; if (!H) return; if (!H.stats().open) { setTimeout(go, 500); return; } _LX_FX.open = true; _lxFxTick(); } catch (e) {} };',
  '  setTimeout(go, 500);',
  '})();',
  '// ' + T + ' - a monster type\'s art: its shot (the sprite, the cast flash, the shot\'s loop), any sprite or set its',
  '// definition names (a trait\'s column sprite), the art keyed on its name (swing_ / tg_col_ / tg_dash_ / fx_col_), its',
  '// skill kind\'s and type\'s pre-warm art, a boss\'s measured shots and effects, and the shackle sigils a boss can throw',
  'function _lxFxMobTags(type) {',
  '  let out = _LX_FX.mob[type];',
  '  if (out) return out;',
  '  out = [];',
  "  const t = (typeof monsterTypes !== 'undefined' && type) ? monsterTypes[type] : null;",
  '  if (!t) return out;',
  '  const add = (x) => { if (out.indexOf(x) < 0) out.push(x); };',
  '  const key = (k) => {',
  "    if (typeof k !== 'string' || !k || k.length > 48) return;",
  "    if (_lxFxOwn(LX_MOB_PROJ, k)) add('mp:' + k);",
  "    if (_lxFxOwn(LX_MOB_CAST, k)) add('mc:' + k);",
  "    if (_PROJ_ANIM_KEYS.has(k)) add('pa:' + k);",
  "    if (_lxFxOwn(LX_FX, k)) add('fx:' + k);",
  "    if (_FX_ANIM_KEYS.has(k)) add('fa:' + k);",
  '  };',
  "  const walk = (o, d) => { if (!o || d > 3) return; for (const k in o) { const v = o[k]; if (typeof v === 'string') key(v); else if (v && typeof v === 'object') walk(v, d + 1); } };",
  '  try {',
  '    walk(t, 0);',
  "    for (const pre of ['swing_', 'tg_col_', 'tg_dash_']) key(pre + type);",
  "    key('fx_col_' + type.toLowerCase());",
  "    const sk = (typeof MONSTER_SKILLS !== 'undefined') ? MONSTER_SKILLS[type] : null;",
  '    walk(sk && _LX_MOB_SKILL_ART[sk.kind], 0); walk(_LX_MOB_TYPE_ART[type], 0);',
  "    for (const x of (_LX_FX_BOSS[type] || '').split(' ')) if (x) add(x);",
  '    const zs = /^zodiac_/.test(type) ? type.slice(7) : null;',
  "    if (zs) { key('tg_col_zodiac'); key('fx_col_zodiac'); }",
  "    if (t.boss || zs) { const th = (typeof _qteThemeFor === 'function') ? _qteThemeFor({ type, zodiacSign: zs }) : null; for (const q of ['qte_chains', 'qte_break', th && th.fx]) key(q); }",
  '  } catch (e) { return out; }   // ' + T + ' - asked before the tables exist: not kept, the next ask builds it whole',
  '  return (_LX_FX.mob[type] = out);',
  '}',
  'function _lxFxWantMob(type, hi) {',
  '  const memo = hi ? _LX_FX.mobHi : _LX_FX.mobLo;',
  '  if (!type || memo[type]) return;',
  '  memo[type] = 1;',
  '  for (const t of _lxFxMobTags(type)) _lxFxWant(t, hi);',
  '}',
  '// ' + T + ' - the map\'s monsters: lazy-art\'s list (spawns, declared bosses, Tower / Hall of Echoes bosses) + the adds',
  'function _lxFxMapTypes(id) {',
  '  const out = [];',
  "  try { for (const t of _lxMapBossTypes(id)) { out.push(t); for (const a of ((typeof _LX_ART2_ADDS !== 'undefined' && _LX_ART2_ADDS[t]) || [])) out.push(a); } } catch (e) {}",
  '  return out;',
  '}',
  'function _lxFxWantMap(id, hi) { for (const t of _lxFxMapTypes(id)) _lxFxWantMob(t, hi); }',
  '// ' + T + ' - settles when the map\'s monster shots and effects have loaded or failed (the veil waits on it, bounded)',
  'function _lxFxMapSettled(id) {',
  '  const ims = [];',
  '  for (const t of _lxFxMapTypes(id)) for (const x of _lxFxMobTags(t)) { const im = /^(?:mp|mc|fx):/.test(x) ? _lxFxImg(x) : null; if (im && ims.indexOf(im) < 0) ims.push(im); }',
  "  if (typeof _lxImgSettled !== 'function') return Promise.resolve(ims.length);",
  '  return Promise.all(ims.map(_lxImgSettled)).then(() => ims.length);',
  '}',
  '// ' + T + ' - a gear icon still parked or on its way: an <img> of the file for a panel that renders once (it fetches the',
  '// file itself; the emoji replaces it if the file is missing). null when the icon is not lazy art or its file failed.',
  'function _lxFxItemImgHtml(it, sz) {',
  '  try {',
  "    const k = _itemKey(it), im = k && _lxFxOwn(LX_ITEMS, '_pending_' + k) ? LX_ITEMS['_pending_' + k] : null;",
  '    if (!im || im._lxLazy !== true || (im.complete && !(im.naturalWidth > 0))) return null;',
  '    const u = im.src;',
  '    if (!u) return null;',
  "    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');",
  "    const fb = '<span style=\"font-size:' + Math.round(sz * 0.85) + 'px;line-height:1;\">' + ((it && it.icon) || '\\u25c7') + '</span>';",
  "    return '<img src=\"' + esc(u) + '\" width=\"' + sz + '\" height=\"' + sz + '\" style=\"display:inline-block;vertical-align:middle;image-rendering:auto;\" alt=\"' + esc((it && it.name) || '') + '\" data-fb=\"' + esc(fb) + '\" onerror=\"this.outerHTML=this.dataset.fb\">';",
  '  } catch (e) { return null; }',
  '}'], 'the class FX pre-warm state');

// 2) last resort at the draw: a ready check that finds a parked sprite asks for it (the draw keeps its fallback meanwhile)
const ASK = "if (img && img._lxLazy === true && !img._lxWanted && typeof _lxWantImg === 'function') _lxWantImg(img, true);   // " + T + ' - shown while parked: ask';
for (const fn of ['_lxMobProjReady', '_lxPlayerProjReady', '_lxSummonReady', '_lxFxReady', '_lxMobCastReady']) {
  once('function ' + fn + '(img) { return !!(img && img.complete && img.naturalWidth > 0); }', J(
    'function ' + fn + '(img) {', '  ' + ASK, '  return !!(img && img.complete && img.naturalWidth > 0);', '}'), fn);
}
once('function _itemReady(img) { return img && img.complete && img.naturalWidth > 0; }', J(
  'function _itemReady(img) {', '  ' + ASK, '  return img && img.complete && img.naturalWidth > 0;', '}'), '_itemReady');
// 4) panels: a parked or loading gear icon goes out as an <img> of its file
after('  const img = _itemSprite(it);', [
  '  if (!img) { const _lz = _lxFxItemImgHtml(it, sz); if (_lz) return _lz; }   // ' + T + ' - parked or on its way: the panel\'s <img> fetches it'],
  'itemIconHtml');
// 4) the boon icon sweep at boot (every boon's icon, ~40 files) only with the hold off
once("try { if (typeof _boonIconUrl === 'function') for (const _bp of POWERUPS) _boonIconUrl(_bp.id); } catch (e) {}",
  "try { if (typeof _boonIconUrl === 'function' && (!window._lxBootHold || _LX_FX.off)) for (const _bp of POWERUPS) _boonIconUrl(_bp.id); } catch (e) {}   // " + T + " - hold on: boonIconHtml's <img> and the orb's first draw load their own",
  'the boon icon sweep');
// 3) the world streamer's phase 1 (every projectile / FX / summon set) only with the hold off
once(J('    _fxStep();', '  } catch (e) {}'), J(
  '    if (!window._lxBootHold || _LX_FX.off) _fxStep();   // ' + T + ' - hold on: a set is asked for by whoever will play it (_lxFxWant)',
  '  } catch (e) {}'), 'the world streamer phase 1');
// 2) the asks: class / job / master / gear (the pre-warm's per-frame compare), a cast, a map, a spawn, a summoned boss
after(J('function _lxPrewarmClassFx() {', "  if (typeof player === 'undefined' || !player || !player.cls) return;"), [
  "  try { if (typeof _lxFxTick === 'function') _lxFxTick(); } catch (e) {}   // " + T + ' - the skills\' and the gear\'s art'],
  '_lxPrewarmClassFx head');
after(J('function castSkill(id) {', '  const s = SKILLS[id];', '  if (!s) return;'), [
  "  try { if (typeof _lxFxWantSkill === 'function') _lxFxWantSkill(id, 2); } catch (e) {}   // " + T + ' - the last ask before its first draw'],
  'castSkill head');
after('function _lxLazyWantMap(id, hi) {', [
  "  try { if (typeof _lxFxWantMap === 'function') _lxFxWantMap(id, hi); } catch (e) {}   // " + T + ' - its monsters\' shots and effects'],
  '_lxLazyWantMap head');
before('    try { _lxArt2WantMon(type, true); } catch (e) {}', [
  "    try { if (typeof _lxFxWantMob === 'function') _lxFxWantMob(type, true); } catch (e) {}   // " + T + ' - its shots and effects'],
  'spawnMonster');
before('  try { _lxBossArtWant(type, true); } catch (e) {}   // v0.30.1196 lazy-art', [
  "  try { if (typeof _lxFxWantMob === 'function') _lxFxWantMob(type, true); } catch (e) {}   // " + T + ' - a summoned boss\'s shots and effects'],
  '_lxWarmBossFrames');
once("    const one = (im) => { if (im && im.tagName === 'IMG' && pins.indexOf(im) < 0) pins.push(im); };",
  "    const one = (im) => { if (im && im.tagName === 'IMG' && pins.indexOf(im) < 0) { if (im._lxLazy === true && !im._lxWanted && typeof _lxWantImg === 'function') _lxWantImg(im, true); pins.push(im); } };   // " + T + ' - asked for before its pin queues',
  '_lxPrewarmMobFx one');
// 5) the veil waits (bounded) for the map's monster shots and effects too: they load beside lazy-art2's sheets, and after
//    that wait they get a moment more, never a wait of their own ahead of the boss art
{
  const L = lineOf("    try { if (typeof _lxArt2Settled === 'function') await capped(_lxArt2Settled(id), CAP * 0.4); } catch (e) {}", '_lxReadyGate lazy-art2 wait');
  once(L, J(
    "    const _lzFx = (typeof _lxFxMapSettled === 'function') ? _lxFxMapSettled(id) : null;   // " + T + ' - the map\'s monster shots and effects, loading beside the sheets',
    L,
    '    try { if (_lzFx) await capped(_lzFx, CAP * 0.05); } catch (e) {}   // ' + T + ' - and a moment more for them'), '_lxReadyGate');
}

const grew = s.length - n0;
if (grew < 14000 || grew > 26000) die('size moved ' + grew);
if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)) die('lone surrogate');
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: lazy-fx (+' + grew + ' chars)');
