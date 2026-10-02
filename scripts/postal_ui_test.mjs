// POSTAL WISP UI (per user: "make sure the UI is well designed, pop punk style as similar to the other UI"). The held-parcels counter (a card per parcel) and
// the courier's market desk are the sell desk's family: the same plate, ink outlines, hard shadows, butter yellow and coasters, with one berry ribbon and two
// stickers of their own. This pins the look (the tokens), that nothing overflows its card or the 960x560 game box (a short and a tall window), and that the Wisp's
// card is no taller than the box (two extra chip rows once clipped her name plate).
//   node scripts/postal_ui_test.mjs      (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served build)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 13883), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
let pass = 0, fail = 0; const ok = (n, c, note) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '   ' + JSON.stringify(note))); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof openShop === 'function' && typeof _lxRenderParcelDesk === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = player.cls || 'warrior'; player.level = 60; player.invulnerable = 9e9; player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true });
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false;
    window.__gear = (n, rars) => { const out = []; for (let i = 0; i < n; i++) { const cat = ['weapons', 'armors', 'accessories'][i % 3], want = 2 + (i % 5), pool = ITEM_POOL[cat].filter((x) => typeof x.price === 'number' && isFinite(x.price)); const base = pool.find((x, j) => (x.tier | 0) === want && j >= i) || pool.find((x) => (x.tier | 0) === want) || pool[i % pool.length]; out.push({ ...base, slot: _catToSlot(cat), rarity: rars[i % rars.length], stars: 0 }); } return out; };
    window.__wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 4000)) { if (fn()) return true; await new Promise((r) => setTimeout(r, 80)); } return !!fn(); };
    window.__box = () => { const w = document.querySelector('.game-wrapper').getBoundingClientRect(); return { top: w.top, bottom: w.bottom, left: w.left, right: w.right }; };
    document.documentElement.classList.remove('lx-nobackdrop');
  });
  for (const [vw, vh] of [[1280, 720], [1280, 1200]]) {
    await page.setViewportSize({ width: vw, height: vh }); await page.waitForTimeout(900); const tag = vw + 'x' + vh + ': ';
    // the Wisp's card: gold chips, the parcels chip beside the daily parcel, five rows at most, her name plate inside the box
    let r = await page.evaluate(async () => { const rars = ['legendary', 'epic', 'rare', 'epic', 'rare', 'legendary', 'epic']; player.postbox = __gear(7, rars).map((it, i) => ({ it, at: Date.now() - [6.4, 5, 3, 2, 1, 0.5, 0.1][i] * 86400000 }));
      document.getElementById('shop-modal').style.display = 'none'; openPostalWisp(); await new Promise((r) => setTimeout(r, 500)); await __wait(() => !document.getElementById('dialog').classList.contains('typing'), 25000);
      const btns = [...document.querySelectorAll('#dialog-options button')], by = (re) => btns.find((b) => re.test(b.textContent)), top = (b) => b ? Math.round(b.getBoundingClientRect().top) : null;
      const rows = new Set(btns.map(top)), hdr = document.querySelector('#dialog .dialog-header').getBoundingClientRect(), box = __box(), dlg = document.getElementById('dialog').getBoundingClientRect();
      return { gold: ['Held parcels', 'Send to market'].map((t) => !!by(new RegExp(t)) && by(new RegExp(t)).classList.contains('opt-shop')), pair: top(by(/Held parcels/)) === top(by(/Collect today/)), rows: rows.size, hdrTop: Math.round(hdr.top), dlgBottom: Math.round(innerHeight - dlg.bottom), hdrInBox: Math.round(hdr.top - box.top) }; });   // NPC dialogs anchor to the WINDOW (every one rises above the box on a tall window), so the plate is judged against the window
    ok(tag + 'the Wisp\'s "Held parcels" and "Send to market" chips are gold shop chips', r.gold.every(Boolean), r);
    ok(tag + '"Held parcels" sits beside "Collect today\'s parcel" and the card is five rows at most', r.pair && r.rows <= 5, r);
    ok(tag + 'the Wisp\'s card fits the window with her name plate showing (and sits inside the game box on the short window)', r.hdrTop >= 0 && r.dlgBottom >= -1 && (vh > 720 || r.hdrInBox >= 0), r);   // Brok's own card sits 3 px from the top at 720
    // the counter
    r = await page.evaluate(async () => { document.getElementById('dialog').style.display = 'none'; openShop('parcels'); await new Promise((r) => setTimeout(r, 500)); const inner = document.querySelector('#shop-modal .modal'), list = document.getElementById('shop-list'), box = __box(), mr = inner.getBoundingClientRect(), cs = (e, p) => getComputedStyle(e)[p];
      const cards = [...list.querySelectorAll('.parcel-row')], inside = (a, b) => a.top >= b.top - 1 && a.bottom <= b.bottom + 1 && a.left >= b.left - 1 && a.right <= b.right + 1;
      const meta = cards.map((c) => inside(c.querySelector('.parcel-meta').getBoundingClientRect(), c.getBoundingClientRect())), pill = cards.map((c) => c.querySelector('.parcel-go')).find((e) => !e.classList.contains('off')), urgent = list.querySelector('.parcel-days.urgent'), foot = document.getElementById('parcel-collect-btn');
      return { inBox: mr.top >= box.top - 2 && mr.bottom <= box.bottom + 2 && mr.left >= box.left - 2 && mr.right <= box.right + 2, listH: Math.round(list.clientHeight), hOver: list.scrollWidth > list.clientWidth + 1, n: cards.length, meta: meta.every(Boolean),
        ring: cs(cards[0], 'borderTopColor') + ' ' + cs(cards[0], 'borderTopWidth'), pill: pill ? cs(pill, 'backgroundColor') : null, urgent: urgent ? cs(urgent, 'backgroundColor') : null, foot: cs(foot, 'backgroundColor'), wallet: getComputedStyle(document.querySelector('#shop-modal .modal > div:has(> #shop-mojicoins)')).display,
        coaster: cards.every((c) => c.querySelector('.sell-icon').getBoundingClientRect().width >= 60), close: !!document.querySelector('#shop-modal .close-btn') && inside(document.querySelector('#shop-modal .close-btn').getBoundingClientRect(), mr) }; });
    ok(tag + 'the counter is inside the game box and its list is capped (<= 420 CSS px) with no sideways scroll', r.inBox && r.listH <= 421 && !r.hOver && r.close, r);
    ok(tag + 'every parcel card keeps its sticker and pill inside it, on a coaster, with the sell desk\'s ink ring (2px)', r.n === 7 && r.meta && r.coaster && r.ring === 'rgb(12, 11, 16) 2px', r);
    ok(tag + 'the tokens: butter-yellow Collect pill and footer, hot-pink last-day sticker, no wallet line on the counter', r.pill === 'rgb(255, 228, 92)' && r.foot === 'rgb(255, 228, 92)' && r.urgent === 'rgb(255, 47, 134)' && r.wallet === 'none', r);
    // the market desk
    r = await page.evaluate(async () => { document.getElementById('shop-modal').style.display = 'none'; player.inventory = __gear(8, ['legendary', 'epic', 'rare', 'common']); game._sellSelection = new Set(); openShop('sell', { payout: LX_MARKET_PAYOUT }); await new Promise((r) => setTimeout(r, 500));
      const inner = document.querySelector('#shop-modal .modal'), list = document.getElementById('shop-list'), box = __box(), mr = inner.getBoundingClientRect(), rb = list.querySelector('.mkt-ribbon'), tag = rb && rb.querySelector('.mkt-tag'), cs = (e, p) => getComputedStyle(e)[p];
      const lr = list.getBoundingClientRect(), rr = rb.getBoundingClientRect(), brok = list.querySelector('.sell-brok');
      return { inBox: mr.top >= box.top - 2 && mr.bottom <= box.bottom + 2 && mr.left >= box.left - 2 && mr.right <= box.right + 2, title: document.getElementById('shop-title').textContent, ribbonIn: rr.left >= lr.left - 1 && rr.right <= lr.right + 1, grad: cs(rb, 'backgroundImage').indexOf('rgb(217, 70, 127)') >= 0, tag: cs(tag, 'backgroundColor'), ring: cs(rb, 'borderTopColor') + ' ' + cs(rb, 'borderTopWidth'), brok: brok ? cs(brok, 'color') : null, listH: Math.round(list.clientHeight), hOver: list.scrollWidth > list.clientWidth + 1 }; });
    ok(tag + 'the courier\'s desk is inside the box, titled "Send to Market", list capped, no sideways scroll', r.inBox && /Send to Market/.test(r.title) && r.listH <= 421 && !r.hOver, r);
    ok(tag + 'the tokens: berry ribbon with an ink ring (2px) and a butter tag, a muted "Brok pays" line, the ribbon inside the grid', r.grad && r.ribbonIn && r.tag === 'rgb(255, 224, 122)' && r.ring === 'rgb(12, 11, 16) 2px' && r.brok === 'rgb(169, 165, 180)', r);
    await page.evaluate(() => { document.getElementById('shop-modal').style.display = 'none'; });
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
