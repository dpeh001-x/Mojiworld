// Save notices reach the player (v0.30.x save-notices).
//   node scripts/save_notices_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Pre-launch new-player audit: an unreadable save was explained only by a toast that sat under the title overlay;
// a `{}` save read as "older format vundefined" and left a junk backup; a minimal save loaded at 100 HP and the title
// said "saved just now" for a day-old save; a full storage warned once with Wardrobe advice and then went silent.
// Title checks boot for real up to the main menu (no overlay hiding); the quota checks use the usual game boot, and also
// cover v0.30.1181's separate paint key: no room for the paint record alone is not a failed save (no badge).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11370';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const SAVE_KEY = 'levelx_save_v1';
const errs = [];
const fontRoute = async (r) => {
  const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
  if (existsSync(path.join(ROOT, rel))) return r.continue();
  try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
};
async function newPage(save) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const cons = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); p.on('console', (m) => cons.push(m.text().slice(0, 200)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), fontRoute);
  await p.addInitScript(([k, v]) => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); if (v != null) localStorage.setItem(k, v); } catch (e) {}
    // probe: has any "could not be read" text ever been the TOPMOST thing at its own spot (i.e. seen by the player)?
    window.__seen = null;
    setInterval(() => {
      try {
        if (window.__seen || !document.body) return;
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!/could not be read/.test(n.nodeValue)) continue;
          const el = n.parentElement, r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 8));
          if (hit && (hit === el || el.contains(hit)) && +getComputedStyle(el).opacity > 0.5) { window.__seen = { id: el.id, cls: el.className, txt: n.nodeValue.slice(0, 90) }; return; }
        }
      } catch (e) {}
    }, 200);
  }, [SAVE_KEY, save]);
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _flushSaveStateNow === 'function' && typeof _lxGetBackups === 'function', null, { timeout: 150000 });
  return { ctx, p, cons };
}
// the real title: wait for the main menu, then give it 2 s on screen (game.time does not step under the overlay)
async function toMenu(p) {
  await p.waitForFunction(() => { const o = document.getElementById('loading-overlay'), m = document.getElementById('lo-menu');
    return o && o.classList.contains('menu-up') && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 240000, polling: 250 });
  await p.waitForTimeout(2000);
}

try {
  // 1) an unreadable save: the notice is on the title, where the player is
  {
    const { ctx, p } = await newPage('{"v":1,"t":1700000000000,"player":{"cls":"warrior","lev');
    await toMenu(p);
    const r = await p.evaluate(() => ({ seen: window.__seen, cont: getComputedStyle(document.getElementById('menu-continue')).display,
      kept: _lxGetBackups().filter((b) => /could not load/.test(b.label || '')).length }));
    check(!!r.seen && r.cont === 'none' && r.kept === 1, 'an unreadable save is explained ON the title menu (the toast sat under the overlay)', r);
    await ctx.close();
  }
  // 3) a `{}` save is corrupt, not "older format vundefined", and leaves no junk backup
  {
    const { ctx, p, cons } = await newPage('{}');
    await toMenu(p);
    const r = await p.evaluate(() => ({ seen: window.__seen, backups: _lxGetBackups().map((b) => b.label), recover: localStorage.getItem('levelx_save_v1_recover'),
      cont: getComputedStyle(document.getElementById('menu-continue')).display }));
    const vund = cons.filter((c) => /vundefined/.test(c));
    check(!vund.length && !r.backups.length && !r.recover, 'a {} save is not an "older format" (no vundefined, no junk backup or recover copy)', { vund, ...r });
    check(!!r.seen && r.cont === 'none', 'a {} save says "could not be read" on the title, with no Continue slot', r);
    await ctx.close();
  }
  // 4) a minimal old save: full HP / MP, and the title shows the save's own day-old stamp
  {
    const t = Date.now() - 86400000 - 120000;
    // bughunt D2: a save with no signature is refused now, so the minimal save is SIGNED the way the game signs it (ls3 body, HMAC-SHA256)
    const SECRET = /const _LX_SAVE_SECRET = '([^']+)'/.exec(readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8'))[1];
    const minimal = { v: 1, t, player: { cls: 'warrior', level: 7 } };
    minimal.sig = createHmac('sha256', SECRET).update(['ls3', minimal.v, minimal.t, JSON.stringify(minimal.player), '{}'].join('\n')).digest('hex');
    const { ctx, p } = await newPage(JSON.stringify(minimal));
    await p.evaluate(() => { try { _flushSaveStateNow(); } catch (e) {} });   // the boot's own autosave (it lands before the menu on a real boot)
    const hp = await p.evaluate(() => ({ hp: Math.round(player.hp), max: Math.round(getMaxHp()), mp: Math.round(player.mp), maxMp: Math.round(getMaxMp()), lvl: player.level }));
    check(hp.lvl === 7 && hp.max > 100 && hp.hp === hp.max && hp.mp === hp.maxMp, 'a save without hp / mp loads at full pools (was 100 of 643)', hp);
    await toMenu(p);
    const sub = await p.evaluate(() => document.getElementById('menu-continue-sub').textContent);
    check(/saved 1d ago/.test(sub) && !/just now/.test(sub), 'the title shows the continued save\'s own stamp ("1d ago", was "saved just now")', sub);
    await ctx.close();
  }
  // 2) storage full: a sticky badge with generic advice, until a save lands again
  {
    const { ctx, p } = await newPage(JSON.stringify({ v: 1, t: Date.now(), player: { cls: 'warrior', level: 7 } }));
    await p.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
      loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
      player.invulnerable = 999999; game.monsters.length = 0;
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if ((k === 'levelx_save_v1' && window.__quota) || (k === 'levelx_save_v1_paint' && window.__quotaPaint)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return orig.call(this, k, v); };
    });
    await p.waitForFunction(() => game.time > 0, null, { timeout: 60000 });
    const badge = () => p.evaluate(() => { const el = document.getElementById('save-indicator'), r = el.getBoundingClientRect();
      return { fail: el.classList.contains('lx-save-fail'), op: getComputedStyle(el).opacity, txt: el.textContent, tip: el.title, w: Math.round(r.width),
        toasts: [...document.querySelectorAll('#toast-container .toast')].map((t) => t.textContent) }; });
    await p.evaluate(() => { window.__quota = true; _flushSaveStateNow(); });
    await p.waitForTimeout(400);
    const b1 = await badge();
    const say = b1.toasts.find((x) => /sav/i.test(x)) || '';
    check(b1.fail && b1.op === '1' && b1.w > 0 && /not saving/i.test(b1.txt) && /free up space/i.test(b1.tip), 'a failed save raises a sticky "Not saving" badge with generic advice', b1);
    check(/not saving/i.test(say) && !/wardrobe/i.test(say), 'the storage-full toast gives generic advice, not the Wardrobe hint, to a hero with no paint', { say });
    const t0 = await p.evaluate(() => game.time); await p.waitForFunction((t) => game.time > t + 2, t0, { timeout: 60000 });
    await p.evaluate(() => _flushSaveStateNow());
    const b2 = await badge();
    const paint = await p.evaluate(() => { if (typeof _lxSaveFailAdvice !== 'function') return null; const was = player.customPaintLayers;
      player.customPaintLayers = { hat: 'data:image/png;base64,AAAA' }; const a = _lxSaveFailAdvice('full'); player.customPaintLayers = was; return a; });
    check(b2.fail && b2.op === '1' && !!paint && /wardrobe/i.test(paint), 'the badge stays through later failures; the Wardrobe hint appears only with painted layers', { b2, paint });
    await p.evaluate(() => { window.__quota = false; _flushSaveStateNow(); });
    await p.waitForTimeout(400);
    const b3 = await badge();
    const stored = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('levelx_save_v1')).t > Date.now() - 20000; } catch (e) { return false; } });
    check(!b3.fail && /saved/i.test(b3.txt) && stored, 'the badge clears as soon as a save lands again', { b3, stored });
    // the Wardrobe paint lives under its own key (v0.30.1181): no room for THAT record alone is not a failed save (the paint goes
    // inline), so no badge; only when the main save cannot land either does it go up. The paint is removed again afterwards.
    const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const paintRun = await p.evaluate((PX) => { const id = CHAR_PAINT_LAYER_IDS[0], el = document.getElementById('save-indicator');
      player.customPaintLayers = Object.assign({}, player.customPaintLayers, { [id]: PX });
      window.__quotaPaint = true; _flushSaveStateNow();
      const a = { fail: el.classList.contains('lx-save-fail'), inline: (localStorage.getItem('levelx_save_v1') || '').indexOf(PX) >= 0 };
      window.__quota = true; _flushSaveStateNow();
      const b = { fail: el.classList.contains('lx-save-fail'), toast: [...document.querySelectorAll('#toast-container .toast')].map((t) => t.textContent).filter((x) => /not saving/i.test(x)).pop() || '' };
      window.__quota = false; window.__quotaPaint = false; delete player.customPaintLayers[id]; _flushSaveStateNow();
      return { a, b, cleared: !el.classList.contains('lx-save-fail') }; }, PX);
    check(!paintRun.a.fail && paintRun.a.inline && paintRun.b.fail && /wardrobe/i.test(paintRun.b.toast) && paintRun.cleared,
      'no room for the paint record alone raises no badge (paint goes inline); main save failing too does (with the Wardrobe hint); a landed save clears it', paintRun);
    await p.waitForTimeout(300);
    await ctx.close();
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) {
  console.log('FAIL  test crashed   ' + JSON.stringify(String(e && e.stack || e).slice(0, 600))); bad++; total++;
} finally {
  await browser.close(); srv.kill();
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
