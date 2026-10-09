// THE FOUR ORDERS - the story behind the warrior, mage, archer and rogue orders.
//
// Per user: "Help improve the storyline behind the 4 classes clans of the warrior mage archer rogue faction especially in the
// lore". Before the Pause people carried their dreaming four ways; each way hardened into an order, and each order raised one
// of the Twelve (the Hood the Ram, the Bastion the Bull, the Academia the Maiden, the Grove the Archer). One page, real Codex
// renders and real openNPC dialogs:
//   1. LX_ORDERS holds the four orders, each tied to its class and its House, every paragraph within the Codex's 60 words;
//   2. the Codex Standings tab is one dossier per order (creed, how it rose, its House, what it makes of you), then the
//      Lantern (Mira's line and its sibling clause untouched) and the Sixth Standing;
//   3. an order's story moves on once its House is dark - a fourth row on its dossier, and only on its own;
//   4. the Paths tab names each path's order and creed, and says "the Pause" (never "first pause");
//   5. each leader tells the order's story in their own voice, on a page their existing lore question opens (no new button
//      on the card), and the House question becomes its answer once the House is dark (Will: the oath's end, Hera: treatise
//      1,185, Hong: the range reopens, Taiga: he starts asking);
//   6. each leader has one new idle bubble; nothing says the Twelve were sent or the dreaming stolen; no page errors;
//   7. the crowded card - a class-matched Lv 20 with the trial pending and two quests on offer - stays inside the frame.
// The build before fails 1-6.   node scripts/order_lore_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11843), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [], J = (x) => JSON.stringify(x).slice(0, 320);
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const wc = (t) => String(t || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 45; }
    player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    delete player._storyBeatsSeen.epilogue_gravitos;   // a save that saw every beat has FINISHED the story - keep it mid-story
    if (!game.bestiary) game.bestiary = {}; game.bestiary.aetherion = 1; const SIGNS = ['aries', 'taurus', 'virgo', 'sagittarius'];
    const dark = (list) => { for (const z of ZODIAC_SIGNS) delete game.bestiary['_boss_zodiac_' + z.id]; for (const z of list) game.bestiary['_boss_zodiac_' + z] = 1; };
    dark([]);
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    // ---- 1. the table
    const O = (typeof LX_ORDERS === 'object' && LX_ORDERS) || null;
    out.table = O ? Object.fromEntries(Object.entries(O).map(([k, o]) => [k, { sign: o.sign, name: o.name, creed: o.creed, w: ['rose', 'house', 'after', 'you'].map((f) => wc(o[f])) }])) : null;
    // ---- 2-3. the Standings tab, as rendered
    const cdx = async (tab) => { openLoreMap(tab); await sleep(250); const b = document.getElementById('lore-body');
      const r = { text: b.innerText, html: b.innerHTML, sib: [...b.querySelectorAll('.cdx-sib')].length, long: [...b.querySelectorAll('p, .dsc')].map((p) => wc(p.textContent)).filter((w) => w > 60),
        orders: [...b.querySelectorAll('.cdx-order')].map((d) => ({ k: d.dataset.order, creed: (d.querySelector('.cdx-creed') || {}).textContent || '', secs: [...d.querySelectorAll('.cdx-ord-k')].map((x) => x.textContent.trim()),
          since: d.querySelector('.cdx-ord-since') ? d.querySelector('.cdx-ord-since').innerText : '' })) };
      try { closeLoreMap(); } catch (e) {} await sleep(100); return r; };
    out.fac0 = await cdx('factions'); dark(['taurus']); out.fac1 = await cdx('factions'); dark(SIGNS); out.fac4 = await cdx('factions'); dark([]);
    out.paths = await cdx('paths');
    // ---- 5. the four leaders
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const click = async (lab) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => (x.textContent || '').trim() === lab); if (b) { b.click(); await sleep(250); await settle(); } return b ? text() : null; };
    // each leader's existing lore question opens the order's page: its old answer, then the order's two questions and Back
    const LEAD = { warrior: ['bastionThrone', 'champion', 'Who fights beside you?', 'What does the Bastion swear?', 'Who went up with the oath?', 'The Bull\'s House is dark.'],
      mage: ['azureAbode', 'archmage', 'What was the Academia?', 'What is the Academia for?', 'Why is nothing ever finished here?', 'Virga\'s House is dark.'],
      archer: ['emeraldVillage', 'archer', 'What guards the grove?', 'What does the Grove keep?', 'Why is the Jade Grove empty?', 'Sagitta\'s House is dark.'],
      rogue: ['shadowWovenHood', 'taiga', 'Who do you fight?', 'What was the Imperial Shadow?', 'Why patience, not fury?', 'Ariel\'s House is dark.'] };
    out.talk = {};
    for (const [cls, [map, role, entry, lore, before, after]] of Object.entries(LEAD)) {
      const r = {}; loadMap(map, 300); await sleep(1200); game.paused = false;
      const npc = () => (game.mapData.npcs || []).find((n) => n.role === role);
      for (const phase of ['before', 'after']) {
        dark(phase === 'after' ? [(O && O[cls] && O[cls].sign) || 'x'] : []);
        if (!npc()) { r.err = 'no ' + role; break; }
        openNPC(npc()); await sleep(300); await settle();
        const menu = opts(), entryText = await click(entry), page = opts();
        r[phase] = { menu, entryText, page, lore: phase === 'before' ? await click(lore) : null, house: await click(phase === 'before' ? before : after) };
        if (phase === 'before') { await click('◀ Back'); r.back = opts(); }
        try { closeDialog(); } catch (e) {} await sleep(200); game.paused = false;
      }
      r.pool = (NPC_CHAT_LINES[role] || []).slice(-1)[0] || ''; out.talk[cls] = r;
    }
    dark([]);
    // the crowded card: a class-matched Lv 20 with the trial pending and two quests on offer - the card stays inside the frame
    out.fit = {};
    for (const [cls, [map, role]] of Object.entries(LEAD)) {
      applyClass(cls); player.level = 20; if (player.quests && player.quests.completed) delete player.quests.completed.q_inner_dim_trial; player.job = null;
      loadMap(map, 300); await sleep(1200); game.paused = false;
      const nn = (game.mapData.npcs || []).find((n) => n.role === role); _ensureQuests();
      const keep = JSON.stringify(player.quests.active || {});
      for (const id of Object.keys(QUESTS).filter((id) => QUESTS[id].giver === nn.name).slice(0, 2)) player.quests.active[id] = { progress: 0, targetCount: 5 };
      openNPC(nn); await sleep(300); await settle(); await sleep(200);
      const card = document.getElementById('dialog').getBoundingClientRect(), wrap = document.querySelector('.game-wrapper').getBoundingClientRect();
      out.fit[cls] = { n: opts().length, top: Math.round(card.top - wrap.top) };
      try { closeDialog(); } catch (e) {} player.quests.active = JSON.parse(keep); await sleep(150); game.paused = false;
    }
    // ---- 6. canon words in everything this feature writes
    out.canon = O ? Object.values(O).flatMap((o) => ['rose', 'house', 'after', 'you'].map((f) => o[f])).join(' ') : '';
    return out;
  });
  const T = R.table || {};
  const MAP = { warrior: 'taurus', mage: 'virgo', archer: 'sagittarius', rogue: 'aries' };
  ok('1. LX_ORDERS: the four orders, each tied to its class and the House it raised, every paragraph within 60 words',
    !!R.table && Object.keys(MAP).every((k) => T[k] && T[k].sign === MAP[k] && T[k].creed && T[k].w.every((w) => w > 10 && w <= 60)) && Object.keys(T).length === 4, J(T));
  const f0 = R.fac0, f1 = R.fac1, f4 = R.fac4;
  ok('2. the Standings tab: one dossier per order (creed, Rose / Its House / Of you), then the Lantern and the Sixth Standing',
    J(f0.orders.map((o) => o.k)) === J(['warrior', 'mage', 'archer', 'rogue']) && f0.orders.every((o) => o.creed.length > 4 && J(o.secs.map((s) => s.toUpperCase())) === J(['ROSE', 'ITS HOUSE', 'OF YOU'])) && f0.long.length === 0
      && f0.sib === 1 && /Their oldest, the silver-haired Sage Mira, who kept her name/.test(f0.text) && /The Sixth Standing/i.test(f0.text) && /Four of the Twelve came from these halls/.test(f0.text), J({ orders: f0.orders, long: f0.long, sib: f0.sib }));
  ok('3. an order\'s story moves on once its House is dark - a fourth row on its dossier, and only its own',
    f0.orders.every((o) => !o.since) && f1.orders.filter((o) => o.since).length === 1 && /bull's house is dark/i.test(f1.orders[0].since) && /stand until someone pushes/.test(f1.orders[0].since)
      && f4.orders.every((o) => o.since) && /treatise 1,185/.test(f4.orders[1].since) && /only to hear it land/.test(f4.orders[2].since) && /asking whose it is/.test(f4.orders[3].since), J(f1.orders.map((o) => o.since.slice(0, 60))));
  ok('4. the Paths tab names each path\'s order and its creed, and says the Pause (never "first pause")',
    /Taught by The Bastion/.test(R.paths.text) && /Taught by The Azure Academia/.test(R.paths.text) && /Taught by The Jade Grove/.test(R.paths.text) && /Taught by The Shadow-Woven Hood/.test(R.paths.text)
      && /outlived the Pause/.test(R.paths.text) && !/first pause/i.test(R.paths.html) && R.paths.long.length === 0, J({ long: R.paths.long }));
  const t = R.talk || {}, wc = (s) => String(s || '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
  // the leader's card gains no button; its lore question opens the order's page (the old answer, the two questions, Back)
  const talkOk = (k, entry, reEntry, lore, reLore, before, reBefore, after, reAfter) => { const r = t[k] || {}; const b = r.before || {}, a = r.after || {};
    return !r.err && b.menu && a.menu && b.menu.includes(entry) && ![lore, before, after].some((l) => b.menu.includes(l) || a.menu.includes(l)) && reEntry.test(b.entryText || '')
      && b.page.includes(lore) && b.page.includes(before) && !b.page.includes(after) && b.page.includes('◀ Back') && a.page.includes(after) && !a.page.includes(before)
      && reLore.test(b.lore || '') && reBefore.test(b.house || '') && reAfter.test(a.house || '') && (r.back || []).includes(entry) && !(r.back || []).includes(lore)
      && [b.lore, b.house, a.house].every((s) => wc(s) <= 60); };
  ok('5a. Will: "Who fights beside you?" opens the Bastion\'s page - the oath that stops at "until"; once the Bull falls, "we stand until someone pushes"',
    talkOk('warrior', 'Who fights beside you?', /Elena keeps our records/, 'What does the Bastion swear?', /second age[\s\S]*We stand until/, 'Who went up with the oath?', /Taur[\s\S]*word after until/, 'The Bull\'s House is dark.', /We stand until someone pushes/), J(t.warrior));
  ok('5b. Hera: "What was the Academia?" opens its page - 1,184 treatises; Virga never asked; once the Maiden falls, treatise 1,185 is a question',
    talkOk('mage', 'What was the Academia?', /A school, once\. A library, twice/, 'What is the Academia for?', /Name it truly[\s\S]*1,184 treatises/, 'Why is nothing ever finished here?', /Virga[\s\S]*never asked/, 'Virga\'s House is dark.', /Treatise 1,185/), J(t.mage));
  ok('5c. Lady Hong: "What guards the grove?" opens its page - the seasons, aim through; Sagitta\'s question still falling; then the range reopens',
    talkOk('archer', 'What guards the grove?', /Yun walks the borders/, 'What does the Grove keep?', /rehearse a dream[\s\S]*Aim through, not at/, 'Why is the Jade Grove empty?', /Sagitta[\s\S]*still falling/, 'Sagitta\'s House is dark.', /range can have its arrows back/), J(t.archer));
  ok('5d. Taiga: "Who do you fight?" opens the Hood\'s page - the Imperial Shadow; Ariel burned for fury; once the Ram falls he starts asking',
    talkOk('rogue', 'Who do you fight?', /The same hand that toppled the capital/, 'What was the Imperial Shadow?', /capital[\s\S]*left the conversation/, 'Why patience, not fury?', /Ariel[\s\S]*caught fire/, 'Ariel\'s House is dark.', /Perhaps it is time I asked/), J(t.rogue));
  ok('7. the crowded card (class-matched Lv 20, trial pending, two quests on offer) stays inside the frame for all four leaders',
    Object.keys(R.fit || {}).length === 4 && Object.values(R.fit).every((f) => f.top >= 0), J(R.fit));
  ok('6. one new idle bubble each (at most 6 words); nothing says the Twelve were sent or the dreaming stolen or taken; no page errors',
    J(['warrior', 'mage', 'archer', 'rogue'].map((k) => (t[k] || {}).pool)) === J(['We stand until.', 'Three are nearly correct.', 'Keep the range clear.', 'A half-breath early. Never whole.'])
      && !/\bsent\b|\bstolen\b|\bstole\b|\btaken\b|first pause/i.test(R.canon) && errs.length === 0, J({ pools: ['warrior', 'mage', 'archer', 'rogue'].map((k) => (t[k] || {}).pool), errs: errs.slice(0, 3) }));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
