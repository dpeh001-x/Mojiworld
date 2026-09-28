// EVERY COLUMN STRIKE WARNS WITH ITS OWN PILLAR. Per user, after the ten column-strike beams were redrawn: "make the
// telegraph warning art for these columns match too", and (asked whether the non-boss casters should get one) "Add
// warning pillars". The zone telegraph marked boss columns only; the non-boss casters (Path's Bane, Archon, the Tomb
// Hexer, Blight Elder, the Ossuary Tyrant, the Tomb Wraith) fired with nothing but rising particles. Driven in the
// running game:
//   - COVERAGE: every monster type that casts a column has its own registered warning art (LX_FX['tg_col_' + type])
//   - MARKED: a NON-boss caster (Path's Bane) marks its windup with a column zone carrying his warning, which decodes
//   - IT CLEARS: the zone is gone once the pillar falls
//   [PORT=13886] node scripts/col_warning_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '13886'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxAttackZones === 'function' && typeof LX_FX !== 'undefined', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._tutorialSeen = true; applyClass('warrior'); player.level = 90;
  try { _lxBootHold.release('menu'); } catch (e) {}
  // COVERAGE - every column caster the game defines (zodiac types are synthesised at boot, so read the runtime table)
  const casters = Object.keys(monsterTypes).filter((t) => monsterTypes[t] && monsterTypes[t].traits && monsterTypes[t].traits.columnStrike);
  const missing = casters.filter((t) => !LX_FX['tg_col_' + t]);
  // MARKED - a non-boss caster's windup
  loadMap('forest', 300); await W8(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
  player._god = true; player.invulnerable = 9e9; game.monsters.length = 0;
  const m = spawnMonster(player.x + 300, player.y - 100, 'pathsBane', false);
  if (m.traits.bigMelee) m.traits.bigMelee = Object.assign({}, m.traits.bigMelee, { cdMs: 9e9 }); m._bmCd = 9e9;
  if (m.traits.hourglassCharge) m._hgCd = 9e9; m.shootTimer = -9e9;
  try { _lxFxWant('fx:tg_col_pathsBane', true); } catch (e) {}
  m._columnCd = 0;
  let zone = null, fired = false, started = false, t0 = performance.now();
  while (performance.now() - t0 < 15000) {
    await new Promise((r) => requestAnimationFrame(r));
    if (m._columnFiring) started = true;
    const z = _lxAttackZones().find((q) => q.kind === 'column');
    if (z && !zone) zone = { tg: z.tg, prog: z.prog, w: z.w };
    if (started && !m._columnFiring) { fired = true; break; }
  }
  await W8(100);
  const after = _lxAttackZones().filter((q) => q.kind === 'column').length;
  for (let i = 0; i < 60 && !_lxFxReady(LX_FX.tg_col_pathsBane); i++) await W8(100);
  return { casters, missing, isBoss: !!(m.isBoss || m.boss), started, zone, fired, after, ready: _lxFxReady(LX_FX.tg_col_pathsBane), nat: LX_FX.tg_col_pathsBane ? LX_FX.tg_col_pathsBane.naturalWidth : 0 };
});
console.log(JSON.stringify(R));
check(R.casters.length >= 10 && R.missing.length === 0, `COVERAGE: all ${R.casters.length} column casters have their own warning art`, { missing: R.missing });
check(R.isBoss === false && R.started && !!R.zone && R.zone.tg === 'tg_col_pathsBane', 'MARKED: a non-boss caster (Path\'s Bane) marks his windup with his own warning pillar', R.zone);
check(R.ready && R.nat > 0, 'his warning art decodes', { ready: R.ready, naturalWidth: R.nat });
check(R.fired && R.after === 0, 'IT CLEARS: the zone is gone once the pillar falls', { fired: R.fired, zonesAfter: R.after });
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
