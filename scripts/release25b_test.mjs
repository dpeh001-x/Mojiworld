// RELEASE 25b (summoner hunter round, 2026-10-16) stays fixed - all driven with the real keys (F / G / B / V, the arrows, Up):
//   [1] holding B casts on press and never roots the archer: Apex Bond (Beastmaster), Eye of the Tempest (Skyhunter) and War Machine
//       (Ballista) are out within 0.4 s of the press while the hero keeps walking (was: an archer draw - rooted, cast on release)
//   [2] a door onto a ledge: every ground summon lands on the hero's ledge and stays near his foot line for 0.75 s (celestialSpire ->
//       stardustAtrium, lavaCavern -> duneSands, jadeGrove -> mushroom; was: 42-57 px under it, fell through, popped back ~2.5 s later)
//   [3] ...and none walks to a roam point / foe of the map it left (the old _roamTX / _tgtRef are gone on arrival; none strays > 300 px)
//   [4] the undead cards state the measured hit: Dark Pulse / Soul Siphon thralls' mn.atk / getAtk() = the card's "% of your ATK" (+/- 2)
//   [5] summon nameplates: short numbers (<= 9 chars, "682K/710K") and, with five summons standing together, no two summons' label
//       texts (HP + timer) overlap in >= 95% of the frames
//   [6] the first summon's foot / content scans ran in idle time beforehand: summoning F / G / B after 8 s idle spends <= 60 ms in
//       first-time frame scans (was ~50 scans, ~350 ms)
//   [7] live summons survive a save + reload through the real Continue (Beastmaster F / G / B, Necromancer V): same count, ~same life
//       and HP; a second reload adds none; dying (respawn in town) then reloading brings none back
//   [8] quick chaining: F then G 0.2 s / 0.4 s later both cast, in order, G once; mashing G during F's cast lock casts G once; a G
//       pressed while the game is paused (a menu) never casts
//   node release25b_test.mjs        PORT (default 15131) / MOJI_GAME_FILE / SERVE_ROOT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15131), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const press = async (page, key, hold = 140) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
const boot = async (ctx, kit) => {
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(async (k) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== k.cls) { try { applyClass(k.cls); } catch (e) {} player.cls = k.cls; }
    devSetLevel(80); try { applyJob(k.job); } catch (e) {} try { applyMaster(k.master); } catch (e) {}
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const b in STORY_BEATS) player._storyBeatsSeen[b] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } { const am = document.getElementById('advancement-modal'); if (am) am.style.display = 'none'; } { const tm = document.getElementById('tutorial-modal'); if (tm && (tm.classList.contains('tut-dock') || getComputedStyle(tm).display !== 'none')) try { _closeTutorial(true); } catch (e) {} } { const pm = document.getElementById('powerup-modal'); if (pm && getComputedStyle(pm).display !== 'none') pm.style.display = 'none'; } game.paused = false; };
    const calm = () => { player.hitStun = 0; player.stunTimer = 0; player.hp = getMaxHp(); player.mp = player.maxMp = 99999; };
    const reset = () => { player.pet = null; player.ultPet = null; player.pack = []; player.skillCooldowns = {}; player._warCharge = null; player._ballistaTurrets = []; game.minions = []; game.monsters = []; };
    window._r25 = { sleep, clear, calm, reset };
    game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { forest: null });
    clear(); loadMap('forest', 1500); for (let i = 0; i < 5; i++) { await sleep(240); clear(); }
  }, kit);
  return page;
};
// each key is pressed until its summon is out (up to 4 presses: a loaded machine can drop a tap under a story card); castSkill only if no press lands (logged)
const SUMMON_OF = { f: () => !!(player.pet || (game.minions || []).some((m) => m && !m.mojimon)), g: () => (player.pack || []).length > 0, b: () => !!(player.ultPet || (player._ballistaTurrets || []).length), v: () => (game.minions || []).some((m) => m && !m.mojimon) };
const summonAll = async (page, keys) => { for (const k of keys) { let ok2 = false;
  for (let i = 0; i < 4 && !ok2; i++) { await page.evaluate(() => { window._r25.clear(); window._r25.calm(); game.monsters = []; player._castLockUntil = 0; }); await press(page, k); await page.waitForTimeout(600); ok2 = await page.evaluate((src) => (0, eval)(src)(), '(' + SUMMON_OF[k].toString() + ')'); }
  if (!ok2) { console.log('  (castSkill fallback for ' + k + ')'); await page.evaluate((k) => { window._r25.calm(); const f = skillBySlot(KEY_TO_SLOT[k]); if (f) { player.skillCooldowns[f.id] = 0; castSkill(f.id); } }, k); await page.waitForTimeout(500); } } };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await boot(ctx, { cls: 'archer', job: 'ranger', master: 'beastmaster' });
  console.log('  build', await page.evaluate(() => GAME_VERSION));
  // ---- [6] first-summon scans: hook after 8 s of idle, then summon with F / G / B
  await page.waitForTimeout(8000);
  await page.evaluate(() => { window.__sc = []; for (const [fn, cache] of [['_summonFeetFrac', _summonFeet], ['_summonContentBottomFrac', _summonCBot]]) { const f0 = window[fn];
    window[fn] = function (img) { const had = cache.has(img); const t = performance.now(); try { return f0.apply(this, arguments); } finally { if (!had && img && (img.naturalWidth || img.width)) window.__sc.push(performance.now() - t); } }; } window._r25.reset(); window._r25.calm(); });
  await summonAll(page, ['f', 'g', 'b']); await page.waitForTimeout(2000);
  const S6 = await page.evaluate(() => ({ n: window.__sc.length, ms: Math.round(window.__sc.reduce((a, b) => a + b, 0)), worst: Math.round(Math.max(0, ...window.__sc) * 10) / 10, out: [!!player.pet, (player.pack || []).length, !!player.ultPet] }));
  ok('[6] the first summon\'s frame scans ran in idle time: <= 60 ms of first-time scans while F / G / B summon', S6.out[0] && S6.out[1] > 0 && S6.out[2] && S6.ms <= 60, S6);
  // ---- [5] nameplates: five summons standing together in front of the hero
  const S5 = await page.evaluate(async () => { const { sleep, clear, calm } = window._r25; clear(); calm(); game.monsters = [];
    const L = [player.ultPet, player.pet, ...(player.pack || [])].filter(Boolean); const x0 = player.x + 80;
    const pin = () => L.forEach((p, i) => { p.x = x0 + i * 34; p.vx = 0; p._roamTX = p.x + p.w / 2; p._roamUntil = game.time + 600; p.life = 60000; p.maxLife = 100000; p.hp = Math.floor(p.maxHp * (0.93 + i * 0.01)); });
    let cur = null; const rec = []; const dw0 = window.drawWolf; window.drawWolf = function (pet) { cur = pet; try { return dw0.apply(this, arguments); } finally { cur = null; } };
    const ft0 = ctx.fillText; ctx.fillText = function (t, x, y) { if (cur && window.__lbl) { const m = ctx.getTransform(), w = ctx.measureText(String(t)).width * Math.abs(m.a), px = parseFloat((ctx.font.match(/(\d+(?:\.\d+)?)px/) || [0, 9])[1]) * Math.abs(m.d);
      const al = ctx.textAlign, sx = m.a * x + m.e, sy = m.d * y + m.f, lx = al === 'center' ? sx - w / 2 : al === 'right' || al === 'end' ? sx - w : sx; rec.push({ f: game.time, id: L.indexOf(cur), t: String(t), r: [lx, sy - px, w, px] }); } return ft0.apply(this, arguments); };
    for (let i = 0; i < 40; i++) { pin(); await sleep(25); } window.__lbl = true; for (let i = 0; i < 80; i++) { pin(); clear(); calm(); game.monsters = []; await sleep(25); } window.__lbl = false; ctx.fillText = ft0; window.drawWolf = dw0;
    const by = {}; for (const r of rec) (by[r.f] || (by[r.f] = [])).push(r);
    const ov = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
    let frames = 0, clean = 0, ex = null; for (const f in by) { const R = by[f].filter((r) => r.id >= 0); if (new Set(R.map((r) => r.id)).size < 2) continue; frames++; let bad = null;
      for (let i = 0; i < R.length && !bad; i++) for (let j = i + 1; j < R.length; j++) if (R[i].id !== R[j].id && ov(R[i].r, R[j].r)) { bad = [R[i].t, R[j].t]; break; } if (!bad) clean++; else if (!ex) ex = bad; }
    const hp = rec.filter((r) => r.t.indexOf('/') >= 0).map((r) => r.t);
    return { n: L.length, frames, clean, ex, hpLong: Math.max(0, ...hp.map((t) => t.length)), hpEx: hp.slice(0, 3), shortOk: hp.length > 0 && hp.every((t) => /^\d+(\.\d)?[KM]?\/\d+(\.\d)?[KM]?$/.test(t) && t.length <= 9) }; });
  ok('[5a] summon HP labels use short numbers (<= 9 chars)', S5.shortOk, { long: S5.hpLong, ex: S5.hpEx });
  ok('[5b] five summons standing together: no two summons\' label texts overlap (>= 95% of frames)', S5.n >= 5 && S5.frames > 20 && S5.clean / S5.frames >= 0.95, S5);
  // ---- [8] quick chaining: a press during another skill's cast lock fires once the hero is ready
  await page.evaluate(() => { window.__casts = []; const c0 = window.castSkill; window.castSkill = function (id) { const r = c0.apply(this, arguments); if (r !== '_lxNoCast' && (player.skillCooldowns[id] || 0) > 0) window.__casts.push([id, Math.round(performance.now())]); return r; }; });
  const chain = async (pre, run) => { await page.evaluate(() => { window._r25.reset(); window._r25.clear(); window._r25.calm(); window.__casts = []; player._lxSkBuf = null; }); await page.waitForTimeout(300); await run(); await page.waitForTimeout(1300); return page.evaluate(() => ({ casts: window.__casts.map((c) => c[0]), gap: window.__casts.length > 1 ? window.__casts[1][1] - window.__casts[0][1] : null, lock: Math.round(((player._castLockUntil || 0) - game.time)) })); };
  const tap = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  const C0 = await chain(0, async () => { await tap('f', 60); await page.waitForTimeout(340); await tap('g', 60); });
  ok('[8a] F, then G 0.4 s later: both cast, in order, G once', C0.casts.join() === 'wildBond,beastmaster_pack', C0);
  const C1 = await chain(0, async () => { await tap('f', 60); await page.waitForTimeout(140); await tap('g', 60); });
  ok('[8a2] F, then G 0.2 s later (inside F\'s cast lock): both cast, in order, G once', C1.casts.join() === 'wildBond,beastmaster_pack', C1);
  const C2 = await chain(0, async () => { await tap('f', 50); for (let i = 0; i < 5; i++) { await tap('g', 25); await page.waitForTimeout(25); } });
  ok('[8b] mashing G five times during F\'s cast lock: exactly one G, after F', C2.casts.join() === 'wildBond,beastmaster_pack', C2);
  const C3 = await chain(0, async () => { await press(page, 'f', 80); await page.evaluate(() => { game.paused = true; }); await press(page, 'g', 80); await page.waitForTimeout(200); await page.evaluate(() => { game.paused = false; }); });
  ok('[8c] G pressed while a menu has the game paused: nothing casts', C3.casts.join() === 'wildBond', C3);
  // ---- [1] hold B: the master summon casts on press, the archer keeps walking
  for (const [job, master, id] of [['ranger', 'beastmaster', 'beastmaster_ult'], ['ranger', 'skyhunter', 'skyhunter_ult'], ['sniper', 'ballista', 'ballista_ult']]) {
    await page.evaluate(async ([j, m]) => { try { applyJob(j); } catch (e) {} try { applyMaster(m); } catch (e) {} if (player.job !== j || player.master !== m) { player.job = j; player.master = m; } window.__kit = [player.job, player.master, (skillBySlot('b') || {}).id]; window._r25.reset(); window._r25.clear(); window._r25.calm(); loadMap('forest', 900); for (let i = 0; i < 5; i++) { await window._r25.sleep(240); window._r25.clear(); } window._r25.reset(); }, [job, master]);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); const x0 = await page.evaluate(() => player.x); await page.keyboard.down('b');
    const tl = []; for (let i = 0; i < 12; i++) { await page.waitForTimeout(100); tl.push(await page.evaluate((id) => { game.monsters = []; window._r25.calm(); return [Math.round(player.x), !!player._warCharge, (player.skillCooldowns[id] || 0) > 0]; }, id)); }
    await page.keyboard.up('b'); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(200);
    const castAt = tl.findIndex((r) => r[2]), chg = tl.filter((r) => r[1]).length, moved = tl[tl.length - 1][0] - Math.round(x0);
    const kit = await page.evaluate(() => window.__kit);
    ok('[1] holding B as a ' + master + ': ' + id + ' casts on press (<= 0.4 s), no draw, the hero keeps walking (> 80 px over the 1.2 s hold)', kit[2] === id && castAt >= 0 && castAt <= 3 && chg === 0 && moved > 80, { kit, castAt, chg, moved, tl: tl.map((r) => r[0]) });
  }
  // ---- [2] + [3] doors onto ledges with F / G / B out
  await page.evaluate(async () => { try { applyJob('ranger'); } catch (e) {} try { applyMaster('beastmaster'); } catch (e) {} player.job = 'ranger'; player.master = 'beastmaster'; });
  for (const [from, dest] of [['celestialSpire', 'stardustAtrium'], ['lavaCavern', 'duneSands'], ['jadeGrove', 'mushroom']]) {
    await page.evaluate(async (from) => { const { sleep, clear, calm, reset } = window._r25; game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { [from]: null }); loadMap(from, 600); for (let i = 0; i < 5; i++) { await sleep(240); clear(); } reset(); calm(); }, from);
    await summonAll(page, ['f', 'g', 'b']);
    const door = await page.evaluate((dest) => { const po = game.portals.find((p) => p.dest === dest); if (!po) return null; const y = (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x);
      player.x = po.x - player.w / 2; player.y = y - player.h - 2; player.vx = player.vy = 0; for (const p of [player.pet, player.ultPet, ...(player.pack || [])]) if (p) { p.x = player.x - 40; p.y = player.y + player.h - p.h; p.vy = 0; } return { x: po.x, y }; }, dest);
    if (!door) { ok('[2] ' + from + ' has a door to ' + dest, false); continue; }
    await page.waitForTimeout(600);
    // a roam point / foe picked on this map, far from the door, as an idle pack carries one
    await page.evaluate(() => { const ww = game.mapData.worldWidth || 2000, far = player.x > ww / 2 ? 120 : ww - 120; window.__oldFoe = { x: far, y: player.y, w: 40, h: 40, currentHp: 1e9, maxHp: 1e9, type: 'slime' }; for (const p of [player.pet, player.ultPet, ...(player.pack || [])]) if (p) { p._roamTX = far; p._roamUntil = game.time + 600; p._tgtRef = window.__oldFoe; }
      window.__pre = [player.pet, player.ultPet, ...(player.pack || [])].filter(Boolean).map((p) => p._roamTX); game.monsters = []; window._r25.calm(); });
    await press(page, 'ArrowUp', 160);
    let arrived = false; for (let i = 0; i < 40 && !arrived; i++) { await page.waitForTimeout(100); arrived = await page.evaluate((d) => game.currentMap === d, dest); }
    const R = await page.evaluate(async () => { const { clear, calm } = window._r25; const L = [player.pet, player.ultPet, ...(player.pack || [])].filter(Boolean).filter((p) => !p.flying);
      const roam0 = L.map((p) => p._roamTX), tgt0 = L.filter((p) => p._tgtRef === window.__oldFoe).length; let heroLand = null, worst = 0, stray = 0; const land = L.map(() => null), t0 = game.time;
      while (game.time - t0 < 90) { await new Promise((r) => requestAnimationFrame(r)); clear(); calm(); game.monsters = []; const hf = player.y + player.h, hx = player.x + player.w / 2;
        if (heroLand == null && player.onGround) { heroLand = Math.round(hf); window.__tl = game.time; }
        L.forEach((p, i) => { if (land[i] == null && p.onGround) land[i] = Math.round(p.y + p.h); if (heroLand != null && game.time - window.__tl <= 45) worst = Math.max(worst, Math.abs(p.y + p.h - hf)); stray = Math.max(stray, Math.abs(p.x + p.w / 2 - hx)); }); }
      return { map: game.currentMap, heroLand, land, worst: Math.round(worst), stray: Math.round(stray), roam0: roam0.map((v) => v == null ? null : Math.round(v)), pre: window.__pre.map((v) => Math.round(v)), tgt0 }; });
    ok('[2] ' + from + ' -> ' + dest + ': every ground summon lands on the hero\'s ledge and stays within 30 px of his feet for 0.75 s after he lands', arrived && R.heroLand != null && R.land.length >= 4 && R.land.every((y) => y != null && Math.abs(y - R.heroLand) <= 6) && R.worst <= 30, R);
    ok('[3] ' + from + ' -> ' + dest + ': no summon keeps the old map\'s roam point or foe, none strays > 300 px', arrived && R.roam0.every((v, i) => v == null || R.pre.indexOf(v) < 0) && R.tgt0 === 0 && R.stray <= 300, { roam0: R.roam0, pre: R.pre, tgt0: R.tgt0, stray: R.stray });
  }
  // ---- [4] the undead cards: raise with the real V (Dark Pulse) and F (Soul Siphon), measure each thrall's hit
  const page2 = await boot(ctx, { cls: 'mage', job: 'warlock', master: 'necromancer' });
  const S4 = {};
  for (const [key, id, re] of [['v', 'darkPulse', /hitting for (\d+)% of your ATK/], ['f', 'soulSiphon', /hits for (\d+)% of your ATK/]]) {
    for (let a = 0; a < 3; a++) {
      await page2.evaluate(() => { const { reset, clear, calm } = window._r25; reset(); clear(); calm(); for (let i = 0; i < 3; i++) { const m = spawnMonster(player.x + player.w / 2 + 30 + i * 30, player.y, 'slime', false, false); if (m) { m.maxHp = m.currentHp = 1e12; m.evasion = 0; if (game.monsters.indexOf(m) < 0) game.monsters.push(m); } } });
      await page2.waitForTimeout(300); await press(page2, key); await page2.waitForTimeout(600);
      if (await page2.evaluate(() => (game.minions || []).some((m) => m && !m.mojimon))) break;
    }
    S4[id] = await page2.evaluate(([id, src]) => { const card = +((SKILLS[id].desc.match(new RegExp(src)) || [])[1] || NaN); const a = getAtk(); const T = (game.minions || []).filter((m) => m && !m.mojimon);
      return { card, measured: T.map((m) => Math.round(m.atk / a * 100)), n: T.length }; }, [id, re.source]);
  }
  for (const id of ['darkPulse', 'soulSiphon']) { const r = S4[id]; ok('[4] ' + id + ': the card\'s "% of your ATK" is what a raised thrall hits for (+/- 2)', r.n > 0 && r.measured.every((m) => Math.abs(m - r.card) <= 2), r); }
  // ---- [7] live summons survive a save + reload (the real Continue), never duplicate, never outlive a death
  const ctx3 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx3.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const reload = async (p) => { await p.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await p.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
    let how = 'continue'; try { await p.click('#menu-continue', { timeout: 60000 }); } catch (e) { how = 'hidden'; } await p.waitForFunction(() => game.mapData && player.cls, null, { timeout: 120000 }); await p.waitForTimeout(2500);
    await p.evaluate(() => { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } try { closeAllModals(); } catch (e) {} game.paused = false;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); window._r25 = { sleep, clear: () => { try { closeAllModals(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } game.paused = false; }, calm: () => { player.hitStun = 0; player.stunTimer = 0; player.hp = getMaxHp(); player.mp = player.maxMp = 99999; }, reset: () => { player.pet = null; player.ultPet = null; player.pack = []; player.skillCooldowns = {}; game.minions = []; game.monsters = []; } };
      player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const b in STORY_BEATS) player._storyBeatsSeen[b] = true; player._tutorialSeen = true; }); return how; };
  const sumSnap = (p) => p.evaluate(() => { const r = (e) => e ? { life: Math.round(e.life), hpf: +(e.hp / e.maxHp).toFixed(3), s: e.sprite || '' } : null;
    return { map: game.currentMap, pet: r(player.pet), ult: r(player.ultPet), pack: (player.pack || []).map(r), und: (game.minions || []).filter((m) => m && !m.mojimon).map((m) => ({ t: m.type, life: Math.round(m.life), hpf: +(m.currentHp / m.maxHp).toFixed(3) })) }; });
  const flush = (p) => p.evaluate(() => { _flushSaveStateNow(); return game._lxSummonSave ? game._lxSummonSave.length : 0; });
  const p3 = await boot(ctx3, { cls: 'archer', job: 'ranger', master: 'beastmaster' });
  await summonAll(p3, ['f', 'g', 'b']);
  await p3.evaluate(() => { const L = [player.pet, player.ultPet, ...(player.pack || [])].filter(Boolean); L.forEach((e, i) => { e.hp = Math.floor(e.maxHp * (0.5 + i * 0.1)); }); });
  await p3.waitForTimeout(2500);
  const B0 = await sumSnap(p3); const n0 = await flush(p3);
  const how1 = await reload(p3); const B1 = await sumSnap(p3);
  const cnt = (S) => (S.pet ? 1 : 0) + (S.ult ? 1 : 0) + S.pack.length;
  const near = (a, b) => a && b && b.life <= a.life + 50 && b.life >= a.life - 9000 && Math.abs(a.hpf - b.hpf) <= 0.02;
  ok('[7a] a Beastmaster\'s wolf, pack and werewolf come back after a reload (Continue: ' + how1 + ') with ~the same life and HP', cnt(B0) >= 3 && cnt(B1) === cnt(B0) && near(B0.pet, B1.pet) && near(B0.ult, B1.ult) && B1.ult.s === 'werewolf' && B0.pack.every((w, i) => near(w, B1.pack[i])), { n0, B0, B1 });
  await flush(p3); await reload(p3); const B2 = await sumSnap(p3);
  ok('[7b] a second reload: the same count, no duplicates', cnt(B2) === cnt(B0), { B2: cnt(B2), B0: cnt(B0) });
  await p3.evaluate(async () => { player._god = false; player.invulnerable = 0; try { triggerDeath(); } catch (e) {} for (let i = 0; i < 40 && !((game.dying | 0) > 0); i++) await window._r25.sleep(100); window.__died = (game.dying | 0) > 0; game.dying = 0; try { respawnAtTown(); } catch (e) {} await window._r25.sleep(1000); window._r25.clear(); player._god = true; });
  await p3.waitForTimeout(1500); const died = await p3.evaluate(() => !!window.__died); if (!died) ok('[7c] the death landed', false); const D0 = await sumSnap(p3); await flush(p3); await reload(p3); const D1 = await sumSnap(p3);
  ok('[7c] dying (the respawn in town), then reloading: no summon comes back', cnt(D0) === 0 && cnt(D1) === 0, { D0: cnt(D0), D1: cnt(D1) });
  await p3.evaluate(async () => { try { applyClass('mage'); } catch (e) {} player.cls = 'mage'; devSetLevel(80); try { applyJob('warlock'); } catch (e) {} try { applyMaster('necromancer'); } catch (e) {} player.job = 'warlock'; player.master = 'necromancer'; player._god = true; window._r25.reset(); window._r25.calm(); loadMap('forest', 1500); for (let i = 0; i < 5; i++) { await window._r25.sleep(240); window._r25.clear(); } window._r25.reset(); });
  await p3.evaluate(() => { const { clear, calm } = window._r25; clear(); calm(); for (let i = 0; i < 3; i++) { const m = spawnMonster(player.x + player.w / 2 + 60 + i * 30, player.y, 'slime', false, false); if (m) { m.maxHp = m.currentHp = 1e12; if (game.monsters.indexOf(m) < 0) game.monsters.push(m); } } });
  await press(p3, 'v'); await p3.waitForTimeout(1200); const vHow = await p3.evaluate(() => { if ((game.minions || []).some((m) => m && !m.mojimon)) return 'key'; window._r25.calm(); player.skillCooldowns = {}; try { castSkill('darkPulse'); } catch (e) {} return 'castSkill (' + [player.cls, player.job, game.paused, (skillBySlot('c') || {}).id].join('/') + ')'; }); await p3.waitForTimeout(800); await p3.evaluate(() => { game.monsters = []; });
  const U0 = await sumSnap(p3); await flush(p3); await reload(p3); const U1 = await sumSnap(p3);
  ok('[7d] a Necromancer\'s raised undead (V: ' + vHow + ') come back after a reload, same count, ~the same life', U0.und.length >= 3 && U1.und.length === U0.und.length && U0.und.every((u, i) => U1.und[i] && U1.und[i].t === u.t && near(u, U1.und[i])), { U0: U0.und, U1: U1.und });
  await ctx3.close();
} catch (e) { ok('no exception', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 5));
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
