// STAT SETS (per user, 2026-10-03: "create a few tier 4 - 8 equipments ... focus on different themes and focus on different stats",
// "Yes lets do all"): five sets, one per tier - Galecrest T4 speed/dodge, Sunderer T5 armour pierce, Heartwood T6 sustain, Razorglass T7
// crit damage, Granitehorn T8 DEF. Any class wears them (a weapon per class, cls 'any' armour + accessory, cls 'any' set bonus).
//   [1] the 30 pieces exist with their tiers and classes; every weapon/armour is on-hero art with a Gear Align row, every piece has its
//       inventory icon, every icon and set emblem loads, the five bows have string rows and string-free worn art
//   [2] the set bonus works for every class (2 + 3 pieces, each class wearing its own weapon)
//   [3] armour pierce: printed in the tooltip, softened by stars like every % stat; set-bonus text has labels (no raw "HPPCT")
//   [4] Tailwind: after a dodge, +30% move speed and the next hit lands for +25%, once
//   [5] Fault Line: hits on one foe crack its DEF a step at a time up to five steps, and only with the set
//   [6] Regrowth: under 30% HP the equipment regen triples, with its one-minute cooldown
//   [7] Shatter: a killing crit hits the nearest foe; a plain kill or no set does not
//   [8] Immovable: standing still, no knockback and +2% DEF a hit up to +10%; moving, neither
//   [9] home zones: a set's pieces drop about three times as often in its home zone (Granitehorn: from Taur)
//   [10] no page errors
// The build before fails [1]-[9].   node scripts/stat_sets_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11931);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const REFS = { galecrest_saber: 'steel_blade', galecrest_kunai: 'nightshade_kunai', galecrest_rod: 'apprentice_wand', galecrest_bow: 'hunters_shortbow', sunderer_warpick: 'crusader_mace',
  sunderer_stiletto: 'assassins_edge', sunderer_forge_rod: 'crystal_scepter', sunderer_warbow: 'marksmans_compound', heartwood_warclub: 'berserker_cleaver', heartwood_thornknife: 'oblivion_whisper',
  heartwood_staff: 'voidcaller_staff', heartwood_bow: 'falcon_recurve', razorglass_claymore: 'warlord_blade', razorglass_shiv: 'spectre_fangs', razorglass_prism_staff: 'sorcerers_focus',
  razorglass_recurve: 'skyhunter_longbow', granitehorn_warhammer: 'cataclysm_maul', granitehorn_tusk: 'assassins_edge', granitehorn_monolith: 'nebula_staff', granitehorn_greatbow: 'thunderbow' };
const AREFS = { galecrest_featherweave: 'marksman_leathers', sunderer_forgeplate: 'warlord_cuirass', heartwood_barkmail: 'dragon_scale', razorglass_shardmail: 'tempest_hauberk', granitehorn_plate: 'plate_armor' };
try {
  const errs = [];
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  const rel = path.relative(ROOT, path.isAbsolute(PAGE) ? PAGE : path.join(ROOT, PAGE)).split(path.sep).join('/');
  await page.goto(`http://127.0.0.1:${PORT}/${rel}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof hitMonster === 'function' && typeof ITEM_POOL === 'object' && typeof loadMap === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async ({ REFS, AREFS }) => {
    const out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window._lxBootGateDone = true; try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
    const IDS = ['galecrest', 'sunderer', 'heartwood', 'razorglass', 'granitehorn'], TIER = { galecrest: 4, sunderer: 5, heartwood: 6, razorglass: 7, granitehorn: 8 };
    const all = [...ITEM_POOL.weapons.map((b) => ({ ...b, slot: 'weapon', cat: 'weapons' })), ...ITEM_POOL.armors.map((b) => ({ ...b, slot: 'armor', cat: 'armors' })), ...ITEM_POOL.accessories.map((b) => ({ ...b, slot: 'accessory', cat: 'accessories' }))];
    const mine = all.filter((b) => IDS.includes(b.setId));
    // [1] data, art, wiring
    const d = { n: mine.length, bad: [] };
    for (const id of IDS) { const S = mine.filter((b) => b.setId === id); const w = S.filter((b) => b.slot === 'weapon');
      if (S.length !== 6 || w.length !== 4 || ['warrior', 'rogue', 'mage', 'archer'].some((c) => !w.find((b) => b.cls === c)) || S.some((b) => b.tier !== TIER[id] || (b.slot !== 'weapon' && b.cls !== 'any'))) d.bad.push('set ' + id);
      if (!(typeof SETS === 'object' && SETS[id] && SETS[id].cls === 'any' && SETS[id].bonus2 && SETS[id].bonus3 && SETS[id].sig)) d.bad.push('SETS ' + id); }
    const CAL = window.LX_EQ_ATTACH_DATA || {}, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const b of mine) { const k = _itemKey(b);
      if (b.slot !== 'accessory') { const sid = (b.slot === 'weapon' ? 'wpn:' : 'arm:') + k;
        if (!LX_EQUIP_FILES[b.cat].includes(k)) d.bad.push('files ' + k);
        const ref = (b.slot === 'weapon' ? 'wpn:' + REFS[k] : 'arm:' + AREFS[k]); if (!CAL[sid] || !same(CAL[sid], CAL[ref])) d.bad.push('calib ' + k); }
      if (typeof LX_ITEMS['_pending_' + k] !== 'object' || !LX_ITEMS['_pending_' + k]) d.bad.push('icon ' + k); }
    for (const id of ['galecrest_bow', 'sunderer_warbow', 'heartwood_bow', 'razorglass_recurve', 'granitehorn_greatbow']) {
      if (!_LX_BOW_STRING['wpn:' + id] || !(window.LX_EQ_ERASE_DATA || {})['wpn:' + id]) d.bad.push('bow ' + id); }
    const load = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im.naturalWidth > 0); im.onerror = () => r(false); im.src = src; });
    const srcs = mine.map((b) => 'Sprites/equipment/' + b.cat + '/' + _itemKey(b) + '.webp').concat(IDS.map((id) => 'Sprites/ui/sets/' + id + '.webp'));
    const loaded = await Promise.all(srcs.map(load)); srcs.forEach((s, i) => { if (!loaded[i]) d.bad.push('load ' + s); });
    out.data = d;
    if (d.n !== 30) return out;
    // a fight-ready hero on a quiet map
    loadMap('forest'); player.level = 60; game.paused = false; player._god = false;
    const kit = (id, cls) => ({ weapon: { ...mine.find((b) => b.setId === id && b.slot === 'weapon' && b.cls === cls) }, armor: { ...mine.find((b) => b.setId === id && b.slot === 'armor') }, accessory: { ...mine.find((b) => b.setId === id && b.slot === 'accessory') } });
    const wear = (eq) => { player.equipped = eq; if (typeof refreshGearCache === 'function') refreshGearCache(); };
    const bare = () => wear({ weapon: null, armor: null, accessory: null });
    // [2] every class gets the bonus
    out.cls = [];
    for (const id of IDS) for (const cls of ['warrior', 'rogue', 'mage', 'archer']) { player.cls = cls; wear(kit(id, cls)); const S = SETS[id];
      for (const k of new Set([...Object.keys(S.bonus2), ...Object.keys(S.bonus3)])) { const want = (S.bonus2[k] || 0) + (S.bonus3[k] || 0), got = getSetBonus(k);
        if (Math.abs(got - want) > 1e-9) out.cls.push(id + '/' + cls + '/' + k); } }
    player.cls = 'warrior';
    return out;
  }, { REFS, AREFS }).catch((e) => ({ err: String(e.message || e).slice(0, 300) }));
  if (R.err) throw new Error(R.err);
  ok('[1] 30 pieces in five sets; on-hero art + Gear Align rows (the redesigned piece\'s row); icons; emblems; bow strings + worn bows', R.data.n === 30 && !R.data.bad.length, R.data);
  ok('[2] the set bonus works for every class', R.cls && !R.cls.length, R.cls);
  const M = await page.evaluate(async () => {
    const out = {}, IDS = ['galecrest', 'sunderer', 'heartwood', 'razorglass', 'granitehorn'];
    if (typeof SETS !== 'object' || IDS.some((id) => !SETS[id]) || typeof _lxSetSig !== 'function') return { missing: true };   // the build before
    const all = [...ITEM_POOL.weapons.map((b) => ({ ...b, slot: 'weapon' })), ...ITEM_POOL.armors.map((b) => ({ ...b, slot: 'armor' })), ...ITEM_POOL.accessories.map((b) => ({ ...b, slot: 'accessory' }))];
    const mine = all.filter((b) => IDS.includes(b.setId));
    const kit = (id, cls) => ({ weapon: { ...mine.find((b) => b.setId === id && b.slot === 'weapon' && b.cls === cls) }, armor: { ...mine.find((b) => b.setId === id && b.slot === 'armor') }, accessory: { ...mine.find((b) => b.setId === id && b.slot === 'accessory') } });
    const wear = (eq) => { player.equipped = eq; if (typeof refreshGearCache === 'function') refreshGearCache(); };
    const bare = () => wear({ weapon: null, armor: null, accessory: null });
    const SIG = window._lxSetSig, sigOff = () => { window._lxSetSig = () => false; }, sigOn = () => { window._lxSetSig = SIG; };
    const pin = () => { try { game.comboMult = 1; game.combo = 0; game.comboTimer = 0; } catch (e) {} };
    const twins = () => { for (const q of (game.monsters || [])) q.currentHp = 0; game.monsters.length = 0; spawnMonster(700, 300, 'kingKrook', false, false); spawnMonster(760, 300, 'kingKrook', false, false);
      for (const m of game.monsters) { m.maxHp = m.currentHp = 1e12; m._defVar = 1; m.evasion = 0; m.level = player.level; m.def = 0; } return game.monsters.slice(0, 2); };
    const hit = (m, dmg, crit) => { pin(); const b4 = m.currentHp; hitMonster(m, dmg, !!crit); return b4 - m.currentHp; };
    // [3] armour pierce
    const pi = { name: 'Pierce Probe', icon: '⛏️', slot: 'accessory', cls: 'any', tier: 5, defPierce: 0.10, stars: 10, rarity: 'legendary' };
    bare(); wear({ weapon: null, armor: null, accessory: pi });
    const mul = _starStatMult(pi, 'defPierce');
    out.pierce = { got: getEquipBonus('defPierce'), soft: 0.10 * (1 + (mul - 1) * 0.35) * _tierPctMul(5), full: 0.10 * mul, tip: String(itemStatString({ ...pi, stars: 0 }, true)).includes('Armour pierce'),
      fmt: ['heartwood:bonus3', 'sunderer:bonus2', 'doomforged:bonus3', 'shadowweave:bonus2', 'granitehorn:bonus3'].map((p) => { const [s, b] = p.split(':'); return _setBonusFmt(SETS[s][b]); }).join(' | ') };
    // [4] Tailwind
    player.cls = 'rogue'; bare(); wear(kit('galecrest', 'rogue')); player._tailwindUntil = 0; player._tailwindHit = 0; player._slowTimer = 0;
    const s0 = getSpeed(); _lxOnPlayerDodge(); const s1 = getSpeed(); player._tailwindHit = 0;
    let [A] = twins(); hit(A, 20000); const c1 = hit(A, 20000); _lxOnPlayerDodge(); const h = hit(A, 20000), c2 = hit(A, 20000);
    sigOff(); player._tailwindUntil = 0; player._tailwindHit = 0; _lxOnPlayerDodge(); const noSet = player._tailwindUntil | 0; sigOn();
    out.tail = { s0, s1, c1, h, c2, noSet };
    // [5] Fault Line: the same seven hits with the signature on and off, on fresh twins with DEF
    player.cls = 'warrior'; bare(); wear(kit('sunderer', 'warrior'));
    const seven = () => { const [F] = twins(); F.def = 400; const r = []; for (let i = 0; i < 7; i++) r.push(hit(F, 20000)); return r; };
    const on = seven(); sigOff(); const offR = seven(); sigOn();
    out.fault = on.map((v, i) => +(v / offR[i]).toFixed(4));
    // [6] Regrowth: one regen tick under 30% HP, with and without the signature
    player.cls = 'mage'; bare(); wear(kit('heartwood', 'mage')); for (const q of game.monsters) q.currentHp = 0; game.monsters.length = 0;
    const mh = getMaxHp(), tick = (t) => { player.hp = Math.floor(mh * 0.2); game.time = t; player.hitStun = 0; player.frozenTimer = 0; player.stunTimer = 0; player._downed = false; /* the update returns before the regen while any of these is up */ player._hpEqAcc = 990; player._hpBaseAcc = 0; /* v0.30.x bughunt timers-6: the regen is a dt accumulator now - arm it so one update crosses the second */ const b4 = player.hp; updatePlayer(16.67); return player.hp - b4; };
    player._regrowthUntil = 0; player._regrowthCd = 0; const gOn = tick(6000), cd = player._regrowthCd | 0, until = player._regrowthUntil | 0;
    const gCool = tick(6600); const reArm = (player._regrowthCd | 0) !== cd;
    sigOff(); player._regrowthUntil = 0; player._regrowthCd = 0; const gOff = tick(6000); sigOn();
    out.regrow = { gOn, gOff, hpR: getEquipBonus('hpRegen'), cd, until, gCool, reArm };
    // [7] Shatter
    player.cls = 'warrior'; bare(); wear(kit('razorglass', 'warrior'));
    const shat = (crit) => { const [S1, S2] = twins(); S1.currentHp = 50; const b = S2.currentHp; hit(S1, 5000, crit); return b - S2.currentHp; };
    const crit = shat(true), plain = shat(false); sigOff(); const noset = shat(true); sigOn();
    out.shatter = { crit, plain, noset };
    // [8] Immovable
    player.cls = 'archer'; bare(); wear(kit('granitehorn', 'archer')); player._graniteUntil = 0; player._graniteN = 0; player.onGround = true; player.vx = 0;
    const kStill = _lxKbTaken(); player.vx = 3; const kMove = _lxKbTaken(); player.vx = 0;
    const d0 = getDef(); for (let i = 0; i < 7; i++) _lxLost(10); const d1 = getDef();
    player._graniteUntil = 0; player._graniteN = 0; player.vx = 3; for (let i = 0; i < 3; i++) _lxLost(10); const moving = player._graniteN | 0; player.vx = 0; player._graniteUntil = 0;
    out.immov = { kStill, kMove, d0, d1, moving };
    // [9] home zones: Razorglass weapons from the same seeded boss rolls in Glasswind Steppe and in the forest
    const R0 = Math.random; let sd = 12345; Math.random = () => ((sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648);
    const roll = (map) => { game.currentMap = map; let c = 0; for (let i = 0; i < 3000; i++) { const it = rollItemDrop(2, 65, 'weapons', null, 7, null); if (it && it.setId === 'razorglass') c++; } return c; };
    const inHome = roll('glasswindSteppe'); sd = 12345; const away = roll('forest'); Math.random = R0;
    out.home = { inHome, away, taur: _lxSetHome('granitehorn', { type: 'zodiac_taurus' }), krook: _lxSetHome('granitehorn', { type: 'kingKrook' }) };
    bare(); return out;
  }).catch((e) => ({ err: String(e.message || e).slice(0, 300) }));
  if (M.err) throw new Error(M.err);
  const P = M.pierce || {}, near = (a, b, t) => Math.abs(a - b) <= t;
  ok('[3] armour pierce is softened by stars like every % stat, printed in tooltips, and set-bonus text is labelled',
    near(P.got, P.soft, 1e-6) && P.got < P.full && P.tip && /% Max HP/.test(P.fmt) && /HP\/s/.test(P.fmt) && /% Lifesteal/.test(P.fmt) && /% Armour pierce/.test(P.fmt) && /% Thorns/.test(P.fmt) && !/HPPCT|LIFESTEAL|DEFPIERCE|HPREGEN|THORNS/.test(P.fmt), P);
  const T = M.tail || {};
  ok('[4] Tailwind: a dodge gives +30% speed and +25% on the next hit only; nothing without the set',
    near(T.s1 / T.s0, 1.3, 0.01) && near(T.h / T.c1, 1.25, 0.01) && near(T.c2 / T.c1, 1, 0.005) && T.noSet === 0, T);
  const F = M.fault || [];
  ok('[5] Fault Line: each hit cracks the DEF a step further, five steps at most',
    near(F[0], 1, 0.005) && F.slice(0, 6).every((v, i) => i === 0 || v > F[i - 1]) && near(F[6], F[5], 0.005) && F[5] > 1.03, F);
  const G = M.regrow || {};
  ok('[6] Regrowth: under 30% HP the equipment regen triples once a minute', G.hpR > 0 && near(G.gOn - G.gOff, 2 * G.hpR, 1.01) && G.until === 6300 && G.cd === 9600 && !G.reArm, G);
  const S = M.shatter || {};
  ok('[7] Shatter: a killing crit hits the nearest foe; a plain kill or no set does not', S.crit > 0 && S.plain === 0 && S.noset === 0, S);
  const I = M.immov || {};
  ok('[8] Immovable: standing still there is no knockback and DEF climbs 2% a hit to +10%; moving, neither', I.kStill === 0 && I.kMove > 0 && near(I.d1 / I.d0, 1.10, 0.01) && I.moving === 0, I);
  const H = M.home || {};
  ok('[9] home zones: about three times the drops at home; Granitehorn comes from Taur', H.away > 0 && H.inHome / H.away >= 2 && H.inHome / H.away <= 4 && H.taur === true && H.krook === false, H);
  ok('[10] no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
