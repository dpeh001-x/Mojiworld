// Gear role weights and caps (v0.30.430). Per user: "reducing and capping the buffs by equipments — each equipment
// gives way too much crit %; the flat attack increase by weapons should be slightly lowered; armor should add lesser
// ATK, focus more on DEF and HP; also increase the cost of enhancement".
// Everything is read through getEquipBonus (what combat pays) and itemStatString (what the card prints), with probe
// items in real slots, then with the three pieces from the user's report at 10 stars on a Lv 99 mage.
//   node scripts/gear_role_caps_test.mjs      MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree
// Negative control: v0.30.428 pays 20 crit a slot, prints "+84% Crit" for a piece that pays 20, and forges at the old prices.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10251); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const near = (a, b, t) => typeof a === 'number' && Math.abs(a - b) <= (t == null ? 0.01 : t);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof getEquipBonus === 'function' && typeof itemStatString === 'function' && typeof ITEM_POOL === 'object' && typeof STAR_COSTS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    o.k = { crit: (typeof LX_EQUIP_CRIT_CAP_PER_ITEM !== 'undefined') ? LX_EQUIP_CRIT_CAP_PER_ITEM : null, wAtk: (typeof LX_WEAPON_ATK_MUL !== 'undefined') ? LX_WEAPON_ATK_MUL : null, armor: (typeof LX_ARMOR_ROLE !== 'undefined') ? LX_ARMOR_ROLE : null, atkPct: (typeof LX_EQUIP_ATKPCT_CAP_PER_ITEM !== 'undefined') ? LX_EQUIP_ATKPCT_CAP_PER_ITEM : null, costs: STAR_COSTS.slice() };
    player.cls = 'mage'; player.level = 99; player.mods.crit = 0; player.mods.atkPct = 0; player.mods.atk = 0;
    const pay = (eq, k) => { player.equipped = { weapon: null, armor: null, accessory: null }; Object.assign(player.equipped, eq); refreshGearCache(); return +(getEquipBonus(k) || 0).toFixed(4); };
    const strip = (h) => String(h).replace(/<[^>]*>/g, '');
    // tier-1 probes (tier x2 on flat stats), class-neutral, no stars: the role weight and caps are the only variables
    const W = { name: 'w', slot: 'weapon', tier: 1, atk: 100, crit: 30, atkPct: 0.5 }, A = { name: 'a', slot: 'armor', tier: 1, atk: 100, def: 100, hp: 100, atkPct: 0.2 }, C = { name: 'c', slot: 'accessory', tier: 1, atk: 100, def: 100, hp: 100, atkPct: 0.1 };
    o.probe = { wAtk: pay({ weapon: W }, 'atk'), cAtk: pay({ accessory: C }, 'atk'), aAtk: pay({ armor: A }, 'atk'), aDef: pay({ armor: A }, 'def'), aHp: pay({ armor: A }, 'hp'), aAtkPct: pay({ armor: A }, 'atkPct'), cDef: pay({ accessory: C }, 'def'), cAtkPct: pay({ accessory: C }, 'atkPct'), wCrit: pay({ weapon: W }, 'crit'), wAtkPct: pay({ weapon: W }, 'atkPct'), threeCrit: pay({ weapon: W, armor: { ...A, crit: 999 }, accessory: { ...C, crit: 999 } }, 'crit') };
    o.cards = { w: strip(itemStatString(W)), a: strip(itemStatString(A)), c: strip(itemStatString(C)) };
    // the report's three pieces, 10 stars, with their affixes, on the class they belong to
    const pool = [].concat(ITEM_POOL.weapons || [], ITEM_POOL.armors || [], ITEM_POOL.accessories || []); const base = (n) => JSON.parse(JSON.stringify(pool.find((x) => x.name === n)));
    const wand = Object.assign(base('Cosmic Wand'), { slot: 'weapon', stars: 10, crit: 22 + 6, speed: 0.3, xpBoost: 0.10 });
    const vest = Object.assign(base('Stardust Vestments'), { slot: 'armor', stars: 10, atkPct: 0.14 + 0.09, mp: 140 });
    const codex = Object.assign(base('Nebula Codex'), { slot: 'accessory', stars: 10, atk: 38, crit: 33, hp: 80, accuracy: 60, greed: 0.15 });
    o.report = { wandAtk: pay({ weapon: wand }, 'atk'), wandCrit: pay({ weapon: wand }, 'crit'), vestAtkPct: pay({ armor: vest }, 'atkPct'), vestDef: pay({ armor: vest }, 'def'), vestHp: pay({ armor: vest }, 'hp'), codexCrit: pay({ accessory: codex }, 'crit'), allCrit: pay({ weapon: wand, armor: vest, accessory: codex }, 'crit'), allAtkPct: pay({ weapon: wand, armor: vest, accessory: codex }, 'atkPct'), allAtk: pay({ weapon: wand, armor: vest, accessory: codex }, 'atk'), getCrit: getCrit(), cards: { wand: strip(itemStatString(wand)), vest: strip(itemStatString(vest)), codex: strip(itemStatString(codex)) } };
    player.equipped = { weapon: null, armor: null, accessory: null }; refreshGearCache();
    return o;
  });
  const K = r.k; console.log('build ' + r.ver + ' ' + JSON.stringify(K));
  ok('the constants: crit cap 12 a piece, weapon ATK x0.85, armor {atk 0.4, atkPct 0.5, def 1.15, hp 1.15}, % ATK cap 15% a piece', K.crit === 12 && K.wAtk === 0.85 && K.armor && K.armor.atk === 0.4 && K.armor.atkPct === 0.5 && K.armor.def === 1.15 && K.armor.hp === 1.15 && K.atkPct === 0.15, JSON.stringify(K));
  ok('a weapon\'s flat ATK pays 85% (100 x tier 2 x 0.85 = 170); an accessory\'s the full 200', near(r.probe.wAtk, 170) && near(r.probe.cAtk, 200), JSON.stringify(r.probe));
  ok('armour pays 40% of its flat ATK (80), half its % ATK (10%), and 115% of its DEF and HP (230)', near(r.probe.aAtk, 80) && near(r.probe.aAtkPct, 0.10) && near(r.probe.aDef, 230) && near(r.probe.aHp, 230) && near(r.probe.cDef, 200) && near(r.probe.cAtkPct, 0.10), JSON.stringify(r.probe));
  ok('crit is capped at 12 a piece (30 x 2 = 60 pays 12; three capped slots pay 36) and % ATK at 15% (50% pays 15%)', near(r.probe.wCrit, 12) && near(r.probe.threeCrit, 36) && near(r.probe.wAtkPct, 0.15), JSON.stringify(r.probe));
  ok('the card prints what is paid: weapon "+170 ATK" and "+12% Crit (cap)"; armour "+80 ATK", "+230 DEF", "+230 HP", "+10% ATK"', /\+170 ATK/.test(r.cards.w) && /\+12% Crit \(cap\)/.test(r.cards.w) && /\+15% ATK \(cap\)/.test(r.cards.w) && /\+80 ATK/.test(r.cards.a) && /\+230 DEF/.test(r.cards.a) && /\+230 HP/.test(r.cards.a) && /\+10% ATK/.test(r.cards.a) && /\+200 ATK/.test(r.cards.c), JSON.stringify(r.cards));
  ok('the report\'s three pieces at 10 stars: gear crit 36 (was 60), % ATK 45% (was 132%), getCrit under 45', near(r.report.allCrit, 36) && near(r.report.allAtkPct, 0.45) && r.report.getCrit <= 45, JSON.stringify({ allCrit: r.report.allCrit, allAtkPct: r.report.allAtkPct, getCrit: r.report.getCrit }));
  ok('the Cosmic Wand pays 85% of its old flat ATK (about 6,080, was 7,151) and its card no longer says +84% Crit', r.report.wandAtk > 5900 && r.report.wandAtk < 6300 && /\+12% Crit \(cap\)/.test(r.report.cards.wand), 'wand ATK ' + r.report.wandAtk + ' | ' + r.report.cards.wand);
  ok('the Stardust Vestments pay 15% ATK (capped; was 45%) and 15% more DEF and HP', near(r.report.vestAtkPct, 0.15) && r.report.vestDef > 640 && r.report.vestDef < 680 && r.report.vestHp > 1680 && r.report.vestHp < 1740, JSON.stringify({ atkPct: r.report.vestAtkPct, def: r.report.vestDef, hp: r.report.vestHp }));
  ok('every forge rung costs 1.5x (130/500/1300/3100/7000/15300/23000/32000/44600/64000)', JSON.stringify(K.costs) === JSON.stringify([130, 500, 1300, 3100, 7000, 15300, 23000, 32000, 44600, 64000]), JSON.stringify(K.costs));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
