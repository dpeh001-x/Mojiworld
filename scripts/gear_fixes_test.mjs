// Gear fixes from the bug hunt (v0.30.x gear-fixes).
//   node scripts/gear_fixes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// 1) a class swap (the Amnesiac's offer) refreshes the gear-stat cache: no stale ATK / DEF / max HP, HP filled to
//    the true max; 2) unequipping into a full tab is refused like the swap path; 3) HP/MP never sit above a max that
//    just dropped, even with the (pausing) inventory still open.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10965';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof applyClass === 'function' && typeof _openPreAdvanceClassSwap === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 60;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    window.__stats = () => ({ atk: getAtk(), def: getDef(), maxHp: getMaxHp(), maxMp: getMaxMp() });
    window.__fresh = () => { invalidateEquipBonusCache(); return window.__stats(); };
  });

  // 1) the class swap, through the Amnesiac's real dialog
  await p.evaluate(() => {
    player.job = null; player.master = null;
    const set = [ITEM_POOL.weapons, ITEM_POOL.armors, ITEM_POOL.accessories].map((pool) => pool.find((x) => x.setId === 'doomforged'));
    ['weapon', 'armor', 'accessory'].forEach((s, i) => { player.equipped[s] = { ...set[i], slot: s, stars: 0 }; });
    invalidateEquipBonusCache(); player.hp = getMaxHp();
    window.__warrior = __stats();
    _openPreAdvanceClassSwap();
  });
  await p.waitForTimeout(500);
  const title = await p.evaluate(() => (document.getElementById('confirm-title') || document.querySelector('.confirm-title') || {}).textContent || '');
  await p.click('#confirm-yes'); await p.waitForTimeout(800);
  const A = await p.evaluate(() => { const served = __stats(), hp = player.hp; return { cls: player.cls, served, hp, truth: __fresh(), warrior: window.__warrior }; });
  console.log('swap', title.trim(), JSON.stringify(A));
  check(A.cls !== 'warrior' && A.served.atk === A.truth.atk && A.served.def === A.truth.def && A.served.maxHp === A.truth.maxHp, "after a class swap the gear stats are the new class's, not the old class's cache", A);
  check(A.hp === A.truth.maxHp && A.truth.atk < A.warrior.atk, 'and HP is filled to the true max (the Warrior-only gear stops paying the Warrior bonus)', [A.hp, A.truth, A.warrior]);

  // 2) + 3) unequipping into a full tab; HP above max with the inventory open
  const B = await p.evaluate(async () => {
    const out = {};
    const modal = document.getElementById('inventory-modal'); modal.style.display = 'flex'; game._invTab = 'equip';
    const mk = (pool) => ({ ...pool[0], slot: pool === ITEM_POOL.weapons ? 'weapon' : pool === ITEM_POOL.armors ? 'armor' : 'accessory', stars: 0, rarity: 'common', level: 10 });
    const cap = player.invCap.equip, used = () => player.inventory.filter((it) => _itemTab(it) === 'equip').length;
    player.inventory = player.inventory.filter((it) => _itemTab(it) !== 'equip');
    player.equipped.weapon = mk(ITEM_POOL.weapons); invalidateEquipBonusCache();
    while (used() < cap) player.inventory.push(mk(ITEM_POOL.weapons));
    renderInventory(''); document.getElementById('eq-weapon').click();
    out.full = { used: used(), cap, stillWorn: !!player.equipped.weapon };
    player.inventory = player.inventory.filter((it) => _itemTab(it) !== 'equip');
    renderInventory(''); document.getElementById('eq-weapon').click();
    out.room = { stillWorn: !!player.equipped.weapon, used: used() };
    const hpArmor = { ...(ITEM_POOL.armors.find((x) => (x.hp || 0) >= 100) || ITEM_POOL.armors[ITEM_POOL.armors.length - 1]), slot: 'armor', stars: 5 };
    player.equipped.armor = hpArmor; invalidateEquipBonusCache(); player.hp = getMaxHp();
    out.wornMax = player.hp;
    renderInventory(''); document.getElementById('eq-armor').click();
    await new Promise((s) => setTimeout(s, 600));
    out.after = { hp: player.hp, max: getMaxHp(), paused: !!game.paused };
    modal.style.display = 'none';
    return out;
  });
  console.log('inventory', JSON.stringify(B));
  check(B.full.used === B.full.cap && B.full.stillWorn, 'unequipping into a full Equip tab is refused - the tab stays at its cap and the piece stays on', B.full);
  check(!B.room.stillWorn && B.room.used === 1, 'with room it comes off into the tab as before', B.room);
  check(B.after.hp <= B.after.max && B.after.max < B.wornMax && B.after.paused, 'taking off a +HP piece with the inventory open: HP drops to the new max at once', B);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
