// A Tower floor's goal counts the enemies that are actually there (v0.30.x tower-goal).
//   node scripts/tower_goal_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Bug hunt: B7's goal said "Defeat all 40 enemies (30 Shardlings + 10 Tomb Hexers)" while the on-screen ceiling spawned
// 36 on a desktop. The goal (pin + objective) now states what spawned; a floor that spawns its full roster reads as before.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11131';
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _startExpedition === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'archer'; player.level = 80;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; player.mojicoins = 1e6;
    _startExpedition(); await new Promise((s) => setTimeout(s, 2000)); try { closeAllModals(); } catch (e) {} game.paused = false;
  });
  const floor = (n) => p.evaluate(async (n) => {
    const id = 'tower_b' + n;
    game.expedition.floor = n; if (game.expedition._clearedFloors) delete game.expedition._clearedFloors[n];
    loadMap(id); await new Promise((s) => setTimeout(s, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    const cfg = MAPS[id]._towerFloor;
    const byType = {}; for (const m of game.monsters) if (m && !m.isBoss && !m.ally && m.currentHp > 0) byType[m.type] = (byType[m.type] || 0) + 1;
    const pin = document.querySelector('.eq-goal');
    return { id, authored: cfg.quest.goal, goal: game.expedition.currentQuest && game.expedition.currentQuest.goal, pin: pin ? pin.textContent : null, byType, total: Object.values(byType).reduce((a, b) => a + b, 0), roster: (cfg.spawns || []).map((s) => s.type) };
  }, n);
  const b7 = await floor(7);
  console.log('b7', JSON.stringify(b7));
  const want7 = new RegExp('Defeat all ' + b7.total + ' enemies \\(' + (b7.byType[b7.roster[0]] || 0) + ' Shardlings \\+ ' + (b7.byType[b7.roster[1]] || 0) + ' Tomb Hexers\\)');
  check(b7.total > 0 && b7.total < 40 && want7.test(b7.goal) && b7.pin && want7.test(b7.pin), 'B7 trimmed by the on-screen ceiling: the goal and the pin state the enemies that actually spawned (not 40)', b7);
  const b1 = await floor(1);
  console.log('b1', JSON.stringify(b1));
  check(b1.total === 30 && b1.goal === b1.authored, 'B1 spawns its full 30: its goal reads exactly as written', b1);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
