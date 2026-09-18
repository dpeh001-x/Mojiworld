// QUEST NAVIGATOR TARGETS (v0.30.892 launch audit). Every quest whose objective is a monster must resolve to a map the
// navigator can point at - spawn lists, boss arenas (bossType) and the monsters that spawn from their own clocks.
// Bloodthirsty Vermillion (q_lyra_cut) had no map, so the pin pointed at Hera for the whole hunt. Also: every portal on
// the Azure Academia stands on its floor.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_nav_targets_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11201';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _qnavDest === 'function' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(2000);
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('town', 600); await wait(1500); try { closeAllModals(); } catch (e) {}
    _LX_QNAV.npc = null; _qnavBuild();
    // special objectives with no single monster home
    const SPECIAL = new Set(['pq_piece', 'zodiacAll', 'pqConductor']);
    const missing = [];
    for (const [qid, q] of Object.entries(QUESTS)) {
      const objs = q.objectives && q.objectives.length ? q.objectives : [q];
      for (const o of objs) { const t = o.target, k = o.kind || q.kind;
        if (typeof t !== 'string' || k === 'talk' || k === 'collect' || SPECIAL.has(t) || !monsterTypes[t]) continue;
        if (!(_LX_QNAV.mob[t] || []).length) missing.push(qid + ':' + t); }
    }
    if (!player.quests) player.quests = { active: {}, completed: {} }; if (!player.quests.active) player.quests.active = {};
    player.quests.active.q_lyra_cut = { progress: 0 };
    const d = _qnavDest('q_lyra_cut'); delete player.quests.active.q_lyra_cut;
    loadMap('azureAcademia'); await wait(1200); try { closeAllModals(); } catch (e) {}
    const md = game.mapData, plats = md.platforms || [];
    const floating = (md.portals || []).filter((p) => { const fy = typeof p.y === 'number' ? p.y : _defaultPortalY(p.x); return !plats.some((q) => p.x >= q.x - 4 && p.x <= q.x + q.w + 4 && Math.abs(q.y - fy) <= 2); }).map((p) => p.dest + '@' + p.y);
    return { missing, lyra: d && { kind: d.kind, map: d.map }, lego: _LX_QNAV.mob.legosaurus || [], floating };
  });
  check(r.missing.length === 0, 'every quest monster target resolves to a map the navigator can point at', J(r.missing));
  check(r.lyra && r.lyra.kind === 'hunt' && r.lyra.map === 'fracturedReflection', 'hunting Bloodthirsty Vermillion points at the Fractured Reflection (was: at Hera)', J(r.lyra));
  check(r.lego.length > 0, 'a boss placed by its arena\u2019s bossType (Legosaurus) is indexed', J(r.lego));
  check(r.floating.length === 0, 'every Azure Academia portal stands on its floor', J(r.floating));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
