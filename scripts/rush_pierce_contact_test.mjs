// Warrior Rush's pierce hit (2.4x ATK) lands on the foe whose touch ends the dash, once per foe (fix-rush-pierce-contact).
//   node scripts/rush_pierce_contact_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Rush's i-frames were removed in v0.26.707 (per user), so a foe that touches the dashing hero lands its hit, and _lxContactLanding cancels the dash (rushTimer = 0, the
// co-op guest tick does the same through the same function). That landing runs in updateMonsters, a step BEFORE the pierce loop in updatePlayer can see the overlap, so the
// 2.4x hit never reached a foe that hurts you: against a Slime 80 px ahead only the 3x flame ticks landed, while with i-frames the same dash completed and pierced.
// The stop, the contact damage and the stagger are the pinned design (bughunt_guest_taken_test), so the fix delivers the pierce hit in the landing, before the cancel.
// Deterministic: a fake clock (page.clock), Math.random pinned (no crit, no dodge), flat ground, foes that stand still with huge HP.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10743';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const R = {}; const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.clock.install();
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof _coopFollowerContactTick === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    player._tutorialSeen = true; applyClass('warrior'); player.level = 60;
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  const now = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now + 1500);   // from here the clock moves only when a step runs it
  const step = async (n = 1) => { for (let i = 0; i < n; i++) await page.clock.runFor(33); };
  await page.evaluate(() => {
    Math.random = () => 0.95;   // no crit, no dodge, no proc
    window.__hits = []; const oh = window.hitMonster;
    window.hitMonster = function (m, dmg, crit, skill) { const r = oh.apply(this, arguments); window.__hits.push({ who: (window.__ds || []).indexOf(m), dmg: Math.round(dmg), skill, atk: getAtk() }); return r; };
    loadMap('glasswindSteppe'); game.paused = false;
  });
  await step(8);
  // one dash: the hero at x = 400 on the ground, foes `offs` px ahead, `inv` ms of i-frames at the cast
  const setup = (cfg) => page.evaluate((cfg) => {
    cancelPendingSkillTimers(); game.monsters.length = 0; game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0; game.particles.length = 0; game.damageNumbers.length = 0; game.monsterCap = 0; game.paused = false;
    applyClass('warrior'); player.level = 60; player.baseAtk = Math.max(player.baseAtk || 0, 400); player.maxMp = 99999; player.mp = 99999; player.skillCooldowns = {}; player._castLockUntil = 0;
    player.stunTimer = 0; player.frozenTimer = 0; player.hitStun = 0; player._skillLockTimer = 0; player.parryWindow = 0; player.blockTimer = 0; player.rushTimer = 0; player._rushHitSet = null; player.attacking = false; player.attackTimer = 0;
    const gy = Math.max(...game.mapData.platforms.filter((p) => p.type === 'ground').map((p) => p.y));
    player.x = 400; player.y = gy - player.h; player.onGround = true; player.facing = 1; player.vx = 0; player.vy = 0;
    player.maxHp = 1e9; player.hp = getMaxHp(); player._god = false; player.invulnerable = cfg.inv || 0;
    window.__ds = cfg.offs.map((off) => { const m = spawnMonster(player.x + off, gy - 40, 'slime', false, false); m.maxHp = m.currentHp = 1e12; m.def = 0; m.evasion = 0; m.speed = 0; m.vx = 0; m.y = gy - m.h; return m; });
    window.__hits.length = 0; window.__hp0 = player.hp; castSkill('rush');
    return { rt: player.rushTimer, set: !!player._rushHitSet };
  }, cfg);
  const collect = () => page.evaluate(() => {
    const out = { px: Math.round(player.x), rt: Math.round(player.rushTimer), lost: window.__hp0 - player.hp, perFoe: [], flame: 0, other: 0 };
    for (let i = 0; i < window.__ds.length; i++) out.perFoe.push(0);
    for (const h of window.__hits) {
      if (h.skill !== 'rush') { out.other++; continue; }
      if (h.dmg === Math.floor(h.atk * 2.4)) { if (h.who >= 0) out.perFoe[h.who]++; } else if (h.dmg === Math.floor(h.atk * 3)) out.flame++; else out.other++;
    }
    return out;
  });
  const dash = async (cfg) => { R[cfg.name + 'Set'] = await setup(cfg); await step(24); R[cfg.name] = await collect(); };
  await dash({ name: 'one', offs: [80], inv: 0 });                 // the repro: a Slime 80 px ahead, no i-frames
  await dash({ name: 'ctrlInv', offs: [80], inv: 1500 });          // control: with i-frames the dash completes and the loop pierces
  await dash({ name: 'row', offs: [60, 120, 180], inv: 1500 });    // three foes in a row, dash completes: once each
  await dash({ name: 'rowHurt', offs: [60, 120, 180], inv: 0 });   // three foes in a row, the first one touches: it is hit once, the dash stops there
  // the i-frames end the step after the dash loop has pierced a foe it is still overlapping: the touch that follows must not pierce it a second time
  R.lateSet = await setup({ name: 'late', offs: [80], inv: 1500 });
  for (let i = 0; i < 40; i++) { const n = await page.evaluate(() => window.__hits.filter((h) => h.skill === 'rush' && h.dmg === Math.floor(h.atk * 2.4)).length); if (n) break; await step(1); }
  R.lateAt = await page.evaluate(() => { const o = { rt: Math.round(player.rushTimer), overlap: aabb(player, window.__ds[0]), lost: window.__hp0 - player.hp }; player.invulnerable = 0; return o; });
  await step(16); R.late = await collect();
  // the co-op guest tick: a mirrored foe's touch ends a live dash through the same landing
  R.guest = await page.evaluate(() => {
    cancelPendingSkillTimers(); game.monsters.length = 0; game.monsterCap = 0; game.paused = false;
    const gy = Math.max(...game.mapData.platforms.filter((p) => p.type === 'ground').map((p) => p.y));
    player.x = 400; player.y = gy - player.h; player.onGround = true; player.facing = 1; player.skillCooldowns = {}; player._castLockUntil = 0; player.hp = getMaxHp(); player._god = false; player.invulnerable = 0; player.hitStun = 0;
    const m = spawnMonster(player.x + 6, gy - 40, 'slime', false, false); m.maxHp = m.currentHp = 1e12; m.def = 0; m.evasion = 0; m.speed = 0; m._coopMirror = true; window.__ds = [m];
    castSkill('rush'); window.__hits.length = 0; const hp0 = player.hp;
    _coopFollowerContactTick();
    const first = { hits: window.__hits.filter((h) => h.skill === 'rush' && h.dmg === Math.floor(h.atk * 2.4)).length, rt: player.rushTimer, inv: player.invulnerable, lost: hp0 - player.hp, has: !!(player._rushHitSet && player._rushHitSet.has(m)) };
    player.invulnerable = 0; _coopFollowerContactTick();   // the dash is over: a second touch must not pierce again
    return { first, total: window.__hits.filter((h) => h.skill === 'rush' && h.dmg === Math.floor(h.atk * 2.4)).length };
  });
  // a landing that is no touch (the host block also lands a proximity swing's reach hit from a foe the hero does not overlap): it ends the dash, it pierces nothing
  R.reach = await page.evaluate(() => {
    cancelPendingSkillTimers(); game.monsters.length = 0; game.monsterCap = 0; game.paused = false;
    const gy = Math.max(...game.mapData.platforms.filter((p) => p.type === 'ground').map((p) => p.y));
    player.x = 400; player.y = gy - player.h; player.onGround = true; player.facing = 1; player.skillCooldowns = {}; player._castLockUntil = 0; player.hp = getMaxHp(); player._god = false; player.invulnerable = 0; player.hitStun = 0;
    const m = spawnMonster(player.x + 220, gy - 40, 'slime', false, false); m.maxHp = m.currentHp = 1e12; m.def = 0; m.evasion = 0; m.speed = 0; window.__ds = [m];
    castSkill('rush'); window.__hits.length = 0; _lxContactLanding(m, 5, 5, 5);
    return { pierce: window.__hits.filter((h) => h.skill === 'rush' && h.dmg === Math.floor(h.atk * 2.4)).length, rt: player.rushTimer, has: !!(player._rushHitSet && player._rushHitSet.has(m)) };
  });
} finally { await browser.close(); srv.kill(); }
const one = R.one, row = R.row, hurt = R.rowHurt;
check(R.oneSet && R.oneSet.rt > 0 && R.oneSet.set, 'Rush casts: the dash timer runs and its hit-set exists', R.oneSet);
check(one.perFoe[0] === 1, 'a Slime 80 px ahead with no i-frames takes the 2.4x pierce hit, exactly once (it took none)', one);
check(one.flame >= 3, 'the 3x flame bursts still land as before', one);
check(one.px >= 425 && one.px <= 460 && one.rt === 0 && one.lost > 0, 'unchanged: the touch still stops the dash short of 625, and the hero still takes the contact hit', one);
check(R.ctrlInv.perFoe[0] === 1 && R.ctrlInv.px >= 600 && R.ctrlInv.lost === 0, 'control: with i-frames the dash completes (x ~625), pierces once, and the hero takes nothing', R.ctrlInv);
check(row.perFoe.join() === '1,1,1' && row.px >= 600, 'three foes in a row, dash completing: each is pierced exactly once', row);
check(hurt.perFoe[0] === 1 && hurt.perFoe[1] === 0 && hurt.perFoe[2] === 0 && hurt.lost > 0 && hurt.px < 470, 'three foes in a row, the first touches: it takes exactly one pierce, the dash stops, nobody is hit twice', hurt);
check(R.lateAt.rt > 0 && R.lateAt.overlap && R.lateAt.lost === 0 && R.late.perFoe[0] === 1 && R.late.lost > 0 && R.late.rt === 0, 'a foe the dash loop already pierced is not pierced again by the touch that follows when the i-frames run out', { at: R.lateAt, late: R.late });
check(R.guest.first.hits === 1 && R.guest.first.rt === 0 && R.guest.first.has && R.guest.first.lost > 0 && R.guest.total === 1, 'co-op guest tick: a mirrored foe\'s touch pierces once, ends the dash, and a second touch does not pierce again', R.guest);
check(R.reach.pierce === 0 && R.reach.rt === 0 && !R.reach.has, 'a landing from a foe the hero does not overlap (a proximity swing) still ends the dash but pierces nothing', R.reach);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
