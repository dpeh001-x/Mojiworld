// NPC PLACEMENT (v0.30.1121, the 2026-09-26 NPC audit). Where NPCs actually stand after the load-time snap:
//   - STORM: the Stormbearer stands on his cloud-step ledge, not on the ground under it (three loads: the ledge moves)
//   - PORTALS: Old Rye, Yun and the Echo Keeper (Confused Vigil) stand clear of every portal
//   - AUTHORED: those authored below the ground (Bravo on B2/B5/B7/B8, the gate's ???) are stored where the game puts them
//   - LEDGE: those authored above a shifting ledge (Bravo in town, Ren) land on it on every load
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/npc_placement_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11390';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS === 'object', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; try { closeAllModals(); } catch (e) {}
    const go = async (m) => { try { closeAllModals(); } catch (e) {} loadMap(m, 300); await W8(400); try { closeAllModals(); } catch (e) {} };
    const npc = (n) => game.npcs.find((x) => x.name === n);
    const out = { storm: [], portals: {}, authored: {} };
    for (let i = 0; i < 3; i++) { await go('stormCrest'); const sb = npc('Stormbearer'), feet = sb.y + 44;
      const on = game.mapData.platforms.filter((p) => Math.abs(p.y - feet) <= 1 && sb.x >= p.x && sb.x <= p.x + p.w).map((p) => p.type); out.storm.push({ feet: Math.round(feet), on }); }
    const clear = (n) => Math.round(Math.min(...(game.mapData.portals || []).map((p) => Math.abs((p.x + (p.w || 0) / 2) - n.x))));
    await go('hollowSepulchre'); out.portals.oldRye = clear(npc('Old Rye'));
    await go('emeraldVillage'); out.portals.yun = clear(npc('Yun'));
    game.bossDefeated.confusedVigil = true; await go('confusedVigil'); const ek = npc('Echo Keeper'); out.portals.echoKeeper = ek ? clear(ek) : null;
    const lit = (map, name) => { const e = (MAPS[map].npcs || []).find((x) => x.name === name); return e ? e.y : null; };
    out.ledge = {};
    for (const [map, name] of [['town', 'Bravo'], ['shadowWovenHood', 'Ren']]) for (let i = 0; i < 3; i++) {
      await go(map); const n = npc(name), feet = n.y + 44; const on = game.mapData.platforms.filter((p) => Math.abs(p.y - feet) <= 1 && n.x >= p.x && n.x <= p.x + p.w).map((p) => p.type);
      (out.ledge[map + '/' + name] = out.ledge[map + '/' + name] || []).push(on.join(',') || 'air');
    }
    for (const [map, name] of [['tower_b2', 'Bravo'], ['tower_b5', 'Bravo'], ['tower_b7', 'Bravo'], ['tower_b8', 'Bravo'], ['wayfarersLantern2', '???']]) {
      await go(map); const n = npc(name); out.authored[map + '/' + name] = { stored: lit(map, name), live: n ? n.y : null };
    }
    return out;
  });
  check(r.storm.every((s) => s.on.length && !s.on.includes('ground')), 'STORM: across three loads the Stormbearer stands on his ledge, not the ground under it', J(r.storm));
  check(r.portals.oldRye >= 100 && r.portals.yun >= 60 && r.portals.echoKeeper != null && r.portals.echoKeeper >= 100, 'PORTALS: Old Rye, Yun and the Echo Keeper stand clear of every portal (px to the nearest)', J(r.portals));
  check(Object.values(r.authored).every((a) => a.stored != null && a.stored === a.live), 'AUTHORED: every listed NPC is stored at the height the game puts them', J(r.authored));
  check(Object.values(r.ledge).every((l) => l.every((t) => t === 'platform')), 'LEDGE: Bravo (town) and Ren land on their ledge on every load, never the street', J(r.ledge));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
