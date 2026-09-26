// Keybinds work everywhere (v0.30.x kb-guards + kb-routes).
//   node scripts/keybinds_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "ensure keybinds work properly without any issue at all". One check per audit finding that a desktop page
// can drive (the phone deck and the controller are covered by their own paths below where they are plain functions).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11141';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof toggleKeybindModal === 'function' && typeof onKeybindKeyClick === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    window.__reset = () => { player.actionBinds = { ...ACTION_KEY_DEFAULT }; player.keybinds = { ...KEY_TO_SLOT_DEFAULT }; delete player.cureKey; delete player.interactKey; applyKeybinds(); game.keys = {}; try { closeAllModals(); } catch (e) {} game.paused = false; };
  });
  const reset = () => p.evaluate(() => __reset());
  const pick = async (kind, id, key) => {   // drive a real K-panel pickup, then press the key
    await p.evaluate(([kind, id]) => { toggleKeybindModal(); if (kind === 'action') _actionPickup = id; else if (kind === 'skill') _skillPickup = id; else if (kind === 'cure') _cureKeyPickup = true; else _interactKeyPickup = true; }, [kind, id]);
    await p.keyboard.press(key); await p.waitForTimeout(150);
    await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  };

  // 1) the Keyboard-tab drop checks like the chip
  await reset();
  const drop = await p.evaluate(() => { toggleKeybindModal(); onKeybindKeyClick('S'); onKeybindKeyClick(' '); const r = { space: KEY_TO_SLOT[' '] || null, s: KEY_TO_SLOT.s || null }; try { closeAllModals(); } catch (e) {} game.paused = false; return r; });
  check(!drop.space && drop.s === 'a', 'the Keyboard-tab drop refuses Space for a skill (it jumped AND cast)', drop);
  // 2) Shift for a skill once Dash has moved
  await reset();
  await pick('action', 'dodge', 'r'); await pick('skill', 'a', 'Shift');
  const sh = await p.evaluate(() => ({ dodge: player.actionBinds.dodge, shiftSkill: KEY_TO_SLOT.shift || null }));
  check(sh.dodge === 'r' && !sh.shiftSkill, 'with Dash moved off Shift, a skill is refused on Shift (it never cast there)', sh);
  // 3) Cure and Pickup keys vs actions
  await reset();
  await pick('cure', null, 'r'); await pick('action', 'moveLeft', 'r');
  const cu = await p.evaluate(() => ({ cure: player.cureKey, left: player.actionBinds.moveLeft }));
  check(cu.cure === 'r' && cu.left === 'arrowleft', 'an action cannot take the Cure key (Move Left on it burned a Remedy per step)', cu);
  // 4) Pickup onto a moved action's old key
  await reset();
  await pick('action', 'jump', 'r'); await pick('interact', null, 'Space');
  const pu = await p.evaluate(() => ({ jump: player.actionBinds.jump, pickup: player.interactKey || null }));
  check(pu.jump === 'r' && pu.pickup !== ' ', 'Pickup is refused on Space once Jump moved off it (it did nothing there)', pu);
  // 5) + 6) the shared reserved list, and Mute home again
  await reset();
  await pick('action', 'worldMap', 'o');
  await pick('action', 'mute', 'r'); await pick('action', 'mute', 'm');
  const rs = await p.evaluate(() => ({ map: player.actionBinds.worldMap, mute: player.actionBinds.mute }));
  check(rs.map === 'w' && rs.mute === 'm', 'World Map is refused on O (photo mode\'s key), and Mute can go back to M', rs);
  // 7) the skill bar follows the binds
  await reset();
  await pick('skill', 'a', 'r'); await pick('action', 'block', 'y');
  const sb = await p.evaluate(async () => { renderSkillBar(); await new Promise((s) => setTimeout(s, 100)); const keys = [...document.querySelectorAll('#skill-bar .skill-key')].map((e) => e.textContent.trim()); return { keys, block: (document.querySelector('#skill-bar .skill-slot.defense .skill-key') || {}).textContent, code: player.actionBinds.codex }; });
  check(sb.keys.includes('R') && !sb.keys.includes('S') && sb.block === 'Y', 'the skill bar shows the new key at once, and Block shows its own bind (was always A)', sb);
  // 9) + 14) the HUD chip and labels
  await reset();
  await pick('action', 'characterK', 'r');
  const hu = await p.evaluate(async () => { renderSkillBar(); document.getElementById('hotkey-hint').click(); await new Promise((s) => setTimeout(s, 300)); const m = document.getElementById('keybind-modal'); const open = !!m && getComputedStyle(m).display !== 'none'; const kbd = (document.querySelector('#hotkey-hint kbd') || {}).textContent; try { closeAllModals(); } catch (e) {} game.paused = false; return { open, kbd, talk: _lxKeyLabel('talkNpc') }; });
  check(hu.open && hu.kbd === 'R', 'with Hotkeys moved to R, the HUD chip still opens the panel and reads R', hu);
  // 10) the controller follows skill binds
  await reset();
  await pick('skill', 'd', 'r');
  const pad = await p.evaluate(() => _lxPadResolveKey({ k: 'z' }));
  check(pad === 'r', 'a controller skill button follows its skill to its new key (Basic Attack on R -> pad X sends R)', pad);
  // 11) a focused dropdown is typing
  await reset();
  await p.evaluate(() => { const s = document.createElement('select'); s.id = '__kbsel'; s.innerHTML = '<option>a</option><option>b</option>'; document.body.appendChild(s); s.focus(); });
  await p.keyboard.press('w'); await p.waitForTimeout(300);
  const sel = await p.evaluate(() => { const m = document.getElementById('worldmap-modal'); const r = !!m && getComputedStyle(m).display !== 'none'; document.getElementById('__kbsel').remove(); try { closeAllModals(); } catch (e) {} game.paused = false; return r; });
  check(!sel, 'W in a focused dropdown does not open the World Map', { opened: sel });
  // 12) Shift + a punctuation-bound action (digits are the interface's now)
  await reset();
  await pick('action', 'jump', ';');
  const dg = await p.evaluate(async () => { game.keys = {}; window.dispatchEvent(new KeyboardEvent('keydown', { key: ':', code: 'Semicolon', shiftKey: true, bubbles: true })); const held = !!game.keys[' ']; window.dispatchEvent(new KeyboardEvent('keyup', { key: ':', code: 'Semicolon', shiftKey: true, bubbles: true })); return { held, after: !!game.keys[' '], bind: player.actionBinds.jump }; });
  check(dg.held && !dg.after, 'Jump on ; fires with Shift (Dash) held - the browser says : - and releases cleanly', dg);
  // 13) a rebind while a move key is held
  await reset();
  await pick('action', 'moveRight', 'r');
  const mh = await p.evaluate(() => { game.keys = {}; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true })); const held = !!game.keys.arrowright; player.actionBinds = { ...ACTION_KEY_DEFAULT }; window.dispatchEvent(new KeyboardEvent('keyup', { key: 'r', code: 'KeyR', bubbles: true })); return { held, stuck: !!game.keys.arrowright }; });
  check(mh.held && !mh.stuck, 'resetting binds while holding a rebound move key leaves no stuck walk', mh);
  // re-audit A) after a Reset the Cure key is unset (reads as Shift): an action still can't take it; a skill may (designed:
  // a skill on the default Shift wins over Dash and Cure), and Cure's guard on a key of its own survives the Reset
  await reset();
  await pick('action', 'jump', 'Shift');
  const ra = await p.evaluate(() => ({ jump: player.actionBinds.jump, cure: player.cureKey || null }));
  check(ra.jump === ' ' && !ra.cure, 'after a Reset (Cure key unset = Shift), Jump is still refused on Shift', ra);
  await reset();
  await pick('cure', null, 'r'); await pick('skill', 'a', 'r');
  const rc = await p.evaluate(() => ({ cure: player.cureKey, rSkill: KEY_TO_SLOT.r || null }));
  check(rc.cure === 'r' && !rc.rSkill, 'a skill is refused on a Cure key of its own', rc);
  // re-audit B) Cure can go home to Shift, which it shares with Dash by design
  await reset();
  await pick('cure', null, 'r'); await pick('cure', null, 'Shift');
  const rb = await p.evaluate(() => player.cureKey);
  check(rb === 'shift', 'Cure can go back to Shift (it shares that key with Dash)', rb);
  // re-audit C) the phone MP button honours K > Potions even with a skill on PgDn
  await reset();
  await pick('skill', 'a', 'PageDown');
  const pc = await p.evaluate(async () => { player.potionBinds = Object.assign({ pageup: 'hp_auto', pagedown: 'mp_auto' }, player.potionBinds || {}, { pagedown: 'none' }); const inv0 = JSON.stringify(player.consumables || {}); let _q = 0; const _uq = window.useQuickPotion, _uc = window.useConsumable; window.useQuickPotion = function () { _q++; return _uq.apply(this, arguments); }; if (typeof _uc === 'function') window.useConsumable = function () { _q++; return _uc.apply(this, arguments); }; const _tc = []; const _st = window.showToast; window.showToast = function (t) { _tc.push(String(t)); return _st.apply(this, arguments); }; _mkeyDispatch('keydown', 'pagedown'); _mkeyDispatch('keyup', 'pagedown'); await new Promise((s) => setTimeout(s, 300)); window.showToast = _st; window.useQuickPotion = _uq; if (typeof _uc === 'function') window.useConsumable = _uc; const toast = _tc.find((t) => /Disabled/.test(t)) || ''; return { skill: KEY_TO_SLOT.pagedown || null, drank: _q > 0 || JSON.stringify(player.consumables || {}) !== inv0, toast: !!toast }; });
  check(pc.skill === 'a' && !pc.drank && pc.toast, 'phone: with PgDn set to Disabled and a skill on PgDn, the MP button says so and drinks nothing', pc);
  await p.evaluate(() => { player.potionBinds = { pageup: 'hp_auto', pagedown: 'mp_auto' }; });
  // the basics still work
  await reset();
  await pick('action', 'jump', 'r');
  const bj = await p.evaluate(() => { game.keys = {}; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true })); const r = !!game.keys[' ']; window.dispatchEvent(new KeyboardEvent('keyup', { key: 'r', code: 'KeyR', bubbles: true })); return { r, j: player.actionBinds.jump }; });
  check(bj.r && bj.j === 'r', 'an ordinary rebind still works (Jump on R)', bj);
  await reset();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
