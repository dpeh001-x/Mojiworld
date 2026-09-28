// Live boot test: (1) the Gravitos flash-forward prologue starts IMMEDIATELY after
// class creation (was: up to 15s stranded in the void while the arena preloaded);
// (2) the boot gate fetches ALL registry NPCs (incl. the 25 that had rotted out of
// the hand-list — DJ Vinyl, Postal Wisp, Milo, Guguma, Bravo are town NPCs) before
// the world reveals; (3) the town background is part of the gated set.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const PORT = process.env.PORT || '8080';
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
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
const URL = `http://localhost:${PORT}/${FILE}`;
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
  // v0.30.1205 (9d78e8f3) lazy-art2: an NPC sheet is map-tied art - parked by the boot hold until a map that has her
  // is asked for, so a new player (who starts in The Void, v0.30.789) no longer pulls town's NPCs before the menu.
  // The rotted-out registry NPCs must still be REGISTERED and load: ask for town the way entering it does
  // (_lxArt2WantMap(id, hi), via _lxLazyWantMap), Whisper by her own key, then read the registry Images.
  const fetched = await page.evaluate(async () => {
    try { _lxArt2WantMap('town', true); _lxArt2Want('npc:Whisper', true); } catch (e) {}
    const _up = (n) => { const i = NPC_SPRITES[n]; return !!(i && i.complete && i.naturalWidth > 0); };
    for (let k = 0; k < 100; k++) { try { if (['DJ Vinyl', 'Postal Wisp', 'Milo', 'Guguma', 'Bravo', 'Whisper'].every(_up)) break; } catch (e) {} await new Promise(r => setTimeout(r, 200)); }
    const npcUp = (name) => { try { const i = NPC_SPRITES[name]; return !!(i && i.complete && i.naturalWidth > 0); } catch (e) { return false; } };
    let townBg = false; try { const b = BG_IMAGES.everdawnCentral; townBg = !!(b && (b._loaded || (b.complete && b.naturalWidth > 0))); } catch (e) {}
    return {
      djVinyl: npcUp('DJ Vinyl'), postalWisp: npcUp('Postal Wisp'), milo: npcUp('Milo'),
      guguma: npcUp('Guguma'), bravo: npcUp('Bravo'),
      whisper: npcUp('Whisper'),
      townBg,
    };
  });
  ok('town NPCs load when town is asked for (DJ Vinyl/Postal Wisp/Milo/Guguma/Bravo)',
     fetched.djVinyl && fetched.postalWisp && fetched.milo && fetched.guguma && fetched.bravo, fetched);
  // v0.30.x title-first - with title-first the town's backdrop streams in after the menu; it must be in when the world opens
  const __tf = await page.evaluate(() => !!window._lxTitleFirst);
  const __townCheck = (atWorld) => ok('TOWN background loaded before reveal (title-first: before the world opens)', fetched.townBg || (__tf && atWorld), Object.assign({}, fetched, { titleFirst: __tf, atWorld }));
  if (!__tf) __townCheck(false);
  ok('case-fixed Whisper sprite loads (was 404 whisper.webp)', fetched.whisper, fetched);

  // Enter a name -> class select appears.
  // v0.27.8 Steam-style menu gates naming behind New Game — click through it first.
  await page.click('#menu-newgame').catch(() => {});
  await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.fill('#auth-user', 'Tester');
  await page.click('#auth-submit');
  await page.waitForFunction(() => { const c = document.getElementById('class-select-modal'); return c && getComputedStyle(c).display !== 'none'; }, null, { timeout: 20000 });
  ok('class select opens after naming', true);
  if (__tf) {   // v0.30.x title-first - the world opens when the loading overlay fades (after the commence gate)
    await page.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return !o || o.classList.contains('fade'); }, null, { timeout: 150000 }).catch(() => {});
    __townCheck(await page.evaluate(() => { try { const b = BG_IMAGES.everdawnCentral; return !!(b && (b._loaded || (b.complete && b.naturalWidth > 0))); } catch (e) { return false; } }));
  }

  // Pick a class through the REAL path and time the cinematic's arrival.
  const t0 = Date.now();
  await page.evaluate(() => { applyClass('warrior'); });
  // v0.29.72 plays the dagger POV clip (#prologue-dagger-cine) BEFORE the
  // stanza overlay (#prologue-cine) — the first visible cinematic beat is
  // what the "not stranded" budget applies to.
  await page.waitForFunction(() => !!(document.getElementById('prologue-cine') || document.getElementById('prologue-dagger-cine')), null, { timeout: 10000 }).catch(() => {});
  const dtMs = Date.now() - t0;
  const cineUp = await page.evaluate(() => !!(document.getElementById('prologue-cine') || document.getElementById('prologue-dagger-cine')));
  ok('Gravitos prologue overlay appears after class pick', cineUp, { dtMs });
  ok('…and appears FAST (<3s, was up to 15.6s stranded)', cineUp && dtMs < 3000, { dtMs });
  // If the dagger clip is still playing, skip it so the stanza loop lands.
  const daggerUp = await page.evaluate(() => !!document.getElementById('prologue-dagger-cine'));
  if (daggerUp) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); }

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
