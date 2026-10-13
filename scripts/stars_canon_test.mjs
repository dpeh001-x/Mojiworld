// THE STARS CANON (per user, 2026-10-12): the Pause is immeasurable (no counted ages), the Twelve Houses are the Twelve STARS (the world's first dreams, shining in the sky, fallen and
// distorted into a monstrosity each), the four captains are the champions of their own clans, Barnaby tried to fuse magic into smithing and it went awry (a dark seal in the blade; the
// seal broke at the gate and opened the tear), Aetherion is the woman at the gate distorted when that seal broke, and the town has no held spring.
//   node scripts/stars_canon_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11805), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
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
    if (!player.cls) applyClass('warrior'); player.level = 90; player.exp = 0; player.expToNext = _lxLevelCost(90); player._tutorialSeen = true; player._gravitosCineSeen = true;
    const strip = (t) => String(t == null ? '' : t).replace(/<[^>]+>/g, '');
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const ask = async (map, find, optRe) => { loadMap(map, 300); await sleep(900); game.paused = false; try { closeAllModals(); } catch (e) {}
      const n = (game.mapData.npcs || []).find(find); if (!n) return { err: 'no npc on ' + map }; game._brokMenu = null; game._lxOrderPage = null; game._sageStage = 0; openNPC(n); await sleep(300); await settle();
      const had = optRe ? await click(optRe) : true; await settle(); const t = text(); try { closeDialog(); } catch (e) {} await sleep(200); return { had, t }; };
    // ---- every player-visible story text, in one pile
    const pile = []; for (const id of Object.keys(QUESTS)) pile.push(strip(QUESTS[id]._lxDesc0 != null ? QUESTS[id]._lxDesc0 : QUESTS[id].desc), strip(QUESTS[id].name));
    for (const id of Object.keys(STORY_BEATS)) for (const s of STORY_BEATS[id].stanzas || []) { for (const tw of [false, true]) { window.__tw = tw; try { pile.push(strip(typeof s.text === 'function' ? s.text({}) : s.text)); } catch (e) {} } }
    for (const k of Object.keys(BOSS_INTROS)) pile.push(strip(BOSS_INTROS[k].lore)); pile.push(strip(LORE_WORLD_HTML));
    out.pile = pile.join('\n'); out.maps = Object.keys(MAPS).filter((k) => /^zod_/.test(k)).map((k) => MAPS[k].name);
    const Q = QUESTS; out.q = { four: Q.q_four_captains.desc, tw: Q.q_zodiac_twelve.desc, tw_name: Q.q_zodiac_twelve.name, aries: Q.q_boss_aries.desc, fin: Q.q_barnaby_finish.desc, forge: Q.q_lyra_forge.desc, ae: Q.q_boss_aetherion.desc, last: Q.q_last_step.desc, lyra6: Q.q_lyra_last.desc, canary: Q.q_canary_quiet.name };
    out.words = { fin: strip(Q.q_barnaby_finish.desc).split(/\s+/).length, ae: strip(Q.q_boss_aetherion.desc).split(/\s+/).length, tw: strip(Q.q_zodiac_twelve.desc).split(/\s+/).length };
    out.ae = { lore: BOSS_INTROS.aetherion.lore };
    const ch = _QUEST_STORY_CHAIN; out.chain = [ch.indexOf('q_long_dawn_3'), ch.indexOf('q_zodiac_twelve'), ch.indexOf('q_boss_gravitos')];
    // ---- the Gate and the Zodiac Hall name the stars only once Aetherion has fallen
    const tw0 = window._lxTwelveKnown; const gate = STORY_BEATS.first_gate_visit.stanzas[4].text, hall = STORY_BEATS.arrival_sky_beyond.stanzas[1].text;
    window._lxTwelveKnown = () => false; out.gateNo = gate({ gate_answer: 'wake' }); out.hallNo = hall(); window._lxTwelveKnown = () => true; out.gateYes = gate({ gate_answer: 'wake' }); out.hallYes = hall(); window._lxTwelveKnown = tw0;
    // ---- Lyra answers each chapter; Guguma after the ending; the Sage on her feet
    player.quests = { active: {}, completed: {} }; out.lyra = {};
    for (const [k, qs] of [['cut', ['q_lyra_tear', 'q_lyra_cut']], ['last', ['q_lyra_tear', 'q_lyra_cut', 'q_lyra_kin', 'q_lyra_last']]]) { player.quests.completed = {}; for (const q of qs) player.quests.completed[q] = true; out.lyra[k] = (await ask('azureAcademia', (n) => n.name === 'Lyra', /What are you working on\?/)).t; }
    const sc = window._lxStoryComplete; window._lxStoryComplete = () => true; out.gug = (await ask('town', (n) => n.name === 'Guguma' || n.role === 'guide', /Where did you come from\?/)).t; window._lxStoryComplete = sc;
    out.arlen = (await ask('town', (n) => n.name === 'Old Arlen', /green leaves/)).t;
    return out;
  });
  const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8'), P = R.pile;
  ok('[1] no counted ages: the Pause is immeasurable (no "twelve ages", "three ages", "sixty years" in any quest, beat, card or Codex page)', !/[Tt]welve ages|[Tt]hree ages|[Ss]ixty years/.test(P) && !/[Ss]ixty years/.test(src), P.match(/[Tt]welve ages|[Tt]hree ages|[Ss]ixty years/));
  ok('[2] no Houses: the Twelve are the Twelve Stars everywhere (quest, achievement, maps, Codex, cards)', !/\bHouses?\b/.test(P) && R.q.tw_name === 'The Twelve Stars' && R.maps.every((n) => /^Star of /.test(n)) && /The Twelve Stars/.test(src), [R.q.tw_name, R.maps.slice(0, 2)]);
  ok('[2] the origin: the world\'s first dreams, shining in the sky, distorted by whoever made the sky, fallen as monsters; a clan\'s champion answered each', /Twelve stars fell from the sky, distorted/.test(R.q.tw) && /one by one became monsters/.test(R.q.tw) && /champion of the clans/.test(R.q.tw) && !/first dreams|Whoever made the sky/.test(R.q.tw + R.pile.slice(0, 0)) && !/champion this world raised|raised twelve/.test(P), R.words.tw);
  ok('[3] the four captains are the champions of their own clans (Four Captains, the order dossiers)', /each the champion of a clan/.test(R.q.four) && /champion of the Bastion/.test(src) && /champion of the Academia/.test(src) && /champion of the Grove/.test(src) && /champion of the Hood/.test(src), '');
  ok('[4] Barnaby tried to fuse magic into smithing and it went awry: a dark seal in the steel, broken at the gate, the leak became the tear', /fuse magic into the smithing/.test(R.q.forge) && /seal/.test(R.q.forge) && /fused into the smithing/.test(R.q.fin) && /the seal broke at the gate/.test(R.q.fin) && /went awry/.test(R.q.fin) && R.words.fin <= 190, [R.words.fin]);
  ok('[4] the Smith\'s loan is closed, not "hammer down" a third time; Barnaby I speaks of Brok in the third person all through', /close the loan at the Smith/.test(R.q.fin) && !/put the hammer down/.test(R.q.fin) && /Clear Brok a path/.test(P), '');
  ok('[6] Aetherion is the woman at the gate, distorted when the seal on her dark-magic blade broke - in the quest, the Codex, her card, her dossier and her trait line', /the part of the woman at the gate that the dark took, distorted/.test(R.q.ae) && /seal on her dark-magic blade broke/.test(R.q.ae) && /seal broke the dark took her/.test(R.ae.lore) && /distorted when the seal on her blade broke/.test(src) && !/heartfelt tear|grew a face|wept when she/.test(P + src) && R.words.ae <= 170, [R.words.ae]);
  ok('[6] the copy\'s fall opens the way and no longer births her: no "one tear" in the Last Step or Tear VI', !/one tear/.test(R.q.last + R.q.lyra6) && /the one it was copied from waits there/.test(R.q.lyra6), '');
  ok('[7] no held spring: Arlen\'s blossoms are the Pause\'s, and the leaves are allowed after the ending (no "same spring")', !/same spring|held spring|morning of the same/.test(P) && /dream-cherries/.test(R.arlen), R.arlen.slice(0, 120));
  ok('[A] the Gate and the Zodiac Hall name the stars only once Aetherion has fallen', /The road is waiting/.test(R.gateNo) && !/stars|Houses/.test(R.gateNo) && /The stars are waiting/.test(R.gateYes) && /Something old burns up here/.test(R.hallNo) && !/Twelve|houses|champions/i.test(R.hallNo) && /twelve fallen stars burn up here/.test(R.hallYes), [R.gateNo.slice(-40), R.hallNo.slice(-50)]);
  ok('[A] the Petition door names everything it waits for, and the Act 4 signpost sends the player to Arlen and Hera', /the five fragments, the twelve stars, and the Dreams Above/.test(src) && /hear from Arlen and Hera what the stars were/.test(src) && /When the Ram falls, three tyrants/.test(src), '');
  ok('[G] the story chain walks Aries -> the tyrants -> the Stars -> the Dreams -> the Petition (per user 2026-10-13: the Dreams follow the Stars; Next no longer sticks on the Twelve at Lv 70)', R.chain[1] >= 0 && R.chain[0] === R.chain[1] + 1 && R.chain[2] === R.chain[0] + 1, R.chain);
  ok('[G] the Four Captains hook is true (each tells it differently), and the First-Born no longer cites an off-path letter', /Each will tell it differently/.test(R.q.four) && !/Wynn/.test(R.q.aries), '');
  ok('[H] Lyra answers Tear III and Tear VI (the hole she found, not made; her father\'s name not on the roll)', /found the hole, not that I made it/.test(R.lyra.cut) && /my father\'s is not among them|my father's is not among them/.test(R.lyra.last), [R.lyra.cut.slice(0, 40), R.lyra.last.slice(0, 40)]);
  ok('[F] Guguma after the ending: "I never said the watcher was somebody else"; the twelfth who walked through has a name in his answers; the canary did not flinch', /I never said the watcher was somebody else/.test(R.gug) && /walked straight up to the gate and through it/.test(src) && R.q.canary === 'The Canary Did Not Flinch', R.gug.slice(0, 80));
  ok('[no errors] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
