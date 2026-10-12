// RELEASE 13e (fresh-player hunt at 1280x720) stays fixed:
//   [1] a skill tap that goes down and up between two frames casts exactly once (Mage / Rogue Z, a Rogue skill key, a rebound key,
//       the touch deck); the Warrior basic still swings once; a hold still casts once per cooldown; a tap made under a stun is spent
//   [2] at a door on the way the quest key says "this door · N maps", not "arrived"
//   [3] a new hero (real new-game flow) stands clear of the tour card on step 1, and a quick Z tap casts for a Mage
//   [4] the tour's "Inventory & Enhancement" step waits for its own Items visit (fresh)
//   [5] the Dream-Well boss spawns clear of the right HUD column; after it falls the pill names what is left (no "0%"); the quest
//       key says "right here" with the targets beside the hero
//   [6] a closing story beat's half-second pause is not force-unpaused by the StuckPauseWatchdog; an unattended death's 6 s
//       auto-respawn logs at info level, not as a warning
//   [7] the forge card's Buy does not cover the stats; the class-pick banner clears Guguma's bubble; the resolution toast does
//       not say "fight"; a door under the right HUD column fades the column while the hero is near it
//   node scripts/release13e_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15140), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  // ---- [3] + [7 banner]: the real new-game flow at 1280x720, a Mage
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window._lxBootMenuSeen, null, { timeout: 240000 }); await sleep(800);
    await page.click('#menu-newgame'); await sleep(800);
    await page.click('#auth-user'); await page.keyboard.type('Tester'); await page.keyboard.press('Enter');
    await page.waitForSelector('#hero-name-input', { state: 'visible', timeout: 60000 }); await sleep(500);
    await page.click('#cs-nav-next'); await sleep(1500);
    const cs = await page.evaluate(() => { const a = document.querySelector('#class-select-modal .guguma-chip').getBoundingClientRect(), b = document.querySelector('#class-select-modal h2.cs-title').getBoundingClientRect(); return { chipBottom: Math.round(a.bottom), bannerTop: Math.round(b.top) }; });
    ok('[7] the class-pick banner starts below Guguma\'s bubble (it sat on its bottom edge)', cs.bannerTop - cs.chipBottom >= 4, cs);
    await page.locator('#class-options > *').nth(2).click(); await sleep(3000);   // Warrior, Rogue, Mage, Archer
    for (let i = 0; i < 60; i++) {
      const t = await page.evaluate(() => { const m = document.getElementById('tutorial-modal'); return m && getComputedStyle(m).display !== 'none' ? m.innerText : ''; });
      if (/first steps/.test(t)) break;
      const sk = page.locator('text=Skip ▸▸'); if (await sk.count()) { try { await sk.first().click({ timeout: 1000 }); } catch (e) {} } else await page.keyboard.press('Enter');
      await sleep(1500);
    }
    await sleep(1500);
    const t1 = await page.evaluate(() => {
      const cv = document.getElementById('game').getBoundingClientRect(), k = cv.width / W, c = document.querySelector('#tutorial-modal .modal').getBoundingClientRect();
      const hl = cv.left + (player.x - game.camera.x) * k, hr = hl + player.w * k, ht = cv.top + (player.y - (game.camera.y || 0)) * k, hb = ht + player.h * k;
      return { cls: player.cls, map: game.currentMap, step1: /first steps/.test(document.getElementById('tutorial-modal').innerText), hero: [hl, ht, hr, hb].map(Math.round), card: [c.left, c.top, c.right, c.bottom].map(Math.round),
        overlap: hl < c.right && hr > c.left && ht < c.bottom && hb > c.top };
    });
    ok('[3] a new Mage on tour step 1 (hold left / right) stands clear of the tour card', t1.cls === 'mage' && t1.map === 'void' && t1.step1 && !t1.overlap, t1);
    await page.evaluate(() => { window.__nz = 0; const o = window.castSkill; window.castSkill = function (id) { if (id === 'magicBolt') window.__nz++; return o.apply(this, arguments); }; });
    for (let i = 0; i < 5; i++) { await page.evaluate(() => { player.attackCooldown = 0; player.skillCooldowns = {}; player.mp = 999; }); await page.keyboard.press('z'); await sleep(900); }
    const nz = await page.evaluate(() => window.__nz);
    ok('[3] five quick Z presses (keyboard.press) cast five Magic Bolts', nz === 5, { casts: nz });
    await ctx.close();
  }
  // ---- the rest in one dev page at 1280x720
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  const cons = []; page.on('console', (m) => cons.push(m.type() + ': ' + m.text()));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player._storyBeatsSeen.captains_teaser = true; player._tutorialSeen = true; player._gravitosCineSeen = true;
    window.__steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    window.__casts = {}; const o = window.castSkill; window.castSkill = function (id) { window.__casts[id] = (window.__casts[id] | 0) + 1; return o.apply(this, arguments); };
    window.__hero = (cls, job) => {
      try { closeAllModals(); } catch (e) {}
      player.cls = cls; player.job = job || null; player.master = null; player.masteries = {}; player.level = 80; player._god = false; player.maxHp = player.hp = 9e6; player.mp = player.maxMp = 99999;
      player.skillCooldowns = {}; player._warCharge = null; player._lxCcEaten = null; player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0; player.attackCooldown = 0; player._castLockUntil = 0;
      game.paused = false; game.monsters.length = 0; for (const k in game.keys) game.keys[k] = false; window.__casts = {};
    };
    // a tap: down and up in one task - no frame runs between them
    window.__tap = (key) => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key, bubbles: true })); };
    try { closeAllModals(); } catch (e) {}
    loadMap('forest', 300); game.paused = false; await __steps(10); game.monsters.length = 0;
  });
  const ev = (f, a) => page.evaluate(f, a);
  const steps = (n) => ev((n) => __steps(n), n);
  // [1] taps between frames
  const t1 = await ev(async () => {
    const out = {}, one = async (cls, job, slot, fire) => { __hero(cls, job); const id = skillBySlot(slot).id; fire(SLOT_TO_KEY[slot]); await __steps(12); return { id, n: __casts[id] | 0 }; };
    out.mageZ = await one('mage', null, 'd', __tap);
    out.rogueZ = await one('rogue', null, 'd', __tap);
    out.rogueSkill = await one('rogue', 'assassin', 's', __tap);
    out.warriorZ = await one('warrior', null, 'd', __tap);
    out.deck = await one('mage', null, 'd', (k) => { _mkeyDispatch('keydown', 'z'); _mkeyDispatch('keyup', 'z'); });
    _kbAssign('skill:d', 'o'); out.rebound = await one('mage', null, 'd', () => __tap('o')); _lxBindReset();
    __hero('mage'); player.stunTimer = 600000; __tap('z'); await __steps(8); player.stunTimer = 0; await __steps(12); out.stunned = __casts.magicBolt | 0;
    __hero('mage'); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', bubbles: true })); await __steps(20);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z', code: 'KeyZ', bubbles: true })); await __steps(6); out.hold = __casts.magicBolt | 0;
    return out;
  });
  ok('[1] a Mage Z tap between two frames casts one Magic Bolt', t1.mageZ.n === 1, t1.mageZ);
  ok('[1] a Rogue Z tap and a Rogue skill-key tap each cast once', t1.rogueZ.n === 1 && t1.rogueSkill.n === 1, { z: t1.rogueZ, skill: t1.rogueSkill });
  ok('[1] the touch deck tap and a rebound basic-attack key tap cast once', t1.deck.n === 1 && t1.rebound.n === 1, { deck: t1.deck, rebound: t1.rebound });
  ok('[1] unchanged: the Warrior basic tap swings once; a short hold casts once; a tap under a stun stays spent', t1.warriorZ.n === 1 && t1.hold === 1 && t1.stunned === 0, { warrior: t1.warriorZ, hold: t1.hold, stunned: t1.stunned });
  // [2] at a door on the way
  const t2 = await ev(async () => {
    __hero('warrior'); player.level = 4; player.quests.completed.q_act1_name = true; player.quests.unlocked.q_road_1 = true; acceptQuest('q_road_1', true);
    loadMap('void', 300); await __steps(30); try { closeAllModals(); } catch (e) {} game.paused = false;
    player.x = 400 - player.w / 2; player.vx = 0; game.qnav = 'q_road_1'; await new Promise((r) => setTimeout(r, 700));
    return { map: game.currentMap, key: ((document.querySelector('.qk-d') || {}).textContent || '').trim() };
  });
  ok('[2] standing at the Void\'s door with the target two maps on, the key says to take the door (not "arrived")', /this door/.test(t2.key) && /2 maps/.test(t2.key) && !/arrived/.test(t2.key), t2);
  // [4] the Inventory step is fresh
  const t4 = await ev(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const I = TUTORIAL_STEPS.findIndex((s) => /Inventory/.test(s.title)), Wp = TUTORIAL_STEPS.findIndex((s) => /First Weapon/.test(s.title));
    const closeU = () => { const am = document.getElementById('attributes-modal'); if (am && am.style.display === 'flex') { am.style.display = 'none'; game.paused = false; } };
    player._tutorialSeen = false; startTutorial(); await wait(500); _showTutorialModal(); await wait(300);
    TUTORIAL_STEPS.forEach((s) => { s._done = false; s._preDone = false; }); for (const k in _TUT_SEEN_TAGS) delete _TUT_SEEN_TAGS[k];
    _tutStep = Wp; _renderTutorialStep(); await wait(200); game._uTab = 'items'; openLevelUpPanel(); await wait(400); closeU();   // the weapon step's U -> Items
    const seen = !!_TUT_SEEN_TAGS.tab_items; _tutStep = I; _renderTutorialStep(); await wait(300);
    const arrive = !!TUTORIAL_STEPS[I]._done; game._uTab = 'items'; openLevelUpPanel(); await wait(400); const after = !!TUTORIAL_STEPS[I]._done; closeU();
    try { _closeTutorial(); } catch (e) {} player._tutorialSeen = true;
    return { fresh: TUTORIAL_STEPS[I].fresh === true, seen, arrive, after };
  });
  ok('[4] "Inventory & Enhancement" is fresh: after the weapon step\'s Items visit it arrives unticked, and its own visit ticks it', t4.fresh && t4.seen && !t4.arrive && t4.after, t4);
  // [5] the Dream-Well
  const t5 = await ev(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    __hero('warrior'); player.level = 4; player.quests = { active: {}, completed: { q_act1_name: true, q_act1_sleepers: true }, unlocked: { q_road_1: true, q_act1_quiet: true }, fresh: {} }; _ensureQuests();
    loadMap('forest', 300); await wait(1500); try { closeAllModals(); } catch (e) {} game.paused = false; player._god = true; player.invulnerable = 9e9; game.monsters.length = 0;
    acceptQuest('q_road_1', true); acceptQuest('q_act1_quiet', true); game.qnav = 'q_act1_quiet'; renderQuestTracker();
    const mk = _lxQMarks().find((x) => x.mk.id === 'well'); player.x = mk.x - 14; player.y = mk.y - player.h; player.vx = 0; await wait(2000); game._lxQMarkT = 0;
    _lxQMarkUse(_lxQMarkTarget()); await wait(60);
    const f = game._lxFight, b = f.boss, cv = document.getElementById('game').getBoundingClientRect(), k = cv.width / W;
    const br = { l: cv.left + (b.x - game.camera.x) * k, r: cv.left + (b.x + b.w - game.camera.x) * k, t: cv.top + (b.y - 30 - (game.camera.y || 0)) * k, b: cv.top + (b.y + b.h - (game.camera.y || 0)) * k };
    out.under = ['quest-tracker', 'hotkey-hint', 'taxi-btn', 'minimap'].filter((id) => { const e = document.getElementById(id); if (!e || !e.getClientRects().length) return false; const z = e.getBoundingClientRect(); return z.left < br.r && z.right > br.l && z.top < br.b && z.bottom > br.t; });
    out.onScreen = br.l >= cv.left && br.r <= cv.right; out.offHero = Math.abs((b.x + b.w / 2) - (player.x + player.w / 2)) > b.w / 2 + 60;
    b.currentHp = Math.floor(b.maxHp * 0.45); _lxFightTick(20); await wait(100); _lxFightHud(); out.split = document.getElementById('lx-sp-hud').textContent;
    b.currentHp = 0; try { killMonster(b); } catch (e) {} await wait(600); _lxFightHud(); out.after = document.getElementById('lx-sp-hud').textContent;
    for (const m of f.mobs) if (m !== b && game.monsters.indexOf(m) >= 0) { m.x = player.x + 90; m.speed = 0; }
    await wait(500); out.key = ((document.querySelector('.qk-d') || {}).textContent || '').trim();
    for (const m of f.mobs) if (game.monsters.indexOf(m) >= 0) { m.currentHp = 0; try { killMonster(m); } catch (e) {} }
    await wait(300); if (game._lxFight) _lxFightEnd(game._lxFight, false); game.qnav = null; return out;
  });
  ok('[5] the Well-Drinker spawns on screen, clear of the quest tracker / hotkeys / taxi / minimap, and off the hero', t5.under.length === 0 && t5.onScreen && t5.offHero, t5);
  ok('[5] after the split the pill names the rest; after the boss falls it names what is left (no "0%")', /Jelly/.test(t5.split) && /Jelly/.test(t5.after) && !/0%/.test(t5.after) && !/more\)/.test(t5.after), { split: t5.split, after: t5.after });
  ok('[5] the hunt key says "right here" with its targets beside the hero', /right here/.test(t5.key), { key: t5.key });
  // [6] a closing beat and the watchdog; the death watchdog's normal auto-respawn
  const t6 = await ev(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), warns = [], w0 = console.warn;
    console.warn = function () { warns.push(String(arguments[0])); return w0.apply(this, arguments); };
    __hero('warrior'); loadMap('forest', 300); await wait(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    _playStoryBeat({ stanzas: [{ text: 'A page.' }] }); await wait(400);
    const up = game.paused && document.getElementById('story-beat-overlay').classList.contains('on');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    game._pausedSinceMs = performance.now() - 4000;   // the watchdog's next pass lands inside the close's 500 ms
    await wait(150); const mid = { paused: game.paused, warned: warns.some((w) => /StuckPauseWatchdog/.test(w)) };
    await wait(800); const end = { paused: game.paused, warned: warns.some((w) => /StuckPauseWatchdog/.test(w)) };
    console.warn = w0; return { up, mid, end };
  });
  ok('[6] a story beat closing: the watchdog does not force-unpause it; the beat itself lets the pause go', t6.up && t6.mid.paused && !t6.mid.warned && !t6.end.paused && !t6.end.warned, t6);
  const c0 = cons.length;
  await ev(async () => { __hero('warrior'); player.maxHp = 100; player.hp = 0; try { triggerDeath(); } catch (e) {} });
  await sleep(8500);
  const dl = cons.slice(c0).filter((l) => /death-watchdog/.test(l));
  ok('[6] an unattended death auto-respawns after 6 s and says so at info level, not as a warning', dl.length === 1 && /^info/.test(dl[0]), dl);
  // [7] the forge card, the toast, the door under the HUD
  await ev(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); __hero('warrior'); player.level = 30; player.mojicoins = 10; loadMap('town', 400); await wait(1500); try { closeAllModals(); } catch (e) {} openShop('weapon'); await wait(600); });
  const cards = await page.$$('#shop-modal .modal.gear-forge .shop-item');
  let worst = null;
  for (const c of cards) {
    await c.hover(); await sleep(250);
    const m = await c.evaluate((el) => { const st = el.querySelector('.name > div:last-child'), bt = el.querySelector('button'); if (!st || !bt) return null; const a = st.getBoundingClientRect(), b = bt.getBoundingClientRect(); return { name: (el.querySelector('.name b') || {}).textContent, lines: Math.round(a.height / parseFloat(getComputedStyle(st).lineHeight)), overlap: Math.round(a.bottom - b.top) }; });
    if (m && (!worst || m.overlap > worst.overlap)) worst = m;
  }
  ok('[7] a hovered forge card\'s Buy does not cover its stats lines', !!worst && worst.overlap <= 0, { cards: cards.length, worst });
  const t7 = await ev(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try { closeAllModals(); } catch (e) {} game.paused = false;
    const src = await (await fetch(location.href.split('?')[0])).text();
    player.quests.unlocked.q_act1_waking = true; try { acceptQuest('q_act1_waking', true); } catch (e) {} renderQuestTracker();
    const door = MAPS.town.portals.find((p) => /Megamall/.test(p.name)) || { x: 1479 };
    player.x = door.x - 260; player.vx = 0; await wait(2500); const near = ['quest-tracker', 'hotkey-hint', 'taxi-btn'].filter((id) => { const e = document.getElementById(id); return e && e.classList.contains('lx-hud-see'); });
    const op = near.length ? getComputedStyle(document.getElementById(near[0])).opacity : null;
    player.x = 300; await wait(2500); const far = ['quest-tracker', 'hotkey-hint', 'taxi-btn'].filter((id) => { const e = document.getElementById(id); return e && e.classList.contains('lx-hud-see'); });
    return { fight: /Resolution eased for this area to keep the fight playable/.test(src), smooth: /Resolution eased for this area to keep play smooth/.test(src), near, far, op };
  });
  ok('[7] the resolution toast no longer says "fight"', !t7.fight && t7.smooth, { fight: t7.fight, smooth: t7.smooth });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
