// REFORGE BENCH PICKER: choose the piece, see its sprite, confirm, reforge it.
// ============================================================================
// Per user: "reforge only allows selection of the equipment one at a time, it
// should allow selection of the equipped items and show a display of the item
// image for selection".
//
// Before, the bench picked ONE eligible piece at random behind a text confirm.
// Now reforgeRandomEquipment() opens #reforge-modal: the three equipped slots
// as cards with the item's sprite, the chosen piece floated large on the bench
// with its current affixes, an arm-then-confirm Reforge button, and a before ->
// after strip. Fixture: Lv 60 legendary gear in every slot (the accessory
// transcended, so ineligible) and 1,200 setshards.
// Run: node scripts/reforge_picker_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9861);
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const SERVE_JS = existsSync(path.join(SERVE_ROOT, 'serve.js')) ? path.join(SERVE_ROOT, 'serve.js') : path.join(ROOT, 'serve.js');
const server = spawn(process.execPath, [SERVE_JS, String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof reforgeRandomEquipment === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'Reforger').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 160) }; } };

// ---- fixture + open ---------------------------------------------------------
const open = await ev(() => {
  const mk = (cat, slot) => {
    const base = ITEM_POOL[cat].find((x) => x && x.name && (typeof _itemKey !== 'function' || _itemKey(x))) || ITEM_POOL[cat][0];
    const it = rollAffixedItem({ ...base, dropLevel: 60 }, 'legendary', 60);
    it.slot = slot; it.dropLevel = 60; it.stars = 3; return it;
  };
  player.equipped = player.equipped || {};
  player.equipped.weapon = mk('weapons', 'weapon');
  player.equipped.armor = mk('armors', 'armor');
  const acc = mk('accessories', 'accessory'); acc.transcended = true; player.equipped.accessory = acc;
  player.setshards = 1200;
  window._rfOldArmor = player.equipped.armor; window._rfOldWeapon = player.equipped.weapon;
  reforgeRandomEquipment();
  const m = document.getElementById('reforge-modal');
  return { shown: !!m && m.style.display === 'flex', paused: !!game.paused, cards: document.querySelectorAll('.reforge-card').length,
    selected: (document.querySelector('.reforge-card.selected .slotlbl') || {}).textContent || '', off: [...document.querySelectorAll('.reforge-card.off .why')].map((e) => e.textContent).join(' | '),
    confirmDialog: !!document.querySelector('#ui-confirm-modal, #ui-confirm, .ui-confirm') };
});
ok('reforgeRandomEquipment() opens the Reforge Bench picker (no text-confirm dialog) and pauses', !open.err && open.shown && open.paused, open.err || JSON.stringify(open));
ok('the rack shows all three equipped slots as cards', !open.err && open.cards === 3, `cards ${open.cards}`);
ok('the first eligible piece (weapon) is set on the bench by default', !open.err && /WEAPON/.test(open.selected), `selected "${open.selected}"`);
ok('the transcended accessory is dimmed with the reason, not silently hidden', !open.err && /Transcended/.test(open.off), open.off);

// ---- sprites ------------------------------------------------------------------
await page.waitForFunction(() => document.querySelectorAll('.reforge-card img').length >= 2, null, { timeout: 8000 }).catch(() => {});
const img = await ev(() => ({
  cardImgs: document.querySelectorAll('.reforge-card img').length,
  stageImg: !!document.querySelector('#reforge-stage-item img[width="96"]'),
  stageName: (document.querySelector('#reforge-preview .rf-name') || {}).textContent || '',
  weaponName: player.equipped.weapon.name,
}));
ok('the cards display the item images (sprite <img>, not just the emoji)', !img.err && img.cardImgs >= 2, img.err || `sprite imgs ${img.cardImgs}`);
ok('the bench floats the selected item\'s image at 96px with its name', !img.err && img.stageImg && img.stageName === img.weaponName, img.err || `stage img ${img.stageImg} "${img.stageName}"`);

// ---- selection + reforge --------------------------------------------------------
const sel = await ev(() => {
  const cards = [...document.querySelectorAll('.reforge-card')];
  cards[2].click();   // transcended: refused
  const stillWeapon = /WEAPON/.test((document.querySelector('.reforge-card.selected .slotlbl') || {}).textContent || '');
  cards[1].click();   // armor
  const armorNow = /ARMOR/.test((document.querySelector('.reforge-card.selected .slotlbl') || {}).textContent || '');
  const stageName = (document.querySelector('#reforge-preview .rf-name') || {}).textContent || '';
  const btn1 = (document.getElementById('do-reforge') || {}).textContent || '';
  document.getElementById('do-reforge').click();
  const btn2 = (document.getElementById('do-reforge') || {}).textContent || '';
  return { stillWeapon, armorNow, stageName, armorName: player.equipped.armor.name, btn1, btn2 };
});
ok('clicking the ineligible card is refused; clicking the armor card puts the armor on the bench', !sel.err && sel.stillWeapon && sel.armorNow && sel.stageName === sel.armorName, sel.err || JSON.stringify(sel));
ok('the Reforge button arms first (explicit confirm) instead of spending on one click', !sel.err && /^↻ Reforge/.test(sel.btn1) && /Confirm/.test(sel.btn2), sel.err || `"${sel.btn1}" -> "${sel.btn2}"`);
await page.evaluate(() => { const b = document.getElementById('do-reforge'); if (b) b.click(); });   // absent on the pre-picker build
await page.waitForTimeout(400);
const done = await ev(() => ({
  shards: player.setshards, armorNew: player.equipped.armor !== window._rfOldArmor, weaponSame: player.equipped.weapon === window._rfOldWeapon,
  stars: player.equipped.armor.stars, affixes: Array.isArray(player.equipped.armor.affixes), slot: player.equipped.armor.slot,
  last: !!document.querySelector('#reforge-preview .rf-last'), stillOpen: document.getElementById('reforge-modal').style.display === 'flex',
  benchName: (document.querySelector('#reforge-preview .rf-name') || {}).textContent || '', armorName: player.equipped.armor.name,
}));
ok('confirming reforges THE CHOSEN piece: armor re-rolled, weapon untouched, 500◈ spent', !done.err && done.armorNew && done.weaponSame && done.shards === 700, done.err || JSON.stringify(done));
ok('★ level, slot and affix structure survive the reforge', !done.err && done.stars === 3 && done.affixes && done.slot === 'armor', done.err || JSON.stringify(done));
ok('the bench stays open on the new piece with a before → after strip', !done.err && done.stillOpen && done.last && done.benchName === done.armorName, done.err || JSON.stringify(done));
const closed = await ev(() => { closeAllModals(); return document.getElementById('reforge-modal').style.display; });
ok('closeAllModals closes the bench', closed === 'none', `display ${closed}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
