// The death screen names the monster or boss that felled you - never a shot's sprite key or an attack label.
//
// Per user: "when killed do not say felled by msplinter or the projectile it should always be the monster or boss name".
// The screen printed player._lastDamageSource as written: a warrior killed by Mirror Self read "felled by msplinter" (the
// shard the Mirror throws), a Tomb Keeper's shot the same, contact the monster's label or type id. player._lastKiller now
// names what dealt the hit (see _lxResolveKiller). Each case runs a fresh warrior in its own page:
//   1. a Tomb Keeper's msplinter shots (the shard Mirror Self throws for a warrior) carry its name, and a hit names it;
//   2. a death in a Tomb Keeper fight on the Emerald Thicket -> "felled by Tomb Keeper" (or the hound it summons);
//   3. a touch by the Thicket's own first monster names it (an elite keeps its prefix: "Volatile Elite Slippy");
//   4. labels written outside any monster's turn: a boss attack names the boss, a type id and a shot's sprite key name
//      the monster, a status tick names the monster that last hit you, a pothole keeps its words, and with a boss on
//      the map an attack named without it ("the Sun Pounce") names the boss;
//   5. the label itself is left as written (the pothole icon reads it).
// The build before fails 1-4 (8 of the 10 checks).   node scripts/killer_name_test.mjs   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11743), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const boot = async () => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 30; }
    player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
  });
  return { ctx, page };
};
// run a setup in a fresh page, drop the hero to 1 HP and wait for the death screen
// a setup may set window._lxTestHold to a type id: each poll then stands the hero against that monster, with a lethal
// attack (death cases - a knockback can part a slow monster from the hero for good, and a weak touch can deal 0)
const liveKill = async (setup) => {
  const { ctx, page } = await boot();
  try {
    const pre = await page.evaluate(setup);
    const t0 = Date.now(); let r = null;
    while (Date.now() - t0 < 40000) {
      r = await page.evaluate(() => { const el = document.getElementById('death-slain'), ov = document.getElementById('death-overlay'), hold = window._lxTestHold;
        if (hold) { const live = () => (game.monsters || []).find((q) => q && q.type === hold && q.currentHp > 0); let m = live();
          if (!m && player.hp > 0) { spawnMonster(player.x, player.y + player.h - 60, hold, false); m = live(); }   // a weak monster can die on the hero - bring another
          if (m) m.atk = Math.max(m.atk || 0, 100000);   // a weak monster's touch can round to 0 on a level-30 hero (DR, level gap): make it lethal
          if (m && player.hp > 0) { player.x = m.x + m.w / 2 - player.w / 2; player.y = m.y + m.h - player.h; player.vx = 0; player.vy = 0; } }
        try { player._god = false; if (player.hp > 1) player.hp = 1; player.invulnerable = 0; game.paused = false; } catch (e) {}
        return { on: !!(ov && ov.classList.contains('on')), slain: el && !el.hidden ? el.textContent : null, label: player._lastDamageSource, killer: player._lastKiller, hp: player.hp, map: game.currentMap }; });
      if (r.on && r.slain) break;
      await new Promise((res) => setTimeout(res, 400));
    }
    return { pre, ...r };
  } finally { await ctx.close(); }
};
try {
  // 1. the shots a monster makes on its turn carry its name, and a hit by one names it (Tomb Keeper: msplinter, the
  //    shard Mirror Self also throws for a warrior) - with the hero kept alive, so the hit itself is read
  {
    const { ctx, page } = await boot();
    const A = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      loadMap('forest', 400); for (let i = 0; i < 10; i++) { await sleep(200); game.monsters.length = 0; }
      const g = game.mapData.platforms.find((p) => p.type === 'ground');
      spawnMonster(player.x + 360, (g ? g.y : 480) - 140, 'tombKeeper', false);
      const tk = game.monsters.find((q) => q.type === 'tombKeeper'), want = tk && (tk.name || '').split(', ')[0];
      // the first shard hit is caught as it is written (a melee hit in the same poll would overwrite the label unseen)
      const d0 = Object.getOwnPropertyDescriptor(player, '_lastDamageSource') || {}; let v0 = player._lastDamageSource, hit = null;
      Object.defineProperty(player, '_lastDamageSource', { configurable: true, enumerable: true,
        get() { return d0.get ? d0.get.call(player) : v0; },
        set(v) { if (d0.set) d0.set.call(player, v); else v0 = v; if (v === 'msplinter' && !hit) hit = { label: v, killer: player._lastKiller }; } });
      player._lastDamageSource = ''; const t0 = performance.now(); let shot = null;
      while (performance.now() - t0 < 30000 && !(shot && hit)) {
        try { for (const q of game.monsters.slice()) if (q && q !== tk) q.currentHp = 0;
          player._god = false; player.hp = player.maxHp || getMaxHp(); if (player.invulnerable > 30) player.invulnerable = 0; game.paused = false; } catch (e) {}
        const p = (game.projectiles || []).find((q) => q && q.skill === 'msplinter' && q.owner === 'enemy');
        if (p && !shot) shot = { by: p._lxBy === undefined ? '(unset)' : p._lxBy };
        // the hero stands in the Keeper's shooting band (240 px off: outside its melee, inside its 90-380 px shot range) and
        // a live shard is brought onto the hero - chasing a shard with the hero landed about one hit in twenty on either
        // build. The hit is still the projectile loop's own (aabb, then the label), with the dodge roll and a parry off.
        if (p && !hit) { player.invulnerable = 0; player.parryWindow = 0; p._noEvasion = true; p.x = player.x + player.w / 2 - (p.w || 20) / 2; p.y = player.y + player.h / 2 - (p.h || 20) / 2; }
        if (tk && !(p && !hit)) {
          const kx = tk.x + tk.w / 2, side = kx > 420 ? -1 : 1; player.x = kx + side * 240 - player.w / 2; player.vx = 0;
          if (!p && !(tk._shootWindup > 0) && tk.shootTimer > 0 && tk.shootTimer < 999999) tk.shootTimer = 0;   // and let it shoot (again after a shard that did not land)
        }
        await sleep(50);
      }
      return { want, shot, hit };
    });
    await ctx.close();
    ok('a shot a monster fires on its turn carries its name', !!A.shot && !!A.want && A.shot.by === A.want, A);
    ok('a hit by that shot names the monster, not msplinter (the label stays msplinter)', !!A.hit && A.hit.killer === A.want && A.hit.label === 'msplinter', A);
  }
  // 2. a death in a Tomb Keeper fight (the hero held on the Keeper: shard, smash or its hound, whichever lands first)
  const B = await liveKill(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    loadMap('forest', 400); for (let i = 0; i < 10; i++) { await sleep(200); game.monsters.length = 0; }
    const g = game.mapData.platforms.find((p) => p.type === 'ground');
    spawnMonster(player.x + 300, (g ? g.y : 480) - 140, 'tombKeeper', false);
    window._lxTestHold = 'tombKeeper'; player.hp = 1;
    return { tk: game.monsters.filter((q) => q.type === 'tombKeeper').length, shoot: (game.monsters.find((q) => q.type === 'tombKeeper') || {}).shoot };
  });
  // (a 3% elite roll prefixes the nameplate - "Volatile Elite Tomb Keeper" - and that full name is the monster's name too)
  ok("death by a Tomb Keeper's fight names the monster (the Keeper, or the hound it summons) - never a sprite key or type id", B.on && /^felled by (?:[A-Z][A-Za-z' -]* )?(?:Tomb Keeper|Sepulchre Hound)$/.test(B.slain || '') && !/msplinter|sepulchreHound|tombKeeper/.test(B.slain || ''), B);
  // 3. contact with the Thicket's first monster: the first touch is caught as it is written (the hero kept alive - a weak
  //    monster's touch can round to 0 on a level-30 hero, so waiting for a death was a coin toss; case 2 reads the screen)
  const C = await (async () => {
    const { ctx, page } = await boot();
    try {
      return await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        loadMap('forest', 400); for (let i = 0; i < 10; i++) { await sleep(200); game.monsters.length = 0; }
        const t = MAPS.forest.spawns[0].type, g = game.mapData.platforms.find((p) => p.type === 'ground');
        const live = () => game.monsters.find((q) => q && q.type === t && q.currentHp > 0);
        const d0 = Object.getOwnPropertyDescriptor(player, '_lastDamageSource') || {}; let v0 = player._lastDamageSource, hit = null;
        Object.defineProperty(player, '_lastDamageSource', { configurable: true, enumerable: true,
          get() { return d0.get ? d0.get.call(player) : v0; },
          set(v) { if (d0.set) d0.set.call(player, v); else v0 = v; const m = live(); if (!hit && (v === t || (m && m.label && v === m.label))) hit = { label: v, killer: player._lastKiller }; } });
        spawnMonster(player.x, (g ? g.y : 480) - 60, t, false);
        const t0 = performance.now();
        while (performance.now() - t0 < 30000 && !hit) {
          let m = live(); if (!m) { spawnMonster(player.x, player.y + player.h - 60, t, false); m = live(); }   // a weak monster can die on the hero
          if (m) { player.x = m.x + m.w / 2 - player.w / 2; player.y = m.y + m.h - player.h; player.vx = 0; player.vy = 0; }
          try { player._god = false; player.hp = player.maxHp || getMaxHp(); player.invulnerable = 0; game.paused = false; } catch (e) {}
          await sleep(50);
        }
        return { type: t, name: monsterTypes[t] && monsterTypes[t].name, hit };
      });
    } finally { await ctx.close(); }
  })();
  const cName = String(C.name || '?').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  ok('contact with a monster names it', !!C.hit && new RegExp("^(?:[A-Z][A-Za-z' -]* )?" + cName + '$').test(C.hit.killer || '') && C.hit.killer !== C.type, C);
  // 4 + 5. labels written outside any monster's turn
  const { ctx, page } = await boot();
  const D = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    loadMap('forest', 400); for (let i = 0; i < 8; i++) { await sleep(200); game.monsters.length = 0; }
    const g = game.mapData.platforms.find((p) => p.type === 'ground');
    spawnMonster(player.x + 600, (g ? g.y : 480) - 140, 'tombKeeper', false);
    const put = (v) => { player._lastDamageSource = v; return { label: player._lastDamageSource, killer: player._lastKiller }; };
    out.boss = put("King Krook's Tyrant's Stomp");
    out.type = put('tombKeeper');
    out.sprite = put('msplinter');
    out.tick = put('a poison DOT');
    out.pothole = put('a pothole');
    const tk = game.monsters.find((q) => q.type === 'tombKeeper'); if (tk) tk.isBoss = true;   // now a boss on the map
    out.unnamed = put('the Sun Pounce');
    out.pothole2 = put('a pothole');
    return out;
  });
  await ctx.close();
  const kk = (D.boss || {}).killer;
  ok('a boss attack written outside its turn names the boss', kk === 'King Krook', D.boss);
  ok('a type id and a shot sprite key name the monster', (D.type || {}).killer === 'Tomb Keeper' && /Tomb Keeper$/.test((D.sprite || {}).killer || ''), { type: D.type, sprite: D.sprite });
  ok('a status tick names the monster that last hit you; a pothole keeps its words', /Tomb Keeper$/.test((D.tick || {}).killer || '') && (D.pothole || {}).killer === 'a pothole', { tick: D.tick, pothole: D.pothole });
  ok('an attack named without its boss names the boss on the map; a pothole still keeps its words', /Tomb Keeper$/.test((D.unnamed || {}).killer || '') && (D.pothole2 || {}).killer === 'a pothole', { unnamed: D.unnamed, pothole2: D.pothole2 });
  ok('the label itself is left as written (the pothole icon reads it)', (D.pothole || {}).label === 'a pothole' && (D.sprite || {}).label === 'msplinter', { pothole: D.pothole, sprite: D.sprite });
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
