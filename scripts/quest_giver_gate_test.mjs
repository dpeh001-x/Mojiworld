// QUEST GIVER GATES (v0.30.908, per user "Yes change Barnaby quests"). A quest may not unlock below the level of the map
// its giver stands on (by more than 3 levels): Barnaby II-IV, Lyra V and the Kindest Hand were Lv 45-50 while Barnaby stands only in the Lv 61
// Frosted Mansion (moved there per user earlier), reached only through Lv 61-71 monsters. Checked for EVERY quest
// with a giver, against the maps as the game builds them (the Stage Editor bake included). Plus the prologue's card.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_giver_gate_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11281';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof QUESTS === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const where = {};
    for (const id in MAPS) for (const n of (MAPS[id].npcs || [])) if (n && n.name) (where[n.name] = where[n.name] || []).push(id);
    // the runtime sweep sets nearly every open map's levelReq to 1 (walk gates removed), so the gate that matters is the
    // AUTHORED one - it is what the map's own monsters and the route to it are tuned to. Read it from the MAPS literal.
    const src0 = document.documentElement.outerHTML, M0 = src0.indexOf('const MAPS = {');
    const NL = String.fromCharCode(10);
    const authored = (id) => { const rest = src0.slice(M0); const k = rest.indexOf(NL + '  ' + id + ': {'); if (k < 0) return 1;
      const body = rest.slice(k + 3); const nx = body.search(/\n  [A-Za-z0-9_]+: *\{/); const blk = nx > 0 ? body.slice(0, nx) : body.slice(0, 4000);
      const m = blk.match(/levelReq: *(\d+)/); return m ? +m[1] : 1; };
    const bad = [], barn = {};
    for (const qid in QUESTS) {
      const q = QUESTS[qid]; if (!q || !q.giver || !where[q.giver]) continue;
      const gate = Math.min(...where[q.giver].map((m) => authored(m)));
      // nothing blocks the walk (the sweep) and the taxi only lists maps already visited, so the barrier is the monsters
      // on the way: a giver whose map is tuned more than 3 levels above the quest is out of the player's reach
      if (gate - (q.levelReq || 1) > 3) bad.push(qid + ' Lv' + (q.levelReq || 1) + ' < ' + q.giver + ' Lv' + gate + ' (' + where[q.giver].join('/') + ')');
      if (q.giver === 'Barnaby' || qid === 'q_kindest_hand') barn[qid] = q.levelReq;
    }
    const src = document.documentElement.outerHTML;
    return { bad, barn, barnabyAt: where.Barnaby || [], eons: src.includes('EONS FROM NOW'), realm: src.includes('IN A DIFFERENT REALM — AT THE FAR END OF THE DREAM'),
      pointer: /he keeps his forge in the Frosted Mansion/.test((QUESTS.q_barnaby_five || {}).desc || ''), five: (QUESTS.q_barnaby_five || {}).levelReq };
  });
  check(r.bad.length === 0, 'no quest unlocks well below the level of the map its giver stands on', J(r.bad));
  check(J(r.barnabyAt) === J(['glasswindHamlet']) && Object.values(r.barn).every((lv) => lv >= 61), "Barnaby stays in the Frosted Mansion and his quests (and the Kindest Hand after them) open at Lv 61", J({ at: r.barnabyAt, lv: r.barn }));
  check(r.five === 45 && r.pointer, "Brok's Barnaby I stays Lv 45 and says where Barnaby's forge is", J({ lv: r.five, pointer: r.pointer }));
  check(!r.eons && r.realm, 'the prologue opens IN A DIFFERENT REALM', J({ eons: r.eons, realm: r.realm }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
