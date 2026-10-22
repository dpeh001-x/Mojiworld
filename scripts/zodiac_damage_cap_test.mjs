// ZODIAC DAMAGE CAP (v0.30.x zodiac-damage-cap). After Regulus (v0.30.1850), per user: every zodiac boss is capped per hit at
// Story 30% / Normal 45% / Hard 65% / Nightmare 85% of the hero's max HP, one table for all twelve. Each sign's real attack code is
// driven in its own arena against a geared at-level hero (devSetLevel + the best shop piece per slot), the projectile / hazard
// resolver stepped by hand with Math.random pinned at the top of every roll. Per attack: its worst hit, and the worst 1.2 s sum
// with a zodiac shot placed on the hero the first frame its i-frames allow (stacking). Before: a shot took 104% of a Lv 70 mage's
// bar on Normal (207% on Nightmare); Scorpio's Ambush 145% / 290%; Ariel's trail + a shot 160%; a roar cone + shot 60% on Normal.
//   node scripts/zodiac_damage_cap_test.mjs     (MOJI_GAME_FILE=<build.html> PORT=<port>)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11805';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 600)}`); if (!ok) bad++; };
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const CAP = { story: 30, normal: 45, hard: 65, nightmare: 85 };
// the page side: drives each sign's real attack code synchronously and steps the resolver by hand (no frame waits)
function harness() {
  const ZM = window.__ZM = { log: [], B: null, z: null, sign: null, floorY: 480 };
  const BIG = 1e8, DT = 1000 / 60, WIN = 72;
  const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
  ZM.hook = function () {   // every HP write is one hit: hp reads a huge number, a write below it is BIG - v (a hit, never a death)
    let _hp = BIG, _src = null; const log = ZM.log;
    Object.defineProperty(player, 'hp', { configurable: true, get() { return _hp; }, set(v) { v = +v; const mh = getMaxHp(); const d = (v >= BIG / 2) ? BIG - v : (v < mh - 0.5 ? mh - v : 0); if (d > 0.5) log.push({ d: Math.round(d), t: game.time | 0, src: null }); _hp = BIG; } });
    Object.defineProperty(player, '_lastDamageSource', { configurable: true, get() { return _src; }, set(v) { _src = v; const e = log[log.length - 1]; if (e && e.src == null) e.src = v; } });
    const _um = window.updateMonsters; ZM.freeze = true;   // the live loop never runs a boss: every attack below is driven by hand
    window.updateMonsters = function () { if (ZM.freeze) return; return _um.apply(this, arguments); };
  };
  ZM.enter = async function (sign) {
    ZM.freeze = false; ZM.B = null; loadMap('zod_' + sign); await sleep(1500);
    for (const id of ['boss-intro-overlay', 'story-beat-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    game.paused = false;
    let B = game.monsters.find((m) => m && m.type === 'zodiac_' + sign); if (!B) { spawnMonster(1000, 300, 'zodiac_' + sign, true); B = game.monsters.find((m) => m && m.type === 'zodiac_' + sign); }
    await sleep(600); ZM.freeze = true;
    game.monsters = game.monsters.filter((m) => m === B); ZM.B = B; ZM.sign = sign; ZM.z = _zodiacConfig(B);
    const bcx = B.x + B.w / 2; let gy = null;
    for (const pl of ((game.mapData && game.mapData.platforms) || [])) if (pl && pl.type === 'ground' && bcx >= pl.x && bcx <= pl.x + pl.w && (gy == null || pl.y < gy)) gy = pl.y;
    ZM.floorY = gy != null ? gy : (B.y + B.h);
    if (!B._zFlying && !B._noGravity) B.y = ZM.floorY - B.h;
    ZM.BX = B.x = 800 - B.w / 2;
    return { name: B.name, atk: B.atk, lv: _mobLevel(B) };
  };
  ZM.hero = function (cls, lv) {   // the gear_allowance ladder: the best shop piece per slot at this level
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
  };
  const FAR = ['_sagArcAt', '_huntMarkAt', '_aquaFloodAt', '_lightningAt', '_capQuakeAt', '_tidalAt', '_piscesDreamAt', '_burrowAt', '_bubbleAt', '_cancerShellAt',
    '_leoMarkAt', '_maneTickAt', '_virgoMarkAt', '_geminiLyingAt', '_dreamShotAt', '_delugeCd', '_sbCd', '_sagKickAt'];
  ZM.hold = function () {   // the boss still, every timed mechanic parked, so only the attack under test fires
    const B = ZM.B; for (const k of FAR) B[k] = 1e12; B.x = ZM.BX;
    Object.assign(B, { patternState: 'idle', patternTimer: 0, vx: 0, vy: 0, _sagKickWind: 0, _tidalArmed: false, _capQuakeFiring: false, _burrowing: false, _scorpStingerArmed: false,
      _scorpStingerReady: false, _capArenaStart: game.time | 0, _piscesSplit: true, _leoFired: false, _chargeBurst: true, _despState: null });
  };
  ZM.place = function (cx) {
    player.x = Math.round(cx - player.w / 2); player.y = ZM.floorY - player.h; player.vx = 0; player.vy = 0; player.onGround = true;
    if (game.camera) { const ww = (game.mapData && game.mapData.worldWidth) || 1800; game.camera.x = Math.max(0, Math.min(ww - W_PLAY, cx - W_PLAY / 2)); }   // an off-screen shot does no damage
  };
  ZM.ai = function (phase, dist) { const B = ZM.B; B.phase = phase; B.currentHp = Math.floor(B.maxHp * (phase === 1 ? 0.9 : phase === 2 ? 0.5 : 0.2)); ZODIAC_AI[ZM.sign](B, DT, dist, phase, ZM.z); };
  ZM.shot = function (skill) { game.projectiles.push({ x: player.x + player.w / 2 - 8, y: player.y + player.h / 2 - 8, w: 16, h: 16, vx: 0, vy: 0, life: 8, damage: ZM.B.atk * 1.5,
    owner: 'enemy', _zodiacSign: ZM.sign, _zodiacAttacker: true, skill: skill || 'zodiac', noGravity: true, color: '#ffffff' }); };
  ZM.step = function (n, each) {
    for (let i = 0; i < n; i++) {
      game.time++; if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - DT);
      player.hitStun = 0; player.blockTimer = 0; player.vx = 0; player.vy = 0; player.onGround = true;
      updateProjectiles(DT); if (each) each(i);
    }
  };
}
function harness2() {
  const ZM = window.__ZM, DT = 1000 / 60, WIN = 72;
  // one attack: spawn() drives the real code, then the resolver runs; follow places a zodiac shot on the hero the first frame its
  // i-frames allow inside the 1.2 s after the first hit (a hazard, a cone or a point-blank hit with a shot on top)
  ZM.measure = function (spawn, o) {
    o = o || {}; const log = ZM.log;
    game.projectiles.length = 0; game.hazards.length = 0; game._lxZc = null;
    Object.assign(player, { invulnerable: 0, blockTimer: 0, _aegis: false, _god: false, burnTimer: 0, _poisonTimer: 0, _cancerBubble: 0 });
    ZM.hold(); ZM.place(o.at != null ? o.at : ZM.BX + ZM.B.w / 2 + 260); log.length = 0;
    spawn(); let fired = false;
    ZM.step(o.frames || 120, () => { if (o.follow !== false && !fired && log.length && player.invulnerable <= 0 && (game.time | 0) - log[0].t < WIN) { ZM.shot('zfollow'); fired = true; } });
    game.projectiles.length = 0; game.hazards.length = 0;
    const mh = getMaxHp(), hs = log.filter((h) => !/HEAVENSPLIT|DOT/.test(String(h.src)));
    let win = 0; for (let i = 0; i < hs.length; i++) { let s = 0; for (let j = i; j < hs.length && hs[j].t - hs[i].t < WIN; j++) s += hs[j].d; win = Math.max(win, s); }
    const r1 = (x) => Math.round(1000 * x / mh) / 10;
    return { hit: r1(hs.filter((h) => h.src !== 'zfollow').reduce((m, h) => Math.max(m, h.d), 0)), win: r1(win), n: hs.length, raw: hs.map((h) => [h.t - (hs[0] ? hs[0].t : 0), h.d, h.src]).slice(0, 5) };
  };
  const moveTo = (pred) => { const h = game.hazards.find(pred); if (h) ZM.place(h.cx != null ? h.cx : h.x + (h.w || 0) / 2); return h; };
  // the attacks each sign adds to its shots (telegraphed ones marked tele: measured, never held to the cap)
  ZM.ATT = {
    aries: {
      trail: [() => { const B = ZM.B; B.patternState = 'charge'; B.patternTimer = 0; B._chargeDir = 1; while (game.time % 3) game.time++; ZM.ai(1, 300); game.projectiles.length = 0; moveTo((h) => h.type === 'meteor_warn'); }, { frames: 90 }],
      crack: [() => { const B = ZM.B; B.patternState = 'chargeBurst'; B.patternTimer = 0; B._chargeBurst = false; ZM.ai(1, 300); game.projectiles.length = 0; moveTo((h) => h._ariesCrack); }, { frames: 420 }],
    },
    leo: {
      comet: [() => { const B = ZM.B; B.patternState = 'comet'; B._leoFired = false; ZM.ai(1, 600); moveTo((h) => h.type === 'meteor_warn'); }, { frames: 120 }],
      roar: [() => { const B = ZM.B; ZM.place(B.x + B.w / 2 - 220); B.patternState = 'roarWindup'; B.patternTimer = 701; ZM.ai(1, 220); }, { frames: 70, follow: false }],
    },
    scorpio: {
      ambush: [() => { ZM.B._burrowAt = 0; ZM.ai(1, 600); }, { frames: 200 }],
      pool: [() => { const B = ZM.B; B._delugeSpots = [player.x + player.w / 2]; _lxScorpioDelugeFire(B); }, { frames: 80, follow: false }],
    },
    sagittarius: {
      kick: [() => { const B = ZM.B; ZM.place(B.x + B.w / 2 + 150); B._sagKickWind = game.time | 0; ZM.ai(1, 150); }, { frames: 90 }],
      marked: [() => { const B = ZM.B; ZM.place(B.x + B.w / 2 + 300); Object.assign(B, { patternState: 'marked', patternTimer: 901, _sagFired: false, _sagMarkX: player.x + player.w / 2, _sagMarkY: player.y + player.h / 2 }); ZM.ai(3, 300); }, { frames: 90 }],
    },
    capricorn: {
      quake: [() => { const B = ZM.B; ZM.place(B.x + B.w / 2 + 150); B._capQuakeFiring = true; B._capQuakeT = 1; ZM.ai(1, 150); }, { frames: 90, tele: true }],
    },
    aquarius: { shock: [() => { const B = ZM.B; B._aquaFloodAt = 0; B._lightningAt = 0; ZM.ai(1, 400); }, { frames: 90 }] },
    pisces: { tidal: [() => { const B = ZM.B; Object.assign(B, { _tidalArmed: true, _tidalT: 1, _tidalX: player.x + player.w / 2, _tidalY: player.y + player.h / 2 }); ZM.ai(2, 300); }, { frames: 90 }] },
  };
  ZM.tank = function (cls) {   // the plain roll window (Scorpio's own 2,100-3,500; Capricorn's 32% floor), DEF ramp, difficulty, warrior DR
    const k = Math.max(LX_ZODIAC_DEF_MIN_MUL, 1 - Math.max(0, getDef()) / LX_ZODIAC_DEF_ZERO) * game._diffDmgMul * (cls === 'warrior' ? _warriorDr() : 1);
    const sc = ZM.sign === 'scorpio' ? 0.7 : 1, fl = ZM.sign === 'capricorn' ? Math.floor(getMaxHp() * 0.32) : 0;
    return { lo: Math.max(fl, Math.floor(3000 * sc * k)), hi: Math.max(fl, Math.ceil(5000 * sc * k)) };
  };
  ZM.run = function (cls, lv, diffs) {   // every attack of the current sign, per difficulty, at the top of every roll
    const R0 = Math.random; Math.random = () => 0.9999; const rows = [];
    try {
      ZM.hero(cls, lv);
      for (const diff of diffs) {
        _lxDiffAdopt(diff);
        const att = { shot: ZM.measure(() => ZM.shot(), { frames: 20 }) };
        for (const [k, [fn, o]] of Object.entries(ZM.ATT[ZM.sign] || {})) att[k] = Object.assign(ZM.measure(fn, o), { tele: !!o.tele });
        rows.push({ cls, lv, diff, mh: getMaxHp(), def: Math.round(getDef()), att,
          quakeExpect: Math.round(1000 * Math.min(_diffDmg(Math.floor(getMaxHp() * 0.45), _mobLevel(ZM.B)), Math.floor(getMaxHp() * 0.90)) / getMaxHp()) / 10,
          tank: ZM.tank(cls) });
      }
    } finally { Math.random = R0; }
    return rows;
  };
}
function harness3() {
  const ZM = window.__ZM;
  // co-op: the host's real messages for one attack (hazhit / bosshit), applied by a guest standing in it; then a zodiac shot on
  // the guest the first frame its i-frames allow inside 1.2 s - the guest's hit and its stack, on its own bar
  ZM.coop = function (attName) {
    const sent = [], oA = window._coopActive, oF = window._coopFollowingHost, oWs = net.ws, oH = net.isHost, oId = net.hostId, R0 = Math.random;
    Math.random = () => 0.9999;
    try {
      net.isHost = true; net.ws = { readyState: 1, send: (s) => { try { const m = JSON.parse(s); if (m && (m.t === 'hazhit' || m.t === 'bosshit')) sent.push(m); } catch (e) {} } }; window._coopActive = () => true;
      const [fn, o] = ZM.ATT[ZM.sign][attName]; const host = ZM.measure(fn, Object.assign({}, o, { follow: false }));
      net.isHost = false; net.ws = null; net.hostId = 1; window._coopFollowingHost = () => true;
      const g = [];
      for (const m0 of sent) {
        const m = JSON.parse(JSON.stringify(m0)); m.id = 1; m.map = game.currentMap; if (m.t === 'hazhit') m.x = Math.round(player.x + player.w / 2);
        game._lxZc = null; game.projectiles.length = 0; Object.assign(player, { invulnerable: 0, _god: false, blockTimer: 0 }); ZM.log.length = 0;
        if (m.t === 'hazhit') _coopApplyHazHit(m); else _coopApplyBossHit(m);
        const first = ZM.log.reduce((s, h) => s + h.d, 0); let fired = false; const t0 = game.time | 0;
        ZM.step(80, () => { if (!fired && player.invulnerable <= 0 && (game.time | 0) - t0 < 72) { ZM.shot('zfollow'); fired = true; } });
        const mh = getMaxHp(); g.push({ t: m.t, zs: m.zs, sl: m.sl, hit: Math.round(1000 * first / mh) / 10, win: Math.round(1000 * ZM.log.reduce((s, h) => s + h.d, 0) / mh) / 10 });
      }
      return { host, g };
    } finally { Math.random = R0; window._coopActive = oA; window._coopFollowingHost = oF; net.ws = oWs; net.isHost = oH; net.hostId = oId; game.projectiles.length = 0; }
  };
}
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
  await p.addScriptTag({ content: '(' + harness + ')();(' + harness2 + ')();(' + harness3 + ')();' });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('forest'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    __ZM.hook();
  });
  const E = (f, a) => p.evaluate(f, a);
  const D = {}; let coopS = null, coopA = null;
  for (const sign of SIGNS) {
    const info = await E((s) => __ZM.enter(s), sign);
    const rows = [...await E(() => __ZM.run('mage', 70, ['story', 'normal', 'hard', 'nightmare'])), ...await E(() => __ZM.run('archer', 99, ['normal', 'nightmare'])),
      ...await E(() => __ZM.run('warrior', 90, ['normal']))];
    D[sign] = { info, rows };
    if (sign === 'scorpio') coopS = await E(() => { __ZM.hero('mage', 70); _lxDiffAdopt('normal'); return __ZM.coop('ambush'); });
    if (sign === 'aquarius') coopA = await E(() => { __ZM.hero('mage', 70); _lxDiffAdopt('normal'); return __ZM.coop('shock'); });
    const m70 = (d) => rows.find((r) => r.cls === 'mage' && r.diff === d);
    console.log(`  ${sign.padEnd(11)} L${info.lv} ATK ${info.atk}  Lv70 mage N: ${Object.entries(m70('normal').att).map(([k, v]) => `${k} ${v.hit}/${v.win}`).join(' ')}  NM: ${Object.entries(m70('nightmare').att).map(([k, v]) => `${k} ${v.hit}/${v.win}`).join(' ')}`);
  }
  const capped = (r) => Object.entries(r.att).filter(([, v]) => !v.tele);
  for (const sign of SIGNS) {   // every untelegraphed hit and every 1.2 s stack, on every tier, for the squishiest builds
    const rows = D[sign].rows.filter((r) => r.cls !== 'warrior'), over = [];
    for (const r of rows) for (const [k, v] of capped(r)) if (v.hit > CAP[r.diff] + 0.1 || v.win > CAP[r.diff] + 0.1) over.push(`${r.cls}${r.lv} ${r.diff} ${k} ${v.hit}/${v.win}`);
    const worst = (d) => Math.max(...rows.filter((r) => r.diff === d).flatMap((r) => capped(r).map(([, v]) => Math.max(v.hit, v.win))));
    check(over.length === 0, `${sign}: no hit, and no hit with a shot on top inside 1.2 s, passes the cap (worst Normal ${worst('normal')}% / Nightmare ${worst('nightmare')}%)`, over.slice(0, 6));
  }
  const top = (d) => SIGNS.map((s) => D[s].rows.find((r) => r.cls === 'mage' && r.diff === d).att.shot.hit);
  check(['story', 'normal', 'hard', 'nightmare'].every((d) => top(d).every((x) => Math.abs(x - CAP[d]) <= 0.2)),
    `one table for all twelve: a top roll on a Lv 70 mage lands exactly 30/45/65/85% on every sign (Normal ${top('normal').join(',')}; Nightmare ${top('nightmare').join(',')})`, { n: top('normal'), nm: top('nightmare') });
  { const t = SIGNS.map((s) => { const r = D[s].rows.find((q) => q.cls === 'warrior'); const d = r.att.shot.raw[0] ? r.att.shot.raw[0][1] : 0; return { s, d, lo: r.tank.lo, hi: r.tank.hi, pct: r.att.shot.hit }; });
    check(t.every((q) => q.d >= q.lo - 1 && q.d <= q.hi + 1 && q.pct < CAP.normal), `a tank is untouched: a Lv 90 warrior on Normal takes the plain zodiac roll from every sign (Scorpio's own, Capricorn's 32% floor), under the cap (${t.map((q) => q.pct).join(',')}%)`, t); }
  { const q = D.capricorn.rows.filter((r) => r.cls === 'mage');
    check(q.every((r) => Math.abs(r.att.quake.hit - r.quakeExpect) <= 0.2) && q.find((r) => r.diff === 'hard').att.quake.hit > CAP.hard,
      `telegraphed and kept: Capricorn's Hoofquake lands as designed on every tier (${q.map((r) => r.att.quake.hit).join(' / ')}%; airborne dodges it)`, q.map((r) => [r.diff, r.att.quake.hit, r.quakeExpect])); }
  console.log(`  co-op: ambush ${JSON.stringify(coopS && coopS.g)}  pool ${JSON.stringify(coopA && coopA.g)}`);
  { const h = coopS && coopS.g.find((x) => x.t === 'hazhit');
    check(!!h && h.zs === 'scorpio' && h.hit > 0 && h.hit <= CAP.normal + 0.1 && h.win <= CAP.normal + 0.1, `co-op guest: Scorpio's Ambush from the host's own detonation lands Scorpio's roll under 45%, and a shot on top shares it (${h ? h.hit + '/' + h.win : '-'}%)`, coopS); }
  { const h = coopA && coopA.g.find((x) => x.t === 'bosshit');
    check(!!h && h.hit > 0 && h.win <= CAP.normal + 0.1, `co-op guest: Aquarius's Conductive Pool from the host's broadcast, with a shot on top, stays under 45% (${h ? h.hit + '/' + h.win : '-'}%)`, coopA); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} catch (e) { check(false, 'harness', String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
