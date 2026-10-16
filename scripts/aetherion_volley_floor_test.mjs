// AETHERION'S VOLLEYS (v0.30.1796, per user: "reduce aetherion damage slightly it is abit too hard after the patched that buffed it").
// His shots all carry his key, so each landed one - the Shard Lance, but also every Fallen Feather of a five-seven fan, every Scale dart and every Halo Disc
// added by the v0.30.1721 boost - was worth 25% of the bar (LX_BOSS_HIT_FLOOR.aetherion). The lance stays at the quarter-bar the user asked for; the
// three volley shots now carry their own floor (_hitFloor 0.15, the one Krook and Octobaby use).
//   1. the table is untouched: Aetherion 0.25 and the Shard Lance still lands at least a quarter of the bar, end to end
//   2. _lxBossHpFloor takes a per-shot floor, raise-only, and falls back to the table without one
//   3. Fallen Feather, Scale dart and Halo Disc carry _hitFloor 0.15; the lance carries none
//   4. a landed feather and a landed scale dart cost 15-25% of max HP, end to end through the real projectile path
//   5. god mode still takes nothing; no page errors
//   node scripts/aetherion_volley_floor_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11899), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof tickQuestUnlocks === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.job = null; player._tutorialSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    player.level = 60; loadMap('forest', 300); await sleep(2500); game.paused = false;
    const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
    try { _lxCineHold(0); } catch (e) {}
    player.x = 700; player.y = 300; player._god = false;
    // a Lv-60 bar (the 292 an ungeared Lv-1 build keeps lets the raw band kill in one hit, so the floor never decides anything): the game's own bar of a geared warrior is ~32k
    const _gmh = getMaxHp; window.getMaxHp = function () { return 32000; }; player.maxHp = 32000; player.hp = 32000;
    const BAR = getMaxHp(); out.bar = BAR;
    const boss = spawnMonster(player.x + 260, player.y - 20, 'aetherion', true); out.boss = !!boss;
    // 1/2. the table, the override
    out.table = LX_BOSS_HIT_FLOOR.aetherion; out.tableFloor = _lxBossHpFloor('aetherion', 1); out.wantTable = Math.floor(BAR * 0.25);
    out.over = _lxBossHpFloor('aetherion', 1, 0.15); out.wantOver = Math.floor(BAR * 0.15);
    out.raiseOnly = [1, 50, out.wantOver - 1, out.wantOver, out.wantOver * 4, 99999].every((d) => _lxBossHpFloor('aetherion', d, 0.15) >= d);
    out.noOverrideIsTable = _lxBossHpFloor('aetherion', 1, 0) === out.tableFloor && _lxBossHpFloor('aetherion', 1, undefined) === out.tableFloor;
    out.stranger = _lxBossHpFloor('snail', 7) === 7;
    // 3. which shots carry the override
    const grab = (fn) => { game.projectiles.length = 0; fn(); return game.projectiles[game.projectiles.length - 1] || null; };
    const ang = 0;
    const f = grab(() => _aeFeather(boss, 2, 5)), s = grab(() => _aeScale(boss, ang)), h = grab(() => _aeHalo(boss, ang)), l = grab(() => _aeLance(boss, ang, 6, 1.0, 0.45));
    out.carry = { feather: f && f._hitFloor, scale: s && s._hitFloor, halo: h && h._hitFloor, lance: l && l._hitFloor };
    out.srcKept = [f, s, h, l].every((p) => p && p._srcType === 'aetherion');
    // 4. landed hits, through the real projectile path
    const land = async (make, skill, { god = false } = {}) => {
      game.projectiles.length = 0; game.monsters = game.monsters.filter((m) => m === boss);
      for (let i = 0; i < 150 && !(player.onGround && Math.abs(player.vx) < 0.2 && (player.hitStun | 0) <= 0); i++) await sleep(20);
      player.hp = getMaxHp(); player._god = god; player.blockTimer = 0; player.invulnerable = 0; player.dodgeTimer = 0;
      const hp0 = player.hp; make();
      for (let i = 0; i < 400; i++) { if (!game.projectiles.some((z) => z.skill === skill) || (hp0 - player.hp) > 0) break; await sleep(16); }
      await sleep(60);
      const lost = hp0 - player.hp; player._god = false; player.invulnerable = 0; player.hp = getMaxHp();
      return { lost, pct: +(100 * lost / getMaxHp()).toFixed(1) };
    };
    const aim = () => Math.atan2((player.y + player.h / 2) - (boss.y + boss.h / 2), (player.x + player.w / 2) - (boss.x + boss.w / 2));
    out.godly = await land(() => _aeScale(boss, aim()), 'maescale', { god: true });
    out.featherHit = await land(() => _aeFeather(boss, 2, 5), 'maefeather');
    out.scaleHit = await land(() => _aeScale(boss, aim()), 'maescale');
    out.lanceHit = await land(() => _aeLance(boss, aim(), 6, 1.0, 0.45), 'maeshard');
    return out;
  });
  ok('Aetherion is in the arena', R.boss === true);
  ok('1a. his table floor is unchanged: a quarter of the bar', R.table === 0.25 && R.tableFloor === R.wantTable, R.tableFloor + ' of a ' + R.bar + ' bar (want ' + R.wantTable + ')');
  ok('1b. the Shard Lance still lands at least 25% of max HP, end to end', R.lanceHit.pct >= 25, R.lanceHit);
  ok('2a. _lxBossHpFloor takes a per-shot floor (15% of the bar)', R.over === R.wantOver, R.over + ' (want ' + R.wantOver + ')');
  ok('2b. it only ever raises a hit, and falls back to the table without an override; nobody else gained a floor', R.raiseOnly && R.noOverrideIsTable && R.stranger, R);
  ok('3. Fallen Feather, Scale dart and Halo Disc carry _hitFloor 0.15; the lance carries none; all keep his key', R.carry.feather === 0.15 && R.carry.scale === 0.15 && R.carry.halo === 0.15 && !R.carry.lance && R.srcKept, R.carry);
  ok('4a. a landed Fallen Feather costs 15-25% of max HP (was 25%)', R.featherHit.pct >= 15 && R.featherHit.pct < 25, R.featherHit);
  ok('4b. a landed Scale dart costs 15-25% of max HP (was 25%)', R.scaleHit.pct >= 15 && R.scaleHit.pct < 25, R.scaleHit);
  ok('5. god mode still takes nothing', R.godly.lost <= 0, R.godly);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
