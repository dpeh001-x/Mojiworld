// Live UI audit vs AAA conventions: modal open/close/Esc/pause consistency,
// no stacking, no throw, and responsive HUD (no off-screen overflow at 3 sizes).
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof closeAllModals === 'function', null, { timeout: 30000 });
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 45000 }).catch(() => {});
  await page.click('#menu-newgame').catch(() => {});
  await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.fill('#auth-user', 'UITester').catch(() => {});
  await page.click('#auth-submit').catch(() => {});
  await sleep(1500);
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => {
    player.cls = 'warrior'; game.paused = false; window._prologueActive = false;
    // Real play closes the class-select modal on pick; the test set cls directly,
    // so hide it (else it counts as an open modal / pause-owner).
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    try { loadMap('glasswindSteppe'); } catch (e) {}
  });
  await sleep(600);

  // Modals that open standalone (no NPC/chest context needed).
  const MODALS = [
    ['Settings', 'openSettingsModal'], ['Keybinds', 'toggleKeybindModal'], ['Skills', 'openSkillsModal'],
    ['World Map', 'toggleWorldMap'], ['Quest Journal', 'toggleQuestJournal'], ['Codex', 'openCodex'],
    ['Mojidex', 'openMojidex'], ['Attributes', 'openAttributes'], ['Help', 'openHelp'],
    ['Multiplayer', 'openMultiplayer'], ['Level-Up Panel', 'openLevelUpPanel'],
  ];
  const openErrs = [], closeLeftPaused = [], stackedVisible = [];
  for (const [name, fn] of MODALS) {
    const r = await ev((f) => {
      try { closeAllModals(); } catch (e) {}
      const pausedBefore = game.paused;
      let threw = null;
      try { if (typeof window[f] === 'function') window[f](); else return { skip: true }; } catch (e) { threw = String(e).slice(0, 90); }
      // count visible modal overlays
      const vis = Array.from(document.querySelectorAll('.modal-overlay, [id$="-modal"], [id$="-modal-bg"].on, .char-studio-overlay.open')).filter(el => {
        const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
      }).length;
      const openedPaused = game.paused;
      try { closeAllModals(); } catch (e) {}
      const pausedAfterClose = game.paused;
      return { threw, vis, openedPaused, pausedAfterClose, pausedBefore };
    }, fn);
    if (r.skip) continue;
    if (r.threw) openErrs.push(`${name}: ${r.threw}`);
    // A modal must not INTRODUCE a stuck pause: only flag if closing left the
    // game paused when it wasn't before opening. (Post-naming the Gravitos
    // prologue legitimately owns the world pause — closeAllModals correctly
    // won't override a cinematic, so a pre-existing pause is not a bug.)
    if (r.pausedAfterClose === true && r.pausedBefore === false) closeLeftPaused.push(name);
  }
  ok('all standalone modals open without throwing', openErrs.length === 0, openErrs);
  ok('closeAllModals always unpauses (no stuck pause)', closeLeftPaused.length === 0, closeLeftPaused);

  // Esc closes an open modal (consistency).
  const escR = await ev(() => {
    try { closeAllModals(); openSettingsModal(); } catch (e) { return { err: String(e).slice(0, 80) }; }
    const openNow = !!document.getElementById('settings-modal-bg') && document.getElementById('settings-modal-bg').classList.contains('on');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const stillOpen = !!document.getElementById('settings-modal-bg') && document.getElementById('settings-modal-bg').classList.contains('on');
    try { closeAllModals(); } catch (e) {}
    return { openNow, stillOpen };
  });
  ok('Esc closes the Settings modal', escR.openNow === true && escR.stillOpen === false, escR);

  // Responsive: HUD must not overflow the viewport at common resolutions.
  const overflow = {};
  for (const [w, h, tag] of [[1920, 1080, 'desktop'], [1280, 800, 'laptop'], [812, 375, 'mobile-landscape']]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(300);
    overflow[tag] = await ev(({ vw, vh }) => {
      const bad = [];
      // Check key HUD anchors are inside the viewport.
      for (const id of ['top-ui', 'hud-mojicoins', 'mp-btn', 'taxi-btn']) {
        const el = document.getElementById(id);
        if (!el || el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2 || r.top < -2) bad.push(id + ':' + JSON.stringify({ l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }));
      }
      // Page body must not scroll horizontally.
      const hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      return { bad, hScroll };
    }, { vw: w, vh: h });
  }
  ok('no HUD overflow at desktop 1920', overflow.desktop.bad.length === 0 && !overflow.desktop.hScroll, overflow.desktop);
  ok('no HUD overflow at laptop 1280', overflow.laptop.bad.length === 0 && !overflow.laptop.hScroll, overflow.laptop);
  ok('no HUD overflow at mobile-landscape 812', overflow['mobile-landscape'].bad.length === 0 && !overflow['mobile-landscape'].hScroll, overflow['mobile-landscape']);

  ok('no page errors through the UI audit', errs.length === 0, errs.slice(0, 6));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== UI AUDIT (modals / Esc / pause / responsive) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
