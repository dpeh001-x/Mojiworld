// REGULUS NEVER ONE-SHOTS FROM RANGE (v0.30.x regulus-damage). Per user: "Regulus projectile sometimes does insane damage that one hit
// kills the players, please do a check on it and ensure the damage is fair". A real Regulus in his arena (zod_leo) attacks a geared
// at-level hero (devSetLevel + the best shop piece per slot, as gear_allowance); every hit is logged with HP held full (a hit, never a
// death). His Sun Comet / Solar Flare meteors took 222% / 191% of a Lv 70 mage's max HP on Normal (ATK through the level-gap ramp);
// a roar shot 62-103% on top of the 15% cone. Now each ranged hit is the zodiac roll, capped at 45% (Normal) / 65% (Nightmare).
//   node scripts/regulus_damage_test.mjs     (MOJI_GAME_FILE=<build.html> PORT=<port>)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11781';
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof devSetLevel === 'function' && typeof _coopApplyHazHit === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('forest'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    // every hit logged: hp reads a huge number, each write below it is one hit (BIG - v), a clamp to max HP is not
    const log = [], BIG = 1e8; let _hp = BIG, _src = player._lastDamageSource;
    Object.defineProperty(player, 'hp', { configurable: true, get() { return _hp; }, set(v) { v = +v; const mh = getMaxHp(); const d = (v >= BIG / 2) ? BIG - v : (v < mh - 0.5 ? mh - v : 0); if (d > 0.5) log.push({ d: Math.round(d), t: game.time | 0, src: null }); _hp = BIG; } });
    Object.defineProperty(player, '_lastDamageSource', { configurable: true, get() { return _src; }, set(v) { _src = v; const e = log[log.length - 1]; if (e && e.src == null && (game.time | 0) - e.t <= 1) e.src = v; } });
    const R = window.__RG = { log, L: null, pin: null, LX: 1150 };
    const _um = window.updateMonsters;   // Regulus held to the attack under test: no new pattern, hop, desperation, mark or mane burn
    window.updateMonsters = function () { const L = R.L; try { if (L && game.monsters.includes(L)) {
      L._gCd = 1e9; L._despCD = 1e9; L._despState = null; L._leoMarkAt = 1e12; L._maneTickAt = 1e12; L._zSpentMs = 0;
      if (!L.patternState || L.patternState === 'idle') { L.patternTimer = 0; L.x = R.LX; L.vx = 0; } }
      if (R.pin != null) { player.x = R.pin; player.vx = 0; } } catch (e) {} return _um.apply(this, arguments); };
    R.frames = async (n) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 40000) await sleep(30); return (game.time | 0) - g0; };
    R.setup = async (cls, lv, diff) => {   // a geared at-level hero (the gear_allowance ladder), the difficulty, Regulus in his arena
      const shopTier = (l) => l >= 88 ? 10 : l >= 78 ? 9 : l >= 68 ? 8 : l >= 55 ? 7 : l >= 40 ? 6 : l >= 20 ? 4 : l >= 10 ? 3 : l >= 6 ? 2 : 1;
      const pick = (cat) => { const pool = ITEM_POOL[cat].filter((it) => !it.setId && (it.tier | 0) <= shopTier(lv) && (!it.cls || it.cls === 'any' || it.cls === cls)); if (!pool.length) return null;
        const top = Math.max(...pool.map((q) => q.tier | 0)), best = pool.filter((it) => (it.tier | 0) === top), mine = best.filter((it) => it.cls === cls);
        return { ...(mine.length ? mine : best).sort((a, b) => itemScore(b) - itemScore(a))[0], slot: _catToSlot(cat) }; };
      const S = CLASSES[cls].stats, mk = Object.keys(player.mods || {});
      Object.assign(player, { cls, level: 1, maxHp: S.hp, maxMp: S.mp, baseAtk: S.atk, baseDef: S.def, baseAcc: 0, job: null, master: null, milestones: [], talents: {}, skillPoints: 0, skillRanks: {}, buffs: {}, prestige: null });
      player.mods = {}; for (const k of mk) player.mods[k] = 0; player.tree = player.tree || {}; for (const k in player.tree) player.tree[k] = 0;
      player.equipped = { weapon: null, armor: null, accessory: null }; player._equipBonusCache = null; devSetLevel(Math.min(99, lv));
      for (const cat of ['weapons', 'armors', 'accessories']) { const g = pick(cat); if (g) player.equipped[g.slot] = g; }
      player._equipBonusCache = null; if (typeof refreshGearCache === 'function') refreshGearCache();
      R.L = null; loadMap('zod_leo'); await sleep(1500);
      for (const id of ['boss-intro-overlay', 'story-beat-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      _lxDiffAdopt(diff); game.paused = false;
      let L = game.monsters.find((m) => m && m.type === 'zodiac_leo'); if (!L) { spawnMonster(1200, 300, 'zodiac_leo', true); L = game.monsters.find((m) => m && m.type === 'zodiac_leo'); }
      game.monsters = game.monsters.filter((m) => m === L); R.L = L;
      const ramp = Math.max(LX_ZODIAC_DEF_MIN_MUL, 1 - Math.max(0, getDef()) / LX_ZODIAC_DEF_ZERO), k = ramp * game._diffDmgMul * (cls === 'warrior' ? _warriorDr() : 1);
      return { cls, lv, diff, maxHp: getMaxHp(), def: Math.round(getDef()), atk: L.atk, roll: [Math.floor(3000 * k), Math.ceil(5000 * k)] };
    };
    R.atk = async (name, o) => {   // one attack, from a still Regulus at full i-frame-free HP; retried (up to 3) until something lands
      o = o || {}; const L = R.L; let res = null;
      for (let tries = 0; tries < 3; tries++) {
        Object.assign(L, { patternState: 'idle', patternTimer: 0, x: R.LX, y: 480 - L.h, vx: 0, vy: 0, currentHp: L.maxHp, phase: 1, _phaseSeen: 1, _leoFired: false, _leoPounceX: null, _leoMarking: false });
        if (name === 'flare') Object.assign(L, { currentHp: Math.floor(L.maxHp * 0.3), phase: 3, _phaseSeen: 3 });
        game.projectiles.length = 0; game.hazards.length = 0; R.pin = name === 'roar' ? R.LX - 220 : name === 'pounce' ? 700 : 600;
        Object.assign(player, { invulnerable: 0, _god: !!o.god, blockTimer: 0, _aegis: false, burnTimer: 0 });
        await R.frames(name === 'pounce' ? 140 : 4); log.length = 0; player.invulnerable = 0;
        L.patternState = name === 'pounce' ? 'pounceWindup' : name === 'roar' ? 'roarWindup' : name; L.patternTimer = 0; L._leoFired = false;
        const ran = await R.frames(name === 'pounce' ? 260 : name === 'flare' ? 190 : 150);
        const hits = log.slice(); res = { ran, hits, worst: hits.reduce((s, h) => Math.max(s, h.d), 0), sum: hits.reduce((s, h) => s + h.d, 0) };
        if (hits.length || o.god) break;
      }
      R.pin = null; player._god = false; return res;
    };
  });
  const E = (f, a) => p.evaluate(f, a);
  const pct = (x, mh) => Math.round(1000 * x / mh) / 10;
  const shot = (r) => (r.hits.find((h) => h.src === 'roar') || { d: 0 }).d;
  // ---- Lv 70 mage, Normal: the arena's own gate level, the squishiest class
  const A = await E(() => __RG.setup('mage', 70, 'normal')); const capA = Math.floor(A.maxHp * 0.45);
  console.log(`hero ${A.cls} L${A.lv} ${A.diff}: max HP ${A.maxHp}, DEF ${A.def}; Regulus ATK ${A.atk}`);
  const cometA = await E(() => __RG.atk('comet')), flareA = await E(() => __RG.atk('flare'));
  const roarA = [await E(() => __RG.atk('roar')), await E(() => __RG.atk('roar'))];
  const pounceA = await E(async () => { const r = await __RG.atk('pounce'); const mh = getMaxHp(); r.expect = _diffDmg(Math.max(1, Math.floor(mh * LEO_POUNCE_FRAC)), 0, true); return r; });
  console.log(`  comet ${JSON.stringify(cometA.hits)}  flare ${JSON.stringify(flareA.hits)}\n  roar ${JSON.stringify(roarA.map((r) => r.hits))}  pounce ${JSON.stringify(pounceA.hits)}`);
  check(cometA.hits.length > 0 && cometA.worst <= capA, `Lv 70 mage, Normal: a Sun Comet takes at most 45% of max HP (worst ${pct(cometA.worst, A.maxHp)}%)`, cometA);
  check(cometA.worst >= Math.floor(A.maxHp * 0.30), `Lv 70 mage, Normal: the comet still lands hard (at least 30% of max HP)`, cometA);
  check(flareA.hits.length > 0 && flareA.worst <= capA && flareA.sum <= capA, `Lv 70 mage, Normal: the Solar Flare volley is one hit of at most 45% (worst ${pct(flareA.worst, A.maxHp)}%, total ${pct(flareA.sum, A.maxHp)}%)`, flareA);
  check(roarA.every((r) => shot(r) > 0 && shot(r) <= capA), `Lv 70 mage, Normal: a roar shot takes at most 45% (${roarA.map((r) => pct(shot(r), A.maxHp)).join(', ')}%)`, roarA);
  check(roarA.every((r) => r.sum < A.maxHp * 0.61), `Lv 70 mage, Normal: a whole roar (cone + shot) stays under 61% (${roarA.map((r) => pct(r.sum, A.maxHp)).join(', ')}%)`, roarA);
  check(pounceA.hits.length === 1 && Math.abs(pounceA.worst - pounceA.expect) <= 1, `the Sun Pounce is unchanged (${pounceA.worst} vs ${pounceA.expect})`, pounceA);
  // ---- god mode
  const god = [await E(() => __RG.atk('comet', { god: true })), await E(() => __RG.atk('roar', { god: true }))];
  check(god.every((r) => r.hits.length === 0 && r.ran > 100), 'god mode: a comet and a roar take nothing', god);
  // ---- co-op: the host's real messages, applied by a guest at the same spot
  const coop = await E(async () => {
    const R = __RG, sent = [], o = { hz: null, pj: null }; const oA = window._coopActive, oF = window._coopFollowingHost, oWs = net.ws, oH = net.isHost, oId = net.hostId;
    try {
      net.isHost = true; net.ws = { readyState: 1, send: (s) => { try { const m = JSON.parse(s); if (m && m.t === 'hazhit') sent.push(m); } catch (e) {} } }; window._coopActive = () => true;
      await R.atk('comet'); o.hz = sent[0] || null;
      R.L.patternState = 'roarWindup'; R.L.patternTimer = 690; player.invulnerable = 1e9; R.pin = R.LX - 220;
      for (let i = 0; i < 40 && !o.pj; i++) { await R.frames(1); o.pj = (_coopProjList(true) || []).find((e) => e.s === 'roar') || null; }
      R.pin = null; game.projectiles.length = 0;
      net.isHost = false; net.ws = null; net.hostId = 1; window._coopFollowingHost = () => true; window._coopActive = () => true;
      const g = { hz: [], pj: [] };
      for (let k = 0; k < 2 && o.hz; k++) { const m = JSON.parse(JSON.stringify(o.hz)); m.id = 1; m.map = game.currentMap; m.x = Math.round(player.x + player.w / 2);
        player.invulnerable = 0; player._god = false; R.log.length = 0; _coopApplyHazHit(m); g.hz.push(R.log.reduce((s, h) => s + h.d, 0)); }
      for (let k = 0; k < 4 && o.pj && g.pj.length < 2; k++) { const e = JSON.parse(JSON.stringify(o.pj)); e.u = 900000 + k; e.vx = 0; e.vy = 0; e.l = 60;
        e.x = Math.round(player.x + player.w / 2 - (e.w || 12) / 2); e.y = Math.round(player.y + player.h / 2 - (e.h || 12) / 2);
        player.invulnerable = 0; R.log.length = 0; _coopApplyProjectiles({ id: 1, map: game.currentMap, list: [e] }); await R.frames(8);
        const d = R.log.reduce((s, h) => s + h.d, 0); if (d > 0) g.pj.push(d); game.projectiles.length = 0; }
      o.g = g; o.maxHp = getMaxHp();
    } finally { window._coopActive = oA; window._coopFollowingHost = oF; net.ws = oWs; net.isHost = oH; net.hostId = oId; }
    return o;
  });
  console.log(`  co-op: hazhit ${JSON.stringify(coop.hz)}  guest meteor ${JSON.stringify(coop.g && coop.g.hz)}  guest shot ${JSON.stringify(coop.g && coop.g.pj)}`);
  check(!!coop.hz && coop.g.hz.length === 2 && coop.g.hz.every((d) => d > 0 && d <= capA), `co-op guest: a Regulus meteor from the host's own message takes at most 45% (${coop.g ? coop.g.hz.map((d) => pct(d, coop.maxHp)).join(', ') : '-'}%)`, coop);
  check(!!coop.pj && coop.g.pj.length > 0 && coop.g.pj.every((d) => d <= capA), `co-op guest: the guest's copy of a roar shot takes at most 45% (${coop.g ? coop.g.pj.map((d) => pct(d, coop.maxHp)).join(', ') : '-'}%)`, coop);
  // ---- Lv 80 mage, Nightmare: the cap is 65%, no attack ends a full bar
  const B = await E(() => __RG.setup('mage', 80, 'nightmare')); const capB = Math.floor(B.maxHp * 0.65);
  const cometB = await E(() => __RG.atk('comet')), roarB = [await E(() => __RG.atk('roar')), await E(() => __RG.atk('roar'))];
  console.log(`hero ${B.cls} L${B.lv} ${B.diff}: max HP ${B.maxHp}, DEF ${B.def}\n  comet ${JSON.stringify(cometB.hits)}  roar ${JSON.stringify(roarB.map((r) => r.hits))}`);
  check(cometB.hits.length > 0 && cometB.worst <= capB, `Lv 80 mage, Nightmare: a Sun Comet takes at most 65% (worst ${pct(cometB.worst, B.maxHp)}%)`, cometB);
  check(roarB.every((r) => shot(r) > 0 && shot(r) <= capB && r.sum < B.maxHp), `Lv 80 mage, Nightmare: a roar shot takes at most 65% and a whole roar never ends a full bar (${roarB.map((r) => pct(r.sum, B.maxHp)).join(', ')}%)`, roarB);
  // ---- Lv 90 warrior, Normal: a tank never reaches the cap - his hits are the zodiac roll, untouched
  const C = await E(() => __RG.setup('warrior', 90, 'normal')); const capC = Math.floor(C.maxHp * 0.45);
  const cometC = await E(() => __RG.atk('comet')), roarC = await E(() => __RG.atk('roar'));
  console.log(`hero ${C.cls} L${C.lv} ${C.diff}: max HP ${C.maxHp}, DEF ${C.def}, roll window ${C.roll}\n  comet ${JSON.stringify(cometC.hits)}  roar ${JSON.stringify(roarC.hits)}`);
  const inRoll = (d) => d >= C.roll[0] - 1 && d <= C.roll[1] + 1 && d < capC;
  check(cometC.hits.length > 0 && cometC.hits.every((h) => inRoll(h.d)), `Lv 90 warrior, Normal: a comet lands the zodiac roll (${C.roll.join('-')}), under the cap`, cometC);
  check(shot(roarC) > 0 && inRoll(shot(roarC)), `Lv 90 warrior, Normal: a roar shot lands the zodiac roll, under the cap`, roarC);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} catch (e) { check(false, 'harness', String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
