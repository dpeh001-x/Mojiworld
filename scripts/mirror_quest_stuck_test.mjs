// Live test: A QUEST FOR A ONE-TIME BOSS CAN NEVER BE UNSATISFIABLE.
//
// Per user, with a screenshot: "quest was long done before but its still in my
// quest log" - "0 · The Small Aperture" stuck ACTIVE at 0/1 on "Hunt Mirror
// Self — The Inner Dimension · no walking route", on a Lv-29 Archer.
//
// Two quests want the same one-time boss (q_inner_dim_trial, q_lyra_aperture)
// but the only door to him - the class instructor's "Prove yourself in the
// Inner Dimension" option - was gated on !completed.q_inner_dim_trial. Finish
// the trial and the room seals; Auron still hands out the Aperture quest
// afterwards, and it is then unsatisfiable for the life of the save.
//
// Pinned here: (a) the door stays open while any mirrorSelf quest is live, for
// all four classes; (b) a save that already killed the Mirror gets the credit
// it earned and routes to its hand-in; (c) the repair never fires for a player
// who has NOT beaten the Mirror.
//   node scripts/mirror_quest_stuck_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openNPC === 'function' && typeof QUESTS === 'object', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);

// the screenshot's save: trial long completed, Aperture accepted later, 0/1
const setStuck = (cls) => page.evaluate((c) => {
  if (typeof _ensureQuests === 'function') _ensureQuests();
  player.cls = c; player.level = 29; player._god = true;
  player.quests.completed = { q_inner_dim_trial: Date.now() };
  player.quests.active = { q_lyra_aperture: { progress: 0 } };
  player.quests.unlocked = {};
  return true;
}, cls);

// ---- (a) the door is open again, for every class ---------------------------
const INSTRUCTOR = { warrior: 'Will', mage: 'Hera', archer: 'Lady Hong', rogue: 'Taiga' };
const ROLE = { warrior: 'champion', mage: 'archmage', archer: 'archer', rogue: 'taiga' };
const sealed = [];
for (const cls of ['warrior', 'mage', 'archer', 'rogue']) {
  await setStuck(cls);
  await page.evaluate(() => { try { loadMap('town'); } catch (e) {} });
  await page.waitForTimeout(500);
  const opts = await page.evaluate(([name, role]) => {
    try { openNPC({ name, role }); } catch (e) {}
    const o = [...document.querySelectorAll('#dialog-options button')].map((x) => x.textContent.trim());
    try { if (typeof closeDialog === 'function') closeDialog(); } catch (e) {}
    return o;
  }, [INSTRUCTOR[cls], ROLE[cls]]);
  if (!opts.some((t) => /Inner Dimension/.test(t))) sealed.push({ cls, npc: INSTRUCTOR[cls], opts });
}
ok('with an unsatisfied Mirror quest, every instructor still opens the Inner Dimension',
  sealed.length === 0,
  { sealed, note: 'the door was gated on !completed.q_inner_dim_trial, so it sealed the moment the trial was done' });

// ---- (b) an already-earned kill is credited and routed to its hand-in ------
await setStuck('archer');
const repaired = await page.evaluate(() => {
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  const a = (player.quests.active || {}).q_lyra_aperture;
  const done = !!(player.quests.completed || {}).q_lyra_aperture;
  return { stillActive: !!a, progress: a ? a.progress : null, ready: a ? !!a.readyToHandIn : null,
    completed: done, need: QUESTS.q_lyra_aperture.count, handIn: !!QUESTS.q_lyra_aperture.handIn,
    giver: QUESTS.q_lyra_aperture.giver };
});
ok('a save that already beat the Mirror gets the credit it earned',
  (repaired.progress >= repaired.need) || repaired.completed, repaired);
ok('...and it routes to Auron for the hand-in rather than auto-paying',
  repaired.completed === false && repaired.ready === true, repaired);

// ---- (c) the repair must NOT fire for someone who never beat the Mirror ----
const untouched = await page.evaluate(() => {
  if (typeof _ensureQuests === 'function') _ensureQuests();
  player.cls = 'archer'; player.level = 29;
  player.quests.completed = {};                       // no trial: no proof of a kill
  player.quests.active = { q_lyra_aperture: { progress: 0 } };
  player.quests.unlocked = {};
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  const a = (player.quests.active || {}).q_lyra_aperture;
  return { progress: a ? a.progress : null, ready: a ? !!a.readyToHandIn : null,
    completed: !!(player.quests.completed || {}).q_lyra_aperture };
});
ok('a player who has NOT beaten the Mirror is never handed the credit',
  untouched.progress === 0 && untouched.ready === false && untouched.completed === false, untouched);

// ---- and the Mirror really is fightable again ------------------------------
const refight = await page.evaluate(async () => {
  if (typeof _ensureQuests === 'function') _ensureQuests();
  player.cls = 'archer'; player.level = 29; player._god = true;
  player.quests.completed = { q_inner_dim_trial: Date.now() };
  player.quests.active = { q_lyra_aperture: { progress: 0 } };
  try { loadMap('innerDimension', 100); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 90) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  return { map: game.currentMap, mirrorPresent: game.monsters.some((m) => m && m.type === 'mirrorSelf') };
});
ok('the Inner Dimension still spawns a Mirror to fight when you get back in',
  refight.map === 'innerDimension' && refight.mirrorPresent, refight);

ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 400));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
