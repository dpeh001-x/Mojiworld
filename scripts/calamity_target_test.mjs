// Calamity Incarnate condemns a target its fires can hurt.
// Per the 2026-09-26 full audit. Its pick is deliberately "boss first, then the biggest health pool", but it skipped only
// the dead - so it condemned a boss in an immune window, and all seven homing fires went into the immunity while adds
// that could be hit stood free (Gemini's Lie also answers every hit with DECEIVED: a slow and poison on the caster).
// Scenario: Gemini mid-Lie (immune) beside a hittable add. CONTROL: with the boss hittable, the boss is still chosen.
//   node scripts/calamity_target_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PORT = String(process.argv[3] || 9995);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS === 'object' && typeof SKILL_FNS.doombringer_ult === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'doombringer'; player.level = 90; player._god = true; player.invulnerable = 9e9;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  loadMap('forest', 300); game.paused = false; await sleep(1200);
  const toasts = []; const _st = window.showToast; window.showToast = function (t) { toasts.push(String(t)); return _st.apply(this, arguments); };
  const cast = async (lying) => {
    game.monsters.length = 0; game.projectiles.length = 0; toasts.length = 0;
    const boss = spawnMonster(player.x + 260, player.y - 60, 'zodiac_gemini', true);
    try { _dismissBossIntro(); } catch (e) {}
    const add = spawnMonster(player.x + 180, player.y - 20, 'slime', false);
    boss.currentHp = boss.maxHp = 5e7; add.currentHp = add.maxHp = 5e4;
    game.paused = false; await sleep(100);
    boss._geminiLying = !!lying; boss._geminiLyingUntil = lying ? (game.time | 0) + 99999 : 0;
    const _shots = []; const _push = game.projectiles.push; game.projectiles.push = function (...ps) { for (const p of ps) if (p && p.owner === 'player' && p.doomBrand) _shots.push(p.homing); return _push.apply(this, ps); };   // each fire's target, as it leaves
    SKILL_FNS.doombringer_ult();
    await sleep(800);
    game.projectiles.push = _push;
    const who = (toasts.find((t) => /CALAMITY INCARNATE/.test(t)) || '');
    return { toast: who.slice(0, 90), bossName: boss.name, addName: add.name,
      firesAtBoss: _shots.filter((t) => t === boss).length, firesAtAdd: _shots.filter((t) => t === add).length, fires: _shots.length };
  };
  const out = { lying: await cast(true) };
  await sleep(400);
  out.plain = await cast(false);
  window.showToast = _st;
  return out;
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
const names = (r, n) => r.toast.indexOf(n) >= 0;
ok(names(R.lying, R.lying.addName) && !names(R.lying, R.lying.bossName), 'with the boss immune (Gemini\'s Lie), the hittable add is condemned, not the boss', R.lying);
ok(R.lying.fires === 7 && R.lying.firesAtBoss === 0, '...and none of the seven fires is sent into the immunity', R.lying);
ok(names(R.plain, R.plain.bossName), 'CONTROL: a hittable boss is still condemned first (boss before the biggest pool, by design)', R.plain);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
