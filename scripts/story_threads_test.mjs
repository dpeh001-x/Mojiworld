// STORY THREADS (v0.30.905, per user "strengthen the storyline"). Threads the story set up and never tied:
//   - seventeen endings: the Codex promised one per master and the finale was the same for all; the credits now carry
//     one line per master (and none for a hero with no master);
//   - the Amnesiac's name comes back in the credits; Shen names the Weight-Bearer (Act I promised he would);
//   - "the Pause" is defined where the town first uses it; Hourglass I no longer states the Petition's argument early;
//   - Arlen's sixty years of three notes, Shen's eleven and nine, Joyce's nine-word ledger are things they now SAY;
//   - the Codex mentions Aetherion and the three tyrants; the Warden's epitaph looks up; the Conductor never learned
//     who wrote the timetable.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/story_threads_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11271';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    // seventeen endings
    const E = (typeof _LX_MASTER_ENDINGS === 'object') ? _LX_MASTER_ENDINGS : {};
    out.endings = { masters: Object.keys(MASTERS).sort().join(','), lines: Object.keys(E).sort().join(','), distinct: new Set(Object.values(E)).size };
    const credits = (master) => { const o = document.getElementById('game-complete-overlay'); if (o) o.remove(); player.master = master; _showGameComplete();
      const ov = document.getElementById('game-complete-overlay'); const t = { mine: ((ov && ov.querySelector('.lx-master-ending')) || {}).textContent || '', all: (ov && ov.textContent) || '' };
      if (ov) ov.remove(); if (typeof game !== 'undefined') game.paused = false; return t; };
    out.cArch = credits('archbishop'); out.cNone = credits(null);
    // what the people now say
    let last = ''; const _rt = window._runDialogTypewriter; window._runDialogTypewriter = function (t) { last = String(t); return _rt.apply(this, arguments); };
    const ask = async (map, who, label) => {
      loadMap(map, 600); await wait(1200); try { closeAllModals(); } catch (e) {}
      const n = (game.npcs || []).find((x) => x.name === who); if (!n) return { err: 'no ' + who + ' on ' + map };
      openNPC(n); await wait(80); const labels = [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent);
      const b = [...document.querySelectorAll('#dialog-options button')].find((x) => x.textContent === label); if (!b) { try { closeDialog(); } catch (e) {} return { labels }; }
      last = ''; b.click(); await wait(200); const text = last || ((document.getElementById('dialog-text') || {}).textContent || ''); try { closeDialog(); } catch (e) {} return { text };
    };
    out.arlen = await ask('town', 'Old Arlen', 'That canary on the top perch?');
    out.joyce = await ask('everdawn_megamall', 'Nurse Joyce', 'The sleepers\' ledger?');
    out.shen = await ask('emeraldVillage', 'Master Shen', 'You teach the ones who arrive?');
    window._runDialogTypewriter = _rt;
    // the quests and the Codex
    const d = (id) => (QUESTS[id] || {}).desc || '';
    out.q = { named: /the Weight-Bearer, Gravitos/.test(d('q_act1_firstword')), pause: /calls that day the Pause/.test(d('q_act1_quiet')),
      hg1: /It only stopped being allowed to/.test(d('q_hourglass_1')), hg5: /It only stopped being allowed to/.test(d('q_hourglass_5')) };
    out.codex = { aetherion: /<b>Aetherion<\/b>, the Shardfather/.test(LORE_WORLD_HTML), tyrants: /three tyrants will pull their nightmares tighter/.test(LORE_WORLD_HTML) };
    out.epitaph = (typeof _bossEpitaph === 'function') ? String(_bossEpitaph('aetherion', { type: 'aetherion' }) || '') : '';
    out.conductor = /who wrote the timetable/.test((BOSS_INTROS.pqConductor || {}).lore || '');
    return out;
  });
  check(r.endings.masters === r.endings.lines && r.endings.distinct === r.endings.lines.split(',').length, 'every master has its own ending line (the Codex promises seventeen endings)', J(r.endings));
  check(/finishes the note/.test(r.cArch.mine) && !r.cNone.mine && /a name that was not from here/.test(r.cArch.all), "the credits carry your master's line (none without a master) and the Amnesiac's name", J([r.cArch.mine, r.cNone.mine]));
  check(/three notes/.test(r.arlen.text || '') && /not one early, not one late/.test(r.arlen.text || ''), 'Old Arlen talks about the canary he has listened to for sixty years', J(r.arlen).slice(0, 160));
  check(/It is still there, it is only being carried/.test(r.joyce.text || ''), "Nurse Joyce reads you the sleepers' ledger", J(r.joyce).slice(0, 160));
  check(/Eleven\. I buried nine/.test(r.shen.text || '') && /Be the third/.test(r.shen.text || ''), 'Master Shen says his eleven and nine aloud', J(r.shen).slice(0, 160));
  check(r.q.named && r.q.pause && !r.q.hg1 && r.q.hg5, 'Act I names the Weight-Bearer and the Pause; the Petition keeps its argument until the Hourglass pays it off', J(r.q));
  check(r.codex.aetherion && r.codex.tyrants && /straight up/.test(r.epitaph) && r.conductor, 'the Codex names the Warden and the tyrants; the Warden looks up; the Conductor never saw who wrote the timetable', J({ ...r.codex, ep: r.epitaph.slice(-30), c: r.conductor }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
