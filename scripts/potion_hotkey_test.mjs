#!/usr/bin/env node
// Potion hotkey and potion seals. Per user: "Another bug, I am unable to use my potions (when i press the hotkey)"
// (v0.30.614), then "potions seal should not last longer than 15s. Ensure that players can use potions when not
// sealed" (v0.30.621).
//
//  1. Aquarius's seal: 15 s, never extended while up, 15 s grace after, lifted by a map change, and never read as
//     longer than 15 s whatever wrote it. The lapse is waited out on the game's own clock, not faked.
//  2. Gravitos's heal lock: 10 s a landing, but a continuous lock ends within 15 s of its start and is followed by
//     the same grace. MP potions pass it (it refuses HP raises only).
//  3. The hotkey never fails silently: Disabled says so, a missing slot is repaired, a rebound key names the live key.
//  4. The seal shows as a POTIONS SEALED pill while it is up, and not after.
// Drinks are counted by STOCK consumed (HP regen moves HP inside a wait). Toasts are captured.
//   node scripts/potion_hotkey_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10374); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof useQuickPotion === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(900); game.monsters.length = 0;
    const toasts = []; const _st = window.showToast; window.showToast = (t, k) => { toasts.push(String(t)); return _st ? _st(t, k) : undefined; };
    const has = (n) => { try { return eval(n); } catch (e) { return null; } };
    const o = { ver: GAME_VERSION, maxF: has('LX_SEAL_MAX_F'), graceF: has('LX_SEAL_GRACE_F'), sealF: has('LX_AQUARIUS_SEAL_F'), aGraceF: has('LX_AQUARIUS_SEAL_GRACE_F') };
    const reset = () => { game.paused = false; player._god = false; player.hp = Math.floor(getMaxHp() * 0.4); player.mp = Math.floor(getMaxMp() * 0.4); player._potionCdHp = 0; player._potionCdMp = 0;
      player._potionLockUntil = 0; player._potionSealNextAt = 0; player._potionLockMap = null; player._healLockUntil = 0; player._healLockNextAt = 0; player._healLockStart = 0;
      player.consumables = player.consumables || {}; player.consumables.hp_s = 9; player.consumables.mp_s = 9; player.blockTimer = 0; player.invulnerable = 0; player.lastHitTime = -9999; toasts.length = 0; };
    const press = async (key) => { window.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true })); await sleep(250); };
    const drink = async (key, id) => { player._potionCdHp = 0; player._potionCdMp = 0; const s0 = player.consumables[id] | 0; await press(key); return s0 - (player.consumables[id] | 0); };
    const aquaHit = async () => {   // a real Aquarius projectile through the impact resolver; retried, because evasion can dodge one
      for (let a = 0; a < 5; a++) {
        player.invulnerable = 0; player.lastHitTime = -9999; player.parryWindow = 0; player.maxHp = Math.max(player.maxHp, 400000); if (player.hp < 1000) player.hp = 100000; const before = player.hp;
        game.projectiles.push({ x: player.x + player.w / 2 - 6, y: player.y + player.h / 2 - 6, vx: 0, vy: 0, w: 12, h: 12, life: 120, damage: 400, owner: 'enemy', skill: 'mbolt', color: '#fff', _zodiacAttacker: true, _zodiacSign: 'aquarius' });
        for (let i = 0; i < 30 && player.hp >= before; i++) await sleep(20); game.projectiles.length = 0; player.invulnerable = 0; player.lastHitTime = -9999;
        if (player.hp < before) return true;
      }
      return false;
    };
    const pill = () => !!document.querySelector('.moji-buff-pill[data-buff="potionSeal"]');
    // 1. defaults drink
    reset(); o.def = { hp: await drink('PageUp', 'hp_s'), toasts: toasts.slice() }; reset(); o.defMp = await drink('PageDown', 'mp_s');
    // 2. a real seal: 15 s, refused with a toast, not extended, shown as a pill
    reset(); o.seal = { hit: await aquaHit() }; o.seal.until = (player._potionLockUntil | 0) - (game.time | 0); o.seal.next = (player._potionSealNextAt | 0) - (player._potionLockUntil | 0);
    o.seal.toast = toasts.find((t) => /SEALED/.test(t)) || ''; await sleep(400); o.seal.pill = pill();
    toasts.length = 0; o.seal.drink = await drink('PageUp', 'hp_s'); o.seal.drinkToasts = toasts.slice();
    const u2 = player._potionLockUntil | 0; await aquaHit(); o.seal.extended = (player._potionLockUntil | 0) !== u2;
    // 3. wait the seal out on the game's own clock, then drink the moment it lapses
    player._god = true; const lapseAt = player._potionLockUntil | 0, g0 = game.time | 0, w0 = performance.now();
    while ((game.time | 0) < lapseAt + 2 && performance.now() - w0 < 30000) { game.paused = false; game.monsters.length = 0; await sleep(200); }
    o.lapse = { waitedF: (game.time | 0) - g0, waitedS: +((performance.now() - w0) / 1000).toFixed(1) }; player._god = false;
    await sleep(300); o.lapse.pill = pill(); toasts.length = 0; o.lapse.drink = await drink('PageUp', 'hp_s'); o.lapse.toasts = toasts.slice();
    // 4. grace: no re-seal inside it, a re-seal after it
    await aquaHit(); o.grace = { inGrace: (typeof _lxPotionSealLeftF === 'function') ? _lxPotionSealLeftF() > 0 : (player._potionLockUntil | 0) > (game.time | 0) };
    player._potionSealNextAt = 0; await aquaHit(); o.grace.after = (player._potionLockUntil | 0) > (game.time | 0);
    // 5. leaving the map lifts the seal
    loadMap('town', 300); await sleep(1200); game.paused = false; game.monsters.length = 0; o.map = { map: game.currentMap, drink: await drink('PageUp', 'hp_s'), toasts: toasts.slice(-2) };
    loadMap('forest', 300); await sleep(1200); game.paused = false; game.monsters.length = 0;
    // 6. a stored seal can never read longer than 15 s
    reset(); player._potionLockUntil = (game.time | 0) + 99999; player._potionLockMap = game.currentMap;
    o.clamp = { left: (typeof _lxPotionSealLeftF === 'function') ? _lxPotionSealLeftF() : (player._potionLockUntil | 0) - (game.time | 0) }; o.clamp.drink = await drink('PageUp', 'hp_s'); o.clamp.toast = toasts.find((t) => /sealed/i.test(t)) || '';
    // 7. heal lock: a comet every 5 s. The lock holds at most 15 s from its start, then lapses and stays open (the
    //    grace) although the comets keep landing - before, each landing pushed it another 10 s, with no end.
    reset(); o.hl = { spans: [], at: [], locked: [] }; const hl0 = game.time | 0;
    for (let i = 0; i < 6; i++) { _lxHealLockApply(10000, 'a Gravitos comet'); o.hl.at.push((game.time | 0) - hl0); o.hl.locked.push(_lxHealLocked()); o.hl.spans.push((player._healLockUntil | 0) - hl0); if (i < 5) game.time = (game.time | 0) + 300; }
    // 8. under a FRESH heal lock: MP drinks, HP refused with a toast naming MP
    player._healLockUntil = 0; player._healLockNextAt = 0; player._healLockStart = 0; _lxHealLockApply(10000, 'a Gravitos comet'); o.hl.lockedForDrinks = _lxHealLocked();
    toasts.length = 0; o.hl.mp = await drink('PageDown', 'mp_s'); o.hl.hp = await drink('PageUp', 'hp_s'); o.hl.hpToasts = toasts.slice();
    game.time = (player._healLockUntil | 0) + 5; o.hl.lapsed = !_lxHealLocked(); _lxHealLockApply(10000, 'a Gravitos comet'); o.hl.inGrace = _lxHealLocked();
    game.time = Math.max(game.time | 0, (player._healLockNextAt | 0) + 1); _lxHealLockApply(10000, 'a Gravitos comet'); o.hl.after = _lxHealLocked();
    player._healLockUntil = 0; player._healLockNextAt = 0;
    // 9. the key never fails silently
    reset(); player.potionBinds = {}; o.repair = { hp: await drink('PageUp', 'hp_s'), binds: JSON.stringify(player.potionBinds) };
    reset(); player.potionBinds = { pageup: 'none', pagedown: 'mp_auto' }; o.disabled = { hp: await drink('PageUp', 'hp_s'), toasts: toasts.slice() }; player.potionBinds = { pageup: 'hp_auto', pagedown: 'mp_auto' };
    reset(); player.actionBinds = Object.assign({}, ACTION_KEY_DEFAULT, { hpPotion: '1' }); o.rebound = { oldKey: await drink('PageUp', 'hp_s'), oldToasts: toasts.slice() }; toasts.length = 0; o.rebound.newKey = await drink('1', 'hp_s');
    player.actionBinds = Object.assign({}, ACTION_KEY_DEFAULT); reset();
    return o;
  });
  console.log(`build ${r.ver}  ceiling ${r.maxF} f  grace ${r.graceF} f  aquarius ${r.sealF}/${r.aGraceF} f`);
  ok('PgUp drinks one HP potion with the default binds', r.def.hp === 1 && r.def.toasts.some((t) => /Used/.test(t)), `${r.def.hp} used; ${r.def.toasts[0] || ''}`);
  ok('PgDn drinks one MP potion with the default binds', r.defMp === 1, `${r.defMp} used`);
  ok('one ceiling and one grace for every seal: 900 f (15 s) each, Aquarius uses both', r.maxF === 900 && r.graceF === 900 && r.sealF === 900 && r.aGraceF === 900);
  ok('an Aquarius hit seals potions for 15 s and books the 15 s grace', r.seal.hit && r.seal.until > 800 && r.seal.until <= 900 && r.seal.next === 900, `until +${r.seal.until} f, grace +${r.seal.next} f`);
  ok('the seal toast says 15s', /15s/.test(r.seal.toast), r.seal.toast);
  ok('a sealed drink is refused, and says so', r.seal.drink === 0 && r.seal.drinkToasts.some((t) => /sealed/i.test(t)), r.seal.drinkToasts.join(' | '));
  ok('a second hit while sealed does NOT extend the seal', r.seal.extended === false);
  ok('while sealed, the buff bar shows a POTIONS SEALED pill', r.seal.pill === true);
  ok('the seal lapses on the game clock within 15 s', r.lapse.waitedF <= 900, `${r.lapse.waitedF} f, ${r.lapse.waitedS} s wall`);
  ok('the moment it lapses, PgUp drinks and the pill is gone', r.lapse.drink === 1 && r.lapse.pill === false, `${r.lapse.drink} used, pill ${r.lapse.pill}; ${r.lapse.toasts.join(' | ')}`);
  ok('inside the 15 s grace, a hit does not seal again', r.grace.inGrace === false);
  ok('after the grace, the next hit seals again', r.grace.after === true);
  ok('leaving the map lifts the seal: PgUp drinks on the next map', r.map.drink === 1, `${r.map.map}: ${r.map.drink} used; ${r.map.toasts.join(' | ')}`);
  ok('a stored seal of 99,999 frames reads as 15 s and says 15s', r.clamp.left === 900 && r.clamp.drink === 0 && /15s/.test(r.clamp.toast), `${r.clamp.left} f; ${r.clamp.toast}`);
  ok('a comet every 5 s holds the heal lock at most 15 s from its start, then it lapses and stays open', r.hl.spans.every((s) => s <= 900) && r.hl.at.every((a, i) => r.hl.locked[i] === (a < 900)), `unlock at +${r.hl.spans.join(',')} f; locked ${r.hl.locked.map((b, i) => '+' + r.hl.at[i] + ':' + (b ? 'Y' : 'n')).join(' ')}`);
  ok('under a heal lock, PgDn still drinks an MP potion', r.hl.lockedForDrinks && r.hl.mp === 1, `${r.hl.mp} used`);
  ok('under a heal lock, an HP potion is refused with a toast that says MP still works', r.hl.hp === 0 && r.hl.hpToasts.some((t) => /HEAL LOCKED/.test(t) && /MP/.test(t)), r.hl.hpToasts.join(' | '));
  ok('the heal lock lapses, cannot re-lock inside its grace, and can after', r.hl.lapsed && r.hl.inGrace === false && r.hl.after === true, `lapsed ${r.hl.lapsed} inGrace ${r.hl.inGrace} after ${r.hl.after}`);
  ok('a bind table missing its slot is repaired and the drink lands', r.repair.hp === 1 && /hp_auto/.test(r.repair.binds), r.repair.binds);
  ok('a slot set to Disabled says so instead of swallowing the press', r.disabled.hp === 0 && r.disabled.toasts.some((t) => /Disabled/.test(t)), r.disabled.toasts.join(' | '));
  ok('with HP potion rebound to 1, PgUp says where it went and drinks nothing', r.rebound.oldKey === 0 && r.rebound.oldToasts.some((t) => /potion is on/.test(t)), r.rebound.oldToasts.join(' | '));
  ok('...and 1 drinks', r.rebound.newKey === 1, `${r.rebound.newKey} used`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
