// KROOK is harder, and the last three star rungs are worse.
// ============================================================================
// Per user: "Increase the stats of krook to make him more difficult" and
// "reduce chance of success of enhancement from 8 to 10 stars".
//
// The odds half is the one worth guarding: the ask names a RANGE, and the easy
// mistake is to move the whole curve. Every rung below ★8 is asserted unchanged
// against its shipped value, so a future slope tweak that leaks downward fails
// here rather than in a player's grind.
// Run: node scripts/krook_star_odds_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10821);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => typeof window.starSuccessRate === 'function'
  || (typeof window.monsterTypes === 'object' && window.monsterTypes), null, { timeout: 40000 });
await page.waitForTimeout(2500);

const R = await page.evaluate(() => {
  const out = {};
  out.rates = [];
  for (let s = 0; s < 10; s++) out.rates.push(starSuccessRate(s));
  out.floor = (typeof STAR_RATE_FLOOR !== 'undefined') ? STAR_RATE_FLOOR : null;
  const k = monsterTypes.kingKrook, o = monsterTypes.octobaby;
  out.krook = k ? { hp: k.hp, atk: k.atk, def: k.def, evasion: k.evasion, speed: k.speed, exp: k.exp, coins: k.mojicoins, lvl: k.level } : null;
  out.octoHp = o ? o.hp : null;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

// The shipped ladder before this change. Rungs 0..6 must be byte-identical.
const WAS = [95, 87, 79, 71, 63, 55, 45, 35, 25, 15];
const NOW = R.rates || [];
console.log('  ladder: ' + NOW.map((v, i) => `→★${i + 1} ${v}%`).join('  '));
console.log(`  krook: ${JSON.stringify(R.krook)}`);
console.log(`  (octobaby, same tier, hp ${R.octoHp})`);

ok('rungs →★1..→★7 are untouched',
   [0, 1, 2, 3, 4, 5, 6].every(i => NOW[i] === WAS[i]),
   `${[0,1,2,3,4,5,6].map(i => NOW[i]).join('/')} vs shipped ${[0,1,2,3,4,5,6].map(i => WAS[i]).join('/')}`);
ok('→★8 is harder', NOW[7] < WAS[7], `${WAS[7]}% -> ${NOW[7]}%`);
ok('→★9 is harder', NOW[8] < WAS[8], `${WAS[8]}% -> ${NOW[8]}%`);
ok('→★10 is harder', NOW[9] < WAS[9], `${WAS[9]}% -> ${NOW[9]}%`);
ok('the ladder never rises as stars go up',
   NOW.every((v, i) => i === 0 || v <= NOW[i - 1]),
   'a non-monotonic curve would make some later star EASIER than an earlier one');
ok('nothing drops below the floor', R.floor != null && NOW.every(v => v >= R.floor),
   `floor ${R.floor}%, lowest rung ${Math.min(...NOW)}%`);

ok('CONTROL: Krook still exists and is Lv50', !!(R.krook && R.krook.lvl === 50));
ok('Krook hits harder and lasts longer', !!(R.krook && R.krook.hp > 2520000 && R.krook.atk > 355),
   `hp ${R.krook && R.krook.hp} (was 2,520,000), atk ${R.krook && R.krook.atk} (was 355)`);
// NOT 'Krook out-bulks Octobaby'. That was true when this test was written
// and it was never a rule — it was the rationale for how far to raise him.
// Octobaby was later buffed +20% by explicit request and now sits above him,
// which failed a build that was exactly what had been asked for. What is
// worth guarding is that the two Lv50 bosses stay in one bulk BAND, so
// neither drifts into another tier's weight class unnoticed.
ok('...and stays in the same bulk band as his tier peer',
   !!(R.krook && R.octoHp && Math.max(R.krook.hp, R.octoHp) / Math.min(R.krook.hp, R.octoHp) <= 1.5),
   `krook ${R.krook && R.krook.hp} vs octobaby ${R.octoHp} — ratio ${(Math.max(R.krook.hp, R.octoHp) / Math.min(R.krook.hp, R.octoHp)).toFixed(2)}x, both Lv50`);
ok('the reward moved with the difficulty', !!(R.krook && R.krook.exp > 365000 && R.krook.coins > 13600),
   `exp ${R.krook && R.krook.exp}, coins ${R.krook && R.krook.coins}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
