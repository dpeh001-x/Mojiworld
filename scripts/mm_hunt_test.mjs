// The MojiMon tab's Hunt progress in the cute style (v0.30.x mm-hunt).
//   node scripts/mm_hunt_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "do the same cute style for the hunt progress".
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10560';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const errs = [];
  const boot = async (opts) => {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
      if (existsSync(path.join(ROOT, rel))) return r.continue();
      try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
    });
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderMojiMonPanel === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 120000 });
    await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 95;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
      loadMap('town'); await new Promise((s) => setTimeout(s, 2500));
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      for (const id of ['everdawn-welcome-overlay', 'void-intro-overlay']) { const o = document.getElementById(id); if (o) o.remove(); }
      const mm = _mojimonEnsure(); mm.roster = {}; mm.out = null; mm.cdUntil = 0; mm.assigned = null; game.bestiary = {};
      game._uTab = 'mojimon'; openLevelUpPanel(); const b = document.querySelector('[data-utab="mojimon"]'); if (b) b.click();
      await document.fonts.ready;
    });
    await page.waitForTimeout(500);
    return { ctx, page };
  };
  const { ctx, page } = await boot({ viewport: { width: 1280, height: 800 } });
  const none = await page.evaluate(() => !!document.querySelector('#u-pane-mojimon .mmh-card'));
  check(!none, 'no kills yet: no hunt card, as before', none);
  // ten species hunted (one of them bound, so it must not be listed), the top one past the bar
  const H = await page.evaluate(() => {
    const ks = Object.keys(monsterTypes).filter((k) => !monsterTypes[k].boss).slice(0, 10), mm = _mojimonEnsure();
    const kills = [12000, 10000, 7240, 4310, 2150, 860, 125, 12, 5, 3];
    ks.forEach((k, i) => { game.bestiary[k] = kills[i]; });
    mm.roster[ks[2]] = { upg: { hp: 0, atk: 0, def: 0 } };                      // bound: drops off the hunt list
    game.bestiary._meta = 99;                                                      // underscore keys are not species
    renderMojiMonPanel();
    const rows = [...document.querySelectorAll('#u-pane-mojimon .mmh-row')];
    return { ks, req: MOJIMON_KILLS_REQ, bound: ks[2],
      rows: rows.map((r) => ({ k: r.dataset.mon, ready: r.classList.contains('ready'), name: r.querySelector('.mmh-name').textContent, wantName: monsterTypes[r.dataset.mon].name || r.dataset.mon, kills: game.bestiary[r.dataset.mon], w: parseFloat(r.querySelector('.mmh-bar i').style.width),
        count: r.querySelector('.mmh-count').textContent, img: !!r.querySelector('.mmh-bub img') })),
      names: ks.map((k) => monsterTypes[k].name || k), go: (document.querySelector('#u-pane-mojimon .mmh-go') || {}).textContent || null,
      req2: (document.querySelector('#u-pane-mojimon .mmh-req') || {}).textContent, title: (document.querySelector('#u-pane-mojimon .mmh-ht') || {}).textContent };
  });
  console.log('hunt', JSON.stringify(H));
  const order = H.rows.map((r) => r.k), want = H.ks.filter((k) => k !== H.bound).slice(0, 8);
  check(H.rows.length === 8 && JSON.stringify(order) === JSON.stringify(want), 'the top 8 unbound species by kills, most first; a bound one and underscore keys are left out', { order, want });
  check(/hunt progress/i.test(H.title) && H.req2 === H.req.toLocaleString() + ' kills to bind', 'a HUNT PROGRESS title and a "10,000 kills to bind" chip', [H.title, H.req2]);
  const r0 = H.rows[0], r1 = H.rows[1], r2 = H.rows[2];
  check(r0.ready && r1.ready && r0.w === 100 && r0.count.includes('Ready to bind') && r1.count.includes('Ready to bind'), 'a species past the bar is mint, its bar full, its pill says Ready to bind', [r0, r1]);
  check(!r2.ready && Math.abs(r2.w - r2.kills / H.req * 100) < 0.051 && r2.count === r2.kills.toLocaleString() + ' / ' + H.req.toLocaleString() && H.rows.slice(2).every((r) => !r.ready && Math.abs(r.w - r.kills / H.req * 100) < 0.051), 'the rest fill to their real share with their real count', r2);
  check(H.rows.every((r) => r.img) && H.rows.every((r) => r.name === r.wantName), 'every row has its sprite in a bubble and its name', H.rows.map((r) => r.name));
  check(H.go && H.go.includes('Eligible species found'), 'with one eligible, the mint note says to go and bind it', H.go);
  const noGo = await page.evaluate(() => { for (const k in game.bestiary) if (game.bestiary[k] >= MOJIMON_KILLS_REQ) game.bestiary[k] = 9999; renderMojiMonPanel();
    return { go: !!document.querySelector('#u-pane-mojimon .mmh-go'), ready: document.querySelectorAll('#u-pane-mojimon .mmh-row.ready').length }; });
  check(!noGo.go && noGo.ready === 0, 'nobody eligible: no mint rows and no note', noGo);
  const layout = async (pg) => pg.evaluate(async () => {
    renderMojiMonPanel(); await new Promise((r) => setTimeout(r, 300));
    const card = document.querySelector('#u-pane-mojimon .mmh-card'), pane = document.getElementById('u-pane-mojimon').getBoundingClientRect(), c = card.getBoundingClientRect();
    const over = [...card.querySelectorAll('.mmh-row, .mmh-h, .mmh-count, .mmh-go')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className);
    const bars = [...card.querySelectorAll('.mmh-bar')].map((b) => Math.round(b.getBoundingClientRect().width));
    return { inside: c.left >= pane.left - 1 && c.right <= pane.right + 1, over, minBar: Math.min(...bars) };
  });
  const L1 = await layout(page);
  console.log('desktop', JSON.stringify(L1));
  check(L1.inside && L1.over.length === 0 && L1.minBar >= 80, 'desktop: inside the pane, nothing spills, every bar has room', L1);
  await ctx.close();
  const ph = await boot({ viewport: { width: 842, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ph.page.evaluate(() => { const ks = Object.keys(monsterTypes).filter((k) => !monsterTypes[k].boss).slice(0, 8); ks.forEach((k, i) => { game.bestiary[k] = 11000 - i * 1400; }); });
  const L2 = await layout(ph.page);
  console.log('phone', JSON.stringify(L2));
  check(L2.inside && L2.over.length === 0 && L2.minBar >= 50, 'phone on its side: inside the pane, nothing spills, the bars still have room', L2);
  await ph.ctx.close();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
