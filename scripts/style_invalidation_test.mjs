// FIGHT LAG, whole-document restyles (v0.30.1219). Per user: "work on reducing the lag especially when fighting monsters
// ... or fighting bosses". A throttled fight profile spent ~2 of every 8 s restyling: HUD changes (cooldown pies, buff
// timers, toasts) re-checked :has() rules and restyled all ~2,200 elements. Bisected by deleting :has() rules mid-fight
// through the CSSOM: the tour card's hover-to-restore (:has on the nav row's :hover) - still on v0.30.1218, 31 whole-page
// restyles in 4 s - and the Ascend pill's hide rule (:has on inline style; moved to body.lx-panel-up by v0.30.1217).
//   - STATIC: no :has() in the file asks about :hover or the style attribute, and none is anchored on body / html
//     (v0.30.1224: Chrome merges every :has() invalidation into one set per anchor; with body an anchor, an .on class or a
//     toast anywhere scheduled it on BODY and its tag names matched every div and img - ~40 page walks a second)
//   - TRACE: 4 s of live play with casts: no "invalidates subtree" on BODY, and no :has() invalidation scheduled on BODY
//   - TOASTS: the boss intro and a story beat still hide the toasts (and the old intro banner) while they are up
//   - WRITE: one inline style write + restyle costs about the same with every :has() rule deleted (no hidden rule)
//   - HOVER: the tour card's restore still works - pointerover on the nav row sets tut-peek, leaving clears it
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=12393] node scripts/style_invalidation_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12393';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
{ const src = readFileSync(PAGE, 'utf8'); const css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
  const bad = [...css.matchAll(/:has\(([^){}]*)\)/g)].map((m) => m[0]).filter((x) => /:hover|\[style/.test(x));
  check(bad.length === 0, 'STATIC: no :has() asks about :hover or the style attribute (either makes a HUD write restyle the page)', J(bad.slice(0, 3)));
  const anch = [...css.matchAll(/(^|[\s,>+~(])((body|html|:root)((\.|#)[\w-]+|\[[^\]]*\])*:has\([^)]*\))/g)].map((m) => m[2]);
  check(anch.length === 0, 'STATIC: no :has() is anchored on body / html (its merged invalidation walks the whole page)', J(anch.slice(0, 3))); }
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => { const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 30; player.job = 'berserker'; loadMap('mushroom', 600); await W8(2000); try { closeAllModals(); } catch (e) {} game.paused = false;
    player._god = true; player.mp = player.maxMp = 9999;
    window.__castT = setInterval(() => { try { player.mp = 9999; for (const id of ['slash', 'powerStrike', 'groundSlam', 'rush', 'warCry', 'bloodlust']) if (SKILLS[id] && !((player.skillCooldowns || {})[id] > 0)) castSkill(id); } catch (e) {} }, 150); });
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page); const events = []; cdp.on('Tracing.dataCollected', (e) => { for (const ev of e.value) events.push(ev); });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking', transferMode: 'ReportEvents' });
  await page.waitForTimeout(4000);
  await cdp.send('Tracing.end'); await new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  let subtreeBody = 0, invals = 0, recalc = 0, bodyHas = 0, tagWalk = 0;
  for (const e of events) { const d = (e.args && e.args.data) || {};
    if (e.name === 'StyleInvalidatorInvalidationTracking') { invals++; if (/invalidates subtree/.test(d.reason || '') && /^BODY\b/.test(d.nodeName || '')) subtreeBody++; if (/matched tagName/.test(d.reason || '')) tagWalk++; }
    if (e.name === 'ScheduleStyleInvalidationTracking' && /^BODY\b/.test(d.nodeName || '') && d.changedPseudo === 'has') bodyHas++;
    if (e.name === 'UpdateLayoutTree' && e.dur) recalc += e.dur / 1000; }
  check(invals > 20, 'TRACE: the harness saw live HUD invalidations to judge (casts ran)', 'invalidations ' + invals);
  check(subtreeBody === 0, 'TRACE: 4 s of live play with casts - no whole-document ("invalidates subtree" on BODY) restyles', 'subtree BODY ' + subtreeBody + ', restyle ms ' + recalc.toFixed(1));
  check(bodyHas === 0, 'TRACE: no :has() invalidation scheduled on BODY (each walked every div and img in the page)', 'on BODY ' + bodyHas + ', tag-name matches ' + tagWalk);
  const w = await page.evaluate(async () => { clearInterval(window.__castT); game.paused = true; await new Promise((r) => setTimeout(r, 200));
    const cd = document.querySelector('#skill-bar .skill-cd') || document.querySelector('.skill-cd');
    const T = (n) => { let t = 0; for (let i = 0; i < n; i++) { cd.style.setProperty('--cd-pct', String(i % 100)); const t0 = performance.now(); void getComputedStyle(cd).opacity; void document.body.offsetWidth; t += performance.now() - t0; } return t / n; };
    T(20); const withRules = T(200);
    for (const sh of document.styleSheets) { let list; try { list = sh.cssRules; } catch (e) { continue; } const walk = (L, P) => { for (let i = L.length - 1; i >= 0; i--) { const x = L[i]; if (x.cssRules && !x.selectorText) walk(x.cssRules, x); else if (x.selectorText && x.selectorText.includes(':has(')) P.deleteRule(i); } }; walk(list, sh); }
    T(20); const without = T(200);
    // HOVER - the tour card's restore through its class
    const m = document.getElementById('tutorial-modal'); let row = document.getElementById('tut-nav-row'), made = false;
    if (m && !row) { row = document.createElement('div'); row.id = 'tut-nav-row'; (m.querySelector('.modal') || m).appendChild(row); made = true; }
    const ev = (t, type, rel) => t.dispatchEvent(new PointerEvent(type, { bubbles: true, relatedTarget: rel || null }));
    let peekOn = null, peekOff = null;
    if (row) { ev(row, 'pointerover'); peekOn = m.classList.contains('tut-peek'); ev(document.body, 'pointerover'); peekOff = m.classList.contains('tut-peek'); }
    if (made) row.remove(); game.paused = false;
    return { withRules: +withRules.toFixed(4), without: +without.toFixed(4), peekOn, peekOff };
  });
  check(w.withRules <= Math.max(0.05, w.without * 3), 'WRITE: an inline style write restyles about as cheaply as with every :has() deleted', J(w));
  check(w.peekOn === true && w.peekOff === false, 'HOVER: pointer over the tour card\'s nav row sets tut-peek (full-strength card), leaving clears it', J({ on: w.peekOn, off: w.peekOff }));
  const tv = await page.reload({ waitUntil: 'domcontentloaded' }).then(() => page.waitForFunction(() => typeof loadMap === 'function', null, { timeout: 180000 })).then(() => page.evaluate(() => {
    const v = (id) => getComputedStyle(document.getElementById(id)).visibility; const out = {};
    for (const ov of ['boss-intro-overlay', 'story-beat-overlay']) { const o = document.getElementById(ov); const had = o.classList.contains('on');
      o.classList.add('on'); out[ov + ' on'] = v('toast-container') + (ov === 'boss-intro-overlay' ? '/' + v('boss-intro') : '');
      o.classList.remove('on'); out[ov + ' off'] = v('toast-container'); if (had) o.classList.add('on'); }
    return out; }));
  check(tv['boss-intro-overlay on'] === 'hidden/hidden' && tv['story-beat-overlay on'] === 'hidden' && tv['boss-intro-overlay off'] === 'visible' && tv['story-beat-overlay off'] === 'visible',
    'TOASTS: the boss intro hides the toasts and the old banner, a story beat hides the toasts, both come back after', J(tv));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
