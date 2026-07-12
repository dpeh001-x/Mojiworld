// Live boot test: (1) the Gravitos flash-forward prologue starts IMMEDIATELY after
// class creation (was: up to 15s stranded in the void while the arena preloaded);
// (2) the boot gate fetches ALL registry NPCs (incl. the 25 that had rotted out of
// the hand-list — DJ Vinyl, Postal Wisp, Milo, Guguma, Bravo are town NPCs) before
// the world reveals; (3) the town background is part of the gated set.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // FRESH SAVE: wipe storage before the game boots meaningfully, then reload.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for the auth gate ("Name your hero") — assets loaded + decode gate cleared.
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 90000 });
  ok('boot gate present: auth form only after asset+decode gate', true);

  // (2)+(3) BEFORE reveal: previously-missing town NPCs + town bg must be LOADED.
  // (Resource-timing entries evict past the 250-entry buffer, so probe the actual
  // registry Image objects — the ground truth the renderer reads.)
  const fetched = await page.evaluate(() => {
    const npcUp = (name) => { try { const i = NPC_SPRITES[name]; return !!(i && i.complete && i.naturalWidth > 0); } catch (e) { return false; } };
    let townBg = false; try { const b = BG_IMAGES.everdawnCentral; townBg = !!(b && (b._loaded || (b.complete && b.naturalWidth > 0))); } catch (e) {}
    return {
      djVinyl: npcUp('DJ Vinyl'), postalWisp: npcUp('Postal Wisp'), milo: npcUp('Milo'),
      guguma: npcUp('Guguma'), bravo: npcUp('Bravo'),
      whisper: npcUp('Whisper'),
      townBg,
    };
  });
  ok('town NPCs LOADED before reveal (DJ Vinyl/Postal Wisp/Milo/Guguma/Bravo)',
     fetched.djVinyl && fetched.postalWisp && fetched.milo && fetched.guguma && fetched.bravo, fetched);
  ok('TOWN background loaded before reveal', fetched.townBg, fetched);
  ok('case-fixed Whisper sprite loads (was 404 whisper.webp)', fetched.whisper, fetched);

  // Enter a name -> class select appears.
  // v0.27.8 Steam-style menu gates naming behind New Game — click through it first.
  await page.click('#menu-newgame').catch(() => {});
  await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.fill('#auth-user', 'Tester');
  await page.click('#auth-submit');
  await page.waitForFunction(() => { const c = document.getElementById('class-select-modal'); return c && getComputedStyle(c).display !== 'none'; }, null, { timeout: 20000 });
  ok('class select opens after naming', true);

  // Pick a class through the REAL path and time the cinematic's arrival.
  const t0 = Date.now();
  await page.evaluate(() => { applyClass('warrior'); });
  await page.waitForFunction(() => !!document.getElementById('prologue-cine'), null, { timeout: 10000 }).catch(() => {});
  const dtMs = Date.now() - t0;
  const cineUp = await page.evaluate(() => !!document.getElementById('prologue-cine'));
  ok('Gravitos prologue overlay appears after class pick', cineUp, { dtMs });
  ok('…and appears FAST (<3s, was up to 15.6s stranded)', cineUp && dtMs < 3000, { dtMs });

  // Advance through the 3 stanzas -> "memory sharpens" handoff -> arena.
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  await page.waitForFunction(() => window._prologueActive && game.currentMap === 'gravitosArena', null, { timeout: 25000 }).catch(() => {});
  const arena = await page.evaluate(() => ({ map: game.currentMap, active: !!window._prologueActive, lv: player.level }));
  ok('stanzas hand off into the Gravitos arena (Lv100 memory)', arena.map === 'gravitosArena' && arena.active && arena.lv === 100, arena);

  ok('no page errors through the whole flow', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== BOOT GATE + PROLOGUE TIMING ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
