// STORY COHERENCE (v0.30.904, per user "strengthen the storyline and ensure that the conversation and quests all sound
// coherent and do not contradict"). Each gone-string is one side of a contradiction a four-part read of the story found
// (main arc, quests, NPC talk, Codex) and the source confirmed; the other side is the story that stays. Plus what the game
// computes: the Journal's act blurb at each fragment milestone, the Amnesiac's saga at act 4, the Echo Keeper's pay line
// for a zodiac shade vs any other, Gravitos speaking for himself, and the story chain naming the Long Dawn.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/story_coherence_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11261';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const GONE = {
  arc: ['You were never a stranger here', 'The Everdawn is your grief', 'holding your nightmare <em>for</em> you', 'broke it into shards, hid one in each', 'hoard the stolen dream',
    'it unmade every one', 'the small kind voice on the highest perch', 'It comes from what raised you', 'the heavens open, and only Gravitos', 'trapped mid-nightmare',
    'The seam above opens once. Always', 'told the watcher', 'range: \'Lv 1–25\'', 'range: \'Lv 50–100\''],
  npcs: ['The others answered and stepped through', 'Twelve ages of expeditions have passed me', 'shattered his own anvil rather than', 'What was stolen is stacked',
    'first one that stayed long enough to be taught', 'younger version of my brother', 'Hera: "The tear is a mirror with broken edges. Walk in carefully — a Lyra', 'Cut it down again', 'the only new thoughts here in twelve ages',
    'first soul in an age worth reaching for', 'a real name in the lore', 'drive ya FREE', 'About the thing at the top', 'when you have been to the top', 'a tear above the sky',
    'they say. Forty years', 'The mountain provides', 'Five fools in one body', 'Ren? Was it?', 'Mojicoins buy wisdom', 'burning for you'],
  quests: ['from the sugar-verge', 'same hour her ovens did', 'Kuro, who taught half this town', 'four months of Tuesdays', 'Captain Halcyon used to run', 'Sundered Forge off Magma Foundry',
    'forge off the Magma Foundry', 'no instant fast-travel', 'native enough to inherit the silence'],
  codex: ['night after sleepless night', 'the dreaming at its root', 'the interference would scatter it', 'were sent to teach the world to dream', 'short of the Sanctum gate',
    'The Twelve Zodiac</em>', 'a Master soon after', 'Each crossing greets you once', 'aloud, is here', 'shattered hourglass', 'last expedition\'s survivors', 'Bastion set piece',
    'The necromancer was Aselm', 'Soon after, they choose', 'At the height of an expedition a hero can', 'Three throats answer', 'the eleven who vanished'],
};
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const r = await page.evaluate(async (GONE) => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    const src = document.documentElement.outerHTML;
    out.gone = {}; for (const k in GONE) out.gone[k] = GONE[k].filter((t) => src.includes(t));
    out.zodiacFrag = /twelve Zodiac\s+fragments/.test(src);
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 80; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    // the Journal's act at each fragment milestone describes what is still ahead
    const at = (frags) => { player.dawnFragments = frags.slice(); const s = _sagaState(); return { act: s.act, range: s.actInfo.range, blurb: s.actInfo.blurb }; };
    out.acts = [at([]), at(['frag_smith']), at(['frag_smith', 'frag_aetherion']), at(['frag_smith', 'frag_aetherion', 'frag_aries', 'frag_vigil'])];
    // Gravitos speaks for himself: no narrator lead-in on any of his stanzas, for any gate answer
    const grav = [];
    for (const k in STORY_BEATS) for (const st of (STORY_BEATS[k].stanzas || [])) {
      if (!/Gravitos/.test(st.speaker || '') && !(typeof st.text === 'function' && /gate_answer/.test(String(st.text)) && /gravitos/i.test(k))) continue;
      for (const a of ['wake', 'home', 'unsure', '']) { const t = typeof st.text === 'function' ? st.text({ gate_answer: a }) : st.text; if (/^\s*\*/.test(t || '')) grav.push(k + ': ' + String(t).slice(0, 40)); if (typeof st.text !== 'function') break; }
    }
    out.grav = [...new Set(grav)];
    // the Amnesiac's saga once the dream has edges again (act 4)
    let last = ''; const _rt = window._runDialogTypewriter; window._runDialogTypewriter = function (t) { last = String(t); return _rt.apply(this, arguments); };
    player.dawnFragments = ['frag_smith', 'frag_aetherion', 'frag_vigil'];
    const am = (game.npcs || []).find((n) => n.role === 'amnesiac') || { name: 'The Amnesiac', role: 'amnesiac', x: 400, y: 400 };
    game._amnesiacSagaView = true; try { openNPC(am); } catch (e) { last = 'ERR ' + e.message; } out.saga4 = last;
    game._amnesiacSagaView = false; try { closeDialog(); } catch (e) {}
    // the Echo Keeper tells a zodiac shade's pay apart from any other boss's
    const zt = Object.keys(monsterTypes).find((k) => k.indexOf('zodiac_') === 0);
    try { openNPC({ name: 'Echo Keeper', role: 'echoKeeper', _bossType: zt, x: 400, y: 400 }); } catch (e) { last = 'ERR ' + e.message; } out.echoZ = last;
    try { closeDialog(); openNPC({ name: 'Echo Keeper', role: 'echoKeeper', _bossType: 'king', x: 400, y: 400 }); } catch (e) { last = 'ERR ' + e.message; } out.echoK = last;
    try { closeDialog(); } catch (e) {}
    window._runDialogTypewriter = _rt;
    out.chain = { twelve: _QUEST_STORY_CHAIN.indexOf('q_zodiac_twelve'), d1: _QUEST_STORY_CHAIN.indexOf('q_long_dawn_1'), d2: _QUEST_STORY_CHAIN.indexOf('q_long_dawn_2'), grav: _QUEST_STORY_CHAIN.indexOf('q_boss_gravitos') };
    out.sentence = ['q_kindest_hand', 'q_long_dawn_1', 'q_boss_gravitos'].map((id) => /kindest hand is the one you will have to fight/i.test((QUESTS[id] || {}).desc || '')).join(',');
    return out;
  }, GONE);
  for (const k in r.gone) check(r.gone[k].length === 0, 'the ' + k + ' no longer contradicts the story', J(r.gone[k]));
  check(!r.zodiacFrag, 'the Codex names the Dawn Fragments, not "twelve Zodiac fragments" (the Houses leave none)', '');
  const [a1, a2, a3, a4] = r.acts;
  check(J(r.acts.map((a) => a.range)) === J(['Lv 1–45', 'Lv 45–60', 'Lv 60–76', 'Lv 76–100']) && J(r.acts.map((a) => a.act)) === J([1, 2, 3, 4]), "the Journal's act ranges match when each act is shown", J(r.acts.map((a) => a.act + ' ' + a.range)));
  check(/Forge-Ember/.test(a1.blurb) && !/Forge-Ember/.test(a2.blurb) && /Keystone/.test(a2.blurb) && /tyrants/.test(a3.blurb) && !/End all three refusals/.test(a4.blurb),
    'each act blurb describes what is still ahead (Act 2 no longer asks for the shard you just took)', J([a2.blurb.slice(0, 50), a4.blurb.slice(0, 50)]));
  check(r.grav.length === 0, 'Gravitos speaks for himself - no narrator lead-ins', J(r.grav));
  check(/somewhere else/.test(r.saga4) && !/The Everdawn is your grief/.test(r.saga4) && /Give him a reason/.test(r.saga4), 'the Amnesiac no longer tells the Outsider the Everdawn is their grief', r.saga4.slice(0, 120));
  check(/zodiac shade pays its full EXP/.test(r.echoZ) && /no boons, no EXP, no coins/.test(r.echoK) && !/zodiac shade/.test(r.echoK), 'the Echo Keeper says what a zodiac shade pays, and that other echoes pay nothing', J([r.echoZ.slice(-120), r.echoK.slice(-80)]));
  check(r.chain.twelve >= 0 && r.chain.d1 > r.chain.twelve && r.chain.d2 > r.chain.d1 && r.chain.grav > r.chain.d2, 'the story chain runs the Twelve, the Long Dawn, then Gravitos', J(r.chain));
  check(r.sentence === 'true,true,true', "the Amnesiac's one sentence is worded the same everywhere", r.sentence);
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
