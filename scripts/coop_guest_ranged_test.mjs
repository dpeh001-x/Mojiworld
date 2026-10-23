// CO-OP GUESTS: A RANGED MOB SHOOTS THE PLAYER IT IS FIGHTING, AND A FORGEWIGHT'S HEAT AURA BURNS A GUEST (bug hunt, fix-coop-ranged-aim /
// fix-coop-heat-aura). The non-boss ranged block of updateMonsters read the HOST's player for its range gate, its on-screen gate and its
// aim, so a mob standing 150 px from a guest never fired unless the host was close too (shots in 9 s with the host at x = 1400 / 600 / 60:
// 6 / 0 / 0), and a guest could farm ranged mobs for free; the Forgewight's heat aura (host-only AI, no mirror code) never burned a guest.
// Three real clients over the real relay (mp/server.mjs, started here): A hosts, B is the guest, S plays solo beside them.
//   [1] a ranged mob 150 px from the GUEST fires wherever the host stands (x 1400 / 600 / 60), and the host - out of range - is left alone
//   [2] the shots HIT the guest on its own screen: it loses HP (once per shot at most, never inside an i-frame), the far host loses none
//   [3] with both players near, the mob aims at the NEARER one (guest nearer: aimed at the guest; host nearer: aimed at the host)
//   [4] the Forgewight's heat aura burns a guest standing in it with the host far away, for exactly the hit the host takes in the same place
//   [5] SOLO is untouched: a lone player is still shot at, aimed at itself
//   [7] a Shardlich's ground spikes erupt under a guest, for the host's hit
//   [6] the other host-only reads: a signature skill (voltipup's lightning strike) is cast at a guest, and a Brinekraken's pull drags one
//   node scripts/coop_guest_ranged_test.mjs      PORT / MOJI_GAME_FILE override (an unfixed copy of the game in the repo root fails [1] [2] [4] [6] [7])
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11353), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 420) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { let v = null; try { v = await fn(); } catch (e) {} if (v || Date.now() - t0 > ms) return v; await sleep(200); } };
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' }); await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu'] });
const errs = [];
const boot = async (name, lv, map) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript((ws) => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('levelx_mp_url', ws); localStorage.setItem('lx_drs', 'off'); } catch (e) {} }, `ws://localhost:${PORT}`);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(name + ': ' + String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function' && typeof mpConnect === 'function', null, { timeout: 240000 });
  await page.evaluate(async ({ nm, lv, map }) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true; if (player.look) player.look.name = nm;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(1500); try { devSetLevel(lv); } catch (e) { player.level = lv; }
    await sl(600); player.hp = getMaxHp(); player.mp = getMaxMp();
    try { closeAllModals(); } catch (e) {} loadMap(map); await sl(2500); try { closeAllModals(); } catch (e) {}
    try { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') _closeTutorial(true); } catch (e) {} game.paused = false;
    // every shot a mob fires: where the player it was aimed at stood (fireMonsterProjectile reads `player`; the aim swaps it onto a partner for the call)
    window.__aims = []; const o = window.fireMonsterProjectile; window.fireMonsterProjectile = function (m) { window.__aims.push(Math.round(player.x)); return o.apply(this, arguments); };
    // the hero's HP, sampled: every drop is one hit taken
    window.__drops = []; let last = null, t0 = performance.now();
    // (topped up below 60% so a run of hits never downs the hero: a downed partner is, rightly, no longer anything's target)
    window.__hpWatch = setInterval(() => { let h = Math.round(player.hp); if (last !== null && h < last) window.__drops.push({ t: Math.round(performance.now() - t0), d: last - h }); if (h > 0 && h < getMaxHp() * 0.6) { player.hp = getMaxHp(); h = Math.round(player.hp); } last = h; }, 20);
  }, { nm: name, lv, map });
  return page;
};
const join = async (p, room) => { await p.evaluate(({ url, room }) => mpConnect(url, 'x' + Math.random().toString(36).slice(2, 5), room), { url: `ws://localhost:${PORT}`, room }); return until(() => p.evaluate(() => net.connected && net.myId != null), 15000); };
// put a hero at x on the forest floor; god = Aegis (takes nothing)
const stand = (p, x, god) => p.evaluate(({ x, god }) => { player._god = !!god; player.hp = getMaxHp(); player.invulnerable = 0; player._downed = false; player.x = x; player.y = 436; player.vx = 0; player.vy = 0; game.paused = false; window.__drops.length = 0; window.__aims.length = 0; }, { x, god });
const clearMobs = (p) => p.evaluate(() => { try { clearInterval(window.__pin); } catch (e) {} for (const m of game.monsters) m.currentHp = 0; game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; });
// a pinned mob whose centre is `gap` px right of x: it cannot walk, so the distance is the experiment's
const pinMob = (p, type, cx, opts) => p.evaluate(({ type, cx, opts }) => { const m = spawnMonster(cx, 300, type, false, false); if (!m) return null; m.x = cx - m.w / 2; m.y = 436 + 44 - m.h; m.currentHp = m.maxHp = 1e9; m.speed = 0;
  if (opts && opts.fast) { m.shootCd = 800; m.shootCdVar = 100; } if (opts && opts.noShoot) m.shoot = null;
  if (opts && opts.only) { const t = m.traits && m.traits[opts.only]; m.traits = {}; m.traits[opts.only] = t; }   // one trait alone: the Forgewight's smash and the Kraken's slam would drown the thing under test
  const x0 = m.x; window.__pin = setInterval(() => { m.x = x0; m.vx = 0; }, 16); return { w: m.w, lvl: _mobLevel(m) }; }, { type, cx, opts });
try {
  const A = await boot('Alpha', 60, 'forest'), B = await boot('Beta', 60, 'forest'), S = await boot('Solo', 60, 'forest');
  const code = 'RG' + Math.random().toString(36).slice(2, 7).toUpperCase();
  await join(A, code); await join(B, code);
  ok('A and B joined one party (S plays solo)', await until(() => A.evaluate(() => Object.keys(net.peers).length === 1), 10000) && await until(() => B.evaluate(() => Object.keys(net.peers).length === 1), 10000));
  await sleep(3000);
  // the weakest ground shooter that fires at a steady cadence: its hits are small enough to count, and the Lv 60 heroes survive them
  const TYPE = await A.evaluate(() => { const c = Object.entries(monsterTypes).filter(([k, t]) => t.shoot && !t.flies && !t.boss && !t.isBoss && !t.traits && (t.shootCd || 9999) <= 2500 && !k.startsWith('zodiac') && !k.startsWith('tower') && !k.startsWith('pq'))
    .sort((a, b) => (a[1].level || 0) - (b[1].level || 0)); return c.length ? c[0][0] : null; });
  ok('a ranged ground mob type exists to test with', !!TYPE, TYPE);
  const FORGE = await A.evaluate(() => (monsterTypes.forgewight && monsterTypes.forgewight.traits && monsterTypes.forgewight.traits.heatAura) ? 'forgewight' : null);
  ok('the Forgewight (heatAura) exists to test with', !!FORGE, FORGE);

  // ---- [1] shots at the guest, by where the host stands
  const shots = {};
  for (const hostAt of [1400, 600, 60]) {
    await clearMobs(A); await sleep(300);
    await stand(A, hostAt, true); await stand(B, 1500, true); await sleep(500);
    await pinMob(A, TYPE, 1650, { fast: true });
    await sleep(8000);
    shots[hostAt] = await A.evaluate(() => window.__aims.length);
  }
  ok('[1] a ranged mob 150 px from the guest fires with the host at x = 1400, 600 and 60', shots[1400] > 0 && shots[600] > 0 && shots[60] > 0, shots);

  // ---- [2] the shots land on the guest, once each; the far host is untouched
  await clearMobs(A); await sleep(300);
  await stand(A, 60, false); await stand(B, 1500, false); await sleep(500);
  await pinMob(A, TYPE, 1650, { fast: true });
  await sleep(10000);
  const shotsAtGuest = await A.evaluate(() => window.__aims.length), drops = await B.evaluate(() => window.__drops), hostHp = await A.evaluate(() => ({ hp: Math.round(player.hp), max: getMaxHp(), drops: window.__drops.length }));
  const gaps = drops.slice(1).map((d, i) => d.t - drops[i].t);
  ok('[2] the guest loses HP to the shots - at least one hit, never more hits than shots', drops.length >= 1 && drops.length <= shotsAtGuest, { shotsAtGuest, drops: drops.length });
  ok('[2] ...each hit once: no two inside the i-frame window, and every hit the same size', gaps.every((g) => g >= 300) && new Set(drops.map((d) => d.d)).size <= 2, { gaps, sizes: drops.map((d) => d.d) });
  ok('[2] the far host (out of range, not invulnerable) took no hit', hostHp.drops === 0 && hostHp.hp === hostHp.max, hostHp);

  // ---- [3] both near: the mob fights the nearer player
  const aimOf = async (hostAt, guestAt) => { await clearMobs(A); await sleep(300); await stand(A, hostAt, true); await stand(B, guestAt, true); await sleep(500); await pinMob(A, TYPE, 1650, { fast: true }); await sleep(6000); return { host: await A.evaluate(() => Math.round(player.x)), guest: await B.evaluate(() => Math.round(player.x)), aims: await A.evaluate(() => window.__aims.slice()) }; };
  const g1 = await aimOf(1250, 1500), h1 = await aimOf(1500, 1250);
  // (a shot knocks its target back a few px, so the aim is compared with where the hero was put, give or take 20)
  ok('[3] guest nearer (150 px against 400 px): every shot is aimed at the guest, not the host', g1.aims.length >= 2 && g1.aims.every((x) => Math.abs(x - 1500) <= 20), g1);
  ok('[3] host nearer: every shot is aimed at the host', h1.aims.length >= 2 && h1.aims.every((x) => Math.abs(x - 1500) <= 20), h1);

  // ---- [4] the heat aura on a guest, equal to the host's own (the host's silhouette also touches the mob now and then, so the host's list holds other hits too: the guest's aura beats must all equal one of the host's)
  const burn = async (victim, other) => {
    await clearMobs(A); await sleep(300);
    await stand(other, 60, true); await stand(victim, 1400, false); await sleep(400);
    await pinMob(A, FORGE, 1400 + 14 + 110, { noShoot: true, only: 'heatAura' });   // 110 px across, 71 up: inside the 150 px aura; its smash (range 139) is removed so only the aura is measured
    await sleep(5500);
    return { drops: await victim.evaluate(() => window.__drops), other: await other.evaluate(() => ({ hp: Math.round(player.hp), max: getMaxHp() })) };
  };
  const hb = await burn(A, B), gb = await burn(B, A);
  ok('[4] control: the Forgewight\'s aura burns the HOST 110 px away', hb.drops.length >= 1, hb.drops);
  ok('[4] and burns the GUEST 110 px away with the host far off, for the host\'s hit (never less, never a second per beat)', gb.drops.length >= 1 && hb.drops.some((d) => d.d === gb.drops[0].d) && gb.drops.every((d) => d.d === gb.drops[0].d) && gb.drops.slice(1).every((d, i) => d.t - gb.drops[i].t >= 300) && gb.other.hp === gb.other.max, { guest: gb.drops, host: hb.drops, farHost: gb.other });

  // ---- [5] solo: untouched
  await clearMobs(S); await stand(S, 1500, true); await sleep(400);
  await pinMob(S, TYPE, 1650, { fast: true }); await sleep(6000);
  const so = await S.evaluate(() => ({ x: Math.round(player.x), aims: window.__aims.slice() }));
  ok('[5] a lone player is still shot at, aimed at itself', so.aims.length >= 2 && so.aims.every((x) => Math.abs(x - 1500) <= 20), so);
  // ---- [6] the other host-only reads: a signature skill is cast at a guest, and a Brinekraken's pull drags one
  const cast = async (type) => { await clearMobs(A); await sleep(300); await stand(A, 60, true); await stand(B, 1400, true); await sleep(400);
    await A.evaluate(() => { window.__casts = 0; for (const k of Object.keys(MONSTER_SKILL_FNS)) { const o = MONSTER_SKILL_FNS[k]; if (o.__w) continue; const w = function () { window.__casts++; return o.apply(this, arguments); }; w.__w = 1; MONSTER_SKILL_FNS[k] = w; } });
    await pinMob(A, type, 1400 + 14 + 135, { noShoot: true }); await sleep(7000); return A.evaluate(() => window.__casts); };
  const casts = await cast('voltipup');
  ok('[6] a lightning-strike caster (voltipup) 135 px from the guest casts with the host far away', casts >= 1, casts);
  const pull = async (victim, other) => { await clearMobs(A); await sleep(300); await stand(other, 60, true); await stand(victim, 1400, false); await sleep(400);
    await pinMob(A, 'brinekraken', 1400 + 14 + 215, { noShoot: true, only: 'pullsPlayer' });
    await victim.evaluate(() => { window.__vxs = []; window.__vxw = setInterval(() => window.__vxs.push(player.vx), 30); }); await sleep(3000);
    const v = await victim.evaluate(() => { clearInterval(window.__vxw); return window.__vxs.slice(); }); return { n: v.length, strongest: Math.round(Math.max(...v) * 100) / 100 }; };
  const ph = await pull(A, B), pg = await pull(B, A);
  ok('[6] control: a Brinekraken 215 px away drags the HOST toward it', ph.n > 20 && ph.strongest > 0.3, ph);
  ok('[6] ...and drags the GUEST toward it, with the host far away', pg.n > 20 && pg.strongest > 0.3, pg);
  // ---- [7] a Shardlich's ground spikes lock under the player it fights and erupt under a guest (13 s: one or two eruptions)
  const spike = async (victim, other) => { await clearMobs(A); await sleep(300); await stand(other, 60, true); await stand(victim, 1400, false); await sleep(400);
    await pinMob(A, 'shardlich', 1400 + 14 + 135, { noShoot: true, only: 'groundSpikes' }); await sleep(13000);
    return { drops: await victim.evaluate(() => window.__drops.slice()), other: await other.evaluate(() => ({ hp: Math.round(player.hp), max: getMaxHp() })) }; };
  const sh = await spike(A, B), sg = await spike(B, A);
  ok('[7] control: the Shardlich spikes hit the HOST standing 135 px away', sh.drops.length >= 1, sh.drops);
  ok('[7] ...and the GUEST standing 135 px away, with the host far off, for the same hit', sg.drops.length >= 1 && sh.drops.length >= 1 && sg.drops[0].d === sh.drops[0].d && sg.other.hp === sg.other.max, { guest: sg.drops, host: sh.drops, farHost: sg.other });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness error', String(e && e.stack || e).slice(0, 700)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close().catch(() => {}); try { relay.kill(); } catch (e) {}
process.exit(fail ? 1 : 0);
