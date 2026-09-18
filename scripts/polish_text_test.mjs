// POLISH TEXT (v0.30.866, per user "look for other polishes to the game"): toast / HUD wording. One and many ("defeat a
// monster", "1 star", "an Archer", "an 80% ATK shockwave"), no raw ids or engine words in toasts, key hints that name the
// real key (Q is the Quest Journal, K the keybinds), the mobile QUEST / STYLE buttons, zodiac bosses by their short name.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/polish_text_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11175';
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
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _earlyHookLabel === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const src = [...document.scripts].map((x) => x.textContent).join('\n'), html = document.documentElement.outerHTML;
    const riposte = (() => { try { const tbl = POWERUPS; const b = tbl.find((x) => x && x.id === 'riposte'); return b ? [b.fmt(80), b.fmt(100)] : null; } catch (e) { return 'err ' + e.message; } })();
    const gem = (typeof ZODIAC_SIGNS !== 'undefined') ? ZODIAC_SIGNS.find((z) => z.id === 'gemini') : null;
    const qBtn = document.querySelector('.mc-btn[aria-label="Quest journal"]'), sBtn = document.querySelector('.mc-btn[aria-label="Wardrobe / Character Studio"]');
    const help = (document.getElementById('help-modal') || document.body).innerHTML;
    return {
      hook1: _earlyHookLabel({ kills: 1 }), hook5: _earlyHookLabel({ kills: 5 }), riposte,
      zodiac: gem ? (typeof _lxZodiacShort === 'function' ? _lxZodiacShort(gem) : gem.name.split(' ')[0]) : null,
      mobile: { quest: qBtn && qBtn.getAttribute('data-mkey'), style: sBtn && (sBtn.getAttribute('data-mkey') || (sBtn.getAttribute('onclick') || '').slice(0, 40)) },
      helpQ: { fashionistaOnQ: /Go to the Fashionista \(wardrobe\)<\/span><span><kbd>Q<\/kbd>/.test(help), journalRow: /<span>Quest Journal<\/span><span><kbd>Q<\/kbd>/.test(help) },
      gone: ['Auto-respawning (death stuck)', 'canvas is tainted', "'Unknown map: ' + id", "'⚠ Backdrop failed to load: ' + _bgi", '(J key)', 'Quest Journal (J)', '+1 Skill Point</b>', "+ ' mojicoins'", 'weapons and armour', 'Inventory ${_aTab} tab full', 'ticks ${_count} entries', "'SOUL COLLAPSE x'", "kept running (' + msg.slice", 'Press <kbd>Q</kbd> to toggle', 'Character (K / U)', "' hit · +1", '${item.stars} stars!', 'You are a ${c.name}!', 'You are now a ${c.name}', "bonus is ${set.cls}-only", "l: 'Mojidex'"].filter((t) => src.includes(t) || html.includes(t)),
      classToast: /You are \$\{\/\^\[AEIOU\]\/i\.test\(c\.name\) \? 'an' : 'a'\}/.test(src),
    };
  });
  check(r.hook1 === 'defeat a monster' && r.hook5 === 'defeat 5 monsters', 'the Trainee Path says "defeat a monster" for one kill (was: "defeat 1 monsters")', J([r.hook1, r.hook5]));
  check(Array.isArray(r.riposte) && /releases an 80%/.test(r.riposte[0]) && /releases a 100%/.test(r.riposte[1]), 'Riposte Nova reads "an 80%" and "a 100%"', J(r.riposte));
  check(r.zodiac === 'Gem & Mini', 'Gemini\u2019s toasts name "Gem & Mini", not "Gem"', J(r.zodiac));
  check(r.mobile.quest === 'q' && /_wardrobeHotkey/.test(r.mobile.style || ''), 'the mobile QUEST button opens the journal and STYLE goes to the wardrobe (were swapped onto E and Q)', J(r.mobile));
  check(!r.helpQ.fashionistaOnQ && r.helpQ.journalRow, 'the Help panel lists Q as the Quest Journal (was: "Go to the Fashionista")', J(r.helpQ));
  check(r.classToast, 'the class toast picks a / an ("You are an Archer!")', J(r.classToast));
  check(r.gone.length === 0, 'none of the old player-facing wordings is left', J(r.gone));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
