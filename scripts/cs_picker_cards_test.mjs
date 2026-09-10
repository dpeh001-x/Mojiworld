// The character-creation picker cards: solid plates that stand out from the key art, custom
// icons in place of emoji, and part-art thumbnails in the hair / eye / mouth lists.
// Per user: "this needs to be better designed to stand out from the surrounding" and "use
// custom images instead of emojis".
//
//   node scripts/cs_picker_cards_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11213);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const bad404 = [];
page.on('response', (r) => { if (r.status() >= 400 && /Sprites\/ui\/cs\//.test(r.url())) bad404.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const EMOJI = /\p{Extended_Pictographic}/u;
  const modal = document.getElementById('class-select-modal');
  const sections = [...modal.querySelectorAll('.cs-picker-section')];
  const labels = [...modal.querySelectorAll('.cs-picker-section .cs-dropdown-label, .cs-picker-section .cs-section-label')];
  const icons = labels.map((l) => l.querySelector('img.cs-label-ico')).map((im) => im ? { src: (im.src || '').split('/').slice(-2).join('/'), ok: im.naturalWidth > 0 } : null);
  const dice = modal.querySelector('.cs-randomize-btn img.cs-dice-ico');
  const cs = getComputedStyle(sections[0]);
  const lists = {};
  for (const [id, tableName] of [['cs-dd-hair', 'HERO_VEC_HAIR_OPTIONS'], ['cs-dd-eye', 'HERO_VEC_EYE_OPTIONS'], ['cs-dd-mouth', 'HERO_VEC_MOUTH_OPTIONS']]) {
    const sel = document.getElementById(id);
    const wrap = sel.closest('.cs-dropdown-wrap');
    const trig = wrap.querySelector('.cs-dd-trigger');
    trig.click(); await wait(400);
    const items = [...wrap.querySelectorAll('.cs-dd-item')];
    const table = (0, eval)(tableName) || [];  // script-scope const, not a window property
    const thumbs = items.map((it) => it.querySelector('.cs-dd-thumb img'));
    lists[id] = {
      options: table.length, items: items.length,
      itemsWithThumb: thumbs.filter(Boolean).length,
      thumbsDecoded: thumbs.filter((im) => im && im.naturalWidth > 0).length,
      emojiItems: items.filter((it) => EMOJI.test(it.textContent)).length,
      firstItemText: items[0] ? items[0].textContent.trim() : '',
      trigEmoji: EMOJI.test(trig.textContent),
      trigThumb: !!trig.querySelector('.cs-dd-thumb img'),
      sampleShift: thumbs[0] ? thumbs[0].style.left + ' ' + thumbs[0].style.top + ' @ ' + thumbs[0].style.width : '',
    };
    trig.click(); await wait(150);
  }
  return {
    sections: sections.length,
    labelText: labels.map((l) => l.textContent.trim()),
    labelEmoji: labels.filter((l) => EMOJI.test(l.textContent)).length,
    icons, dice: dice ? { ok: dice.naturalWidth > 0 } : null,
    diceEmoji: EMOJI.test(modal.querySelector('.cs-randomize-btn').textContent),
    plate: { bg: cs.backgroundImage, border: cs.borderTopWidth + ' ' + cs.borderTopColor, shadow: cs.boxShadow },
    lists,
  };
});
await browser.close(); server.kill();

console.log('labels:', r.labelText.join(' | '));
for (const [id, l] of Object.entries(r.lists)) console.log(`  ${id}: ${l.items}/${l.options} items, thumbs ${l.itemsWithThumb} (decoded ${l.thumbsDecoded}), first "${l.firstItemText}", crop ${l.sampleShift}`);
const checks = [
  ['four picker cards', r.sections === 4, String(r.sections)],
  ['no emoji left in the card labels', r.labelEmoji === 0, r.labelText.join(' | ')],
  ['every label carries a decoded custom icon from Sprites/ui/cs', r.icons.length === 4 && r.icons.every((i) => i && i.ok && /^cs\/ico_/.test(i.src)), JSON.stringify(r.icons)],
  ['the dice button is a custom icon, not an emoji', !!(r.dice && r.dice.ok) && !r.diceEmoji],
  ['the card is a near-solid plate (violet slab, gold hairline, dark ring)',
    /rgba\(18, 12, 40, 0\.94\)/.test(r.plate.bg) && /^1px rgba\(255, 220, 140/.test(r.plate.border) && /rgba\(4, 2, 12, 0\.55\) 0px 0px 0px 1px/.test(r.plate.shadow),
    `${r.plate.border} | ${r.plate.shadow.slice(0, 90)}`],
  ['hair / eye / mouth lists mirror their tables 1:1', Object.values(r.lists).every((l) => l.items === l.options && l.items > 0)],
  ['every list item shows the part\'s own art, decoded', Object.values(r.lists).every((l) => l.itemsWithThumb === l.items && l.thumbsDecoded === l.items),
    Object.entries(r.lists).map(([k, l]) => `${k} ${l.thumbsDecoded}/${l.items}`).join(', ')],
  ['no emoji left in any list item or trigger', Object.values(r.lists).every((l) => l.emojiItems === 0 && !l.trigEmoji)],
  ['the trigger shows the chosen part\'s thumbnail', Object.values(r.lists).every((l) => l.trigThumb)],
  ['no 404 under Sprites/ui/cs', bad404.length === 0, bad404.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
