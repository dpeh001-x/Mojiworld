// Keybinds work everywhere (v0.30.x kb-guards + kb-routes; one key, one job since the v0.30.1328 keyboard remap).
//   node scripts/keybinds_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "ensure keybinds work properly without any issue at all", then "all keys can be remapped to whichever key on a
// keyboard possible as long as there is no duplicates". The audit's double-fire cases (a skill on Space jumped AND cast, Move
// Left on the Cure key walked AND burned a Remedy, ...) used to be REFUSED binds; now every such bind is allowed and the
// function that held the key SWAPS onto the old one - each check drives the real K panel and asserts one key, one job.
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof toggleKeybindModal === 'function' && typeof _lxBindTable === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    window.__reset = () => { _lxBindReset(); game.keys = {}; try { closeAllModals(); } catch (e) {} game.paused = false; };
  });
  const reset = () => p.evaluate(() => __reset());
  const pick = async (id, key) => {   // drive the real K panel: click the function's chip, press the key
    await p.evaluate((id) => { const m = document.getElementById('keybind-modal'); if (!m || m.style.display !== 'flex') toggleKeybindModal();
      document.querySelector('#kbm-fn-list [data-fn="' + id + '"]').click(); }, id);
    await p.keyboard.press(key); await p.waitForTimeout(150);
    await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  };
  const K = (id) => p.evaluate((id) => _lxFnKey(id), id);
  // one key down in play: which canonical keys it holds (a key that did two jobs held two)
  const holds = async (key) => { await p.evaluate(() => { game.keys = {}; game.paused = false; }); await p.keyboard.down(key);
    const h = await p.evaluate(() => Object.keys(game.keys).filter((k) => game.keys[k])); await p.keyboard.up(key); return h; };

  // 1) the board: pick up Skill 3 on S, drop it on Space - Jump swaps onto S, and Space holds only Skill 3
  await reset();
  const drop = await p.evaluate(() => { toggleKeybindModal(); onKeybindKeyClick('S'); onKeybindKeyClick(' '); const r = { skill: _lxFnKey('skill:a'), jump: _lxFnKey('jump') }; try { closeAllModals(); } catch (e) {} game.paused = false; return r; });
  const sp = await holds('Space');
  check(drop.skill === ' ' && drop.jump === 's' && sp.join() === 's', 'the board drop puts Skill 3 on Space and swaps Jump onto S - Space casts only (it jumped AND cast before the guard)', { drop, sp });
  // 2) Shift for a skill once Dash has moved: Dash to R (Cure swaps to Shift), then Skill 3 onto Shift (Cure swaps to S)
  await reset();
  await pick('dodge', 'r'); await pick('skill:a', 'Shift');
  const sh = { dodge: await K('dodge'), skill: await K('skill:a'), cure: await K('cure'), held: await holds('Shift') };
  check(sh.dodge === 'r' && sh.skill === 'shift' && sh.cure === 's' && sh.held.join() === 's', 'with Dash moved to R, a skill on Shift casts there and nothing else holds Shift', sh);
  // 3) an action onto the Cure key: Move Left takes R, Cure swaps onto the left arrow - each key does one job
  await reset();
  await pick('moveLeft', 'r');
  const cu = { left: await K('moveLeft'), cure: await K('cure'), r: await holds('r'), arrow: await holds('ArrowLeft') };
  check(cu.left === 'r' && cu.cure === 'arrowleft' && cu.r.join() === 'arrowleft' && cu.arrow.join() === 'r', 'Move Left on the Cure key: R walks (only), and Cure swaps onto the left arrow (Move Left on it once burned a Remedy per step)', cu);
  // 4) Open Chest onto a key whose function has nowhere to go: Jump to R (Cure onto Space), Open Chest (no key) onto Space
  await reset();
  await pick('jump', 'r'); await pick('interact', 'Space');
  const pu = { jump: await K('jump'), chest: await K('interact'), cure: await K('cure'),
    chip: await p.evaluate(() => { toggleKeybindModal(); const c = document.getElementById('kbm-cure-chip'); const r = c ? c.className + '|' + c.textContent : null; try { closeAllModals(); } catch (e) {} game.paused = false; return r; }) };
  check(pu.jump === 'r' && pu.chest === ' ' && pu.cure === '' && /is-off/.test(pu.chip || '') && /unbound/.test(pu.chip || ''), 'Open Chest takes Space from Cure, which had no key to swap to - Cure is left UNBOUND and its chip says so (not silently lost)', pu);
  // 5) + 6) World Map onto O swaps Photo Mode onto W; Mute can leave M and come back
  await reset();
  await pick('worldMap', 'o'); await pick('mute', 'r'); await pick('mute', 'm');
  const rs = { map: await K('worldMap'), photo: await K('photo'), mute: await K('mute'), cure: await K('cure') };
  check(rs.map === 'o' && rs.photo === 'w' && rs.mute === 'm' && rs.cure === 'r', 'World Map on O swaps Photo Mode onto W; Mute goes to R and back to M (Cure back on R)', rs);
  // 7) the skill bar follows the binds
  await reset();
  await pick('skill:a', 'r'); await pick('block', 'y');
  const sb = await p.evaluate(async () => { renderSkillBar(); await new Promise((s) => setTimeout(s, 100)); const keys = [...document.querySelectorAll('#skill-bar .skill-key')].map((e) => e.textContent.trim()); return { keys, block: (document.querySelector('#skill-bar .skill-slot.defense .skill-key') || {}).textContent }; });
  check(sb.keys.includes('R') && !sb.keys.includes('S') && sb.block === 'Y', 'the skill bar shows the new key at once, and Block shows its own bind', sb);
  // 9) + 14) the HUD chip and labels
  await reset();
  await pick('characterK', 'r');
  const hu = await p.evaluate(async () => { renderSkillBar(); document.getElementById('hotkey-hint').click(); await new Promise((s) => setTimeout(s, 300)); const m = document.getElementById('keybind-modal'); const open = !!m && getComputedStyle(m).display !== 'none';
    const kbd = (document.querySelector('#hotkey-hint kbd') || {}).textContent; try { closeAllModals(); } catch (e) {} game.paused = false; return { open, kbd, talk: _lxKeyLabel('talkNpc') }; });
  check(hu.open && hu.kbd === 'R' && hu.talk === 'N', 'with Hotkeys moved to R, the HUD chip still opens the panel and reads R', hu);
  // 10) the controller follows skill binds
  await reset();
  await pick('skill:d', 'r');
  const pad = await p.evaluate(() => _lxPadResolveKey({ k: 'z' }));
  check(pad === 'r', 'a controller skill button follows its skill to its new key (Basic Attack on R -> pad X sends R)', pad);
  // 11) a focused dropdown is typing
  await reset();
  await p.evaluate(() => { const s = document.createElement('select'); s.id = '__kbsel'; s.innerHTML = '<option>a</option><option>b</option>'; document.body.appendChild(s); s.focus(); });
  await p.keyboard.press('w'); await p.waitForTimeout(300);
  const sel = await p.evaluate(() => { const m = document.getElementById('worldmap-modal'); const r = !!m && getComputedStyle(m).display !== 'none'; document.getElementById('__kbsel').remove(); try { closeAllModals(); } catch (e) {} game.paused = false; return r; });
  check(!sel, 'W in a focused dropdown does not open the World Map', { opened: sel });
  // 12) Shift + a punctuation-bound action
  await reset();
  await pick('jump', ';');
  const dg = await p.evaluate(async () => { game.keys = {}; window.dispatchEvent(new KeyboardEvent('keydown', { key: ':', code: 'Semicolon', shiftKey: true, bubbles: true })); const held = !!game.keys[' ']; window.dispatchEvent(new KeyboardEvent('keyup', { key: ':', code: 'Semicolon', shiftKey: true, bubbles: true })); return { held, after: !!game.keys[' '], bind: _lxFnKey('jump') }; });
  check(dg.held && !dg.after, 'Jump on ; fires with Shift (Dash) held - the browser says : - and releases cleanly', dg);
  // 13) a rebind while a move key is held
  await reset();
  await pick('moveRight', 'r');
  const mh = await p.evaluate(() => { game.keys = {}; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true })); const held = !!game.keys.arrowright; _lxBindReset(); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'r', code: 'KeyR', bubbles: true })); return { held, stuck: !!game.keys.arrowright }; });
  check(mh.held && !mh.stuck, 'resetting binds while holding a rebound move key leaves no stuck walk', mh);
  // re-audit A) after a Reset Cure is on R of its own; Jump onto Shift swaps Dash onto Space - Shift is never Dash AND Cure again
  await reset();
  await pick('jump', 'Shift');
  const ra = { jump: await K('jump'), dash: await K('dodge'), cure: await K('cure'), held: await holds('Shift') };
  check(ra.jump === 'shift' && ra.dash === ' ' && ra.cure === 'r' && ra.held.join() === ' ', 'after a Reset, Jump on Shift swaps Dash onto Space and Shift only jumps (Cure stays on R)', ra);
  // re-audit B) a skill onto the Cure key swaps Cure onto the skill's old key; Cure can take Shift (Dash swaps onto R)
  await reset();
  await pick('skill:a', 'r');
  const rc = { skill: await K('skill:a'), cure: await K('cure') };
  check(rc.skill === 'r' && rc.cure === 's', 'a skill on the Cure key swaps Cure onto the skill\'s old key', rc);
  await reset();
  await pick('cure', 'Shift');
  const rb = { cure: await K('cure'), dash: await K('dodge') };
  check(rb.cure === 'shift' && rb.dash === 'r', 'Cure can take Shift - Dash swaps onto R, so Shift is not two jobs', rb);
  // re-audit C) the phone MP button is the MP potion whatever key it is on: with a skill on PgDn and PgDn's potion Disabled
  await reset();
  await pick('skill:a', 'PageDown');
  const pc = await p.evaluate(async () => { player.potionBinds = Object.assign({ pageup: 'hp_auto', pagedown: 'mp_auto' }, player.potionBinds || {}, { pagedown: 'none' }); const inv0 = JSON.stringify(player.consumables || {}); let _q = 0; const _uq = window.useQuickPotion, _uc = window.useConsumable; window.useQuickPotion = function () { _q++; return _uq.apply(this, arguments); }; if (typeof _uc === 'function') window.useConsumable = function () { _q++; return _uc.apply(this, arguments); }; const _tc = []; const _st = window.showToast; window.showToast = function (t) { _tc.push(String(t)); return _st.apply(this, arguments); }; game.keys = {}; _mkeyDispatch('keydown', 'pagedown'); const heldSkill = !!game.keys.s; _mkeyDispatch('keyup', 'pagedown'); await new Promise((s) => setTimeout(s, 300)); window.showToast = _st; window.useQuickPotion = _uq; if (typeof _uc === 'function') window.useConsumable = _uc; const toast = _tc.find((t) => /Disabled/.test(t)) || ''; return { skill: _lxFnKey('skill:a'), mp: _lxFnKey('mpPotion'), heldSkill, drank: _q > 0 || JSON.stringify(player.consumables || {}) !== inv0, toast: !!toast }; });
  check(pc.skill === 'pagedown' && pc.mp === 's' && !pc.heldSkill && !pc.drank && pc.toast, 'phone: with a skill on PgDn (MP potion swapped to S) and the MP potion Disabled, the MP button says so, drinks nothing and casts nothing', pc);
  await p.evaluate(() => { player.potionBinds = { pageup: 'hp_auto', pagedown: 'mp_auto' }; });
  // the basics still work
  await reset();
  await pick('jump', 'r');
  const bj = await p.evaluate(() => { game.keys = {}; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true })); const r = !!game.keys[' ']; window.dispatchEvent(new KeyboardEvent('keyup', { key: 'r', code: 'KeyR', bubbles: true })); return { r, j: _lxFnKey('jump') }; });
  check(bj.r && bj.j === 'r', 'an ordinary rebind still works (Jump on R)', bj);
  await reset();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
