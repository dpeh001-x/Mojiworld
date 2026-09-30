// UI on the smallest phones (v0.30.x ui-small): 568x320 landscape (iPhone SE 1st gen), with 667x375 and 844x390 alongside.
//   node scripts/ui_small_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<n> for the server)
// Touch contexts (isMobile, hasTouch). Checks by bounding rects and what a finger at a control's centre would hit:
//   title menu: New Game on screen; the name step (New Game) and the co-op step: their main button and Back on screen
//     without scrolling; character creation: NEXT (look page) and Back (class page) on screen;
//   U panel (Level Up and Items tabs): the close X and the tabs on screen, the six shortcuts on ONE line inside the card
//     with no label cut; Items: the first bag slot on screen; Settings: Done and Reset; jukebox: X and Stop; quest
//     journal: X and a category chip;
//   the level-cap Ascend pill: shown, clear of every touch-deck button by its box (a locked skill button lets touches
//     through, so it counts by its box), still clear after the 4 s re-dock, and a tap opens Guguma's card; no page errors.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11520';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const CT = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', mp4: 'video/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', js: 'text/javascript', json: 'application/json', css: 'text/css', svg: 'image/svg+xml', gif: 'image/gif', webm: 'video/webm' };
const DECK = '#mobile-deck .mc-btn, #mobile-ctrl .mc-btn, #mobile-deck .mc-dpad, .mc-menu, .mc-chat-btn, #mobile-ctrl-toggle, #skill-bar';
async function boot(vw, vh) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${vw}: ` + String(e).slice(0, 160)));
  // the game's own crash notes (_lxCrashNotes: window 'error' events it survives, e.g. a ResizeObserver loop) count too; since v0.30.1454 a ResizeObserver loop is a [layout] warning (no crash toast for players) - still a failure here
  p.on('console', (m) => { if ((m.type() === 'error' && /^\[(error|promise)\] v0/.test(m.text())) || (m.type() === 'warning' && /^\[layout\] v0/.test(m.text()))) errs.push(`${vw}: ` + m.text().slice(0, 160)); });
  // a file the (stale) working copy lacks - fonts, some sprites - comes from origin, as keybinds_test's font route does
  await p.route((u) => u.hostname === 'localhost' && !u.pathname.endsWith('.html') && !existsSync(path.join(ROOT, decodeURIComponent(u.pathname))), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    try { r.fulfill({ status: 200, contentType: CT[rel.split('.').pop().toLowerCase()] || 'application/octet-stream', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 25, stdio: ['ignore', 'pipe', 'ignore'] }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _gugumaAscendPrompt === 'function' && typeof openLevelUpPanel === 'function' && typeof openJukebox === 'function', null, { timeout: 150000 });
  await p.evaluate(() => { LX_ASCENSION_LOCKED = false; });   // v0.30.1453 ascension is locked for players; this suite drives the feature itself, so it opens the lock
  await p.evaluate(() => {
    window.__frames = async (n, ms) => { const t0 = game.time | 0, w0 = Date.now(); while ((game.time | 0) - t0 < n && Date.now() - w0 < (ms || 30000)) await new Promise((s) => setTimeout(s, 40)); return (game.time | 0) - t0; };
    window.__box = (el) => { if (!el) return null; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0) ? [r.left, r.top, r.right, r.bottom] : null; };
    window.__hit = (a, b) => a[0] < b[2] - 0.5 && a[2] > b[0] + 0.5 && a[1] < b[3] - 0.5 && a[3] > b[1] + 0.5;
    window.__name = (e) => (e.id || String(e.className || e.tagName)).slice(0, 30);
    // fully inside the window, and what a finger at its centre hits is the control itself
    window.__seen = (sels) => { const o = {}; for (const sel of sels) { const e = document.querySelector(sel), r = __box(e); if (!r) { o[sel] = { ok: false, why: e ? 'no box' : 'missing' }; continue; }
      const inV = r[0] >= -0.5 && r[1] >= -0.5 && r[2] <= innerWidth + 0.5 && r[3] <= innerHeight + 0.5;
      const h = inV ? document.elementFromPoint((r[0] + r[2]) / 2, (r[1] + r[3]) / 2) : null;
      o[sel] = { ok: inV && !!h && (h === e || e.contains(h)), r: r.map(Math.round), by: h ? __name(h) : null }; } return o; };
  });
  return { ctx, p };
}
const seen = (p, sels) => p.evaluate((sels) => __seen(sels), sels);
const allOk = (o) => Object.values(o).every((x) => x.ok);
const click = (p, id) => p.evaluate((id) => document.getElementById(id).click(), id);

async function phone(vw, vh) {
  const tag = `${vw}x${vh}`;
  const { ctx, p } = await boot(vw, vh);
  // ---- the title card ----
  await p.waitForFunction(() => { const b = document.getElementById('menu-newgame'); return b && b.getBoundingClientRect().width > 0; }, null, { timeout: 150000 });
  await p.waitForTimeout(3500);   // the menu's entrance
  const t = await seen(p, ['#menu-newgame']);
  check(allOk(t), `${tag} title menu: New Game on screen and tappable`, t);
  await click(p, 'menu-newgame'); await p.waitForTimeout(900);
  const nm = await seen(p, ['#auth-user', '#auth-submit', '#menu-name-back']);
  check(allOk(nm), `${tag} name step: the name field, Enter Mojiworld and Back on screen without scrolling`, nm);
  await click(p, 'menu-name-back'); await p.waitForTimeout(500); await click(p, 'menu-coop'); await p.waitForTimeout(900);
  const co = await seen(p, ['#menu-coop-code', '#menu-coop-play', '#menu-coop-back']);
  check(allOk(co), `${tag} co-op step: the party code, Play together and Back on screen without scrolling`, co);
  await click(p, 'menu-coop-back'); await p.waitForTimeout(500); await click(p, 'menu-newgame'); await p.waitForTimeout(600);
  await p.fill('#auth-user', 'Tester'); await click(p, 'auth-submit');
  await p.waitForFunction(() => { const m = document.getElementById('class-select-modal'); return m && m.style.display === 'flex'; }, null, { timeout: 60000 });
  await p.waitForFunction(() => {   // the title card has faded off: a finger on the creation card lands on it
    const r = document.querySelector('#class-select-modal .modal.cs-epic').getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + 40);
    return !!(h && h.closest('#class-select-modal')); }, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const cs1 = await seen(p, ['#cs-nav-next']);
  await p.evaluate(() => _renderCsPage('class')); await p.waitForTimeout(700);
  const cs2 = await seen(p, ['#cs-nav-back']);
  check(allOk(cs1) && allOk(cs2), `${tag} character creation: NEXT (look page) and Back (class page) on screen`, { cs1, cs2 });

  // ---- in the world ----
  const fr = await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 30;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    for (let i = 0; i < 8; i++) { const it = rollItemDrop(1, 30); if (it) player.inventory.push(it); }
    try { acceptQuest('q_act1_waking', true); } catch (e) {}
    const w0 = Date.now(); while (document.body.classList.contains('cinematic') && Date.now() - w0 < 12000) await new Promise((s) => setTimeout(s, 100));
    return __frames(20);
  });
  check(fr > 0 && await p.evaluate(() => document.body.classList.contains('mc-landscape')), `${tag} the world steps, touch deck up`, { fr });
  const openP = (code) => p.evaluate(async (code) => { try { closeAllModals(); } catch (e) {} try { closeSettingsModal(); } catch (e) {} try { closeJukebox(); } catch (e) {}
    game.paused = false; (0, eval)(code); await new Promise((s) => setTimeout(s, 900)); }, code);
  const urow = () => p.evaluate(() => {
    const m = document.querySelector('#attributes-modal .modal'), mr = m.getBoundingClientRect(), bs = [...document.querySelectorAll('#u-jump-row .u-jump')];
    const tops = bs.map((b) => Math.round(b.getBoundingClientRect().top)), cut = bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent.trim());
    const out = bs.filter((b) => { const r = b.getBoundingClientRect(); return r.left < mr.left - 1 || r.right > mr.right + 1; }).length;
    return { n: bs.length, spread: Math.max(...tops) - Math.min(...tops), cut, out };
  });
  const rowOk = (u) => u.n === 6 && u.spread < 4 && u.cut.length === 0 && u.out === 0;
  await openP("game._uTab = 'lp'; openLevelUpPanel()");
  const u1 = await seen(p, ['#attributes-modal .modal .close-btn', '#u-tabs .inv-tab']), r1 = await urow();
  await openP("game._uTab = 'items'; openLevelUpPanel()");
  const u2 = await seen(p, ['#attributes-modal .modal .close-btn', '#u-inv-tabs .inv-tab', '#u-inv-grid .inv-slot']), r2 = await urow();
  check(allOk(u1), `${tag} U panel: the close X and the tabs on screen`, u1);
  check(rowOk(r1) && rowOk(r2), `${tag} U panel: the six shortcuts on ONE line inside the card, no label cut (Level Up and Items tabs)`, { r1, r2 });
  check(allOk(u2), `${tag} inventory (U Items): the close X, the bag tabs and the first bag slot on screen`, u2);
  await openP('openSettingsModal()');
  const se = await seen(p, ['#settings-modal .close', '#settings-modal .reset']);
  check(allOk(se), `${tag} Settings: Done and Reset Defaults on screen`, se);
  await openP('openJukebox()');
  const jb = await seen(p, ['#jukebox-modal .jb-x', '#jukebox-stop']);
  check(allOk(jb), `${tag} jukebox: the close X and Stop on screen`, jb);
  await openP('toggleQuestJournal()');
  const qj = await seen(p, ['#quest-modal .close-btn', '#quest-modal .qj-chip']);
  check(allOk(qj), `${tag} quest journal: the close X and a category chip on screen`, qj);
  await openP('0');

  // ---- the Ascend pill at the level cap (the collapsed chip a load at the cap raises) ----
  const pill = () => p.evaluate(async (DECK) => {
    const w0 = Date.now(); while (!__box(document.getElementById('guguma-ascend')) && Date.now() - w0 < 10000) await new Promise((s) => setTimeout(s, 100));
    await new Promise((s) => setTimeout(s, 600));   // it settles a frame after it shows (a size change waits one)
    const el = document.getElementById('guguma-ascend'), r = __box(el); if (!r) return { shown: false };
    const deck = [...document.querySelectorAll(DECK)].filter((b) => { const q = __box(b); return q && __hit(r, q); }).map(__name);
    const onScreen = r[0] >= -0.5 && r[1] >= -0.5 && r[2] <= innerWidth + 0.5 && r[3] <= innerHeight + 0.5;
    const h = document.elementFromPoint((r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
    return { shown: true, pill: !!el.querySelector('#guguma-ascend-pill'), rect: r.map(Math.round), onScreen, deck, tappable: !!(h && el.contains(h)) };
  }, DECK);
  await p.evaluate(() => { player.level = PRESTIGE_LEVEL; _gugumaAscendChip(false); _gugumaAscendPrompt(true); });
  const a1 = await pill();
  await p.waitForTimeout(4600);   // the 4 s reconciler re-docks it
  const a2 = await pill();
  let opened = false;
  if (a2.tappable) { await p.touchscreen.tap((a2.rect[0] + a2.rect[2]) / 2, (a2.rect[1] + a2.rect[3]) / 2); await p.waitForTimeout(900); opened = await p.evaluate(() => !!document.getElementById('guguma-ascend-go')); }
  check(a1.pill && a1.onScreen && a1.deck.length === 0 && a2.onScreen && a2.deck.length === 0 && a2.tappable,
    `${tag} Ascend pill: on screen, clear of every touch-deck button (locked ones too), still clear after the re-dock`, { a1, a2 });
  check(opened, `${tag} Ascend pill: a tap opens Guguma's card`, { a2, opened });
  await p.evaluate(() => { player.level = 30; _gugumaAscendChip(false); });
  await ctx.close();
}

try {
  await phone(568, 320);
  await phone(667, 375);
  await phone(844, 390);
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) { check(false, 'harness', String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
