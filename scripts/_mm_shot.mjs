// SCRATCH — the MojiMon tab's top cards in the running game: ready with nothing bound, and on cooldown with a mon out.
//   PORT=10530 OUT=<dir> MOJI_GAME_FILE=<build.html> node scripts/_mm_shot.mjs [tag]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10530', OUT = process.env.OUT, TAG = process.argv[2] || 'mm';
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
mkdirSync(OUT, { recursive: true });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  for (const [tag, opts] of [['desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 }], ['phone', { viewport: { width: 842, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]) {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.route((u) => /[/](Sprites[/].*[.]webp|assets[/]fonts[/].*[.]woff2)$/.test(u.pathname), async (r) => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
      if (existsSync(path.join(ROOT, rel))) return r.continue();
      try { r.fulfill({ status: 200, contentType: rel.endsWith('.woff2') ? 'font/woff2' : 'image/webp', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
    });
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderMojiMonPanel === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 120000 });
    await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 95;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
      loadMap('town'); await new Promise((s) => setTimeout(s, 3000));
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      for (const id of ['everdawn-welcome-overlay', 'void-intro-overlay']) { const o = document.getElementById(id); if (o) o.remove(); }
      const mm = _mojimonEnsure(); mm.roster = {}; mm.out = null; mm.cdUntil = 0;
      game._uTab = 'mojimon'; openLevelUpPanel();
      const b = document.querySelector('[data-utab="mojimon"]'); if (b) b.click();
    });
    await page.waitForTimeout(1200);
    const shot = async (name) => {
      const box = await page.evaluate(() => { const h = document.getElementById('u-pane-mojimon'); h.scrollIntoView({ block: 'start' }); const r = h.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 300) }; });
      await page.screenshot({ path: path.join(OUT, `${TAG}_${tag}_${name}.png`), clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.w + 16, height: box.h + 16 } });
      await page.screenshot({ path: path.join(OUT, `${TAG}_${tag}_${name}_full.png`) });
    };
    console.log(tag, 'probe', JSON.stringify(await page.evaluate(async () => { await document.fonts.ready; const i = document.querySelector('.mmc-h i'); return { i: i && i.innerHTML, fred: document.fonts.check('600 14px Fredoka'), nun: document.fonts.check('500 11px Nunito') }; })));
    await shot('ready');
    await page.evaluate(() => {
      const ks = Object.keys(monsterTypes).filter((k) => !monsterTypes[k].boss).slice(0, 2);
      const mm = _mojimonEnsure(); for (const k of ks) mm.roster[k] = { upg: { hp: 2, atk: 1, def: 0 } };
      mm.out = { type: ks[0], hpFrac: 0.7 }; mm.assigned = ks[0]; mm.cdUntil = Date.now() + 83000; renderMojiMonPanel();
    });
    await page.waitForTimeout(600);
    await shot('cooldown');
    console.log(tag, 'errors:', errs.length ? errs.slice(0, 2).join(' | ') : 'none');
    await ctx.close();
  }
} finally { await browser.close().catch(() => {}); srv.kill(); }
