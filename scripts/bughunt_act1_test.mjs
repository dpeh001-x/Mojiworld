// Act I's six kill quests (Lv 1-9: snails, petalflies, jellies, mushpups, shrooms, sproutles), played in their own maps (bug hunt, "check the act 1 kill quest
// fights too"). Pins: the tracker's guidance line names what to defeat (it said "Target nearby", a bare map name, or nothing once the map's targets were down),
// the counter follows every kill and ends on "Turn in", nothing live leaves a map except by being killed or faded, and a cleared map refills.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/bughunt_act1_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11281';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof _questGuidance === 'function' && typeof tickQuestKill === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} try { _lxBootHold && _lxBootHold.release && _lxBootHold.release('menu'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true; player._storyBeatsSeen = {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; window._playStoryBeat = function () { return true; }; player._god = true;
    window.__toasts = []; const st = showToast; showToast = function (m) { __toasts.push(String(m)); return st.apply(this, arguments); }; });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = { rows: [], pops: [] }; const A1 = ['q_act1_waking', 'q_act1_sleepers', 'q_act1_quiet', 'q_act1_recipe', 'q_act1_name', 'q_act1_firstword'];
    const mapName = (id) => { const m = MAPS[id]; return (typeof _qtMapName === 'function') ? _qtMapName(id) : (m && m.name) || id; };
    for (const qid of A1) {
      player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); for (const k of A1.slice(0, A1.indexOf(qid))) player.quests.completed[k] = true; player.quests.unlocked[qid] = true; __toasts.length = 0;
      const q = QUESTS[qid]; player.level = q.levelReq; const tName = monsterTypes[q.target].name; const row = { qid, tName };
      loadMap('town', 300); await wait(1200); acceptQuest(qid, true); const a = player.quests.active[qid]; row.town = (_questGuidance(qid, q, a) || {}).text;
      const spawnMap = Object.keys(MAPS).find((k) => (MAPS[k].spawns || []).some((s) => s.type === q.target)); row.map = spawnMap; row.mapName = mapName(spawnMap);
      loadMap(spawnMap, 300); await wait(3000); game.paused = false; player._god = true; player.invulnerable = 9e9; player.hp = getMaxHp();
      const arr = game.monsters, sp = arr.splice; arr.splice = function (i, n) { try { for (const m of Array.prototype.slice.call(arr, i, i + (n === undefined ? arr.length - i : n))) if (m && !(game._fadingMonsters || []).includes(m) && !m._killed) out.pops.push(qid + ':' + m.type + ':' + Math.round(m.currentHp)); } catch (e) {} return sp.apply(arr, arguments); };
      row.here = (_questGuidance(qid, q, a) || {}).text; row.mobs0 = game.monsters.length;
      const trk = () => { const r = [...document.querySelectorAll('#quest-tracker .qt-row')].find((x) => x.textContent.indexOf(q.name) >= 0); const p = r && r.querySelector('.qt-prog'); return p ? p.textContent.trim() : null; };
      row.trk = [trk()]; let ok = true;
      const flag = (m) => { m._killed = 1; return m; }, aliveT = () => game.monsters.filter((x) => x.type === q.target && x.currentHp > 0);
      // none up: take every target off the map (not a kill: nothing is counted) and read the line
      for (const m of aliveT()) { const i = game.monsters.indexOf(flag(m)); if (i >= 0) game.monsters.splice(i, 1); } row.none = (_questGuidance(qid, q, a) || {}).text;
      // ten kills, each waited out; a target is put back by hand when the drip has not brought one (the refill is checked on its own below)
      for (let i = 1; i <= q.count; i++) {
        // one counted kill per step: a freshly spawned target can still be inside its spawn protection and shrug a hit off, so swing until the counter moves
        for (let t = 0; t < 40 && (a.progress | 0) < i && !a.readyToHandIn; t++) {
          let m = aliveT()[0]; if (!m) { m = spawnMonster(Math.max(80, player.x + 160), 300, q.target, false); await wait(120); }
          if (m && m.currentHp > 0) { flag(m); hitMonster(m, 99999, false, 'slash'); await wait(70); }
        }
        if ((a.progress | 0) < i && !a.readyToHandIn) { ok = false; break; }
        await wait(60); row.trk.push(trk());
      }
      row.finished = ok && !!a.readyToHandIn; row.prog = a.progress | 0; row.done = (_questGuidance(qid, q, a) || {}).text; row.toast = __toasts.some((t) => /Objectives complete/.test(t));
      await wait(6000); row.mobsAfter = game.monsters.length; out.rows.push(row);
    }
    return out;
  });
  for (const r of R.rows) {
    check(r.town === 'Defeat ' + r.tName + ' \u00b7 ' + r.mapName, r.qid + ': away from the hunt the guidance names the monster and the map', J({ town: r.town, want: r.tName + ' / ' + r.mapName }));
    check(/^Defeat /.test(r.here) && r.here.indexOf(r.tName) > 0 && /nearby/.test(r.here), r.qid + ': on the map it names the monster and how many are near', r.here);
    check(r.finished && r.prog >= 10 && r.toast, r.qid + ': ten kills complete the quest ("Objectives complete")', J({ finished: r.finished, prog: r.prog, toast: r.toast }));
    check(r.trk.slice(0, 11).every((t, i) => i === 10 ? t === '\u2713 Turn in' : t === i + '/10'), r.qid + ': the counter reads 0/10 .. 9/10 then "Turn in", one step per kill', r.trk.join(' '));
    check(/none up, more soon/.test(r.none || ''), r.qid + ': with the map\'s targets down the guidance says none are up (it went blank)', r.none);
    check(/^Return to /.test(r.done), r.qid + ': then it points back to the giver', r.done);
    check(r.mobsAfter >= r.mobs0 - 3, r.qid + ': the cleared map refills (monsters ' + r.mobs0 + ' -> ' + r.mobsAfter + ' after 6 s)');
  }
  check(R.pops.length === 0, 'nothing live left the six maps except by being killed or faded', J(R.pops.slice(0, 4)));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
