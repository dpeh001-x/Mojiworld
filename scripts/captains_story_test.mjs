// THE CAPTAINS IN THE STORY (v0.30.1554, per user: "add in more depth of the storyline especially during the quests, on all the
// classes captains (hera, taiga, lady hong, will) make more mentions of them and how notable they are in terms of presence,
// achievement, aura" + "For lyra put her in some roles as well").
//   1. twelve quest descriptions carry their captain line (or Lyra's), inside the per-quest word caps
//   2. each captain answers for the quest that passed through them, on the order's page - and only once it has (state-gated)
//   3. each captain's neighbour says what that captain has done (Elena / Auron / Yun / Ren)
//   4. Lyra's "What are you working on?" moves with her arc (before / after chapter II / after chapter IV)
//   5. the new idle bubbles are in their pools; the four captains' own pools still end on the order line
//   6. the reactions sit on each order's page, not the main card (a crowded main card already runs off the top on main -
//      Hera's, with the trials and two quests on offer); the page, with every reaction showing, stays inside the frame
//   7. no Future Lyra anywhere in the game, and no page errors
//   node scripts/captains_story_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11861), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const SRC = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
ok('7a. no Future Lyra left in the game (name, key, or the old portal line)', !/Future Lyra|future_lyra|a Lyra you have never met/.test(SRC));
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [], J = (x) => JSON.stringify(x).slice(0, 300);
const QLINES = {
  q_act1_firstword: 'Four have held it up since the Pause: Will, Hera, Lady Hong and Taiga.',
  q_inner_dim_trial: 'Each has kept an order standing since the Pause.',
  q_distorted_portal: "Taiga's Hood has not let it out of sight since.",
  q_lyra_cut: 'Hers is the one signature the circle never checks.',
  q_lyra_kin: 'Taiga, Lady Hong and Will stood in its mouth so it could take no one else',
  q_barnaby_roll: "Will's white blade",
  q_canary_quiet: 'Lyra copied every reading into her own book.',
  q_kill_nimbusFox: 'Lyra keeps the tally, mostly correctly.',
  q_visit_glasswind: 'Lyra saw it first, and Hera believed her.',
  q_zodiac_twelve: 'Will, Hera, Lady Hong and Taiga still watch the four their orders raised.',
  q_boss_aries: "Taiga's Hood raised him and sent him up in fury.",
  q_long_dawn_1: 'The four orders hold the town behind you',
};
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async (QLINES) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const wc = (t) => String(t || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); }
    player.level = 50; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    delete player._storyBeatsSeen.epilogue_gravitos;   // keep the story mid-way
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    // ---- 1. quest prose
    out.q = Object.fromEntries(Object.entries(QLINES).map(([id, line]) => { const d = (QUESTS[id] && (QUESTS[id]._lxDesc0 != null ? QUESTS[id]._lxDesc0 : QUESTS[id].desc)) || '';
      return [id, { has: d.includes(line), w: wc(d), cap: /^q_(barnaby|lyra)_/.test(id) ? 170 : 120 }]; }));
    // ---- dialog helpers
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const click = async (lab) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => (x.textContent || '').trim() === lab); if (b) { b.click(); await sleep(250); await settle(); } return b ? text() : null; };
    _ensureQuests();
    const setDone = (ids) => { player.quests.completed = player.quests.completed || {}; for (const id of ['q_lyra_tear', 'q_lyra_kin', 'q_barnaby_roll']) delete player.quests.completed[id];
      if (player.quests.active) delete player.quests.active.q_barnaby_roll; for (const id of ids) player.quests.completed[id] = true; };
    const talk = async (map, name, label, page) => { loadMap(map, 300); await sleep(900); game.paused = false; const n = (game.mapData.npcs || []).find((x) => x.name === name);
      if (!n) return { err: 'no ' + name + ' on ' + map };
      openNPC(n); await sleep(300); await settle(); if (page) await click(page); const menu = opts(); const said = label ? await click(label) : null;
      try { closeDialog(); } catch (e) {} await sleep(150); game.paused = false; return { menu, said }; };
    // ---- 2. the captains, state-gated
    const PAGE = { Taiga: 'Who do you fight?', Will: 'Who fights beside you?', Hera: 'What was the Academia?', 'Lady Hong': 'What guards the grove?' };
    const CAP = [['shadowWovenHood', 'Taiga', 'A tiger wore your hood.', 'q_lyra_kin'], ['bastionThrone', 'Will', 'I met a lion with your sword.', 'q_lyra_kin'],
      ['azureAbode', 'Hera', 'I met the hare at the tear.', 'q_lyra_tear'], ['emeraldVillage', 'Lady Hong', 'A goose carried your bow.', 'q_lyra_kin'],
      ['bastionThrone', 'Will', 'Barnaby is on your roll twice.', 'q_barnaby_roll']];
    out.cap = [];
    for (const [map, name, label, q] of CAP) {
      setDone([]); const before = await talk(map, name, null, PAGE[name]);
      setDone([q]); const after = await talk(map, name, label, PAGE[name]);
      let active = null; if (q === 'q_barnaby_roll') { setDone([]); player.quests.active.q_barnaby_roll = { progress: 0, targetCount: 1 }; active = await talk(map, name, null, PAGE[name]); }
      out.cap.push({ name, label, before: before.menu ? before.menu.includes(label) : before.err, after: after.menu ? after.menu.includes(label) : after.err, said: after.said, w: wc(after.said),
        active: active ? active.menu.includes(label) : null });
    }
    setDone([]);
    // ---- 3. the neighbours
    out.nb = [];
    for (const [map, name, label, who] of [['bastionThrone', 'Elena', 'What has Will done?', 'western breach'], ['azureAcademia', 'Auron', 'What is Hera like?', 'aperture'],
      ['emeraldVillage', 'Yun', 'What is Lady Hong like?', 'Reach of Vermillion'], ['shadowWovenHood', 'Ren', 'What is Taiga like?', 'Imperial Shadow']]) {
      const r = await talk(map, name, label); out.nb.push({ name, label, said: r.said, w: wc(r.said), err: r.err, hit: !!(r.said && r.said.includes(who)) });
    }
    // ---- 4. Lyra
    out.lyra = {};
    for (const [k, ids] of [['start', []], ['tear', ['q_lyra_tear']], ['kin', ['q_lyra_tear', 'q_lyra_kin']]]) { setDone(ids); const r = await talk('azureAcademia', 'Lyra', 'What are you working on?'); out.lyra[k] = { said: r.said, w: wc(r.said), err: r.err }; }
    setDone([]);
    // ---- 5. bubbles
    out.bub = { scribe: NPC_CHAT_LINES.scribe, scholar: NPC_CHAT_LINES.scholar, apprentice: NPC_CHAT_LINES.apprentice, sentinel: NPC_CHAT_LINES.sentinel, ren: NPC_CHAT_LINES.ren,
      lastOrder: ['champion', 'archmage', 'archer', 'taiga'].map((r) => (NPC_CHAT_LINES[r] || []).slice(-1)[0]) };
    // ---- 6. the crowded captain card: every gated option showing, the Distorted Portal on offer, two quests on offer
    out.fit = {};
    for (const [cls, map, name] of [['warrior', 'bastionThrone', 'Will'], ['mage', 'azureAbode', 'Hera'], ['archer', 'emeraldVillage', 'Lady Hong'], ['rogue', 'shadowWovenHood', 'Taiga']]) {
      applyClass(cls); player.level = 50; player.job = player.job || 'x'; setDone(['q_lyra_tear', 'q_lyra_kin']); player.quests.active.q_barnaby_roll = { progress: 0, targetCount: 1 };
      delete player.quests.completed.q_distorted_portal; delete player.quests.active.q_distorted_portal;
      loadMap(map, 300); await sleep(900); game.paused = false; const n = (game.mapData.npcs || []).find((x) => x.name === name);
      const keep = JSON.stringify(player.quests.active || {});
      for (const id of Object.keys(QUESTS).filter((id) => QUESTS[id].giver === name).slice(0, 2)) player.quests.active[id] = { progress: 0, targetCount: 5 };
      openNPC(n); await sleep(300); await settle(); await sleep(200); const main = opts();
      await click(PAGE[name]); await sleep(200);
      const card = document.getElementById('dialog').getBoundingClientRect(), wrap = document.querySelector('.game-wrapper').getBoundingClientRect();
      const btns = [...document.querySelectorAll('#dialog-options button')].map((b) => b.getBoundingClientRect());
      out.fit[name] = { main, n: btns.length, top: Math.round(card.top - wrap.top), bottom: Math.round(wrap.bottom - card.bottom), lastBtn: btns.length ? Math.round(wrap.bottom - btns[btns.length - 1].bottom) : null, menu: opts() };
      try { closeDialog(); } catch (e) {} player.quests.active = JSON.parse(keep); delete player.quests.active.q_barnaby_roll; await sleep(150); game.paused = false;
    }
    return out;
  }, QLINES);
  for (const [id, r] of Object.entries(R.q)) ok(`1. ${id} carries its line, ${r.w} <= ${r.cap} words`, r.has && r.w <= r.cap, r);
  for (const c of R.cap) {
    ok(`2. ${c.name}: "${c.label}" hidden before, shown after${c.active === null ? '' : ', and while the roll call is active'}`, c.before === false && c.after === true && (c.active === null || c.active === true), c);
    ok(`2. ${c.name}: the answer is in his or her own voice, ${c.w} <= 60 words`, !!c.said && c.w > 20 && c.w <= 60, c.said && c.said.slice(0, 80));
  }
  for (const n of R.nb) ok(`3. ${n.name} on "${n.label}": names the deed, ${n.w} <= 60 words`, n.hit && n.w <= 60, n.err || (n.said || '').slice(0, 90));
  const L = R.lyra; const s = [L.start.said, L.tear.said, L.kin.said];
  ok('4. Lyra: three different answers as her arc moves', s.every(Boolean) && new Set(s).size === 3, s.map((x) => (x || '').slice(0, 40)));
  ok('4. Lyra: before - Hera\'s homework; after II - she asked Auron aloud; after IV - she copies Hera\'s ring readings',
    /Forty spheres/.test(L.start.said || '') && /asked Auron/.test(L.tear.said || '') && /ring readings/.test(L.kin.said || ''), s.map((x) => (x || '').slice(0, 40)));
  ok('4. Lyra: each answer <= 60 words', [L.start, L.tear, L.kin].every((x) => x.w > 0 && x.w <= 60), [L.start.w, L.tear.w, L.kin.w]);
  const B = R.bub; const has = (role, line) => (B[role] || []).includes(line);
  ok('5. bubbles: Elena, Auron, Lyra, Yun and Ren each say a captain\'s name', has('scribe', "Will's name fills three volumes") && has('scholar', "Hera's ring has never slipped") && has('apprentice', 'Hera believed me first!') && has('sentinel', 'Lady Hong never misses. Ever.') && has('ren', 'Taiga took his hood back.'), B);
  ok('5. the four captains\' own pools still end on their order line', B.lastOrder.length === 4 && B.lastOrder.every(Boolean), B.lastOrder);
  const REACT = ['A tiger wore your hood.', 'I met a lion with your sword.', 'Barnaby is on your roll twice.', 'I met the hare at the tear.', 'A goose carried your bow.'];
  for (const [name, f] of Object.entries(R.fit)) {
    ok(`6. ${name}'s main card is no longer than before: none of the reactions sit on it`, f.main.length > 0 && !f.main.some((l) => REACT.includes(l)), f.main);
    ok(`6. ${name}'s order page with every reaction showing (${f.n} options) stays inside the frame, its quest rows left on the main card`, f.n >= 3 && f.menu.some((l) => REACT.includes(l)) && !f.menu.some((l) => /^(📜|❗|✅)/.test(l)) && f.top >= 0 && f.bottom >= 0 && f.lastBtn >= 0, f);
  }
  ok('7b. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
