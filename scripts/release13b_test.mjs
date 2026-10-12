// RELEASE 13b stays fixed:
//   1 a world click on an NPC out of the talk key's reach opens nothing (the dialog pauses the game: no free pause from across
//     the map) and says "Walk closer to talk to <name>."; in reach it opens; a far click leaves an open conversation as it is;
//     the release8 touch rule (a tap does not switch conversations) is still there
//   2 Marbella's "Bosses still walking the world" empties once every recordable boss is down (The Arbiter and The Sovereign of
//     the Spire live only in the Expedition tower, whose kills are never recorded)
//   3 with all twelve signs down: the Amnesiac's "What is the Everdawn?" (Act 3) and "Why was I sent here?" pages and the
//     Journal's Act 3 summary are past tense; before, unchanged
//   4 after the ending Barnaby's Craft page and "What did you make?" have bare hands; before, gloved
//   5 The Twelve Houses: a navigator destination (Zodiac Sanctum) and a tracker line; Lyra's cut names Elder Arlen and his map;
//     the Master Conductor's two quests say "Warp with Milo" (tracker + navigator)
//   node scripts/release13b_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 14871), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const require = createRequire(path.join(SERVE_ROOT, 'package.json')); const { chromium } = require('playwright-core');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) + ']' : '')); };
const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const setup = `try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  player._tutorialSeen = true; window._prologueAfterCreation = false; window._lxAwaitingCreation = false;
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) applyClass('warrior'); player.level = 80; player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
  player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) if (k !== 'epilogue_gravitos') player._storyBeatsSeen[k] = true;`;
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async (setup) => {
    eval(setup);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const dlg = document.getElementById('dialog'), text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const isOpen = () => dlg.style.display === 'block', name = () => document.getElementById('dialog-name').textContent;
    const settle = async () => { let last = null; for (let i = 0; i < 100; i++) { await sleep(150); const t = text(); if (!dlg.classList.contains('typing') && t === last) break; last = t; } await sleep(100); };
    const close = async () => { try { closeDialog(); } catch (e) {} try { closeAllModals(); } catch (e) {} await sleep(200); game.paused = false; };
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const npc = (n) => game.npcs.find((x) => x.name === n);
    const toasts = () => [...document.querySelectorAll('#toast-container .toast')].map((t) => t.textContent || '').join(' | ');
    // ---------------- 1. click-to-talk reach ----------------
    loadMap('town', 300); await sleep(1500); await close();
    const amn = npc('The Amnesiac'), bravo = npc('Bravo'), bravoX0 = bravo.x;
    const street = (x) => { player.x = x - player.w / 2; player.y = 480 - player.h; player.vx = 0; player.vy = 0; };
    const clickNpc = (n) => { const c = document.getElementById('game'), b = c.getBoundingClientRect(), wy = n.y + 44 - _lxNpcDrawnH(n) + 10;
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.left + (n.x - (game.camera.x || 0)) * b.width / W, clientY: b.top + (wy - (game.camera.y || 0)) * b.height / H })); };
    street(amn.x - 220); await sleep(800); street(amn.x - 220); await sleep(200);
    clickNpc(amn); await sleep(300);
    out.far = { open: isOpen(), paused: !!game.paused, toast: toasts(), dx: Math.round(Math.abs(player.x + player.w / 2 - amn.x)) }; await close();
    street(amn.x - 40); await sleep(800); street(amn.x - 40); await sleep(200);
    clickNpc(amn); await sleep(300); out.near = { open: isOpen(), name: name() };
    bravo.x = amn.x + 240; await sleep(100); clickNpc(bravo); await sleep(300);
    out.swapFar = { open: isOpen(), name: name(), toast: toasts() }; bravo.x = bravoX0; await close();
    // ---------------- 2. Marbella ----------------
    loadMap('everdawn_megamall', 1200); await sleep(1500); await close();
    const marb = npc('Marbella'); game.bestiary = game.bestiary || {};
    const bosses = BOSS_SPRITE_TYPES.filter((b) => !!monsterTypes[b] && !/^(aetherion2|gravitos2|gravitos3|gravitos2star|gravitos3star|towerArbiter|towerSovereign)$/.test(b));
    for (const b of bosses) if (b !== 'kingKrook') game.bestiary['_boss_' + b] = 1;
    openNPC(marb); await settle(); out.marbKrook = text(); await close();
    game.bestiary._boss_kingKrook = 1;
    openNPC(marb); await settle(); out.marbAll = text(); await close();
    // ---------------- 4. Barnaby ----------------
    const barn = npc('Barnaby'); player.quests.completed.q_barnaby_finish = 1;
    const barnPages = async () => { const r = {}; game._brokMenu = 'craft'; openNPC(barn); await settle(); r.craft = text(); await close();
      game._brokMenu = null; openNPC(barn); await settle(); r.madeOpt = await click(/What did you make\?/); await settle(); r.made = text(); await close(); return r; };
    out.barnBefore = await barnPages();
    player._storyBeatsSeen.epilogue_gravitos = true; out.dawn = _lxBarnabyDawn();
    out.barnAfter = await barnPages();
    delete player._storyBeatsSeen.epilogue_gravitos; if (player.titles) delete player.titles[LX_TITLE_CONQUEROR];
    // ---------------- 3. the Twelve ----------------
    loadMap('town', 300); await sleep(1500); await close();
    game.bestiary.aetherion = 1; player.dawnFragments = ['frag_smith', 'frag_aetherion', 'frag_aries'];
    const setSigns = (n) => ZODIAC_SIGNS.forEach((z, i) => { if (i < n) game.bestiary['_boss_zodiac_' + z.id] = 1; else delete game.bestiary['_boss_zodiac_' + z.id]; });
    const amnPages = async () => { const r = {}; r.down = _lxTwelveDown(); r.act = _sagaState().act; r.blurb = _sagaState().actInfo.blurb;
      game._amnesiacSagaView = true; openNPC(npc('The Amnesiac')); await settle(); r.saga = text(); await close(); game._amnesiacSagaView = false;
      game._amnesiacStage = 6; openNPC(npc('The Amnesiac')); await settle(); r.why = text(); await close(); game._amnesiacStage = 0;
      toggleQuestJournal(); await sleep(400); const sg = document.querySelector('.qj-saga'); r.jTitle = sg ? sg.getAttribute('title') : null; await close();
      return r; };
    setSigns(5); out.twBefore = await amnPages();
    setSigns(12); out.twAfter = await amnPages();
    // ---------------- 5. tracker + navigator ----------------
    setSigns(3);
    for (const id of ['q_zodiac_twelve', 'q_lyra_cut', 'q_lyra_aperture', 'q_pq_finale']) player.quests.active[id] = { progress: 0, objProgress: {} };
    const g = (id) => { const x = _questGuidance(id, QUESTS[id], player.quests.active[id]); return x ? x.text : null; };
    const d = (id) => { const x = _qnavDest(id); return x ? { map: x.map, who: x.who, verb: x.verb } : null; };
    out.q = { twelveG: g('q_zodiac_twelve'), twelveD: d('q_zodiac_twelve'), cutG: g('q_lyra_cut'), apG: g('q_lyra_aperture'), finG: g('q_pq_finale'), finD: d('q_pq_finale'), apD: d('q_lyra_aperture'),
      arlen: monsterTypes.vigil_vermillion && monsterTypes.vigil_vermillion.name, frMap: MAPS.fracturedReflection && MAPS.fracturedReflection.name, zh: MAPS.zodiacHall.name };
    return out;
  }, setup);
  const has = (t, s) => String(t || '').includes(s);
  ok('1. a click on an NPC out of talk reach opens nothing and does not pause the game', !R.far.open && !R.far.paused && R.far.dx > 70, R.far);
  ok('1. ...and says "Walk closer to talk to The Amnesiac."', has(R.far.toast, 'Walk closer to talk to The Amnesiac.'), R.far.toast);
  ok('1. in reach the same click opens him', R.near.open && R.near.name === 'The Amnesiac', R.near);
  ok('1. mid-conversation, a click on a far NPC leaves the conversation open and says so', R.swapFar.open && R.swapFar.name === 'The Amnesiac' && has(R.swapFar.toast, 'Walk closer to talk to Bravo.'), R.swapFar);
  ok('1. the release8 touch rule (a tap does not switch conversations) is still in the click handler', src.includes("if (typeof _lxIsTouchDevice === 'function' && _lxIsTouchDevice()) return;   // v0.30.1722 release8"));
  ok('2. Marbella still lists a boss left standing (King Krook)', /Bosses still walking the world: [^\n]*King Krook/.test(R.marbKrook) && !/The Arbiter|Sovereign of the Spire/.test(R.marbKrook), R.marbKrook.slice(-160));
  ok('2. every recordable boss down: her list is empty (no Arbiter, no Sovereign)', /Bosses still walking the world: none/.test(R.marbAll) && !/The Arbiter|Sovereign of the Spire/.test(R.marbAll), R.marbAll.slice(-160));
  const B = R.twBefore, A = R.twAfter;
  ok('3. five signs down (Act 3): his pages and the Journal still have the Twelve up there', !B.down && B.act === 3 && has(B.saga, 'a champion stuck mid-question inside each, still up there') && has(B.why, 'each is still up there, stuck mid-question') && has(B.jTitle, 'All twelve are still up there'), B);
  ok('3. all twelve down: "What is the Everdawn?" is past tense', A.down && A.act === 3 && has(A.saga, 'You answered every one of them, and they are at rest now.') && !has(A.saga, 'still up there'), A.saga.slice(0, 260));
  ok('3. all twelve down: "Why was I sent here?" is past tense', has(A.why, 'You have put all twelve to rest, and the sky is quieter for it.') && !has(A.why, 'still up there'), A.why);
  ok('3. all twelve down: the Journal\'s Act 3 summary is past tense', has(A.blurb, 'All twelve stars are dark now') && has(A.jTitle, 'All twelve stars are dark now') && !has(A.jTitle, 'still up there'), A.jTitle);
  const b0 = R.barnBefore, b1 = R.barnAfter;
  ok('4. before the ending Barnaby is gloved (Craft, "What did you make?")', has(b0.craft, 'with one gloved hand') && b0.madeOpt && has(b0.made, 'His gloved hands go still.') && has(b0.made, 'He tugs one glove tighter.'), b0);
  ok('4. after the ending his hands are bare on both pages, the rest of the page unchanged', R.dawn && has(b1.craft, 'with one bare hand') && !/glove/i.test(b1.craft.split('\n')[0]) && b1.madeOpt && has(b1.made, 'His bare hands go still.') && has(b1.made, 'He turns one bare hand over and studies the palm.') && !/glove/i.test(b1.made) && has(b1.made, 'Iron would have told me no.'), b1);
  const Q = R.q;
  ok('5. The Twelve Houses has a navigator destination: the Zodiac Sanctum', Q.twelveD && Q.twelveD.map === 'zodiacHall' && Q.twelveD.verb === 'Enter', Q.twelveD);
  ok('5. ...and a tracker line (9 Houses left, Zodiac Sanctum)', has(Q.twelveG, '9 Stars left') && has(Q.twelveG, Q.zh), Q.twelveG);
  ok('5. Lyra\'s cut: the tracker names Elder Arlen and his map', has(Q.cutG, Q.arlen) && has(Q.cutG, Q.frMap), { g: Q.cutG, arlen: Q.arlen, map: Q.frMap });
  ok('5. the Master Conductor\'s quests: the tracker says "Warp with Milo"', Q.apG === 'Warp with Milo' && Q.finG === 'Warp with Milo', [Q.apG, Q.finG]);
  ok('5. ...and the navigator pins Milo (Warp with)', Q.finD && Q.finD.who === 'Milo' && Q.finD.verb === 'Warp with' && Q.apD && Q.apD.who === 'Milo', [Q.finD, Q.apD]);
  ok('no page errors', errs.length === 0, errs.slice(0, 5));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 600)); }
finally { await browser.close().catch(() => {}); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
