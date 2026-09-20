// Quest EXP is the number written on the quest (per user: "there are no levers as it causes alot of
// confusion"). The x16 knob is folded into the authored numbers, the newbie band and the Lv 30+
// weighting are off the EXP path, and the 80% ceiling binds at every level including Lv 1 - where
// it used to be skipped, so the opening story quest paid 30,720 EXP and finished a new hero at Lv 11.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_exp_raw_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11244';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof _completeQuest === 'function' && typeof _lxLevelCost === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(() => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior';
    const out = { knob: typeof LX_QUEST_EXP_MULT !== 'undefined' };
    // hand one quest in, at a chosen level, and read what it paid
    const hand = (id, lv, noLvUp) => {
      const q = QUESTS[id]; if (!q) return null;
      player.level = lv; player.exp = 0; player.expToNext = _lxLevelCost(lv);
      player.quests = { active: {}, completed: {}, progress: {}, unlocked: {} };
      player.quests.active[id] = { targetCount: q.count || 1, rewardScale: 1 };
      player._pqStagePaid = {}; player._pqChainRuns = 0;
      const lvUp = window._maybeLevelUp; if (noLvUp) window._maybeLevelUp = function () {};
      try { _completeQuest(id); } catch (e) {} finally { window._maybeLevelUp = lvUp; }
      return { exp: player.exp, level: player.level };
    };
    // 1. a brand-new hero's first errand
    out.first = hand('q_act1_waking', 1, false);
    out.toLv11 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((a, L) => a + _lxLevelCost(L), 0);
    // 2. nothing pays over the ceiling, at its own design level
    out.over = []; out.n = 0;
    for (const id in QUESTS) {
      const q = QUESTS[id], rw = q && q.rewards; if (!rw || !rw.exp) continue;
      const qL = Math.max(1, (q.levelReq | 0) || 1);
      const got = hand(id, qL, true); if (!got) continue;
      out.n++;
      const cap = Math.max(1, Math.floor(_lxLevelCost(qL) * 0.80));
      if (got.exp > cap) out.over.push(id + ':' + got.exp + '>' + cap);
    }
    // 3. the same quest pays the same to every hero who can take it
    const pick = Object.keys(QUESTS).find((k) => QUESTS[k].rewards && QUESTS[k].rewards.exp
      && !QUESTS[k].scalesToPlayer && (QUESTS[k].levelReq | 0) >= 35 && (QUESTS[k].levelReq | 0) <= 45);
    out.pick = pick;
    out.byLevel = pick ? [45, 60, 80, 99].map((lv) => hand(pick, lv, true).exp) : [];
    // 4. where the authored number wins - over the curve floor, under the ceiling - it IS the payout
    out.exact = []; 
    for (const id in QUESTS) {
      const q = QUESTS[id], rw = q && q.rewards; if (!rw || !rw.exp || q.scalesToPlayer) continue;
      const qL = Math.max(1, (q.levelReq | 0) || 1);
      if (hand(id, qL, true).exp === rw.exp) out.exact.push(id + '=' + rw.exp);
    }
    return out;
  });
  check(r.knob === false, 'the x16 quest knob is gone from the build', 'LX_QUEST_EXP_MULT defined: ' + r.knob);
  check(r.first && r.first.level <= 2, 'the opening story quest no longer skips the early game (it used to finish at Lv 11)', J(r.first) + ' vs ' + r.toLv11 + ' EXP for all of Lv 1-11');
  check(r.over.length === 0, 'no quest pays more than 80% of its own level, and that now holds at Lv 1 too', r.over.slice(0, 4).join(' '));
  check(r.byLevel.length === 4 && new Set(r.byLevel).size === 1, 'the same quest pays the same EXP to every hero who can take it', r.pick + ' ' + J(r.byLevel));
  check(r.exact.length >= 10, 'where the authored number wins, it IS the payout - to the unit', r.exact.length + ' quests, e.g. ' + r.exact.slice(0, 3).join(' '));
  check(r.n >= 300, 'the whole quest board was measured', String(r.n));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
