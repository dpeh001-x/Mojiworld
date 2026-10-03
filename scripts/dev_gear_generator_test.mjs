#!/usr/bin/env node
// v0.30.1579 - THE GEAR GENERATOR in the developer console (per user: "in developer mode, create a function to generate
// equipments ingame (to show categories and section into weapon armor and accessories)"). Driven through its own DOM:
//   TABS      one tab per ITEM_POOL category - Weapons, Armor, Accessories - each labelled with the pool's own count
//   SECTIONS  "All classes" shows every piece of a tab under its class heading; a class chip shows that class only
//   SETS      (v0.30.1583, per user: "include the new updated list of equipments") a fourth tab gives each of the SETS - the five
//             legendary sets and v0.30.1581's five stat sets - its own section with exactly its pieces; a class chip there
//             shows what that class wears (Mage + Galecrest = Rod, Featherweave, Plume) and "Whole set" makes all three
//   CATALOG   a tile click puts the exact catalog piece in the bag (slot, baseName, no affixes, star 0)
//   ROLLED    rolled + legendary + 5 stars makes a drop: affixes, a prefixed name, the base name kept, the accessory slot
//   EQUIP     "Equip it on the hero" wears the piece and moves the old one to the bag
//   FULL      a full Equip tab refuses the next piece (nothing goes past the cap)
//   QUIET     a made piece is not a pickup (trackPickup never runs)
//   GATED     without developer mode the console - and the generator with it - never opens
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/dev_gear_generator_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11807);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
const boot = async (query) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
  await ctx.addInitScript(() => { try { localStorage.mojiworld_prologue_seen = '1'; } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 30; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true;
    loadMap('forest', 420); await new Promise((r) => setTimeout(r, 1200));
  });
  return page;
};
try {
  const page = await boot('?dev=1');
  const R = await page.evaluate(async () => {
    const out = {}, $ = (s) => document.querySelector('#dev-gear ' + s), $$ = (s) => [...document.querySelectorAll('#dev-gear ' + s)];
    const pickups = []; const oTP = window.trackPickup; window.trackPickup = function () { pickups.push(arguments[0]); return oTP && oTP.apply(this, arguments); };
    const setOpt = (k, v) => { const e = $(`[data-opt="${k}"]`); if (!e) return false; if (e.type === 'checkbox') e.checked = v; else e.value = String(v); e.dispatchEvent(new Event('change')); return true; };
    const tab = (c) => $(`.dg-tab[data-cat="${c}"]`).click(), chip = (k) => $(`.dg-chip[data-cls="${k}"]`).click();
    const tile = (n) => $$('.dg-tile').find((t) => t.dataset.name === n);
    openDevConsole();
    out.open = !!$('.dg-tabs') && getComputedStyle(document.getElementById('dev-modal')).display !== 'none';
    out.tabs = $$('.dg-tab').map((t) => t.textContent);
    out.pool = ['weapons', 'armors', 'accessories'].map((c) => ITEM_POOL[c].length); out.setCount = Object.keys(SETS).length;
    // every tab, all classes: every piece shown under its class heading; then one class chip
    out.sections = {};
    for (const c of ['weapons', 'armors', 'accessories']) {
      tab(c); chip('all');
      const names = $$('.dg-tile').map((t) => t.dataset.name), want = ITEM_POOL[c].map((b) => b.name);
      const heads = $$('.dg-group').map((h) => h.textContent.split(' · ')[0].toLowerCase());
      chip('warrior');
      const war = $$('.dg-tile').map((t) => t.dataset.name), wantWar = ITEM_POOL[c].filter((b) => b.cls === 'warrior').map((b) => b.name);
      out.sections[c] = { all: names.length === want.length && want.every((n) => names.includes(n)), heads: heads.join('/'),
        warrior: war.length === wantWar.length && wantWar.every((n) => war.includes(n)) && $$('.dg-group').length === 1 };
    }
    // SETS: every set in its own section with exactly its pieces; the mage's Galecrest; the whole set into an empty bag
    tab('sets'); chip('all');
    const heads = $$('.dg-group[data-set]').map((h) => h.dataset.set), want = Object.keys(SETS).map((k) => SETS[k].name);
    const piecesOf = (name) => { const h = $$('.dg-group[data-set]').find((x) => x.dataset.set === name); const g = h && h.nextElementSibling && h.nextElementSibling.nextElementSibling;
      return g ? [...g.querySelectorAll('.dg-tile')].map((t) => t.dataset.name) : []; };
    const all = ['weapons', 'armors', 'accessories'].flatMap((c) => ITEM_POOL[c]);
    const exact = Object.keys(SETS).every((k) => { const got = piecesOf(SETS[k].name), w = all.filter((b) => b.setId === k).map((b) => b.name); return got.length === w.length && w.every((n) => got.includes(n)); });
    const tag = (tile('Galecrest Rod') || { querySelector: () => null }).querySelector('.dg-set');
    chip('mage'); const mageGale = piecesOf('Galecrest'), noAnyChip = !$('.dg-chip[data-cls="any"]');
    player.inventory = []; const wholeBtn = [...$$('.dg-group[data-set]').find((x) => x.dataset.set === 'Galecrest').querySelectorAll('button')].pop(); wholeBtn.click();
    out.sets = { tab: (($('.dg-tab[data-cat="sets"]') || {}).textContent || ''), heads: heads.length === want.length && want.every((n) => heads.includes(n)), exact,
      stat: ['Galecrest', 'Sunderer', 'Heartwood', 'Razorglass', 'Granitehorn'].every((n) => heads.includes(n)), tag: tag ? tag.textContent : null,
      mageGale: mageGale.slice().sort().join('/'), noAnyChip, whole: player.inventory.map((i) => i.baseName).sort().join('/') };
    // CATALOG: an empty bag, the starter stick
    player.inventory = []; player.equipped.armor = null; tab('weapons'); chip('all');
    tile('Whittled Stick').click();
    const a = player.inventory[0] || {};
    out.catalog = { n: player.inventory.length, name: a.name, base: a.baseName, slot: a.slot, stars: a.stars, affixes: (a.affixes || []).length, rarity: a.rarity };
    // ROLLED: legendary, 5 stars, an accessory
    setOpt('mode', 'rolled'); setOpt('rarity', 'legendary'); setOpt('stars', 5); tab('accessories');
    tile('Ring of Might').click();
    const b = player.inventory[player.inventory.length - 1] || {};
    out.rolled = { name: b.name, base: b.baseName, slot: b.slot, stars: b.stars, rarity: b.rarity, affixes: (b.affixes || []).length };
    // EQUIP: wear Threadbare Rags, then make a Cloth Tunic straight onto the hero
    setOpt('mode', 'catalog'); setOpt('rarity', ''); setOpt('stars', 0); setOpt('equip', true); tab('armors');
    tile('Threadbare Rags').click(); const n0 = player.inventory.length;
    tile('Cloth Tunic').click();
    out.equip = { worn: (player.equipped.armor || {}).baseName, oldInBag: player.inventory.slice(n0).some((i) => i.baseName === 'Threadbare Rags'), bag: player.inventory.length - n0 };
    // FULL: fill the Equip tab, then one more click
    setOpt('equip', false); tab('weapons');
    const cap = (player.invCap && player.invCap.equip) || 24; let guard = 0;
    while (devGiveGear('Wooden Sword').ok && guard++ < 200) {}
    const before = player.inventory.length; tile('Whittled Stick').click();
    out.full = { cap, before, after: player.inventory.length, log: (document.getElementById('dev-log').textContent || '').slice(-80) };
    out.pickups = pickups.length;
    window.trackPickup = oTP;
    return out;
  });
  ok('the console opens with the generator in it', R.open === true);
  ok('TABS: Weapons, Armor and Accessories, each with the pool\'s count, then Sets', R.tabs.length === 4 && /Sets · (\d+)$/.test(R.tabs[3]) && +R.tabs[3].match(/· (\d+)$/)[1] === R.setCount && /Weapons · (\d+)/.test(R.tabs[0]) && +R.tabs[0].match(/· (\d+)/)[1] === R.pool[0]
    && /Armor · /.test(R.tabs[1]) && +R.tabs[1].match(/· (\d+)/)[1] === R.pool[1] && /Accessories · /.test(R.tabs[2]) && +R.tabs[2].match(/· (\d+)/)[1] === R.pool[2], R.tabs.join(' | '));
  for (const c of ['weapons', 'armors', 'accessories']) {
    const s = R.sections[c];
    ok(`SECTIONS: ${c} - every piece under its class heading (any, warrior, rogue, mage, archer), and the warrior chip shows warrior pieces only`,
      s.all && s.heads === 'any class/⚔ warrior/🥷 rogue/🪄 mage/🏹 archer' && s.warrior, JSON.stringify(s));
  }
  const T = R.sets;
  ok('SETS: a section for every set - the five legendary and the five stat sets - each with exactly its pieces', T.heads && T.exact && T.stat, JSON.stringify({ heads: T.heads, exact: T.exact, stat: T.stat }));
  ok('SETS: set pieces name their set on the tile', T.tag === '◆ Galecrest', T.tag);
  ok('SETS: the Mage chip shows the mage\'s Galecrest (Rod, Featherweave, Plume) and there is no Any-class chip', T.mageGale === 'Galecrest Featherweave/Galecrest Plume/Galecrest Rod' && T.noAnyChip, T.mageGale);
  ok('SETS: Whole set puts exactly those three in the bag', T.whole === 'Galecrest Featherweave/Galecrest Plume/Galecrest Rod', T.whole);
  const C = R.catalog; ok('CATALOG: the Whittled Stick tile puts the exact catalog piece in the bag', C.n === 1 && C.name === 'Whittled Stick' && C.base === 'Whittled Stick' && C.slot === 'weapon' && C.stars === 0 && C.affixes === 0 && C.rarity === 'common', JSON.stringify(C));
  const D = R.rolled; ok('ROLLED: rolled + legendary + 5 stars makes an affixed Ring of Might drop', D.base === 'Ring of Might' && D.name !== 'Ring of Might' && /Ring of Might/.test(D.name) && D.slot === 'accessory' && D.stars === 5 && D.rarity === 'legendary' && D.affixes >= 3, JSON.stringify(D));
  const E = R.equip; ok('EQUIP: the Cloth Tunic goes on the hero and the Threadbare Rags into the bag', E.worn === 'Cloth Tunic' && E.oldInBag && E.bag === 1, JSON.stringify(E));
  const F = R.full; ok('FULL: a full Equip tab refuses the next piece and says so', F.before >= F.cap && F.after === F.before && /full/i.test(F.log), JSON.stringify(F));
  ok('QUIET: no made piece counted as a pickup', R.pickups === 0, R.pickups);
  // GATED: the same localhost page without ?dev=1 (and no LX_DEV)
  const p2 = await boot('');
  const G = await p2.evaluate(() => { openDevConsole(); return { modal: getComputedStyle(document.getElementById('dev-modal')).display, gear: !!document.getElementById('dev-gear') }; });
  ok('GATED: without developer mode the console and the generator stay closed', G.modal === 'none' && G.gear === false, JSON.stringify(G));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
