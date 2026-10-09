// AETHERION IS HER OWN CREATURE (per user, 2026-10-08): a she, born of the heartfelt tear the woman at the gate wept when she turned back, wearing that woman's face; she
// is NOT the woman and NOT the Cap-Warden, and she holds the woman's soul, which goes free when she yields. Her epithet is "the Tearborn" (no "Shardfather", no "the
// Warden"), and the text revolves around the woman at the gate WITHOUT using her name (it is told only once she has been met at the gate). Pins every place the old
// canon lived: the quests, the Codex page and bestiary card, the boss's own line and fall card, the epitaph, the Act blurbs, the achievement, the Amnesiac's farewell.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/bughunt_aetherion_canon_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11291';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 260) + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
// ---- the source, comments stripped: the old words are gone from everything a player can read
const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
// split on CRLF too: the worktree copy is CRLF, and a trailing \r stops `.*$` from reaching a line-end comment
const code = src.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const noOtherWardens = code.replace(/Cap-Warden|CAP-WARDEN|Hall Wardens?|Warden(\\)?'s Court/g, '');
check(!/shardfather/i.test(code), 'no "Shardfather" anywhere in the game text', (code.match(/.{0,40}shardfather.{0,40}/i) || [''])[0]);
check(!/\bWarden\b/.test(noOtherWardens), 'no bare "the Warden" any more (the Cap-Warden and the Hall Wardens are other people and keep their names)', (noOtherWardens.match(/.{0,50}\bWarden\b.{0,40}/) || [''])[0]);
check(!/the Unspoken|UNSPOKEN/.test(code), 'her old interim epithet "the Unspoken" is gone: she is the Tearborn', (code.match(/.{0,40}(the Unspoken|UNSPOKEN).{0,40}/) || [''])[0]);
check(code.includes('born of the heartfelt tear the woman at the gate wept, and wearing her face. She guards every wish that someone almost dared'), "the bestiary's intro for her says she, and what she was born of");
check(code.split('The Cap-Warden exhales a cloud: sporelings!').length === 2, 'the Cap-Warden is a different character and keeps its own fight and name', '');
const steam = JSON.parse(readFileSync(path.join(SERVE_ROOT, 'steam', 'achievements_manifest.json'), 'utf8')); const sa = JSON.stringify(steam);
check(/"aetherionDown"[\s\S]{0,200}"Let Her Go"|"Let Her Go"[\s\S]{0,200}aetherionDown/.test(sa) && !/Warden Undone/.test(sa), 'the Steam manifest carries the achievement as "Let Her Go"', '');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof STORY_BEATS === 'object' && typeof monsterTypes === 'object' && typeof LORE_WORLD_HTML === 'string' && typeof EVERDAWN_ACTS === 'object' && typeof MONSTER_BESTIARY === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const out = {}; const codexP = (LORE_WORLD_HTML.match(/<p>[^]*?<\/p>/g) || []).find((p) => /Aetherion/.test(p)) || '';
    const tx = (h) => String(h).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const stanza0 = () => { const t = STORY_BEATS.warden_falls.stanzas[0].text; return typeof t === 'function' ? t({}) : t; };
    out.texts = { 'the Sanctum quest': QUESTS.q_boss_aetherion.desc, 'Hourglass V': QUESTS.q_hourglass_5.desc, 'Lyra VI': QUESTS.q_lyra_last.desc, 'the Codex page': tx(codexP), 'the bestiary card': BOSS_INTROS.aetherion.lore, "the boss's own line": LX_BOSS_VOICE.aetherion, 'the epitaph': EVERDAWN_EPITAPHS.aetherion, 'the Amnesiac': stanza0(), 'Master Kaze': MONSTER_BESTIARY.aetherion.flavor };
    out.names = { mon: monsterTypes.aetherion.name, title: BOSS_INTROS.aetherion.title, q: QUESTS.q_boss_aetherion.name, h5: QUESTS.q_hourglass_5.name, frag: DAWN_FRAGMENTS.frag_aetherion && DAWN_FRAGMENTS.frag_aetherion.name, from: DAWN_FRAGMENTS.frag_aetherion && DAWN_FRAGMENTS.frag_aetherion.from, ach: (ACHIEVEMENTS.find((a) => a.id === 'aetherionDown') || {}).name };
    out.acts = EVERDAWN_ACTS.map((a) => a.blurb).join(' | ');
    out.q3 = QUESTS.q_boss_aetherion.desc; out.codex = tx(codexP); out.lyra = QUESTS.q_lyra_last.desc; out.voice = LX_BOSS_VOICE.aetherion; out.epi = EVERDAWN_EPITAPHS.aetherion; out.lore = BOSS_INTROS.aetherion.lore;
    out.gravitosFrags = QUESTS.q_boss_gravitos && QUESTS.q_boss_gravitos.desc;
    out.amnesiacPost = (() => { const f = window._lxSiblingsKnown; window._lxSiblingsKnown = () => true; try { return stanza0(); } finally { window._lxSiblingsKnown = f; } })();
    return out;
  });
  const T = R.texts, he = /\b(he|his|him|himself)\b/i, name = /\bMira\b/;
  check(R.names.mon === 'Aetherion, the Tearborn' && R.names.title === 'The Tearborn' && R.names.from === 'Aetherion, the Tearborn', 'her name everywhere is "Aetherion, the Tearborn"', J(R.names));
  check(R.names.q === "The Sanctum's Refusal" && R.names.h5 === 'Hourglass V \u2014 The Tearborn Speaks' && R.names.frag === 'Sanctum Keystone' && R.names.ach === 'Let Her Go', 'her quests, her fragment and her achievement drop "the Warden" / "Shardfather"', J(R.names));
  // the two male references that are not about her: Vesper's note (Lyra VI) and the Amnesiac's own stage direction
  const OTHERS = { 'Lyra VI': /because his note says/g, 'the Amnesiac': /\*[^*]*\*/g };
  for (const [k, v0] of Object.entries(T)) if (v0) { const v = OTHERS[k] ? v0.replace(OTHERS[k], '') : v0; check(!he.test(v), k + ': no he / his / him for her', (v.match(/.{0,40}\b(he|his|him|himself)\b.{0,30}/i) || [''])[0]); }
  for (const [k, v] of Object.entries({ ...T, 'the Act blurbs': R.acts })) check(!name.test(v), k + ': her name is not used (it is told only at the gate)');
  for (const [k, v] of Object.entries({ ...T, ...R.names })) if (k !== 'the Amnesiac' && k !== 'Lyra VI') check(!/Warden/.test(String(v)), k + ': nothing of hers is called a Warden (the Cap-Warden is another character)');
  check(/woman at the gate/.test(R.q3) && /heartfelt tear/.test(R.q3) && /wearing that woman's face and holding her soul/.test(R.q3) && /she has guarded the break/.test(R.q3) && /the soul she held goes free/.test(R.q3), 'the Sanctum quest: born of the heartfelt tear the woman at the gate wept, wearing that face and holding her soul, which goes free when she yields', R.q3.slice(60, 400));
  check(/the Tearborn, who broke the sky/.test(R.codex) && /creature of her own, born of the heartfelt tear the woman at the gate wept/.test(R.codex) && /Each of the Twelve tried to move her/.test(R.codex), 'the Codex page says the same, and that none of the Twelve could move her', R.codex.slice(-260));
  check(/distorted copy of the first to turn back from the gate/.test(R.lyra) && /its one tear lands, the glass parts on the Sanctum, and what the tear became waits there/.test(R.lyra), "Lyra VI matches the films: the Last Step's copy is distorted, its one tear lands when it falls, and the glass parts on the Sanctum, where what the tear became waits", R.lyra.slice(300, 520));
  check(/heartfelt tear/.test(R.lore) && /She is not that woman\. She is what the tear became\./.test(R.lore) && /She was the answer once\. She is the wound now\./.test(R.lore), 'the bestiary card: the heartfelt tear, not that woman, what the tear became; the answer once, the wound now', R.lore);
  check(/Let her go\./.test(R.voice) && /tear she did not wipe away/.test(R.voice) && /gave me her face/.test(R.voice), "the boss's own line: the tear she did not wipe away, the cold gave me her face, let her go", R.voice);
  check(/tear that grew a face/.test(R.epi) && /that soul goes free/.test(R.epi) && /she looks relieved/.test(R.epi), 'the epitaph: she looks relieved and the soul goes free', R.epi);
  check(/just let go/.test(T['the Amnesiac']) && /free of it/.test(R.amnesiacPost), "the Amnesiac's farewell says whoever held her was let go (before the reveal) and that she is free of it (after)", T['the Amnesiac'].slice(80, 220) + ' || ' + R.amnesiacPost.slice(120, 300));
  check(/a creature born of a heartfelt tear, wearing a borrowed face: talk her down, and take the Keystone/.test(R.acts) && /if she still stands/.test(R.acts), 'the Act blurbs say she, the tear and the Keystone', R.acts.slice(0, 40));
  check(/the Sanctum Keystone/.test(R.gravitosFrags || ''), "Gravitos's quest names the Sanctum Keystone", '');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
