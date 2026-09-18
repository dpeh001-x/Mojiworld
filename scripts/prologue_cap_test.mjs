// PROLOGUE CAP (v0.30.863, per user "the prologue has a 120 s cap; fix this"): a player reading a stanza card is never
// cut off; a real stall still ends the prologue; a forced finish leaves no cinematic cover up and opens no later scene.
// The old cap is a 120 s setTimeout, so the harness scales any timer >= 100 s down to 5 s to show it firing; the new
// watchdog's stall window is shrunk to 4 s through its own knob, once the fight is armed.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/prologue_cap_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11169';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const COVERS = ['prologue-cine', 'prologue-dagger-cine', 'gravitos-entry-cine', 'prologue-punch-cine', 'prologue-void-cine'];
async function freshPrologue() {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage(); page._errs = []; page.on('pageerror', (e) => page._errs.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { return st.call(window, fn, (+ms >= 100000) ? 5000 : ms, ...a); }; });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 180000 });
  await page.click('#menu-newgame').catch(() => {}); await page.waitForSelector('#auth-user', { state: 'visible', timeout: 15000 }).catch(() => {});
  await page.fill('#auth-user', 'Capper'); await page.click('#auth-submit');
  await page.waitForFunction(() => { const c = document.getElementById('class-select-modal'); return c && getComputedStyle(c).display !== 'none'; }, null, { timeout: 30000 });
  await page.evaluate(() => { applyClass('warrior'); });
  await page.waitForFunction(() => !!(document.getElementById('prologue-cine') || document.getElementById('prologue-dagger-cine')), null, { timeout: 15000 });
  if (await page.evaluate(() => !!document.getElementById('prologue-dagger-cine'))) { await page.keyboard.press('Enter'); await page.waitForTimeout(500); }
  return page;
}
const covers = (page) => page.evaluate((ids) => ids.filter((id) => document.getElementById(id)), COVERS);
const toFight = async (page) => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(450); }
  for (let i = 0; i < 60; i++) { const s = await page.evaluate(() => ({ armed: !!window._prologueTimer, active: !!window._prologueActive, entry: !!document.getElementById('grav-entry-skip') }));
    if (!s.active || s.armed) return s; if (s.entry) await page.click('#grav-entry-skip').catch(() => {}); await page.waitForTimeout(500); }
  return { armed: false, active: true, timeout: true }; };
try {
  // ---- run 1: a reader on the first card, then a forced finish during the knockdown clip ----
  const p1 = await freshPrologue();
  const onCard = await p1.evaluate(() => ({ active: !!window._prologueActive, card: !!document.getElementById('prologue-cine') }));
  await p1.waitForTimeout(9000);
  const read = await p1.evaluate(() => ({ active: !!window._prologueActive, card: !!document.getElementById('prologue-cine') }));
  check(onCard.card && read.active && read.card, 'a player reading a stanza card for 9 s keeps the prologue (was: the scaled 120 s cap ended it)', J({ onCard, read }));
  const armed = read.active ? await toFight(p1) : { active: false };
  let forced = { skipped: true };
  if (armed.active && armed.armed) {
    await p1.evaluate(() => { window.__seen = new Set(); new MutationObserver(() => { for (const id of ['prologue-cine', 'prologue-void-cine', 'prologue-punch-cine']) if (document.getElementById(id)) window.__seen.add(id); }).observe(document.body, { childList: true }); _prologueStrip(); });
    await p1.waitForFunction(() => !!document.getElementById('prologue-punch-cine'), null, { timeout: 8000 }).catch(() => {});
    const before = await covers(p1);
    await p1.evaluate(() => { window.__seen.clear(); if (typeof _lxPlgForceFinish === 'function') _lxPlgForceFinish('test'); else _prologueFinish(true); });
    await p1.waitForTimeout(12000);
    forced = { before, after: await covers(p1), openedLater: await p1.evaluate(() => [...window.__seen]), active: await p1.evaluate(() => !!window._prologueActive) };
  }
  check(!forced.skipped && forced.before.includes('prologue-punch-cine') && forced.after.length === 0 && forced.openedLater.length === 0 && !forced.active,
    'a forced finish mid-clip removes the cover, and the Void clip and the last card never open afterwards', J({ armed, forced }));
  check(p1._errs.length === 0, 'no page errors (run 1)', J(p1._errs.slice(0, 3)));
  await p1.context().close();

  // ---- run 2: a real stall in the fight still ends the prologue, cleanly ----
  const p2 = await freshPrologue(); const a2 = await toFight(p2);
  let stall = { skipped: true };
  if (a2.active && a2.armed) {
    await p2.evaluate(() => { try { if (typeof LX_PLG_STALL_MS !== 'undefined') LX_PLG_STALL_MS = 4000; } catch (e) {} clearInterval(window._prologueTimer); window._prologueTimer = null; });   // the fight clock stops: nothing moves (the stall window shrunk to 4 s for the test, only now - the lead-in keeps the real 45 s)
    await p2.waitForTimeout(3000); const mid = await p2.evaluate(() => !!window._prologueActive);
    await p2.waitForTimeout(6000);
    stall = { midActive: mid, active: await p2.evaluate(() => !!window._prologueActive), covers: await covers(p2), map: await p2.evaluate(() => game.currentMap) };
  }
  check(!stall.skipped && stall.midActive && !stall.active && stall.covers.length === 0 && stall.map === 'void', 'a stalled fight is ended by the watchdog (not before its window), with no cover left, back in the Void', J({ a2, stall }));
  check(p2._errs.length === 0, 'no page errors (run 2)', J(p2._errs.slice(0, 3)));
  await p2.context().close();
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
