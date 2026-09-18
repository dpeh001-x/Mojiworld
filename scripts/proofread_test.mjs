// PROOFREAD (v0.30.899 launch audit). The player-visible text a proofreading pass found wrong is gone - currency names,
// map / place names, key hints, numbers that drifted from the game (MojiMon strength, bonus SP, endings, Withering Tide's
// level), grammar - and every NPC answer in the busiest hubs renders its *stage directions* without raw asterisks.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/proofread_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11219';
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
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const src = document.documentElement.outerHTML;
    const gone = ['So.. do you need a lift?', 'calls me the taxi uncle', '◈ setshards  (you have', 'The sarcophagi names', 'nobody has heard them since', 'Milo nods. Conductor would',
      '} mojicoins since your last visit', '} mojicoins total', 'mojicoins ${canAfford', 'A mojicoin is a', '</span> setshards</span>', '◈ setshards.`', 'Legosaurus of Blockland', "name:'Block-Land'",
      'Bubble Bloom', 'Painting Everdawn Bazaar', "'Will — The Bastion Throne'", 'Brok in Everdawn Central', 'Why the vermilion banners', 'codex/mojidex', 'or skill tree (K)', 'Close (Q or Esc)',
      'Bestiary in the U panel', '10× your max HP', '0-1 bonus SP', 'binomial(1, 0.5)', 'per VIT point', 'VIT (Vitality)', 'Sixteen endings', 'Sixteen ways they end', '<em>Lv 57.</em>',
      '10,000 Mojicoins short of 10,000 Mojicoins', 'Respec (1,500◈)'].filter((t) => src.includes(t));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    const stars = []; let answers = 0;
    for (const map of ['town', 'everdawn_megamall', 'emeraldVillage', 'bastion']) {
      loadMap(map, 600); await wait(1500); try { closeAllModals(); } catch (e) {}
      for (const n of (game.npcs || [])) {
        let labels = []; try { openNPC(n); await wait(80); labels = [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent); } catch (e) {}
        for (const lb of labels) { if (/^(Leave|Thanks|Goodbye|Back|Rest|Buy|Sell|Shop|Deposit|Withdraw|Accept|Begin|Travel|Ride)/i.test(lb)) continue;
          try { openNPC(n); await wait(40); const b = [...document.querySelectorAll('#dialog-options button')].find((x) => x.textContent === lb); if (!b) continue; b.click(); await wait(60);
            const t = (document.getElementById('dialog-text') || {}).textContent || ''; answers++; if (/\*[A-Za-z]/.test(t)) stars.push(map + ' / ' + n.name + ' / ' + lb + ': ' + t.slice(0, 50)); } catch (e) {} }
        try { closeDialog(); closeAllModals(); } catch (e) {}
      }
    }
    return { gone, stars: stars.slice(0, 5), nStars: stars.length, answers };
  });
  check(r.gone.length === 0, 'none of the proofread errors is left in the page', J(r.gone));
  check(r.answers > 30 && r.nStars === 0, 'NPC answers render their stage directions (no raw *asterisks*)', J({ answers: r.answers, stars: r.stars }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
