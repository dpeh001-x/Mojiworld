// T10 gear drops from Gravitos and from nothing else — sampled off the real rolls.
// ============================================================================
// Per user: "ensure that T10 items drop only from gravitos" and "ensure the zodiac bosses do not
// drop T10 equipments".
//
//   1. THE LEVEL FALLBACK IS CLOSED: boss-grade rolls with no cap at Lv 85/90/99 (every quest reward
//      takes this path) give no T10 — the previous build gave 141 in 3000 at Lv 99
//   2. A PINNED QUEST TIER CANNOT REACH IT: forceTier 10 lands on T9
//   3. NO ZODIAC BOSS: all twelve, through their own cap and with the monster passed
//   4. NO OTHER BOSS: every boss type but Gravitos
//   5. A BOSS HANDED capTier 10 BY MISTAKE STILL CANNOT: the type opens T10, not the number
//   6. CONTROL — GRAVITOS STILL DROPS T10: its kill roll and its signature pool
//   7. CONTROL — BELOW THE CEILING NOTHING MOVED: T9 is still reachable where it was
//   8. EVERY CAPPED KILL ROLL NAMES ITS MONSTER, and the Gravitos pool is only reached behind
//      _isGravitosKill (read off the running page's own script text)
// Run: node scripts/t10_gravitos_test.mjs   (MOJI_GAME_FILE=... for a private build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 13411);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 280) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 747 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  page.on('pageerror', () => {});
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  const R = await page.evaluate(() => {
    const out = {};
    const census = (n, fn) => { let mx = 0, t10 = 0, t9 = 0, got = 0; for (let i = 0; i < n; i++) { const it = fn(); if (!it) continue; got++; const t = it.tier | 0; if (t > mx) mx = t; if (t >= 10) t10++; if (t === 9) t9++; } return { n, got, max: mx, t10, t9 }; };
    out.booted = typeof rollItemDrop === 'function' && typeof _bossLootTierCap === 'function' && typeof ITEM_POOL === 'object';
    out.fallback = {};
    for (const lv of [85, 90, 99]) out.fallback[lv] = census(3000, () => rollItemDrop(2, lv));
    out.pinned = census(600, () => rollItemDrop(2, 99, undefined, 10));
    const bossTypes = Object.keys(monsterTypes).filter((t) => monsterTypes[t] && monsterTypes[t].boss);
    out.zodiac = {}; out.others = {};
    for (const t of bossTypes) {
      const c = census(400, () => rollItemDrop(2, 92, undefined, null, _bossLootTierCap({ type: t }), { type: t }));
      if (/^zodiac_/.test(t)) out.zodiac[t] = c; else if (t !== 'gravitos') out.others[t] = c;
    }
    out.mistake = census(1500, () => rollItemDrop(2, 99, undefined, null, 10, { type: 'zodiac_leo' }));
    out.gravKill = census(3000, () => rollItemDrop(2, 100, undefined, null, _bossLootTierCap({ type: 'gravitos' }), { type: 'gravitos' }));
    out.gravPool = census(600, () => _rollGravitosHighTierItem());
    // the page's own script text
    const src = [...document.scripts].map((sc) => sc.textContent || '').join('\n');
    const count = (needle) => src.split(needle).length - 1;
    out.src = {
      capNoMob: count('_bossLootTierCap(m))'),
      capWithMob: count('_bossLootTierCap(m), m)'),
      poolCalls: count('_rollGravitosHighTierItem()') - count('function _rollGravitosHighTierItem()'),
      poolGated: count('_isGravitosKill ? _rollGravitosHighTierItem()'),
    };
    return out;
  });
  const fb = R.fallback, sumT10 = (o) => Object.values(o).reduce((a, c) => a + c.t10, 0);
  console.log(`  fallback ${JSON.stringify(fb)}`);
  console.log(`  pinned ${JSON.stringify(R.pinned)} | mistake ${JSON.stringify(R.mistake)} | gravitos kill ${JSON.stringify(R.gravKill)} pool ${JSON.stringify(R.gravPool)}`);
  console.log(`  zodiac max ${JSON.stringify(Object.fromEntries(Object.entries(R.zodiac).map(([k, v]) => [k.slice(7), v.max])))} | others max ${JSON.stringify(Object.fromEntries(Object.entries(R.others).map(([k, v]) => [k, v.max])))} | src ${JSON.stringify(R.src)}`);

  ok('BOOTED: the loot functions are live', R.booted);
  ok('THE LEVEL FALLBACK IS CLOSED: uncapped boss-grade rolls at Lv 85 / 90 / 99 give no T10',
    [85, 90, 99].every((lv) => fb[lv].got > 2000 && fb[lv].t10 === 0),
    `T10 in 3000: Lv85 ${fb[85].t10}, Lv90 ${fb[90].t10}, Lv99 ${fb[99].t10} (previous build: 129 / 123 / 141) — every quest reward rolls this way`);
  ok('A PINNED QUEST TIER CANNOT REACH IT: forceTier 10 lands at T9',
    R.pinned.got > 400 && R.pinned.t10 === 0 && R.pinned.max === 9,
    `${R.pinned.t10} T10 in ${R.pinned.got}; highest ${R.pinned.max}`);
  ok('NO ZODIAC BOSS DROPS T10: all twelve, through their own cap with the monster passed',
    Object.keys(R.zodiac).length === 12 && sumT10(R.zodiac) === 0 && Object.values(R.zodiac).every((c) => c.max <= 8 && c.got > 300),
    `${Object.keys(R.zodiac).length} zodiac bosses, ${sumT10(R.zodiac)} T10 across ${Object.values(R.zodiac).reduce((a, c) => a + c.got, 0)} items, highest T${Math.max(...Object.values(R.zodiac).map((c) => c.max))}`);
  ok('NO OTHER BOSS DROPS T10: every boss type except Gravitos',
    Object.keys(R.others).length >= 8 && sumT10(R.others) === 0,
    `${Object.keys(R.others).length} other bosses, ${sumT10(R.others)} T10`);
  ok('A BOSS HANDED capTier 10 BY MISTAKE STILL CANNOT: the TYPE opens T10, not the number',
    R.mistake.got > 1000 && R.mistake.t10 === 0,
    `zodiac_leo with capTier 10: ${R.mistake.t10} T10 in ${R.mistake.got}, highest T${R.mistake.max}`);
  ok('CONTROL — GRAVITOS STILL DROPS T10: its kill roll and its signature pool',
    R.gravKill.t10 > 0 && R.gravKill.max === 10 && R.gravPool.t10 > 0,
    `kill roll ${R.gravKill.t10} T10 in ${R.gravKill.got}; signature pool ${R.gravPool.t10} T10 in ${R.gravPool.got}`);
  ok('CONTROL — BELOW THE CEILING NOTHING MOVED: T9 is still reachable from the Lv 85+ fallback',
    fb[99].max === 9 && fb[99].t9 > 0,
    `Lv 99 fallback: highest T${fb[99].max}, ${fb[99].t9} T9 in ${fb[99].got}`);
  ok('EVERY CAPPED KILL ROLL NAMES ITS MONSTER, and the Gravitos pool is only reached behind _isGravitosKill',
    R.src.capNoMob === 0 && R.src.capWithMob === 5 && R.src.poolCalls === R.src.poolGated && R.src.poolGated === 3,
    JSON.stringify(R.src));
} finally { await browser.close().catch(() => {}); server.kill(); }
let nbad = 0;
for (const r of res) { if (!r.pass) nbad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(nbad ? `\n${nbad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(nbad ? 1 : 0);
