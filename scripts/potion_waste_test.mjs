// A DRINK THAT CAN DO NOTHING IS REFUSED, NOT SPENT (v0.30.943). Every other way a potion cannot work already
// refuses it and keeps it - the carriage lockout, the Aquarius heal seal ("a sealed drink would be wasted"), the
// Tidesworn seal, the cooldown. A full bar took the potion anyway: at 292/292 HP the quick key spent a Large Red
// Potion and said "Used Large Red Potion", and with an empty bag the auto-buy BOUGHT one and healed zero. The
// same block's success toast also named the base price while charging the level-scaled one (120 vs 360 at Lv 80).
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/potion_waste_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11332';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof useQuickPotion === 'function' && typeof useConsumable === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; player._tutorialSeen = true;
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 900));
    window.__toasts = []; const _st = showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return _st.apply(this, arguments); };
    window.__clearCd = () => { player._potionCdHp = 0; player._potionCdMp = 0; };
    window.__noAilments = () => { for (const k of ['frozenTimer', 'freezeTimer', '_slowTimer', '_poisonTimer', '_skillLockTimer', 'burnTimer', 'hitStun', 'stunTimer', '_electrocuteTimer', '_iceFloor', '_virgoSin']) player[k] = 0; };
  });
  // 1. the quick key at a full bar keeps the potion, and does not burn the cooldown either
  const full = await page.evaluate(() => {
    player.consumables = player.consumables || {};
    player.consumables.hp_l = 3; player.consumables.mp_l = 3; player.consumables.full = 0;
    player.hp = getMaxHp(); player.mp = getMaxMp(); __noAilments(); __clearCd(); window.__toasts = [];
    useQuickPotion('hp', false);
    const afterHp = { left: player.consumables.hp_l | 0, cd: player._potionCdHp | 0 };
    __clearCd(); useQuickPotion('mp', false);
    const afterMp = { left: player.consumables.mp_l | 0, cd: player._potionCdMp | 0 };
    return { afterHp, afterMp, toasts: window.__toasts.slice(0, 2) };
  });
  check(full.afterHp.left === 3 && full.afterMp.left === 3 && full.afterHp.cd === 0,
    'the quick key at a full bar keeps the potion and the cooldown', J(full));
  // 2. and a hurt bar still drinks, as before
  const hurt = await page.evaluate(() => {
    player.consumables.hp_l = 3; player.hp = 1; player.mp = 1; __clearCd(); window.__toasts = [];
    useQuickPotion('hp', false);
    return { left: player.consumables.hp_l | 0, hp: player.hp, healed: player.hp > 1 };
  });
  check(hurt.left === 2 && hurt.healed, 'a hurt bar still drinks the potion', J(hurt));
  // 3. the inventory click is the same answer
  const inv = await page.evaluate(() => {
    player.consumables.hp_l = 3; player.hp = getMaxHp(); __clearCd();
    useConsumable('hp_l');
    const atFull = player.consumables.hp_l | 0;
    player.hp = 1; __clearCd(); useConsumable('hp_l');
    return { atFull, afterHurt: player.consumables.hp_l | 0 };
  });
  check(inv.atFull === 3 && inv.afterHurt === 2, 'clicking it in the inventory at full health keeps it too', J(inv));
  // 4. a cure with nothing to cure is kept; with a burn it is drunk
  const cure = await page.evaluate(() => {
    player.consumables.cure = 3; __noAilments(); __clearCd();
    useConsumable('cure');
    const clean = player.consumables.cure | 0;
    player.burnTimer = 2000; useConsumable('cure');
    return { clean, burning: player.consumables.cure | 0 };
  });
  check(cure.clean === 3 && cure.burning === 2, 'a cure remedy is kept when there is nothing to cure', J(cure));
  // 5. the auto-buy does not buy a potion that cannot help
  const buy = await page.evaluate(() => {
    for (const p of POTION_ITEMS) player.consumables[p.id] = 0;
    player.hp = getMaxHp(); player.mp = getMaxMp(); __noAilments(); player.mojicoins = 999999; __clearCd();
    const c0 = player.mojicoins;
    useQuickPotion('hp', false);
    return { spent: c0 - player.mojicoins };
  });
  check(buy.spent === 0, 'the auto-buy does not buy a potion for a full bar', J(buy));
  // 6. and when it does buy, the toast names the price it charged
  const price = await page.evaluate(() => {
    const at = (lvl) => {
      player.level = lvl;
      for (const p of POTION_ITEMS) player.consumables[p.id] = 0;
      player.hp = 1; player.mp = 1; player.mojicoins = 999999; __clearCd(); window.__toasts = [];
      const c0 = player.mojicoins;
      useQuickPotion('hp', false);
      const charged = c0 - player.mojicoins;
      const t = window.__toasts.find((x) => /Auto-bought/.test(x)) || '';
      const said = +((t.match(/([0-9]+)\s*Mojicoins/) || [])[1] || 0);
      return { lvl, charged, said };
    };
    const rows = [at(1), at(40), at(80)];
    player.level = 40;
    return rows;
  });
  check(price.every((r) => r.charged > 0 && r.charged === r.said),
    'the auto-buy toast names the price it charged, at every level', J(price));
  // 7. Purifying Pulse still lets a full-health drink cleanse
  const purify = await page.evaluate(() => {
    const had = window.hasMilestone;
    window.hasMilestone = (k) => k === 'purifyingPulse' ? true : (had ? had(k) : false);
    player.consumables.hp_l = 3; player.hp = getMaxHp(); player.mp = getMaxMp();
    __noAilments(); player.burnTimer = 2000; __clearCd();
    useQuickPotion('hp', false);
    const out = { left: player.consumables.hp_l | 0, burn: player.burnTimer | 0 };
    window.hasMilestone = had; __noAilments();
    return out;
  });
  check(purify.left === 2 && purify.burn === 0, 'with Purifying Pulse a full-health drink still cleanses', J(purify));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
