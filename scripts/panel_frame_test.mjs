// Live test: PERSONA-5-STYLE PANEL INTERIOR (v0.29.29) on the four main in-game
// windows (Q wardrobe, U attributes, E quest journal, K keybinds). Verifies the
// P5 graphic (30% opacity) is applied as the panel background and no ornamental
// border-image remains. Run a static server on :8080 first, then:
//   node scripts/panel_frame_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const URL = process.env.MOJI_URL || 'http://localhost:8080/mojiworld_game.html';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const results = [];
const ok = (n, c, x) => { results.push({ n, pass: !!c, x }); console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + JSON.stringify(x) : '')); };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page._errs = []; page.on('pageerror', e => page._errs.push(String(e).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // P5 asset serves
  const asset = await page.evaluate(async () => { try { const r = await fetch('Sprites/ui/panel_p5.webp'); return { ok: r.ok, type: r.headers.get('content-type') }; } catch (e) { return { ok: false }; } });
  ok('panel_p5.webp serves as image', asset.ok && /webp/.test(asset.type || ''), asset);

  // reach in-game
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 45000 }).catch(() => {});
  await page.click('#menu-newgame').catch(() => {});
  await page.fill('#auth-user', 'Framer').catch(() => {});
  await page.click('#auth-submit').catch(() => {});
  await page.waitForFunction(() => { const c = document.getElementById('class-select-modal'); return c && getComputedStyle(c).display !== 'none'; }, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => { try { applyClass('warrior'); } catch (e) {} });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { _prologueFinish(true); } catch (e) {} try { _closeTutorial(true); } catch (e) {} try { closeAllModals(); } catch (e) {} });
  await page.waitForTimeout(500);

  const panels = [
    ['U attributes', () => { try { openLevelUpPanel(); } catch (e) {} }, '#attributes-modal > .modal'],
    ['E quest',      () => { try { toggleQuestJournal(); } catch (e) {} }, '#quest-modal > .modal'],
    ['K keybinds',   () => { try { toggleKeybindModal(); } catch (e) {} }, '#keybind-modal > div'],
    ['Q wardrobe',   () => { try { openCharStudio(); } catch (e) {} }, '#char-studio-overlay > .char-studio-panel'],
  ];
  for (const [name, open, sel] of panels) {
    await page.evaluate(() => { try { closeAllModals(); } catch (e) {} });
    await page.waitForTimeout(250);
    await page.evaluate(`(${open.toString()})()`);
    await page.waitForTimeout(650);
    const cs = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return { found: false };
      const c = getComputedStyle(el);
      return { found: true, bg: (c.backgroundImage || '').slice(0, 120), imgSrc: c.borderImageSource };
    }, sel);
    ok(`${name}: P5 background applied`, cs.found && /panel_p5(_q)?\.webp/.test(cs.bg || ''), { bg: cs.bg });
    ok(`${name}: no ornamental frame`, cs.found && !/panel_frame\.webp/.test(cs.imgSrc || ''), { imgSrc: cs.imgSrc });
  }
  ok('no page errors', page._errs.length === 0, page._errs.slice(0, 3));
} finally {
  await browser.close();
}
const fails = results.filter(r => !r.pass).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
