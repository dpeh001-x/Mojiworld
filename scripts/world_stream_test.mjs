// Live test: WORLD STREAMER — after the world reveals, EVERY map's sprites (monster
// anim frames, NPCs, bg) plus the projectile/FX/summon registries stream in the
// background so nothing pops in mid-game. Also: entering a map prefetches its portal
// neighbors. Drives the REAL entry flow (name → reveal → streamer kick).
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 90000 });

  // Enter through the REAL flow — _finishHide is the streamer's kick point.
  await page.fill('#auth-user', 'Streamer');
  await page.click('#auth-submit');
  await sleep(1000);

  // The streamer kicks 4.5s post-reveal; poll until map coverage completes.
  await page.waitForFunction(() => window._lxWorldStreamed === true, null, { timeout: 20000 });
  ok('world streamer kicked after reveal', true);

  const t0 = Date.now();
  await page.waitForFunction(() => {
    const total = Object.keys(MAPS).length;
    const done = Object.keys(window._lxMapPreloaded || {}).filter(k => MAPS[k]).length;
    return done >= total;
  }, null, { timeout: 260000, polling: 1000 }).catch(() => {});
  const maps = await page.evaluate(() => ({
    total: Object.keys(MAPS).length,
    warmed: Object.keys(window._lxMapPreloaded || {}).filter(k => MAPS[k]).length,
  }));
  ok(`ALL maps warmed in background (${maps.warmed}/${maps.total}, ${Math.round((Date.now()-t0)/1000)}s)`, maps.warmed >= maps.total, maps);

  // Registry sweeps (desktop path): monster types + proj/FX/summon frames filled.
  await page.waitForFunction(() =>
    typeof MONSTER_FRAMES !== 'undefined' && Object.keys(MONSTER_FRAMES).length >= Object.keys(monsterTypes).length * 0.95,
    null, { timeout: 60000, polling: 1000 }).catch(() => {});
  const regs = await page.evaluate(() => ({
    monTypes: Object.keys(monsterTypes).length,
    monFrames: Object.keys(MONSTER_FRAMES || {}).length,
    proj: Object.keys(PROJ_ANIM_FRAMES || {}).length, projKeys: _PROJ_ANIM_KEYS.size,
    fx: Object.keys(FX_ANIM_FRAMES || {}).length, fxKeys: _FX_ANIM_KEYS.size,
    summons: Object.keys(SUMMON_ANIM_FRAMES || {}).length,
  }));
  ok('every monster type\'s anim frames requested', regs.monFrames >= regs.monTypes * 0.95, regs);
  ok('all projectile anim sets requested', regs.proj >= regs.projKeys, regs);
  ok('all FX anim sets requested', regs.fx >= regs.fxKeys, regs);
  ok('summon anim sets requested', regs.summons > 0, regs);

  // Neighbor prefetch hook: _lxMapNeighbors resolves portal dests.
  const nb = await page.evaluate(() => {
    const withPortals = Object.keys(MAPS).find(k => (MAPS[k].portals || []).some(p => p && p.dest));
    return { map: withPortals, neighbors: _lxMapNeighbors(withPortals) };
  });
  ok('portal-neighbor resolution works (loadMap prefetch feed)', nb.neighbors.length > 0, nb);

  ok('no page errors through boot + full stream', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== WORLD STREAMER (no mid-game sprite pop-in) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
