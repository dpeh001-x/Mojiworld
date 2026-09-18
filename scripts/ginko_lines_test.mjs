// GINKO (v0.30.871, per user "Ginko should have his own lines, he is a small boy so generate accordingly"). Ginko in
// Emerald Village wore role 'info' - in MAPS and in the key-5 Stage Editor bake that replaces MAPS npcs at boot - so he
// spoke Old Arlen's whole script. He has his own role now: a boy's intro, four questions of his own, idle lines and a
// nameplate title. Old Arlen keeps his.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/ginko_lines_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11185';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);   // reducedMotion: the dialog prints whole (no typewriter), so a read sees the full line
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0; }, null, { timeout: 180000 }); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 20; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('emeraldVillage', 600); await sleep(2500); game.paused = false; try { closeAllModals(); } catch (e) {}
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const buttons = () => [...document.querySelectorAll('#dialog-options button')];
    const g = (game.npcs || []).find((n) => n && n.name === 'Ginko'); if (!g) return { missing: true };
    openNPC(g); await sleep(400);
    const intro = text(), opts = buttons().map((b) => b.textContent);
    const answers = [];
    for (const label of opts.filter((t) => t !== 'Leave')) { const b = buttons().find((x) => x.textContent === label); if (!b) { answers.push(null); continue; } b.click(); await sleep(250); answers.push(text()); openNPC(g); await sleep(250); }
    const sub = typeof _dialogSubtitleFor === 'function' ? _dialogSubtitleFor(g) : null;
    const barks = typeof NPC_CHAT_LINES !== 'undefined' ? NPC_CHAT_LINES[g.role] : null;
    try { closeAllModals(); } catch (e) {}
    const a = (game.npcs || []).find((n) => n && n.name === 'Old Arlen') || (() => { for (const id in MAPS) { const n = (MAPS[id].npcs || []).find((x) => x && x.name === 'Old Arlen'); if (n) return n; } })();
    let arlen = null; if (a) { openNPC(a); await sleep(300); arlen = text(); try { closeAllModals(); } catch (e) {} }
    return { role: g.role, intro, opts, answers, sub, barks, arlen };
  });
  check(!r.missing, 'Ginko stands in Emerald Village');
  check(r.role === 'ginko', 'Ginko has his own role (was info, from the baked map)', J(r.role));
  check(/I'm Ginko/.test(r.intro || '') && /small boy/.test(r.intro || '') && !/Arlen/.test(r.intro || ''), 'his intro is a small boy, not Old Arlen', J((r.intro || '').slice(0, 80)));
  check(J(r.opts) === J(['Can I see one?', 'Who taught you?', 'Any tips for an adventurer?', 'Anything strange around here?', 'Leave']), 'he has four questions of his own, then Leave', J(r.opts));
  check((r.answers || []).length === 4 && r.answers.every((t) => t && t.length > 80 && !/Arlen|young one/.test(t)) && new Set(r.answers).size === 4, 'each question gets its own answer in his voice', J((r.answers || []).map((t) => (t || '').slice(0, 30))));
  check(r.sub === 'Little Fletcher', 'his nameplate title is "Little Fletcher"', J(r.sub));
  check(Array.isArray(r.barks) && r.barks.length >= 3 && !r.barks.some((t) => /young one|my day/i.test(t)), 'he has his own idle lines', J(r.barks));
  check(/Arlen/.test(r.arlen || ''), 'Old Arlen still speaks his own script', J((r.arlen || '').slice(0, 60)));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
