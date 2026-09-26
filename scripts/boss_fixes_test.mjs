// Boss fixes from the second bug hunt (v0.30.x boss-fixes).
//   node scripts/boss_fixes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// 1) Libra's adds die with her; 2) re-entering an arena inside its respawn window plays no intro card (and it plays
// again once the boss is back); 3) stepping out through the exit portal right after a kill still gets the boon wheel.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11071';
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 100;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  const ticks = async (n, maxMs = 60000) => { const t0 = await p.evaluate(() => game.time); await p.waitForFunction((t) => game.time >= t, t0 + n, { timeout: maxMs, polling: 100 }).catch(() => {}); };
  const killBoss = async (onPortal) => {
    for (let i = 0; i < 400; i++) {
      const r = await p.evaluate((onPortal) => {
        player.hp = player.maxHp;
        const b = game.monsters.find((m) => m.isBoss && m.currentHp > 0); if (!b) return 'dead';
        if (onPortal) { const po = game.portals[0]; player.x = po.x - player.w / 2; player.y = _defaultPortalY(po.x) - player.h; player.vx = 0; player.vy = 0; }
        else { const f = (b.facing || 1) > 0 ? 1 : -1; player.x = b.x + b.w / 2 - f * (b.w / 2 + 50) - player.w / 2; player.y = b.y + b.h - player.h; }
        hitMonster(b, Math.ceil(b.maxHp * (onPortal && b.currentHp / b.maxHp <= 0.25 ? 1 : 0.2)), false, null);
        return b.currentHp > 0 ? 'go' : 'dead';
      }, onPortal);
      if (r === 'dead') return i;
      await p.evaluate(() => { if (game.paused && !_anyOtherModalOpen()) game.paused = false; window.__orbMax = Math.max(window.__orbMax || 0, game.monsters.filter((m) => m._libraOrb && m.currentHp > 0).length); });
      await ticks(onPortal ? 4 : 6, 8000);
    }
    return -1;
  };

  // 1) Libra
  await p.evaluate(() => { delete game.bossDefeated.zod_libra; player._god = true; window.__orbMax = 0; loadMap('zod_libra'); });
  await p.waitForTimeout(5000);
  const it = await killBoss(false);
  await p.waitForTimeout(2500);
  await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; player._god = false; player.maxHp = Math.max(player.maxHp, 1e7); player.hp = player.maxHp; window.__hp0 = player.hp; });
  await ticks(150, 30000);
  const L = await p.evaluate(() => ({ orbsSeen: window.__orbMax, orbsLeft: game.monsters.filter((m) => m._libraOrb).length, lost: Math.round(window.__hp0 - player.hp) }));
  console.log('libra', it, JSON.stringify(L));
  check(it >= 0 && L.orbsSeen > 0 && L.orbsLeft === 0 && L.lost <= 0, "Libra's lanterns and stormcallers die with her - none left, no damage after", L);
  await p.evaluate(() => { player._god = true; });

  // 2) re-entry inside the respawn window, then after it
  const intro = () => p.evaluate(() => { const o = document.getElementById('boss-intro-overlay'); return { on: !!(o && o.classList.contains('on')), bosses: game.monsters.filter((m) => m.isBoss && m.currentHp > 0).length }; });
  await p.evaluate(() => { delete game.bossDefeated.slimeCave; loadMap('slimeCave'); });
  await p.waitForTimeout(4500);
  await killBoss(false);
  await p.waitForTimeout(2500);
  await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; loadMap((game.mapData.portals[0] || {}).dest || 'town'); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => loadMap('slimeCave'));
  let sawCard = false;
  for (let k = 0; k < 8; k++) { await p.waitForTimeout(400); const s = await intro(); if (s.on) sawCard = true; }
  await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; loadMap((game.mapData.portals[0] || {}).dest || 'town'); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { game._playMs = (game._playMs || 0) + 10 * 60 * 1000 + 5000; loadMap('slimeCave'); });
  let backCard = false, backBoss = 0;
  for (let k = 0; k < 8; k++) { await p.waitForTimeout(400); const s = await intro(); if (s.on) backCard = true; backBoss = Math.max(backBoss, s.bosses); }
  console.log('reentry', JSON.stringify({ sawCard, backCard, backBoss }));
  check(!sawCard, 'no intro card when re-entering an arena whose boss is dead and still on its respawn window', { sawCard });
  check(backCard && backBoss === 1, 'once the boss is back, its intro card plays as before', { backCard, backBoss });
  await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });

  // 3) the boon wheel after stepping out right after the kill
  await p.evaluate(() => { const b = game.monsters.find((m) => m.isBoss); if (b) { b.currentHp = 0; } delete game.bossDefeated.slimeCave; loadMap('town'); });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { delete game.bossDefeated.slimeCave; loadMap('slimeCave'); });
  await p.waitForTimeout(4500);
  await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  await killBoss(true);
  await p.waitForTimeout(400);
  const exit = await p.evaluate(() => { const r = tryPortal(); return { used: r, map: game.currentMap }; });
  await p.waitForTimeout(3500);
  const W = await p.evaluate(() => ({ map: game.currentMap, wheel: getComputedStyle(document.getElementById('powerup-modal')).display }));
  console.log('boon', JSON.stringify({ exit, W }));
  check(exit.map !== 'slimeCave' && W.wheel !== 'none', 'stepping out through the exit portal right after the kill still opens the boon wheel (it used to be lost)', { exit, W });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
