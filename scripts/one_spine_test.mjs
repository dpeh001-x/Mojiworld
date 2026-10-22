// ONE SPINE, ONE FIGHT PER BOSS (per user: "The questline for the boss fight barnaby > smith > distorted hera > aetherion can be weaved
// better ... ensure the videos play at the right instance"; "Each boss should be only killed once for the storyline, no double kill
// required ... remove unnecessary small quests in between"). Checked on the live game:
//   1. the spine: The Distorted Portal (young Barnaby) -> The Forge That Broke (the Smith) -> The Last Step (Distorted Mira) -> The
//      Sanctum's Refusal (Aetherion, Lv 55); Barnaby I-IV and The Tear V-VI are gone and listed as retired
//   2. each of the three bosses is the target of exactly ONE quest, and nothing respawns a boss for a second kill on a quest's turn-in
//   3. films: Barnaby's fall after him and no second film on the mastery; the Smith's ashes on his (one) death, no condition left;
//      Mira's on hers; Aetherion's release on his second form's
//   4. a Smith already felled (an older save's Barnaby IV) completes The Forge That Broke with its reward when it opens - no second kill;
//      the retired quests are purged from that save
//   5. the merged cards carry the lore (Brok's list, the ticket, the blade; the note; the roll), the rewards were folded in
//   node scripts/one_spine_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 9835);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x).slice(0, 400))); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof tickQuestUnlocks === 'function' && typeof LX_KILL_FILMS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(() => {
    const out = {};
    const RET = ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish', 'q_lyra_forge', 'q_lyra_last'];
    out.gone = RET.filter((q) => QUESTS[q]);
    out.listed = RET.filter((q) => !_LX_RETIRED_QUESTS.includes(q));
    const pr = (q) => [].concat((QUESTS[q] && QUESTS[q].prereq) || []);
    out.spine = { smith: pr('q_boss_sundered_smith'), last: pr('q_last_step'), ae: pr('q_boss_aetherion'), aeLv: QUESTS.q_boss_aetherion.levelReq };
    const tgt = {}; for (const [id, q] of Object.entries(QUESTS)) if (q && q.kind === 'boss' && ['young_confused_barnaby', 'sundered_smith', 'miraFallen'].includes(q.target)) (tgt[q.target] = tgt[q.target] || []).push(id);
    out.targets = tgt;
    const src = String(typeof _completeQuest === 'function' ? _completeQuest : '');
    out.respawn = /delete game\.bossDefeated\.(sundered_forge|confusedVigil)/.test(src);
    const _q = player.quests; const _sv = JSON.stringify({ a: _q && _q.active, c: _q && _q.completed });
    const _w = (st) => { player.quests.active = st.a || {}; player.quests.completed = st.c || {}; return !!(LX_KILL_FILMS.sundered_smith.when ? LX_KILL_FILMS.sundered_smith.when() : true); };
    _ensureQuests(); const smithFilm = { early: _w({ c: { q_distorted_portal: 1 } }), quest: _w({ a: { q_boss_sundered_smith: { progress: 0 } }, c: { q_distorted_portal: 1 } }), beforePortal: _w({}) };
    { const r = JSON.parse(_sv); player.quests.active = r.a || {}; player.quests.completed = r.c || {}; }
    out.films = { smith: LX_KILL_FILMS.sundered_smith && { key: LX_KILL_FILMS.sundered_smith.key, ...smithFilm }, mira: LX_KILL_FILMS.miraFallen && LX_KILL_FILMS.miraFallen.key,
      ae: LX_KILL_FILMS.aetherion && LX_KILL_FILMS.aetherion.key, mastery: STORY_BEAT_CLIPS.advancement_2_done || null, barnaby: typeof LX_BARNABY_FALL === 'string' ? LX_BARNABY_FALL : null };
    out.cards = { smith: QUESTS.q_boss_sundered_smith.desc, portal: QUESTS.q_distorted_portal.desc, last: QUESTS.q_last_step.desc, rw: QUESTS.q_boss_sundered_smith.rewards, lrw: QUESTS.q_last_step.rewards };
    // an older save: the portal done, Barnaby IV done (its kill felled the Smith once), The Forge That Broke not yet taken, Lv 50
    try {
      player.level = 50; if (!player.cls) applyClass('warrior');
      _ensureQuests();
      player.quests.completed.q_distorted_portal = 1; player.quests.completed.q_visit_lavaCavern = 1; player.quests.completed.q_barnaby_finish = 1;   // Barnaby I needed the Forge-Key, so a Barnaby IV save has it
      player.quests.completed.q_barnaby_hands = 1;
      delete player.quests.completed.q_boss_sundered_smith; delete player.quests.active.q_boss_sundered_smith;
      game.bestiary = game.bestiary || {}; game.bestiary.sundered_smith = 1;
      const c0 = player.mojicoins | 0;
      for (let i = 0; i < 3; i++) tickQuestUnlocks();
      out.save = { done: !!player.quests.completed.q_boss_sundered_smith, paid: (player.mojicoins | 0) - c0, purged: !player.quests.completed.q_barnaby_finish && !player.quests.completed.q_barnaby_hands };
    } catch (e) { out.save = { err: String(e).slice(0, 160) }; }
    return out;
  });
  const SRC = fs.readFileSync(process.env.MOJI_GAME_FILE ? path.resolve(ROOT, process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html'), 'utf8');   // the authored coins (the game scales coin payouts at runtime)
  R.src = { smith: /rewards: { mojicoins: 111500, exp: 6324860,/.test(SRC), last: /rewards: { mojicoins: 44000, exp: 3200000,/.test(SRC) };
  ok('the retired quests are gone (Barnaby I-IV, The Tear V-VI)', R.gone.length === 0, R.gone);
  ok('and listed as retired, so old saves drop them', R.listed.length === 0, R.listed);
  ok("the spine: Portal (+ Brok's Forge-Key) -> Forge That Broke -> Last Step -> Sanctum (Lv 55)", R.spine.smith.join() === 'q_distorted_portal,q_visit_lavaCavern' && R.spine.last.join() === 'q_boss_sundered_smith' && R.spine.ae.join() === 'q_last_step' && R.spine.aeLv === 55, R.spine);
  ok('young Barnaby, the Smith and Distorted Mira are each the target of exactly one quest', ['young_confused_barnaby', 'sundered_smith', 'miraFallen'].every((t) => (R.targets[t] || []).length === 1), R.targets);
  ok('no quest turn-in respawns a boss for a second kill', !R.respawn);
  ok("films: Barnaby's fall after him, and no second film on the mastery", !!R.films.barnaby && !R.films.mastery, R.films);
  ok("films: the Smith's ashes on his first real death after the Portal (quest taken or not), Mira's on hers, Aetherion's release on his", R.films.smith && R.films.smith.key === 'mira_ashes' && R.films.smith.early && R.films.smith.quest && !R.films.smith.beforePortal && R.films.mira === 'mira_aetherion' && R.films.ae === 'aetherion_release', R.films);
  ok('an older save that already felled the Smith completes The Forge That Broke, with its reward (no second kill)', R.save.done && R.save.paid > 0, R.save);
  ok('and its retired quests are purged', R.save.purged, R.save);
  ok("The Forge That Broke carries Brok's list, the ticket and the blade", /five times, in five hands/.test(R.cards.smith) && /Make it honest/.test(R.cards.smith) && /fuse magic into the smithing/.test(R.cards.smith) && /reaching back/.test(R.cards.smith));
  ok("The Distorted Portal carries Barnaby's note; The Last Step carries the roll", /Barnaby's note: put it down\./.test(R.cards.portal) && /roll of twelve expeditions/.test(R.cards.last));
  ok("the retired quests' rewards are folded in (Smith 111,500 / 6.32M, Last Step 44,000 / 3.2M)", R.cards.rw.exp === 6324860 && R.cards.lrw.exp === 3200000 && R.cards.rw.gearTier === 5 && R.cards.lrw.gearTier === 5 && R.src.smith && R.src.last, [R.cards.rw, R.cards.lrw]);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
