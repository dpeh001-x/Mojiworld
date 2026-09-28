// No stray ? / ! in NPC dialogue: the typewriter bounces the speaker's portrait on a ? or !, and floats nothing.
//
// Per user: "some of the NPC such as REN and LYRA produces the ? during the dialogue". Since v0.29.427 a ? or ! in a line
// floated a red ? (or !) off the portrait's top-right corner. That corner was placed for the old 64 px disc; a speaker
// with art is a 300 px figure now (v0.30.976), so the mark landed right under the name tag and read as a broken glyph.
// Ren (Shadow-Woven Hood: "...Lock pick?") and Lyra (Azure Academia: "There!" ... "another one?") are opened for real and
// typed out to the end:
//   1. each line reaches a ? (and Lyra's a !), so the reaction really fires;
//   2. no .npc-react-mark is ever added to the dialog;
//   3. the portrait still bounces (.npc-react is added).
// The build before fails 2.   node scripts/dialog_react_mark_test.mjs   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11767), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
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
  await page.evaluate(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 30; }
    player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
    // every mark added to the dialog, and every bounce, as they happen
    window._rm = { marks: [], bounces: 0 };
    const dlg = document.getElementById('dialog');
    new MutationObserver((ms) => { for (const m of ms) {
      if (m.type === 'childList') for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('npc-react-mark')) window._rm.marks.push(n.textContent);
      if (m.type === 'attributes' && m.target.id === 'dialog-portrait' && m.target.classList.contains('npc-react')) window._rm.bounces++;
    } }).observe(dlg, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  for (const [map, who, want] of [['shadowWovenHood', 'Ren', ['?']], ['azureAcademia', 'Lyra', ['?', '!']]]) {
    const r = await page.evaluate(async ({ map, who }) => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      window._rm.marks.length = 0; window._rm.bounces = 0;
      try { closeDialog(); } catch (e) {}
      loadMap(map, 400); await sleep(1500);
      const npc = (game.mapData.npcs || []).find((n) => n.name === who);
      if (!npc) return { err: 'no ' + who + ' on ' + map };
      openNPC(npc);
      const dlg = document.getElementById('dialog'), t0 = performance.now();
      while (performance.now() - t0 < 12000 && dlg.classList.contains('typing')) await sleep(50);   // type it out to the end
      await sleep(1000);   // a mark lived 900 ms
      const text = (document.getElementById('dialog-text') || {}).textContent || '';
      return { text: text.slice(0, 160), figure: dlg.classList.contains('dlg-figure'), marks: window._rm.marks.slice(), bounces: window._rm.bounces,
        typing: dlg.classList.contains('typing') };
    }, { map, who });
    if (r.err) { ok(r.err, false); continue; }
    ok(`${who}: the line reaches ${want.join(' and ')} (the reaction fires)`, want.every((c) => r.text.includes(c)) && !r.typing, { text: r.text, figure: r.figure });
    ok(`${who}: no ? / ! mark floats over the speaker`, r.marks.length === 0, r.marks);
    ok(`${who}: the portrait still bounces`, r.bounces > 0, r.bounces);
    await page.evaluate(() => { try { closeDialog(); } catch (e) {} });
  }
  await ctx.close();
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
