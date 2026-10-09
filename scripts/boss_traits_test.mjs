// NO TOMORROW (per user: "every boss should signify a bold persona/trait"; Codex and quests especially; then "something more universal such as The Greedy", "remove the part about
// the easing, give a short description of the character in 1 line"): the Pause took tomorrow, so every boss is one bold trait stuck on full, named by a plain adjective. Pins: the persona is the arena card's title, the boss's own voice line and epitaph carry it, the Codex dossier shows it as a pip (and the voice
// line beats a descriptive signature), the Codex World page lists it only once the boss is met, the quests and the bestiary name it, the woman at the gate is never named, and the
// Well-Drinker, the Cap-Warden and the Brinekraken are NOT bosses (per user) so they are left out.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/boss_traits_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11651';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 240) + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof LX_BOSS_TRAITS === 'object' && typeof BOSS_INTROS === 'object' && typeof _renderLoreTab === 'function' && typeof QUESTS === 'object' && typeof MONSTER_BESTIARY === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } applyClass('warrior'); });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(() => {
    const out = {}; const T = LX_BOSS_TRAITS, wc = (t) => String(t).trim().split(/\s+/).length;
    out.n = T.length; out.keys = T.map((e) => e.k); out.traitNames = T.map((e) => e.trait); out.lines = T.map((e) => e.line); out.missingType = T.filter((e) => !monsterTypes[e.k]).map((e) => e.k);
    out.intro = T.filter((e) => BOSS_INTROS[e.k]).map((e) => [e.k, BOSS_INTROS[e.k].title, e.trait]); out.noIntro = T.filter((e) => !BOSS_INTROS[e.k]).map((e) => e.k);
    const OLD = ['The Slime Sovereign', 'Cradle-Veiled', 'Eight-Mood Meltdown', 'The Spiked Throne', 'The Lost Sentinel', 'The Broken Anvil', 'Prisoner of the Inner Dimension', 'The Warped Tyrant', 'Keeper of the Endless Express', 'Judge of the Spire', 'The Last Excuse', 'The First Expedition', 'The Weight-Bearer', 'The Hoarder', 'The Smotherer', 'The Self-Critic', 'The Sulker', 'The Mourner', 'The Tantrum', 'The Judge', 'The Idler', 'The Controller'];
    out.oldTitles = Object.entries(BOSS_INTROS).filter(([k, v]) => OLD.indexOf(v.title) >= 0).map(([k]) => k);
    out.epiAll = Object.assign({}, EVERDAWN_EPITAPHS); out.voice = LX_BOSS_VOICE; out.epi = { king: EVERDAWN_EPITAPHS.king, conductor: EVERDAWN_EPITAPHS.pqConductor, mira: EVERDAWN_EPITAPHS.miraFallen };
    out.sig = ['taiger', 'harea', 'lady_honk', 'willeo'].map((k) => monsterTypes[k].signature);
    const Q = (id) => QUESTS[id].desc; out.q = { king: Q('q_boss_king'), mooma: Q('q_boss_mooma'), inner: Q('q_inner_dim_trial'), pq: Q('q_pq_finale'), portal: Q('q_distorted_portal'), dawn: Q('q_long_dawn_1'), smith: Q('q_boss_sundered_smith'), grav: Q('q_boss_gravitos'), aeth: Q('q_boss_aetherion'), lyra: Q('q_lyra_last') };
    out.words = Object.fromEntries(Object.entries(out.q).map(([k, v]) => [k, wc(v)]));
    out.best = { king: MONSTER_BESTIARY.king.flavor, mooma: MONSTER_BESTIARY.mooma.flavor, octo: MONSTER_BESTIARY.octobaby.flavor, krook: MONSTER_BESTIARY.kingKrook.flavor };
    // the Codex World page: nothing met, one boss met, everything met
    const body = document.getElementById('lore-body'); const world = () => { _renderLoreTab('world'); return body.innerHTML; };
    const save = JSON.stringify(game.bestiary || {}); game.bestiary = {}; out.pageNone = world();
    game.bestiary = { king: 1 }; out.pageOne = world();
    game.bestiary = {}; for (const e of T) game.bestiary[e.k] = 1; out.pageAll = world();
    // the dossier: a boss whose descriptive signature used to hide its voice line, and the pip
    game.bestiary = { sundered_smith: 3, king: 2 }; try { _loreDexSelect('sundered_smith'); } catch (e) { out.dexErr = String(e); } out.dexSmith = body.innerHTML;
    try { _loreDexSelect('king'); } catch (e) { out.dexErr = String(e); } out.dexKing = body.innerHTML;
    game.bestiary = JSON.parse(save);
    return out;
  });
  const names = ['The Greedy', 'The Overprotective', 'The Unforgiving', 'The Dutiful', 'The Reckless', 'The Smug', 'The Vain', 'The Stubborn', 'The Undecided', 'The Proud', 'The Moody', 'The Grieving', 'The Hesitant', 'The Regretful', 'The Resentful', 'The Judgmental', 'The Complacent', 'The Controlling'];
  check(R.n === 18 && J(R.missingType) === '[]' && !R.keys.some((k) => /brinekraken|wellDrinker|capWarden/i.test(k)), 'eighteen bosses carry a persona (none of the Well-Drinker, Cap-Warden, Brinekraken)', J(R.keys.length) + ' ' + J(R.missingType));
  check(J(R.traitNames) === J(names), 'the personas are plain adjectives (The Greedy, The Proud...) in level order', J(R.traitNames));
  check(R.intro.length === 14 && R.intro.every(([k, title, trait]) => title === trait || (k === 'aetherion' && title === 'The Tearborn')) && R.noIntro.join() === 'taiger,harea,lady_honk,willeo', 'every boss with an arena card shows its persona as the card title (Aetherion keeps her own epithet, The Tearborn)', J(R.intro.filter(([k, a, b]) => a !== b)));
  check(R.oldTitles.length === 0, 'none of the old card titles is left', J(R.oldTitles));
  const V = R.voice; const want = ['king', 'mooma', 'kingKrook', 'octobaby', 'miraFallen', 'aetherion', 'pqConductor', 'mirrorSelf', 'young_confused_barnaby', 'sundered_smith', 'legosaurus', 'towerArbiter', 'towerSovereign', 'gravitos'];
  check(want.every((k) => V[k] && V[k].length > 8) && !V.brinekraken, 'fourteen bosses speak in their own voice (the new eight added)', J(want.filter((k) => !V[k])));
  check(V.pqConductor === 'Next stop is always next.' && /^Let me finish the shift\./.test(V.sundered_smith) && V.gravitos === 'Sleep is the only kindness I have left to carry.', 'the new voice lines read as the trait', '');
  check(/finally moves/.test(R.epi.king) && /nobody melts/.test(R.epi.king) && /someone steps off/.test(R.epi.conductor) && /this time she does not turn back/.test(R.epi.mira), 'the defeat lines: Gloopaloo finally moves and nobody melts, the train stops, she does not turn back', J(R.epi).slice(0, 200));
  check(R.sig[0].indexOf('The Reckless. ') === 0 && R.sig[1].indexOf('The Smug. ') === 0 && R.sig[2].indexOf('The Vain. ') === 0 && R.sig[3].indexOf('The Stubborn. ') === 0, 'the four distorted captains lead with their trait', J(R.sig.map((s) => s.slice(0, 22))));
  const Q = R.q;
  check(/He is the Greedy\./.test(Q.king) && /whole court/.test(Q.king) && /the Overprotective/.test(Q.mooma) && /the Unforgiving/.test(Q.inner) && /the Dutiful/.test(Q.pq) && /the Undecided/.test(Q.portal), 'the early quests name the trait (Greedy, Overprotective, Unforgiving, Dutiful, Undecided)', '');
  check(/the Resentful/.test(Q.dawn) && /the Proud/.test(Q.dawn) && /the Moody/.test(Q.dawn) && /the Grieving/.test(Q.smith) && /He is the Controlling/.test(Q.grav) && /She is the Regretful/.test(Q.aeth) && /the Hesitant/.test(Q.lyra), 'the later quests do too (Resentful, Proud, Moody, Grieving, Controlling, Regretful, Hesitant)', '');
  check(Object.entries(R.words).every(([k, n]) => n <= (k === 'lyra' ? 170 : 120)), 'every touched quest still fits its word cap (120, Lyra 170)', J(R.words));
  check(/^The Greedy\./.test(R.best.king) && /^The Overprotective\./.test(R.best.mooma) && /^The Moody\./.test(R.best.octo) && /^The Proud\./.test(R.best.krook), 'the bestiary lines (the b_ quests) lead with the trait', '');
  check(/No Tomorrow/.test(R.pageNone) && !/The Greedy/.test(R.pageNone) && /18 more are waiting to be met/.test(R.pageNone), 'the Codex World page shows No Tomorrow with nothing met: no persona is spoiled', R.pageNone.slice(-120));
  check(/The Greedy<\/b> · King Gloopaloo\. Drew his whole court into his jelly body to shield them from the flood, and has never let them out\./.test(R.pageOne) && !/The Overprotective/.test(R.pageOne) && /17 more are waiting/.test(R.pageOne), 'meeting King Gloopaloo adds only his line', R.pageOne.slice(-200));
  check(names.every((n) => R.pageAll.indexOf(n) > 0) && !/waiting to be met/.test(R.pageAll) && !/Well-Drinker|Cap-Warden|Brinekraken/.test(R.pageAll), 'with all met the page lists every persona and none of the three non-bosses', '');
  check(/ldd-pip">The Greedy</.test(R.dexKing) && /ldd-pip">The Grieving</.test(R.dexSmith) && !R.dexErr, 'the Codex dossier carries the persona as a pip', R.dexErr || '');
  check(/Let me finish the shift\./.test(R.dexSmith) && !/Half-melted forge-ghost/.test(R.dexSmith), 'the dossier speaks the boss\'s voice line, not a descriptive signature', '');
  check(!/[Ee]ases|[Ee]asing|with no tomorrow/.test(R.pageAll) && !R.lines.some((l) => /[Ee]ase|no tomorrow/.test(l)), 'the Codex page no longer talks about easing: the section intro and every line are free of it', (R.pageAll.match(/.{0,40}[Ee]ase.{0,30}/) || [''])[0]);
  const ewc = Object.entries(R.epiAll).filter(([k]) => k !== 'brinekraken').map(([k, t]) => [k, t.trim().split(/\s+/).length]);
  check(ewc.length === 11 && ewc.every(([k, n]) => n <= 33), 'the epitaphs are trimmed: every boss defeat line is 33 words or fewer (Brinekraken is not a boss and is left alone)', J(ewc.filter(([k, n]) => n > 33)) + ' ' + J(ewc));
  check(/Cedric asked/.test(R.epiAll.legosaurus) && /straight up/.test(R.epiAll.aetherion) && /does not turn back/.test(R.epiAll.miraFallen) && /the Megamall smith/.test(R.epiAll.sundered_smith), 'the trimmed epitaphs keep the lines the story hangs on (Cedric, the look up, the turn, the Megamall smith: Barnaby left Glasswind)', '');
  check(R.lines[0] === 'Drew his whole court into his jelly body to shield them from the flood, and has never let them out.' && /mirror copy/.test(R.lines[4] + R.lines[5] + R.lines[6] + R.lines[7]) && /the Twelve/.test(R.lines[11]) && /the tear/.test(R.lines[13]), 'the one-liners are tied to each story: the court, the tear\'s mirror copies, the Twelve\'s smith, the woman\'s tear', J(R.lines.slice(4, 8)));
  // Young Barnaby and the Sundered Smith are the same man a century apart: their lines rhyme without saying so
  const BV = R.voice.young_confused_barnaby, SV = R.voice.sundered_smith, BE = R.epiAll.young_confused_barnaby, SE = R.epiAll.sundered_smith, BL = R.lines[8], SL = R.lines[11];
  check(/gate/.test(BV) && /shift/.test(BV) && /gate/.test(SV) && /shift/.test(SV), 'Barnaby and the Smith speak of the same two things, the gate and the shift', J({ BV, SV }));
  check(/finally understands the question/.test(BE) && /finally understands the question/.test(SE) && /stops guarding/.test(BE) && /stops guarding/.test(SE), 'their epitaphs share a shape: each finally understands the question and stops guarding', J({ BE: BE.slice(0, 60), SE: SE.slice(0, 60) }));
  check(/still at his post/.test(BL) && /still at his post/.test(SL) && /Twelve/.test(SL) && /the tear/.test(BL), 'their Codex lines both end on the post they will not leave', J({ BL, SL }));
  check(!/\bBarnaby\b.*\b(smith|Smith)\b.*same (man|person)|same man|same person|a century on/i.test(BV + SV + BE + SE + BL + SL), 'it stays vague: no line says outright that they are one man (the film does that)', '');
  check(/lowers its weapon/.test(R.epiAll.mirrorSelf) && !/blade/.test(R.epiAll.mirrorSelf), 'Mirror Self lowers its weapon (not its blade)', R.epiAll.mirrorSelf);
  const wcl = (t) => t.trim().split(/\s+/).length;
  check(R.lines.length === 18 && R.lines.every((l) => /\.$/.test(l) && (l.match(/[.!?]/g) || []).length === 1 && wcl(l) >= 6 && wcl(l) <= 20), 'each character gets ONE short line (a single sentence of 6 to 20 words)', J(R.lines.filter((l) => !(/\.$/.test(l) && (l.match(/[.!?]/g) || []).length === 1 && wcl(l) >= 6 && wcl(l) <= 20))));
  check(R.lines.every((l) => R.pageAll.indexOf(l) > 0), 'with every boss met the page prints each one-line description', J(R.lines.filter((l) => R.pageAll.indexOf(l) < 0)));
  const texts = [JSON.stringify(R.voice), JSON.stringify(R.epi), R.pageAll, JSON.stringify(R.q), JSON.stringify(R.best), JSON.stringify(R.sig), JSON.stringify(R.intro)];
  check(!texts.some((t) => /\bMira\b/.test(t)), 'the woman at the gate is never named in any of it', '');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
