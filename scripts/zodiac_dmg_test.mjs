// Zodiac damage -25% (v0.30.388): a spawned zodiac boss carries 75% of the ATK the
// spawn derived for it (kept as _atkPreZodiacCut); every zodiac skill that sizes
// damage from the player's max HP carries the same multiplier; ordinary bosses and
// the zodiac types' table figures are untouched.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9993); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof monsterTypes === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async (SIGNS) => {
    const o = { ver: GAME_VERSION, hasMul: typeof LX_ZODIAC_DMG_MUL === 'number' ? LX_ZODIAC_DMG_MUL : null, pounce: typeof LEO_POUNCE_FRAC === 'number' ? LEO_POUNCE_FRAC : null };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await new Promise((r) => setTimeout(r, 300)); game.paused = true;
    player.level = 80;
    o.typeLeo = monsterTypes.zodiac_leo.atk;
    o.spawned = {};
    for (const s of SIGNS) { spawnMonster(player.x + 300, player.y, 'zodiac_' + s, true); const m = game.monsters.filter((x) => x && x.type === 'zodiac_' + s).pop(); o.spawned[s] = m ? { atk: m.atk, pre: m._atkPreZodiacCut, cut: !!m._zodiacAtkCut, zodiac: !!m.zodiacBoss } : null; if (m) game.monsters.splice(game.monsters.indexOf(m), 1); }
    // an ordinary boss is untouched
    spawnMonster(player.x + 300, player.y, 'kingKrook', true); const kk = game.monsters.filter((x) => x && x.type === 'kingKrook').pop(); o.krook = kk ? { atk: kk.atk, pre: kk._atkPreZodiacCut, cut: !!kk._zodiacAtkCut } : null;
    // the max-HP-fraction skills carry the multiplier (static: the shipped source)
    const src = await (await fetch(location.pathname)).text();
    o.fracSites = ['_rm * 0.20 * LX_ZODIAC_DMG_MUL', '_km * 0.12 * LX_ZODIAC_DMG_MUL', '_sm * 0.24 * LX_ZODIAC_DMG_MUL', '_max * 0.015 * LX_ZODIAC_DMG_MUL', '_max * 0.75 * LX_ZODIAC_DMG_MUL'].map((t) => src.indexOf(t) >= 0);
    return o;
  }, SIGNS);
  console.log('build ' + r.ver + '  leo spawned ' + JSON.stringify(r.spawned.leo));
  ok('the multiplier is 0.75', r.hasMul === 0.75, String(r.hasMul));
  ok('all twelve signs spawn as zodiac bosses and carry the cut flag', SIGNS.every((s) => r.spawned[s] && r.spawned[s].zodiac && r.spawned[s].cut), SIGNS.filter((s) => !(r.spawned[s] && r.spawned[s].cut)).join(' ') || 'all');
  ok('each spawned sign\'s ATK is exactly 75% (floored) of the figure the spawn derived for it', SIGNS.every((s) => r.spawned[s] && r.spawned[s].pre > 0 && r.spawned[s].atk === Math.max(1, Math.floor(r.spawned[s].pre * 0.75))), SIGNS.map((s) => s + ':' + (r.spawned[s] && (r.spawned[s].pre + '->' + r.spawned[s].atk))).join(' '));
  ok('a Lv 80 spawn of Leo lands in the expected band (pre-cut 15,000-25,000; cut 11,000-19,000)', !!r.spawned.leo && r.spawned.leo.pre > 15000 && r.spawned.leo.pre < 25000 && r.spawned.leo.atk > 11000 && r.spawned.leo.atk < 19000, JSON.stringify(r.spawned.leo));
  ok('the zodiac type table is untouched (Leo 2,066) - the cut lives on the spawn', r.typeLeo === 2066, String(r.typeLeo));
  ok('an ordinary boss (King Krook) is not cut', !!r.krook && !r.krook.cut && r.krook.pre === undefined, JSON.stringify(r.krook));
  ok('the Sun Pounce takes 45% of max HP (was 60%)', r.pounce === 0.45, String(r.pounce));
  ok('the sting, tide, ice, flood and five-sins fractions carry the multiplier', Array.isArray(r.fracSites) && r.fracSites.every(Boolean), JSON.stringify(r.fracSites));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
