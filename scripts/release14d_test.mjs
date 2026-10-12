// RELEASE 14d (bug hunt round 14, part D) stays fixed - every click below is a REAL mouse click at the element's centre:
//   [1] a double-click (two clicks 150-350 ms apart) does not pass "click again to confirm": the job advancement, the Master
//       advancement, the Reforge, Save Backups' Delete snapshot and the game's confirm dialog stay armed / open and commit
//       nothing; a deliberate second click afterwards still commits
//   [2] a double-click on a gear rack Buy (two clicks 250 ms apart, or one dblclick) buys ONE piece; a later click buys again
//   [3] the canvas budget is met after a fast hop sequence settles in town - within 10 s, and it stays met - on desktop (160M
//       px, 100 hops) and on an iPhone UA (40M px, 40 hops); town and then the forest still draw: no budget-tracked canvas or
//       image drawn on the game canvas is blank, and the backdrop, the hero and (forest) a mob drew
//   node release14d_test.mjs        PORT / SERVE_ROOT (the repo to serve) override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15045), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
async function boot(opt) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opt });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true, has: () => true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.level = 60; player._god = true; player.maxHp = player.hp = 9e6;
    try { closeAllModals(); } catch (e) {}
    loadMap('forest', 300); game.paused = false; await new Promise((r) => setTimeout(r, 1500));
  });
  return { ctx, page };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the centre of the first element matching sel (optionally its top band), and whether it is the topmost thing there
const spot = (page, sel, top) => page.evaluate(([sel, top]) => {
  const el = document.querySelector(sel); if (!el) return null; try { el.scrollIntoView({ block: 'center' }); } catch (e) {} const r = el.getBoundingClientRect();
  const x = r.x + r.width / 2, y = top ? r.y + Math.min(40, r.height / 2) : r.y + r.height / 2; const h = document.elementFromPoint(x, y);
  return { x, y, hit: !!(h && (h === el || el.contains(h))), top: h ? String(h.id || h.className || h.tagName).slice(0, 40) : null };
}, [sel, top]);
const shut = (page) => page.evaluate(() => { try { closeAllModals(); } catch (e) {} for (const id of ['advancement-modal', 'reforge-modal', 'shop-modal']) { const m = document.getElementById(id); if (m) m.style.display = 'none'; } });
const dbl = async (page, p, gap) => { await page.mouse.click(p.x, p.y, { delay: 30 }); await sleep(gap - 30); await page.mouse.click(p.x, p.y, { delay: 30 }); };
try {
  const { ctx, page } = await boot({ viewport: { width: 1512, height: 860 }, deviceScaleFactor: 2 });
  const ev = (f, a) => page.evaluate(f, a);
  console.log('build', await ev(() => GAME_VERSION));
  // [1a] job advancement - 150 ms and 350 ms double-clicks
  for (const gap of [150, 350]) {
    await ev(() => { try { closeAllModals(); } catch (e) {} player.cls = 'warrior'; player.level = 30; player.job = null; player.master = null; openAdvancement(); });
    await sleep(600);
    const p = await spot(page, '#advancement-options .class-card', true);
    if (!p) { ok(`[1] job card shown (${gap} ms)`, false); continue; }
    await dbl(page, p, gap); await sleep(150);
    const a = await ev(() => ({ job: player.job || null, armed: !!document.querySelector('#advancement-options .cls-armed'), confirm: /Click again/.test((document.querySelector('#advancement-options .cls-confirm') || {}).textContent || '') }));
    await sleep(500); await page.mouse.click(p.x, p.y, { delay: 30 }); await sleep(300);
    const b = await ev(() => player.job || null);
    await sleep(1200); await shut(page);   // applyJob opens the talent pick in the same modal 700 ms later
    ok(`[1] job advancement: a ${gap} ms double-click arms the card and commits nothing; a later click commits`, p.hit && !a.job && a.armed && a.confirm && !!b, { hit: p.hit, ...a, after: b });
  }
  // [1b] Master advancement - 250 ms
  {
    await ev(() => { try { closeAllModals(); } catch (e) {} player.level = 80; player.job = 'berserker'; player.master = null; player.masteries = {}; game._devAdvBypass = true; openMasterAdvancement(); });
    await sleep(800);
    const p = await spot(page, '#advancement-options .class-card', true);
    if (p) { await dbl(page, p, 250); await sleep(150); }
    const a = await ev(() => ({ master: player.master || null, armed: !!document.querySelector('#advancement-options .cls-armed') }));
    if (p) { await sleep(500); await page.mouse.click(p.x, p.y, { delay: 30 }); await sleep(300); }
    const b = await ev(() => player.master || null);
    await sleep(1200); await shut(page);
    ok('[1] Master advancement: a 250 ms double-click arms and commits nothing; a later click takes the mastery', !!p && p.hit && !a.master && a.armed && !!b, { p, ...a, after: b });
  }
  // [1c] Reforge - 250 ms
  {
    await ev(() => {
      try { closeAllModals(); } catch (e) {}
      const base = ITEM_POOL.weapons.find((w) => w.cls === 'warrior' && !w.setId) || ITEM_POOL.weapons[0];
      player.equipped = player.equipped || {}; player.equipped.weapon = { ...base, slot: 'weapon', dropLevel: 60, affixes: [Object.keys(PREFIXES)[0]], stars: 0 };
      player.setshards = 5000; openReforgeModal();
    });
    await sleep(500);
    const p = await spot(page, '#do-reforge');
    if (p) { await dbl(page, p, 250); await sleep(250); }
    const a = await ev(() => ({ shards: player.setshards, label: (document.getElementById('do-reforge') || {}).textContent || '' }));
    if (p) { await sleep(400); await page.mouse.click(p.x, p.y, { delay: 30 }); await sleep(600); }
    const b = await ev(() => player.setshards);
    ok('[1] Reforge: a 250 ms double-click shows the Confirm and spends nothing; a later click reforges (-2000)', !!p && p.hit && a.shards === 5000 && /Confirm/.test(a.label) && b === 3000, { p, ...a, after: b });
  }
  // [1d] Save Backups - Delete snapshot (the button turns into "Sure?" under the cursor)
  {
    await ev(() => { try { closeAllModals(); } catch (e) {} const t = Date.now(); localStorage.setItem(BACKUP_KEY, JSON.stringify([{ id: 'r14a', ts: t, level: 9, cls: 'warrior', data: '{}' }, { id: 'r14b', ts: t - 1000, level: 8, cls: 'warrior', data: '{}' }])); openBackupModal(); });
    await sleep(400);
    const p = await spot(page, '#backup-slots .bk-del');
    if (p) { await dbl(page, p, 250); await sleep(150); }
    const a = await ev(() => ({ n: _lxGetBackups().length, sure: (document.querySelector('#backup-slots .bk-del') || {}).textContent }));
    if (p) { await sleep(500); await page.mouse.click(p.x, p.y, { delay: 30 }); await sleep(300); }
    const b = await ev(() => _lxGetBackups().length);
    ok('[1] Save Backups: a 250 ms double-click on Delete leaves the snapshot (the button says Sure?); a later click deletes it', !!p && p.hit && a.n === 2 && a.sure === 'Sure?' && b === 1, { p, ...a, after: b });
    await ev(() => { try { closeBackupModal(); } catch (e) {} });
  }
  // [1e] the game's confirm dialog - a click on Confirm 150 ms after it opened (the opener's double-click) is ignored
  {
    const p = await ev(async () => {
      try { closeAllModals(); } catch (e) {} window.__cf = 'open'; uiConfirm({ title: 'Discard?', body: 'test' }).then((v) => { window.__cf = v; });
      await new Promise((r) => requestAnimationFrame(r)); const y = document.getElementById('confirm-yes').getBoundingClientRect(); window.__cfAt = performance.now();
      return { x: y.x + y.width / 2, y: y.y + y.height / 2 };
    });
    await page.mouse.click(p.x, p.y, { delay: 30 });
    const a = await ev(() => ({ v: window.__cf, ms: Math.round(performance.now() - window.__cfAt) }));
    await sleep(500); await page.mouse.click(p.x, p.y, { delay: 30 }); await sleep(100);
    const b = await ev(() => window.__cf);
    ok('[1] confirm dialog: Confirm clicked as it opens does nothing; clicked after a beat it confirms', a.v === 'open' && b === true, { ...a, after: b });
  }
  // [2] gear rack Buy
  {
    const setup = () => ev(async () => {
      try { closeAllModals(); } catch (e) {} player.cls = 'warrior'; player.level = 60; player.mojicoins = 5e7;
      player.inventory = (player.inventory || []).filter((it) => it && _itemTab(it) !== 'equip'); openShop('weapon'); await new Promise((r) => setTimeout(r, 400));
    });
    const inv = () => ev(() => player.inventory.filter((it) => it && _itemTab(it) === 'equip').length);
    await setup(); let p = await spot(page, '#shop-list .shop-item'); await page.mouse.move(p.x, p.y); await sleep(300);
    await dbl(page, p, 250); await sleep(200); const n1 = await inv();
    await sleep(500); await page.mouse.click(p.x, p.y, { delay: 30 }); await sleep(200); const n2 = await inv();
    await setup(); p = await spot(page, '#shop-list .shop-item'); await page.mouse.move(p.x, p.y); await sleep(500);
    await page.mouse.dblclick(p.x, p.y); await sleep(300); const n3 = await inv();
    ok('[2] gear rack: a 250 ms double-click buys one piece, a later click buys another, a dblclick buys one', p.hit && n1 === 1 && n2 === 2 && n3 === 1, { hit: p.hit, n1, n2, n3 });
    await ev(() => { try { closeAllModals(); } catch (e) {} });
  }
  await ctx.close();
  // [3] the canvas budget is met after a fast tour settles, and the settled map still draws
  for (const [label, opt, settle, hops] of [['desktop', { viewport: { width: 1512, height: 860 }, deviceScaleFactor: 2 }, 'town', 100],
    ['iPhone', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE }, 'town', 40]]) {
    const b = await boot(opt);
    const r = await b.page.evaluate(async ([settle, hops]) => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const maps = ['town', 'forest', 'mushroom', 'glimmerwood', 'bastion', 'lavaCavern', 'coralReef', 'duneSands', 'cadetsStrand', 'tidalLagoon', 'candyCanyon'].filter((m) => MAPS[m]);
      let peak = 0; const ev0 = _lxCvEvicted;
      for (let i = 0; i < hops; i++) { try { closeAllModals(); } catch (e) {} loadMap(maps[i % maps.length], 400); game.paused = false; await w(250); peak = Math.max(peak, _lxCvLruPx); }
      loadMap(settle, 400); game.paused = false; const t0 = performance.now(); let metAt = null; const tl = [];
      let overAfter = 0;
      for (let s = 0; s < 14; s++) { await w(1000); game.paused = false; tl.push(Math.round(_lxCvLruPx / 1e6)); if (metAt === null && _lxCvLruPx <= _LX_CV_BUDGET_PX) metAt = Math.round((performance.now() - t0) / 100) / 10; else if (metAt !== null && _lxCvLruPx > _LX_CV_BUDGET_PX * 1.02) overAfter++; }
      // what a map draws: every source drawn on the game canvas for 2 s must have pixels
      const look = async () => {
      const sc = document.createElement('canvas'); sc.width = sc.height = 24; const sg = sc.getContext('2d', { willReadFrequently: true });
      const seen = new Set(), blank = [], P = CanvasRenderingContext2D.prototype, o = P.drawImage; let phase = '', big = 0, mob = 0, hero = 0, n = 0;
      const wrap = (k, tag) => { const f = window[k]; window[k] = function () { const p0 = phase; phase = tag; try { return f.apply(this, arguments); } finally { phase = p0; } }; return () => { window[k] = f; }; };
      const un = [wrap('drawMonster', 'mob'), wrap('drawPlayer', 'hero'), wrap('drawBackground', 'bg')];
      P.drawImage = function (im) {
        if (this === ctx && im && n < 4000) { n++;
          if (phase === 'mob') mob++; if (phase === 'hero') hero++;
          const dw = arguments.length >= 5 ? arguments[arguments.length - 2] : (im.width || 0), dh = arguments.length >= 5 ? arguments[arguments.length - 1] : (im.height || 0);
          { const m = this.getTransform(); if (Math.abs(dw * dh * m.a * m.d) >= 0.3 * ctx.canvas.width * ctx.canvas.height) big++; }
          if ((im.tagName === 'CANVAS' || im.tagName === 'IMG') && !seen.has(im) && seen.size < 400) { seen.add(im);   // what the budget releases (canvases) and hands back (images)
            try { const iw = im.tagName === 'IMG' ? im.naturalWidth : im.width; let a = 0;
              if (iw) { sg.clearRect(0, 0, 24, 24); o.call(sg, im, 0, 0, 24, 24); const d = sg.getImageData(0, 0, 24, 24).data; for (let i = 3; i < d.length; i += 4) a += d[i]; }
              if (!a && (im.tagName === 'IMG' || im._lxMapT !== undefined) && blank.length < 8) blank.push((phase || '-') + ' ' + (im.tagName || (im.constructor && im.constructor.name) || '?') + ' ' + iw + 'x' + (im.height | 0) + ' t' + (im._lxMapT !== undefined ? 1 : 0) + ' ' + String(im.src || (im._lxSrc && (im._lxSrc.src || im._lxSrc)) || '').slice(-50));
            } catch (e) {} } }
        return o.apply(this, arguments);
      };
      await w(2000); P.drawImage = o; un.forEach((f) => f());
      return { map: game.currentMap, sources: seen.size, blank, big, mob, hero, mobs: game.monsters.length };
      };
      const here = await look();
      loadMap('forest', 400); for (let s = 0; s < 8; s++) { await w(1000); game.paused = false; }   // a hunting map, made under the same budget
      const forest = await look();
      return { budget: _LX_CV_BUDGET_PX / 1e6, peak: Math.round(peak / 1e6), metAt, overAfter, tl: tl.join(' '), evicted: _lxCvEvicted - ev0, forestPx: Math.round(_lxCvLruPx / 1e6), here, forest };
    }, [settle, hops]);
    ok(`[3] ${label}: the canvas budget (${r.budget}M px) is met within 10 s of settling in ${settle} after ${hops} fast hops, and stays met`, r.metAt !== null && r.metAt <= 10 && !r.overAfter, { budget: r.budget, peak: r.peak, metAt: r.metAt, overAfter: r.overAfter, tl: r.tl, evicted: r.evicted });
    ok(`[3] ${label}: ${settle} still draws (no blank source; the backdrop and the hero drew)`, r.here.blank.length === 0 && r.here.sources > 20 && r.here.big > 0 && r.here.hero > 0, r.here);
    ok(`[3] ${label}: the forest after it draws (no blank source; the backdrop, the hero and a mob drew)`, r.forest.blank.length === 0 && r.forest.sources > 20 && r.forest.big > 0 && r.forest.hero > 0 && r.forest.mobs > 0 && r.forest.mob > 0, { ...r.forest, lruPx: r.forestPx });
    await b.ctx.close();
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { fail++; console.log('FAIL the harness runs to the end ' + String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); server.kill(); }
console.log(fail ? `FAIL(${fail}) - ${pass} passed, ${fail} failed` : `PASS(0) - ${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
