// A REBOUND KEY STICKS, AND DYING GIVES THE PLAYER BACK (v0.30.952).
//
// Rebinding: the K panel's chip arms a capture, the next real key takes it, the displaced action is
// swapped, and it rides the SAVE (player.actionBinds is on PLAYER_SAVE_FIELDS) - not localStorage.
// So the round-trip is rebind -> saveState -> reload -> loadState, and never applyClass, which would
// hand back a brand-new hero and look like a persistence failure.
//
// Three things that make this measure the real feature rather than the harness:
//   - the chip's onclick re-renders the panel, REPLACING the chip; re-query it or every label read
//     is of a detached node still showing the old key;
//   - the capture wants a real key event (page.keyboard.press). A synthesized KeyboardEvent arms
//     nothing and reads as "rebinding is broken";
//   - 'p' (and enter/escape/t/i/m/9/0) is RESERVED for the action flow, and the skill slots
//     Z/X/S/C/D/F/V/G are handled by a SEPARATE chip on the same tab -
//     [data-skillslot], wired to _skillPickup, writing player.keybinds. An audit that queried only
//     [data-action] concluded basic attack could not be rebound at all. It can: the Basic Attack row
//     IS a skill chip, and the second half of this test moves it off Z and checks Z lets go.
//     The action flow rejects those keys deliberately, which is correct and toasts an explanation.
//     This test uses 'o' for the journal and 'r' for attack - one key cannot serve both.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/rebind_death_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11345';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const ACT = 'questJournal', NEWKEY = 'o', OLDKEY = 'q';
// a DIFFERENT free key for the attack remap: 'o' is taken by the journal bind above, and binding one
// key to two things is exactly what the swap logic refuses - it would measure the refusal, not the remap
const ATKKEY = 'r';
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const clearCine = async () => { for (let i = 0; i < 14; i++) { const c = await page.evaluate(() => (document.body.className.match(/cinematic|sb-active/g) || []).join('+')); if (!c) break; await page.keyboard.press('Space'); await page.waitForTimeout(400); } };
const opensJournal = async (key) => {
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  await page.waitForTimeout(250); await page.keyboard.press(key); await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const e = document.getElementById('quest-modal'); return !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); });
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  await page.waitForTimeout(200); return r;
};
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof saveState === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 20; loadMap('town', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false;
  });
  await clearCine();
  check(await opensJournal(OLDKEY) === true, `the default key opens the journal to begin with (${OLDKEY})`);
  check(await opensJournal(NEWKEY) === false, `and the key we are about to bind does nothing yet (${NEWKEY})`);
  // rebind through the panel, the way a player does
  await page.evaluate(async () => { try { toggleKeybindModal(); } catch (e) {} await new Promise((r) => setTimeout(r, 600)); });
  const armed = await page.evaluate((ACT) => { const e = document.querySelector('#keybind-modal [data-action="' + ACT + '"]'); if (!e) return 'NO CHIP'; e.click(); return true; }, ACT);
  await page.waitForTimeout(400);
  const pickup = await page.evaluate(() => (typeof _actionPickup !== 'undefined' ? _actionPickup : 'undef'));
  check(armed === true && pickup === ACT, 'clicking the key chip arms a capture', J({ armed, pickup }));
  await page.keyboard.press(NEWKEY);
  await page.waitForTimeout(700);
  const bound = await page.evaluate((ACT) => (player.actionBinds ? player.actionBinds[ACT] : null), ACT);
  check(bound === NEWKEY, 'the next key press is taken as the new bind', 'actionBinds.' + ACT + ' = ' + J(bound));
  await page.evaluate(() => { try { closeAllModals(); saveState(); } catch (e) {} });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof loadState === 'function', null, { timeout: 180000 });
  const restored = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    let ok = null; try { ok = loadState(); } catch (e) { ok = 'threw'; }
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false;
    return { ok, bind: player.actionBinds ? player.actionBinds.questJournal : null };
  });
  await clearCine();
  check(restored.bind === NEWKEY, 'the bind survives save + reload', J(restored));
  check(await opensJournal(NEWKEY) === true, 'and the new key really opens the journal');
  check(await opensJournal(OLDKEY) === false, 'while the old key has let go of it');
  // ---- BASIC ATTACK moves off Z, through the skill-slot chip on the same tab.
  // A swing is a RISING EDGE of player.attacking, measured from a drained state: counting
  // "attackCooldown > 0" instead leaks the previous key's gate into the next window and reads as
  // the old key still working. Seed the edge from the LIVE value or a swing already in flight counts.
  const swings = async (key) => {
    await page.evaluate(async () => { for (let i = 0; i < 120; i++) {
      if (!player.attacking && (player.attackTimer | 0) <= 0 && (player.attackCooldown | 0) <= 0) return;
      await new Promise((r) => setTimeout(r, 25)); } });
    await page.evaluate(() => { window.__sw = 0; window.__prev = !!player.attacking;
      window.__swT = setInterval(() => { const a = !!player.attacking; if (a && !window.__prev) window.__sw++; window.__prev = a; }, 16); });
    for (let i = 0; i < 3; i++) { await page.keyboard.press(key); await page.waitForTimeout(320); }
    await page.waitForTimeout(200);
    return page.evaluate(() => { clearInterval(window.__swT); return window.__sw; });
  };
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  const zBefore = await swings('z');
  check(zBefore > 0, 'basic attack swings on its default key to begin with (Z)', zBefore + ' swings');
  await page.evaluate(async () => { try { toggleKeybindModal(); } catch (e) {} await new Promise((r) => setTimeout(r, 600)); });
  const chip = await page.evaluate(() => { const e = document.querySelector('#keybind-modal [data-skillslot="d"]'); if (!e) return 'NO CHIP'; e.click(); return true; });
  await page.waitForTimeout(400);
  const sp = await page.evaluate(() => (typeof _skillPickup !== 'undefined' ? _skillPickup : 'undef'));
  check(chip === true && sp === 'd', 'the Basic Attack row is a remappable chip, and it arms', J({ chip, pickup: sp }));
  await page.keyboard.press(ATKKEY);
  await page.waitForTimeout(700);
  const slot = await page.evaluate(() => ({ key: (typeof SLOT_TO_KEY !== 'undefined' ? SLOT_TO_KEY.d : null), hasZ: !!(typeof KEY_TO_SLOT !== 'undefined' && KEY_TO_SLOT.z) }));
  check(String(slot.key).toLowerCase() === ATKKEY && slot.hasZ === false, 'attack moves to the new key and Z is released from the map', J(slot));
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  const zAfter = await swings('z'), newAfter = await swings(ATKKEY);
  check(newAfter > 0, 'the new key swings', newAfter + ' swings');
  check(zAfter === 0, 'and the old key no longer does', zAfter + ' swings on Z');
  // ---- death
  const d = await page.evaluate(async () => {
    try { closeAllModals(); } catch (e) {} game.paused = false;
    const snap = () => ({ hp: Math.round(player.hp), map: game.currentMap, dying: game.dying | 0 });
    player.hp = 1; let threw = null;
    try { triggerDeath(); } catch (e) { threw = String(e.message).slice(0, 60); }
    await new Promise((r) => setTimeout(r, 1500));
    const ov = document.getElementById('death-overlay');
    const up = !!(ov && ov.getClientRects().length && getComputedStyle(ov).display !== 'none');
    const btn = ov ? [...ov.querySelectorAll('button, .btn, [onclick]')][0] : null;
    const btnTxt = btn ? (btn.textContent || '').trim().slice(0, 30) : null;
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 3000));
    const after = snap(); const t0 = game.time; await new Promise((r) => setTimeout(r, 500));
    return { threw, up, btnTxt, after, maxHp: Math.round(getMaxHp()), ticks: game.time - t0,
      stillUp: (() => { const e = document.getElementById('death-overlay'); return !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); })(),
      panelsLeft: ['shop-modal', 'codex-modal', 'quest-modal', 'keybind-modal'].filter((id) => { const e = document.getElementById(id); return e && e.getClientRects().length && getComputedStyle(e).display !== 'none'; }) };
  });
  check(!d.threw && d.up === true, 'dying raises the death overlay', J({ threw: d.threw, button: d.btnTxt }));
  check(d.after.hp === d.maxHp, 'respawn gives the player back full HP', d.after.hp + '/' + d.maxHp);
  check(d.stillUp === false && d.panelsLeft.length === 0, 'and leaves no overlay or panel on screen', J({ overlay: d.stillUp, panels: d.panelsLeft }));
  check(d.after.dying === 0 && d.ticks > 0, 'the game is running again after respawn', J({ dying: d.after.dying, ticks: d.ticks, map: d.after.map }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
