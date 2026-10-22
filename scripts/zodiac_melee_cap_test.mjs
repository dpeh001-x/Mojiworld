// ZODIAC MELEE CAP (v0.30.x zodiac-melee-cap). v0.30.1853 capped every zodiac shot and hazard per tier but left the signature
// heavy swing of Aries, Capricorn and Pisces on the boss heavy band (a share of the level bar, not of the hero's pool): 36-47% of a
// geared Lv 70 hero's max HP, flat on every tier. Per user ("cap them to 45%"): a swing takes at most 45% of max HP on EVERY tier
// (a lighter swing is unchanged), and it counts toward the 1.2 s zodiac window so a shot on top shares the tier's cap.
// Each sign's REAL swing is fired in its own arena (the telegraph run out, one monster tick) against a geared at-level hero
// (devSetLevel + the best shop piece per slot), the resolver stepped by hand with Math.random pinned high. "raw" is the same swing
// with the new flag stripped (what origin lands), "live" what lands now.
//   node scripts/zodiac_melee_cap_test.mjs     (MOJI_GAME_FILE=<build.html> PORT=<port>)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11831';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 600)}`); if (!ok) bad++; };
const SIGNS = ['aries', 'capricorn', 'pisces'], CLS = ['mage', 'archer', 'warrior'], DIFFS = ['story', 'normal', 'hard', 'nightmare'];
const CAP = { story: 30, normal: 45, hard: 65, nightmare: 85 }, SWING = 45;
function harness() {
  const ZM = window.__ZM = { log: [], B: null, sign: null, floorY: 480 };
  const BIG = 1e8, DT = 1000 / 60;
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
    game.monsters = game.monsters.filter((m) => m === B); ZM.B = B; ZM.sign = sign;
    const bcx = B.x + B.w / 2; let gy = null;
    for (const pl of ((game.mapData && game.mapData.platforms) || [])) if (pl && pl.type === 'ground' && bcx >= pl.x && bcx <= pl.x + pl.w && (gy == null || pl.y < gy)) gy = pl.y;
    ZM.floorY = gy != null ? gy : (B.y + B.h);
    if (!B._zFlying && !B._noGravity) B.y = ZM.floorY - B.h;
    ZM.BX = B.x = 700 - B.w / 2;
    return { name: B.name, atk: B.atk, lv: _mobLevel(B), bm: !!(B.traits && B.traits.bigMelee && B.traits.bigMelee.kind === 'swing') };
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
    '_leoMarkAt', '_maneTickAt', '_virgoMarkAt', '_geminiLyingAt', '_dreamShotAt', '_delugeCd', '_sbCd', '_sagKickAt', '_columnCd', '_hgCd'];
  ZM.hold = function (M) {   // the boss still, every timed mechanic parked, so only the swing under test fires
    const B = M || ZM.B; for (const k of FAR) B[k] = 1e12; B.x = M ? B.x : ZM.BX;
    Object.assign(B, { patternState: 'idle', patternTimer: 0, vx: 0, vy: 0, _tidalArmed: false, _capQuakeFiring: false, _capArenaStart: game.time | 0, _piscesSplit: true,
      _chargeBurst: true, _despState: null, _dirOpenT: 0, _dirFleeT: 0, _zSpentMs: 0, phase: 1, currentHp: Math.floor(B.maxHp * 0.9) });
  };
  ZM.place = function (cx) {
    player.x = Math.round(cx - player.w / 2); player.y = ZM.floorY - player.h; player.vx = 0; player.vy = 0; player.onGround = true;
    if (game.camera) { const ww = (game.mapData && game.mapData.worldWidth) || 1800; game.camera.x = Math.max(0, Math.min(ww - W_PLAY, cx - W_PLAY / 2)); }   // an off-screen strike does no damage
  };
  ZM.shot = function () { game.projectiles.push({ x: player.x + player.w / 2 - 8, y: player.y + player.h / 2 - 8, w: 16, h: 16, vx: 0, vy: 0, life: 8, damage: ZM.B.atk * 1.5,
    owner: 'enemy', _zodiacSign: ZM.sign, _zodiacAttacker: true, skill: 'zfollow', sourceLabel: 'zfollow', noGravity: true, color: '#ffffff' }); };
  // the REAL heavy swing: its telegraph run out, one monster tick fires the strike (the hero held untouchable for that tick so no
  // contact lands); only the swing is kept. raw strips the new flag: the swing as origin lands it.
  ZM.swing = function (raw, M) {
    const B = M || ZM.B; ZM.hold(B); B.facing = 1; ZM.place(B.x + B.w + 30);
    Object.assign(B, { _bigMeleeFiring: true, _bigMeleeT: 1, _bigMeleeCd: 1e9 });
    const inv = player.invulnerable, n0 = game.projectiles.length, l0 = ZM.log.length; player.invulnerable = 1e9;
    ZM.freeze = false; try { updateMonsters(DT); } finally { ZM.freeze = true; }
    player.invulnerable = inv; ZM.log.length = l0;
    const sw = game.projectiles.slice(n0).filter((q) => q && q.skill === 'swing');
    game.projectiles.splice(n0); for (const q of sw) { if (raw) delete q._lxZodSwing; game.projectiles.push(q); }
    game.hazards.length = 0; B.vx = 0; ZM.swung = sw[0] || null;
    return sw.length;
  };
  ZM.step = function (n) {
    for (let i = 0; i < n; i++) {
      game.time++; if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - DT);
      player.hitStun = 0; player.blockTimer = 0; player.vx = 0; player.vy = 0; player.onGround = true;
      updateProjectiles(DT);
    }
  };
  ZM.reset = function () {
    game.projectiles.length = 0; game.hazards.length = 0; game._lxZc = null; ZM.log.length = 0;
    Object.assign(player, { invulnerable: 0, blockTimer: 0, _aegis: false, _god: false, burnTimer: 0, _poisonTimer: 0, _cancerBubble: 0 });
  };
  const pct = (d) => Math.round(1000 * d / getMaxHp()) / 10;
  // first() lands, then the hero's i-frames are cleared (as a lapse would) and second() lands inside the same 1.2 s
  ZM.pair = function (first, second) {
    ZM.reset(); first(); ZM.step(20); const a = ZM.log.slice();
    game.projectiles = game.projectiles.filter((q) => q.skill !== 'swing'); player.invulnerable = 0;
    second(); ZM.step(20); const b = ZM.log.slice(a.length);
    return { a: pct(a.reduce((s, h) => s + h.d, 0)), b: pct(b.reduce((s, h) => s + h.d, 0)), dt: (b[0] && a[0]) ? b[0].t - a[0].t : null, n: [a.length, b.length] };
  };
  ZM.one = function (raw) { ZM.reset(); const n = ZM.swing(raw); ZM.step(20); return { n, hit: pct(ZM.log.reduce((m, h) => Math.max(m, h.d), 0)), k: ZM.log.length, src: ZM.log[0] && ZM.log[0].src }; };
  ZM.run = function (cls, lv) {
    const R0 = Math.random; Math.random = () => 0.9999; const rows = [];
    try {
      ZM.hero(cls, lv);
      for (const diff of ['story', 'normal', 'hard', 'nightmare']) {
        _lxDiffAdopt(diff);
        const raw = ZM.one(true), live = ZM.one(false);
        const r = { cls, lv, diff, mh: getMaxHp(), raw: raw.hit, live: live.hit, n: live.n, flag: !!(ZM.swung && ZM.swung._lxZodSwing), src: live.src };
        if (cls === 'mage') { r.swingShot = ZM.pair(() => ZM.swing(false), () => ZM.shot()); r.shotSwing = ZM.pair(() => ZM.shot(), () => ZM.swing(false)); }
        rows.push(r);
      }
    } finally { Math.random = R0; }
    return rows;
  };
  // co-op: the host's real swing as its frame lists it (_coopProjList), applied by a guest (_coopApplyProjectiles), resolved on the guest's own bar
  ZM.coop = function () {
    const oF = window._coopFollowingHost, oH = net.isHost, oId = net.hostId, R0 = Math.random; Math.random = () => 0.9999;
    try {
      ZM.reset(); ZM.swing(false); const list = _coopProjList(true).filter((e) => e.s === 'swing');
      game.projectiles.length = 0; net.isHost = false; net.hostId = 1; window._coopFollowingHost = () => true;
      _coopApplyProjectiles({ id: 1, map: game.currentMap, list });
      const mir = game.projectiles.find((q) => q._coopMirror); ZM.step(20);
      return { sent: list.length, xf: list[0] && list[0].xf ? Object.keys(list[0].xf).filter((k) => /Zod|Band|sgL0/.test(k)) : [], mirror: !!mir, flag: !!(mir && mir._lxZodSwing), hit: pct(ZM.log.reduce((m, h) => Math.max(m, h.d), 0)) };
    } finally { Math.random = R0; window._coopFollowingHost = oF; net.isHost = oH; net.hostId = oId; game.projectiles.length = 0; }
  };
  // an ordinary swinger (a Pincer) in the same arena: its swing never carries the zodiac flag
  ZM.mob = function () {
    spawnMonster(ZM.BX - 300, ZM.floorY - 60, 'scorpion'); const M = game.monsters[game.monsters.length - 1];
    if (!M || M.type !== 'scorpion') return { ok: false };
    M.y = ZM.floorY - M.h; ZM.reset(); ZM.swing(false, M); const q = ZM.swung;
    game.monsters = game.monsters.filter((m) => m !== M); game.projectiles.length = 0;
    return { ok: !!q, flag: !!(q && q._lxZodSwing) };
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof devSetLevel === 'function' && typeof _coopApplyProjectiles === 'function', null, { timeout: 150000 });
  await p.addScriptTag({ content: '(' + harness + ')();' });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('forest'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    __ZM.hook();
  });
  const E = (f, a) => p.evaluate(f, a);
  const D = {}; let coop = null, mob = null;
  for (const sign of SIGNS) {
    const info = await E((s) => __ZM.enter(s), sign);
    const rows = []; for (const c of CLS) rows.push(...await E((c) => __ZM.run(c, 70), c));
    D[sign] = { info, rows };
    if (sign === 'pisces') { coop = await E(() => { __ZM.hero('mage', 70); _lxDiffAdopt('normal'); const raw = __ZM.one(true).hit; return Object.assign(__ZM.coop(), { raw }); }); mob = await E(() => __ZM.mob()); }
    console.log(`  ${sign.padEnd(9)} L${info.lv} ATK ${info.atk}  raw->live % of max HP (S/N/H/NM):`);
    for (const c of CLS) console.log(`     ${c.padEnd(7)} ` + rows.filter((r) => r.cls === c).map((r) => `${r.raw}->${r.live}`).join('  ') + `   (max HP ${rows.find((r) => r.cls === c).mh})`);
    console.log('     mage swing+shot ' + rows.filter((r) => r.swingShot).map((r) => `${r.diff} ${r.swingShot.a}+${r.swingShot.b}`).join('  ') + '   shot+swing ' + rows.filter((r) => r.shotSwing).map((r) => `${r.shotSwing.a}+${r.shotSwing.b}`).join('  '));
  }
  const all = SIGNS.flatMap((s) => D[s].rows.map((r) => Object.assign({ sign: s }, r)));
  check(all.every((r) => r.n === 1 && r.raw > 0), `the real swing fires and lands on every sign, class and tier (${all.length} rows)`, all.filter((r) => !(r.n === 1 && r.raw > 0)).slice(0, 4));
  check(all.some((r) => r.raw > SWING + 0.1), `the bug is real: some uncapped swing passes 45% (worst ${Math.max(...all.map((r) => r.raw))}%)`, {});
  for (const sign of SIGNS) {
    const over = D[sign].rows.filter((r) => r.live > SWING + 0.05);
    check(over.length === 0, `${sign}: no signature swing takes more than 45% of max HP on any tier (worst ${Math.max(...D[sign].rows.map((r) => r.live))}%, was ${Math.max(...D[sign].rows.map((r) => r.raw))}%)`, over.map((r) => `${r.cls} ${r.diff} ${r.raw}->${r.live}`).slice(0, 6));
  }
  { const off = all.filter((r) => Math.abs(r.live - Math.min(r.raw, SWING)) > 0.05);
    check(off.length === 0, 'flat on every tier: a swing lands min(its own value, 45%) - a lighter one is unchanged, Story included (never trimmed to 30%)', off.map((r) => `${r.sign} ${r.cls} ${r.diff} ${r.raw}->${r.live}`).slice(0, 6)); }
  { const ms = all.filter((r) => r.swingShot), off = ms.filter((r) => r.swingShot.a + r.swingShot.b > Math.max(CAP[r.diff], r.swingShot.a) + 0.1 || r.swingShot.dt > 72);
    check(off.length === 0, `a swing counts toward the 1.2 s window: a shot landing on top of it shares the tier's cap (Lv 70 mage, ${ms.map((r) => r.diff[0].toUpperCase() + ' ' + r.swingShot.a + '+' + r.swingShot.b).join(', ')})`, off.map((r) => [r.sign, r.diff, r.swingShot]).slice(0, 6)); }
  { const ms = all.filter((r) => r.shotSwing), off = ms.filter((r) => Math.abs(r.shotSwing.b - Math.min(r.raw, SWING)) > 0.05);
    check(off.length === 0, 'the window never trims the swing itself: after a shot it still lands min(its value, 45%)', off.map((r) => [r.sign, r.diff, r.raw, r.shotSwing]).slice(0, 6)); }
  console.log('  co-op ' + JSON.stringify(coop) + '  mob ' + JSON.stringify(mob));
  check(!!coop && coop.mirror && coop.flag && coop.hit > 0 && Math.abs(coop.hit - Math.min(coop.raw, SWING)) <= 0.05,
    `co-op guest: the host's swing mirrored to a guest lands the same capped hit on the guest's own bar (${coop ? coop.raw + '->' + coop.hit : '-'}%)`, coop);
  check(!!mob && mob.ok && !mob.flag, 'an ordinary swinger (Pincer) keeps its own band: its swing carries no zodiac flag', mob);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} catch (e) { check(false, 'harness', String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
