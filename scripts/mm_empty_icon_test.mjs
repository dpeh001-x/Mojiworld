// The empty MojiMon card's icon is the game's snail sprite, cropped, black-inked and rimmed.
//   node scripts/mm_empty_icon_test.mjs
//     MOJI_GAME_FILE=<build.html>   test a private build (serve.js swaps it in for the game URL)
//     MOJI_DATA_REF=origin/main     serve data/ tables from a git ref, for when the working copy's are stale
//     MOJI_SHOT_DIR=<dir>           also save a close-up of the card per viewport, to eyeball it
// Per user: "Use the snail sprite as the mojimon" (after "something much cuter with a black outline").
// The card points at the LIVE sprite with a hand-set crop window, so the crop is re-measured here
// against the real image: a redraw that no longer fits the window fails instead of clipping.
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
  const measure = (page) => page.evaluate(async () => {
    const card = document.querySelector('#u-pane-mojimon .mmr-empty');
    if (!card) return null;
    card.scrollIntoView({ block: 'center' });
    const ico = card.querySelector('.mmr-empty-ico'), el = ico && ico.querySelector('i.mmr-snail');
    const out = {
      title: (card.querySelector('.mmr-et') || {}).textContent,
      icoText: ico ? ico.textContent.trim() : null,
      extras: ico ? ico.querySelectorAll('.lx-emo, img, svg').length : -1,
      snail: !!el,
    };
    if (!el) return out;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
    const url = (cs.backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1] || '';
    out.url = url.replace(location.origin + '/', '');
    out.cssW = parseFloat(cs.width); out.cssH = parseFloat(cs.height);
    out.inside = r.width > 0 && r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5;
    const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.visible = !!under && (under === el || ico.contains(under));
    out.ink = (cs.filter.match(/rgb\(20, 12, 24\)/g) || []).length;
    out.rim = (cs.filter.match(/rgb\(251, 234, 255\)/g) || []).length;
    out.anim = getComputedStyle(ico).animationName;
    // Load the very image the card uses, then map the CSS crop back onto its pixels.
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch (e) {}
    out.loaded = img.naturalWidth > 0;
    if (!out.loaded) return out;
    const k = parseFloat(cs.backgroundSize) / img.naturalWidth;
    const [px, py] = cs.backgroundPosition.split(' ').map(parseFloat);
    const win = { x: -px / k, y: -py / k, w: out.cssW / k, h: out.cssH / k };
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let t = -1, b = -1, lft = cv.width, rt = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 64) { if (t < 0) t = y; b = y; if (x < lft) lft = x; if (x > rt) rt = x; }
    out.margins = { left: lft - win.x, top: t - win.y, right: win.x + win.w - (rt + 1), bottom: win.y + win.h - (b + 1) };
    return out;
  });
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
      check(M.snail && M.extras === 0 && M.icoText === '', `${name}: the icon is the snail, no emoji or old buddy left`, M);
      check(M.url === 'Sprites/monsters/snail.webp', `${name}: it is the game's own snail sprite`, M.url);
      check(M.loaded === true, `${name}: that image really loads`, M.loaded);
      check(M.cssW === 70 && M.cssH === 49, `${name}: drawn at 70x49`, { w: M.cssW, h: M.cssH });
      const mg = M.margins || {}, vals = Object.values(mg);
      check(vals.length === 4 && vals.every((v) => v >= 0 && v <= 24), `${name}: the crop holds the whole snail with a thin margin (canvas px)`, mg);
      check(M.inside, `${name}: fully inside the card`, M);
      check(M.visible, `${name}: nothing covers it`, M);
      check(M.ink >= 4 && M.rim >= 4, `${name}: black ink ring plus the pale rim that keeps it visible on the dark card`, { ink: M.ink, rim: M.rim });
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
