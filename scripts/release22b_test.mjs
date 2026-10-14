// RELEASE 22b (class balance, per user: option (b) "fix the base first", then "1b / 2a") stays in place:
//   [1] rogue shop-ladder gear carries the staff ATK% curve (atkPct per tier and slot), archer gear ~0.4x of it on T3 / T4 / T7 / T8;
//       the assassin job (Shin-Shuriken, Voidrift Blink) and Death Blossom lifted; Bloodmoon Domain / Voidwalk / Hundred-Hand
//       only as high as still needed (Kage Rush and Voidrift Execution keep their old numbers); Warlord's Banner at the top of its budget; each description
//       matching; the numbers pinned earlier untouched (Eclipse Massacre, War of Banners, Voidrift's 10.4x strikes, Shadow Strike)
//   [2] measured with fair builds (devSetLevel, shop-ladder gear, the class tree, AP 45% ATK / 40% HP / 15% DEF, ranks round robin),
//       a 90 s rotation on the Playwright clock (seeded RNG, comboMult 1, MP potions under 40%) on a frozen 0-DEF dummy, the hit
//       log replayed (16 seeds) on every monster within +-5 levels: at Lv 70 Shinobi / Nightreaper / Phantom and at Lv 20 the
//       assassin job take at most ~1.5x the median mage's time-to-kill (asserted <= 1.6x, the Lv 20 job <= 1.7x: one run reads
//       +-7%, more at Lv 20 where a kill takes ~0.1 s); at Lv 50 and 20
//       none of them, nor Marksman, is faster than the median mage (asserted >= 0.92x). Before: 2.6-3.6x.
//   node release22b_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT / SECS / WORKERS override; STATIC=1 skips [2]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15201), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const SECS = Number(process.env.SECS || 90), WORKERS = Number(process.env.WORKERS || 4);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
// ---- [1] the literals
const src = readFileSync(path.resolve(ROOT, FILE), 'utf8').split('\r\n').join('\n');
const has = (n, s, k = 1) => { const c = src.split(s).length - 1; ok('[1] ' + n, c === k, c === k ? undefined : { found: c, want: k, s: s.slice(0, 90) }); };
{
  has("kept: Kage Rush 8x a lane", "const LX_KAGE_DMG = 8;");
  has("kept: Kage Rush row (15 s, 8x)", "master:'shinobi',     slot:'x', mp:18, cd:15000,  desc:'4 charges. Each is a short shadow-step slash (~400 px) across a crimson lane, dealing 8× ATK to every foe it crosses");
  has("Hundred-Hand slashes 26x (was 10)", "performAround(175, 26, {");
  has("Hundred-Hand finale 31x (was 12)", "performAround(330, 31, {");
  has("Hundred-Hand row: cd 30 s", "master:'shinobi',     slot:'b', mp:60,  cd:30000, desc:'Four blink-slashes (26× ATK in 175 px each) that stick to the nearest foe, then a 31× ATK shockwave finale");
  has("Bloodmoon shuriken 9.5x + 10 (was 2x)", "damage: getAtk() * 9.5 + 10, owner: 'player', skill: 'shard', bspr: 'bult_nightreaper'");
  has("Bloodmoon nova 7.6x", "performAround(380, 7.6, {");
  has("Bloodmoon row: cd 30 s", "master:'nightreaper', slot:'b', mp:62,  cd:30000, desc:'Three waves of 9 homing, piercing shuriken (9.5× ATK each), an execute on non-boss foes under 25% HP, then a 7.6× ATK blood nova");
  has("kept: Voidrift nova 5.2x + 12", "const dmg = Math.floor(getAtk() * 5.2 + 12);");
  has("kept: Voidrift row 25 s", "master:'phantom',     slot:'x', mp:55, cd:25000, desc:");
  has("kept: Voidrift row nova 5.2x", "stunning shadow nova (5.2× ATK, 220 px)");
  has("Voidwalk shards 10x + 40 (was 7x)", "damage: getAtk() * 10 + 40, owner: 'player', skill: 'shard', bspr: 'bult_phantom'");
  has("Voidwalk 5 rings (was 3)", "for (let r = 0; r < 5; r++) scheduleSkillTimer(() => {");
  has("Voidwalk row: cd 32 s", "master:'phantom',     slot:'b', mp:62,  cd:32000, desc:'Vault into a void somersault and loose five rings of 12 piercing void shards (10× ATK each).'");
  has("Shin-Shuriken 2.8x a blade (was 0.76)", "damage: getAtk() * 2.8,   //");
  has("Shin-Shuriken desc 2.8x", "2.8× ATK per blade, that spread out from your chest.");
  has("Voidrift Blink 22x (was 6)", "const dmg = Math.floor(getAtk() * 22 * ramp);");
  has("Voidrift Blink desc 22x", "hitting all foes in the path for 22× ATK (×1.15");
  has("Death Blossom 6.5x a wave (was 3.5)", "Math.floor(getAtk() * 6.5 * (_c ? getCritDmg() : 1)), _c, 'deathBlossom'); }");
  has("Death Blossom desc 6.5x", "then 3 fast spinning waves of 6.5× ATK (up to 12 foes");
  has("Warlord's Banner burst 7x (was 4.4)", "performAround(200, 7 + stacks * 0.3, {");
  has("Warlord's Banner shockwaves 8x (was 5)", "const fanDmg = getAtk() * 8 + 20 + stacks * 8;");
  has("Warlord's Banner desc", "Plants with a 7× ATK burst + 3 piercing shockwaves (8× ATK)");
  has("kept: Warlord's Banner 25 s", "master:'warlord',     slot:'x', mp:50, cd:25000,");
  has("kept: Shadow Strike 2.6x (a landed-fix marker)", "hitMonster(tgt, Math.floor(getAtk() * 2.6), false, 'shadowStrike');", 2);
  has("kept: Voidrift strikes 5.2x (10.4x as a G skill)", "hitMonster(target, Math.floor(getAtk() * 5.2), false, 'phantom_cut');");
  has("kept: the marked Voidrift desc text", "execute them in 6 chain-teleport strikes (10.4× ATK each)");
  has("kept: Eclipse daggers 1.8x", "const dmg = Math.max(1, Math.floor(getAtk() * 1.8 * (isCrit ? getCritDmg() : 1)));");
  has("kept: Eclipse snap 2.48x", "const baseDmg = Math.floor(getAtk() * 2.48 + 50);");
  has("kept: Eclipse Massacre 25 s", "master:'nightreaper', slot:'x', mp:55, cd:25000, desc:");
  has("kept: War of Banners sweep 1.7x", "performMelee(320, 1.7, { color: '#ffcc44', kb: 6 })");
  has("kept: War of Banners wave 1.4x", "damage: getAtk() * 1.4 + 10, owner: 'player', skill: 'bloodwave'");
  has("kept: War of Banners 60 s", "master:'warlord',     slot:'b', mp:70,  cd:60000, desc:");
  has("gear: Nightshade Kunai atkPct 0.06", "{ name:'Nightshade Kunai',   icon:'🥷', atk:22, rarity:'epic', price:2700, cls:'rogue', tier:3, atkPct:0.06,");
  has("gear: Nightshade Cloak atkPct 0.05", "{ name:'Nightshade Cloak',   icon:'🧥', def:14, hp:60,  rarity:'epic', price:2700, cls:'rogue', tier:3, atkPct:0.05,");
  has("gear: Assassin's Edge atkPct 0.08", "{ name:'Assassin\\'s Edge',       icon:'🗡️', atk:44, rarity:'epic', price:4000, cls:'rogue',   tier:4, atkPct:0.08,");
  has("gear: Assassin's Garb atkPct 0.08", "{ name:'Assassin\\'s Garb',    icon:'🧥', def:36, hp:80,  rarity:'epic', price:4000, cls:'rogue',   tier:4, atkPct:0.08,");
  has("gear: Assassin Tattoo atkPct 0.06", "{ name:'Assassin Tattoo',   icon:'☠️', atk:8, def:8, crit:18, lifesteal:0.005, rarity:'epic', price:4000, cls:'rogue',   tier:4, atkPct:0.06,");
  has("gear: Eclipse Daggers atkPct 0.15", "{ name:'Eclipse Daggers',        icon:'🗡️', atk:84, rarity:'legendary', price:10500, cls:'rogue',   tier:6, atkPct:0.15,");
  has("gear: Eclipse Shroud atkPct 0.14", "{ name:'Eclipse Shroud',      icon:'🥷', def:60, hp:200, rarity:'legendary', price:10500, cls:'rogue',   tier:6, atkPct:0.14,");
  has("gear: Phantom Talons atkPct 0.18", "{ name:'Phantom Talons',         icon:'🗡️', atk:118, rarity:'legendary', price:16000, cls:'rogue',   tier:7, atkPct:0.18,");
  has("gear: Phantom Cloak atkPct 0.17", "{ name:'Phantom Cloak',       icon:'🥷', def:85, hp:270, rarity:'legendary', price:16000, cls:'rogue',   tier:7, atkPct:0.17,");
  has("gear: Phantom Mask atkPct 0.14", "{ name:'Phantom Mask',      icon:'👤', atk:18, def:24, crit:36, dodgeChance:0.09, critDmg:0.15, lifesteal:0.006, rarity:'legendary', price:16000, cls:'rogue',   tier:7, atkPct:0.14,");
  has("gear: Spectre Fangs atkPct 0.22", "{ name:'Spectre Fangs',           icon:'🗡️', atk:168, rarity:'legendary', price:23500, cls:'rogue',   tier:8, atkPct:0.22,");
  has("gear: Spectre Mantle atkPct 0.2", "{ name:'Spectre Mantle',      icon:'🥷', def:110, hp:340, rarity:'legendary', price:23500, cls:'rogue',   tier:8, atkPct:0.2,");
  has("gear: Spectre Cowl atkPct 0.18", "{ name:'Spectre Cowl',      icon:'👁️', atk:24, def:32, crit:42, dodgeChance:0.1, critDmg:0.18, lifesteal:0.009, rarity:'legendary', price:23500, cls:'rogue',   tier:8, atkPct:0.18,");
  has("gear: Wraith Shroud atkPct 0.2", "{ name:'Wraith Shroud',       icon:'🥷', def:145, hp:640, mp:130, rarity:'legendary', price:36000, cls:'rogue',   tier:9, atkPct:0.2,");
  has("gear: Wraith Sigil atkPct 0.24", "{ name:'Wraith Sigil',      icon:'🕷️', atk:45, hp:140, mp:110, def:42, crit:52, dodgeChance:0.12, critDmg:0.22, lifesteal:0.010, speed:0.30, rarity:'legendary', price:36000, cls:'rogue',   tier:9, atkPct:0.24,");
  has("gear: Oblivion Veil atkPct 0.25", "{ name:'Oblivion Veil',       icon:'🥷', def:175, hp:810, mp:160, rarity:'legendary', price:54000, cls:'rogue',   tier:10, atkPct:0.25,");
  has("gear: Oblivion Mask atkPct 0.22", "{ name:'Oblivion Mask',     icon:'🎭', atk:60, hp:180, mp:140, def:55, crit:65, dodgeChance:0.14, critDmg:0.27, lifesteal:0.013, speed:0.40, rarity:'legendary', price:54000, cls:'rogue',   tier:10, atkPct:0.22,");
  has("gear: Falcon Recurve atkPct 0.02", "{ name:'Falcon Recurve',     icon:'🏹', atk:24, rarity:'epic', price:2700, cls:'archer', tier:3, atkPct:0.02,");
  has("gear: Falcon Mail atkPct 0.02", "{ name:'Falcon Mail',        icon:'🪖', def:16, hp:70,  rarity:'epic', price:2700, cls:'archer', tier:3, atkPct:0.02,");
  has("gear: Marksman's Compound atkPct 0.03", "{ name:'Marksman\\'s Compound',   icon:'🏹', atk:46, rarity:'epic', price:4000, cls:'archer',  tier:4, atkPct:0.03,");
  has("gear: Marksman Leathers atkPct 0.03", "{ name:'Marksman Leathers',   icon:'👕', def:40, hp:90,  rarity:'epic', price:4000, cls:'archer',  tier:4, atkPct:0.03,");
  has("gear: Marksman Token atkPct 0.02", "{ name:'Marksman Token',    icon:'🎯', atk:10, def:10, crit:14, speed:0.30, rarity:'epic', price:4000, cls:'archer',  tier:4, atkPct:0.02,");
  has("gear: Thunderbow atkPct 0.07", "{ name:'Thunderbow',             icon:'🏹', atk:138, rarity:'legendary', price:16000, cls:'archer',  tier:7, atkPct:0.07,");
  has("gear: Thunderbow Mantle atkPct 0.07", "{ name:'Thunderbow Mantle',   icon:'🦺', def:95, hp:285, rarity:'legendary', price:16000, cls:'archer',  tier:7, atkPct:0.07,");
  has("gear: Thunderbow Quiver atkPct 0.06", "{ name:'Thunderbow Quiver', icon:'⚡', atk:24, def:28, crit:24, multishot:2, speed:0.42, rarity:'legendary', price:16000, cls:'archer',  tier:7, atkPct:0.06,");
  has("gear: Tempest Longbow atkPct 0.09", "{ name:'Tempest Longbow',         icon:'🏹', atk:188, rarity:'legendary', price:23500, cls:'archer',  tier:8, atkPct:0.09,");
  has("gear: Tempest Hauberk atkPct 0.08", "{ name:'Tempest Hauberk',     icon:'🦺', def:125, hp:360, rarity:'legendary', price:23500, cls:'archer',  tier:8, atkPct:0.08,");
  has("gear: Tempest Bracer atkPct 0.07", "{ name:'Tempest Bracer',    icon:'🌀', atk:30, def:38, crit:28, multishot:2, speed:0.55, rarity:'legendary', price:23500, cls:'archer',  tier:8, atkPct:0.07,");
  for (const o of ["performAround(175, 10, {","performAround(330, 12, {","damage: getAtk() * 2 + 10, owner: 'player', skill: 'shard'","damage: getAtk() * 7 + 40, owner: 'player', skill: 'shard'","performAround(200, 4.4 + stacks","getAtk() * 5 + 20 + stacks * 8","damage: getAtk() * 0.76,","getAtk() * 6 * ramp","getAtk() * 3.5 * (_c ? getCritDmg() : 1)), _c, 'deathBlossom'"]) has('the old literal is gone: ' + o, o, 0);
}
if (process.env.STATIC === '1') { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
// ---- [2] the measurement
// the in-page harness: fair build, seeded RNG, the rotation bot (one decision per sim step), the hit log and its replay
const LIB = () => {
  const R = window.__R = {};
  R.seed = (s) => { let a = s >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shopTier = (lv) => lv >= 88 ? 10 : lv >= 78 ? 9 : lv >= 68 ? 8 : lv >= 55 ? 7 : lv >= 40 ? 6 : lv >= 20 ? 4 : lv >= 10 ? 3 : lv >= 6 ? 2 : 1;
  const pickGear = (cat, cls, lv) => {
    const cap = shopTier(lv);
    const pool = ITEM_POOL[cat].filter((it) => (it.tier | 0) <= cap && (!it.cls || it.cls === 'any' || it.cls === cls));
    if (!pool.length) return null;
    const top = Math.max(...pool.map((p) => p.tier | 0));
    const best = pool.filter((it) => (it.tier | 0) === top); const mine = best.filter((it) => it.cls === cls);
    const chosen = (mine.length ? mine : best).sort((a, b) => itemScore(b) - itemScore(a) || String(a.name).localeCompare(String(b.name)))[0];
    return { ...chosen, slot: _catToSlot(cat) };
  };
  R.kit = (cls, job, master) => Object.keys(SKILLS).filter((id) => { const s = SKILLS[id]; return s && s.cls === cls && (!s.job || s.job === job) && (!s.master || s.master === master); });
  R.build = (cls, job, master, L) => {
    R.seed(4242); if (master) devSetMasterChain(cls, job, master); else devSetJobChain(cls, job);
    if (player.cls !== cls || player.job !== job || (player.master || null) !== (master || null)) throw new Error('build chain failed ' + [player.cls, player.job, player.master]);
    devSetLevel(L);
    player.equipped = { weapon: null, armor: null, accessory: null };
    const gear = [];
    for (const cat of ['weapons', 'armors', 'accessories']) { const g = pickGear(cat, cls, L); if (g) { player.equipped[g.slot] = g; gear.push(g.name + ' T' + g.tier); } }
    player._equipBonusCache = null; refreshGearCache();
    // the class skill tree (11 AP buys all six nodes), then AP 45% ATK / 40% HP / 15% DEF
    player.treeUnlocked = {}; player.tree = player.tree || {}; player._levelUpSpent = {};
    const _toast = window.showToast; window.showToast = () => {};
    try { for (let pass = 0; pass < 3; pass++) for (const n of (SKILL_TREE[cls] || [])) if (canUnlock(n)) unlockTreeNode(n); } finally { window.showToast = _toast; }
    { const ap = player.skillPoints | 0; const want = { atk: Math.floor(ap * 0.45), hp: Math.floor(ap * 0.40), def: Math.floor(ap * 0.15) };
      for (const id in want) { const o = LEVELUP_OPTIONS.find((x) => x.id === id); for (let k = 0; k < want[id]; k++) { player.skillPoints -= o.cost; o.apply(); } } }
    player._equipBonusCache = null;
    // rank points: L-1, round robin master -> job -> base -> basic, cap 10
    const kit = R.kit(cls, job, master); const pri = (id) => { const s = SKILLS[id]; return s.master ? 0 : s.job ? 1 : s.slot === 'd' ? 3 : 2; };
    const order = kit.slice().sort((a, b) => pri(a) - pri(b) || a.localeCompare(b));
    player.skillRanks = {}; let pts = L - 1;
    for (let pass = 0; pass < 10 && pts > 0; pass++) for (const id of order) { if (pts <= 0) break; player.skillRanks[id] = (player.skillRanks[id] | 0) + 1; pts--; }
    player.skillRankPoints = 0;
    player.hp = getMaxHp(); player.mp = getMaxMp();
    return { cls, job, master, L, crit: Math.round(typeof getCrit === 'function' ? getCrit() : 0), acc: Math.round(getAccuracy()), atk: Math.round(getAtk()), hp: getMaxHp(), def: Math.round(typeof getDef === 'function' ? getDef() : 0), gear: gear.join(', '), ranks: JSON.stringify(player.skillRanks), tree: Object.keys(player.treeUnlocked || {}).join(','), apLeft: player.skillPoints };
  };
  R.clean = () => {
    try { game.minions = []; } catch (e) {} for (const k of ['_ballistaTurrets', '_clones', '_hexOrbs', '_necromancerOrbs', '_shade', 'pet', 'pack', 'ultPet', '_aegisOrbs', '_undead']) { try { player[k] = Array.isArray(player[k]) ? [] : null; } catch (e) {} }
    try { game.orbs = []; } catch (e) {} game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0; game.monsters = [];
    player.skillCooldowns = {}; player.buffs = {};
  };
  // a frozen immortal dummy built from a real spawn of `type`; boss: flagged isBoss with the def / eva / level given
  R.dummy = (type, o) => {
    spawnMonster(player.x + 150, player.y, type, false);
    const d = game.monsters[game.monsters.length - 1];
    if (o) { for (const k in o) d[k] = o[k]; }
    d._hp0 = d.maxHp; d.maxHp = d.currentHp = 9e14; d._px = d.x; d._py = d.y; d.vx = 0; d.vy = 0;
    d._wardNextAt = 1e12; d.frozenTimer = 1e9; d.stunTimer = 1e9;
    return d;
  };
  R.pin = () => {
    try { Object.defineProperty(game, 'comboMult', { get: () => 1, set() {}, configurable: true }); } catch (e) {}
    try { Object.defineProperty(game, 'critStreak', { get: () => 0, set() {}, configurable: true }); } catch (e) {}
    player._god = true; player._gravitosCineSeen = true;
  };
  // the bot: first ready skill in b,x,c,q,w,a,s,e, else the basic; a press that left no cooldown is retried after 15 steps
  R.startBot = (d) => {
    const kit = R.kit(player.cls, player.job, player.master);
    const basic = kit.find((id) => SKILLS[id].slot === 'd');
    const order = ['b', 'x', 'c', 'q', 'w', 'a', 's', 'e'].map((sl) => kit.find((id) => SKILLS[id].slot === sl)).filter(Boolean);
    const st = R.st = { d, dealt: 0, by: {}, tags: {}, casts: {}, log: [], depth: 0, t0: game.time, steps: 0, wait: {} };
    const orig = R._origHit || (R._origHit = window.hitMonster);
    window.hitMonster = function (m, dmg, c, tag) {
      const top = st.depth === 0 && m === d; if (top) st.log.push([dmg, !!c, tag, (typeof _lxRankSrc !== 'undefined' && _lxRankSrc) || null]);
      const b = m && m.currentHp; st.depth++;
      try { return orig.apply(this, arguments); } finally {
        st.depth--;
        if (m === d && typeof b === 'number') { const x = Math.max(0, b - m.currentHp); const src = (typeof _lxRankSrc !== 'undefined' && _lxRankSrc) || ('~' + (tag || '?')); st.by[src] = (st.by[src] || 0) + x; st.tags[tag || '?'] = (st.tags[tag || '?'] || 0) + x; }
      }
    };
    R.step = () => {
      st.steps++;
      { const mx = getMaxMp(); if (player.mp < mx * 0.4 && game.time >= (st.potNext | 0)) { player.mp = Math.min(mx, player.mp + mx * 0.5); st.potNext = game.time + 180; st.pots = (st.pots | 0) + 1; } }   // an MP potion (half the bar) at most every 3 s
      player.hp = getMaxHp(); player.hitStun = 0; player.stunTimer = 0;
      const hp0 = 9e14; if (d.currentHp < hp0) { st.dealt += hp0 - d.currentHp; d.currentHp = hp0; }
      d.x = d._px; d.y = d._py; d.vx = 0; d.vy = 0; d.frozenTimer = 1e9; d.stunTimer = 1e9; d._wardNextAt = 1e12;
      if (!game.monsters.includes(d)) game.monsters.push(d);
      const busy = (player._skillLockTimer > 0) || (player._castLockUntil > (game.time || 0)) || (player.dashTimer > 0) || (player.quickDashTimer > 0);
      const cx = d.x + d.w / 2, px = player.x + player.w / 2;
      if (!busy) {
        if (Math.abs(cx - px) > 200 || Math.abs((player.y + player.h) - (d._py + d.h)) > 40 && player.onGround) { player.x = cx - 90 - player.w / 2; player.y = d._py + d.h - player.h; player.vx = 0; player.vy = 0; }
        player.facing = (cx >= player.x + player.w / 2) ? 1 : -1;
      }
      const ready = order.find((id) => !(player.skillCooldowns[id] > 0) && !((st.wait[id] | 0) > game.time));
      const pick = ready || (basic && !(player.skillCooldowns[basic] > 0) && !(player.attackCooldown > 0) ? basic : null);
      if (pick && !(player._skillLockTimer > 0 && pick !== basic)) {
        try { castSkill(pick); st.casts[pick] = (st.casts[pick] || 0) + 1; } catch (e) { st.err = String(e).slice(0, 120); }
        if (pick !== basic && !(player.skillCooldowns[pick] > 0)) st.wait[pick] = game.time + 15;
      }
      if (game.damageNumbers && game.damageNumbers.length > 400) game.damageNumbers.length = 0;
      if (game.particles && game.particles.length > 1500) game.particles.length = 0;
    };
  };
  R.stopBot = () => { R.step = null; window.hitMonster = R._origHit; const st = R.st; const d = st.d; if (d.currentHp < 9e14) { st.dealt += 9e14 - d.currentHp; d.currentHp = 9e14; } return st; };
  // replay the top-level hit log on a dummy built from `type`; returns the HP it lost
  R.replay = (type, seed, o) => {
    const st = R.st; R.clean(); R.seed(seed);
    const m = R.dummy(type, o); m.frozenTimer = 1e9; let lost = 0;
    for (const [dmg, c, tag, rs] of st.log) {
      const b = m.currentHp; try { _lxRankSrc = rs; R._origHit(m, dmg, c, tag); } catch (e) {} finally { _lxRankSrc = null; }
      lost += Math.max(0, b - m.currentHp); m.currentHp = 9e14; m.x = m._px; m.y = m._py;
      if (game.damageNumbers && game.damageNumbers.length > 400) game.damageNumbers.length = 0;
    }
    return { lost, hp: m._hp0, lv: (typeof _mobLevel === "function" ? _mobLevel(m) : m.level), def: m.def, eva: m.evasion };
  };
};
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const measure = async ([cls, job, master], L) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(master + ': ' + String(e.message).slice(0, 140)));
  await page.clock.install();
  await page.goto(`http://localhost:${PORT}/${path.basename(FILE)}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 300000, polling: 500 });
  await page.evaluate(LIB);
  const b = await page.evaluate(({ cls, job, master, L }) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player._tutorialSeen = true;
    const b = __R.build(cls, job, master, L);
    game._worldStateByMap = {}; loadMap('forest', 300);
    const _o = window.loop; window.loop = function (t) { const g0 = game.time; _lxSimOnly = true; try { return _o.apply(this, arguments); } finally { _lxSimOnly = false; if (game.time !== g0 && __R.step) __R.step(); } };
    return b;
  }, { cls, job, master, L });
  await page.clock.pauseAt(Date.now() + 2000).catch(() => {});
  const run = async (ms) => { for (let t = 0; t < ms; t += 1000) await page.clock.runFor(1000); };
  await run(3000);
  await page.evaluate(({ L }) => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; __R.pin(); __R.clean(); __R.seed(12345); window.__d = __R.dummy('slime', { def: 0, evasion: 0, level: L }); }, { L });
  await run(1000);
  await page.evaluate(() => { const d = window.__d; d._px = d.x; d._py = d.y; __R.startBot(d); });
  for (let st = 0; st < SECS * 60;) { await page.clock.runFor(2000); st = await page.evaluate(() => __R.st.steps); }
  const r = await page.evaluate(({ L }) => {
    const st = __R.stopBot(); const secs = st.steps / 60;
    const band = Object.keys(MOB_NATURAL_LEVEL).filter((t) => { const lv = MOB_NATURAL_LEVEL[t], mt = monsterTypes[t]; return mt && !mt.boss && !mt.isBoss && !mt.miniBoss && !mt.isMiniBoss && lv >= L - 5 && lv <= L + 5; }).sort();
    const refLost = __R.replay('slime', 777, { def: 0, evasion: 0, level: L }).lost; const k = st.dealt / Math.max(1, refLost);
    const ttk = band.map((t) => { const q = __R.replay(t, 777); for (let sd = 778; sd < 793; sd++) q.lost += __R.replay(t, sd).lost; q.lost /= 16; return q.hp / Math.max(1, q.lost * k / secs); }).sort((a, b) => a - b);
    const n = ttk.length; return { dps: Math.round(st.dealt / secs), n, ttk: n % 2 ? ttk[(n - 1) / 2] : (ttk[n / 2 - 1] + ttk[n / 2]) / 2, casts: st.casts };
  }, { L });
  await ctx.close();
  return { master, atk: b.atk, ...r };
};
const MAGES = ['sage', 'elementalist', 'necromancer', 'hexmaster', 'archbishop'], MAGES20 = ['archmage', 'warlock', 'priest'], LIFTED = ['shinobi', 'nightreaper', 'phantom'];
const P = { sage: ['mage', 'archmage', 'sage'], elementalist: ['mage', 'archmage', 'elementalist'], necromancer: ['mage', 'warlock', 'necromancer'], hexmaster: ['mage', 'warlock', 'hexmaster'],
  archbishop: ['mage', 'priest', 'archbishop'], shinobi: ['rogue', 'ninja', 'shinobi'], nightreaper: ['rogue', 'assassin', 'nightreaper'], phantom: ['rogue', 'assassin', 'phantom'], marksman: ['archer', 'sniper', 'marksman'],
  archmage: ['mage', 'archmage', null], warlock: ['mage', 'warlock', null], priest: ['mage', 'priest', null], assassin: ['rogue', 'assassin', null] };
const JOBS = []; for (const L of [70, 50]) for (const m of [...MAGES, ...LIFTED, 'marksman']) JOBS.push([m, L]); for (const m of [...MAGES20, 'assassin']) JOBS.push([m, 20]);
const res = {}; let next = 0;
await Promise.all(Array.from({ length: WORKERS }, async () => { while (next < JOBS.length) { const [m, L] = JOBS[next++]; try { res[m + L] = await measure(P[m], L); } catch (e) { res[m + L] = { err: String(e).slice(0, 200) }; } console.log('  measured', m, L, JSON.stringify(res[m + L]).slice(0, 150)); } }));
const medOf = (list, L) => { const t = list.map((m) => res[m + L] && res[m + L].ttk).filter(Number.isFinite).sort((a, b) => a - b); return t.length === list.length ? (t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2) : NaN; };
const med = { 70: medOf(MAGES, 70), 50: medOf(MAGES, 50), 20: medOf(MAGES20, 20) };
ok('[2-setup] every path measured on its full band (Lv 70, 50, 20)', JOBS.every(([m, L]) => res[m + L] && Number.isFinite(res[m + L].ttk) && res[m + L].n >= 6), Object.fromEntries(JOBS.map(([m, L]) => [m + L, res[m + L] && (res[m + L].err || res[m + L].n)])));
const x = (m, L) => res[m + L] && res[m + L].ttk / med[L];
for (const m of LIFTED) ok(`[2] ${m}: Lv 70 time-to-kill about 1.5x of the median mage master's (${med[70].toFixed(2)} s) or better`, x(m, 70) <= 1.6, { x: +(x(m, 70) || 0).toFixed(2) });
ok(`[2] assassin job: Lv 20 time-to-kill about 1.5x of the median mage job's (${med[20].toFixed(2)} s) or better`, x('assassin', 20) <= 1.7, { x: +(x('assassin', 20) || 0).toFixed(2) });   // Lv 20 TTKs are ~0.1 s, so one run swings more than at Lv 70
for (const m of [...LIFTED, 'marksman']) ok(`[2] ${m}: not faster than the median mage at Lv 50 (${med[50].toFixed(2)} s)`, x(m, 50) >= 0.92, { x: +(x(m, 50) || 0).toFixed(2) });
ok('[2] assassin job: not faster than the median mage job at Lv 20', x('assassin', 20) >= 0.92, { x: +(x('assassin', 20) || 0).toFixed(2) });
ok('[2] Marksman: not faster than the median mage at Lv 70', x('marksman', 70) >= 0.92, { x: +(x('marksman', 70) || 0).toFixed(2) });
ok('[2] no page errors', errs.length === 0, errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
