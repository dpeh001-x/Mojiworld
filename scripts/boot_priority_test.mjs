// Live test: ASSET PRIORITY DISCIPLINE — the ~90 parse-time backgrounds/tiles are
// LOW priority so the loading screen, start map, and character sprites win the
// bandwidth; the boot decode-gate re-stamps the start map's assets HIGH; the world
// streamer streams LOW and kicks 8s post-reveal; the fx sweep is paced (no burst).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
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
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });

  // Parse-time bulk loads are LOW priority the moment they exist.
  await page.waitForFunction(() => typeof BG_IMAGES !== 'undefined', null, { timeout: 30000 });
  const prio = await page.evaluate(() => {
    const bgs = Object.values(BG_IMAGES).filter(i => i && i.fetchPriority !== undefined);
    const lowBgs = bgs.filter(i => i.fetchPriority === 'low').length;
    return { bgs: bgs.length, lowBgs };
  });
  ok(`parse-time backgrounds are LOW priority (${prio.lowBgs}/${prio.bgs})`, prio.bgs > 50 && prio.lowBgs === prio.bgs, prio);

  // After the boot decode-gate runs (auth form shows), the START map's bg has
  // been re-stamped HIGH — proof the gate's assets jump the queue.
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 90000 });
  const gate = await page.evaluate(() => ({
    townBgPrio: BG_IMAGES.everdawnCentral ? BG_IMAGES.everdawnCentral.fetchPriority : null,
    townBgLoaded: !!(BG_IMAGES.everdawnCentral && (BG_IMAGES.everdawnCentral._loaded || BG_IMAGES.everdawnCentral.naturalWidth > 0)),
    forestStillLow: BG_IMAGES.forest ? BG_IMAGES.forest.fetchPriority : null,
  }));
  ok('start map bg re-stamped HIGH by the decode gate', gate.townBgPrio === 'high', gate);
  ok('start map bg fully loaded before the game begins', gate.townBgLoaded === true, gate);
  ok('non-start backgrounds stay LOW', gate.forestStillLow === 'low', gate);

  // Enter; the streamer kicks at ~8s and streams maps LOW.
  await page.click('#menu-newgame').catch(() => {});
  await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.fill('#auth-user', 'Prio');
  await page.click('#auth-submit');
  const t0 = Date.now();
  await page.waitForFunction(() => window._lxWorldStreamed === true, null, { timeout: 25000 });
  const kickMs = Date.now() - t0;
  ok(`streamer kicks AFTER the start map settles (~8s; got ${Math.round(kickMs / 100) / 10}s)`, kickMs >= 6000, { kickMs });

  // fx sweep is paced, not a burst: shortly after kick only a fraction of the
  // proj/fx sets exist; the rest trickle in on the 180ms chunks.
  const early = await page.evaluate(() => Object.keys(PROJ_ANIM_FRAMES || {}).length + Object.keys(FX_ANIM_FRAMES || {}).length);
  await sleep(4000);
  const later = await page.evaluate(() => Object.keys(PROJ_ANIM_FRAMES || {}).length + Object.keys(FX_ANIM_FRAMES || {}).length);
  ok(`fx sweep paced in chunks (early ${early} -> later ${later}, total 86)`, later > early && later >= 80, { early, later });

  // Streamer-warmed maps get LOW priority on their tracked images.
  await page.waitForFunction(() => Object.keys(window._lxMapPreloaded || {}).length >= 4, null, { timeout: 30000 }).catch(() => {});
  const low = await page.evaluate(() => {
    // any non-start bg touched by the streamer keeps/receives low
    const warmed = Object.keys(window._lxMapPreloaded || {}).filter(k => typeof MAPS !== 'undefined' && MAPS[k] && k !== 'town');
    return { warmedCount: warmed.length };
  });
  ok('streamer is running map sweep in the background', low.warmedCount >= 2, low);

  ok('no page errors', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== BOOT ASSET PRIORITY DISCIPLINE ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
