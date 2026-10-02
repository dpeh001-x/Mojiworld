// Old Arlen explains Everdawn's leafless trees (per user: "have the question why everdawn central does not have trees with natural
// green leaves appear in one of the NPC dialogue"). In the town: his card offers "Why are there no green leaves on the trees?";
// before the ending the answer is the Pause (cherries flower before they leaf; one spring's morning is not long enough for leaves);
// after the ending (_lxStoryComplete) he has seen the first green bud. His other options are still there.
// node scripts/arlen_leaves_test.mjs   (MOJI_GAME_FILE / PORT override)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11993), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await p.waitForTimeout(4000);
  const R = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('warrior'); player._god = true; player._tutorialSeen = true;
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    game.paused = false; loadMap('town'); await sleep(2000);
    const arlen = (game.npcs || []).find((n) => n && n.name === 'Old Arlen');
    const ask = async () => {
      closeAllModals(); openNPC(arlen); await sleep(60);
      const d = document.getElementById('dialog'); try { if (typeof d._twSkip === 'function') d._twSkip(); } catch (e) {}
      const btns = [...document.querySelectorAll('#dialog-options button, #dialog-options .dialog-option')];
      const q = btns.find((b) => /no green leaves on the trees/.test(b.textContent));
      const labels = btns.map((b) => b.textContent.trim());
      if (!q) return { labels, text: null };
      q.click(); await sleep(60); try { if (typeof d._twSkip === 'function') d._twSkip(); } catch (e) {}
      return { labels, text: document.getElementById('dialog-text').textContent };
    };
    const orig = window._lxStoryComplete;   // pin each side of the ending (every beat is marked seen above, which reads as complete)
    window._lxStoryComplete = () => false; const before = await ask();
    window._lxStoryComplete = () => true;
    const after = await ask();
    window._lxStoryComplete = orig; closeAllModals();
    return { found: !!arlen, before, after };
  });
  ok('Old Arlen stands in Everdawn Central', R.found);
  ok('his card offers "Why are there no green leaves on the trees?"', R.before.text !== null, R.before.labels);
  ok('his other questions are still there', ['Opinions about the mushrooms?', 'That canary on the top perch?', 'What do people say about the Amnesiac?'].every((t) => R.before.labels.some((l) => l.includes(t))), R.before.labels);
  ok('before the ending: the Pause - cherries flower before they leaf, and one morning is not long enough', /bloom first and leaf after/.test(R.before.text || '') && /since the Pause/.test(R.before.text || '') && /not long enough for leaves/.test(R.before.text || ''), R.before.text);
  ok('after the ending: he has seen the first green', /There! Green!/.test(R.after.text || '') && /morning has moved on/.test(R.after.text || ''), R.after.text);
  ok('no page errors', errs.length === 0, [...new Set(errs)].slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
