// The prologue in pop punk: stanzas, the memory HUD and Guguma's coach line.
//   node scripts/prologue_pop_test.mjs
//     MOJI_GAME_FILE=<build.html>   test a private build (serve.js swaps it in for the game URL)
//     MOJI_DATA_REF=origin/main     serve data/ tables from a git ref, for when the working copy's are stale
// Per user: "the story stanza text can be way more POP and Punk style to fit the game", "change the font to match the
// pop punk style accordingly", and of the memory banner + Guguma's line: "can be way more pop punk designed".
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = String(process.env.MOJI_PORT || 9173);
const DATA_REF = process.env.MOJI_DATA_REF || '';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const gitShow = (rel) => execFileSync('git', ['show', rel], { cwd: ROOT, maxBuffer: 1 << 26 });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
let browser;
try { browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] }); }
catch (e) { browser = await chromium.launch({ channel: 'msedge', args: ['--mute-audio'] }); }
const errs = [];
try {
  for (const [name, vp] of [['desktop 1280x800', { width: 1280, height: 800 }], ['phone held sideways 844x390', { width: 844, height: 390 }]]) {
    const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    if (DATA_REF) {
      await page.route((u) => /^[/]data[/][^/]+[.](js|json)$/.test(u.pathname), async (r) => {
        const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
        try { r.fulfill({ status: 200, contentType: 'text/javascript', body: gitShow(DATA_REF + ':' + rel) }); } catch (e) { r.continue(); }
      });
    }
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof _prologueOverlay === 'function' && typeof _prologueHud === 'function', null, { timeout: 120000 });
    const S = await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; loadMap('town'); await new Promise((s) => setTimeout(s, 2000));
      await document.fonts.ready;
      window._prologueActive = true;
      _prologueOverlay(['FIRST LINE', 'Second stanza.\n\nWith a break.'], () => {}, { noPovVideo: true });
      await new Promise((s) => setTimeout(s, 1100));
      const t = document.getElementById('plg-text'), cs = getComputedStyle(t), b0 = getComputedStyle(t, '::before');
      const out = { font: cs.fontFamily, weight: Number(cs.fontWeight), stroke: parseFloat(cs.webkitTextStrokeWidth), ws: cs.whiteSpace, upper: cs.textTransform,
        banner0: /linear-gradient/.test(b0.backgroundImage) && /matrix/.test(b0.transform),
        skip: (() => { const b = document.getElementById('plg-skip'); return b ? { cls: b.className, txt: b.textContent, font: getComputedStyle(b).fontFamily } : null; })(),
        hintKeys: document.querySelectorAll('#prologue-cine .plg-hint kbd').length };
      document.getElementById('prologue-cine').click();
      await new Promise((s) => setTimeout(s, 1100));
      out.banner1 = getComputedStyle(document.getElementById('plg-text'), '::before').content !== 'none';
      out.lines1 = Math.round(document.getElementById('plg-text').offsetHeight / parseFloat(getComputedStyle(document.getElementById('plg-text')).lineHeight));
      document.getElementById('prologue-cine').remove();
      window._prologueLeftMs = 26000; window._prologueLastTick = Date.now(); window._prologueGodUntil = Date.now() + 41000;
      _prologueHud(true); _prologueTick(); _prologueCoach(_LX_PROLOGUE_COACH[0][1]);
      await new Promise((s) => setTimeout(s, 400));
      const hud = document.getElementById('prologue-hud'), coach = document.getElementById('prologue-coach'), q = (s) => hud.querySelector(s);
      const hr = hud.getBoundingClientRect(), cr = coach.getBoundingClientRect();
      out.hud = { cls: hud.className, font: getComputedStyle(hud).fontFamily, title: q('.plg-hud-title') && q('.plg-hud-title').textContent,
        clock: q('.plg-hud-clock') && q('.plg-hud-clock').textContent, god: !!q('.plg-hud-god'), will: q('.plg-hud-bar i') && getComputedStyle(q('.plg-hud-bar i')).width,
        barW: q('.plg-hud-bar') && q('.plg-hud-bar').clientWidth, name: q('.plg-hud-name') && q('.plg-hud-name').textContent, keys: hud.querySelectorAll('.plg-hud-keys kbd').length,
        titleStroke: q('.plg-hud-title') && parseFloat(getComputedStyle(q('.plg-hud-title')).webkitTextStrokeWidth) };
      out.coach = { cls: coach.className, txt: coach.textContent, name: !!coach.querySelector('.plg-coach-name'), font: getComputedStyle(coach).fontFamily,
        kbd: coach.querySelector('kbd') ? getComputedStyle(coach.querySelector('kbd')).backgroundColor : null };
      out.gap = Math.round(cr.top - hr.bottom);
      out.inView = hr.top >= 0 && cr.bottom <= innerHeight && hr.left >= 0 && hr.right <= innerWidth;
      _prologueHud(false); window._prologueActive = false;
      return out;
    });
    check(/^"?Nunito/.test(S.font) && S.weight >= 900 && S.stroke >= 4 && S.upper === 'uppercase', `${name}: stanzas in heavy Nunito caps with a thick ink stroke (was monospace)`, S);
    check(S.ws === 'pre-line' && S.lines1 >= 3, `${name}: a stanza keeps its paragraph break`, { ws: S.ws, lines: S.lines1 });
    check(S.banner0 && !S.banner1, `${name}: the first stanza sits on the skewed banner, the rest stand on their own`, { b0: S.banner0, b1: S.banner1 });
    check(S.skip && /plg-skip-pop/.test(S.skip.cls) && /Skip prologue/.test(S.skip.txt) && /^"?Nunito/.test(S.skip.font) && S.hintKeys === 2, `${name}: a pop Skip button and keycap hints`, { skip: S.skip, keys: S.hintKeys });
    const h = S.hud;
    check(/plg-hud/.test(h.cls) && /^"?Nunito/.test(h.font) && h.title === 'MEMORY OF WHAT YOU BECOME' && h.clock === '0:26' && h.god && h.titleStroke >= 3,
      `${name}: the memory panel - inked title, the clock badge, the invulnerable tape`, h);
    check(h.name === 'GRAVITOS, THE WEIGHT-BEARER' && h.keys === 9 && parseFloat(h.will) > 0 && parseFloat(h.will) < h.barW, `${name}: the will bar, the name tape and the nine keycaps`, h);
    const c = S.coach;
    check(/plg-coach/.test(c.cls) && c.name && /Guguma:/.test(c.txt) && /mash/i.test(c.txt) && /^"?Nunito/.test(c.font) && c.kbd === 'rgb(255, 224, 122)',
      `${name}: Guguma speaks from a comic balloon with a name tag and yellow keycaps`, c);
    check(S.gap >= 0 && S.inView, `${name}: the balloon sits below the panel, both on screen`, { gap: S.gap, inView: S.inView });
    await ctx.close();
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} finally {
  await browser.close();
  srv.kill();
}
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
