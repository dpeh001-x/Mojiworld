// Combat fixes from the bug hunt (v0.30.x combat-fixes).
//   node scripts/combat_fixes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// 1) a frozen or stunned mage can't double-tap-up warp (and a free one still can); 2) a stagger ends Siege Volley, as
// its description says; 3) the zombie's poison cloud lands at its feet, platform or floor.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10973';
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof MONSTER_SKILL_FNS === 'object', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 60;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500));
    window.__ticks = (n) => new Promise((res) => { const t0 = game.time; const go = () => (game.time - t0 >= n ? res() : setTimeout(go, 20)); go(); });
  });

  // 1) the double-tap-up warp under freeze / stun, and free
  const tap = async (setup) => {
    await p.evaluate(async (cc) => {
      game.monsters.length = 0; player.cls = 'mage'; player.job = null; player.master = null;
      player.x = 600; player.vx = 0; player.hp = getMaxHp(); player.mp = getMaxMp(); player.skillCooldowns = {}; player._castLockUntil = 0;
      player.frozenTimer = 0; player.stunTimer = 0;
      await new Promise((s) => setTimeout(s, 900));
      for (let i = 0; i < 60 && !player.onGround; i++) await new Promise((s) => setTimeout(s, 50));   // settle on the ground first
      window.__s = { y0: player.y, mp0: player.mp };
      if (cc === 'frozen') player.frozenTimer = 4000;
      if (cc === 'stunned') player.stunTimer = 4000;
    }, setup);
    await p.keyboard.press('ArrowUp'); await p.waitForTimeout(90); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150);
    const r = await p.evaluate(() => ({ dy: Math.round(player.y - window.__s.y0), mp: Math.round(window.__s.mp0 - player.mp), cd: Math.round(player.skillCooldowns.blink || 0) }));
    await p.evaluate(() => { player.frozenTimer = 0; player.stunTimer = 0; });
    return r;
  };
  const frozen = await tap('frozen'), stunned = await tap('stunned'), free = await tap('free');
  console.log('warp', JSON.stringify({ frozen, stunned, free }));
  check(frozen.dy > -40 && frozen.mp === 0 && frozen.cd === 0 && stunned.dy > -40 && stunned.mp === 0 && stunned.cd === 0, 'a frozen or stunned mage cannot double-tap-up warp (no rise, no MP, no cooldown)', { frozen, stunned });
  check(free.dy < -40 && free.mp > 0, 'a free mage still warps up on a double tap', free);

  // 2) Siege Volley and a stagger
  const vol = await p.evaluate(async () => {
    const s = SKILLS.ballista_volley; if (!s) return null;
    const run = async (stagger) => {
      game.monsters.length = 0; game.projectiles.length = 0;
      player.cls = s.cls; player.job = s.job || (s.master ? MASTERS[s.master].from : null); player.master = s.master || null; player.level = 60;
      player.x = 500; player.vx = 0; player.facing = 1; player.maxMp = 5000; player.hp = getMaxHp(); player.mp = getMaxMp(); player.skillCooldowns = {}; player._castLockUntil = 0; player.hitStun = 0;
      game._tutorialSpawn = true; spawnMonster(800, player.y, 'mushroom'); game._tutorialSpawn = false;
      const m = game.monsters[game.monsters.length - 1]; m.maxHp = m.currentHp = 1e7; m.atk = 0;
      castSkill('ballista_volley');
      await __ticks(40);
      const before = !!player._ballistaChannel;
      if (stagger) player.hitStun = 400;
      await __ticks(12);
      const after = !!player._ballistaChannel;
      player._ballistaChannel = null; player.hitStun = 0;
      return { before, after };
    };
    return { staggered: await run(true), calm: await run(false) };
  });
  console.log('volley', JSON.stringify(vol));
  check(vol && vol.staggered.before && !vol.staggered.after, 'a stagger ends Siege Volley (it used to only pause it)', vol);
  check(vol && vol.calm.before && vol.calm.after, 'with no stagger the volley keeps channelling', vol);

  // 3) the zombie's poison cloud, up on a platform and on the floor
  const cloud = await p.evaluate(() => {
    const at = (feet) => {
      game.hazards.length = 0; game.monsters.length = 0;
      game._tutorialSpawn = true; spawnMonster(700, 300, 'zombie'); game._tutorialSpawn = false;
      const m = game.monsters[game.monsters.length - 1]; m.y = feet - m.h;
      MONSTER_SKILL_FNS.poisonCloud(m);
      const h = game.hazards.find((z) => z.type === 'mob_poisoncloud');
      return h ? { top: h.y, bottom: h.y + h.h, feet } : null;
    };
    return { platform: at(302), floor: at(480) };
  });
  console.log('cloud', JSON.stringify(cloud));
  check(cloud.platform && cloud.platform.top <= cloud.platform.feet && cloud.platform.bottom >= cloud.platform.feet, 'a zombie on a platform drops its poison cloud at its own feet', cloud.platform);
  check(cloud.floor && cloud.floor.top === 470, 'a zombie on the floor still drops it where it always did (y 470)', cloud.floor);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
