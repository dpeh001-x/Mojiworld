// Dropped gear and boon orbs render their CUSTOM SPRITES on the canvas, not
// the emoji glyph.
//
// Per user: "For dropped gears and boons they appears as emojis on screen, they
// could be replaced with their actual custom images instead."
//
// The art and the HTML plumbing already existed — itemIconHtml/boonIconHtml
// have shown <img> in the inventory and boon panels for ages. Only the two
// canvas renderers still called fillText. So the thing worth testing is not
// "does a sprite exist" but "does the CANVAS path actually blit it".
//
// Both fallbacks are load-bearing and are tested too: sprites are probed lazily
// and decode async, so a drop landing on the first frames of a map — or an item
// with no authored art — must still show the emoji rather than a blank orb.
// A test that only checked the happy path would let a regression turn every
// early drop invisible.
// Run: node scripts/drop_sprite_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof drawDrops === 'function' && typeof drawPowerupOrbs === 'function'
  && typeof POWERUPS !== 'undefined', { timeout: 90000 });

// Pick a real gear item that HAS authored art, and a real boon, then wait for
// both sprites to decode. Without the wait the renderers legitimately fall back
// to emoji and the whole test would be measuring the fallback.
const ready = await page.evaluate(async () => {
  loadMap('town');
  // An equipment item whose catalog key resolves to a sprite.
  const mk = (name, slot) => ({ name, slot, rarity: 'epic', icon: '🗡' });
  const item = mk('Iron Sword', 'weapon');
  const boon = POWERUPS.find(p => p && p.id);
  // Kick both probes and wait for the decodes.
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const a = (typeof _itemSprite === 'function') ? _itemSprite(item) : null;
    // Gate on _boonIconUrl, which exists on BOTH builds - _boonSprite is new
    // here, so waiting on it made the old build time out in setup and never
    // reach the assertions. A control that fails before measuring proves
    // nothing about the change.
    const b = (typeof _boonIconUrl === 'function') ? _boonIconUrl(boon.id) : null;
    if (a && b) return { ok: true, boonId: boon.id, itemName: item.name };
    await new Promise(r => setTimeout(r, 120));
  }
  return { ok: false, boonId: boon && boon.id,
           item: (typeof _itemSprite === 'function') && !!_itemSprite(item),
           boon: (typeof _boonIconUrl === 'function') && !!_boonIconUrl(boon.id) };
});

const r = await page.evaluate((info) => {
  const spy = (fn) => {
    const blits = [], texts = [];
    const oDI = ctx.drawImage, oFT = ctx.fillText;
    ctx.drawImage = function (img, ...a) { blits.push({ src: String(img && img.src || ''), w: a[2], h: a[3] }); return oDI.apply(this, [img, ...a]); };
    ctx.fillText = function (t, ...a) { texts.push(String(t)); return oFT.apply(this, [t, ...a]); };
    try { fn(); } catch (e) { return { err: String(e).slice(0, 140) }; }
    finally { ctx.drawImage = oDI; ctx.fillText = oFT; }
    return { blits, texts };
  };

  loadMap('town');
  game.camera.x = 0;
  const item = { name: 'Iron Sword', slot: 'weapon', rarity: 'epic', icon: '\u{1F5E1}' };
  const boon = POWERUPS.find(p => p && p.id === info.boonId);

  game.drops = [{ x: 300, y: 400, vy: 0, type: 'item', item, life: 90000 }];
  const drops = spy(() => drawDrops());

  game.drops = [];
  game.powerupOrbs = [{ x: 300, y: 400, w: 26, h: 26, pw: boon, rarity: 'epic',
                        bob: 0, life: 30000, collected: false, vy: 0 }];
  const orbs = spy(() => drawPowerupOrbs());

  // FALLBACK: an item whose key resolves to no art must still print its emoji.
  game.powerupOrbs = [];
  game.drops = [{ x: 300, y: 400, vy: 0, type: 'item', life: 90000,
                  item: { name: 'Totally Not A Real Item ' + Math.random().toString(36).slice(2), slot: 'weapon', rarity: 'common', icon: '♦' } }];
  const fallback = spy(() => drawDrops());

  return { drops, orbs, fallback };
}, ready);

console.log(`\nsprites decoded before measuring: ${ready.ok}` + (ready.ok ? ` (${ready.itemName}, boon "${ready.boonId}")` : ` — ${JSON.stringify(ready)}`));
if (!ready.ok) { console.log('\nSETUP FAILED — the sprites never decoded, so nothing below would be meaningful.'); await browser.close(); process.exit(1); }
for (const k of ['drops', 'orbs', 'fallback']) if (r[k] && r[k].err) { console.log(`${k} threw: ${r[k].err}`); await browser.close(); process.exit(1); }

const eq = r.drops.blits.filter(b => /Sprites\/equipment\//.test(b.src));
const bn = r.orbs.blits.filter(b => /Sprites\/boons\//.test(b.src));

console.log('\nDROPPED GEAR USES ITS SPRITE');
check(eq.length > 0, 'the equipment sprite is blitted to the canvas', r.drops.blits.map(b => b.src.split('/').slice(-2).join('/')));
check(!r.drops.texts.includes('\u{1F5E1}'), 'and the emoji glyph is no longer stamped', r.drops.texts);

console.log('\nBOON ORBS USE THEIR SPRITE');
check(bn.length > 0, 'the boon sprite is blitted to the canvas', r.orbs.blits.map(b => b.src.split('/').slice(-2).join('/')));
check(bn.some(b => b.src.includes(ready.boonId + '.webp')), `it is the RIGHT boon (${ready.boonId})`, bn.map(b => b.src.split('/').pop()));

console.log('\nTHE EMOJI FALLBACK STILL WORKS (art missing / not yet decoded)');
check(r.fallback.blits.filter(b => /Sprites\/equipment\//.test(b.src)).length === 0,
      'an item with no authored art blits no equipment sprite', r.fallback.blits.map(b => b.src.split('/').pop()));
check(r.fallback.texts.includes('♦'), 'and falls back to its emoji rather than drawing nothing', r.fallback.texts);

console.log('\nTHE RARITY GLOW IS KEPT (the across-the-room colour cue)');
check(r.orbs.texts.some(t => /EPIC/.test(t)), 'boon orb still shows its rarity ribbon', r.orbs.texts);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
