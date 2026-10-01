// ART GAPS - every piece of new art is reachable from the code that draws it.
// ============================================================================
// Per user ("Work on Art plus a small code hook all of them", "Etc inventory tab should have generated art",
// "Cosmetics ... nothing draws them yet, so this needs a renderer too", "Drops straight in"). Each check goes
// through the game's own lookup and then asks the server for the file, so a hook pointing at a path that
// does not exist fails here rather than quietly falling back to an emoji:
//   crests     a master shows its own crest (_crestIdFor prefers it)
//   sigils     all twelve Zodiac Sigils, built exactly as the boss drop builds them, resolve item art,
//              and the Etc tab renders that art
//   buffs      the eight buffs that had none have buff_<key> art through the skill-icon loader
//   sets       every gear set has an emblem;  synergies: every synergy has art;  pins: three regions
//   backdrops  ten maps draw their own plate - the Hall of Echoes (a void map) included
//   cosmetics  the 12 unlocks have art, locked ones stay off, and a worn weapon skin is what the hero draws
//   libra      the scale lanterns and stormcallers draw their own art, not the borrowed type's
// Run: node scripts/art_gaps_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9961);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: process.env.MOJI_PW_EXE ? undefined : 'msedge', executablePath: process.env.MOJI_PW_EXE || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Gaps');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const keep = () => { player.hp = getMaxHp(); player.invulnerable = 600; game.paused = false; for (let i = 0; i < 6; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; } };
  const src = (html) => { const m = /src="([^"]+)"/.exec(html || ''); return m ? m[1] : null; };
  const head = async (u) => { try { const r = await fetch(u, { method: 'GET', cache: 'no-store' }); return r.ok; } catch (e) { return false; } };
  const missing = async (urls) => { const bad = []; for (const u of urls) if (!u || !(await head(u))) bad.push(u); return bad; };
  const until = async (fn, ms) => { const t = performance.now(); while (performance.now() - t < ms) { const v = fn(); if (v) return v; keep(); await frame(); } return null; };
  const out = {};
  // crests
  const masters = [..._MASTER_CREST_FILES];
  out.crestPrefers = _crestIdFor('warrior', 'berserker', 'warlord') === 'warlord' && _crestIdFor('warrior', 'berserker', null) === 'berserker';
  out.crestN = masters.length; out.crestMiss = await missing(masters.map(id => src(_crestImgHTML(id, '?', 40))));
  // sigils: built the way the boss drop builds them
  const sig = ZODIAC_SIGNS.map(z => ({ name: `${_lxZodiacSign(z)} Sigil`, icon: z.glyph || '*', type: 'etc', zodiacSigil: z.id, rarity: 'epic' }));
  out.sigilN = sig.length; out.sigilMiss = await missing(sig.map(it => { const u = src(itemIconHtml(it, 40)); return u && /_sigil\.webp/.test(u) ? u : null; }));
  player.inventory = (player.inventory || []).concat(sig.slice(0, 3));
  game._invTab = 'etc'; try { renderInventory(''); } catch (e) { out.invErr = String(e); }
  out.etcImgs = [...document.querySelectorAll('.inv-slot img')].filter(i => /_sigil\.webp/.test(i.getAttribute('src') || '')).length;
  // buffs
  const BUFFS = ['healLock', 'potionSeal', 'hallowedField', 'necromancer', 'aegisShield', 'maelstromGuard', 'comboAtk', 'comboXp'];
  out.buffRows = BUFFS.filter(k => (BUFF_META.find(b => b.key === k) || {}).skill === 'buff_' + k).length;
  for (const k of BUFFS) _skillIconUrl('buff_' + k);
  await until(() => BUFFS.every(k => _skillIconUrl('buff_' + k)), 6000);
  out.buffMiss = await missing(BUFFS.map(k => _skillIconUrl('buff_' + k)));
  // sets, synergies, pins
  const setIds = Object.keys(SETS); out.setN = setIds.length; out.setMiss = await missing(setIds.map(id => src(_setIconHtml(id, 16))));
  out.synNoArt = BOON_SYNERGIES.filter(s => !s.art).map(s => s.key); out.synMiss = await missing(BOON_SYNERGIES.filter(s => s.art).map(s => 'Sprites/boons/' + s.art + '.webp'));
  const PINS = ['verdantHaven', 'fieryHideout', 'gloomsporeVerge'];
  out.pinIds = PINS.filter(id => WM_REGION_ICON_IDS.has(id)).length; out.pinMiss = await missing(PINS.map(id => 'Sprites/world/regions/' + id + '.webp'));
  // backdrops
  const BG = { ancient: 'elderwoodGrove', verdantHaven: 'verdantHaven', fieryHideout: 'fieryHideout', stormCrest: 'stormCrest', bloomhaven: 'bloomhaven', gloomsporeVerge: 'gloomsporeVerge', ossuarySprawl: 'ossuarySprawl', boneGraveyard: 'mossyReaches', boneGraveyard2: 'sunderedCatacomb', boss_rush: 'hallOfEchoes' };
  out.bgWrong = Object.entries(BG).filter(([m, k]) => !MAPS[m] || MAPS[m].bg !== k || !BG_IMAGES[k]).map(([m]) => m);
  out.bgMiss = await missing(Object.values(BG).map(k => 'backgrounds/bg_v4_' + k + '.webp'));   // plates load on map entry, so existence here and the draw below
  const drawn = new Set(), orig = CanvasRenderingContext2D.prototype.drawImage;
  // any canvas: plates and mobs reach the screen through offscreen caches
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) { try { if (img && img.src) drawn.add(img.src.split('/').pop()); } catch (e) {} return orig.call(this, img, ...a); };
  out.bgDrawn = {};
  for (const m of Object.keys(BG)) { drawn.clear(); loadMap(m, 300); await until(() => drawn.has('bg_v4_' + BG[m] + '.webp'), 4000); out.bgDrawn[m] = drawn.has('bg_v4_' + BG[m] + '.webp'); }
  loadMap('forest', 300); game.monsters.length = 0;
  // cosmetics
  const HAIR = ['flameTips', 'mintFrost', 'twilight', 'royalGold'], CAPES = ['cape_shadow', 'cape_ember', 'cape_frost', 'cape_astral'];
  out.hairOpts = HAIR.filter(id => HERO_VEC_HAIR_OPTIONS.some(o => o.id === id && o.cos)).length;
  out.cosMiss = await missing(HAIR.map(id => LX_HAIR[id] && LX_HAIR[id].src).concat(CAPES.map(id => LX_CAPE[id] && LX_CAPE[id].src)));
  const bk = window._lxBakedDownscale, baked = new Set();   // big equipment art draws through a bitmap bake, which has no src
  window._lxBakedDownscale = function (img) { try { if (img && img.src) baked.add(img.src.split('/').pop()); } catch (e) {} return bk.apply(this, arguments); };
  // capes (per user: 'thin black outline', 'repositioned better', 'more alike the shadow or astral cape'): the stock Short Cape carries a
  // placement; the four cosmetic capes are Hooded Cloak restyles and drape as it does (no row of their own); every new cape has an inked edge
  out.shortGone = !LX_CAPE.short_cape && !(await head('Sprites/character/cape/short_cape.webp')) && ![...document.querySelectorAll('#eq-cape button')].some((b) => b.title === 'short_cape');
  const hl = _heroVecRestPos('handL').x;   // the weapon hand, in the same mirrored body space as the cape's dx
  out.capeShift = ['hooded_cloak'].concat(CAPES).map((k) => k + ':' + (LX_EQ_ATTACH[k] ? LX_EQ_ATTACH[k].dx : 'none')).join(' ');
  out.capeToWeapon = ['hooded_cloak'].concat(CAPES).every((k) => LX_EQ_ATTACH[k] && LX_EQ_ATTACH[k].dx !== 0 && Math.sign(LX_EQ_ATTACH[k].dx) === Math.sign(hl) && Math.abs(LX_EQ_ATTACH[k].dx) <= 5);
  out.capeInk = {};
  for (const k of ['hooded_cloak'].concat(CAPES)) { const im = LX_CAPE[k]; try { await im.decode(); } catch (e) {} const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0); const d = cx.getImageData(0, 0, cv.width, cv.height).data, W = cv.width; let hit = 0, inked = 0;
    for (let y = 0; y < cv.height; y += 3) for (const dir of [1, -1]) { let x = dir > 0 ? 0 : W - 1; while (x >= 0 && x < W && d[(y * W + x) * 4 + 3] < 128) x += dir; if (x < 0 || x >= W) continue; hit++; const i = (y * W + x + dir * 2) * 4; if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 60) inked++; }
    out.capeInk[k] = hit ? Math.round(inked / hit * 100) : 0; }
  // per user: 'ensure that the cloaks are placed behind the armors in layer' - the layer order inside a real hero draw
  { const dl = window._drawEquipmentLayer, seq = [], hc = document.createElement('canvas'); hc.width = 200; hc.height = 200; const hx = hc.getContext('2d'); hx.translate(100, 190); hx.scale(3, 3);
    window._drawEquipmentLayer = function (layer, t, o) { seq.push(layer + (o && o.onlyLayer ? ':' + o.onlyLayer : '')); return dl.apply(this, arguments); };
    const pv = _LX_EQ_PREVIEW_OVERRIDE; _LX_EQ_PREVIEW_OVERRIDE = { cape: { spriteId: 'cape_ember', tint: null }, body_top: { spriteId: 'arm:warlord_cuirass', tint: null } };
    try { _drawVectorHero(-14, -44, hx, { cls: 'warrior', lookCustom: player.lookCustom, animName: 'idle', animTime: 0 }); } finally { _LX_EQ_PREVIEW_OVERRIDE = pv; window._drawEquipmentLayer = dl; }
    out.layerSeq = seq.join(','); out.capeSlots = (LX_EQ_SLOT_ORDER.back || []).includes('cape') && (LX_EQ_SLOT_ORDER.mid || []).includes('body_top'); }
  const skins = []; for (const s of ['crystal', 'void', 'sunfire', 'heirloom']) for (const sh of ['sword', 'dagger', 'staff', 'bow']) skins.push('Sprites/equipment/skins/' + s + '_' + sh + '.webp');
  out.skinMiss = await missing(skins);
  out.shapes = ['warrior', 'rogue', 'mage', 'archer'].map(c => _lxWeaponShapeOf({ cls: c })).join(',');
  const def = (ITEM_POOL.weapons || []).find(w => w.name === 'Iron Sword');
  player.equipped = player.equipped || {}; player.equipped.weapon = Object.assign({}, def);
  player.cosmetics = { hair: {}, cape: {}, weapon: {} }; player.look = player.look || {}; player.look.weaponSkin = 'crystal';
  out.lockedOff = _lxWeaponSkinNow() === null;
  player.cosmetics.weapon.crystal = true;
  const wsk = await until(() => _lxWeaponSkinFor(player.equipped.weapon), 6000);
  out.skinKey = wsk ? wsk.img.src.split('/').pop() : null; out.heroArt = _lxHeroHasEquipWeaponArt();
  drawn.clear(); baked.clear(); const seen = () => out.skinKey && (drawn.has(out.skinKey) || baked.has(out.skinKey));
  await until(seen, 3000); out.skinDrawn = !!seen(); window._lxBakedDownscale = bk;
  // co-op: my skin rides the avatar wire as wk, and while a partner is drawn THEIR skin (or none) wins over mine
  const _wire = _mpAvatarWire() || {}; out.hasLook = !!_wire.look; out.wireWk = (_wire.look || {}).wk || null;
  window._LX_WSKIN_OVERRIDE = 'void'; out.peerSkin = _lxWeaponSkinNow(); window._LX_WSKIN_OVERRIDE = null; out.peerNone = _lxWeaponSkinNow();
  window._LX_WSKIN_OVERRIDE = undefined; out.ownBack = _lxWeaponSkinNow();
  // libra adds
  out.libra = {};
  for (const [type, key] of [['lanternWisp', 'scaleLanternA'], ['lanternWisp', 'scaleLanternB'], ['towerStormcaller', 'scaleStormcaller']]) {
    game.monsters.length = 0; const m = spawnMonster(player.x + 220, player.y - 40, type, false); if (!m) { out.libra[key] = 'no spawn'; continue; }
    m._artKey = key; m.atk = 0;
    const k = await until(() => _lxMobArtKey(m) === key, 8000);
    drawn.clear(); await until(() => [...drawn].some(f => f.startsWith(key)), 3000);
    out.libra[key] = (k ? 'key ' : 'NO KEY ') + ([...drawn].some(f => f.startsWith(key)) ? 'drawn' : 'NOT DRAWN') + ([...drawn].some(f => f.startsWith(type + '_') || f === type + '.webp') ? ' +base' : '');
  }
  CanvasRenderingContext2D.prototype.drawImage = orig; game.monsters.length = 0;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const none = (a) => Array.isArray(a) && a.length === 0;
ok('a master shows its own crest, a job its job crest', R.crestPrefers);
ok('every master crest file exists (17)', R.crestN === 17 && none(R.crestMiss), `${R.crestN} masters; missing ${JSON.stringify(R.crestMiss)}`);
ok('all twelve Zodiac Sigils resolve to their own art', R.sigilN === 12 && none(R.sigilMiss), `missing ${JSON.stringify(R.sigilMiss)}`);
ok('the Etc tab draws sigil art', R.etcImgs >= 3 && !R.invErr, `${R.etcImgs} sigil <img>s ${R.invErr || ''}`);
ok('the eight buffs name buff_<key> art and it exists', R.buffRows === 8 && none(R.buffMiss), `${R.buffRows}/8 rows; missing ${JSON.stringify(R.buffMiss)}`);
ok('every gear set has an emblem', R.setN >= 5 && none(R.setMiss), `${R.setN} sets; missing ${JSON.stringify(R.setMiss)}`);
ok('every synergy has emblem art', none(R.synNoArt) && none(R.synMiss), `no art: ${JSON.stringify(R.synNoArt)}; missing ${JSON.stringify(R.synMiss)}`);
ok('three regions get world-map pins', R.pinIds === 3 && none(R.pinMiss), `${R.pinIds}/3; missing ${JSON.stringify(R.pinMiss)}`);
ok('ten maps point at their own plate', none(R.bgWrong), JSON.stringify(R.bgWrong));
ok('...and every plate file exists', none(R.bgMiss), JSON.stringify(R.bgMiss));
ok('each of the ten maps draws its plate - the void Hall of Echoes too', Object.values(R.bgDrawn).length === 10 && Object.values(R.bgDrawn).every(Boolean), JSON.stringify(R.bgDrawn));
ok('4 cosmetic hairstyles in the picker, hair + cape art exists', R.hairOpts === 4 && none(R.cosMiss), `${R.hairOpts}/4; missing ${JSON.stringify(R.cosMiss)}`);
ok('the Short Cape is gone - no registry entry, no file, no picker button (per user)', R.shortGone);
ok('every cape sits a few px toward the weapon arm (per user)', R.capeToWeapon, R.capeShift);
ok('every cape - the Hooded Cloak and the four unlocks - has an inked outline (>= 90% of edge crossings land on near-black)', Object.values(R.capeInk).length === 5 && Object.values(R.capeInk).every((v) => v >= 90), JSON.stringify(R.capeInk));
ok('cloaks are drawn BEHIND armour: the back layer (capes) comes before the armour top in a real hero draw', R.capeSlots && R.layerSeq.split(',').indexOf('back') >= 0 && R.layerSeq.split(',').indexOf('back') < R.layerSeq.split(',').indexOf('mid:body_top'), R.layerSeq);
ok('all 16 weapon-skin files exist', none(R.skinMiss), JSON.stringify(R.skinMiss));
ok('weapon shapes follow the class', R.shapes === 'sword,dagger,staff,bow', R.shapes);
ok('a LOCKED skin is never worn', R.lockedOff);
ok('an unlocked, worn skin is what the hero draws', R.skinKey === 'crystal_sword.webp' && R.heroArt && R.skinDrawn, `${R.skinKey} heroArt ${R.heroArt} drawn ${R.skinDrawn}`);
// '+base' is allowed: spawning warms the TYPE's sprite cache before the art key takes over, which is not a frame on screen
ok('co-op: the worn skin rides the avatar wire', R.wireWk === 'crystal', 'look ' + R.hasLook + ' wk ' + R.wireWk);
ok('co-op: a partner is drawn with THEIR skin, or none - never mine', R.peerSkin === 'void' && R.peerNone === null && R.ownBack === 'crystal', JSON.stringify([R.peerSkin, R.peerNone, R.ownBack]));
for (const k of ['scaleLanternA', 'scaleLanternB', 'scaleStormcaller']) ok(`Libra's ${k} draws its own art`, /^key drawn/.test(R.libra[k] || ''), R.libra[k]);
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
