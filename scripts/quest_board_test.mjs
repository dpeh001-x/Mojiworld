// The quest board, as a whole: every quest can be finished, every prerequisite exists and is
// reachable, every reward is well formed, and nothing pays over its own ceiling. Written from the
// 2026-09-20 board audit — these all hold on main, so a break here is a regression, not a retune.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_board_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11251';
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
    const out = { n: 0, noTarget: [], unknownMob: [], zeroCount: [], missingPrereq: [], gatedUnderPrereq: [],
      cycles: [], noReward: [], badNumber: [], badPotion: [], overCeiling: [], paysNothing: [], offBand: [],
      bandShare: {}, bandN: {}, overSupply: [] };
    // and no hunt asks for more of a monster than the world holds - the supply cap, through the
    // deferred rounding, whose own floor is 20
    const supply = {};
    for (const mid in (typeof MAPS === 'object' ? MAPS : {})) for (const sp of ((MAPS[mid] || {}).spawns || [])) if (sp && sp.type) supply[sp.type] = (supply[sp.type] || 0) + ((sp.count | 0) || 1);
    // real cycle detection: white / grey / black
    const colour = {};
    const visit = (id, path) => {
      if (colour[id] === 2) return; if (colour[id] === 1) { out.cycles.push(path.slice(path.indexOf(id)).concat(id).join(' -> ')); return; }
      colour[id] = 1;
      for (const p of [].concat((QUESTS[id] || {}).prereq || [])) if (QUESTS[p]) visit(p, path.concat(id));
      colour[id] = 2;
    };
    for (const id in QUESTS) visit(id, []);
    for (const id in QUESTS) {
      const q = QUESTS[id], rw = q && q.rewards; out.n++;
      const qL = Math.max(1, (q.levelReq | 0) || 1);
      if (q.kind === 'kill' || q.kind === 'boss') {
        if (!q.target) out.noTarget.push(id);
        else if (typeof monsterTypes === 'object' && !monsterTypes[q.target]) out.unknownMob.push(id + ':' + q.target);
        if ((q.count | 0) <= 0) out.zeroCount.push(id);
        if (q.kind === 'kill' && (supply[q.target] | 0) === 1 && (q.count | 0) > 10) out.overSupply.push(id + ':x' + q.count + ' of 1');
      }
      for (const p of [].concat(q.prereq || [])) {
        if (!QUESTS[p]) { out.missingPrereq.push(id + ' needs ' + p); continue; }
        if ((QUESTS[p].levelReq | 0) > qL) out.gatedUnderPrereq.push(id + '(Lv' + qL + ') after ' + p + '(Lv' + QUESTS[p].levelReq + ')');
      }
      if (!rw || (!rw.exp && !rw.mojicoins && !rw.gearChance && !rw.potions && !rw.item)) { out.noReward.push(id); continue; }
      for (const k of ['exp', 'mojicoins']) if (rw[k] != null && !(rw[k] >= 0 && isFinite(rw[k]))) out.badNumber.push(id + '.' + k + '=' + rw[k]);
      if (rw.gearChance != null && !(rw.gearChance >= 0 && rw.gearChance <= 1)) out.badNumber.push(id + '.gearChance=' + rw.gearChance);
      if (rw.potions && typeof POTION_ITEMS !== 'undefined') for (const pid in rw.potions) if (!POTION_ITEMS.some((p) => p.id === pid)) out.badPotion.push(id + ':' + pid);
      if (!rw.exp) continue;
      // hand it in at its own design level and read the payout
      player.level = qL; player.exp = 0; player.expToNext = _lxLevelCost(qL);
      player.quests = { active: {}, completed: {}, progress: {}, unlocked: {} };
      player.quests.active[id] = { targetCount: q.count || 1, rewardScale: 1 };
      player._pqStagePaid = {}; player._pqChainRuns = 0;
      const lvUp = window._maybeLevelUp; window._maybeLevelUp = function () {};
      try { _completeQuest(id); } catch (e) { out.badNumber.push(id + ' threw'); } finally { window._maybeLevelUp = lvUp; }
      const paid = player.exp, cap = Math.max(1, Math.floor(_lxLevelCost(qL) * 0.80));
      if (paid > cap) out.overCeiling.push(id + ':' + paid + '>' + cap);
      if (paid <= 0) out.paysNothing.push(id);
      // per user: no quest pays more than three fifths of a level, and a ten-level band's quests are
      // worth 40% of that band BETWEEN them. The Clockwork run is exempt (repeatable, level-scaled,
      // its own ~1%-a-stage taper) and so is the Lv 1 opener, whose whole rung costs one point of EXP.
      if (!q.scalesToPlayer && qL > 1) {
        const share = paid / _lxLevelCost(qL);
        if (share > 0.61) out.offBand.push(id + '@Lv' + qL + '=' + share.toFixed(3));
        // a class line is four copies of one quest; one player does one of them
        if (!/^q_(rogue|archer|mage)_lv[0-9]+$/.test(id)) {
          const bd = Math.min(9, Math.floor((qL - 1) / 10));
          out.bandShare[bd] = (out.bandShare[bd] || 0) + share;
          out.bandN[bd] = (out.bandN[bd] || 0) + 1;
        }
      }
    }
    return out;
  });
  check(r.n >= 300, 'the whole board is there', r.n + ' quests');
  check(r.noTarget.length === 0 && r.unknownMob.length === 0, 'every kill or boss quest names a monster the game has',
    J(r.noTarget.concat(r.unknownMob).slice(0, 5)));
  check(r.zeroCount.length === 0, 'no kill quest asks for zero of anything', J(r.zeroCount.slice(0, 5)));
  check(r.missingPrereq.length === 0, 'every prerequisite is a quest that exists', J(r.missingPrereq.slice(0, 5)));
  check(r.cycles.length === 0, 'no quest is its own prerequisite, however long the chain', J(r.cycles.slice(0, 3)));
  check(r.gatedUnderPrereq.length === 0, 'no quest opens below the level of the quest it follows', J(r.gatedUnderPrereq.slice(0, 5)));
  check(r.noReward.length === 0, 'every quest pays something', J(r.noReward.slice(0, 5)));
  check(r.badNumber.length === 0, 'every reward number is finite and not negative', J(r.badNumber.slice(0, 5)));
  check(r.badPotion.length === 0, 'every potion reward names a potion that exists', J(r.badPotion.slice(0, 5)));
  check(r.overCeiling.length === 0, 'no quest pays more than 80% of its own level', J(r.overCeiling.slice(0, 5)));
  check(r.paysNothing.length === 0, 'no quest with an EXP reward pays zero', J(r.paysNothing.slice(0, 5)));
  check(r.offBand.length === 0, 'no quest pays more than three fifths of a level', r.offBand.length + ' off: ' + J(r.offBand.slice(0, 6)));
  {
    // Lv 1-10 is out: the whole chapter costs 2,531 kills, less than one Lv 20 level, and the
    // 0.60 cap clips its quests - a "40% of the band" reading there means nothing.
    const bands = Object.keys(r.bandShare).filter((b) => (r.bandN[b] | 0) >= 4 && +b >= 1);
    // bandShare is in LEVELS: ten levels in a band, so 40% of it is 4.00
    const off = bands.filter((b) => r.bandShare[b] / 10 < 0.34 || r.bandShare[b] / 10 > 0.46)
      .map((b) => 'Lv' + (b * 10 + 1) + '-' + (b * 10 + 10) + '=' + r.bandShare[b].toFixed(2) + ' levels');
    check(bands.length >= 8 && off.length === 0, 'a ten-level band of quests is worth about 40% of that band between them',
      J(bands.map((b) => (b * 10 + 1) + ':' + r.bandShare[b].toFixed(2))));
  }
  check(r.overSupply.length === 0, 'no hunt asks for more of a monster than the world holds one of', J(r.overSupply.slice(0, 6)));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
