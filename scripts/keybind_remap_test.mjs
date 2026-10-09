// ONE KEY, ONE JOB (v0.30.1328 keyboard remap). Per user: "merge and combine the Keyboard and Controls section to be all under
// the Keyboard section only, essentially all keys can be remapped to whichever key on a keyboard possible as long as there
// is no duplicates". Every function (LX_BIND_FNS) takes any key but Esc and the OS / browser keys; a key another function
// holds is swapped. Real key presses (page.keyboard) against stubbed openers prove each function fires from its key and
// from no other; the K panel's merged Keyboard tab is driven with real clicks and presses.
//   node scripts/keybind_remap_test.mjs        (MOJI_GAME_FILE=<build.html>, PORT=<port>)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '11541';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof LX_BIND_FNS === 'object' && typeof toggleKeybindModal === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; player.cls = player.cls || 'warrior'; player.level = 45;
    // a story beat owns Enter / Space / Esc (a capture listener) until it CLOSES - hiding its overlay leaves that listener eating
    // the keys this test presses, so no beat may start, and one that does is skipped the player's way
    player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const id in STORY_BEATS) player._storyBeatsSeen[id] = true;
    loadMap('forest');
    await new Promise((r) => setTimeout(r, 2500));
    for (let i = 0; i < 4; i++) { const ov = document.getElementById('story-beat-overlay'); if (!ov || !ov.classList.contains('on')) break;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 900)); }
    { const o = document.getElementById('boss-intro-overlay'); if (o) { o.classList.remove('on'); o.style.display = 'none'; } }
    player._god = true; player.hp = player.maxHp || 200; player.invulnerable = 999999; game.monsters.length = 0;   // no hit may stun the hero between a reset and a press
    // stub every opener a key reaches, counting calls
    const C = window._kbC = {};
    const stub = (name, holder) => { (holder || window)[name] = function () { C[name] = (C[name] || 0) + 1; }; };
    for (const n of ['toggleWorldMap', 'toggleQuestJournal', 'toggleLoreMap', 'openMojidex', '_qnavCycle', '_useCurePotion', '_useBoundPotion', 'openPostalWisp',
      '_mojimonQuickSummon', 'togglePhotoMode', '_mpOpenChat', '_coopSendPing', 'quickDash', 'startBlock', 'toggleSharedModal', '_wardrobeHotkey', 'openNPC', 'openChest']) stub(n);
    window.tryInteract = function (m) { C['tryInteract:' + m] = (C['tryInteract:' + m] || 0) + 1; };
    audio.toggleMute = function () { C.mute = (C.mute || 0) + 1; };
    window._kbCasts = []; window.castSkill = function (id) { window._kbCasts.push(id); };
    window._kbRealToggle = toggleKeybindModal;
    _lxBindReset();
  });
  // one real press with the game running; returns the counters it changed
  const press = async (key) => {
    await page.evaluate(() => { game.paused = false; game.monsters.length = 0; player.attackCooldown = 0; player.hitStun = 0; player.quickDashTimer = 0; player.rushTimer = 0; player.blockCD = 0; player.blockTimer = 0;
      window._kbBefore = JSON.stringify(window._kbC); window._kbCasts.length = 0; });
    await page.keyboard.press(key);
    return page.evaluate(() => { const b = JSON.parse(window._kbBefore), d = {}; for (const k in window._kbC) if ((window._kbC[k] || 0) !== (b[k] || 0)) d[k] = window._kbC[k] - (b[k] || 0);
      if (window._kbCasts.length) d.cast = window._kbCasts.slice(); return d; });
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // 1. the table
  const reg = await page.evaluate(() => {
    const ids = LX_BIND_FNS.map((f) => f.id), canon = LX_BIND_FNS.map((f) => f.canon), defs = LX_BIND_FNS.map((f) => f.def).filter(Boolean);
    const t = _lxBindTable();
    return { n: ids.length, idsUnique: new Set(ids).size === ids.length, canonUnique: new Set(canon).size === canon.length,
      defsUnique: new Set(defs).size === defs.length, defReserved: defs.filter((d) => _lxKeyReserved(d)), lost: t.lost,
      offDefault: LX_BIND_FNS.filter((f) => (t.keyOf[f.id] || '') !== (f.def || '')).map((f) => f.id),
      hasAll: ['chat', 'mail', 'ping', 'photo', 'mojimon', 'questGuide', 'cure', 'interact', 'emote1', 'emote0', 'skill:d', 'skill:b', 'wardrobe'].every((id) => ids.includes(id)) };
  });
  check(reg.n >= 45 && reg.idsUnique && reg.canonUnique && reg.defsUnique && reg.hasAll, 'every function is in ONE table - unique ids, unique canonical keys, unique defaults (chat, mail, ping, photo, MojiMon, quest guide, cure, emotes included)', reg);
  check(!reg.defReserved.length && !reg.lost.length && !reg.offDefault.length, 'the defaults hold no duplicate and no reserved key', { reserved: reg.defReserved, lost: reg.lost, off: reg.offDefault });

  // 2. the shipped keys: each fires its function and nothing else
  // L is the Compendium (openMojidex) since the release4 UI pass, per user - Y keeps the MojiDex book
  const DEF = [['w', { toggleWorldMap: 1 }], ['q', { toggleQuestJournal: 1 }], ['j', {}], ['e', { _qnavCycle: 1 }], ['r', { _useCurePotion: 1 }],
    ['Shift', { quickDash: 1 }], ['p', { openPostalWisp: 1 }], ['h', { _mojimonQuickSummon: 1 }], ['o', { togglePhotoMode: 1 }], ['Enter', {}],
    ['y', { toggleLoreMap: 1 }], ['l', { openMojidex: 1 }], ['m', { mute: 1 }], ['a', { startBlock: 1 }], ['u', { toggleSharedModal: 1 }], ['i', {}]];
  const defBad = [];
  for (const [k, want] of DEF) { const got = await press(k); if (!same(got, want)) defBad.push({ k, want, got }); }
  check(!defBad.length, 'every shipped key fires exactly its own function - Shift is Dash only (Cure is R), J (the old journal alias) and I do nothing, and Enter (Chat) does nothing out of co-op', defBad);
  const f = await press('f');
  check(!f['tryInteract:chest'], 'F is the class signature only - it no longer also opens chests (N does)', f);
  await page.evaluate(() => { player._emote = null; game.paused = false; });
  await page.keyboard.press('4');
  check(await page.evaluate(() => !!(player._emote && player._emote.kind === '❤')), 'digit 4 is the ❤ emote');
  await page.evaluate(() => { net.connected = true; });
  const ping = await press('t');
  await page.evaluate(() => { net.connected = false; });
  check(same(ping, { _coopSendPing: 1 }), 'T pings while online', ping);
  // v0.30.1330 - Chat is a co-op function (per user: "make enter not open chat outside co-op"): Enter opens the bar in a room
  // (socket open and welcomed, faked as the co-op suites do) and only there - out of one it is in the shipped-keys row above
  await page.evaluate(() => { window._kbNet = { c: net.connected, w: net.ws, m: net.myId }; net.connected = true; net.ws = { readyState: 1, send() {} }; net.myId = 1; });
  const chatOn = await press('Enter');
  await page.evaluate(() => { const w = window._kbNet; net.connected = w.c; net.ws = w.w; net.myId = w.m; });
  check(same(chatOn, { _mpOpenChat: 1 }), 'Enter opens the chat in a co-op room (out of one it does nothing)', chatOn);

  // 3. the panel: one Keyboard tab (+ Potions, Controller) listing every function
  await page.evaluate(() => { window.toggleKeybindModal = window._kbRealToggle; toggleKeybindModal(); });
  const ui = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('#keybind-modal .kbm-tab-btn')].map((b) => b.dataset.kbmtab),
    on: (document.querySelector('#keybind-modal .kbm-tab-btn.kbm-on') || {}).dataset?.kbmtab, chips: document.querySelectorAll('#kbm-fn-list [data-fn]').length, fns: LX_BIND_FNS.length,
    board: document.querySelectorAll('#kbm-keyboard [data-kbm-key]').length, esc: (document.querySelector('#kbm-keyboard [data-kbm-key="escape"]') || {}).className,
    oldTabs: !!document.getElementById('kbm-tab-controls') }));
  check(same(ui.tabs, ['keyboard', 'potions', 'pad']) && ui.on === 'keyboard' && !ui.oldTabs, 'K opens on ONE Keyboard tab (Controls merged in) beside Potions and Controller', ui);
  check(ui.chips === ui.fns && ui.board >= 69 && /is-res/.test(ui.esc || ''), 'the Keyboard tab lists every function with a key chip, over a full keyboard board (Esc marked fixed)', ui);

  // 4. rebind through the panel: click World Map, press Z -> World Map on Z, Basic Attack swapped onto W
  await page.click('#kbm-fn-list [data-fn="worldMap"]');
  const cap = await page.evaluate(() => ({ cap: _kbCapture, chip: document.querySelector('#kbm-fn-list [data-fn="worldMap"]').textContent, strip: getComputedStyle(document.getElementById('kbm-pickup')).display }));
  await page.keyboard.press('z');
  const sw = await page.evaluate(() => ({ map: _lxFnKey('worldMap'), basic: _lxFnKey('skill:d'), open: document.getElementById('keybind-modal').style.display, cap: _kbCapture,
    chipMap: document.querySelector('#kbm-fn-list [data-fn="worldMap"]').textContent, chipBasic: document.querySelector('#kbm-fn-list [data-fn="skill:d"]').textContent,
    boardZ: document.querySelector('#kbm-keyboard [data-kbm-key="z"]').className, casts: window._kbCasts.length, maps: window._kbC.toggleWorldMap }));
  check(cap.cap === 'worldMap' && cap.chip === '…' && cap.strip === 'flex', 'clicking a chip waits for a key (chip …, the press-a-key strip shows)', cap);
  check(sw.map === 'z' && sw.basic === 'w' && sw.open === 'flex' && !sw.cap && sw.chipMap === 'Z' && sw.chipBasic === 'W' && /g-menus/.test(sw.boardZ) && sw.casts === 0 && sw.maps === 1,
    'Z goes to World Map and Basic Attack swaps onto W - the press itself fired nothing, the panel stayed open, chips and board relabelled', sw);
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => document.getElementById('keybind-modal').style.display !== 'flex'), 'Esc (no rebind waiting) closes the panel');
  const pz = await press('z'), pw = await press('w');
  check(same(pz, { toggleWorldMap: 1 }), 'in play Z opens the World Map and does NOT attack', pz);
  check(pw.cast && pw.cast.length === 1 && !pw.toggleWorldMap, 'in play W attacks (Basic Attack) and does NOT open the map', pw);

  // 5. binding a key onto a function that has none leaves the displaced one unbound (flagged), and Unbind works
  await page.evaluate(() => toggleKeybindModal());
  await page.click('#kbm-fn-list [data-fn="wardrobe"]');
  await page.keyboard.press('m');
  const ub = await page.evaluate(() => ({ wardrobe: _lxFnKey('wardrobe'), mute: _lxFnKey('mute'), chip: document.querySelector('#kbm-fn-list [data-fn="mute"]').className }));
  check(ub.wardrobe === 'm' && ub.mute === '' && /is-off/.test(ub.chip), 'the Fashionista (no key) takes M: Mute is left with no key and its chip says so', ub);
  await page.click('#kbm-fn-list [data-fn="photo"]');
  await page.click('#kbm-cap-unbind');
  check(await page.evaluate(() => _lxFnKey('photo') === '' && _kbCapture === null), 'Unbind clears Photo Mode');
  // 6. a key on the board takes the waiting function; a reserved key is refused and the wait goes on; Esc cancels only the wait
  await page.click('#kbm-fn-list [data-fn="questGuide"]');
  await page.click('#kbm-keyboard [data-kbm-key="i"]');
  await page.click('#kbm-fn-list [data-fn="chat"]');
  const res = await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', bubbles: true, cancelable: true }));
    return { guide: _lxFnKey('questGuide'), cap: _kbCapture, chat: _lxFnKey('chat') }; });
  await page.keyboard.press('Escape');
  const esc = await page.evaluate(() => ({ cap: _kbCapture, open: document.getElementById('keybind-modal').style.display }));
  check(res.guide === 'i' && res.cap === 'chat' && res.chat === 'enter', 'a click on board key I binds the Quest Guide; F12 is refused and Chat keeps waiting', res);
  check(esc.cap === null && esc.open === 'flex', 'Esc while waiting cancels the wait and keeps the panel open', esc);
  await page.keyboard.press('Escape');
  const pm = await press('m'), po = await press('o'), pi = await press('i'), pe = await press('e');
  check(same(pm, { _wardrobeHotkey: 1 }) && same(po, {}) && same(pi, { _qnavCycle: 1 }) && same(pe, {}), 'in play M walks to the Fashionista (not Mute), O is silent (Photo unbound), I is the Quest Guide and E is silent', { pm, po, pi, pe });

  // 7. 400 random rebinds of every kind of function onto every kind of key: never a key twice, the bound function always
  //    holds its new key, the save always reads back to the same table, and each key resolves to its function's canonical key
  const stress = await page.evaluate(() => {
    const KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('').concat(['`', '-', '=', '[', ']', ';', "'", ',', '.', '/', ' ', 'shift', 'control', 'alt', 'tab',
      'enter', 'backspace', 'pageup', 'pagedown', 'home', 'end', 'insert', 'delete', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'f1', 'f5', 'f10', 'é']);
    let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const fails = [], _st = window.showToast, _sv = window.saveState;
    window.showToast = () => {}; window.saveState = () => {};   // 400 toasts and saves would only slow the run
    for (let i = 0; i < 400; i++) {
      const f = LX_BIND_FNS[rnd(LX_BIND_FNS.length)], k = KEYS[rnd(KEYS.length)];
      if (rnd(9) === 0) _kbUnbind(f.id); else _kbAssign(f.id, k);
      const t = _lxBindTable(), seen = {};
      for (const g of LX_BIND_FNS) { const kk = t.keyOf[g.id]; if (!kk) continue; if (seen[kk]) fails.push({ i, dup: kk, a: seen[kk], b: g.id }); seen[kk] = g.id;
        if (_resolveActionKey(kk) !== g.canon) fails.push({ i, resolve: kk, want: g.canon }); }
      if (t.lost.length) fails.push({ i, lost: t.lost });
      if (fails.length) break;
    }
    window.showToast = _st; window.saveState = _sv;
    const t = _lxBindTable();
    const silent = LX_BIND_FNS.filter((g) => g.canon.charAt(0) !== '#' && t.keyOf[g.id] !== g.canon && !t.fnOf[g.canon] && _resolveActionKey(g.canon) !== null).map((g) => g.id);
    return { fails: fails.slice(0, 3), silent, unbound: LX_BIND_FNS.filter((g) => !t.keyOf[g.id]).length };
  });
  check(!stress.fails.length, '400 random rebinds / unbinds: no key ever does two jobs, every bound key resolves to its own function', stress.fails);
  check(!stress.silent.length, 'a function\'s old key with nothing on it now is silent (it does not still fire the function that moved)', stress.silent);

  // 8. a release on one key never drops another function's hold (game.keys holds canonical keys only)
  await page.evaluate(() => { _lxBindReset(); _kbAssign('worldMap', 'z'); game.paused = false; });
  await page.keyboard.down('w');
  const held1 = await page.evaluate(() => !!game.keys.z);
  await page.keyboard.press('z');
  const held2 = await page.evaluate(() => !!game.keys.z);
  await page.keyboard.up('w');
  const held3 = await page.evaluate(() => !!game.keys.z);
  check(held1 && held2 && !held3, 'holding Basic Attack on W survives a tap of Z (World Map) - and lets go with W', { held1, held2, held3 });

  // 9. the touch deck and the pad send a FUNCTION: its key now, or 'lx:<canonical>' when it has none
  const deck = await page.evaluate(() => {
    const out = {}; game.paused = false; player.attackCooldown = 0; window._kbCasts.length = 0; const m0 = window._kbC.toggleWorldMap || 0;
    _mkeyDispatch('keydown', 'z'); _mkeyDispatch('keyup', 'z');
    out.boundCast = window._kbCasts.length; out.boundMap = (window._kbC.toggleWorldMap || 0) - m0;
    out.padBound = _lxPadResolveKey({ k: 'z' }); out.padJump = _lxPadResolveKey({ a: 'jump' });
    _kbUnbind('skill:d'); player.attackCooldown = 0; window._kbCasts.length = 0;
    _mkeyDispatch('keydown', 'z'); _mkeyDispatch('keyup', 'z');
    out.unboundCast = window._kbCasts.length; out.padUnbound = _lxPadResolveKey({ k: 'z' }); out.held = !!game.keys.z;
    return out;
  });
  check(deck.boundCast === 1 && deck.boundMap === 0 && deck.padBound === 'w' && deck.padJump === ' ', 'the deck\'s attack button attacks (not the map on Z); the pad\'s X sends W', deck);
  check(deck.unboundCast === 1 && deck.padUnbound === 'lx:z' && !deck.held, 'with Basic Attack on no key the deck and pad still attack (lx:z), and it lets go', deck);

  // 10. an older save: its duplicates are settled by precedence, the Q/E pins dropped, the missing B slot backfilled
  const mig = await page.evaluate(() => {
    player.keybinds = { z: 'd', x: 's', s: 'a', c: 'e', d: 'w', f: 'q', v: 'c', g: 'x' };                       // no B slot (older than it)
    player.actionBinds = { questJournal: 'e', wardrobe: 'q', worldMap: 'o', hpPotion: '5', jump: ' ', dodge: 'shift' };   // no questGuide: never written by the table
    player.cureKey = 'shift'; delete player.interactKey;
    applyKeybinds();
    const k = (id) => _lxFnKey(id);
    const a = { journal: k('questJournal'), guide: k('questGuide'), wardrobe: k('wardrobe'), map: k('worldMap'), photo: k('photo'), hp: k('hpPotion'), emote5: k('emote5'),
      cure: k('cure'), dash: k('dodge'), chest: k('interact'), b: k('skill:b'), stored: [player.cureKey, player.interactKey, player.actionBinds.photo, player.keybinds.b] };
    applyKeybinds();   // settled: a second pass changes nothing
    a.stable = JSON.stringify([player.keybinds, player.actionBinds, player.cureKey, player.interactKey]);
    applyKeybinds(); a.stable = a.stable === JSON.stringify([player.keybinds, player.actionBinds, player.cureKey, player.interactKey]);
    // a skill left with no key stays that way (the B backfill is for saves that never had the slot)
    _lxBindStore('skill:b', ''); applyKeybinds(); applyKeybinds(); a.bOff = [k('skill:b'), player.keybinds['#off:b']];
    // a skill an older build let onto E keeps it; the Quest Guide gives way
    player.keybinds = { z: 'd', x: 's', s: 'a', c: 'e', e: 'w', f: 'q', v: 'c', g: 'x', b: 'b' }; player.actionBinds = {}; player.cureKey = 'r'; applyKeybinds();
    a.skillE = [k('skill:w'), k('questGuide')];
    return a;
  });
  check(mig.journal === 'q' && mig.guide === 'e' && mig.wardrobe === '' && mig.map === 'o' && mig.photo === '' && mig.hp === '5' && mig.emote5 === '',
    'an older save: the pre-v0.29.389 Q/E pins drop, a map on O keeps it (Photo gives way), an HP potion on 5 keeps it (the 5 emote gives way)', mig);
  check(mig.cure === 'r' && mig.dash === 'shift' && mig.chest === '' && mig.b === 'b' && mig.stored[0] === 'r' && mig.stored[1] === '' && mig.stored[2] === '' && mig.stored[3] === 'b',
    'Cure leaves Dash\'s Shift for its own R, the extra chest key starts unbound, the missing B slot gets B - and the save is rewritten so', mig);
  check(mig.stable && mig.bOff[0] === '' && mig.bOff[1] === 'b' && mig.skillE[0] === 'e' && mig.skillE[1] === '', 'settling is stable; an unbound skill is not re-backfilled; a skill already on E keeps it', mig);

  // 11. the prologue lets movement / combat through by FUNCTION, whatever key it is on
  await page.evaluate(() => { _lxBindReset(); _kbAssign('moveLeft', 'j'); window._prologueActive = true; game.paused = false; });
  await page.keyboard.down('j');
  const plg = await page.evaluate(() => !!game.keys.arrowleft);
  await page.keyboard.up('j');
  const plgMap = await press('w');
  await page.evaluate(() => { window._prologueActive = false; });
  check(plg && same(plgMap, {}), 'in the prologue a Move Left moved to J still walks; the World Map key stays locked', { plg, plgMap });

  // 12. labels follow the keys: prompts, the skill bar, the HUD strip
  const lab = await page.evaluate(() => {
    _lxBindReset(); _kbAssign('block', 'i'); _kbAssign('skill:d', 'pageup'); _kbAssign('talkNpc', 'g');
    return { block: _lxKeyLabel('block'), slot: SLOT_TO_KEY.d, hp: _lxKeyLabel('hpPotion'), talk: _lxKeyLabel('talkNpc'), none: _lxKeyLabel('wardrobe'),
      strip: (document.getElementById('controls') || {}).innerHTML || '' };
  });
  check(lab.block === 'I' && lab.slot === 'PgUp' && lab.talk === 'G' && lab.none === '—' && /<kbd>G<\/kbd> Talk/.test(lab.strip), 'labels read the live keys: Block I, Basic Attack PgUp on the skill bar, Talk G on prompts and the HUD strip, an unbound one a dash', lab);
  check(lab.hp === 'Z', 'Basic Attack taking PgUp swapped the HP potion onto its old Z', lab);

  // 13. Reset puts every function back on its own key
  await page.evaluate(() => { toggleKeybindModal(); });
  await page.click('#kbm-reset');
  const rst = await page.evaluate(() => { const t = _lxBindTable(); return LX_BIND_FNS.filter((f) => (t.keyOf[f.id] || '') !== (f.def || '')).map((f) => f.id); });
  check(!rst.length, 'Reset to defaults puts every function back on its shipped key', rst);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
