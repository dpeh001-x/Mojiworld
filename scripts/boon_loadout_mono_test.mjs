// The Boons tab's loadout in black and white, with only what is equipped in colour.
//
// Per user: "This portion of the boon UI can be redesigned and stylised black and white except for those
// that are equipped". The panel's markup was rewritten to classes (bl-*) with the logic left alone, so
// this pins the look and that every control still does its job:
//   (since the punk pass - per user: "the base design can be more punk like this image" - the chrome is hot
//   pink and acid yellow; the rule for the boons themselves holds)
//   1. equipped boons - in their slots and in the bag - are coloured (a hot-pink border with a yellow
//      offset) with their art in full colour; unequipped bag cards and empty / locked slots are grey (no
//      computed text, fill or border colour with more than 16/255 of chroma) and their art greyscale
//   2. the chosen talent line takes the class's colour (CLASSES[cls].color)
//   3. nothing in the loadout is italic
//   4. Equip fills a free slot, Unequip empties it, Bulk discard ticks and discards through the confirm
//   5. the punk chrome: the heading hot pink printed over an acid-yellow offset
//   node scripts/boon_loadout_mono_test.mjs        (MOJI_GAME_FILE to test a candidate)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT || process.argv[2]; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openLevelUpPanel === 'function' && typeof renderBoonPanel === 'function', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal, #everdawn-welcome-overlay').forEach((e) => e.remove());
  player.cls = 'rogue'; player.level = 60; player.job = 'assassin'; player.master = null; player.invulnerable = 9e9;
  player.talents = { assassin: _lxTalentTable('assassin')[0].id };
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
  player.boons = POWERUPS.slice(0, 5).map((d) => ({ id: d.id, roll: d.max, rerolls: 0 }));
  player.boonsEquipped = [0]; player.mojicoins = 50000;
  loadMap('town', 300); game.paused = false;
});
await page.waitForTimeout(2500);
const read = () => page.evaluate(async () => {
  document.querySelectorAll('#lx-pause, #everdawn-welcome-overlay').forEach((e) => e.remove());
  game._uTab = 'boons'; openLevelUpPanel(); renderBoonPanel();
  await new Promise((r) => setTimeout(r, 300));
  const host = document.getElementById('lp-boons');
  // color-mix() computes as color(srgb r g b / a) with channels 0-1
  const chroma = (v) => { let n = (v.match(/[\d.]+/g) || []).map(Number); if (/^color\(srgb/.test(v)) n = n.map((x, i) => (i < 3 ? x * 255 : x)); if (n.length < 3 || (n.length > 3 && n[3] === 0)) return 0; return Math.max(n[0], n[1], n[2]) - Math.min(n[0], n[1], n[2]); };
  const zone = [...host.querySelectorAll('.bl-slot:not(.is-eq), .bl-slot:not(.is-eq) *, .bl-card:not(.is-eq), .bl-card:not(.is-eq) *')]
    .filter((e) => e.tagName !== 'IMG' && !e.closest('.lx-emo') && !(e.classList && (e.classList.contains('coin-ico') || e.classList.contains('lx-emo'))));
  const colours = [];
  for (const e of zone) { const cs = getComputedStyle(e); for (const k of ['color', 'backgroundColor', 'borderTopColor']) if (chroma(cs[k]) > 16) colours.push((e.className || e.tagName) + ' ' + k + ' ' + cs[k]); }
  const img = (sel) => { const i = host.querySelector(sel); return i ? getComputedStyle(i).filter : null; };
  const eqCards = [...host.querySelectorAll('.bl-slot.is-eq, .bl-card.is-eq')].map((e) => chroma(getComputedStyle(e).borderTopColor));
  const talent = host.querySelector('.bl-talent.is-eq');
  const italic = [...host.querySelectorAll('.bl-talent, .bl-talent *, .bl-head, .bl-head *, .bl-slots *, .bl-syn *, .bl-tools *, .bl-bag-grid *, .bl-foot, .bl-foot *')].filter((e) => getComputedStyle(e).fontStyle === 'italic').length;
  return {
    h3: (() => { const h = host.querySelector('.bl-head h3'); if (!h) return null; const cs = getComputedStyle(h); return { color: cs.color, shadow: cs.textShadow }; })(),
    eqBorder: [...host.querySelectorAll('.bl-slot.is-eq, .bl-card.is-eq')].map((e) => getComputedStyle(e).borderTopColor),
    slots: host.querySelectorAll('.bl-slot').length, eqSlots: host.querySelectorAll('.bl-slot.is-eq').length, eqCards, colours: colours.slice(0, 6),
    eqImg: img('.bl-slot.is-eq .bl-ico img'), bagImg: img('.bl-card:not(.is-eq) .bl-ico img'),
    talent: talent ? { c: talent.style.getPropertyValue('--c').trim(), border: chroma(getComputedStyle(talent).borderTopColor) } : null, clsCol: CLASSES[player.cls].color, italic,
    equipped: player.boonsEquipped.slice(),
  };
});
const A = await read();
ok('the loadout renders its slots', A.slots >= 1 && A.eqSlots === 1, JSON.stringify([A.slots, A.eqSlots]));
ok('1. equipped boons (slot and bag) are coloured, their art in full colour', A.eqCards.length === 2 && A.eqCards.every((c) => c > 40) && A.eqImg === 'none', JSON.stringify([A.eqCards, A.eqImg]));
ok('1. unequipped boons and empty / locked slots are black and white, their art greyscale', A.colours.length === 0 && /grayscale/.test(A.bagImg || ''), JSON.stringify([A.colours, A.bagImg]));
ok('2. the chosen talent line takes the class colour (rogue ' + A.clsCol + ')', A.talent && A.talent.c === A.clsCol && A.talent.border > 40, JSON.stringify([A.talent, A.clsCol]));
ok('3. nothing in the loadout is italic', A.italic === 0, A.italic);
ok('5. punk: the heading is hot pink over an acid-yellow offset, equipped boons edged in the same pink', A.h3 && A.h3.color === 'rgb(255, 45, 149)' && /rgb\(243, 245, 66\)/.test(A.h3.shadow) && A.eqBorder.length === 2 && A.eqBorder.every((c) => c === 'rgb(255, 45, 149)'), JSON.stringify([A.h3, A.eqBorder]));
// 4. the controls
const E = await page.evaluate(async () => {
  const host = document.getElementById('lp-boons'), out = {};
  host.querySelector('[data-equip="2"]').click(); await new Promise((r) => setTimeout(r, 200));
  out.afterEquip = player.boonsEquipped.slice();
  document.getElementById('lp-boons').querySelector('[data-unequip="0"]').click(); await new Promise((r) => setTimeout(r, 200));
  out.afterUnequip = player.boonsEquipped.slice();
  document.getElementById('boon-bulk-toggle').click(); await new Promise((r) => setTimeout(r, 150));
  out.bulkOn = !!game._boonBulk && !!document.querySelector('#lp-boons [data-pick]');
  const n0 = player.boons.length, pick = document.querySelector('#lp-boons [data-pick]');
  pick.click(); await new Promise((r) => setTimeout(r, 150));
  out.ticked = game._boonSel.size;
  document.getElementById('boon-sel-discard').click(); await new Promise((r) => setTimeout(r, 300));
  const yes = document.getElementById('confirm-yes'); if (yes) yes.click(); await new Promise((r) => setTimeout(r, 300));
  out.discarded = n0 - player.boons.length;
  return out;
});
ok('4. Equip fills a free slot, Unequip empties it', JSON.stringify(E.afterEquip) === '[0,2]' && JSON.stringify(E.afterUnequip) === '[2]' || (E.afterEquip.length === 2 && E.afterUnequip.length === 1 && !E.afterUnequip.includes(0)), JSON.stringify([E.afterEquip, E.afterUnequip]));
ok('4. Bulk discard ticks a boon and discards it through the confirm', E.bulkOn && E.ticked === 1 && E.discarded === 1, JSON.stringify(E));
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close(); srv.kill();
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.pass ? '' : '  -- ' + r.x));
const np = results.filter((r) => r.pass).length;
console.log('\n' + np + '/' + results.length + ' passed');
process.exit(np === results.length ? 0 : 1);
