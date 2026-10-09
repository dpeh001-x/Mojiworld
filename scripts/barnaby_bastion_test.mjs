// BARNABY IN THE BASTION (per user: "Relocate barnaby in a suitable location at the bastion map, then tighten the storyline to
// make barnaby somewhat linked to the canonical events of mojiworld"). He stood on a perch in the Lv 61 Frosted Mansion, so his
// quests had been raised to Lv 61 (v0.30.906), and his story never touched the canon it sat inside. One page, a Lv 60 warrior:
//   1. PLACED: he stands on the keep-side step by the Throne Room door in the Bastion Courtyard, his anvil beside him, and
//      nowhere else - the Frosted Mansion keeps neither him nor the anvil;
//   2. REACH: the talk key picks him from the courtyard floor under the step, and his card names him;
//   3. LEVELS: Barnaby II-IV and Lyra V open at 45 again, the Kindest Hand at 50; the Journal routes them to the Bastion;
//   4. NO MANSION: no quest, shop line or Will page sends you to the Frosted Mansion or calls him "of Glasswind";
//   5. CANON: his forge and its blades are older than the Bastion - the woman at the gate (Mira, per user, in place of a smith
//      "Mara" nobody ever met) left them and walked up the road, so the forge stood cold the night the sky fell (why that night
//      had two jobs); nobody says her name (the epilogue: she hears it aloud first from her brother), the Codex names her only
//      once she has told you; every knight on the roll swore "We stand until", the Smith armed the Twelve with the Bastion's
//      own Taur among them, and the officer's theory is the epilogue's receipt ("put somewhere small");
//   6. MOVES WITH THE STORY: 'Which gate did you hold?' answers with the oath, then "until someone pushes" once the Bull's
//      House is dark (the anvil gets the words too); after the ending his gloves stay off and he chooses the forge; his idle
//      bubbles come from his own pool in each state, drawn by the real bubble tick;
//   7. CAPS: chapters <= 170 words, his lines <= 60, bubbles <= 6 naming no key; 8. no page errors.
// SMITHSWAP (per user: "Swap the location of brok and barnaby in the game"): Brok stands on the courtyard's ground floor (x 2080, per
// user) with the anvil on the floor beside him (x 1985, per user), and Barnaby stands at the Megamall's armory storefront (x 300, on the floor). So [1] places both, [2] the talk key
// picks Brok on the floor, [3] the Journal routes Barnaby's chain to the Megamall, [5] Barnaby I says "the
// Bastion's old smith ... His stall is in the Everdawn Megamall", his card says he kept the forge four years and "It has a
// new smith" (a shopkeeper's card names no other shopkeeper: shopkeeper_voice_test), Will says "Brok keeps it now.", and [6] runs his card, wall and bubbles in the Megamall (he has his own forge there,
// per user: the words go on the foot of his anvil). The build before the swap fails 1-3, 5 and 6.
// The build before fails 1, 3-7.   node scripts/barnaby_bastion_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11796), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 60;
    player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = { tutorial_intro: true, everdawn_welcome: true };   // mid-story: the ending unplayed
    if (player.titles && typeof LX_TITLE_CONQUEROR !== 'undefined') delete player.titles[LX_TITLE_CONQUEROR];
    game.bestiary = game.bestiary || {}; delete game.bestiary._boss_zodiac_taurus;
    const words = (t) => String(t || '').replace(/<[^>]+>/g, '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); };
    const go = async (id, x) => { loadMap(id, x || 400); await sleep(1500); game.paused = false; try { closeAllModals(); } catch (e) {} };
    const barn = () => (game.npcs || []).find((n) => n.name === 'Barnaby');
    const brok = () => (game.npcs || []).find((n) => n.name === 'Brok');
    const talk = async () => { if (!barn()) return { text: '', opts: [] }; game._brokMenu = null; openNPC(barn()); await sleep(300); await settle(); return { text: text(), opts: opts() }; };
    const wall = async () => { await talk(); const had = await click(/Which gate did you hold\?/); await settle(); const t = text(); await close(); return had ? t : null; };
    const bubble = async () => { const b = barn(); if (!b) return null; b._chat = null; b._chatNext = 0; const r0 = Math.random; Math.random = () => 0;
      for (let i = 0; i < 30 && !b._chat; i++) { game.paused = false; await sleep(100); } Math.random = r0; return b._chat ? b._chat.text : null; };
    // ---- 1. placed
    out.lists = Object.keys(MAPS).filter((id) => (MAPS[id].npcs || []).some((n) => n && n.name === 'Barnaby'));
    out.brokLists = Object.keys(MAPS).filter((id) => (MAPS[id].npcs || []).some((n) => n && n.name === 'Brok'));
    await go('glasswindHamlet'); out.mansion = { npc: !!barn(), anvil: (MAP_PROPS.glasswindHamlet || []).some((p) => p.key === 'bastion_anvil') };
    await go('bastion', 2150);
    const b = brok(), P = game.mapData.platforms || [];
    const under = (x, y) => P.find((p) => x >= p.x && x <= p.x + p.w && Math.abs(p.y - y) <= 4);
    const anv = (MAP_PROPS.bastion || []).find((p) => p.key === 'bastion_anvil');
    out.placed = b ? { x: b.x, feet: Math.round(b.y + (b.h || 44)), step: under(b.x, b.y + (b.h || 44)) || null, anvil: anv ? { x: anv.x, y: anv.y, on: !!under(anv.x, anv.y - 4), dx: Math.abs(anv.x - b.x) } : null } : null;
    // ---- 2. reach: the player on the floor under the step
    player.x = 2110; player.vx = 0; player.vy = 0; await sleep(900);
    out.reach = { target: (_lxTalkTarget() || {}).name || null, onFloor: Math.round(player.y + player.h) };
    out.barnInBastion = !!barn();
    await go('everdawn_megamall', 300); player.x = 300; await sleep(600);
    { const mb = barn(); out.mall = mb ? { x: mb.x, feet: Math.round(mb.y + (mb.h || 44)), onGround: (game.mapData.platforms || []).some((q) => q.type === 'ground' && mb.x >= q.x && mb.x <= q.x + q.w && Math.abs(q.y - (mb.y + (mb.h || 44))) <= 6),
      armory: (MAP_PROPS.everdawn_megamall || []).some((q) => q.key === 'mall_shop_armory' && Math.abs(q.x - mb.x) <= 40) && (MAP_PROPS.everdawn_megamall || []).some((q) => q.key === 'bastion_anvil' && Math.abs(q.x - mb.x) <= 120), brokHere: !!brok() } : null; }
    const t0 = await talk(); out.card = t0; await close();
    // ---- 3. levels and routing
    out.lv = ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish', 'q_lyra_forge', 'q_kindest_hand'].map((id) => QUESTS[id].levelReq);
    out.nav = ['q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish', 'q_lyra_forge'].map((id) => { const d = _qnavDest(id); return d && d.map; });
    // ---- 4/5. text
    const D = (id) => QUESTS[id].desc || '';
    out.descs = ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish', 'q_lyra_forge', 'q_kindest_hand'].map(D);
    out.voice = Object.values(LX_SHOP_VOICE.Barnaby).join(' ');
    out.epilogue = document.documentElement.outerHTML.includes('The smith who was put somewhere small.');
    // the Codex's Doomed Expedition page: her blades, and her name only once she has told it
    const cdx = (named) => { const had = player._miraNamed; player._miraNamed = named; const host = document.getElementById('lore-body') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'lore-body' }));
      _renderLoreTab('expedition'); const t = host.textContent.replace(/\s+/g, ' '); player._miraNamed = had; return t; };
    out.cdx = { before: cdx(false), after: cdx(true) };
    out.mara = /\bMara\b/.test(document.documentElement.outerHTML);
    await go('bastionThrone', 700); const will = (game.npcs || []).find((n) => n.name === 'Will' || n.role === 'champion');
    openNPC(will); await sleep(300); await settle(); await click(/Who fights beside you\?/); await settle(); out.will = text(); await close();
    // ---- 6. the story moves: before / the Bull's House dark / after the ending
    await go('everdawn_megamall', 300); player.x = 300; await sleep(600);
    out.pre = { card: (await talk()).text, wall: null, bub: null }; await close(); out.pre.wall = await wall(); out.pre.bub = await bubble();
    game.bestiary._boss_zodiac_taurus = 1;
    out.taur = { card: (await talk()).text, wall: null, bub: null }; await close(); out.taur.wall = await wall(); out.taur.bub = await bubble();
    player._storyBeatsSeen.epilogue_gravitos = true;
    out.dawn = { card: (await talk()).text, bub: null }; await close(); out.dawn.bub = await bubble();
    // ---- 7. caps
    const OWN = (typeof NPC_CHAT_LINES_OWN === 'object' && NPC_CHAT_LINES_OWN.Barnaby) || {};
    out.bubbles = [].concat(OWN.base || [], OWN.taur || [], OWN.dawn || []);
    out.caps = { chapters: out.descs.slice(0, 5).map(words), lines: [out.pre.wall, out.taur.wall, (typeof _lxBarnabyLine === 'function') ? _lxBarnabyLine() : '', LX_SHOP_VOICE.Barnaby.intro].map(words),
      bubbles: out.bubbles.filter((l) => words(l) > 6 || /\bPress [A-Z0-9]\b/.test(l)) };
    return out;
  });
  const P = R.placed || {};
  ok('[1] Brok stands on the courtyard ground floor (y 480) between the keep stairs and the shield-bearer (x 2030-2140), the anvil on the floor beside him; Barnaby stands on the Megamall floor at the armory storefront; each is listed on one map only',
    JSON.stringify(R.brokLists) === '["bastion"]' && JSON.stringify(R.lists) === '["everdawn_megamall"]' && P.step && P.step.type === 'ground' && P.step.y === 480 && P.x >= 2030 && P.x <= 2140 && P.anvil && P.anvil.on && P.anvil.y === 480 && P.anvil.dx <= 130
    && !R.barnInBastion && R.mall && R.mall.onGround && R.mall.armory && !R.mall.brokHere, { brok: R.brokLists, barnaby: R.lists, placed: P, mall: R.mall });
  ok('[1] the Frosted Mansion keeps neither him nor his anvil', !R.mansion.npc && !R.mansion.anvil, R.mansion);
  ok('[2] standing beside him on the courtyard floor the talk key picks Brok; in the Megamall Barnaby\'s card names him', R.reach.target === 'Brok' && /Barnaby/.test(R.card.text), { reach: R.reach, card: R.card.text.slice(0, 90) });
  ok('[3] Barnaby I-IV and Lyra V open at 45, the Kindest Hand at 50', JSON.stringify(R.lv) === '[45,45,45,45,45,50]', R.lv);
  ok('[3] the Journal routes his quests to the Megamall', R.nav.every((m) => m === 'everdawn_megamall'), R.nav);
  const all = R.descs.join(' ') + ' ' + R.voice + ' ' + R.will + ' ' + [R.pre.card, R.pre.wall, R.taur.card, R.taur.wall, R.dawn.card].join(' ');
  ok('[4] nothing sends you to the Frosted Mansion for him or calls him "of Glasswind"; the smith has no frost', !/Frosted Mansion|Glasswind|frost|too cold to touch/i.test(all), (all.match(/.{0,40}(Frosted Mansion|Glasswind|frost|too cold).{0,30}/i) || [''])[0]);
  const [five, roll, , fin, forge] = R.descs;
  ok('[5] I: the Bastion\'s old smith, the officer\'s "put somewhere small" (the epilogue\'s receipt), his stall in the Everdawn Megamall',
    /Barnaby, the Bastion's old smith/.test(five) && /put somewhere small/.test(five) && /His stall is in the Everdawn Megamall\./.test(five) && R.epilogue, five.slice(0, 120));
  ok('[5] II: the forge\'s old bench, and every knight on the roll swore "We stand until"', /the forge's old bench/.test(roll) && /swore "We stand until\."/.test(roll), roll.slice(150, 330));
  ok('[5] IV: the Smith armed the heroes who climbed, the Bastion\'s own among them (the Twelve are named only after Aetherion falls)', /armed the heroes who climbed, the Bastion's own among them/.test(fin) && !/the Twelve/.test(fin), fin.slice(-330, -150));
  ok('[5] V: a blade older than the Bastion; the night the sky fell its forge had stood cold since the woman at the gate walked up the road',
    /a Bastion blade older than the Bastion/.test(forge) && /Bastion had no smith: its forge had stood cold since the woman at the gate walked up the road/.test(forge) && /^Barnaby starts with someone else/.test(forge), forge.slice(0, 160));
  ok('[5] his card and Will: he kept the forge four years, the woman at the gate left it and its blades, it has a new smith, he built his own forge (his card names no other shopkeeper); "Brok keeps it now."; no forge now."; nobody names her',
    /I kept the Bastion's forge four years\./.test(R.voice) && /the woman at the gate left it cold, every rack full/.test(R.voice) && /It has a new smith\./.test(R.voice) && /I built my own forge down here\./.test(R.voice) && !/Brok|\bher\b|\bhers\b/.test(R.voice)
    && /the woman at the gate left them racked in her forge, and none has broken\. Brok keeps it now\./.test(R.will)
    && /Elena keeps our records/.test(R.will) && !/\bMira\b/.test(R.voice + R.will + all), R.will.slice(80, 220));
  ok('[5] the Codex: the Doomed carried Bastion blades made by the woman at the gate - by Mira once she has told you; no "Mara" left',
    /Bastion blades made by the woman at the gate, older than the Bastion itself/.test(R.cdx.before) && /Bastion blades made by Mira, older than the Bastion itself/.test(R.cdx.after) && !/Mira/.test(R.cdx.before) && !R.mara,
    { before: (R.cdx.before.match(/finest ever made.{0,90}/) || [''])[0], after: (R.cdx.after.match(/finest ever made.{0,60}/) || [''])[0], mara: R.mara });
  ok('[6] before the Bull\'s House is dark: the oath, the western breach, "the gate", his own bubble', /We stand until\./.test(R.pre.wall || '') && /western breach/.test(R.pre.wall || '') && !/SOMEONE PUSHES|gloves lie/.test(R.pre.card) && R.pre.bub === 'We stand until. Until what?', { wall: R.pre.wall, bub: R.pre.bub });
  ok('[6] once it is dark: his anvil and the answer carry "until someone pushes"', /SOMEONE PUSHES/.test(R.taur.card) && /until someone pushes/.test(R.taur.wall || '') && R.taur.bub === 'We stand until someone pushes.', { card: R.taur.card.slice(0, 80), wall: R.taur.wall, bub: R.taur.bub });
  ok('[6] after the ending: his gloves stay off and he chooses the forge', /gloves lie on the bench/.test(R.dawn.card) && /I would choose it again/.test(R.dawn.card) && R.dawn.bub === 'Gloves off. First morning.', { card: R.dawn.card.slice(0, 120), bub: R.dawn.bub });
  ok('[7] chapters <= 170 words, his lines <= 60, bubbles <= 6 and naming no key', R.caps.chapters.every((w) => w <= 170) && R.caps.lines.every((w) => w > 0 && w <= 60) && R.caps.bubbles.length === 0 && R.bubbles.length >= 10, R.caps);
  ok('[8] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
