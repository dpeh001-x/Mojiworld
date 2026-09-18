// PRESENTATION PASS (v0.30.872, per user). The title-screen copyright sits above the key art (it was static content
// painted under .lo-bg, so a tenth of it showed); Esc skips a whole story scene and answers a skipped choice with its
// default, while Enter still turns one page; a toast raised during a scene waits for it; toasts step aside from an open
// panel (into its gutter, compact when the gutter is narrow) instead of printing over it; HUD labels a step bigger.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/presentation_pass_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11187';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0; }, null, { timeout: 180000 }); await page.waitForTimeout(1500);
  const copy = await page.evaluate(() => { const c = document.querySelector('.lo-copy'), bg = document.querySelector('#loading-overlay .lo-bg, #lo-bg'); const cs = getComputedStyle(c);
    return { pos: cs.position, z: cs.zIndex, bgZ: bg ? getComputedStyle(bg).zIndex : null, alpha: +((cs.color.match(/[\d.]+\)$/) || ['1'])[0].replace(')', '')) }; });
  check(copy.pos !== 'static' && copy.bgZ !== null && +copy.z > +copy.bgZ && copy.alpha >= 0.7, 'the copyright line sits above the key art, at a readable alpha', J(copy));
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.job = 'berserker'; player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(2500); game.paused = false; try { closeAllModals(); } catch (e) {} if (typeof updateUI === 'function') updateUI(); await sleep(300);
    const sb = () => document.getElementById('story-beat-overlay'), on = () => sb().classList.contains('on');
    const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    const three = () => ({ stanzas: [{ text: 'page one' }, { text: 'page two' }, { text: 'page three' }] });
    // Enter turns one page
    _playStoryBeat(three(), () => {}); await sleep(700); key('Enter'); await sleep(500);
    out.enter = { open: on(), text: document.getElementById('story-beat-text').textContent };
    // Esc ends the scene; a toast raised meanwhile waits
    let closed = false; for (const t of document.querySelectorAll('.toast')) t.remove();
    showToast('HELD-DURING-SCENE', 'rare'); await sleep(200);
    out.held = { shown: [...document.querySelectorAll('.toast')].some((t) => t.textContent === 'HELD-DURING-SCENE'), vis: getComputedStyle(document.getElementById('toast-container')).visibility };
    key('Escape'); await sleep(600); out.esc = { open: on() }; closed = true;
    await sleep(900); out.held.after = [...document.querySelectorAll('.toast')].some((t) => t.textContent === 'HELD-DURING-SCENE');
    out.hint = document.getElementById('story-beat-hint').textContent;
    // Esc past a choice answers it with its default
    if (player._storyChoices) delete player._storyChoices._lxEscProbe;
    let ran = false; _playStoryBeat({ stanzas: [{ text: 'before' }, { text: 'pick one', choice: { flag: '_lxEscProbe', seconds: 0, default: 'quiet', options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] } }] }, () => { ran = true; });
    await sleep(600); key('Escape'); await sleep(600);
    out.choice = { open: on(), flag: (player._storyChoices || {})._lxEscProbe, onClose: ran };
    await sleep(900);
    // toasts beside open panels
    const inter = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    for (const [name, open, sel] of [['settings', () => openSettingsModal(), '#settings-modal'], ['journal', () => toggleQuestJournal(), null]]) {
      try { closeAllModals(); } catch (e) {} for (const t of document.querySelectorAll('.toast')) t.remove(); await sleep(200);
      open(); await sleep(400); showToast('📜 3 new quests — Rotter Patrol, Whispers, Counted and 1 more · Q', 'epic'); showToast('Sold 3 items for 108 Mojicoins', 'rare'); await sleep(700);
      let panel = sel ? document.querySelector(sel) : null;
      if (!panel) { for (const ov of document.querySelectorAll('.modal-overlay')) { if (getComputedStyle(ov).display !== 'none' && ov.getBoundingClientRect().width > 200) { panel = ov.querySelector(':scope > .modal') || ov.firstElementChild; break; } } }
      const pr = panel && panel.getBoundingClientRect();
      const toasts = [...document.querySelectorAll('.toast')].filter((t) => getComputedStyle(t).display !== 'none').map((t) => t.getBoundingClientRect());
      out[name] = { cls: document.getElementById('toast-container').className, n: toasts.length, overlap: pr ? toasts.filter((t) => inter(t, pr)).length : 'no panel' };
    }
    try { closeAllModals(); } catch (e) {}
    const f = (s) => { const el = document.querySelector(s); return el ? parseFloat(getComputedStyle(el).fontSize) : null; };
    out.hud = { level: f('.lx-idp-lv #level'), cls: f('.lx-idp-class'), hp: f('#hp-text'), key: f('.skill-key') };
    return out;
  });
  check(r.enter.open && /page two/.test(r.enter.text), 'Enter turns one page of a story scene', J(r.enter));
  check(!r.esc.open, 'Esc ends the whole story scene', J(r.esc));
  check(/Esc to skip/.test(r.hint), 'the scene hint says Esc skips', J(r.hint));
  check(!r.choice.open && r.choice.flag === 'quiet' && r.choice.onClose, 'Esc past a choice answers it with its default and runs the scene close', J(r.choice));
  check(!r.held.shown && r.held.vis === 'hidden' && r.held.after, 'a toast raised during a scene waits and shows after it', J(r.held));
  check(/lx-dodge/.test(r.settings.cls) && r.settings.n > 0 && r.settings.overlap === 0, 'toasts sit beside the Settings panel, not on it', J(r.settings));
  check(/lx-dodge/.test(r.journal.cls) && r.journal.n > 0 && r.journal.overlap === 0, 'toasts sit beside the Quest Journal, not on it', J(r.journal));
  check(r.hud.level >= 11 && r.hud.cls >= 9.5 && r.hud.hp >= 11 && r.hud.key >= 9.5, 'HUD labels are a step bigger (level 11, class 9.5, HP 11, skill keys 9.5)', J(r.hud));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
