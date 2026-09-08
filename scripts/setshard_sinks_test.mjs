// Setshard sinks (v0.30.431). Per user: "Craft a T5 weapon or armour 3,500 + 50,000 coins; T6 5,000 + 100,000; Transcend
// 8,000; Reforge 2,000; Talent respec = flat 1500". Read through the functions the UI and the gates call (_craftCostFor,
// TRANSCEND_COST, REFORGE_COST, _lxRespecCost) and through the real gates: a reforge with one shard short is refused and
// with exactly the price is paid; the help panel, the shard tooltip and Brok's menu quote the new numbers.
//   node scripts/setshard_sinks_test.mjs      MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree
// Negative control: v0.30.430 crafts at 1,000 / 2,000, transcends at 4,000, reforges at 500 and respecs on a level curve.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10261); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _craftCostFor === 'function' && typeof _lxRespecCost === 'function' && typeof TRANSCEND_COST === 'number' && typeof REFORGE_COST === 'number' && typeof _reforgeApply === 'function', null, { timeout: 180000 }); await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    o.craft5 = _craftCostFor({ tier: 5 }); o.craft6 = _craftCostFor({ tier: 6 }); o.transcend = TRANSCEND_COST; o.reforge = REFORGE_COST;
    o.respec = [10, 30, 50, 66, 80, 99].map((l) => _lxRespecCost(l));
    // the reforge gate through the real apply path: one shard short is refused, the exact price is paid
    player.level = 99; const w = { name: 'Sharp Probe Blade', baseName: 'Probe Blade', slot: 'weapon', tier: 6, atk: 104, stars: 3, dropLevel: 60, rarity: 'rare', affixes: ['sharp'] }; player.equipped = { weapon: w, armor: null, accessory: null }; refreshGearCache();   // _reforgeWhy: Lv 50+ and rolled affixes
    player.setshards = REFORGE_COST - 1; const short = await _reforgeApply({ slot: 'weapon', item: w }); o.reforgeShort = { refused: !short, left: player.setshards };   // async: the gate returns null
    player.setshards = REFORGE_COST; const paid = await _reforgeApply({ slot: 'weapon', item: w }); o.reforgePaid = { done: !!paid, left: player.setshards, starsKept: paid ? paid.stars : null };
    // the texts a player reads
    const html = document.body.innerHTML;
    o.help = { craft: /3,?500◈|3500◈/.test(html) && /5,?000◈|5000◈/.test(html), reforge: /2,?000◈ per reforge|2000◈ per reforge|Reforge Bench \(2,?000◈\)|Reforge Bench \(2000◈\)/.test(html), old: /Reforge Bench \(500◈\)|500◈ per reforge|\(1000◈\), Reforge/.test(html) };
    const tip = (document.querySelector('.stat-item.shard-item') || {}).title || ''; o.tooltip = tip;
    return o;
  });
  console.log('build ' + r.ver + ' craft ' + JSON.stringify(r.craft5) + ' / ' + JSON.stringify(r.craft6) + ' transcend ' + r.transcend + ' reforge ' + r.reforge + ' respec ' + JSON.stringify(r.respec));
  ok('craft T5 costs 3,500 ◈ + 50,000 coins; T6 5,000 ◈ + 100,000 coins', r.craft5 && r.craft5.shards === 3500 && r.craft5.coins === 50000 && r.craft6 && r.craft6.shards === 5000 && r.craft6.coins === 100000, JSON.stringify([r.craft5, r.craft6]));
  ok('transcend costs 8,000 ◈', r.transcend === 8000, String(r.transcend));
  ok('reforge costs 2,000 ◈', r.reforge === 2000, String(r.reforge));
  ok('respec is a flat 1,500 ◈ at every level', r.respec.every((v) => v === 1500), JSON.stringify(r.respec));
  ok('the reforge gate is real: 1,999 ◈ is refused and keeps its shards; 2,000 ◈ pays, leaves 0 and keeps the stars', r.reforgeShort.refused && r.reforgeShort.left === 1999 && r.reforgePaid.done && r.reforgePaid.left === 0 && r.reforgePaid.starsKept === 3, JSON.stringify([r.reforgeShort, r.reforgePaid]));
  ok('the help panel and Brok quote the new prices and none of the old ones', r.help.craft && r.help.reforge && !r.help.old, JSON.stringify(r.help));
  ok('the HUD shard tooltip states the flat 1,500 respec and the 3,500 / 5,000 crafts, and no longer says the respec scales', /Respec \(1,?500◈\)/.test(r.tooltip) && /tier 5 \(3,?500◈\)/.test(r.tooltip) && /tier 6 \(5,?000◈\)/.test(r.tooltip) && !/scales with your level/.test(r.tooltip), r.tooltip.slice(-160));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
