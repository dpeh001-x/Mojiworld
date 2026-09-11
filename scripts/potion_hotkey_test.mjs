#!/usr/bin/env node
// Potion hotkey - v0.30.611. Per user: "Another bug, I am unable to use my potions (when i press the hotkey)".
//
// Two halves. (1) Aquarius's seal: v0.30.297 seals potions for 45 s on her projectiles; a live seal was refreshed to
// a full 45 s by every sealing hit, and once v0.30.601 tagged every zodiac projectile her homing droplets landed every
// few seconds - potions never came back for the whole fight. A seal is now 45 s, never extended while live, and cannot
// be re-applied for 15 s after it lapses. (2) The hotkey never fails silently: a Disabled slot says so, a slot missing
// from the bind table is repaired, and the old key of a rebound potion says where the potion went.
// Driven through the real keydown listener and the real impact resolver, HP read back, toasts captured.
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
    loadMap('forest', 300); await sleep(900);
    const toasts = []; const _st = window.showToast; window.showToast = (t, k) => { toasts.push(String(t)); return _st ? _st(t, k) : undefined; };
    const o = { ver: GAME_VERSION, sealF: typeof LX_AQUARIUS_SEAL_F !== 'undefined' ? LX_AQUARIUS_SEAL_F : null, graceF: typeof LX_AQUARIUS_SEAL_GRACE_F !== 'undefined' ? LX_AQUARIUS_SEAL_GRACE_F : null };
    const reset = () => { game.paused = false; player._god = false; player.hp = Math.floor(getMaxHp() * 0.4); player.mp = Math.floor(getMaxMp() * 0.4); player._potionCdHp = 0; player._potionCdMp = 0; player._potionLockUntil = 0; player._potionSealNextAt = 0; player._healLockUntil = 0; player.consumables = player.consumables || {}; player.consumables.hp_s = 9; player.consumables.mp_s = 9; player.blockTimer = 0; player.invulnerable = 0; player.lastHitTime = -9999; toasts.length = 0; };
    const press = async (key) => { window.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true })); await sleep(250); };
    // a drink is counted by STOCK consumed, not by HP - natural regen moves HP by a few points inside the wait
    const drinkHp = async (key) => { const s0 = player.consumables.hp_s | 0; await press(key); return s0 - (player.consumables.hp_s | 0); };
    const aquaHit = async () => {   // a real Aquarius projectile through the impact resolver; retried, because evasion can dodge one
      for (let attempt = 0; attempt < 5; attempt++) {
        player.invulnerable = 0; player.lastHitTime = -9999; player.parryWindow = 0; player.maxHp = Math.max(player.maxHp, 400000); if (player.hp < 1000) player.hp = 100000; const before = player.hp;
        game.projectiles.push({ x: player.x + player.w / 2 - 6, y: player.y + player.h / 2 - 6, vx: 0, vy: 0, w: 12, h: 12, life: 120, damage: 400, owner: 'enemy', skill: 'mbolt', color: '#fff', _zodiacAttacker: true, _zodiacSign: 'aquarius' });
        for (let i = 0; i < 30 && player.hp >= before; i++) await sleep(20); game.projectiles.length = 0; player.invulnerable = 0; player.lastHitTime = -9999;
        if (player.hp < before) return true;
      }
      return false;
    };
    // 1. defaults drink
    reset(); o.def = { hp: await drinkHp('PageUp'), toasts: toasts.slice() };
    reset(); { const s0 = player.consumables.mp_s | 0; await press('PageDown'); o.defMp = { mp: s0 - (player.consumables.mp_s | 0) }; }
    // 2. a seal refuses the drink and is not extended by a second hit
    reset(); o.seal = {}; o.seal.hit = await aquaHit(); o.seal.until = (player._potionLockUntil | 0) - (game.time | 0); o.seal.next = (player._potionSealNextAt | 0) - (player._potionLockUntil | 0);
    toasts.length = 0; o.seal.drink = await drinkHp('PageUp'); o.seal.drinkToasts = toasts.slice();
    const u1 = player._potionLockUntil | 0; player._potionLockUntil = (game.time | 0) + 600; const u2 = player._potionLockUntil; await aquaHit(); o.seal.extended = (player._potionLockUntil | 0) !== u2; o.seal.u1 = u1;
    // 3. grace: a lapsed seal cannot be re-applied inside its grace, and can after it
    player._potionLockUntil = (game.time | 0) - 1; player._potionSealNextAt = (game.time | 0) + 600; await aquaHit(); o.grace = { resealedInGrace: (player._potionLockUntil | 0) > (game.time | 0) };
    player._potionSealNextAt = 0; await aquaHit(); o.grace.resealedAfter = (player._potionLockUntil | 0) > (game.time | 0);
    // 4. a bind table missing its slot is repaired; a Disabled slot says so
    reset(); player.potionBinds = {}; o.repair = { hp: await drinkHp('PageUp'), binds: JSON.stringify(player.potionBinds) };
    reset(); player.potionBinds = { pageup: 'none', pagedown: 'mp_auto' }; o.disabled = { hp: await drinkHp('PageUp'), toasts: toasts.slice() }; player.potionBinds = { pageup: 'hp_auto', pagedown: 'mp_auto' };
    // 5. a rebound potion: the old key explains, the new key drinks
    reset(); player.actionBinds = Object.assign({}, ACTION_KEY_DEFAULT, { hpPotion: '1' }); o.rebound = { oldKey: await drinkHp('PageUp'), oldToasts: toasts.slice() }; toasts.length = 0; o.rebound.newKey = await drinkHp('1'); o.rebound.newToasts = toasts.slice();
    player.actionBinds = Object.assign({}, ACTION_KEY_DEFAULT); reset();
    return o;
  });
  console.log(`build ${r.ver}  seal ${r.sealF} f  grace ${r.graceF} f`);
  ok('PgUp drinks one HP potion with the default binds', r.def.hp === 1 && r.def.toasts.some((t) => /Used/.test(t)), `${r.def.hp} used; ${r.def.toasts[0] || ''}`);
  ok('PgDn drinks one MP potion with the default binds', r.defMp.mp === 1, `${r.defMp.mp} used`);
  ok('the seal constants are declared: 2700 f sealed, 900 f grace', r.sealF === 2700 && r.graceF === 900);
  ok('an Aquarius hit seals potions for 45 s and books the grace', r.seal.hit && r.seal.until > 2600 && r.seal.until <= 2700 && r.seal.next === 900, `until +${r.seal.until} f, grace +${r.seal.next} f`);
  ok('a sealed drink is refused, and says so', r.seal.drink === 0 && r.seal.drinkToasts.some((t) => /sealed/i.test(t)), r.seal.drinkToasts.join(' | '));
  ok('a second hit during a live seal does NOT extend it (was: refreshed to 45 s every hit)', r.seal.extended === false);
  ok('a lapsed seal cannot be re-applied inside its 15 s grace', r.grace.resealedInGrace === false);
  ok('after the grace, the next hit seals again', r.grace.resealedAfter === true);
  ok('a bind table missing its slot is repaired and the drink lands', r.repair.hp === 1 && /hp_auto/.test(r.repair.binds), r.repair.binds);
  ok('a slot set to Disabled says so instead of swallowing the press', r.disabled.hp === 0 && r.disabled.toasts.some((t) => /Disabled/.test(t)), r.disabled.toasts.join(' | '));
  ok('with HP potion rebound to 1, PgUp says where it went and drinks nothing', r.rebound.oldKey === 0 && r.rebound.oldToasts.some((t) => /potion is on/.test(t)), r.rebound.oldToasts.join(' | '));
  ok('...and 1 drinks', r.rebound.newKey === 1, `${r.rebound.newKey} used`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
