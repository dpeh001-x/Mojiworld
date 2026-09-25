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
//   6. every boon keycap is black; an equipped key has a hot-pink rim, an unequipped one a grey rim; the
//      art is at least 24px with a white sticker outline, in colour when equipped and greyscale when not
//   7. strength and tier: every keycap names its tier (k-common / k-rare / k-epic); --q is where the roll sits
//      in its level band (_boonBand), the pips count round(q x 5) (at least 1), a roll at 90%+ is k-top, and the
//      key's glow grows with q; a fixed-value boon (+1 Jump) has no --q and no pips; a maxed equipped boon says
//      TOP ROLL; unequipped cards stay black and white throughout
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
    keys: [...host.querySelectorAll('.bl-slot .bl-ico, .bl-card .bl-ico')].map((k) => { const cs = getComputedStyle(k), im = k.querySelector('img');
      const face = (cs.backgroundImage.match(/rgb\([^)]*\)/g) || []).pop() || ''; return { eq: !!k.closest('.is-eq'), face, rim: cs.outlineColor, w: im ? im.getBoundingClientRect().width : 0, f: im ? getComputedStyle(im).filter : '' }; }),
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
ok('1. equipped boons (slot and bag) are coloured, their art in full colour', A.eqCards.length === 2 && A.eqCards.every((c) => c > 40) && !/grayscale/.test(A.eqImg || 'x') && A.eqImg !== null, JSON.stringify([A.eqCards, A.eqImg]));
ok('1. unequipped boons and empty / locked slots are black and white, their art greyscale', A.colours.length === 0 && /grayscale/.test(A.bagImg || ''), JSON.stringify([A.colours, A.bagImg]));
ok('2. the chosen talent line takes the class colour (rogue ' + A.clsCol + ')', A.talent && A.talent.c === A.clsCol && A.talent.border > 40, JSON.stringify([A.talent, A.clsCol]));
ok('3. nothing in the loadout is italic', A.italic === 0, A.italic);
ok('5. punk: the heading is hot pink over an acid-yellow offset, equipped boons edged in the same pink', A.h3 && A.h3.color === 'rgb(255, 45, 149)' && /rgb\(243, 245, 66\)/.test(A.h3.shadow) && A.eqBorder.length === 2 && A.eqBorder.every((c) => c === 'rgb(255, 45, 149)'), JSON.stringify([A.h3, A.eqBorder]));
const dark = (c) => { const n = (c.match(/[\d.]+/g) || []).map(Number); return n.length >= 3 && Math.max(n[0], n[1], n[2]) <= 40; };
const grey = (c) => { const n = (c.match(/[\d.]+/g) || []).map(Number); return n.length >= 3 && Math.max(n[0], n[1], n[2]) - Math.min(n[0], n[1], n[2]) <= 16; };
ok('6. every keycap is black; equipped keys rimmed pink, unequipped keys rimmed grey', A.keys.length >= 5 && A.keys.every((k) => dark(k.face)) && A.keys.filter((k) => k.eq).every((k) => k.rim === 'rgb(255, 45, 149)') && A.keys.filter((k) => !k.eq).every((k) => grey(k.rim)), JSON.stringify(A.keys.map((k) => [k.eq, k.face, k.rim])));
ok('6. the art stands out: at least 24px, a white sticker outline, colour when equipped, greyscale when not', A.keys.every((k) => k.w >= 23.5 && /drop-shadow\(rgb\(255, 255, 255\)/.test(k.f) && (k.eq ? !/grayscale/.test(k.f) : /grayscale/.test(k.f))), JSON.stringify(A.keys.map((k) => [k.eq, Math.round(k.w), k.f.slice(0, 60)])));
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
const T = await page.evaluate(async () => {
  player.boons = [['skin', 8], ['atk_p', 3], ['ls', 6], ['blink', 130], ['crit', 25], ['thorns', 35], ['jmp', 1], ['execute', 9]].map(([id, roll]) => ({ id, roll, rerolls: 0 }));
  player.boonsEquipped = [0, 1]; game._boonBulk = false; game._boonSel = new Set(); renderBoonPanel(); await new Promise((r) => setTimeout(r, 300));
  const host = document.getElementById('lp-boons');
  const chroma = (v) => { let n = (v.match(/[\d.]+/g) || []).map(Number); if (/^color\(srgb/.test(v)) n = n.map((x, i) => (i < 3 ? x * 255 : x)); if (n.length < 3 || (n.length > 3 && n[3] === 0)) return 0; return Math.max(n[0], n[1], n[2]) - Math.min(n[0], n[1], n[2]); };
  const cards = [...host.querySelectorAll('.bl-card')].map((c) => { const k = c.querySelector('.bl-ico'), b = player.boons.find((x) => getBoonDef(x).name === c.querySelector('.bl-name').textContent.trim()), d = getBoonDef(b), band = _boonBand(d);
    const want = band.hi > band.lo ? Math.max(0, Math.min(1, (b.roll - band.lo) / (band.hi - band.lo))) : null; const blur = +((getComputedStyle(k).filter.match(/(\d+(?:\.\d+)?)px\)\s*$/) || [])[1] || 0);
    return { name: d.name, tier: d.tier, eq: c.classList.contains('is-eq'), cls: k.className, q: k.style.getPropertyValue('--q') ? +k.style.getPropertyValue('--q') : null, want, pips: c.querySelectorAll('.bl-q i.on').length, pipsN: c.querySelectorAll('.bl-q i').length, blur, top: !!c.querySelector('.bl-top') }; });
  const grey = [...host.querySelectorAll('.bl-card:not(.is-eq), .bl-card:not(.is-eq) *')].filter((e) => e.tagName !== 'IMG' && !e.closest('.lx-emo') && !(e.classList && e.classList.contains('coin-ico'))).filter((e) => ['color', 'backgroundColor', 'borderTopColor'].some((k) => chroma(getComputedStyle(e)[k]) > 16)).length;
  return { cards, grey };
});
const C = T.cards, by = (n) => C.find((c) => c.name === n) || {};
ok('7. every keycap names its tier; --q is the roll\'s place in its band; pips = round(q x 5)', C.length === 8 && C.every((c) => c.cls.includes('k-' + c.tier) && (c.want == null ? c.q == null && c.pipsN === 0 : Math.abs(c.q - c.want) < 0.006 && c.pipsN === 5 && c.pips === Math.max(1, Math.round(c.want * 5)))), JSON.stringify(C.map((c) => [c.name, c.cls, c.q, c.want && +c.want.toFixed(2), c.pips])));
ok('7. a 90%+ roll is k-top, and the glow grows with the roll', C.every((c) => c.cls.includes('k-top') === (c.want != null && c.want >= 0.9)) && by('Sharp Eye').blur > by('Thorns').blur && by('Thorns').blur > by('Lifesteal').blur && by('Second Skin').blur > by('Iron Muscles').blur, JSON.stringify(C.map((c) => [c.name, c.blur])));
ok('7. a fixed-value boon has no strength read; a maxed equipped boon says TOP ROLL; unequipped stay black and white', by('Leap Boost').q == null && by('Leap Boost').pipsN === 0 && by('Second Skin').top && !by('Iron Muscles').top && T.grey === 0, JSON.stringify([by('Leap Boost'), by('Second Skin').top, T.grey]));
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close(); srv.kill();
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.pass ? '' : '  -- ' + r.x));
const np = results.filter((r) => r.pass).length;
console.log('\n' + np + '/' + results.length + ' passed');
process.exit(np === results.length ? 0 : 1);
