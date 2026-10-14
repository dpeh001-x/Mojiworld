// THE TWELVE STARS ROLL-CALL (per user, 2026-10-13): "For the 12 stars quest can list the bosses that are defeated and those that have yet to be defeated."
//   the tracker row shows twelve glyph chips (green + tick = at rest), the Journal lists "Put to rest" and "Still burning" by name with levels,
//   the locate line and the guidance line name the count and the next star, and a star's fall ticks it off at once.
//   node scripts/stars_rollcall_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11811), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
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
    if (!player.cls) applyClass('warrior'); player.level = 80; player.exp = 0; player.expToNext = _lxLevelCost(80); player._tutorialSeen = true;
    game.bestiary = game.bestiary || {}; for (const z of ZODIAC_SIGNS) delete game.bestiary['_boss_zodiac_' + z.id];
    game.bestiary.aetherion = 1;   // the Twelve are known only after Aetherion falls
    player.quests = player.quests || { active: {}, completed: {} }; player.quests.active = {}; player.quests.completed = { q_boss_aetherion: true };
    acceptQuest('q_zodiac_twelve', true);
    out.active = !!player.quests.active.q_zodiac_twelve;
    out.rc0 = _lxStarsRollCall().map((s) => [s.id, s.down]);
    const tracker = () => [...document.querySelectorAll('#quest-tracker .qt-obj')].map((e) => ({ t: e.textContent, done: e.classList.contains('done') }));
    renderQuestTracker(); out.tr0 = tracker();
    out.loc0 = _lxQuestLocateLine('q_zodiac_twelve');
    // three fall
    for (const id of ['aries', 'taurus', 'gemini']) game.bestiary['_boss_zodiac_' + id] = 1;
    renderQuestTracker(); out.tr3 = tracker();
    out.loc3 = _lxQuestLocateLine('q_zodiac_twelve');
    out.guide3 = (typeof _questGuidance === 'function') ? (_questGuidance('q_zodiac_twelve', QUESTS.q_zodiac_twelve, player.quests.active.q_zodiac_twelve) || {}).text : null;
    out.prog3 = player.quests.active.q_zodiac_twelve.progress;
    // the Journal
    renderQuestJournal(); const list = document.getElementById('quest-list'); out.j3 = list ? list.textContent.replace(/\s+/g, ' ') : null;
    // all twelve: the quest completes through its own path, the Journal still lists every star as put to rest
    for (const z of ZODIAC_SIGNS) game.bestiary['_boss_zodiac_' + z.id] = 1;
    out.rc12 = _lxStarsRollCall().filter((s) => s.down).length; out.html12 = _lxStarsRollCallHtml();
    // the milestones: 3 and 9 are toasts, 6 is the zodiac_midpoint scene; counted from the stars at rest, once per save
    const rec = { toasts: [] }; const _t = window.showToast; const seen6 = () => !!(player._storyBeatsSeen && player._storyBeatsSeen.zodiac_midpoint);
    window.showToast = (t) => { if (/stars at rest/.test(String(t))) rec.toasts.push(String(t)); };   // the game's own toasts (new quests, ...) are not under test
    for (const z of ZODIAC_SIGNS) delete game.bestiary['_boss_zodiac_' + z.id]; player._storyBeatsSeen = {};
    const fall = async (ids) => { for (const id of ids) game.bestiary['_boss_zodiac_' + id] = 1; _lxStarFell(); await sleep(3600); };
    await fall(['pisces', 'aries']); out.ms2 = rec.toasts.length + (seen6() ? 1 : 0);
    await fall(['leo']); out.ms3 = rec.toasts.slice();
    await fall(['virgo', 'libra']); out.ms5 = rec.toasts.length + (seen6() ? 1 : 0);
    await fall(['cancer']); out.ms6 = seen6(); out.ms6t = rec.toasts.length;
    await fall(['taurus', 'gemini']); await fall(['scorpio']); out.ms9 = rec.toasts.slice();
    _lxStarFell(); await sleep(3600); out.msAgain = rec.toasts.length;
    out.suffix = _lxStarsRestSuffix();
    window.showToast = _t;
    const wc = (t) => String(t || '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    out.mid = STORY_BEATS.zodiac_midpoint ? STORY_BEATS.zodiac_midpoint.stanzas.map((x) => wc(x.text)) : null;
    out.desc = { words: wc(QUESTS.q_zodiac_twelve.desc), t: QUESTS.q_zodiac_twelve.desc };
    return out;
  });
  ok('the quest is active and the helper lists all twelve, none at rest', R.active && R.rc0.length === 12 && R.rc0.every((x) => x[1] === false), R.rc0.length);
  ok('the helper keeps the zodiac order (Aries first, Pisces last)', R.rc0[0][0] === 'aries' && R.rc0[11][0] === 'pisces');
  ok('the tracker shows twelve chips, none ticked', R.tr0.length === 12 && R.tr0.every((c) => !c.done), R.tr0.length);
  ok('the locate line names the count and the next star', /0\/12 at rest/.test(R.loc0) && /next: Ariel/.test(R.loc0), R.loc0);
  ok('after three fall the tracker ticks exactly three', R.tr3.filter((c) => c.done).length === 3 && R.tr3.slice(0, 3).every((c) => c.done && /\u2713/.test(c.t)) && R.tr3.length === 12, R.tr3.map((c) => (c.done ? 'x' : '-')).join(''));
  ok('the locate line follows: 3/12 at rest, next Cancer', /3\/12 at rest/.test(R.loc3) && /next: Cancer/.test(R.loc3), R.loc3);
  ok('the guidance line names the next star', /^9 left/.test(R.guide3 || '') && /next Cancer/.test(R.guide3 || ''), R.guide3);
  ok('the quest counts its beaten stars (3)', R.prog3 === 3, R.prog3);
  ok('the Journal lists "Put to rest \u00b7 3/12" and "Still burning \u00b7 9/12"', /Put to rest \u00b7 3\/12/.test(R.j3 || '') && /Still burning \u00b7 9\/12/.test(R.j3 || ''), (R.j3 || '').slice(0, 200));
  ok('the Journal names a star at rest and a star still burning', /Ariel the Ember Ram/.test(R.j3 || '') && /Pisces the Twin Current \u00b7 Lv 92/.test(R.j3 || ''));   // release24: the level Pisces spawns at (data/monster_stats.js), was levelReq 90
  ok('with all twelve down the list says 12/12 and no "Still burning" row', R.rc12 === 12 && /Put to rest \u00b7 12\/12/.test(R.html12) && !/Still burning/.test(R.html12));
  ok('two stars at rest: no milestone', R.ms2 === 0, R.ms2);
  ok('three at rest: the sky toast, once', R.ms3.length === 1 && /Three stars at rest/.test(R.ms3[0]), R.ms3);
  ok('four and five say nothing', R.ms5 === 1, R.ms5);
  ok('six at rest: the zodiac_midpoint scene (no toast)', R.ms6 === true && R.ms6t === 1, R.ms6);
  ok('nine at rest: the town toast', R.ms9.length === 2 && /Nine stars at rest/.test(R.ms9[1]), R.ms9);
  ok('a repeat call fires nothing again', R.msAgain === 2, R.msAgain);
  ok('the badge toast carries the count', / \u00b7 9\/12 at rest/.test(R.suffix), R.suffix);
  ok('zodiac_midpoint is three short pages', R.mid && R.mid.length === 3 && R.mid.every((n) => n <= 40), R.mid);
  ok('the quest text is within the 120-word cap and keeps the out-want line', R.desc.words <= 120 && /out-want them/.test(R.desc.t) && !/gently/.test(R.desc.t), R.desc.words);
  { const src = (await import('node:fs')).readFileSync(path.join(SERVE_ROOT, FILE), 'utf8'); ok('Joyce keeps three ledgers: the blank page before the end, the third sentence after', src.includes('The ledger lies open to a clean page') && src.includes('"It is here." Three words')); }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
