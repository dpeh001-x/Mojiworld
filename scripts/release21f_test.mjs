// RELEASE 21f (a quest's level is where it sends you) stays fixed:
//   [1] every quest's levelReq is at least its REQUIRED ROUTE LEVEL - 5, computed in the running game: each map's route level is the
//       lowest "highest ordinary-roster level on the way" from Everdawn Central through real doors (MAPS after the Stage Editor bake,
//       plus the runtime Sanctum door; taxi-only maps start free, every other fast travel needs a visit first), a map scored by the
//       top of _lxMapLvSpan (no boss, no spawnChance elite), hard levelGates counted, a boss arena counted only when the road passes
//       through it. A quest needs: its giver / hand-in NPC, every talkTo NPC, the easiest map of each kill target, its visit / stage
//       maps (NPC in several places: the easiest one). The known cases left for the user are listed (KNOWN) and printed.
//   [1c] (per user) the Bubblegum Swamp axolotl is Lv 20 (game table + data/monster_stats.js), so the Lv 21 / 22 class rungs fit their road
//   [2] III · Ledger of the Unfinished: Lv 49 (Oakhart's Verdant Haven is behind Verdant Hollow, Lv 51); it unlocks at 49 with II
//       done, not at 48; the story chain holds it after The Forge That Broke and before The Last Step, in level order
//   [3] Next (the compass): a Lv 41 hero past the Distorted Portal is pointed at The Forge That Broke (one spine: Barnaby I-IV retired), not the Ledger; with the Smith done, at
//       the Ledger; the Ledger done, at the Last Step
//   node release21f_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15188), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const MARGIN = 5;
// Left for the user (reported in r21f, kept per user): a per-user level, a critical quest, or a codex
// study (opens at the creature's level - 2 by formula; its EXP is a share of that level, so moving it shifts the per-band EXP calibration).
const KNOWN = ['q_hourglass_1', 'q_hourglass_4', 'q_boss_aries', 'q_zodiac_twelve', 'b_honeyBuzz', 'b_nougatBear', 'b_stoneling', 'b_voltipup', 'b_cherub', 'b_forgewight', 'b_cinderling'];
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.waitForTimeout(1500);   // the deferred generators (codex, pay trim) run on timers
  // ---- the route level of every map, and the required level of every quest, in the running game
  const A = await page.evaluate(() => {
    _qnavBuild();
    const M = {}; for (const id in MAPS) if (MAPS[id]) M[id] = { m: MAPS[id], portals: (MAPS[id].portals || []).slice() };
    if (M.lastStep && typeof _LX_SANCTUM_DOOR === 'object' && !M.lastStep.portals.some((p) => p && p.dest === 'sanctum')) M.lastStep.portals.push(_LX_SANCTUM_DOOR);   // the door Mira's fall opens
    const own = (id) => { const m = M[id] && M[id].m; if (!m || m.isBossArena) return 0; const s = _lxMapLvSpan(id); return s ? s.hi : 0; };
    const arenaLv = (id) => { const m = M[id] && M[id].m; if (!m || !m.isBossArena) return 0; let b = 0;
      for (const sp of (m.spawns || [])) { const t = sp && monsterTypes[sp.type]; if (t && (sp.boss || t.boss)) b = Math.max(b, (t.level || MOB_NATURAL_LEVEL[sp.type] || 0)); }
      return b || (m.levelReq || 0); };
    const hasIn = new Set(); for (const id in M) for (const p of M[id].portals) if (p && p.dest) hasIn.add(p.dest);
    const route = {}, prev = {}, done = new Set();
    route.town = own('town'); prev.town = null;
    for (const id in M) if (M[id].m.taxiAccessible && !hasIn.has(id)) { route[id] = own(id); prev[id] = null; }   // taxi-only: no walking door in
    for (;;) {
      let cur = null; for (const id in route) if (!done.has(id) && (cur == null || route[id] < route[cur])) cur = id;
      if (cur == null) break; done.add(cur);
      const fromArena = !!M[cur].m.isBossArena;
      for (const p of M[cur].portals) { const t = p && p.dest; if (!t || !M[t]) continue;
        const tm = M[t].m, g = p.levelGate | 0;
        const hard = g && !(fromArena && !tm.isBossArena) && (t === 'confusedVigil' || !tm.isBossArena);   // tryPortal's rule
        const c = Math.max(route[cur], arenaLv(cur), own(t), hard ? g : 0);
        if (route[t] == null || c < route[t]) { route[t] = c; prev[t] = cur; } }
    }
    const pathOf = (id) => { const a = []; let c = id, k = 0; while (c != null && k++ < 200) { a.unshift(c); c = prev[c]; } return a.join(' > '); };
    const best = (maps) => { let b = null; for (const m of (maps || [])) if (route[m] != null && (b == null || route[m] < route[b])) b = m; return b; };
    const rows = [];
    for (const id in QUESTS) { const q = QUESTS[id]; if (!q) continue; const places = [];
      const npc = (name, why) => { if (!name) return; const b = best(((_LX_QNAV.npc[name]) || []).map((x) => x.map)); if (b) places.push({ why: why + ' ' + name, map: b, lv: route[b] }); };
      for (const g of (q.giverByClass ? Object.values(q.giverByClass) : [q.giver])) npc(g, 'giver');
      if (q.handIn && !q.giver && !q.giverByClass) for (const w of (q.npcByClass ? Object.values(q.npcByClass) : [q.npc])) npc(w, 'hand-in');
      let talk = null; try { talk = q.talkTo; } catch (e) {}
      if (q.kind === 'talk' && Array.isArray(talk)) for (const n of talk) npc(n, 'talk to');
      let stage = null; try { stage = (typeof _lxQuestMapOf === 'function') ? _lxQuestMapOf(id) : null; } catch (e) {}
      const stages = [...new Set([stage].concat((q.stages || []).map((s) => s && s.map)).filter(Boolean))];
      if (q.kind === 'visit' && MAPS[q.target]) places.push({ why: 'visit', map: q.target, lv: route[q.target] });
      else if (q.kind === 'special' && q.target === 'zodiacAll') places.push({ why: 'the Sanctum', map: 'zodiacHall', lv: route.zodiacHall });
      else if (stages.length) { for (const sm of stages) if (route[sm] != null) places.push({ why: 'stage', map: sm, lv: route[sm] }); }
      else if (q.kind !== 'talk') { const objs = (q.objectives || []).map((o) => o && o.target).filter(Boolean);
        for (const t of [...new Set(objs.length ? objs : [q.target])]) { const b = t && best(_LX_QNAV.mob[t]); if (b) places.push({ why: 'hunt ' + t, map: b, lv: route[b] }); } }
      places.forEach((p) => { if (p.lv == null) p.lv = 0; });
      if (!places.length) continue;
      const top = places.reduce((a, b) => (b.lv > a.lv ? b : a));
      rows.push({ id, name: q.name, lv: q.levelReq | 0, req: top.lv, why: top.why, map: top.map, path: pathOf(top.map), critical: !!q.critical });
    }
    const rung = rows.filter((r) => /^q_(warrior|mage|archer|rogue)_lv2[12]$/.test(r.id)).map((r) => [r.id, r.lv, r.req]);
    const ax = { nat: MOB_NATURAL_LEVEL.axolotl, table: (window.LX_MONSTER_STATS && LX_MONSTER_STATS.axolotl) || null, swamp: _lxMapLvSpan('bubblegumSwamp'), maps: _LX_QNAV.mob.axolotl };
    return { rows, pagoda: route.hiddenPagoda, haven: route.verdantHaven, havenPath: pathOf('verdantHaven'), swampRoute: route.bubblegumSwamp, hollowRoute: route.honeycombHollow, hollowPath: pathOf('honeycombHollow'), rung, ax };
  });
  const bad = A.rows.filter((r) => r.lv < r.req - MARGIN);
  const unknown = bad.filter((r) => KNOWN.indexOf(r.id) < 0), known = bad.filter((r) => KNOWN.indexOf(r.id) >= 0);
  for (const r of known) console.log('  known (left for the user): ' + r.id + ' Lv ' + r.lv + ' needs ' + r.req + ' - ' + r.why + ' @ ' + r.map);
  ok('[1a] ' + A.rows.length + ' quests read; no quest outside the known list sits more than ' + MARGIN + ' levels under the road it sends you down',
    A.rows.length > 250 && unknown.length === 0, unknown.map((r) => ({ id: r.id, lv: r.lv, req: r.req, why: r.why, map: r.map, path: r.path })));
  ok('[1c] (per user) the axolotl is Lv 20 in both its tables and fits the Bubblegum Swamp (its only map): the swamp tops out at 20, the road to Honeycomb Hollow at 26, and the 8 class rungs Lv 21 / 22 sit within 5 of it',
    A.ax.nat === 20 && A.ax.table && A.ax.table.lv === 20 && A.ax.table.hp <= 2000 && A.ax.swamp && A.ax.swamp.hi <= 20 && A.swampRoute <= 20 && A.hollowRoute <= 26 && A.rung.length === 8 && A.rung.every(([, lv, req]) => lv >= req - 5) && String(A.ax.maps) === 'bubblegumSwamp',
    { ax: A.ax, swamp: A.swampRoute, hollow: A.hollowRoute, path: A.hollowPath, rung: A.rung });
  ok('[1b] the Hidden Pagoda is a low road (through Fungal Hollow), Verdant Haven is not (Verdant Hollow, Lv 51)', A.pagoda <= 12 && A.haven >= 50, { pagoda: A.pagoda, haven: A.haven, path: A.havenPath });
  // ---- [2] [3] the Ledger: its level, its unlock, its place in the chain and in Next
  const L = await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    const out = {}, C = _QUEST_STORY_CHAIN;
    const fresh = (lv, done) => { player.level = lv; player.exp = 0; player.expToNext = 1e15; player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests();
      game.qnav = null; game.qnavPins = []; for (const id of done) player.quests.completed[id] = 1; };
    out.lv = QUESTS.q_carried_3.levelReq; out.prereq = QUESTS.q_carried_3.prereq;
    const ix = (id) => C.indexOf(id);
    out.idx = { two: ix('q_carried_2'), portal: ix('q_distorted_portal'), smith: ix('q_boss_sundered_smith'), three: ix('q_carried_3'), last: ix('q_last_step'), hg1: ix('q_hourglass_1') };
    const s = out.idx.smith, e = out.idx.hg1, lvs = C.map((id) => (QUESTS[id] || {}).levelReq || 1);
    out.outOfOrder = C.filter((id, i) => i > s && i <= e && lvs[i] < lvs[i - 1]);
    const before = C.slice(0, ix('q_carried_3'));   // everything the chain puts ahead of the Ledger
    fresh(48, ['q_carried_1', 'q_carried_2']); tickQuestUnlocks(); out.unl48 = !!player.quests.unlocked.q_carried_3;
    fresh(49, ['q_carried_1', 'q_carried_2']); tickQuestUnlocks(); out.unl49 = !!player.quests.unlocked.q_carried_3;
    const upTo = (id) => C.slice(0, ix(id) + 1);
    fresh(41, upTo('q_distorted_portal')); out.next41 = _nextStoryBeat();
    fresh(46, upTo('q_boss_sundered_smith')); out.next46 = _nextStoryBeat();
    fresh(50, upTo('q_carried_3')); out.next50 = _nextStoryBeat();
    out.beforeHasSmith = before.indexOf('q_boss_sundered_smith') >= 0;
    return out;
  });
  ok('[2a] III · Ledger of the Unfinished is Lv 46+ (its road, Verdant Hollow, is Lv 51) and still follows II', L.lv >= 46 && L.prereq === 'q_carried_2', { lv: L.lv, prereq: L.prereq });
  ok('[2b] with II done it unlocks at its level, not a level before', L.unl49 && !L.unl48, { 48: L.unl48, 49: L.unl49 });
  ok('[2c] the story chain holds it after The Forge That Broke and before The Last Step, in level order', L.idx.two < L.idx.portal && L.idx.smith < L.idx.three && L.idx.three < L.idx.last && L.beforeHasSmith && L.outOfOrder.length === 0, L);
  ok('[3] Next: past the Portal it is The Forge That Broke (not the Ledger); past the Smith it is the Ledger; past the Ledger it is the Last Step',
    L.next41 === 'q_boss_sundered_smith' &&   /* one spine: was q_barnaby_five */ L.next46 === 'q_carried_3' && L.next50 === 'q_last_step', { next41: L.next41, next46: L.next46, next50: L.next50 });
  ok('[4] no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
