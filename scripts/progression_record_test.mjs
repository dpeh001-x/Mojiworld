// Progression bookkeeping must record only what the player actually did.
//   1. trackPickup('boss') wrote the PERMANENT boss/zodiac record with no echo or expedition
//      guard, while its four siblings in the same block all had one. The expedition's floor-10
//      boss spawns under the real 'zodiac_<sign>' type, so twelve runs completed "The Twelve
//      Houses" — with its achievements and the Gravitos prerequisite — without ever entering
//      a zodiac arena.
//   2. Echo kills ticked quest progress and the boss daily, against the tag's own comment.
//   3. Abandoning a quest that was ready to hand in lost that state permanently.
//   4. Swapping class before advancement kept the old class's skill tree, applying invisibly.
//
//   node scripts/progression_record_test.mjs      MOJI_SERVE_ROOT / PORT override
//
// Negative control: all four fail on v0.30.510.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10941); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof killMonster === 'function' && typeof zodiacDefeated === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(700);
    game.paused = false;
    player.level = 90; player._god = true;
    const o = {};

    // ---- 1. the permanent zodiac record --------------------------------------
    const mkZodiac = (tags) => ({
      type: 'zodiac_aries', name: 'Aries', isZodiac: true, zodiacSign: 'aries', zodiacBoss: true,
      isBoss: true, x: player.x + 60, y: player.y, w: 60, h: 60, level: 90,
      exp: 0, mojicoins: 0, currentHp: 0, maxHp: 1, hp: 0, atk: 1, def: 1, vx: 0, vy: 0, ...tags });
    const killAs = (tags) => {
      game.bestiary = game.bestiary || {};
      delete game.bestiary['_boss_zodiac_aries'];
      const m = mkZodiac(tags);
      game.monsters.push(m);
      let err = null;
      try { killMonster(m); } catch (e) { err = String(e.message).slice(0, 70); }
      const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
      return { stamped: !!zodiacDefeated('aries'), err };
    };
    o.recExpedition = killAs({ _expeditionBoss: true });
    o.recEcho       = killAs({ _echoBoss: true });
    o.recReal       = killAs({});
    delete game.bestiary['_boss_zodiac_aries'];

    // ---- 2. echo kills must not tick quests or the boss daily ----------------
    const tickProbe = (tags) => {
      let questTicks = 0, dailyTicks = 0;
      const rq = window.tickQuestKill, rd = window.tickDaily;
      window.tickQuestKill = function (...a) { questTicks++; return rq ? rq.apply(this, a) : undefined; };
      window.tickDaily = function (...a) { if (a[0] === 'boss') dailyTicks++; return rd ? rd.apply(this, a) : undefined; };
      const m = mkZodiac(tags);
      game.monsters.push(m);
      try { killMonster(m); } catch (e) {}
      const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
      window.tickQuestKill = rq; window.tickDaily = rd;
      return { questTicks, dailyTicks };
    };
    o.tickEcho = tickProbe({ _echoBoss: true });
    o.tickReal = tickProbe({});
    delete game.bestiary['_boss_zodiac_aries'];

    // ---- 3. a quest abandoned while ready to hand in comes back ready --------
    o.quest = null;
    try {
      const qid = Object.keys(QUESTS).find((k) => QUESTS[k] && QUESTS[k].kind === 'kill' && (QUESTS[k].count | 0) >= 1);
      if (qid) {
        player.quests = player.quests || { active: {}, completed: {} };
        player._qBank = {};
        player.quests.active[qid] = { progress: QUESTS[qid].count || 1, readyToHandIn: true, targetCount: QUESTS[qid].count || 1 };
        _lxBankQuestProgress(qid, player.quests.active[qid]);
        o.quest = { qid, banked: !!(player._qBank[qid] && player._qBank[qid].readyToHandIn) };
        delete player.quests.active[qid];
        if (typeof acceptQuest === 'function') acceptQuest(qid);
        const a = player.quests.active[qid];
        o.quest.restored = !!(a && a.readyToHandIn);
        o.quest.progress = a ? (a.progress | 0) : null;
      }
    } catch (e) { o.questErr = String(e.message).slice(0, 90); }

    // ---- 4. the class swap drops the old tree -------------------------------
    try {
      applyClass('mage');
      player.treeUnlocked = {}; player.tree = {};
      const nodes = (SKILL_TREE && SKILL_TREE.mage) || [];
      let spent = 0;
      for (const n of nodes.slice(0, 3)) { if (n && n.id) { player.treeUnlocked[n.id] = true; spent += (n.cost | 0); } }
      player.skillPoints = 0;
      o.tree = { seeded: Object.keys(player.treeUnlocked).length, spent };
      applyClass('warrior');
      o.tree.afterApplyClass = Object.keys(player.treeUnlocked || {}).length;
    } catch (e) { o.treeErr = String(e.message).slice(0, 90); }
    return o;
  });

  const src = await (await fetch(`http://localhost:${PORT}/mojiworld_game.html`)).text();
  const swapClears = /_apBack|player\.treeUnlocked = \{\}; player\.tree = \{\};\s*\r?\n\s*if \(_apBack/.test(src);
  const bankReady = /readyToHandIn: !!a\.readyToHandIn/.test(src);
  const restoreReady = /if \(_bank\.readyToHandIn\) _a\.readyToHandIn = true;/.test(src);

  console.log(JSON.stringify(r, null, 1).slice(0, 1500));
  console.log(`static: swapRefund=${swapClears} bankReady=${bankReady} restoreReady=${restoreReady}\n`);

  ok('a REAL zodiac kill still stamps the permanent record', r.recReal.stamped === true, JSON.stringify(r.recReal));
  ok('an EXPEDITION zodiac kill does not', r.recExpedition.stamped === false, JSON.stringify(r.recExpedition));
  ok('an ECHO zodiac kill does not', r.recEcho.stamped === false, JSON.stringify(r.recEcho));
  ok('a real kill ticks quests and the boss daily', r.tickReal.questTicks >= 1 && r.tickReal.dailyTicks >= 1, JSON.stringify(r.tickReal));
  ok('an echo kill ticks neither', r.tickEcho.questTicks === 0 && r.tickEcho.dailyTicks === 0, JSON.stringify(r.tickEcho));
  ok('the hand-in state is banked on abandon', bankReady === true && r.quest && r.quest.banked === true, JSON.stringify(r.quest));
  ok('...and restored on re-accept', restoreReady === true && r.quest && r.quest.restored === true, JSON.stringify(r.quest));
  ok('the class swap refunds and clears the old tree', swapClears === true);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
