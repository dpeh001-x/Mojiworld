// AETHERION: a bit harder, and the only source of ACCURACY gear.
// ============================================================================
// Per user: "make aetherion a bit harder, u can let aetherion drop relatively
// stronger equipment that would be good against the zodiac bosses".
//
// "Good against the zodiac" is mechanical here. Zodiac evasion runs 216-807
// while player accuracy starts at 90-130, and _rollAccuracyHit sheds hit
// chance linearly across a 150-point gap — so accuracy is the counter-stat,
// and getEquipBonus('accuracy') was wired into getAccuracy with ZERO items in
// the game carrying any. Aetherion (Lv 65, directly below the Lv 68-92 ladder)
// is now its only source.
//
// Driven on a REAL kill through the real drop path, because the claim is about
// what the boss actually gives you, not about a helper returning an object.
// Run: node scripts/aetherion_shardsight_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9993);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'Shardsight').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

const stats = await page.evaluate(() => {
  const A = monsterTypes.aetherion;
  const defVal = A.def * _mobArmorClass({ type: 'aetherion' }) * 2.2;
  return { def: A.def, atk: A.atk, hp: A.hp, taken: +(300 / (defVal + 300) * 100).toFixed(1) };
});
ok('Aetherion is harder: DEF 72 -> 165, ATK 576 -> 662',
  stats.def === 165 && stats.atk === 662,
  `def ${stats.def}, atk ${stats.atk}, now takes ${stats.taken}% per hit (was 65.5%)`);

// ---- a REAL kill, and what it drops ----------------------------------------
const drops = await page.evaluate(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = false;
  player.level = 66; player._god = true;
  game.monsters = []; game.drops.length = 0;
  spawnMonster(player.x + 300, player.y, 'aetherion', true);
  const a = game.monsters[game.monsters.length - 1];
  if (!a) return { err: 'no aetherion' };
  a.currentHp = 1;
  try { killMonster(a); } catch (e) { return { err: String(e).slice(0, 140) }; }
  const items = game.drops.filter((d) => d && d.type === 'item' && d.item).map((d) => d.item);
  // Aetherion drops TWO piles: the ordinary boss loot every boss rolls, plus
  // the six-item super-boss pile. Only the second is Shardsight — a first
  // draft asserted "every drop" and failed on the ordinary T4-5 items, which
  // are not a regression, they are the loot he always gave.
  const shard = items.filter((i) => /^Shardsight /.test(i.name || ''));
  return {
    n: items.length, shardN: shard.length,
    shardTiers: [...new Set(shard.map((i) => i.tier | 0))].sort(),
    shardRar: [...new Set(shard.map((i) => i.rarity))],
    shardAcc: shard.map((i) => i.accuracy | 0),
    withAcc: items.filter((i) => (i.accuracy | 0) > 0).length,
    named: items.filter((i) => /^Shardsight /.test(i.name || '')).length,
    accVals: items.map((i) => i.accuracy | 0),
    tiers: [...new Set(items.map((i) => i.tier | 0))].sort(),
    rarities: [...new Set(items.map((i) => i.rarity))],
    sample: items[0] ? { name: items[0].name, tier: items[0].tier, acc: items[0].accuracy } : null,
  };
});
ok('a real Aetherion kill drops its full pile', !drops.err && drops.n >= 6,
  drops.err || `${drops.n} items`);
if (!drops.err) {
  ok('the super-boss pile is six Shardsight pieces, every one carrying accuracy',
    drops.shardN === 6 && drops.shardAcc.every((v) => v > 0),
    `${drops.shardN} Shardsight of ${drops.n} total drops · acc ${JSON.stringify(drops.shardAcc)}`);
  ok('printed accuracy rolls inside the authored 40-70 band',
    drops.shardAcc.every((v) => v >= 40 && v <= 70), JSON.stringify(drops.shardAcc));
  ok('the Shardsight pile is T7-8 legendary — below Gravitos, above the field',
    drops.shardTiers.every((t) => t >= 7 && t <= 8) && drops.shardRar.every((r) => r === 'legendary'),
    `tiers ${JSON.stringify(drops.shardTiers)}, rarities ${JSON.stringify(drops.shardRar)}`);
}

// ---- the stat is real: it reaches getAccuracy, and the tooltip shows it ----
const wired = await page.evaluate(() => {
  const it = _rollAetherionShardgear();
  if (!it) return { err: 'no roll' };
  const before = getAccuracy();
  player.equipped = { weapon: null, armor: null, accessory: null };
  player.equipped[it.slot === 'accessory' ? 'accessory' : it.slot] = it;
  player._equipBonusCache = null;
  const after = getAccuracy();
  const shown = itemStatString(it, false) || '';
  player.equipped = { weapon: null, armor: null, accessory: null };
  player._equipBonusCache = null;
  // what that accuracy is worth against the tier it exists for
  const evas = ['gemini', 'sagittarius', 'taurus'].map((z) => monsterTypes['zodiac_' + z].evasion);
  const hitAt = (acc, ev) => Math.max(0.15, Math.min(1, 1 - (ev - acc) / 150));
  return {
    err: null, acc: it.accuracy, before, after, gain: after - before,
    shownAcc: /Accuracy/.test(shown), shown: shown.replace(/<[^>]*>/g, '').slice(0, 90),
    hitGemBefore: +hitAt(before, evas[0]).toFixed(2), hitGemAfter: +hitAt(after, evas[0]).toFixed(2),
    evas,
  };
});
ok('equipping Shardsight actually raises getAccuracy() substantially', !wired.err && wired.gain >= 80,
  wired.err || `accuracy ${wired.before} -> ${wired.after} (+${wired.gain})`);
ok('the tooltip PRINTS the accuracy (it was a silent stat before)',
  !wired.err && wired.shownAcc === true, wired.shown);
// ONE piece against the MOST evasive sign is not the claim, and asserting it
// was a first-draft mistake: +176 against Gemini's 678 still leaves a 402 gap,
// far outside the 150-point window, so it stays pinned at the floor and the
// measurement shows nothing. The reward is the SET — three Shardsight pieces,
// which is what a full Aetherion pile actually hands you.
const setGain = await page.evaluate(() => {
  const hitAt = (acc, ev) => Math.max(0.15, Math.min(1, 1 - (ev - acc) / 150));
  const signs = ['taurus', 'leo', 'gemini', 'sagittarius'];
  const evas = Object.fromEntries(signs.map((z) => [z, monsterTypes['zodiac_' + z].evasion]));
  player.equipped = { weapon: null, armor: null, accessory: null };
  player._equipBonusCache = null;
  const before = getAccuracy();
  // a full set: force one piece into each slot regardless of what rolled
  for (const slot of ['weapon', 'armor', 'accessory']) {
    let it = null;
    for (let i = 0; i < 40 && !it; i++) { const r = _rollAetherionShardgear(); if (r) it = r; }
    if (it) player.equipped[slot] = it;
  }
  player._equipBonusCache = null;
  const after = getAccuracy();
  const out = { before, after, gain: +(after - before).toFixed(1), evas, hits: {} };
  for (const z of signs) out.hits[z] = { before: +hitAt(before, evas[z]).toFixed(2), after: +hitAt(after, evas[z]).toFixed(2) };
  player.equipped = { weapon: null, armor: null, accessory: null };
  player._equipBonusCache = null;
  return out;
});
ok('a full three-piece Shardsight set is a large accuracy swing',
  setGain.gain >= 350, `accuracy ${setGain.before} -> ${setGain.after} (+${setGain.gain})`);
ok('and it measurably raises hit chance across the zodiac tier it exists for',
  Object.values(setGain.hits).filter((h) => h.after > h.before).length >= 3,
  Object.entries(setGain.hits).map(([z, h]) => `${z} ${h.before}->${h.after}`).join('  '));
ok('but it does NOT trivialise the tier — the most evasive sign still resists',
  setGain.hits.sagittarius.after < 1.0,
  `Sagitta (eva ${setGain.evas.sagittarius}) still at ${setGain.hits.sagittarius.after}`);

// ---- it stays Aetherion's alone --------------------------------------------
const exclusive = await page.evaluate(() => {
  const all = [].concat(ITEM_POOL.weapons || [], ITEM_POOL.armors || [], ITEM_POOL.accessories || []);
  const baseAcc = all.filter((i) => i && (i.accuracy | 0) > 0).length;
  let affixAcc = 0;
  for (let i = 0; i < 250; i++) {
    const b = all[Math.floor(Math.random() * all.length)];
    const r = rollAffixedItem({ ...b }, 'legendary', 100);
    if (r && (r.accuracy | 0) > 0) affixAcc++;
  }
  return { baseAcc, affixAcc };
});
ok('no ordinary item or affix can grant accuracy — Aetherion is the only source',
  exclusive.baseAcc === 0 && exclusive.affixAcc === 0,
  `${exclusive.baseAcc} base items, ${exclusive.affixAcc}/250 affixed rolls`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
