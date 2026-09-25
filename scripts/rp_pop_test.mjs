// The Skills tab's Rank Points pool, more pop comic (v0.30.x rp-pop).
//   node scripts/rp_pop_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "the number can have more shadow, can have more pop comic feel".
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10695';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const errs = [];
  const run = async (vp) => {
    const ctx = await browser.newContext({ ...vp, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
      if (existsSync(path.join(ROOT, rel))) return r.continue();
      try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
    });
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 120000 });
    const R = await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 99;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
      loadMap('town'); await new Promise((s) => setTimeout(s, 2500));
      const ew = document.getElementById('everdawn-welcome-overlay'); if (ew) ew.remove();
      game._uTab = 'skills'; openLevelUpPanel(); const b = document.querySelector('[data-utab="skills"]'); if (b) b.click();
      await document.fonts.ready; await new Promise((s) => setTimeout(s, 600));
      const card = document.querySelector('.skl-sp-card'), num = document.getElementById('rank-pool');
      if (!card || !num) return null;
      card.scrollIntoView({ block: 'center' }); await new Promise((s) => setTimeout(s, 200));
      const cs = (e, pe) => getComputedStyle(e, pe || null), n = cs(num);
      const cap = card.querySelector(':scope > span:nth-of-type(3)'), rs = document.getElementById('skl-rp-reset');
      const rr = rs.getBoundingClientRect(), hit = document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
      const par = card.parentElement.getBoundingClientRect(), cr = card.getBoundingClientRect();
      return { txt: num.textContent, shadows: (n.textShadow.match(/rgb/g) || []).length, size: parseFloat(n.fontSize), stroke: n.webkitTextStrokeWidth, rot: n.transform,
        burst: [cs(num, '::before').clipPath.slice(0, 8), cs(num, '::after').clipPath.slice(0, 8), cs(num, '::before').backgroundColor, cs(num, '::after').backgroundImage.includes('radial-gradient')],
        cap: cap ? [cap.textContent.trim(), cs(cap).textTransform] : null, resetHit: !!hit && (hit === rs || rs.contains(hit)), fits: cr.right <= par.right + 1 && cr.left >= par.left - 1 };
    });
    await ctx.close();
    return R;
  };
  const D = await run({ viewport: { width: 1280, height: 800 } });
  console.log('desktop', JSON.stringify(D));
  if (!D) check(false, 'the RP bar renders', null);
  else {
    check(/^\d[\d,]*$/.test(D.txt), 'the pool number is still the live count in #rank-pool', D.txt);
    check(D.shadows >= 5 && D.size >= 28 && parseFloat(D.stroke) >= 4, 'more shadow: a 30 px numeral with a thick ink stroke and a five-layer shadow (ink extrusion + class-shade drop)', [D.shadows, D.size, D.stroke]);
    check(D.burst[0] === 'polygon(' && D.burst[1] === 'polygon(' && D.burst[2] === 'rgb(12, 11, 16)' && D.burst[3], 'more pop comic: a starburst in the class colour with a halftone screen, on a black offset burst', D.burst);
    check(D.rot !== 'none', 'the sticker is tilted', D.rot);
    check(D.cap && /to invest/i.test(D.cap[0]) && D.cap[1] === 'uppercase', '"to invest" is a caption in caps', D.cap);
    check(D.resetHit && D.fits, 'Reset RP is not covered by the burst, and the bar fits its column', [D.resetHit, D.fits]);
  }
  const P = await run({ viewport: { width: 842, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  console.log('phone', JSON.stringify(P));
  check(P && P.resetHit && P.fits, 'phone on its side: the bar fits and Reset RP takes its tap', P);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
