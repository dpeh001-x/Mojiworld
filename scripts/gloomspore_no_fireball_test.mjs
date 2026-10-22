// Gloomspore Verge drops no fireballs (v0.30.x gloomspore-no-fireball).
//   node scripts/gloomspore_no_fireball_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "gloomspore maps should not have fireballs, remove it". The Verge's ceiling hazard (a "spore-pod" drizzle) was a
// meteor_warn, which draws the red meteor sprite, so a molten fireball fell every 4.5-7.5 s. This visits every Gloomspore map,
// lets the clock run naturally and then keeps forcing the map-event timer (the speed-up: on a map with a ceiling hazard each
// forced tick drops one at once; on a map without one the timer stays unset), and records every falling-meteor hazard that
// appears (a meteor_warn that is not a ground rune, a ground eruption or a spore burst). Lava Cavern is the control: it must
// still erupt. Frames are counted in game.time with a wall-clock guard (headless runs ~11-17 fps).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11811';
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof updateMapEvents === 'function' && typeof MAPS === 'object', null, { timeout: 150000 });
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 95;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
  });

  // every Gloomspore map, found by id or name (today: gloomsporeVerge)
  const gloom = await p.evaluate(() => Object.keys(MAPS).filter((k) => /gloomspore/i.test(k) || /gloomspore/i.test((MAPS[k] && MAPS[k].name) || '')));
  check(gloom.length >= 1 && gloom.includes('gloomsporeVerge'), 'Gloomspore maps found', gloom);
  for (const id of gloom) {
    const cfg = await p.evaluate((id) => ({ ceil: !!MAPS[id].ceilingHazards, lava: !!MAPS[id].lavaEruptions }), id);
    check(!cfg.ceil && !cfg.lava, `${id}: no ceiling / lava hazard in its map table`, cfg);
  }
  // the rest of the Verge is unchanged
  const verge = await p.evaluate(() => { const m = MAPS.gloomsporeVerge; return { lv: m.levelReq, w: m.worldWidth, plats: (m.platforms || []).length,
    spawns: (m.spawns || []).map((s) => s.type).sort().join(','), portal: (m.portals || []).some((q) => q.dest === 'thornspireThicket'), bg: m.bg }; });
  check(verge.lv === 62 && verge.w === 2800 && verge.plats >= 20 && verge.portal && verge.bg === 'gloomsporeVerge'
    && verge.spawns === 'blightElder,elderbark,meloncholy,pinechad,thornmaw', 'Gloomspore Verge keeps its level, layout, portal, art and roster', verge);

  // visit a map: natural frames, then frames with the map-event timer forced to fire; count falling meteors
  const visit = (id, natural, forced) => p.evaluate(async ({ id, natural, forced }) => {
    loadMap(id); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    for (const k of ['loading-overlay']) { const o = document.getElementById(k); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    player.invulnerable = 999999; player.hp = getMaxHp(); game.monsters.length = 0; game.paused = false;
    const seen = new WeakSet(); const out = { natural: 0, forced: 0, labels: [], frames: 0, forcedTicks: 0 };
    let phase = 'natural', stop = false;
    const falling = (h) => h && h.type === 'meteor_warn' && !h._fireColumn && !h._markerOnly && !h._aquaFlood && !h._spore;
    const scan = () => { for (const h of game.hazards || []) if (falling(h) && !seen.has(h)) { seen.add(h); out[phase]++; if (out.labels.length < 6) out.labels.push(h._sourceLabel || '?'); } if (!stop) requestAnimationFrame(scan); };
    requestAnimationFrame(scan);
    const run = async (n, force) => {
      const g0 = game.time | 0, t0 = performance.now(); let last = -1;
      while ((game.time | 0) - g0 < n && performance.now() - t0 < 120000) {
        player.invulnerable = 999999; if (player.hp < getMaxHp()) player.hp = getMaxHp();
        const f = (game.time | 0) - g0;
        if (force && Math.floor(f / 30) !== last && game._lavaEruptCD != null) { last = Math.floor(f / 30); game._lavaEruptCD = 0; out.forcedTicks++; }
        await new Promise((s) => setTimeout(s, 16));
      }
      out.frames += (game.time | 0) - g0;
    };
    const t0 = performance.now(); await run(natural, false); phase = 'forced'; await run(forced, true);
    await new Promise((s) => setTimeout(s, 100)); stop = true;
    out.map = game.mapId || (game.mapData && game.mapData.name); out.secs = Math.round((performance.now() - t0) / 1000); out.dying = !!game.dying;
    return out;
  }, { id, natural, forced });

  for (const id of gloom) {
    const r = await visit(id, 900, 480);   // ~15 s natural (the old drizzle's first drop came at 4.5 s) + ~8 s forced (16 forced map-event ticks, ~90 s of natural drizzle)
    console.log(`  ${id}: ${JSON.stringify(r)}`);
    check(r.frames >= 1380, `${id}: the sim ran (frames counted)`, r);
    check(r.natural === 0 && r.forced === 0, `${id}: no fireball / meteor falls during the visit`, r);
  }
  const lava = await visit('lavaCavern', 60, 360);
  console.log(`  lavaCavern: ${JSON.stringify(lava)}`);
  check(lava.frames >= 400 && lava.natural + lava.forced >= 3, 'control: Lava Cavern still erupts', lava);
  const oss = await p.evaluate(() => !!(MAPS.ossuarySprawl && MAPS.ossuarySprawl.ceilingHazards) && !!(MAPS.hollowSepulchre && MAPS.hollowSepulchre.ceilingHazards));
  check(oss, 'other maps keep their own ceiling hazards (Ossuary Sprawl, Hollow Sepulchre)', oss);
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) { check(false, 'harness', String(e).slice(0, 300)); }
finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
