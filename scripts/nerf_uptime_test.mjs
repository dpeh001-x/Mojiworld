#!/usr/bin/env node
// v0.30.1530 - OVERPOWERED SKILLS, PART 4: UPTIME, SUMMONS, LOOPS (per user: "Fix all that you have suggested", after the audit of
// "skills that might be too overpowered, especially the buffs and those with miscellaneous effects").
//   SHADE   - Shadow Sovereign's cooldown does not run while the shade stands, and runs once it fades
//   SMOKE   - Smoke Dash gives a ninja a 0.4 s crit window (was 1 s)
//   SLEIGHT - Backstab's +0.5x crit damage refreshes at most once every 6 s
//   BUFFS   - at rank 10 War Cry / Bloodlust / Warlord's Banner stop at 10 / 25 / 14 s, the banner's reach too, and partners
//             get the base 7 / 20 / 12 s
//   SUMMONS - the apex werewolf sends the oldest of 5 pack wolves home and then blocks a 6th; at most 5 undead, the MojiMon kept
//   REFUND  - a window refunds its cooldown on 3 kills at most
//   MARK    - a weaker mark does not refresh a stronger one, a stronger one does; Grand Hex's rank-10 mark is x1.20
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/nerf_uptime_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11793);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.mojiworld_prologue_seen = '1'; } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('rogue'); player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
    loadMap('forest', 300); await sleep(1500); game.paused = true;
    const hero = (cls, job, master) => { if (player.cls !== cls) applyClass(cls); player.job = job; player.master = master; player.masteries = master ? { [master]: true } : {};
      player.level = 99; player._god = true; player.invulnerable = 0; player.mp = player.maxMp = 99999; player.skillCooldowns = {}; player.skillRanks = {}; player._castLockUntil = 0;
      for (const k of Object.keys(player.buffs || {})) player.buffs[k] = 0; };
    const tick = (n) => { for (let i = 0; i < n; i++) { game.time += 1; _lxTickPlayerTimers(1000 / 60); } };
    const foe = (dx) => { const m = spawnMonster(player.x + dx, player.y - 10, 'slime', false); Object.assign(m, { maxHp: 1e9, currentHp: 1e9, evasion: 0, traits: null }); return m; };
    const out = {};
    // SHADE
    hero('rogue', 'ninja', 'shadowlord'); game.monsters.length = 0;
    try { castSkill('shadowlord_ult'); } catch (e) { out.shadeErr = String(e).slice(0, 80); }
    const cd0 = player.skillCooldowns.shadowlord_ult | 0; tick(120); const cdHeld = player.skillCooldowns.shadowlord_ult | 0;
    player._shade = null; tick(120); out.shade = { cast: cd0, after2sWithShade: cdHeld, after2sMore: player.skillCooldowns.shadowlord_ult | 0 };
    // SMOKE + SLEIGHT
    hero('rogue', 'ninja', null); SKILL_FNS.smokeDash(); out.smoke = player.buffs.smokeBomb;
    game.monsters.length = 0; hero('rogue', 'ninja', null); player._sleightNextAt = 0;
    const s = []; for (const wait of [0, 60, 361]) { tick(wait); player.buffs.sleight = 0; foe(120); SKILL_FNS.backstab(); s.push(player.buffs.sleight | 0); game.monsters.length = 0; }
    out.sleight = s;
    // BUFFS at rank 10, a fake socket for the partner frames
    const sent = []; const _ca = window._coopActive, _ws = net.ws; window._coopActive = () => true; net.ws = { readyState: 1, send: (x) => sent.push(JSON.parse(x)) };
    const share = (name) => { const f = sent.filter((x) => x.pbf && x.bl).map((x) => x.bl.find((b) => b[0] === name)).filter(Boolean).pop(); return f ? f[1] : null; };
    try {
      const cast = (id) => { net._lastPbufAt = 0; net._pbufHeld = null; sent.length = 0; for (const k of Object.keys(player.buffs)) player.buffs[k] = 0; player.skillRanks = { [id]: 10 }; SKILL_FNS[id](); };
      hero('warrior', 'berserker', 'warlord');
      cast('warCry'); out.warCry = { self: player.buffs.warCry, partner: share('warCry') };
      cast('bloodlust'); out.bloodlust = { self: player.buffs.bloodlust, partner: share('bloodlust') };
      cast('warlord_warcry'); out.banner = { warCry: player.buffs.warCry, bloodlust: player.buffs.bloodlust, reachF: Math.round(player._warlordBanner - game.time),
        flagF: Math.round((game.hazards.find((h) => h && h.type === 'warlord_banner') || {}).life || 0), partnerWarCry: share('warCry'), partnerBloodlust: share('bloodlust') };
      game.hazards.length = 0; player.skillRanks = {};
    } finally { window._coopActive = _ca; net.ws = _ws; }
    // SUMMONS
    hero('archer', 'ranger', 'beastmaster'); player.pet = null; player.ultPet = null;
    player.pack = [3, 0, 4, 1, 2].map((i) => ({ _i: i, x: player.x, y: player.y, vx: 0, vy: 0, w: 40, h: 36, hp: 100, maxHp: 100, life: 50000 + i * 1000, maxLife: 60000 }));
    SKILL_FNS.beastmaster_ult(); const alive = player.pack.filter((w) => w.life > 0);
    out.wolf = { alive: alive.length, retired: player.pack.filter((w) => w.life <= 0).map((w) => w._i), werewolf: !!player.ultPet };
    player.pack = alive; out.wolf.packCast = SKILL_FNS.beastmaster_pack(); out.wolf.bondCast = SKILL_FNS.wildBond(); out.wolf.pet = !!player.pet;
    player.pack = []; player.pet = null; player.ultPet = null;
    game.minions = [{ mojimon: true, type: 'slime', life: 1e9, x: 0, y: 0, w: 20, h: 20, currentHp: 100, maxHp: 100 }];
    for (let i = 0; i < 7; i++) raiseMinion(player.x + 40 * i, player.y, i % 2 ? 'zombie' : 'skeleton', 10000 + i * 100, 0.5);
    const und = game.minions.filter((mn) => mn.type === 'skeleton' || mn.type === 'zombie');
    out.undead = { alive: und.filter((mn) => mn.life > 0).length, crumbled: und.filter((mn) => mn.life <= 0).length, oldestKept: Math.min(...und.filter((mn) => mn.life > 0).map((mn) => mn.maxLife)),
      mojimon: game.minions.some((mn) => mn.mojimon && mn.life > 0) };
    game.minions = [];
    // REFUND
    player._msWin = { id: 'deathBlossom', until: game.time + 600, refundOnKill: 0.3 }; player.skillCooldowns.deathBlossom = 10000;
    for (let i = 0; i < 5; i++) _msRefundOnKill('dagger'); out.refund = Math.round(player.skillCooldowns.deathBlossom); player._msWin = null;
    // MARK
    { const m = foe(200); m._msMarkMul = 1.28; m._msMarkUntil = game.time + 100;
      player._msWin = { id: 'x', until: game.time + 600, mark: { mul: 1.07, ms: 3000 } }; _msApplyOnHit(m, 100, false, 'x');
      const weak = { mul: m._msMarkMul, left: m._msMarkUntil - game.time };
      player._msWin = { id: 'y', until: game.time + 600, mark: { mul: 1.30, ms: 3000 } }; _msApplyOnHit(m, 100, false, 'x');
      out.mark = { weak, strong: { mul: m._msMarkMul, left: m._msMarkUntil - game.time }, grandHex: SKILL_LV10_BONUS.hexmaster_grandhex.window.mark.mul };
      player._msWin = null; game.monsters.length = 0; }
    return out;
  });
  const S = R.shade;
  ok('SHADE: the cooldown waits while the shade stands, and runs once it fades', !R.shadeErr && S.cast > 0 && S.after2sWithShade === S.cast && S.after2sMore < S.cast - 1500, JSON.stringify({ ...S, err: R.shadeErr }));
  ok('SMOKE: Smoke Dash gives a ninja a 0.4 s crit window', R.smoke === 400, R.smoke);
  ok('SLEIGHT: Backstab grants +0.5x crit damage, not again 1 s later, again after 6 s', R.sleight[0] === 2500 && R.sleight[1] === 0 && R.sleight[2] === 2500, JSON.stringify(R.sleight));
  ok('BUFFS: rank-10 War Cry stops at 10 s, partners get 7 s', R.warCry.self === 10000 && R.warCry.partner === 7000, JSON.stringify(R.warCry));
  ok('BUFFS: rank-10 Bloodlust stops at 25 s, partners get 20 s', R.bloodlust.self === 25000 && R.bloodlust.partner === 20000, JSON.stringify(R.bloodlust));
  const B = R.banner;
  ok("BUFFS: rank-10 Warlord's Banner stops at 14 s (buffs, reach and flag), partners get 12 s", B.warCry === 14000 && B.bloodlust === 14000 && B.reachF === 840 && B.flagF <= 840 && B.flagF > 800 && B.partnerWarCry === 12000 && B.partnerBloodlust === 12000, JSON.stringify(B));
  ok('SUMMONS: the werewolf sends the pack wolf with the least time left home (5 + 1 was 6)', R.wolf.werewolf && R.wolf.alive === 4 && R.wolf.retired.join() === '0', JSON.stringify(R.wolf));
  ok('SUMMONS: with the werewolf and 4 wolves out, neither the pack nor Wild Bond adds a 6th', R.wolf.packCast === '_lxNoCast' && R.wolf.bondCast === '_lxNoCast' && !R.wolf.pet, JSON.stringify(R.wolf));
  ok('SUMMONS: 7 raises leave 5 undead (the oldest crumble) and the MojiMon untouched', R.undead.alive === 5 && R.undead.crumbled === 2 && R.undead.oldestKept === 10200 && R.undead.mojimon, JSON.stringify(R.undead));
  ok('REFUND: five kills in a window refund only three times (10 s -> 3.43 s)', R.refund === 3430, R.refund);
  ok('MARK: a weaker mark leaves a stronger one alone; a stronger one takes over and refreshes', R.mark.weak.mul === 1.28 && R.mark.weak.left <= 100 && R.mark.strong.mul === 1.30 && R.mark.strong.left === 180, JSON.stringify(R.mark));
  ok("MARK: Grand Hex's rank-10 mark is x1.20", R.mark.grandHex === 1.2, R.mark.grandHex);
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
