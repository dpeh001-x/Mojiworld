#!/usr/bin/env node
// THE NUMBER A HIT ON THE PLAYER SHOWS IS THE HP IT TOOK (v0.30.1474). Per user: "the damage numbers shown dealt by enemies
// to player does not coincide with the actual damage to player". 26 damage paths subtracted the loss after _diffDmg
// (difficulty, level gap, hexes) and the boss / zodiac / field caps, but showed the value from before them: a Lv 60 hero
// read 131 for a 786 tremor, 395 for a 4084 zodiac shot, 16597 for a 5358 Gloopaloo quake. For each source, one hit is
// landed on a live player and the floating number(s) pushed in that sim step are compared with the HP actually lost then.
// An accessor on player.hp records every decrease with game.time; damageNumbers.push is wrapped to stamp game.time.
//   node scripts/taken_dmg_number_match_test.mjs [port]     PORT / MOJI_SERVE_ROOT / LEVELS (default 60,8) / MAXHP
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10611); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const MAXHP = Number(process.env.MAXHP || 20000);
const LEVELS = (process.env.LEVELS || '60,8').split(',').map(Number);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof MONSTER_SKILL_FNS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const out = await page.evaluate(async ([LEVELS, process_MAXHP]) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    player._storyBeatsSeen = new Proxy({}, { get: () => true, has: () => true });
    player.cls = 'mage'; player.level = LEVELS[0];
    loadMap('forest', 300); await sleep(1500); game.paused = false;
    window.getEvasion = () => 0;                       // no passive dodge rolls
    // ---- instrumentation ----
    const L = { drops: [], nums: [] };
    let _v = player.hp;
    Object.defineProperty(player, 'hp', { enumerable: true, configurable: true, get() { return _v; },
      set(nv) { if (typeof nv === 'number' && nv < _v) L.drops.push({ t: game.time | 0, lost: _v - nv }); _v = nv; } });
    const wrapNums = () => { const a = game.damageNumbers; if (a._lxW) return; const p0 = a.push;
      a.push = function (...xs) { for (const d of xs) if (d && d.taken) L.nums.push({ t: game.time | 0, text: String(d.text) }); return p0.apply(this, xs); }; a._lxW = 1; };
    const fig = (s) => { const m = /^-?\s*([\d,]+)/.exec(s); return m ? +m[1].replace(/,/g, '') : null; };
    const X0 = player.x, Y0 = player.y;
    const reset = async (lvl) => {
      game.paused = false; game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
      player.level = lvl; player.maxHp = +(process_MAXHP); player._healLockUntil = 0;
      await sleep(120);                                 // getMaxHp follows a level change a frame late
      window._lxHpRestore = true; player.hp = getMaxHp(); window._lxHpRestore = false;
      player.mp = 0; player.invulnerable = 0; player.lastHitTime = -9999; player.blockTimer = 0; player._aegis = false;
      player._poisonTimer = 0; player.burnTimer = 0; player._electrocuteTimer = 0; player._poisonTickAcc = 0; player._burnTickAcc = 0; player.hitStun = 0; player.stunTimer = 0;
      player.x = X0; player.y = Y0; player.vx = 0; player.vy = 0; game.comboMult = 1; game.combo = 0;
      wrapNums(); L.drops.length = 0; L.nums.length = 0;
    };
    const spawnAt = (type, dx, boss) => { spawnMonster(player.x + dx, player.y - 10, type, !!boss);
      const m = game.monsters[game.monsters.length - 1]; if (m) { m.evasion = 0; m._stagger = 0; } return m; };
    // one hit: run setup, wait for the first HP drop, then read that step's drops + numbers
    const measure = async (label, lvl, setup, opts = {}) => {
      await reset(lvl);
      let ctx; try { ctx = await setup(); } catch (e) { return { label, lvl, err: String(e.message).slice(0, 100) }; }
      const t0 = performance.now();
      while (!L.drops.length && performance.now() - t0 < (opts.ms || 4000)) {
        if (opts.hold) { try { opts.hold(ctx); } catch (e) {} }
        if (opts.block) player.blockTimer = 600;
        await sleep(16);
      }
      if (!L.drops.length) return { label, lvl, err: 'no hit landed' };
      const t = L.drops[0].t; await sleep(120);
      const src = player._lastDamageSource;
      const lost = L.drops.filter((d) => d.t === t).reduce((s, d) => s + d.lost, 0);
      const shown = L.nums.filter((n) => Math.abs(n.t - t) <= 1).map((n) => n.text);
      const figs = shown.map(fig).filter((x) => x != null);
      game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
      return { label, lvl, src, lost: Math.round(lost), shown, fig: figs.length ? figs[0] : null, dmul: game._diffDmgMul || 1 };
    };
    const onPlayer = (p) => { p.x = player.x + player.w / 2 - (p.w || 12) / 2; p.y = player.y + player.h / 2 - (p.h || 12) / 2; p.vx = 0.01; p.vy = 0; };
    const firstShot = async (m, skill, ms) => { const t0 = performance.now();
      while (performance.now() - t0 < ms) { const p = game.projectiles.find((q) => q && q.owner === 'enemy' && (!skill || q.skill === skill)); if (p) return p; if (m) { m.currentHp = m.maxHp; } player.invulnerable = 99999; await sleep(30); }
      return null; };
    const res = [];
    for (const lv of LEVELS) {
      res.push(await measure('contact: Jelly touch', lv, () => { const m = spawnAt('slime', 0); m.x = player.x; m.y = player.y + player.h - m.h; return m; },
        { hold: (m) => { m.x = player.x; } }));
      res.push(await measure('contact: Jelly touch, BLOCKING', lv, () => { const m = spawnAt('slime', 0); m.x = player.x; m.y = player.y + player.h - m.h; return m; },
        { hold: (m) => { m.x = player.x; }, block: true }));
      res.push(await measure('mob shot: Rotter mtoxic (fireMonsterProjectile)', lv, async () => {
        const m = spawnAt('zombie', 300); fireMonsterProjectile(m, 0); const p = game.projectiles.find((q) => q.owner === 'enemy');
        game.monsters.length = 0; player.invulnerable = 0; onPlayer(p); return p; }, { hold: (p) => onPlayer(p) }));
      res.push(await measure('mob shot: Rotter mtoxic, BLOCKING', lv, async () => {
        const m = spawnAt('zombie', 300); fireMonsterProjectile(m, 0); const p = game.projectiles.find((q) => q.owner === 'enemy');
        game.monsters.length = 0; player.invulnerable = 0; onPlayer(p); return p; }, { hold: (p) => onPlayer(p), block: true }));
      res.push(await measure('mob special: Lantern Wisp lanternPulse', lv, () => { const m = spawnAt('lanternWisp', 40); MONSTER_SKILL_FNS.lanternPulse(m); return m; }));
      for (const k of ['groundStun', 'shockwave', 'lightningStrike', 'cloudburst']) {   // poisonCloud never lands inside the window
        res.push(await measure('mob hazard: ' + k + ' (Thunderpork)', lv, () => { const m = spawnAt('voltipup', 90); MONSTER_SKILL_FNS[k](m); m.x = player.x + 1400; m.speed = 0; return m; },
          { hold: (m) => { if (m) { m.vx = 0; m.x = player.x + 1400; } }, ms: 5000 }));
      }
      res.push(await measure('DoT: poison tick', lv, () => { player._poisonTimer = 3000; player._poisonDmg = 400; }));
    }
    // bosses (level held at the first LEVELS entry): real projectiles picked off the field, and a boss touch
    const lvB = LEVELS[0];
    // King Krook's claw built exactly as its spawn site builds it (bossAI, skill 'claw'), then dropped on the player
    for (const blk of [false, true]) res.push(await measure('boss shot: kingKrook claw (spawn-site fields)' + (blk ? ', BLOCKING' : ''), lvB, () => {
      const m = spawnAt('kingKrook', 600, true); const p = { x: 0, y: 0, vx: 0.01, vy: 0, w: 30, h: 30, life: 120, damage: m.atk * 0.9, owner: 'enemy',
        _bossBand: _bossHitBand(m, 'ranged'), skill: 'claw', _srcType: m.type, color: '#fff' };
      game.monsters.length = 0; game.projectiles.push(p); onPlayer(p); return p; }, { hold: (p) => onPlayer(p), block: blk }));
    // King Gloopaloo's QUAKE: a boss direct hit written inside bossAI (not a projectile / hazard)
    res.push(await measure('boss direct: King Gloopaloo quake', lvB, () => { const m = spawnAt('king', 320, true);
      Object.assign(m, { patternState: 'quake', patternTimer: 1500, _quakeFired: false, _quakeAnnounced: true, _stagger: 0, _staggerCd: 1e12, _dirOpenT: 0 }); return m; },
      { hold: (m) => { if (m && !m._quakeFired) { m.patternState = 'quake'; m._stagger = 0; m.x = player.x + 320; } }, ms: 6000 }));
    for (const [type, skill] of [['aetherion', 'maeshard'], ['kingKrook', null], ['aetherion', null]]) {
      res.push(await measure(`boss shot: ${type} ${skill || 'any'}`, lvB, async () => {
        const m = spawnAt(type, 520, true); if (m) { m._krookInit = true; m.evasion = 0; }
        const p = await firstShot(m, skill, 20000); if (!p) throw new Error('no ' + (skill || 'enemy') + ' shot in 20 s');
        game.monsters.length = 0; for (const q of game.projectiles.slice()) if (q !== p) game.projectiles.splice(game.projectiles.indexOf(q), 1);
        game.hazards.length = 0; L.drops.length = 0; L.nums.length = 0; player.invulnerable = 0; p.homing = false; onPlayer(p); return p; },
        { hold: (p) => onPlayer(p) }));
    }
    res.push(await measure('boss touch: kingKrook', lvB, () => { const m = spawnAt('kingKrook', 0, true); m._krookInit = true; m.x = player.x - 40; return m; },
      { hold: (m) => { if (m) { m.x = player.x - 40; m._stagger = 0; } } }));
    res.push(await measure('zodiac shot: taurus-tagged', lvB, () => { const p = { x: 0, y: 0, vx: 0.01, vy: 0, w: 12, h: 12, life: 120, damage: 400, owner: 'enemy', skill: 'mbolt', color: '#fff', _zodiacAttacker: true, _zodiacSign: 'taurus' };
      game.projectiles.push(p); onPlayer(p); return p; }, { hold: (p) => onPlayer(p) }));
    return { ver: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?', res };
  }, [LEVELS, MAXHP]);
  console.log('build', out.ver);
  for (const r of out.res) {
    if (r.err) { console.log(`NOTE ${r.label} @Lv${r.lvl}: ${r.err}`); continue; }
    ok(`${r.label} @Lv${r.lvl}: shown ${JSON.stringify(r.shown)} vs HP lost ${r.lost}`, r.fig === r.lost, `src=${r.src}`);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
if (pass < 20) { fail++; console.log('FAIL fewer than 20 hits were measured (' + pass + ') - the harness, not the game'); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
