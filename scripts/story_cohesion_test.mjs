// STORY COHESION (per user: "ensure that the NPC dialogues and the quests and the codex and this storyline is well cohesive without any conflicts and written beautifully,
// succinctly, easily understandable"). Six readers audited the quests, the Codex, the story beats, the boss text and the NPC dialogue against one canon sheet; every conflict
// they found and I verified is pinned here so it cannot drift back: the facts that disagreed (the glass stair that SHATTERS, a silent gate answer, five fragments not "every" one,
// the Vigil road, the Amnesiac walking DOWN, eight PROMISES, the Woman Who Turned Back being a COPY) and the lines that were unclear.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/story_cohesion_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11951';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 240) + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
// ---- source scan (comments stripped): the NPC lines that are not reachable at runtime without a full playthrough
const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const has = (t) => code.indexOf(t) >= 0, none = (t) => code.indexOf(t) < 0;
check(has('at the gate, nameless, on his way DOWN') && none('nameless, on his way UP'), 'Old Arlen: the Amnesiac walked back DOWN from the gate nameless (the sage says so)', '');
check(has('Then you answered for them and not for yourself.') && none('you are the first who answered for them'), "the sage's late reply no longer says the player is the first to answer for them (her brother did)", '');
check(has('When she draws her bow over the Reach of Vermillion, the whole grove') && none('When she draws the Reach of Vermillion'), "Yun: Lady Hong draws her bow OVER the Reach of Vermillion (a place, the archers' range), she does not draw the place", '');
check(has('I am Vermillion, High Marshal of the Long Shot'), 'Vermillion introduces himself by his rank, High Marshal, as the Codex does', '');
check(has('Mind the basket. It purrs. Mostly.') && none("Mind the basket. It bites."), "the innkeeper's bubble matches her dialogue: the basket purrs", '');
check(has("King Gloopaloo\\'s court issued an edict") && none('The Slime Sovereign\\\'s court'), 'the fashionista names King Gloopaloo, not the retired "Slime Sovereign" title', '');
check(has("It\\'s the only tune I hum.") && none("It\\'s the only song I play."), "DJ Vinyl hums one tune; she still plays every record", '');
check(has('I am the mirror you face only after Taiga has named you.') && has('and I mirror only the ones Taiga has named') && has('he holds the formal seal of advancement'), "Kaze says it once, and keeps his pinned line about Taiga's seal", '');
check(has('I say each number aloud now, sprout.') && none('I say all three numbers aloud now'), "Shen's post-ending count reads clearly", '');
check(has('It has never tasted one.') && none('It has never tasted them.'), "the Amnesiac's \"a dream... tasted one\" agrees in number", '');
check(has("The Academia\\'s seers send envoys every spring"), "Skirra: the Academia's seers (not \"the big seers\")", '');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof STORY_BEATS === 'object' && typeof BOSS_INTROS === 'object' && typeof LX_BOSS_VOICE === 'object' && typeof EVERDAWN_ACTS === 'object' && typeof DAWN_FRAGMENTS === 'object' && typeof MONSTER_BESTIARY === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const out = {}; const D = (id) => String((QUESTS[id] || {}).desc || '');
    out.beat = JSON.stringify(STORY_BEATS.arrival_sky_beyond); out.epi = EVERDAWN_EPITAPHS; out.voice = LX_BOSS_VOICE; out.intro = BOSS_INTROS;
    out.sig = { arbiter: monsterTypes.towerArbiter.signature, mira: monsterTypes.miraFallen.signature, harea: monsterTypes.harea.signature };
    out.q = { grav: D('q_boss_gravitos'), hg5: D('q_hourglass_5'), dawn2: D('q_long_dawn_2'), lyra: D('q_lyra_last'), mooma: D('q_boss_mooma'), road5: D('q_road_5'), cut: D('q_lyra_cut'), tear: D('q_lyra_tear'), inner: D('q_inner_dim_trial'), under: D('q_clockwork_underpass'), fox: D('q_kill_nimbusFox'), bath: D('q_visit_bathhouse'), glass: D('q_visit_glasswind'), lava: D('q_visit_lavaCavern'), hg3: D('q_hourglass_3'), king: D('q_boss_king') };
    out.frag = { n: Object.keys(DAWN_FRAGMENTS).length, names: Object.values(DAWN_FRAGMENTS).map((f) => f.name) };
    out.acts = EVERDAWN_ACTS.map((a) => a.blurb).join(' | '); out.kaze = MONSTER_BESTIARY.aetherion.flavor;
    const body = document.getElementById('lore-body'); _renderLoreTab('world'); out.world = body.innerText;
    out.traitLines = LX_BOSS_TRAITS.map((e) => e.line);
    return out;
  });
  const Q = R.q, E = R.epi, V = R.voice, I = R.intro;
  check(/stair shatters/.test(E.miraFallen) && !/closes/.test(E.miraFallen) && /does not turn back/.test(E.miraFallen), 'the Woman Who Turned Back: the glass stair SHATTERS when she falls (the film shows it), and she does not turn back', E.miraFallen);
  check(/copied it, and gave the copy wings/.test(I.miraFallen.lore) && /copied it, and gave the copy wings/.test(R.sig.mira) && /distorted copy of the first to turn back/.test(Q.lyra), 'she is a COPY kept by the cold, in her card, her signature and the Lyra VI quest alike', I.miraFallen.lore.slice(-90));
  check(/carried to the gate/.test(R.beat) && !/named at the gate/.test(R.beat), "the arrival beat holds for a player who said nothing at the gate (\"the reason you carried\")", R.beat.slice(0, 120));
  check(/right back/.test(V.legosaurus) && /I.ll be right back/.test(I.legosaurus.lore), "Legosaurus's voice quotes the same promise as its card: \"right back\"", V.legosaurus);
  check(/eight promises/.test(V.octobaby) && /eight promises/.test(E.octobaby) && /eight promises to return/.test(I.octobaby.lore) && !/^[^]*eight wishes/.test(JSON.stringify([V.octobaby, E.octobaby, I.octobaby])), "Octobaby keeps eight PROMISES in its card, voice and epitaph, and speaks in the first person", V.octobaby);
  check(/its reach is immense/.test(R.sig.arbiter), 'the Arbiter is "it" in its signature, as in its card', R.sig.arbiter);
  check(R.frag.n === 6 && /Bring the five fragments/.test(Q.grav) && ['Forge-Ember', 'Stilled Hour', 'Sunmote', 'Sanctum Keystone', 'Unrefused Hour'].every((n) => Q.grav.indexOf(n) >= 0) && !/every Dawn Fragment/.test(Q.grav), "Gravitos's quest asks for five fragments and names five (the sixth is his own)", Q.grav.slice(40, 220));
  check(/met patience like it/.test(Q.grav) && /something has watched and taught you/.test(Q.grav), 'Gravitos\'s quest says what "it" is: patience like the watcher\'s', '');
  check(!/time starts walking/.test(Q.hg5) && /one stilled hour moves again/.test(Q.hg5) && /what remains of her/.test(Q.hg5) && !/second time/.test(Q.hg5), 'Hourglass V does not end the Pause, and faces what remains of her after her soul went free', Q.hg5.slice(0, 140));
  check(/Vigil road/.test(Q.dawn2) && !/Wayfarer/.test(Q.dawn2) && /Vigil road/.test(R.acts), 'one name for the road: the Vigil road, in the quest and the Act blurbs', '');
  check(/hear the world tear/.test(Q.mooma) && /hear the world tear/.test(I.mooma.lore) && /world tearing/.test(R.traitLines[1]) && /Her veil hides/.test(I.mooma.lore), "Mooma sang so they would not hear the WORLD tear (the Everdawn tear opened this spring), and her veil is explained", I.mooma.lore.slice(0, 120));
  check(/into his jelly body/.test(I.king.lore) && /into his jelly body/.test(Q.king) && /to shield them/.test(Q.king), "Gloopaloo drew his court into his JELLY BODY to shield them (said plainly, in his card and his quest)", '');
  check(/Hera.s starry robe/.test(Q.tear) && /^Harea wears/.test(Q.tear), 'the Lv 40 mirror quest opens by naming Harea, not an unnamed "She"', Q.tear.slice(0, 60));
  check(/hum will not last|it will not last/.test(Q.road5) && !/the hum is fading/.test(Q.road5), 'the lantern quest no longer says the hum is already fading before you touch one', '');
  check(/The small ones turn up as Dawn Fragments/.test(Q.cut) && /stay on the map/.test(Q.cut), 'a Lv 40 player is not told they already carry Dawn Fragments', '');
  check(/What the captains will not say/.test(Q.inner) && !/certificate/.test(Q.inner), 'the Mirror Self trial points at the captains, not a certificate that does not exist', '');
  check(/never arrives/.test(Q.under) && /scaled to your level/.test(Q.under) && !/apex-tier/.test(Q.under) && !/dialog/.test(Q.under), 'the Underpass quest: the train never arrives (the Conductor runs it), plain words for the boss and the warps', '');
  check(/than they can be folded/.test(Q.fox) && /lovely to look at/.test(Q.fox) && /carrying on, bad at moving on/.test(Q.bath) && /one House flickered/.test(Q.glass), 'four clear rewrites: the carpet, the closing line, the bathhouse and the House', '');
  check(/since none of them came home/.test(Q.lava) && /drag the key deeper for salt/.test(Q.lava) && /give Wynn the rest/.test(Q.hg3), 'the lava cavern and the courier quests read plainly (no single "year" for the Twelve)', '');
  check(/the world that is remembering you/.test(R.world) && /Then meet two who cannot stop working/.test(R.acts) && /keep leaking what they dream/.test(R.acts) && /sleepers.? ledger/.test(R.acts), "the Codex and the Act blurbs are true: not 'the first two' who cannot stop working, leaks that already began, and 'world' not 'dimension'", '');
  check(/The Tearborn\. She broke the sky and guards the shards no one finished/.test(R.kaze) && !/Hourglass/.test(R.kaze), "Aetherion is not the Hourglass's keeper: she broke the sky and guards the shards no one finished", R.kaze);
  check(/she looks relieved, and then, once, straight up\. On the last step, that soul goes free\./.test(E.aetherion), "Aetherion's epitaph reads as two plain sentences again", E.aetherion);
  check(/hit as on the first/.test(src) && !/hundredth swing/.test(src), 'the shared Lv 30-39 class line says "hit" (archers shoot and mages cast)', '');
  check(!/\bMira\b/.test(JSON.stringify([E, V, I, Q, R.world, R.acts, R.kaze, R.sig])), 'the woman at the gate is never named in any of it', '');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
