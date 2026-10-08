// The humming-stone quest (q_road_3) and the other early set-pieces, as a player met them (user: "if you touch the wrong stone you have to leave the map to
// reset ... it is supposed to reset automatically ... monsters should not suddenly disappear ... a kill counter pops out that should give more specific
// instructions"). Pins: the quest tracker follows every touch (it kept the old count until a map change rebuilt it), a wrong touch resets the puzzle at once and the
// penalty fight never locks it, the penalty monsters stay until they are killed, what a fight removes leaves by fading (never a pop), and the pill says what to do.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/bughunt_stones_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11261';
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
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof _lxQMarkUse === 'function' && typeof _lxFightHud === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} try { _lxBootHold && _lxBootHold.release && _lxBootHold.release('menu'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 6; player._god = true; player.invulnerable = 9e9; player._tutorialSeen = true; player._gravitosCineSeen = true; player._storyBeatsSeen = {};
    window.__toasts = []; const st = showToast; showToast = function (m) { __toasts.push(String(m)); return st.apply(this, arguments); };
    window._playStoryBeat = function () { return true; }; });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const setup = async (id) => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; game._fadingMonsters = [];
      const q = QUESTS[id]; player.level = q.levelReq; for (const k of Object.keys(QUESTS)) if (/^q_road_/.test(k) && k < id) player.quests.completed[k] = true; player.quests.unlocked[id] = true;
      loadMap(q.stages[0].map, 300); await wait(1800); game.paused = false; game.monsters.length = 0; player._god = true; player.invulnerable = 9e9; player.hp = getMaxHp(); acceptQuest(id, true); return player.quests.active[id]; };
    const stand = (mk) => { const m = _lxQMarks().find((x) => x.mk.id === mk); player.x = m.x - 14; player.y = m.y - player.h; player.vx = 0; player.vy = 0; return m; };
    const touch = async (mk) => { stand(mk); await wait(120); game._lxQMarkT = 0; const t = _lxQMarkTarget(); if (t && t.mk.id === mk) _lxQMarkUse(t); await wait(60); return !!t; };
    const trk = (name) => { renderQuestTracker; const rows = [...document.querySelectorAll('#quest-tracker .qt-row')]; const r = rows.find((x) => x.textContent.indexOf(name) >= 0); const p = r && r.querySelector('.qt-prog'); return p ? p.textContent.trim() : null; };
    const left = (f) => f.mobs.filter((m) => game.monsters.indexOf(m) >= 0).length;
    const pill = () => { _lxFightHud(); const e = document.getElementById('lx-sp-hud'); return e && e.style.display !== 'none' ? e.textContent : ''; };
    // ---- the stones
    let a = await setup('q_road_3'); out.s = {};
    out.s.t0 = trk("A Note That Won't End");
    await touch('quiet'); out.s.t1 = trk("A Note That Won't End"); out.s.p1 = a.progress;                                   // one stone right: the tracker says 1/3 at once
    __toasts.length = 0; await touch('loud');                                                                               // out of turn
    const f = game._lxFight;
    out.s.wrong = { t: trk("A Note That Won't End"), used: Object.keys(a.used || {}).length, seq: a.seq | 0, fight: !!f, free: !!(f && f.free), mobs: f ? left(f) : 0, toast: __toasts.join(' | '), lit: _lxQMarks().filter((m) => m.lit).length };
    out.s.pill = pill();
    // the puzzle is already reset and the ambush does not lock it: start again at once, the monsters still alive
    __toasts.length = 0; await touch('quiet'); out.s.again = { used: Object.keys(a.used || {}).join(), locked: __toasts.some((t) => /finish the fight/.test(t)), fightStill: !!game._lxFight, mobs: game._lxFight ? left(game._lxFight) : 0 };
    await touch('mid'); await touch('loud'); await wait(300);
    out.s.done = { ready: !!a.readyToHandIn, t: trk("A Note That Won't End"), fightStill: !!game._lxFight, mobs: game._lxFight ? left(game._lxFight) : 0, kept: f.mobs.filter((m) => game.monsters.indexOf(m) >= 0).length };
    // the hero falls / the fight ends lost: a penalty ambush's monsters stay (they are just monsters), nothing pops
    const before = f.mobs.filter((m) => game.monsters.indexOf(m) >= 0).length; _lxFightEnd(game._lxFight, false);
    out.s.afterEnd = { before, stay: f.mobs.filter((m) => game.monsters.indexOf(m) >= 0).length, tagged: f.mobs.some((m) => m._lxFight) };
    // ---- the well: a boss fight clears the natives by fading them, and a lost fight fades what is left
    a = await setup('q_road_1'); out.w = {};
    const wm = _lxQMarks().find((x) => x.mk.id === 'well'); const nat = spawnMonster(wm.x + 180, 380, 'slime', false); await wait(100);
    const natIn = game.monsters.indexOf(nat) >= 0; await touch('well'); const wf = game._lxFight;
    out.w.natives = { was: natIn, still: game.monsters.indexOf(nat) >= 0, fading: (game._fadingMonsters || []).indexOf(nat) >= 0 };
    out.w.pill = pill();
    const boss = wf && wf.boss; _lxFightEnd(game._lxFight, false);
    out.w.lost = { bossStill: boss ? game.monsters.indexOf(boss) >= 0 : null, bossFading: boss ? (game._fadingMonsters || []).indexOf(boss) >= 0 : null, free: !!(wf && wf.free) };
    // ---- the lamps: an ambush pill
    a = await setup('q_road_2'); out.l = {}; await touch('l1'); out.l.pill = pill(); out.l.free = !!(game._lxFight && game._lxFight.free);
    return out;
  });
  const S = R.s;
  check(S.t0 === '0/3' && S.t1 === '1/3' && S.p1 === 1, 'the quest tracker follows every stone: 0/3 at the start, 1/3 right after the first (it kept the old count until a map change)', J({ t0: S.t0, t1: S.t1, p1: S.p1 }));
  check(S.wrong.fight && S.wrong.free && S.wrong.mobs === 3 && S.wrong.used === 0 && S.wrong.seq === 0 && S.wrong.t === '0/3' && S.wrong.lit === 0, 'a wrong stone resets the puzzle AT ONCE (0 touched, tracker 0/3, no stone lit) and starts a free penalty ambush of three', J(S.wrong));
  check(/off-key/i.test(S.wrong.toast) && /reset/i.test(S.wrong.toast), 'the toast says it went off-key and that the stones have reset', S.wrong.toast);
  check(/Off-key/.test(S.pill) && /3/.test(S.pill) && /quietest first/.test(S.pill), 'the pill tells you what to do: it names the 3 left to defeat and says to touch the stones again, quietest first', S.pill);
  check(S.again.used === 'quiet' && !S.again.locked && S.again.fightStill && S.again.mobs === 3, 'the penalty ambush does not lock the stones: the quietest can be touched again with all three monsters still alive', J(S.again));
  check(S.done.ready && S.done.fightStill && S.done.mobs === 3 && S.done.kept === 3, 'the puzzle can be finished while the ambush stands, and the monsters stay (nothing vanishes under the hero)', J(S.done));
  check(S.afterEnd.before === 3 && S.afterEnd.stay === 3 && !S.afterEnd.tagged, 'a penalty ambush that ends unwon leaves its monsters standing as ordinary monsters', J(S.afterEnd));
  check(R.w.natives.was && !R.w.natives.still && R.w.natives.fading, 'the Well-Drinker arena goes quiet by FADING the natives (out of the list, drawn dissolving), not by popping them out', J(R.w.natives));
  check(R.w.lost.bossStill === false && R.w.lost.bossFading === true && R.w.lost.free === false, 'a boss fight that is lost fades its boss away instead of popping it', J(R.w.lost));
  check(/Defeat The Well-Drinker/.test(R.w.pill) && /100%/.test(R.w.pill), 'a boss fight pill names the boss to defeat and its health', R.w.pill);
  check(/Clear the ambush/.test(R.l.pill) && /\d+ left/.test(R.l.pill) && R.l.free === false, 'a lamp ambush pill says to clear the ambush and counts what is left (and it still holds you: not free)', J(R.l));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
