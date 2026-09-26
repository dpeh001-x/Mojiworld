// Streak guard (v0.30.x streak-guard): each login-streak milestone pays once per save; a Zodiac Sigil respects the Etc cap.
//   node scripts/streak_guard_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// The PC clock is moved the way a player would move it: Date.now() is offset by whole days (kept across the reload in
// sessionStorage), and each "day" is claimed through the real checkDaily(). Milestones are counted from their own toast.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11335';
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
  await p.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    // the PC clock, moved by whole days; survives the reload
    const _dn = Date.now.bind(Date);
    window.__lxOffMs = 0; try { window.__lxOffMs = (+(sessionStorage.getItem('__lxDayOff') || 0)) * 86400000; } catch (e) {}
    Date.now = () => _dn() + window.__lxOffMs;
    window.__setOff = (d) => { window.__lxOffMs = d * 86400000; try { sessionStorage.setItem('__lxDayOff', String(d)); } catch (e) {} };
  });
  const boot = async (fresh) => {
    await p.waitForFunction(() => typeof loadMap === 'function' && typeof checkDaily === 'function' && typeof killMonster === 'function', null, { timeout: 150000 });
    await p.evaluate(async (fresh) => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false;
      if (fresh) { player.cls = 'rogue'; player.level = 100; }
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
      loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
      player.invulnerable = 999999; game.monsters.length = 0;
      window.__toasts = []; const _st = window.showToast; window.showToast = function (t) { window.__toasts.push(String(t)); return _st.apply(this, arguments); };
      window.__frames = async (n) => { const t0 = game.time, w0 = performance.now(); while (game.time - t0 < n && performance.now() - w0 < 40000) await new Promise((s) => setTimeout(s, 40)); };
      window.__unblock = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; };
      // claim days a..b (clock offset in days), return how many milestone toasts fired and what they said
      window.__lap = (a, b) => { const t0 = __toasts.length; for (let d = a; d <= b; d++) { __setOff(d); checkDaily(); } const t = __toasts.slice(t0); return { miles: t.filter((x) => /-day streak! Milestone/.test(x)).map((x) => x.replace(/[^0-9a-z ,+!-]/gi, '').trim()), logins: t.filter((x) => /Daily login/.test(x)).length, streak: game.dailyState && game.dailyState.streak }; };
    }, fresh);
  };
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await boot(true);

  // 2) a Zodiac Sigil with a full Etc tab stays within the tab's cap
  const sigil = async (map, fill) => p.evaluate(async ([map, fill]) => {
    __unblock(); loadMap(map); const w0 = performance.now(); let m = null;
    while (!(m = game.monsters.find((x) => x && x.zodiacSign && x.isBoss)) && performance.now() - w0 < 40000) { await __frames(5); __unblock(); }
    if (!m) return { err: 'no zodiac boss on ' + map };
    player.invulnerable = 999999;
    const tab = (x) => _itemTab(x); const cap = player.invCap.etc;
    player.inventory = (player.inventory || []).filter((x) => x && tab(x) !== 'etc');
    if (fill) for (let i = 0; i < cap; i++) player.inventory.push({ name: 'Test Pebble ' + i, type: 'etc', icon: 'o', rarity: 'common' });
    const before = player.inventory.filter((x) => tab(x) === 'etc').length;
    const t0 = __toasts.length; m.currentHp = 0; killMonster(m); await __frames(3); __unblock();
    const etc = player.inventory.filter((x) => tab(x) === 'etc');
    return { cap, before, after: etc.length, bagged: etc.some((x) => x.zodiacSigil), dropped: (game.drops || []).some((d) => d && d.item && d.item.zodiacSigil), fillerTab: tab({ type: 'etc' }), told: __toasts.slice(t0).some((t) => /Sigil obtained!.*dropped at your feet/.test(t)) };
  }, [map, fill]);
  const sf = await sigil('zod_aries', true);
  check(sf.fillerTab === 'etc' && sf.before === sf.cap && sf.after <= sf.cap && !sf.bagged && sf.dropped && sf.told, 'a Zodiac Sigil won with a full Etc tab drops at your feet (and the toast says so) instead of going past the last slot', sf);
  const sr = await sigil('zod_taurus', false);
  check(sr.bagged && !sr.dropped && sr.after === sr.before + 1, 'with room in the Etc tab the sigil still goes straight into the bag', sr);
  await p.evaluate(() => { player.inventory = player.inventory.filter((x) => !(x && /^Test Pebble/.test(x.name))); __unblock(); loadMap('mushroom'); });

  // 1) two clock-forward laps with a reload between them
  await p.evaluate(() => { delete game.dailyState; delete game._dailyClockHealed; delete game._dailyMilesPaid; delete game._dailyBestStreak; __setOff(0); game._timeHW = Date.now(); });
  const lapA = await p.evaluate(() => __lap(1, 100));
  check(lapA.miles.length === 4 && lapA.streak === 100, 'lap 1: a 100-day streak pays the 14 / 30 / 60 / 100-day milestones once each', lapA);
  const heal = await p.evaluate(async () => { __setOff(0); checkDaily(); const r = { day: game.dailyState.day, today: dailyIndex(), streak: game.dailyState.streak }; _flushSaveStateNow(); return r; });
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await boot(false);
  const after = await p.evaluate(() => ({ cls: player.cls, streak: game.dailyState && game.dailyState.streak, day: game.dailyState && game.dailyState.day, today: dailyIndex(), paid: Object.keys(game._dailyMilesPaid || {}).sort((a, b) => a - b) }));
  check(after.cls === 'rogue' && after.streak === 100 && after.day === after.today && heal.day === heal.today, 'the clock set back is healed to today, and the save round-trips the reload', { heal, after });
  const lapB = await p.evaluate(() => __lap(2, 101));
  check(lapB.miles.length === 0 && lapB.streak === 100, 'lap 2 (after the heal and a reload): walking the streak to 100 again pays no milestone', lapB);
  check(after.paid.join(',') === '14,30,60,100', 'the paid milestones are in the save and survive the reload', after);
  // a real next day still pays its daily login bonus
  const next = await p.evaluate(() => { const c0 = player.mojicoins; const r = __lap(102, 102); return Object.assign(r, { coins: player.mojicoins - c0 }); });
  check(next.logins === 1 && next.streak === 101 && next.coins > 0, 'a genuine next-day claim still pays the daily login bonus (streak 101)', next);
  // a save from before the ledger that had already passed 14 days is not paid 14 again
  const old = await p.evaluate(() => { delete game._dailyMilesPaid; delete game._dailyBestStreak; game.dailyState.streak = 20; const r = __lap(104, 117); return r; });
  check(old.miles.length === 0 && old.streak === 14, 'an older save whose streak had already passed 14 days is not paid the 14-day bonus again', old);
  // ...but a first 14-day streak still pays it
  const first = await p.evaluate(() => { delete game._dailyMilesPaid; delete game._dailyBestStreak; game.dailyState.streak = 13; return __lap(118, 118); });
  check(first.miles.length === 1 && first.streak === 14, 'a first-ever 14-day streak still pays its milestone', first);
  await p.evaluate(() => __setOff(0));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
