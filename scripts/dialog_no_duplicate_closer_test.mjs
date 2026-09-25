// NO NPC OFFERS TWO BUTTONS THAT ONLY CLOSE THE CARD (v0.30.969).
//
// Per user, with Bravo's card ('Maybe later' beside 'Leave'), Milo's ('Not ready yet') and Old Arlen's
// ('Thanks', gone in v0.30.958): "Many NPCs have options that do the same thing ... ensure that the
// duplicate options are removed across all NPCs". v0.30.957/958 removed the '(leave)' / 'Thanks' /
// 'Close' twins and deliberately kept declines; this build removes those too - fifteen buttons whose
// whole callback was closeDialog (Bravo 5, Milo 6, the sage 2, Fashionista 1).
//   static: every opts.push in openNPC whose callback only closes is the generic Leave or the
//           amnesiac's own (she authors her whole card)
//   live:   Bravo in town (fresh), Milo with Stages 1-3 cleared (the screenshot), the sage before her
//           twelve hours are up, Fashionista - each shows exactly one Leave and none of the old twins
//   live:   Bravo's 'Find out more' page + Leave + reopen lands on her main card (the shared reset now
//           clears game._expInfo, which only the removed 'Maybe later' used to clear)
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/dialog_no_duplicate_closer_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11358';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
// ---- static ----
const lines = readFileSync(PAGE, 'utf8').split('\n');
const start = lines.findIndex((l) => /^function openNPC\(/.test(l)); let end = start;
for (let i = start + 1; i < lines.length; i++) { if (/^}/.test(lines[i])) { end = i; break; } }
const PUSH = /(?:opts|_top|built)\.push\(\{\s*t\s*:\s*(`[^`]*`|'(?:[^'\\]|\\.)*'|"[^"]*")\s*,\s*cb\s*:\s*([\s\S]*)$/;
const closers = [];
for (let i = start; i <= end; i++) {
  const m = lines[i].match(PUSH); if (!m) continue;
  const cb = m[2].replace(/\}\s*\);?\s*(\/\/.*)?$/, '').trim();
  const only = /^closeDialog\s*$/.test(cb) || /^\(\)\s*=>\s*closeDialog\(\)\s*$/.test(cb) || /^\(\)\s*=>\s*\{\s*(game\._\w+\s*=\s*(null|0|false);\s*)*closeDialog\(\);\s*\}?\s*$/.test(cb);
  if (only) closers.push({ line: i + 1, t: m[1] });
}
const legit = closers.filter((c) => c.t === "'Leave'");
check(start > 0 && closers.length === 2 && legit.length === 2, 'static: the only close-only buttons in openNPC are the generic Leave and the amnesiac\'s own', J(closers));
const GONE = ['On it', 'Not yet', 'Stay in town for now', 'Understood', 'Maybe later', "No, I'll stay here", 'Not right now', 'Not ready yet', 'No, maybe later', '(Tip: walk up and press N to see me anytime)'];
const src = lines.slice(start, end + 1).join('\n');
check(GONE.every((t) => !src.includes("t:'" + t.replace(/'/g, "\\'") + "', cb: closeDialog") && !src.includes("t: '" + t + "', cb: closeDialog")), 'static: none of the fifteen old twins is pushed any more', J(GONE.filter((t) => src.includes("'" + t + "'"))));
check(/game\._expInfo = null; game\._expAckNext = null;/.test(lines.slice(lines.findIndex((l) => /^function _lxResetDialogStages/.test(l))).slice(0, 8).join('\n')), 'static: _lxResetDialogStages clears Bravo\'s sub-page state');
// ---- live ----
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const talk = (map, role, prep) => page.evaluate(async ({ map, role, prep }) => {
  try { closeAllModals(); } catch (e) {}
  if (game.currentMap !== map) { loadMap(map, 300); await new Promise((r) => setTimeout(r, 1200)); }
  game.paused = false;
  if (prep) { try { (new Function(prep))(); } catch (e) { return { no: 'prep: ' + e.message }; } }
  const npc = (game.npcs || []).find((n) => n && n.role === role); if (!npc) return { no: 'no ' + role + ' on ' + map };
  openNPC(npc); await new Promise((r) => setTimeout(r, 400));
  const labels = [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
  return { labels, leaves: labels.filter((l) => l === 'Leave').length };
}, { map, role, prep: prep || '' });
const twins = (labels) => labels.filter((l) => GONE.some((g) => l === g || l.endsWith(g)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; player.mojicoins = 100000; game._playMs = 3600000;
  });
  const bravo = await talk('town', 'expedition');
  check(!bravo.no && bravo.leaves === 1 && twins(bravo.labels).length === 0 && bravo.labels.some((l) => /Begin Expedition/.test(l)), 'Bravo (town): one Leave, no "Maybe later", the Begin button present', J(bravo.no ? bravo : bravo.labels));
  const milo = await talk('town', 'usher', "player.quests = player.quests || {}; for (const k of ['completed','active','unlocked']) player.quests[k] = player.quests[k] || {}; for (const id of ['q_clockwork_underpass','q_pq_spire','q_pq_carriage']) { player.quests.completed[id] = { at: Date.now() }; delete player.quests.active[id]; } delete player.quests.completed.q_pq_finale; delete player.quests.active.q_pq_finale; player.quests.unlocked.q_pq_finale = true;");
  check(!milo.no && milo.leaves === 1 && twins(milo.labels).length === 0 && milo.labels.some((l) => /Begin Stage 4/.test(l)), 'Milo (Stages 1-3 cleared, the screenshot): one Leave, no "Not ready yet"', J(milo.no ? milo : milo.labels));
  const sage = await talk('wayfarersLantern2', 'sage', "player._sageNextAt = _monoNow() + 11 * 3600000; game._sageStage = 0;");
  check(!sage.no && sage.leaves === 1 && !sage.labels.some((l) => /meditates|I will return/.test(l)), 'the sage (glimmer not ready): one Leave, the wait is no longer a button', J(sage.no ? sage : sage.labels));
  const fash = await talk('everdawn_megamall', 'wardrobe');
  check(!fash.no && fash.leaves === 1 && !fash.labels.some((l) => /Tip: walk up/.test(l)), 'Fashionista: one Leave, the N-key tip button is gone', J(fash.no ? fash : fash.labels));
  // Bravo's sub-page, left through Leave, must not stick
  const reopen = await page.evaluate(async () => {
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1000)); game.paused = false;
    const npc = (game.npcs || []).find((n) => n && n.role === 'expedition'); if (!npc) return { no: 'no Bravo' };
    openNPC(npc); await new Promise((r) => setTimeout(r, 300));
    const info = [...document.querySelectorAll('#dialog-options button')].find((b) => /Find out more/.test(b.textContent)); if (!info) return { no: 'no Find out more' };
    info.click(); await new Promise((r) => setTimeout(r, 300));
    const onInfo = [...document.querySelectorAll('#dialog-options button')].some((b) => /Back to the portal/.test(b.textContent));
    const leave = [...document.querySelectorAll('#dialog-options button')].find((b) => b.textContent.trim() === 'Leave'); if (!leave) return { no: 'no Leave on the info page', onInfo };
    leave.click(); await new Promise((r) => setTimeout(r, 300));
    const cleared = game._expInfo == null;
    openNPC(npc); await new Promise((r) => setTimeout(r, 300));
    const labels = [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    return { onInfo, cleared, main: labels.some((l) => /Begin Expedition/.test(l)), labels };
  });
  check(!reopen.no && reopen.onInfo && reopen.cleared && reopen.main, 'Bravo: Find out more -> Leave -> reopen lands on her main card (sub-page state cleared by the shared reset)', J(reopen.no ? reopen : { onInfo: reopen.onInfo, cleared: reopen.cleared, main: reopen.main }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
