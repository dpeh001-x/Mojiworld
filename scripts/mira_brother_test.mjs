// Sage Mira is the Amnesiac's sister: two of the fallen, sent together twelve ages ago.
//
// Per user: "improve on the storyline and lore, sage Mira is actually the amnesiac's brother, another one of those fallen"
// (read as his sister - Mira is "the woman at the gate"). At the gate he answered for the Hourglass and walked back down
// without his name; she never answered and kept hers, and has never told him. One page, a fresh warrior, real buttons:
//   1. Mira's "Who are you?": she was sent, her brother answered for all of them; "Your brother?" names where he stands,
//      "Should I tell him?" asks you to let him say her name first;
//   2. the Amnesiac: "The woman at the gate?" appears in his talk menu once she has named herself, and he does not know her;
//      his own page keeps a half-memory ("someone always one step behind me");
//   3. the Warden's fall gives him "most" of his name and the rest is his sister; the ending has him say hers first;
//   4. the Codex and both idle-bubble sets carry it; every new page stays within 60 words.
// The build before fails 1-4.   node scripts/mira_brother_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11773), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 60; }
    player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    // the Amnesiac BEFORE Mira has named herself: no gate question yet
    loadMap('town', 400); await sleep(1500);
    const am = () => game.mapData.npcs.find((n) => n.role === 'amnesiac');
    openNPC(am()); await sleep(250); await click(/Talk/); await settle();
    out.amBefore = opts();
    try { closeDialog(); } catch (e) {}
    // Mira at The Gate
    loadMap('wayfarersLantern2', 400); await sleep(1500);
    openNPC(game.mapData.npcs.find((n) => n.role === 'sage')); await sleep(300);
    await click(/Who are you\?/); await settle();
    out.p1 = { text: text(), opts: opts() };
    await click(/Your brother\?/); await settle();
    out.p3 = { text: text(), opts: opts() };
    await click(/Should I tell him\?/); await settle();
    out.p4 = { text: text(), opts: opts() };
    try { closeDialog(); } catch (e) {}
    // the Amnesiac AFTER: the question is there, and he does not know her
    loadMap('town', 400); await sleep(1500);
    openNPC(am()); await sleep(250); await click(/Talk/); await settle();
    out.amAfter = opts();
    await click(/The woman at the gate\?/); await settle();
    out.am4 = { text: text(), opts: opts() };
    await click(/Back/); await settle();
    out.backTo = opts();
    await click(/Who are you\?/); await settle();
    out.am1 = text();
    try { closeDialog(); } catch (e) {}
    // the beats, the Codex, the bubbles
    const st = Object.values(STORY_BEATS).flatMap((b) => b.stanzas || []);
    out.warden = (st.find((x) => /The Warden fell\. I felt my name come back/.test(x.text || '')) || {}).text || '';
    out.ending = (st.find((x) => /The Amnesiac remembers his name/.test(x.text || '')) || {}).text || '';
    const html = document.body.innerHTML;
    out.codex = { gait: html.includes('she walked it herself, beside her brother'), lantern: html.includes('who kept her name when her brother lost his'), oldGone: !html.includes('before she lost her name') };
    out.bubbles = { sage: NPC_CHAT_LINES.sage || [], amnesiac: NPC_CHAT_LINES.amnesiac || [] };
    return out;
  });
  ok('1. Mira: she was sent with her brother, and he answered for the Hourglass', /^Mira\. I picked it the day I was sent/.test(R.p1.text) && /My brother answered for all of us/.test(R.p1.text) && /without his name/.test(R.p1.text) && !/None of us could/.test(R.p1.text) && R.p1.opts.includes('Your brother?'), { text: R.p1.text.slice(0, 160), opts: R.p1.opts });
  ok('1. "Your brother?": he is the man in the cathedral plaza, and he does not know her', /cathedral plaza/.test(R.p3.text) && /He does not know me\. I have never told him/.test(R.p3.text) && R.p3.opts.includes('Should I tell him?'), { text: R.p3.text.slice(0, 160), opts: R.p3.opts });
  ok('1. "Should I tell him?": no - let him say her name first', /say mine first/.test(R.p4.text) && R.p4.opts.includes('Waiting for what?'), R.p4.text.slice(0, 120));
  ok('2. the Amnesiac asks about "the woman at the gate" only once she has named herself', !R.amBefore.includes('The woman at the gate?') && R.amAfter.includes('The woman at the gate?'), { before: R.amBefore, after: R.amAfter });
  ok('2. he does not know her - a sister he almost dreams of', /I don't know her/.test(R.am4.text) && /I had a sister/.test(R.am4.text) && R.backTo.includes('The woman at the gate?'), { text: R.am4.text.slice(0, 160), back: R.backTo });
  ok('2. his own page keeps a half-memory of her', /someone always one step behind me/.test(R.am1), R.am1.slice(0, 110));
  ok('3. the Warden gives him most of his name; the rest is his sister', /The rest is a woman on the last step\. My sister\./.test(R.warden), R.warden.slice(60, 220));
  ok('3. the ending: he says her name first', /Her brother says it first\./.test(R.ending) && /put back in the box/.test(R.ending), R.ending.slice(-220));
  ok('4. the Codex carries it (her gait, her kept name)', R.codex.gait && R.codex.lantern && R.codex.oldGone, R.codex);
  ok('4. the idle bubbles carry it, six words at most', R.bubbles.sage.includes('He still turns that ring') && R.bubbles.amnesiac.includes('Did I have a sister?') && [...R.bubbles.sage, ...R.bubbles.amnesiac].every((l) => words(l) <= 6), R.bubbles);
  const longest = Math.max(...[R.p3.text, R.p4.text, R.am4.text].map(words));
  ok('4. every new page stays within 60 words', longest <= 60, longest);
  await ctx.close();
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
