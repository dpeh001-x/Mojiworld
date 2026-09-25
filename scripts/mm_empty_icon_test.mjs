// The empty MojiMon card's icon: an inked baby buddy, not the hatching-chick emoji.
//   node scripts/mm_empty_icon_test.mjs
//     MOJI_GAME_FILE=<build.html>   test a private build (serve.js swaps it in for the game URL)
//     MOJI_DATA_REF=origin/main     serve data/ tables from a git ref, for when the working copy's are stale
//     MOJI_SHOT_DIR=<dir>           also save a close-up of the card per viewport, to eyeball it
// Per user: "change the left icon of the mojimon to something much cuter with a black outline".
// The black line only reads on the dark card because of the pale sticker rim outside it, so the
// rim is checked as well as the ink.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = String(process.env.MOJI_PORT || 9143);
const DATA_REF = process.env.MOJI_DATA_REF || '';
const SHOTS = process.env.MOJI_SHOT_DIR || '';
const INK = '#140c18';
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
  const boot = async (opts) => {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
      if (existsSync(path.join(ROOT, rel))) return r.continue();
      try { r.fulfill({ status: 200, contentType: 'font/woff2', body: gitShow('origin/main:' + rel) }); } catch (e) { r.continue(); }
    });
    if (DATA_REF) {
      await page.route((u) => /^[/]data[/][^/]+[.](js|json)$/.test(u.pathname), async (r) => {
        const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
        try { r.fulfill({ status: 200, contentType: rel.endsWith('.json') ? 'application/json' : 'text/javascript', body: gitShow(DATA_REF + ':' + rel) }); } catch (e) { r.continue(); }
      });
    }
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderMojiMonPanel === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 120000 });
    await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 95;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
      loadMap('town'); await new Promise((s) => setTimeout(s, 2500));
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      for (const id of ['everdawn-welcome-overlay', 'void-intro-overlay']) { const o = document.getElementById(id); if (o) o.remove(); }
      const mm = _mojimonEnsure(); mm.roster = {}; mm.out = null; mm.cdUntil = 0; mm.assigned = null;
      game._uTab = 'mojimon'; openLevelUpPanel(); const b = document.querySelector('[data-utab="mojimon"]'); if (b) b.click();
      await document.fonts.ready;
    });
    await page.waitForTimeout(600);
    return { ctx, page };
  };
  const measure = (page) => page.evaluate((INK) => {
    const card = document.querySelector('#u-pane-mojimon .mmr-empty');
    if (!card) return null;
    card.scrollIntoView({ block: 'center' });
    const ico = card.querySelector('.mmr-empty-ico'), svg = ico && ico.querySelector('svg.mmr-buddy');
    const r = svg && svg.getBoundingClientRect(), c = card.getBoundingClientRect();
    const filt = svg ? getComputedStyle(svg).filter : '';
    const under = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      title: (card.querySelector('.mmr-et') || {}).textContent,
      icoText: ico ? ico.textContent.trim() : null,
      emoji: ico ? ico.querySelectorAll('.lx-emo, img').length : -1,
      svg: !!svg, cssW: svg ? parseFloat(getComputedStyle(svg).width) : 0, cssH: svg ? parseFloat(getComputedStyle(svg).height) : 0,
      onScreen: !!r && r.width > 0 && r.height > 0,
      inside: !!r && r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5,
      visible: !!under && (under === svg || svg.contains(under) || ico.contains(under)),
      ink: svg ? [...svg.querySelectorAll('[stroke]')].filter((e) => e.getAttribute('stroke').toLowerCase() === INK).length : 0,
      eyes: svg ? [...svg.querySelectorAll('ellipse')].filter((e) => e.getAttribute('fill') === INK).length : 0,
      rim: (filt.match(/drop-shadow/g) || []).length,
      anim: ico ? getComputedStyle(ico).animationName : '',
    };
  }, INK);
  const shot = async (page, name) => {
    if (!SHOTS) return;
    const el = await page.$('#u-pane-mojimon .mmr-empty');
    if (el) await el.screenshot({ path: path.join(SHOTS, name + '.png') });
  };

  for (const [name, opts, motion] of [
    ['desktop 1280x800', { viewport: { width: 1280, height: 800 } }, true],
    ['phone held sideways 844x390', { viewport: { width: 844, height: 390 }, hasTouch: true, reducedMotion: 'reduce' }, false],
  ]) {
    const { ctx, page } = await boot(opts);
    const M = await measure(page);
    check(!!M && M.title === 'No MojiMon bound yet', `${name}: the empty card is up`, M && M.title);
    if (M) {
      check(M.svg && M.emoji === 0 && M.icoText === '', `${name}: the icon is the drawn buddy, no emoji left in it`, M);
      check(M.cssW === 58 && M.cssH === 58, `${name}: drawn at its full 58px`, { w: M.cssW, h: M.cssH });
      check(M.onScreen && M.inside, `${name}: fully inside the card`, M);
      check(M.visible, `${name}: nothing covers it`, M);
      check(M.ink >= 10 && M.eyes === 2, `${name}: black ink outline on every shape, two ink eyes`, { ink: M.ink, eyes: M.eyes });
      check(M.rim >= 4, `${name}: the pale rim that keeps the black line visible on the dark card`, M.rim);
      check(motion ? M.anim === 'mmr-bob' : M.anim === 'none', `${name}: ${motion ? 'bobs like the old icon' : 'holds still under reduced motion'}`, M.anim);
    }
    await shot(page, name.split(' ')[0]);
    await ctx.close();
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} finally {
  await browser.close();
  srv.kill();
}
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
