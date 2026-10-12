// RELEASE 12d (bug hunt - an earned reward is never lost to a full bag, a reload, a crash or time) stays fixed:
//   1 quest gear goes into the bag (a full tab: the Postal Wisp, forced) - never onto the unsaved ground - and survives a reload
//   2 a forced parcel (quest gear, the god weapon) is held past the 30-parcel cap, marked kept, and never expires
//   3 a parcel that does expire after 7 days is announced (the title menu's save notice), not dropped silently
//   4 the Hourglass verdict cut off by a reload pays when the replayed scene closes - exactly once (and once in normal play)
//   5 an unpicked boss boon wheel comes back after a reload with the same three boons; a pick is paid once, never re-offered
//   6 a failed enhancement is saved (its pity counter is on disk within the save debounce)
//   node scripts/release12d_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 14871), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const bootIn = async (page) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
};
// reload through the real title: boot, read the menu's save notice, press Continue, wait for the world
const reloadIn = async (page) => {
  await bootIn(page); await page.waitForTimeout(1500);
  const notice = await page.evaluate(() => { const n = document.getElementById('menu-save-notice'); return n && !n.hidden ? n.textContent : ''; });
  await page.click('#menu-continue').catch(() => {});
  await page.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return (!o || o.classList.contains('fade') || getComputedStyle(o).display === 'none') && !!player.cls; }, null, { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => { player.invulnerable = 1e12; player._god = true; });
  return notice;
};
const setup = `try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  player._tutorialSeen = true; window._prologueAfterCreation = false; window._lxAwaitingCreation = false;
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) applyClass('warrior'); player.level = 80; player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) if (k !== 'hourglass_verdict') player._storyBeatsSeen[k] = true;
  player._storyBeatsSeen.captains_teaser = true; player._storyBeatsSeen.barnaby_fall = true; try { for (const k in LX_KILL_FILMS) { const f = LX_KILL_FILMS[k]; if (f && f.key) player._storyBeatsSeen[f.key] = true; } } catch (e) {}`;
const flush = (page) => page.evaluate(() => { game._resetting = false; _flushSaveStateNow(); });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await bootIn(page);
  // ---------------- 1 + 2: quest gear, the god weapon, the post office ----------------
  const A = await page.evaluate(async (setup) => {
    eval(setup); const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    loadMap('town', 400); await sleep(1500); game.paused = false;
    const ids = Object.keys(QUESTS).filter((k) => { const q = QUESTS[k], r = q.rewards || {}; return r.gearChance === 1 && !q.critical && !q.story && !q.beatOnComplete && !q.bossFight && !/advancement|portal|hourglass|pq_/.test(k); });
    out.nQuests = ids.length; const id = ids[0]; out.id = id;
    const tabOf = (x) => _itemTab(x), eq = () => player.inventory.filter((x) => x && tabOf(x) === 'equip');
    const fillEquip = (n) => { player.inventory = player.inventory.filter((x) => !x || tabOf(x) !== 'equip' || !/^Filler /.test(x.name)); for (let i = eq().length; i < n; i++) player.inventory.push({ name: 'Filler ' + i, rarity: 'rare', tier: 3, slot: 'weapon', icon: '🗡️', stars: 0 }); };
    const run = () => { delete player.quests.completed[id]; player.quests.active[id] = { progress: 9999, count: 1, acceptedAt: Date.now() }; game.drops = [];
      const names0 = new Set(eq().map((x) => x.name)), p0 = (player.postbox || []).length; _completeQuest(id);
      return { bag: eq().filter((x) => !names0.has(x.name)).map((x) => x.name), held: (player.postbox || []).slice(p0).map((p) => ({ n: p.it.name, keep: p.keep })), ground: game.drops.filter((d) => d._questReward).length }; };
    player.postbox = []; fillEquip(0); out.room = run();
    fillEquip(player.invCap.equip); player.postbox = Array.from({ length: 30 }, (_, i) => ({ it: { name: 'Held ' + i, rarity: 'epic', tier: 3, slot: 'weapon', icon: '🗡️', stars: 0 }, at: Date.now() - 1000 * (30 - i) }));
    out.full = run(); out.boxAfterQuest = player.postbox.length;
    const gw = _lxGrantGodWeapon(); out.god = { name: gw && gw.name, held: player.postbox.some((p) => gw && p.it === gw && p.keep), ground: game.drops.filter((d) => d._questReward).length };
    out.questItem = out.full.held[0] ? out.full.held[0].n : null; out.bagItem = out.room.bag[0] || null; out.godName = gw && gw.name;
    game.drops = []; out.boxSaved = player.postbox.length;
    return out;
  }, setup);
  ok('1. setup: quests with a guaranteed gear reward exist (' + A.nQuests + ')', A.nQuests > 0 && !!A.id, A);
  ok('1. quest gear with room goes straight into the bag, nothing on the ground', A.room.bag.length === 1 && A.room.held.length === 0 && A.room.ground === 0, A.room);
  ok('1+2. quest gear on a full bag AND a full post office (30) is held by the Wisp anyway, kept', A.full.held.length === 1 && A.full.held[0].keep === 1 && A.full.ground === 0 && A.boxAfterQuest === 31, A.full);
  ok('2. the god weapon on a full bag and a full post office is held, kept - not left on the ground', A.god.held && A.god.ground === 0, A.god);
  // ---------------- 6: a failed enhancement is saved ----------------
  await flush(page);
  const E = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const it = { name: 'R12D Anvil Blade', rarity: 'epic', tier: 5, slot: 'weapon', icon: '🗡️', stars: 8, cls: 'any', atk: 50 }; player.inventory.push(it);
    player.mojicoins = 1e9; game._resetting = false; _flushSaveStateNow(); await sleep(2500); _flushSaveStateNow();
    if (game._saveTimer) { clearTimeout(game._saveTimer); game._saveTimer = null; } game._saveDirty = false;
    const mr = Math.random; Math.random = () => 0.9999; try { attemptEnhance(it); } finally { Math.random = mr; }
    const live = { stars: it.stars, pity: it._pity };
    await sleep(2600);
    let saved = null; try { const sv = JSON.parse(localStorage.getItem(SAVE_KEY)); const x = (sv.player.inventory || []).find((y) => y && y.name === 'R12D Anvil Blade'); saved = x ? { stars: x.stars, pity: x._pity || 0 } : 'missing'; } catch (e) { saved = String(e.message); }
    return { live, saved };
  });
  ok('6. the failed attempt is saved within the debounce (pity 1 on disk, stars kept)', E.live.pity === 1 && E.live.stars === 8 && E.saved && E.saved.pity === 1 && E.saved.stars === 8, E);
  // ---------------- 5: the boss boon wheel, open at the reload ----------------
  const W = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    loadMap('forest', 400); await sleep(1500); { const w = document.getElementById('everdawn-welcome-overlay'); if (w) w.remove(); }   // the town's welcome card would hold the wheel back
    closeAllModals(); game.paused = false; player.boons = []; player.boonsEquipped = [];
    showPowerupChoice({ name: 'King Slime, the Test', icon: '👑' }); await sleep(600);
    const m = document.getElementById('powerup-modal');
    // time: a 7-day-old ordinary parcel leaves (announced); a 30-day-old kept one stays (added just before the save the reload reads)
    const now = Date.now(), d = 86400000; player.postbox = (player.postbox || []).slice(2);   // two ordinary parcels collected
    player.postbox.push({ it: { name: 'Old Parcel', rarity: 'epic', tier: 3, slot: 'weapon', icon: '🗡️', stars: 0 }, at: now - 8 * d });
    player.postbox.push({ it: { name: 'Kept Old', rarity: 'epic', tier: 3, slot: 'weapon', icon: '🗡️', stars: 0 }, at: now - 30 * d, keep: 1 });
    return { owners: (typeof _lxPauseOwners === 'function') ? _lxPauseOwners().map((e) => e && e.id) : null, paused: game.paused, open: m.style.display === 'flex', offer: [...m.querySelectorAll('.powerup-card .pc-name')].map((x) => x.textContent), boons: player.boons.length };
  });
  await flush(page);
  ok('5. setup: the wheel is open with three boons, nothing picked', W.open && W.offer.length === 3 && W.boons === 0, W);
  // ---------------- reload 1 ----------------
  const notice1 = await reloadIn(page);
  const B = await page.evaluate(async (A) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const names = (player.postbox || []).map((p) => p.it.name);
    out.box = { n: names.length, quest: names.includes(A.questItem), god: names.includes(A.godName), keptOld: names.includes('Kept Old'), old: names.includes('Old Parcel'),
      keeps: (player.postbox || []).filter((p) => p.keep).map((p) => p.it.name) };
    out.bag = player.inventory.some((x) => x && x.name === A.bagItem);
    const m = document.getElementById('powerup-modal'); const t0 = Date.now();
    while (Date.now() - t0 < 15000 && m.style.display !== 'flex') await sleep(250);
    out.wheel = { open: m.style.display === 'flex', offer: [...m.querySelectorAll('.powerup-card .pc-name')].map((x) => x.textContent) };
    if (out.wheel.open) { await sleep(600); const c = m.querySelector('#powerup-options .powerup-card'); if (c) c.click(); await sleep(400); }
    out.boons = (player.boons || []).length; out.owed = game._lxBoonOwed || null;
    game._resetting = false; _flushSaveStateNow();
    return out;
  }, A);
  ok('1. after a reload the quest gear given with room is still in the bag', B.bag, { bagItem: A.bagItem });
  ok('1+2. after a reload the held quest gear and the god weapon are still at the post office (kept)', B.box.quest && B.box.god && B.box.keeps.includes(A.questItem) && B.box.keeps.includes(A.godName), B.box);
  ok('2. a kept parcel 30 days old is still held', B.box.keptOld, B.box);
  ok('3. the 8-day-old ordinary parcel left - and the title menu said so', !B.box.old && /Old Parcel/.test(notice1) && /7 days/.test(notice1), { notice: notice1, box: B.box });
  ok('5. the wheel comes back after the reload with the same three boons', B.wheel.open && B.wheel.offer.join('|') === W.offer.join('|'), { before: W.offer, after: B.wheel });
  ok('5. picking it pays one boon and nothing is owed any more', B.boons === 1 && !B.owed, { boons: B.boons, owed: B.owed });
  // ---------------- reload 2: no second wheel; the Hourglass verdict cut off ----------------
  await reloadIn(page);
  const C = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    await sleep(6000); const m = document.getElementById('powerup-modal'); out.wheel = m.style.display === 'flex'; out.boons = (player.boons || []).length;
    for (const k of ['q_hourglass_1', 'q_hourglass_2', 'q_hourglass_3', 'q_hourglass_4', 'q_boss_aetherion']) player.quests.completed[k] = player.quests.completed[k] || Date.now();
    delete player.quests.completed.q_hourglass_5; player.quests.active.q_hourglass_5 = { progress: 1, count: 1, acceptedAt: Date.now() };
    if (player._storyChoices) { delete player._storyChoices.hourglass; delete player._storyChoices.hourglass_paid; } delete player._storyBeatsSeen.hourglass_verdict;
    _completeQuest('q_hourglass_5');
    const ov = document.getElementById('story-beat-overlay'), t0 = Date.now();
    while (Date.now() - t0 < 8000 && !ov.classList.contains('on')) await sleep(200);
    out.beat = ov.classList.contains('on'); out.open = player._lxBeatOpen || null;
    out.hp_l = (player.consumables || {}).hp_l || 0; out.coins = player.mojicoins;
    game._resetting = false; _flushSaveStateNow();
    return out;
  });
  ok('5. a picked wheel is not offered again after another reload', !C.wheel && C.boons === 1, C);
  ok('4. setup: the verdict scene is on screen when the game is closed', C.beat && C.open === 'hourglass_verdict', C);
  const clickThrough = () => page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), ov = document.getElementById('story-beat-overlay'), t0 = Date.now();
    while (Date.now() - t0 < 12000 && !ov.classList.contains('on')) await sleep(200);
    const played = ov.classList.contains('on');
    for (let i = 0; i < 40 && ov.classList.contains('on'); i++) { const b = [...ov.querySelectorAll('button')].find((x) => /Reseal/.test(x.textContent || '')); if (b) b.click(); else ov.click(); await sleep(350); }
    await sleep(2000);
    return { played, hp_l: (player.consumables || {}).hp_l || 0, paid: !!(player._storyChoices || {}).hourglass_paid, v: (player._storyChoices || {}).hourglass, open: player._lxBeatOpen || null };
  });
  // ---------------- reload 3: the replay pays ----------------
  await reloadIn(page);
  const D = await clickThrough();
  await flush(page);
  ok('4. after the reload the verdict scene plays again and closing it pays the reward (4 Large Potions)', D.played && D.hp_l === C.hp_l + 4 && D.v === 'resealed', { before: C.hp_l, after: D });
  // ---------------- reload 4: paid exactly once; then normal play pays once ----------------
  await reloadIn(page);
  const F = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 5000)); return { hp_l: (player.consumables || {}).hp_l || 0, beat: document.getElementById('story-beat-overlay').classList.contains('on') }; });
  ok('4. ...and only once: another reload replays nothing and pays nothing', F.hp_l === D.hp_l && !F.beat, { D: D.hp_l, F });
  const G0 = await page.evaluate(() => { delete player.quests.completed.q_hourglass_5; player.quests.active.q_hourglass_5 = { progress: 1, count: 1, acceptedAt: Date.now() };
    delete player._storyChoices.hourglass; delete player._storyChoices.hourglass_paid; delete player._storyBeatsSeen.hourglass_verdict; _completeQuest('q_hourglass_5'); return (player.consumables || {}).hp_l || 0; });
  const G = await clickThrough();
  await page.waitForTimeout(2500);
  const G2 = await page.evaluate(() => (player.consumables || {}).hp_l || 0);
  ok('4. normal play (no reload): the verdict pays exactly once', G.played && G.hp_l === G0 + 4 && G2 === G0 + 4, { G0, G, G2 });
  // ---------------- 7 + 8: a boss that dies while the hero is downed; a long wait ----------------
  const H = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, pm = document.getElementById('powerup-modal'), shown = () => pm.style.display === 'flex';
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(200); } return !!fn(); };
    const up = () => player.hp > 0 && !player._downed && !(game.dying > 0);
    closeAllModals(); game.paused = false; game._pendingBossBoon = null; game._lxBoonOwed = null; player.boons = []; player.boonsEquipped = [];
    // 7a. downed, then the boss dies (a DoT / a summon): the wheel must not open under the DOWNED card
    loadMap('forest', 400); await sleep(1500); game.paused = false; player.invulnerable = 0; player._god = false; player._noDownUntil = 0; game.monsters.length = 0;
    out.downed = _coopTryDowned() !== false && !!player._downed;
    const m = spawnMonster(player.x + 200, player.y - 40, 'king', true, false); m.currentHp = 0; killMonster(m);
    await sleep(2400); out.whileDown = { wheel: shown(), queued: !!game._pendingBossBoon };
    const btn = document.getElementById('coop-downed-skip'); out.skipBtn = !!btn; if (btn) btn.click(); else _coopDownedGiveUp();   // "Respawn now"
    out.cameBack = await waitFor(() => up() && shown(), 30000); out.afterRespawn = { wheel: shown(), up: up() };
    if (shown()) { const c = pm.querySelector('#powerup-options .powerup-card'); await sleep(600); if (c) c.click(); await sleep(400); }
    out.boons7a = player.boons.length;
    // 7b. the wheel is up and the hero dies: the death queues it instead of closing it away
    player.invulnerable = 1e12; player._god = true; closeAllModals(); game.paused = false; await waitFor(up, 15000);
    showPowerupChoice({ name: 'Mooma, the Test', icon: '👑' }); await sleep(600); out.offer = [...pm.querySelectorAll('.powerup-card .pc-name')].map((x) => x.textContent);
    player.hp = 0; triggerDeath(); await sleep(300); out.closed = !shown();
    out.reoffered = await waitFor(() => up() && shown(), 30000); out.offer2 = [...pm.querySelectorAll('.powerup-card .pc-name')].map((x) => x.textContent);
    closeAllModals(); game.paused = false; await sleep(300);
    // 8. a queued boon still waiting after the 40th try is kept, and offered once the game can show it
    game._pendingBossBoon = { name: 'King Slime, the Long Wait', icon: '👑' }; game.paused = true; _lxDeliverPendingBoon(39); await sleep(2500);
    out.kept = !!game._pendingBossBoon && !shown(); game.paused = false;
    out.late = await waitFor(shown, 12000); closeAllModals(); game.paused = false;
    return out;
  });
  ok('7. setup: the hero is downed (hp held at 1)', H.downed, H);
  ok('7. a boss dying while the hero is downed does not open the wheel under the DOWNED card - it is queued', !H.whileDown.wheel && H.whileDown.queued, H.whileDown);
  ok('7. after "Respawn now" the wheel is offered and pays a boon', H.cameBack && H.boons7a === 1, { back: H.cameBack, after: H.afterRespawn, boons: H.boons7a, skip: H.skipBtn });
  ok('7. a death with the wheel up queues it; it comes back after the respawn with the same three boons', H.closed && H.reoffered && H.offer.length === 3 && H.offer2.join('|') === H.offer.join('|'), { offer: H.offer, offer2: H.offer2, re: H.reoffered });
  ok('8. a queued boss boon is still kept after its 40th try, and offered once the game unpauses', H.kept && H.late, { kept: H.kept, late: H.late });
  // ---------------- 9: a save from before v0.30.414 (unsigned) ----------------
  const fresh = async () => { const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); await c.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push('9: ' + String(e.message).slice(0, 140))); return p; };
  const inject = async (p, json) => { await p.goto(`http://localhost:${PORT}/__r12d_blank`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await p.evaluate((j) => { localStorage.setItem('levelx_save_v1', j); }, json); };
  const P0 = await fresh(); await bootIn(P0);
  const OLD = await P0.evaluate((setup) => {
    eval(setup); const cls = (JOBS.warlock && (JOBS.warlock.cls || JOBS.warlock.from)) || 'mage'; applyClass(cls);
    player.level = 33; player.job = 'warlock'; player.master = 'necromancer'; player.mojicoins = 12345; player.skillRanks = Object.assign({}, player.skillRanks, { necromancer_harvest: 3 });
    player.inventory.push({ name: 'Old Charm', rarity: 'rare', tier: 2, slot: 'accessory', icon: '💍', stars: 0 });
    game._resetting = false; _flushSaveStateNow();
    const sv = JSON.parse(localStorage.getItem(SAVE_KEY)), signed = JSON.stringify(sv);
    // the pre-v0.30.414 shape: no signature, no _cdCarry, mesos, master 'lich', lich_harvest, slot 'accessorie'
    delete sv.sig; delete sv.sig5; delete sv.sq; delete sv.player._cdCarry; sv.player.mesos = sv.player.mojicoins; delete sv.player.mojicoins; sv.player.master = 'lich';
    sv.player.skillRanks = sv.player.skillRanks || {}; delete sv.player.skillRanks.necromancer_harvest; sv.player.skillRanks.lich_harvest = 3; for (const it of sv.player.inventory) if (it && it.name === 'Old Charm') it.slot = 'accessorie';
    const bad = JSON.parse(signed); bad.player.level = 99;   // signed shape, broken signature
    return { old: JSON.stringify(sv), bad: JSON.stringify(bad), cls };
  }, setup);
  await P0.context().close();
  // a fresh browser: it loads, migrated, and the first flush signs it
  const P1 = await fresh(); await inject(P1, OLD.old); const n1 = await reloadIn(P1);
  const L = await P1.evaluate(() => { const it = player.inventory.find((x) => x && x.name === 'Old Charm');
    const o = { lv: player.level, coins: player.mojicoins, master: player.master, ranks: player.skillRanks && player.skillRanks.necromancer_harvest, lichLeft: !!(player.skillRanks || {}).lich_harvest, slot: it && it.slot, verdict: game._saveVerdict };
    game._resetting = false; _flushSaveStateNow(); const sv = JSON.parse(localStorage.getItem(SAVE_KEY)); o.signed = typeof sv.sig === 'string' && sv.sig.length > 10 && _lxLocalSaveVerdict(sv, false) === 'ok'; o.mesos = sv.player.mesos; return o; });
  ok('9. an old (unsigned, pre-v0.30.414) save loads on a fresh browser: level, coins (mesos), lich -> necromancer, accessorie migrated', L.lv === 33 && L.coins >= 12345 && L.coins < 13000 && L.master === 'necromancer' && L.ranks === 3 && !L.lichLeft && L.slot === 'accessory', { L, notice: n1 });
  ok('9. ...and the first flush signs it', L.signed && L.mesos === undefined, L);
  // the same bytes on this browser, which now signs its saves: refused, as an older save (not "edited"); the backup will not restore
  // (its verified copy is gone - a backup restore or a new game removes it - so nothing can roll the save back; the browser still signs)
  await inject(P1, OLD.old); await P1.evaluate(() => localStorage.removeItem('levelx_save_v1_verified')); await bootIn(P1); await P1.waitForTimeout(1500); const n2 = await P1.evaluate(() => { const n = document.getElementById('menu-save-notice'); return n && !n.hidden ? n.textContent : ''; });
  const M = await P1.evaluate(async () => { const b = (_lxGetBackups() || []).find((x) => x && /older version/.test(x.label || ''));
    window.__r12dStay = 1; const toasts = []; const st = window.showToast; window.showToast = function (m) { toasts.push(String(m)); return st.apply(this, arguments); };
    if (b) _lxRestoreBackup(b.id); await new Promise((r) => setTimeout(r, 1500));
    return { lv: player.level, label: b ? b.label : null, stayed: window.__r12dStay === 1, toast: toasts.find((t) => /backup/i.test(t)) || '' }; }).catch((e) => ({ reloaded: String(e.message).slice(0, 80) }));
  ok('9. the same unsigned bytes on a browser that already signed a save are refused - "older version", not "edited"', M.lv !== 33 && /older version/.test(n2) && !/edited/.test(n2) && M.label === 'auto · older version, not verified', { n2, M });
  ok('9. ...and restoring that backup is refused with the same rule (no reload into the same refusal)', M.stayed === true && /older version/.test(M.toast), M);
  await P1.context().close();
  // a signed-shape save with a broken signature is still refused as edited
  const P2 = await fresh(); await inject(P2, OLD.bad); await bootIn(P2); await P2.waitForTimeout(1500); const n3 = await P2.evaluate(() => { const n = document.getElementById('menu-save-notice'); return n && !n.hidden ? n.textContent : ''; });
  const N = await P2.evaluate(() => player.level);
  ok('9. a signed save with a broken signature is still refused as edited', N !== 99 && /edited outside the game/.test(n3), { n3, lv: N });
  await P2.context().close();
  ok('no page errors', errs.length === 0, errs.slice(0, 5));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 600)); }
finally { await browser.close().catch(() => {}); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
