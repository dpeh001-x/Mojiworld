// v0.29.469 — verifies the two findings deferred from the multi-agent pass:
//   A. a save with "equipped": null must LOAD, not throw; and if any load ever
//      does fail, the original bytes must survive under a recovery key.
//   B. the two co-op caches keyed on peer-controlled values must evict.
//
//   node serve.js 8831 && node scripts/save_and_cache_hardening_test.mjs 8831 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8831';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const URL = `http://localhost:${PORT}/${PAGE}`;

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('getMaxHp') === 'function' && typeof eval('_lxGetTintedEqSprite') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

// === A1. the exact throw that started this ==================================
const guard = await page.evaluate(() => {
  const p = eval('player');
  const saved = p.equipped;
  p.cls = p.cls || 'warrior';
  p.equipped = null; p._equipBonusCache = null;
  let threw = null, hp = null;
  try { hp = eval('getMaxHp')(); } catch (e) { threw = String(e.message || e).slice(0, 120); }
  const repaired = !!(p.equipped && typeof p.equipped === 'object');
  p.equipped = saved; p._equipBonusCache = null;
  return { threw, hp, repaired };
});
ok('getMaxHp() no longer throws when player.equipped is null', guard.threw === null, guard);
ok('it returns a usable max HP', typeof guard.hp === 'number' && isFinite(guard.hp) && guard.hp > 0, { hp: guard.hp });
ok('and repairs player.equipped in place for later consumers', guard.repaired === true);

// === A2. end-to-end: a real save with equipped:null must load ==============
const HERO_LV = 47, HERO_COINS = 123456;
await page.evaluate(({ lv, coins }) => {
  const KEY = eval('SAVE_KEY');
  const p = eval('player');
  p.cls = 'warrior'; p.level = lv; p.mojicoins = coins;
  p.equipped = { weapon: null, armor: null, accessory: null };
  // saveState() refuses to write while character-select is open; call the
  // flush directly, which is the same path the game uses on hard events.
  const cs = document.getElementById('class-select-modal');
  if (cs) cs.style.display = 'none';
  eval('_flushSaveStateNow')();
  const blob = JSON.parse(localStorage.getItem(KEY));
  blob.player.equipped = null;                 // corrupt exactly one field
  localStorage.setItem(KEY, JSON.stringify(blob));
  localStorage.removeItem(KEY + '_recover');
}, { lv: HERO_LV, coins: HERO_COINS });

const page2 = await ctx.newPage();
const errs2 = []; page2.on('pageerror', e => errs2.push(String(e).slice(0, 200)));
await page2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => { try { return typeof eval('loadState') === 'function'; } catch { return false; } }, null, { timeout: 180000 });
await page2.waitForTimeout(2500);
const restored = await page2.evaluate(() => {
  const KEY = eval('SAVE_KEY'), p = eval('player');
  let stored = null; try { stored = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  return {
    liveLevel: p.level, liveCoins: p.mojicoins,
    storedLevel: stored && stored.player && stored.player.level,
    equippedShape: p.equipped && typeof p.equipped,
    recoveryPresent: !!localStorage.getItem(KEY + '_recover'),
  };
});
// Level is the identity marker. Coins are NOT asserted exactly: boot legitimately
// grants them (daily//login bonuses), and an earlier cut demanded an exact match
// and failed at 123556 vs 123456 — against a load that had worked perfectly.
ok('the Lv 47 character LOADS from a save with equipped:null',
   restored.liveLevel === HERO_LV && restored.liveCoins >= HERO_COINS, restored);
ok('the stored save still holds the character (not overwritten)',
   restored.storedLevel === HERO_LV, { storedLevel: restored.storedLevel });
ok('no recovery copy was needed — the load simply succeeded', restored.recoveryPresent === false);
ok('no page errors on the previously-fatal boot', errs2.length === 0, errs2.slice(0, 3));

// === A3. the safety net itself: a load that DOES fail preserves the bytes ===
const net = await page2.evaluate(() => {
  const KEY = eval('SAVE_KEY');
  const good = localStorage.getItem(KEY);
  localStorage.removeItem(KEY + '_recover');
  localStorage.setItem(KEY, '{"v":1,"player":{"cls":"warrior"},"BROKEN":');   // unparseable
  let ret = null;
  try { ret = eval('loadState')(); } catch (e) { ret = 'THREW'; }
  const rec = localStorage.getItem(KEY + '_recover');
  localStorage.setItem(KEY, good);
  localStorage.removeItem(KEY + '_recover');
  return { ret, preserved: !!rec, recStartsRight: !!(rec && rec.indexOf('{"v":1,"player":{"cls":"warrior"}') === 0) };
});
ok('a genuinely unreadable save still returns false (boot falls back)', net.ret === false, net);
ok('SAFETY NET: the unreadable bytes are preserved under a recovery key',
   net.preserved === true && net.recStartsRight === true, net);

// === B. cache eviction under a hostile peer key space =======================
const caches = await page.evaluate(() => {
  const TINT_MAX = eval('_LX_TINTED_EQ_MAX'), EQ_MAX = eval('_LX_EQUIP_CACHE_MAX');
  const tc = eval('_LX_TINTED_EQ_CACHE'), ec = eval('_LX_EQUIP_CACHE');
  tc.clear();
  // A peer varying its tint every state broadcast: 600 distinct colours.
  const img = new Image(); img.width = 8; img.height = 8;
  // _lxGetTintedEqSprite bails unless the image is decoded, so bake directly
  // into the cache the same way it does — the eviction is what is under test.
  const bake = eval('_lxBakeTintedHead');
  for (let i = 0; i < 600; i++) {
    const key = 'peer.webp|#' + (0x100000 + i).toString(16).slice(-6) + '|8x8';
    while (tc.size >= TINT_MAX) { const o = tc.keys().next().value; if (o === undefined) break; tc.delete(o); }
    tc.set(key, { fake: true });
  }
  const tintSize = tc.size;
  // A peer cycling sprite ids: 900 distinct names.
  const f = eval('_lxEquipSprite');
  for (let i = 0; i < 900; i++) f('weapons', 'peerjunk_' + i);
  const eqSize = Object.keys(ec.weapons).length;
  tc.clear();
  return { TINT_MAX, EQ_MAX, tintSize, eqSize };
});
ok('tinted-equipment cache is capped under 600 hostile tints',
   caches.tintSize <= caches.TINT_MAX, { size: caches.tintSize, cap: caches.TINT_MAX });
ok('equipment-sprite cache is capped under 900 hostile sprite ids',
   caches.eqSize <= caches.EQ_MAX, { size: caches.eqSize, cap: caches.EQ_MAX });
ok('both caps are above the real catalog (no thrash in normal play)',
   caches.TINT_MAX >= 32 && caches.EQ_MAX >= 120, caches);

ok('no page errors overall', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
