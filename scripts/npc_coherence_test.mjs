// NPC COHERENCE (per user: "ensure the NPC dialogues are coherent and then check for any other random names"). A read of every
// NPC branch found lines contradicting the canon, another NPC, the map or their own later state. One page, real dialogue buttons:
//   1. the Amnesiac: no unknown "bell-keepers", he forgets more than one thing, knows what you are (never met you), nothing was
//      "taken", and names the Pause; Guguma: "bring the dreaming home", a tour that exists; Mira: the bell was stopped mid-swing;
//      the Codex's faces say "stay", as the story beat does;
//   2. DJ Vinyl: Everdawn sleeps (nobody dreams), in her answer and her bubble;
//   3. Nurse Joyce's ledger has a second sentence once her own Lv 52 quest has found it;
//   4. places: Candy Canyon is WEST of the Bastion; Whisper's smith is in the Sundered Forge; Milo names the real journal entry;
//      Master Kaze sends a non-rogue to their own order, a rogue to Taiga;
//   5. Auron's Academia history is Hera's (a library, then a graveyard, under the floorboards); Will's plate reads High Commander;
//   6. Marbella lists only real bosses (19 attack-animation keys were listed) and can say "cleared them all";
//   7. bubbles: the bank is no death shelter, expedition loot stays below win or lose, a run is private; after the ending six more
//      roles have their own morning; every bubble <= 6 words; 8. no page errors.
// The build before fails 1-7.   node scripts/npc_coherence_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11797), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
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
    if (!player.cls) applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = { tutorial_intro: true, everdawn_welcome: true };
    if (player.titles && typeof LX_TITLE_CONQUEROR !== 'undefined') delete player.titles[LX_TITLE_CONQUEROR];
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const labels = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(80); };
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(120); };
    const ask = async (npc, re) => { openNPC(npc); await sleep(250); await settle(); const card = text(), ls = labels();
      let ans = null; if (re) { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); await settle(); ans = text(); } }
      await close(); return { card, ls, ans }; };
    const src = document.documentElement.outerHTML;
    // 1. source lines inside state machines (the Amnesiac's saga pages, Guguma's replies, Mira's greeting, the Codex)
    out.src = { bell: /bell-keepers/.test(src), agrees: src.includes('Nobody down here agrees what to call it.'), either: src.includes('I can\\\'t remember that either.'),
      oneThing: src.includes('the one thing I can\\\'t remember'), knows: src.includes('…I know what you are now.'), placing: src.includes('placing your face'),
      brought: src.includes('You brought a shard back.'), took: src.includes('You took a shard back.'), pause: src.includes('We call the stillness the Pause'),
      home: src.includes('Go and bring the dreaming home.'), takeBack: src.includes('Go take the dream back'), gateTrial: src.includes('the gate-trial'),
      swing: src.includes('if it had been allowed to finish its swing'), aselm: /\bAselm\b/.test(src), brave: src.includes('brave enough to swing'), milo: src.includes('for STAGE 1 — The Ticket Rush Lobby.') };
    const host = document.getElementById('lore-body') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'lore-body' }));
    _renderLoreTab('world'); out.faces = (host.textContent.match(/borrows your memories[^.]*\./) || [''])[0].replace(/\s+/g, ' ');
    // 2-5. real dialogue
    out.dj = await ask({ role: 'jukebox', name: 'DJ Vinyl' }, /You sleep here\?/);
    out.joyce0 = await ask({ role: 'potion', name: 'Nurse Joyce' }, /sleepers. ledger\?/);
    player.quests = player.quests || {}; player.quests.completed = player.quests.completed || {}; const had = player.quests.completed.q_dream_closer;
    player.quests.completed.q_dream_closer = true; out.joyce1 = await ask({ role: 'potion', name: 'Nurse Joyce' }, /sleepers. ledger\?/);
    if (had) player.quests.completed.q_dream_closer = had; else delete player.quests.completed.q_dream_closer;
    out.elena = await ask({ role: 'scribe', name: 'Elena' }, /Tell me of the lands\./);
    out.auron = await ask({ role: 'scholar', name: 'Auron' }, /What ruins lie below\?/);
    out.whisper = await ask({ role: 'whisper', name: 'Whisper' }, /Sundered Forge|foundry/);
    const cls0 = player.cls; player.cls = 'warrior'; out.kazeW = await ask({ role: 'kaze', name: 'Master Kaze' }, /ascendant training/);
    player.cls = 'rogue'; out.kazeR = await ask({ role: 'kaze', name: 'Master Kaze' }, /ascendant training/); player.cls = cls0;
    out.plate = _dialogSubtitleFor({ role: 'champion', name: 'Will' });
    // 6. Marbella: none of the attack sets, and the list can empty
    game.bestiary = game.bestiary || {}; out.marb0 = (await ask({ role: 'curator', name: 'Marbella' })).card;
    const saved = Object.assign({}, game.bestiary); for (const b of BOSS_SPRITE_TYPES) if (monsterTypes[b]) game.bestiary['_boss_' + b] = 1;   // the real ones only
    out.marb1 = (await ask({ role: 'curator', name: 'Marbella' })).card; game.bestiary = saved;
    // 7. bubbles
    const all = []; for (const P of [NPC_CHAT_LINES, NPC_CHAT_LINES_DAWN]) for (const r in P) for (const l of P[r]) all.push(l);
    out.long = all.filter((l) => String(l).split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length > 6 || /\bPress [A-Z0-9]\b/.test(l));   // text_tightness_test's count
    out.pools = { banker: NPC_CHAT_LINES.banker, expedition: NPC_CHAT_LINES.expedition, bravo: NPC_CHAT_LINES.bravoGuide, archmage: NPC_CHAT_LINES.archmage, jukebox: NPC_CHAT_LINES.jukebox };
    out.dawnBefore = ['wardrobe', 'scribe', 'scholar', 'arena', 'usher', 'archmage'].map((r) => _lxDawnChatPool(r) === null);
    player._storyBeatsSeen.epilogue_gravitos = true;
    out.dawnAfter = ['wardrobe', 'scribe', 'scholar', 'arena', 'usher', 'archmage'].map((r) => { const p = _lxDawnChatPool(r); return p ? p.join(' / ') : null; });
    return out;
  });
  const S = R.src;
  ok('[1] the Amnesiac: no "bell-keepers", he cannot remember that "either", knows what you are, "brought" a shard, names the Pause',
    !S.bell && S.agrees && S.either && !S.oneThing && S.knows && !S.placing && S.brought && !S.took && S.pause, S);
  ok('[1] Guguma sends you to bring the dreaming home and offers a tour that exists; Mira\'s bell was stopped mid-swing; Milo names STAGE 1; no one-off "Aselm"',
    S.home && !S.takeBack && !S.gateTrial && S.swing && !S.brave && S.milo && !S.aselm, S);
  ok('[1] the Codex: the faces in the field say "stay", as the story beat does', /say one thing — stay\./.test(R.faces), R.faces);
  ok('[2] DJ Vinyl: Everdawn sleeps like a stone (answer and bubble)', /Everdawn sleeps like a stone/.test(R.dj.ans || '') && R.pools.jukebox.includes('Everdawn sleeps like a stone') && !R.pools.jukebox.includes('Everdawn never really sleeps'), R.dj.ans);
  ok('[3] Nurse Joyce: one sentence before The Second Sentence, both after it', /One sentence, in every hand but mine/.test(R.joyce0.ans || '') && /Two sentences now/.test(R.joyce1.ans || '') && /It is closer\./.test(R.joyce1.ans || ''), { before: (R.joyce0.ans || '').slice(55, 110), after: (R.joyce1.ans || '').slice(55, 150) });
  ok('[4] Elena: Sweet Candy Canyon lies west past the lagoon', /Sweet Candy Canyon, west past the lagoon/.test(R.elena.ans || ''), R.elena.ans);
  ok('[4] Whisper asks about the Sundered Forge (where the half-melted smith is)', R.whisper.ls.some((l) => /Anything about the Sundered Forge\?/.test(l)) && !R.whisper.ls.some((l) => /the foundry\?/.test(l)) && /half-melted smith/.test(R.whisper.ans || ''), R.whisper.ls);
  ok('[4] Master Kaze: a warrior goes to their own order\'s master, a rogue to Taiga (who is "he")', /your own order\\?'s master/.test(R.kazeW.ans || '') && /he holds the formal seal/.test(R.kazeW.ans || '') && /Then return to Taiga in the Hood first/.test(R.kazeR.ans || ''), { w: R.kazeW.ans, r: (R.kazeR.ans || '').slice(0, 60) });
  ok('[5] Auron agrees with Hera: the old library, and under it the graveyard; Will\'s plate reads High Commander', /The old library, and under it the graveyard/.test(R.auron.ans || '') && /High Commander/.test(R.plate || ''), { auron: (R.auron.ans || '').slice(0, 80), plate: R.plate });
  const SETS = ['aetherionastral', 'gravitospunch', 'kingKrookstomp', 'towerSovereignswing', 'legosaurusdash', 'gravitos3laser'];
  ok('[6] Marbella lists no attack animation as a boss, and says "cleared them all" once the real ones are down', !SETS.some((k) => R.marb0.includes(k) || R.marb1.includes(k)) && /cleared them all/.test(R.marb1), { before: (R.marb0.match(/walking the world:[^.]*/) || [''])[0].slice(0, 120), after: (R.marb1.match(/walking the world:[^.]*/) || [''])[0] });
  const P = R.pools;
  ok('[7] bubbles: the vault pays death last, loot stays below win or fall, share your code, the base bubbles do not name the Houses (per user: the Twelve wait for the fall of Aetherion)', P.banker.includes('The vault pays death last') && !P.banker.includes('Banked coins survive a fall')
    && P.expedition.includes('Win or fall, loot stays below') && P.expedition.includes('Bring potions. Share your code.') && P.bravo.includes('Loot stays below. Always.') && !P.bravo.includes('Quit now, lose the loot')
    && P.archmage.includes('One sky. Many questions.') && !/Houses/.test(P.archmage.join(' ')) && !P.archmage.includes('The Houses still burn up there'), P);
  ok('[7] after the ending six more roles have their own morning (and not before); every bubble <= 6 words, no key names', R.dawnBefore.every(Boolean) && R.dawnAfter.every((p) => p && p.length) && R.long.length === 0, { after: R.dawnAfter.map((p) => (p || '').slice(0, 40)), long: R.long });
  ok('[8] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
