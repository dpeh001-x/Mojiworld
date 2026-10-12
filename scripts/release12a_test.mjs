// RELEASE 12a stays fixed (all three per user):
//   1 after the siblings' reunion (the real siblings_reunion scene, played by talking to her once the story is done) the
//     Amnesiac's greeting line, "What are you struggling to remember?" and "The woman at the gate?", and her "Your brother?"
//     and "Should I tell him?" read the approved after-lines; before it they are unchanged
//   2 The Long Dawn I waits for the First-Born (q_boss_aries), not all Twelve: Lv 70 + Aries opens it, Long Dawn II follows at
//     76; a saved hero who was waiting on the Twelve finds it open after Continue; a taken / finished one is kept; the last
//     Twelve stanza and the Codex no longer put the tyrants after all Twelve; the finale's own requirements are unchanged
//   3 Sunset Coast shows no "Lv 3+" (W-map tooltip, W-map card, area title card) and no door gates it; levelReq stays 3
//   node scripts/release12a_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 14861), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) + ']' : '')); };
const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const bootIn = async (page) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
};
const setup = `try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  player._tutorialSeen = true; window._prologueAfterCreation = false; window._lxAwaitingCreation = false;
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) applyClass('warrior'); player.level = 80; player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;`;
const OLD = { greet: "I'd tell you which, but I can't remember that either.", fam: "I can't find a single face.", gate: 'Her name is still on the tip of my tongue.', bro: 'He does not remember my name. I have never told him.', tell: 'I can wait a little longer.' };
const NEW = { greet: 'I gave a dream away once, at a gate. I know which one now, and I would not take it back.',
  fam: 'My family. I found one face, at the top of a stair. That is a start. The noise in my head has gone quiet. Some mornings I almost miss it.',
  gate: 'I climbed every step and said her name before I knew I knew it. She said mine back. Ages, and the first thing I remember is that I was not the only one waiting.',
  gateDir: 'His thumb is still. He does not reach for the ring.',
  bro: 'He said my name first. He climbed every step to say it, then stood there as if he had forgotten what came next. He had not. We have ages of things to say, and no hurry now.',
  tell: 'Tell him? He found it himself. That was the only way it could count.' };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await bootIn(page);
  // ---------------- 1. the reunion ----------------
  const R1 = await page.evaluate(async (setup) => {
    eval(setup);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) if (k !== 'siblings_reunion' && k !== 'epilogue_gravitos') player._storyBeatsSeen[k] = true;
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    // the typewriter: wait until it is done AND the text has stopped growing (a long greeting outran a typing-class-only wait)
    const settle = async () => { const d = document.getElementById('dialog'); let last = null;
      for (let i = 0; i < 100; i++) { await sleep(150); const t = text(); if (!d.classList.contains('typing') && t === last) break; last = t; } await sleep(100); };
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); game.paused = false; };
    const ov = () => document.getElementById('story-beat-overlay'), beatOn = () => !!(ov() && ov().classList.contains('on'));
    const spk = () => (document.getElementById('story-beat-speaker') || {}).textContent || '';
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(100); } return false; };
    const npc = (role) => game.mapData.npcs.find((n) => n.role === role);
    const his = async () => {
      loadMap('town', 400); await sleep(1500); game.paused = false; const r = {};
      openNPC(npc('amnesiac')); await sleep(300); await settle(); r.greet = text();
      await click(/Talk/); await settle(); await click(/What are you struggling to remember\?/); await settle(); r.fam = text(); await close();
      openNPC(npc('amnesiac')); await sleep(300); await click(/Talk/); await settle(); r.gateOpt = await click(/The woman at the gate\?/); await settle(); r.gate = text(); await close();
      return r;
    };
    const hers = async () => {
      const r = {}; openNPC(npc('sage')); await sleep(300); await settle();
      await click(/Who are you\?/); await settle(); r.broOpt = await click(/Your brother\?/); await settle(); r.bro = text();
      r.tellOpt = await click(/Should I tell him\?/); await settle(); r.tell = text(); await close();
      return r;
    };
    out.preHis = await his();
    loadMap('wayfarersLantern2', 400); await sleep(1500); game.paused = false;
    out.preHers = await hers();
    // the ending is done: talking to her plays the reunion (the real scene sets the flag)
    player._storyBeatsSeen.epilogue_gravitos = true;
    openNPC(npc('sage')); out.beat = await waitFor(() => beatOn() && spk() === 'Mira', 4000); out.beatSpeakers = [];
    for (let i = 0; i < 60 && beatOn(); i++) { if (!out.beatSpeakers.includes(spk())) out.beatSpeakers.push(spk()); ov().click(); await sleep(300); }
    out.flag = !!player._storyBeatsSeen.siblings_reunion; await sleep(500); await close();
    out.postHers = await hers();
    out.postHis = await his();
    return out;
  }, setup);
  const has = (t, s) => String(t || '').includes(s);
  ok('1. before the reunion his pages are unchanged (greeting, family, the woman at the gate)', has(R1.preHis.greet, OLD.greet) && has(R1.preHis.fam, OLD.fam) && R1.preHis.gateOpt && has(R1.preHis.gate, OLD.gate) && !has(R1.preHis.gate, NEW.gate), R1.preHis);
  ok('1. before the reunion her pages are unchanged ("Your brother?", "Should I tell him?")', R1.preHers.broOpt && has(R1.preHers.bro, OLD.bro) && R1.preHers.tellOpt && has(R1.preHers.tell, OLD.tell), R1.preHers);
  ok('1. the reunion scene plays from her (Mira, then him) and records siblings_reunion', R1.beat && R1.flag && R1.beatSpeakers.includes('The Amnesiac'), { beat: R1.beat, flag: R1.flag, sp: R1.beatSpeakers });
  ok('1. after: his greeting ends with the approved line', has(R1.postHis.greet, NEW.greet) && !has(R1.postHis.greet, OLD.greet), R1.postHis.greet.slice(-160));
  ok('1. his greeting opens with the ring before the reunion, and with still hands after it (release13)', has(R1.preHis.greet, 'His thumb turns a ring that is not on it') && has(R1.postHis.greet, 'His hands are still. For once, his thumb does not go looking for the ring.') && !has(R1.postHis.greet, 'His thumb turns a ring'), { pre: String(R1.preHis.greet || '').slice(0, 400), post: String(R1.postHis.greet || '').slice(0, 400) });
  ok('1. after: "What are you struggling to remember?" reads the approved page', has(R1.postHis.fam, NEW.fam) && !has(R1.postHis.fam, OLD.fam), R1.postHis.fam);
  ok('1. after: "The woman at the gate?" - his thumb is still, and the approved page', R1.postHis.gateOpt && has(R1.postHis.gate, NEW.gateDir) && has(R1.postHis.gate, NEW.gate) && !has(R1.postHis.gate, OLD.gate), R1.postHis.gate);
  ok('1. after: her "Your brother?" and "Should I tell him?" read the approved pages', R1.postHers.broOpt && has(R1.postHers.bro, NEW.bro) && !has(R1.postHers.bro, OLD.bro) && R1.postHers.tellOpt && R1.postHers.tell.trim() === NEW.tell, R1.postHers);
  ok('1. none of the five new pages names her', ![R1.postHis.greet.slice(-200), R1.postHis.fam, R1.postHis.gate, R1.postHers.bro, R1.postHers.tell].some((t) => /Mira/.test(t)));
  // ---------------- 2. the Long Dawn ----------------
  const R2 = await page.evaluate(async () => {
    const out = {}; const fresh = (done, lv) => { player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); for (const k of done) player.quests.completed[k] = 1; player.level = lv; };
    out.prereq = QUESTS.q_long_dawn_1.prereq; out.lv1 = QUESTS.q_long_dawn_1.levelReq; out.lv2 = QUESTS.q_long_dawn_2.levelReq;
    out.grav = { prereq: [].concat(QUESTS.q_boss_gravitos.prereq), lv: QUESTS.q_boss_gravitos.levelReq };
    fresh(['q_boss_aetherion', 'q_boss_aries'], 70); tickQuestUnlocks(); out.ariesOpen = !!player.quests.unlocked.q_long_dawn_1; out.accept = acceptQuest('q_long_dawn_1') !== false && !!player.quests.active.q_long_dawn_1;
    try { _completeQuest('q_long_dawn_1'); } catch (e) { out.cErr = String(e.message); } player.level = 76; tickQuestUnlocks(); out.ld2 = !!(player.quests.unlocked.q_long_dawn_2 || player.quests.active.q_long_dawn_2);
    fresh(['q_boss_aetherion'], 92); tickQuestUnlocks(); out.noAries = !!player.quests.unlocked.q_long_dawn_1;
    fresh([], 75); player.quests.unlocked.q_long_dawn_1 = true; player.quests.active.q_long_dawn_1 = { progress: 0 }; tickQuestUnlocks(); out.keptActive = !!player.quests.active.q_long_dawn_1;
    fresh(['q_long_dawn_1'], 75); tickQuestUnlocks(); out.keptDone = !!player.quests.completed.q_long_dawn_1;
    const st = STORY_BEATS.zodiac_twelve_done.stanzas, last = st[st.length - 1], tx = () => (typeof last.text === 'function' ? last.text({}) : last.text);
    fresh([], 92); out.beatBefore = tx(); fresh(['q_long_dawn_1'], 92); out.beatAfter = tx();
    // the save: Aries down, Lv 72, still waiting on the Twelve
    fresh(['q_boss_aetherion', 'q_boss_aries', 'q_boss_sundered_smith'], 72); delete player.quests.unlocked.q_long_dawn_1; game._resetting = false; _flushSaveStateNow();
    out.saved = (() => { try { const p = JSON.parse(localStorage.getItem(SAVE_KEY)).player; return { lv: p.level, aries: !!p.quests.completed.q_boss_aries, ld1: !!(p.quests.unlocked || {}).q_long_dawn_1 }; } catch (e) { return String(e.message); } })();
    return out;
  });
  ok('2. q_long_dawn_1 waits for the First-Born (prereq q_boss_aries), labels Lv 70 / Lv 76 kept', R2.prereq === 'q_boss_aries' && R2.lv1 === 70 && R2.lv2 === 76, R2);
  ok('2. Lv 70 + the First-Born down opens and takes The Long Dawn I with the Twelve still standing', R2.ariesOpen && R2.accept, R2);
  ok('2. ...and finishing it opens Long Dawn II at Lv 76', R2.ld2, R2);
  ok('2. without the First-Born it stays shut (Lv 92)', R2.noAries === false, R2);
  ok('2. a save that already took / finished it keeps it', R2.keptActive && R2.keptDone, R2);
  ok('2. the twelfth sign\'s last stanza: tyrants still ahead before Long Dawn I, already let go after it', /But three old tyrants still hold their nightmares\./.test(R2.beatBefore) && /The three old tyrants have already let go\./.test(R2.beatAfter), [R2.beatBefore, R2.beatAfter]);
  ok('2. the Codex prophecy puts the tyrants after the first of the Twelve', src.includes('When the Ram falls, three tyrants') && !src.includes('When the Twelve are at rest'));
  ok('2. the finale is unchanged: Petition the Weight-Bearer, Lv 90, needs all Twelve + Aries + Long Dawn II', R2.grav.lv === 90 && ['q_zodiac_twelve', 'q_boss_aries', 'q_long_dawn_2', 'q_boss_aetherion', 'q_boss_sundered_smith', 'q_hourglass_5'].every((k) => R2.grav.prereq.includes(k)), R2.grav);
  // the saved hero comes back
  await bootIn(page);
  await page.click('#menu-continue').catch(() => {});
  await page.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return (!o || o.classList.contains('fade') || getComputedStyle(o).display === 'none') && !!player.cls; }, null, { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const R2b = await page.evaluate(() => ({ lv: player.level, aries: !!player.quests.completed.q_boss_aries, ld1: !!player.quests.unlocked.q_long_dawn_1, twelve: !!player.quests.completed.q_zodiac_twelve }));
  ok('2. a saved Lv 72 hero with the First-Born down (waiting on the Twelve) finds Long Dawn I open after Continue', R2.saved && R2.saved.aries && R2b.lv === 72 && R2b.aries && !R2b.twelve && R2b.ld1, { saved: R2.saved, after: R2b });
  // ---------------- 3. Sunset Coast ----------------
  const R3 = await page.evaluate(async (setup) => {
    eval(setup); const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const m = MAPS.sunsetBeach; out.levelReq = m.levelReq;
    out.doors = []; for (const id in MAPS) for (const p of (MAPS[id].portals || [])) if (p.dest === 'sunsetBeach') out.doors.push({ from: id, name: p.name, gate: p.levelGate || 0 });
    out.wmGate = (typeof _wmMaxLevelGate === 'function') ? _wmMaxLevelGate('sunsetBeach') : 'n/a';
    const card = (id) => { game._lastAreaCard = null; _lxAreaTitle(id); return (document.querySelector('#area-title .at-sub') || {}).textContent; };
    out.areaSun = card('sunsetBeach'); out.areaSky = card('skyGarden');
    game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.sunsetBeach = 1; game.visitedMaps.skyGarden = 1;
    toggleWorldMap(); await sleep(1200);
    const wm = (id) => { const g = document.querySelector('#worldmap-grid g[data-map-id="' + id + '"]'); if (!g) return null; const t = g.getAttribute('aria-label') || '';   /* the tooltip's lines (its <title> is read into the label) */
      g.dispatchEvent(new MouseEvent('mouseenter')); const metas = [...document.querySelectorAll('#worldmap-grid text')].map((x) => x.textContent || '').filter((x) => /^(wilds|safe hub|boss arena)/.test(x)); return { tip: t, meta: metas.join(' | ') }; };
    out.wmSun = wm('sunsetBeach'); out.wmSky = wm('skyGarden');
    return out;
  }, setup);
  ok('3. Sunset Coast keeps levelReq 3 and no door into it carries a level gate or a level in its name', R3.levelReq === 3 && R3.doors.length > 0 && R3.doors.every((d) => !d.gate && !/Lv/.test(d.name || '')) && !R3.wmGate, R3);
  ok('3. the area title card shows no level for Sunset Coast (Sky Garden still shows its own)', R3.areaSun === '' && /Recommended Lv \d+/.test(R3.areaSky || ''), { sun: R3.areaSun, sky: R3.areaSky });
  ok('3. the W-map tooltip and card show no "Lv 3+" (Sky Garden still shows its own)', !!R3.wmSun && !/Lv 3\+/.test(R3.wmSun.tip) && !/Lv 3\+/.test(R3.wmSun.meta) && /Sunset Coast/.test(R3.wmSun.tip) && !!R3.wmSky && /Lv \d+\+ recommended/.test(R3.wmSky.tip) && /Lv \d+\+/.test(R3.wmSky.meta), { sun: R3.wmSun, sky: R3.wmSky });
  ok('no page errors', errs.length === 0, errs.slice(0, 5));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 600)); }
finally { await browser.close().catch(() => {}); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
