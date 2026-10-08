// NO TOMORROW (per user: "every boss should signify a bold persona/trait"; Codex and quests especially): the Pause took tomorrow, a trait only eases with time, so every boss
// is one bold trait stuck on full. Pins: the persona is the arena card's title, the boss's own voice line and epitaph carry it, the Codex dossier shows it as a pip (and the voice
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
    out.n = T.length; out.keys = T.map((e) => e.k); out.traitNames = T.map((e) => e.trait); out.missingType = T.filter((e) => !monsterTypes[e.k]).map((e) => e.k);
    out.intro = T.filter((e) => BOSS_INTROS[e.k]).map((e) => [e.k, BOSS_INTROS[e.k].title, e.trait]); out.noIntro = T.filter((e) => !BOSS_INTROS[e.k]).map((e) => e.k);
    const OLD = ['The Slime Sovereign', 'Cradle-Veiled', 'Eight-Mood Meltdown', 'The Spiked Throne', 'The Lost Sentinel', 'The Broken Anvil', 'Prisoner of the Inner Dimension', 'The Warped Tyrant', 'Keeper of the Endless Express', 'Judge of the Spire', 'The Last Excuse', 'The First Expedition', 'The Weight-Bearer'];
    out.oldTitles = Object.entries(BOSS_INTROS).filter(([k, v]) => OLD.indexOf(v.title) >= 0).map(([k]) => k);
    out.voice = LX_BOSS_VOICE; out.epi = { king: EVERDAWN_EPITAPHS.king, conductor: EVERDAWN_EPITAPHS.pqConductor, mira: EVERDAWN_EPITAPHS.miraFallen };
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
  const names = ['The Hoarder', 'The Smotherer', 'The Self-Critic', 'The Dutiful', 'The Reckless', 'The Know-It-All', 'The Vain', 'The Stubborn', 'The Undecided', 'The Proud', 'The Sulker', 'The Mourner', 'The Hesitant', 'The Tearborn', 'The Tantrum', 'The Judge', 'The Idler', 'The Controller'];
  check(R.n === 18 && J(R.missingType) === '[]' && !R.keys.some((k) => /brinekraken|wellDrinker|capWarden/i.test(k)), 'eighteen bosses carry a persona (none of the Well-Drinker, Cap-Warden, Brinekraken)', J(R.keys.length) + ' ' + J(R.missingType));
  check(J(R.traitNames) === J(names), 'the personas are the bold traits in level order', J(R.traitNames));
  check(R.intro.length === 14 && R.intro.every(([k, title, trait]) => title === trait) && R.noIntro.join() === 'taiger,harea,lady_honk,willeo', 'every boss with an arena card shows its persona as the card title', J(R.intro.filter(([k, a, b]) => a !== b)));
  check(R.oldTitles.length === 0, 'none of the old card titles is left', J(R.oldTitles));
  const V = R.voice; const want = ['king', 'mooma', 'kingKrook', 'octobaby', 'miraFallen', 'aetherion', 'pqConductor', 'mirrorSelf', 'young_confused_barnaby', 'sundered_smith', 'legosaurus', 'towerArbiter', 'towerSovereign', 'gravitos'];
  check(want.every((k) => V[k] && V[k].length > 8) && !V.brinekraken, 'fourteen bosses speak in their own voice (the new eight added)', J(want.filter((k) => !V[k])));
  check(V.pqConductor === 'Next stop is always next.' && V.sundered_smith === 'Let me finish the shift.' && V.gravitos === 'Sleep is the only kindness I have left to carry.', 'the new voice lines read as the trait', '');
  check(/his court slips out/.test(R.epi.king) && /Someone steps off/.test(R.epi.conductor) && /this time she does not turn back/.test(R.epi.mira), 'the epitaphs ease the trait: the Hoarder opens, the train stops, she does not turn back', J(R.epi).slice(0, 200));
  check(R.sig[0].indexOf('The Reckless. ') === 0 && R.sig[1].indexOf('The Know-It-All. ') === 0 && R.sig[2].indexOf('The Vain. ') === 0 && R.sig[3].indexOf('The Stubborn. ') === 0, 'the four distorted captains lead with their trait', J(R.sig.map((s) => s.slice(0, 22))));
  const Q = R.q;
  check(/the Hoarder/.test(Q.king) && /whole court/.test(Q.king) && /the Smotherer/.test(Q.mooma) && /the Self-Critic/.test(Q.inner) && /the Dutiful/.test(Q.pq) && /the Undecided/.test(Q.portal), 'the early quests name the trait (Hoarder, Smotherer, Self-Critic, Dutiful, Undecided)', '');
  check(/the Tantrum/.test(Q.dawn) && /the Proud/.test(Q.dawn) && /the Sulker/.test(Q.dawn) && /the Mourner/.test(Q.smith) && /He is Control/.test(Q.grav) && /She is Regret/.test(Q.aeth) && /the Hesitant/.test(Q.lyra), 'the later quests do too (Tantrum, Proud, Sulker, Mourner, Control, Regret, Hesitant)', '');
  check(Object.entries(R.words).every(([k, n]) => n <= (k === 'lyra' ? 170 : 120)), 'every touched quest still fits its word cap (120, Lyra 170)', J(R.words));
  check(/^The Hoarder\./.test(R.best.king) && /^The Smotherer\./.test(R.best.mooma) && /^The Sulker\./.test(R.best.octo) && /^The Proud\./.test(R.best.krook), 'the bestiary lines (the b_ quests) lead with the trait', '');
  check(/No Tomorrow/.test(R.pageNone) && !/The Hoarder/.test(R.pageNone) && /18 more are waiting to be met/.test(R.pageNone), 'the Codex World page shows No Tomorrow with nothing met: no persona is spoiled', R.pageNone.slice(-120));
  check(/The Hoarder<\/b> · King Gloopaloo\./.test(R.pageOne) && !/The Smotherer/.test(R.pageOne) && /17 more are waiting/.test(R.pageOne), 'meeting King Gloopaloo adds only his line', R.pageOne.slice(-200));
  check(names.every((n) => R.pageAll.indexOf(n) > 0) && !/waiting to be met/.test(R.pageAll) && !/Well-Drinker|Cap-Warden|Brinekraken/.test(R.pageAll), 'with all met the page lists every persona and none of the three non-bosses', '');
  check(/ldd-pip">The Hoarder</.test(R.dexKing) && /ldd-pip">The Mourner</.test(R.dexSmith) && !R.dexErr, 'the Codex dossier carries the persona as a pip', R.dexErr || '');
  check(/Let me finish the shift\./.test(R.dexSmith) && !/Half-melted forge-ghost/.test(R.dexSmith), 'the dossier speaks the boss\'s voice line, not a descriptive signature', '');
  const texts = [JSON.stringify(R.voice), JSON.stringify(R.epi), R.pageAll, JSON.stringify(R.q), JSON.stringify(R.best), JSON.stringify(R.sig), JSON.stringify(R.intro)];
  check(!texts.some((t) => /\bMira\b/.test(t)), 'the woman at the gate is never named in any of it', '');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
