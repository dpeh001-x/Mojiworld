// RELEASE HUNT 3 (per user: "Yes fix and search for more bugs") - the second hunt's verified defects stay fixed:
//   B1. the Woman Who Turned Back's Mirror Shards die with her (her revive keeps them; her real death clears them)
//   B2. King Krook's falling lava stops once he is down
//   B3. a split Gemini twin does not count as a second Gemini kill in the bestiary
//   Q1. the Twelve Houses counts its beaten signs (it read 0/12 with eleven down)
//   Q2. a multi-objective quest counts the total of its objectives (three counted only the first: "8/8" with most left)
//   Q3. the quest guide skips an objective that is already done
//   Q4. the Track toast names the creature, not its id
//   node scripts/release3_bughunt_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11941), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player._gravitosCineSeen = true; player.level = 80; player.invulnerable = 1e9; player._god = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    for (const k of ['captains_teaser', 'barnaby_fall', 'mira_ashes', 'mira_aetherion', 'aetherion_release']) player._storyBeatsSeen[k] = true;
    const clear = () => { try { closeAllModals(); } catch (e) {} const d = document.getElementById('dialog'); if (d && d.style.display === 'block') try { closeDialog(); } catch (e) {} game.paused = false; };
    const boss = async (map, type) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[map] = true; loadMap(map, 300); await sleep(1800); clear();
      let b = null; for (let i = 0; i < 40 && !b; i++) { b = game.monsters.find((q) => q.type === type && q.currentHp > 0); if (!b) await sleep(250); } return b; };
    // B1
    const m = await boss('lastStep', 'miraFallen'); out.b1 = { found: !!m };
    if (m) {
      for (let i = 0; i < 4; i++) { const sh = spawnMonster(m.x + m.w / 2, m.y + m.h / 2, 'miraEchoShard', false); if (sh) sh._miraShardOf = m; }
      const shards = () => game.monsters.filter((q) => q._miraShardOf === m && q.currentHp > 0).length;
      out.b1.before = shards();
      m.currentHp = 0; killMonster(m); await sleep(900); clear(); out.b1.afterRevive = shards(); out.b1.revived = !!m._revivedOnce;
      for (let k = 0; k < 3 && game.monsters.includes(m); k++) { m.currentHp = 0; killMonster(m); await sleep(900); clear(); }
      out.b1.afterDeath = shards();
    }
    // B2
    const k = await boss('krookThrone', 'kingKrook'); out.b2 = { found: !!k };
    if (k) {
      for (let i = 0; i < 3 && game.monsters.includes(k); i++) { k.currentHp = 0; killMonster(k); await sleep(700); clear(); }
      game.hazards = (game.hazards || []).filter((h) => h.type !== 'lava_drop'); const seen = new Set();
      for (let t = 0; t < 100; t++) { await sleep(200); for (const h of (game.hazards || [])) if (h && h.type === 'lava_drop') seen.add(h); }
      out.b2.lava = seen.size; out.b2.dead = !game.monsters.some((q) => q.type === 'kingKrook' && q.currentHp > 0);
    }
    // B3 (the guard is in killMonster's rewards; a full Gemini split is not forced here)
    { const src = [...document.scripts].map((x) => x.textContent).join('\n');
      out.b3 = { src: src.includes("if (!_isIllusionKill && !_lxTwinKill) trackPickup('kill', { type: m.type });"), old: src.includes("if (!_isIllusionKill) trackPickup('kill', { type: m.type });") }; }
    // Q1
    player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.bestiary = game.bestiary || {};
    player.quests.active.q_zodiac_twelve = { progress: 0 };
    ZODIAC_SIGNS.slice(0, 11).forEach((z) => { game.bestiary['_boss_zodiac_' + z.id] = 1; });
    renderQuestTracker(); await sleep(100);
    out.q1 = { progress: player.quests.active.q_zodiac_twelve.progress, tracker: document.getElementById('quest-tracker').textContent.replace(/\s+/g, ' ').slice(0, 200) };
    // Q2
    _lxNormaliseQuestCounts();
    out.q2 = ['q_lyra_kin', 'q_barnaby_five', 'q_dream_closer'].map((id) => ({ id, count: QUESTS[id].count, sum: QUESTS[id].objectives.reduce((s, o) => s + o.count, 0) }));
    out.q2all = Object.keys(QUESTS).filter((id) => Array.isArray(QUESTS[id].objectives) && QUESTS[id].objectives.length && QUESTS[id].count !== QUESTS[id].objectives.reduce((s, o) => s + o.count, 0));
    // Q3
    player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); player.level = 40;
    const hq = QUESTS.q_hourglass_2, first = hq.objectives[0];
    player.quests.active.q_hourglass_2 = { progress: first.count, objProgress: { [first.target]: first.count } };
    const d = _qnavDest('q_hourglass_2'); out.q3 = { first: first.target, who: d && d.who, kind: d && d.kind };
    // Q4
    out.q4 = _qnavLabel({ kind: 'hunt', who: 'gummy', map: 'candyCanyon' });
    // U2 / U5 (source), U3 (live)
    { const src = [...document.scripts].map((x) => x.textContent).join('\n');
      out.u2 = { live: src.split('_mjxLive(k, t).hp, mh)').length - 1, raw: src.split("${bar('Vigor', t.hp, mh)}").length - 1, snail: _mjxLive('snail').hp, rawSnail: monsterTypes.snail.hp };
      const gem = document.querySelector('.lx-idp-sp'); out.u5 = !!gem && /game\._uTab = 'lp'; if \(typeof openLevelUpPanel/.test(gem.getAttribute('onclick') || ''); }
    player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); player.level = 12; player.quests.active.q_kill_gummy = { progress: 0 };
    loadMap('forest', 300); await sleep(1200); clear();
    game.qnav = 'q_kill_gummy'; await sleep(400); _qnavDrawKey(); const qk = () => { const e = document.getElementById('qnav-key'); return e ? e.style.display : 'none'; };
    out.u3 = { open: qk() }; game.paused = true; _qnavDrawKey(); out.u3.paused = qk(); game.paused = false; _qnavDrawKey(); out.u3.back = qk();
    return out;
  });
  // U1: Esc from a slider inside Settings closes Settings (it did nothing)
  await page.evaluate(() => { openSettingsModal(); });
  await page.waitForTimeout(400);
  const setBg = () => page.evaluate(() => { const e = document.getElementById('settings-modal-bg'); return !!e && getComputedStyle(e).display !== 'none'; });
  const u1open = await setBg();
  await page.focus('#set-bgm'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const u1after = await setBg();
  ok('B1. her revive keeps the Mirror Shards; her real death clears them', R.b1.found && R.b1.before >= 4 && R.b1.revived && R.b1.afterRevive >= 1 && R.b1.afterDeath === 0, R.b1);
  ok('B2. no lava falls in Krook\'s arena once he is down', R.b2.found && R.b2.dead && R.b2.lava === 0, R.b2);
  ok('B3. a split twin does not feed the bestiary a second kill', R.b3.src && !R.b3.old, R.b3);
  ok('Q1. the Twelve Houses counts its beaten signs (11/12)', R.q1.progress === 11, R.q1);
  ok('Q2. every multi-objective quest counts the total of its objectives', R.q2.every((x) => x.count === x.sum) && R.q2all.length === 0, { q2: R.q2, off: R.q2all });
  ok('Q3. the guide skips an objective already done', R.q3.kind === 'hunt' && R.q3.who && R.q3.who !== R.q3.first, R.q3);
  ok('Q4. the Track toast names the creature, not its id', /Gummibeau/.test(R.q4) && !/^gummy/.test(R.q4), R.q4);
  ok('U1. Esc from a slider inside Settings closes Settings', u1open && !u1after, { u1open, u1after });
  ok('U2. the MojiDex stat bars read the stats a monster really spawns with', R.u2.live === 3 && R.u2.raw === 0, R.u2);
  ok('U3. the quest-guide chip hides while a panel has the game paused, and comes back', R.u3.paused === 'none' && R.u3.back !== 'none', R.u3);
  ok('U5. the SP gem opens the Level Up tab', R.u5 === true);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
