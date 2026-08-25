// Live test: A STAR MEANS MOST WHERE THE SLOT MEANS MOST.
//
// Per user: "enhancement should increase the following more and reduce the
// mojicoins requirement slightly: weapons - more base attack, armor - more
// defence, accesory - other miscellaneous stats".
//
// Measured through the REAL payout path - getEquipBonus, the same cache the
// combat code reads - not through the formula. Three items with an IDENTICAL
// stat block differing only in `slot` are each equipped at 0 stars and again at
// 10, and the growth of each stat is compared ACROSS slots. Same key, same stat
// family, same tier, same softening: the only variable left is the slot, which
// is the thing under test.
//   node scripts/star_signature_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof getEquipBonus === 'function' && typeof refreshGearCache === 'function'
  && typeof STAR_COSTS !== 'undefined' && typeof STAR_SIG_GROWTH !== 'undefined', null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const out = { sig: STAR_SIG_GROWTH, base: STAR_GROWTH, costs: STAR_COSTS.slice() };
  // hp is the probe stat: flat (so it takes the full curve, not the percent
  // softening), uncapped (unlike crit, which each item clamps at 20), and
  // non-signature on a weapon or armour while signature on an accessory.
  const PROBE = ['atk', 'def', 'hp'];
  const mk = (slot) => ({ name: 'probe', slot, tier: 1, stars: 0,
    atk: 100, def: 100, hp: 100 });
  const read = (slot, stars) => {
    player.equipped = { weapon: null, armor: null, accessory: null };
    const it = mk(slot); it.stars = stars;
    player.equipped[slot] = it;
    refreshGearCache();
    const o = {};
    for (const k of PROBE) o[k] = getEquipBonus(k);
    return o;
  };
  out.grow = {};
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const a = read(slot, 0), z = read(slot, 10);
    out.grow[slot] = {};
    for (const k of PROBE) out.grow[slot][k] = a[k] > 0 ? +(z[k] / a[k]).toFixed(4) : null;
  }
  out.expectSig  = +Math.pow(STAR_SIG_GROWTH, 10).toFixed(4);
  out.expectBase = +Math.pow(STAR_GROWTH, 10).toFixed(4);

  // What the forge itself shows the player for a weapon: the ATK row must
  // advance further than the DEF row for identical base values.
  out.preview = null;
  try {
    const w = mk('weapon'); w.stars = 3; w.name = 'Probe Blade';
    if (!Array.isArray(player.inventory)) player.inventory = [];
    player.inventory.push(w);
    player.mojicoins = 9999999;
    renderEnhancementModal(w);
    const html = document.getElementById('enhance-preview').innerHTML;
    const grab = (label) => {
      const m = html.match(new RegExp('>' + label + '<[\\s\\S]{0,400}?\\+([0-9.]+)'));
      return m ? parseFloat(m[1]) : null;
    };
    out.preview = { atkDelta: grab('ATK'), defDelta: grab('DEF') };
  } catch (e) { out.previewErr = String(e).slice(0, 120); }
  player.equipped = { weapon: null, armor: null, accessory: null };
  refreshGearCache();
  return out;
});

const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 0.02);
const G = r.grow || {};
const OLD_COSTS = [100, 400, 1000, 2400, 5500, 12000, 18000, 25000, 35000, 50000];
const oldSum = OLD_COSTS.reduce((a, b) => a + b, 0);
const newSum = (r.costs || []).reduce((a, b) => a + b, 0);

ok('a WEAPON forges its ATK on the steeper curve',
  near(G.weapon && G.weapon.atk, r.expectSig),
  { atkGrowthAt10Stars: G.weapon && G.weapon.atk, expected: r.expectSig });
ok('...while the rest of that weapon grows exactly as it always did',
  near(G.weapon && G.weapon.def, r.expectBase) && near(G.weapon && G.weapon.hp, r.expectBase),
  { def: G.weapon && G.weapon.def, hp: G.weapon && G.weapon.hp, expected: r.expectBase });
ok('ARMOUR forges its DEF on the steeper curve',
  near(G.armor && G.armor.def, r.expectSig),
  { defGrowthAt10Stars: G.armor && G.armor.def, expected: r.expectSig });
ok('...and its ATK and HP are untouched',
  near(G.armor && G.armor.atk, r.expectBase) && near(G.armor && G.armor.hp, r.expectBase),
  { atk: G.armor && G.armor.atk, hp: G.armor && G.armor.hp, expected: r.expectBase });
ok('an ACCESSORY forges everything that is NOT raw ATK or DEF',
  near(G.accessory && G.accessory.hp, r.expectSig),
  { hpGrowthAt10Stars: G.accessory && G.accessory.hp, expected: r.expectSig });
ok('...and leaves ATK and DEF on the ordinary curve, which is the point of the slot',
  near(G.accessory && G.accessory.atk, r.expectBase) && near(G.accessory && G.accessory.def, r.expectBase),
  { atk: G.accessory && G.accessory.atk, def: G.accessory && G.accessory.def, expected: r.expectBase });
ok('the SAME stat grows differently by slot - the only variable is the slot',
  G.accessory && G.weapon && G.accessory.hp > G.weapon.hp * 1.3
  && G.weapon.atk > G.accessory.atk * 1.3 && G.armor.def > G.weapon.def * 1.3,
  { hp_accessory_vs_weapon: [G.accessory && G.accessory.hp, G.weapon && G.weapon.hp],
    atk_weapon_vs_accessory: [G.weapon && G.weapon.atk, G.accessory && G.accessory.atk],
    def_armor_vs_weapon: [G.armor && G.armor.def, G.weapon && G.weapon.def] });
ok('the forge shows the player the steeper curve, not the flat one',
  r.preview && r.preview.atkDelta > 0 && r.preview.defDelta > 0
  && r.preview.atkDelta > r.preview.defDelta * 1.2,
  { atkDelta: r.preview && r.preview.atkDelta, defDelta: r.preview && r.preview.defDelta, err: r.previewErr });
ok('every rung of the cost ladder came down 15%',
  (r.costs || []).length === 10 && r.costs.every((c, i) => Math.abs(c - OLD_COSTS[i] * 0.85) <= OLD_COSTS[i] * 0.02),
  { costs: r.costs });
ok('...so a full 0 to 10 run is meaningfully cheaper', newSum < oldSum * 0.87 && newSum > oldSum * 0.83,
  { was: oldSum, now: newSum, change: (100 * (newSum / oldSum - 1)).toFixed(1) + '%' });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
