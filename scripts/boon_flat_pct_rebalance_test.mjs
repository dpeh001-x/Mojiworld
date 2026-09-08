// Boon rebalance (v0.30.427): the flat-stat boons are the significant ones; % ATK rolls 1-10%.
// Per user: "flat increase in stats boon such as keen edge, need to buff them up to make them relevant and
// significant. whereas for % ATK need to change it to 1-10%".
// Asserts against the live build: the Iron Muscles roll (2000 draws at Lv 90, and Bravo's god roll) never leaves
// 1..10 and its card reads "+N% ATK"; the Keen Edge / Thick Skin level bands are the new ones; and, on the game's
// own getAtk() for an ungeared Lv 60 warrior, a max Keen Edge is worth at least three max Iron Muscles and at
// least +80% ATK, while a max Iron Muscles is exactly +10%.
//   node scripts/boon_flat_pct_rebalance_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree
// Negative control: v0.30.426 rolls Iron Muscles 10-25 and Keen Edge tops out at +73 at Lv 60.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10241); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof POWERUPS === 'object' && typeof getAtk === 'function' && typeof rollMaxBoonInstance === 'function' && typeof _applyEquippedBoons === 'function', null, { timeout: 180000 }); await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const P = (id) => POWERUPS.find((p) => p.id === id); const pct = P('atk_p'), keen = P('atk'), thick = P('def');
    o.table = { atk_p: [pct.min, pct.max], atk: [keen.min, keen.max], def: [thick.min, thick.max] };
    // the % roll at Lv 90: 2000 draws, and Bravo's god roll
    player.level = 90; const rolls = []; for (let i = 0; i < 2000; i++) rolls.push(_rollBoonValue(pct));
    o.pctRolls = { min: Math.min(...rolls), max: Math.max(...rolls), bravo: rollMaxBoonInstance('atk_p').roll, card: pct.fmt(rollMaxBoonInstance('atk_p').roll), cardMin: pct.fmt(pct.min) };
    // the flat bands per level (what the card shows and what the roll is drawn from)
    o.bands = {}; for (const lv of [30, 60, 90]) { player.level = lv; o.bands[lv] = { keen: _boonBand(keen), thick: _boonBand(thick), keenText: _boonRangeText(keen) }; }
    // an ungeared Lv 60 warrior, built the way boon_balance_test builds one; a max roll of each boon through the real stat pipeline
    const LV = 60; player.cls = 'warrior'; player.level = LV; player.job = null; player.master = null; player.equipment = {}; const c = CLASSES.warrior, n = LV - 1;
    player.baseAtk = c.stats.atk + n * 3; player.baseDef = c.stats.def + n * 2; player.maxHp = c.stats.hp + n * 30; player.hp = player.maxHp; player.inRage = false; player.buffs = player.buffs || {};
    const equip = (...ids) => { player.boons = ids.map((i) => rollMaxBoonInstance(i)); player.boonsEquipped = ids.map((_, i) => i); _applyEquippedBoons(); };
    equip(); const base = getAtk(); equip('atk'); const withKeen = getAtk(); equip('atk_p'); const withIron = getAtk(); equip();
    o.atk = { base, keenGain: withKeen - base, ironGain: withIron - base, keenPct: +(((withKeen - base) / base) * 100).toFixed(1), ironPct: +(((withIron - base) / base) * 100).toFixed(1) };
    return o;
  });
  console.log('build ' + r.ver + ' table ' + JSON.stringify(r.table) + ' Lv60 warrior ATK ' + r.atk.base);
  ok('Iron Muscles rolls 1-10% (table 1..10; 2000 rolls at Lv 90 inside it; Bravo\'s god roll is +10%)', r.table.atk_p[0] === 1 && r.table.atk_p[1] === 10 && r.pctRolls.min >= 1 && r.pctRolls.max <= 10 && r.pctRolls.bravo === 10, JSON.stringify(r.pctRolls));
  ok('the Iron Muscles card reads "+N% ATK" in the new range', r.pctRolls.card === '+10% ATK' && r.pctRolls.cardMin === '+1% ATK', r.pctRolls.card + ' / ' + r.pctRolls.cardMin);
  ok('Keen Edge tops out at +300 and its level bands read Lv 30 50-100, Lv 60 100-200, Lv 90 150-300', r.table.atk[1] === 300 && r.bands[30].keen.lo === 50 && r.bands[30].keen.hi === 100 && r.bands[60].keen.lo === 100 && r.bands[60].keen.hi === 200 && r.bands[90].keen.lo === 150 && r.bands[90].keen.hi === 300 && /150.{1,3}300/.test(r.bands[90].keenText), JSON.stringify(r.bands));
  ok('Thick Skin tops out at +400 (Lv 60 band 133-266, Lv 90 200-400)', r.table.def[1] === 400 && r.bands[60].thick.lo === 133 && r.bands[60].thick.hi === 266 && r.bands[90].thick.lo === 200 && r.bands[90].thick.hi === 400, JSON.stringify(r.bands[60].thick) + ' ' + JSON.stringify(r.bands[90].thick));
  ok('on a Lv 60 warrior a max Keen Edge is worth at least 3 max Iron Muscles and at least +80% ATK; Iron Muscles is +10%', r.atk.keenGain >= 3 * r.atk.ironGain && r.atk.keenPct >= 80 && r.atk.ironPct >= 9.5 && r.atk.ironPct <= 10.5, JSON.stringify(r.atk));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
