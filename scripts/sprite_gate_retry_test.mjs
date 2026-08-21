// Live test: SPRITE GATE RETRY (per user: "my tester experienced unloaded
// sprites when starting the game that resolved on refresh, we MUST gate the
// start of the game to ensure sprites load prior to game start").
//
// The v0.29.735 commence gate held for PENDING sprites but waved ERRORED ones
// through ("not coming") — yet boot-burst failures are usually transient, so
// the world started with silent holes a refresh fixed. Three scenarios through
// the REAL boot (real overlay, real menu click, real gate):
//   1. transient faults: first 2 fetches of every NPC sprite are aborted →
//      the gate's retry must recover them BEFORE the world reveals
//   2. a permanent 404 must NOT hold the door (fail-open after 2 retries)
//   3. _lxSpriteHealSweep unit: retries errored, drops healthy + exhausted
//   node scripts/sprite_gate_retry_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });

const SAVE = JSON.stringify({ player: { cls: 'warrior', level: 5, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
  exp: 0, expToNext: 100, mojicoins: 0, baseAtk: 5, baseDef: 0, baseAcc: 0 }, game: { currentMap: 'town' } });
const bootTo = async (ctx, label, errs) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(label + ': ' + String(e).slice(0, 120)));
  await page.addInitScript((sv) => { try { localStorage.setItem('levelx_save_v1', sv); localStorage.setItem('levelx_mp_name', 'Tester'); } catch (e) {} }, SAVE);
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#menu-continue', { state: 'visible', timeout: 120000 });
  return page;
};
const gateRun = async (page) => {
  await page.click('#menu-continue');
  // the overlay must eventually fade; capture how the gate released
  await page.waitForFunction(() => {
    const o = document.getElementById('loading-overlay');
    return !o || o.classList.contains('fade') || o.style.display === 'none';
  }, null, { timeout: 150000 });
  // let the fade finish and boot settle before sampling pause state —
  // fade-add time still has the menu's own pause legitimately in place
  await page.waitForTimeout(4000);
  return page.evaluate(() => {
    // brokenness lives on the WATCHED images (NPC_SPRITES only registers
    // successes, so a failed NPC never appears there at all)
    const watch = window._lxSpriteWatch || [];
    let broken = 0, brokenRetryable = 0;
    for (const im of watch) {
      if (im && im.src && im.complete && !im.naturalWidth) {
        broken++;
        if ((im._lxRetries | 0) < 2) brokenRetryable++;
      }
    }
    let npcTotal = 0; try { npcTotal = Object.keys(NPC_SPRITES).length; } catch (e) {}
    const has = (frag) => watch.some(im => im && im.src && im.src.indexOf(frag) >= 0);
    const brokenSrcs = watch.filter(im => im && im.src && im.complete && !im.naturalWidth)
      .map(im => im.src.split('/').slice(-2).join('/')).slice(0, 6);
    return {
      brokenSrcs,
      coversBg: has('/backgrounds/'), coversUi: has('/Sprites/ui/'),
      coversSkills: has('/Sprites/skills/'), coversNpc: has('/Sprites/npc/'),
      gateDone: !!window._lxSpriteGateDone,
      paused: (typeof game !== 'undefined') ? game.paused : null,
      // the gate's OWN pause bookkeeping: it must never still own a pause
      // after release (a story beat may legitimately pause the game, so
      // game.paused itself is not the invariant)
      gateOwnsPause: !!window._lxSpriteGatePausedByUs,
      keysLatched: (() => { try { for (const k in game.keys) if (game.keys[k]) return true; } catch (e) {} return false; })(),
      healArmed: !!window._lxSpriteHealIv || !watch.length,
      watchLen: watch.length, broken, brokenRetryable, npcTotal,
    };
  });
};

const errs = [];
// ---- 1: transient faults recovered by the gate ----
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const hits = new Map(); let aborted = 0;
  // per user this is not just NPC sprites: backgrounds and icons fault too
  const faultFirst2 = (route) => {
    const u = route.request().url(); const n = (hits.get(u) || 0) + 1; hits.set(u, n);
    if (n <= 2) { aborted++; route.abort(); } else route.continue();
  };
  await ctx.route('**/Sprites/npc/*.webp', faultFirst2);
  await ctx.route('**/backgrounds/**', faultFirst2);
  await ctx.route('**/Sprites/ui/**', faultFirst2);
  await ctx.route('**/Sprites/skills/*.webp', faultFirst2);
  const page = await bootTo(ctx, 'transient', errs);
  const r = await gateRun(page);
  const faultedUrls = [...hits.values()].filter(v => v >= 2).length;
  ok('fault injected: NPC sprites were made to fail their first attempts',
    aborted >= 6 && faultedUrls >= 3, { aborted, faultedUrls });
  ok('the gate releases with the world INTACT — every faulted sprite recovered',
    r.gateDone && r.broken === 0 && r.watchLen > 300, r);
  ok('the widened watch covers backgrounds, UI icons, skill icons AND npc art',
    r.coversBg && r.coversUi && r.coversSkills && r.coversNpc,
    { bg: r.coversBg, ui: r.coversUi, skills: r.coversSkills, npc: r.coversNpc, watchLen: r.watchLen });
  ok('fault reached the new classes too (backgrounds/ui aborted, then recovered)',
    [...hits.keys()].some(u => u.indexOf('/backgrounds/') >= 0) && [...hits.keys()].some(u => u.indexOf('/Sprites/ui/') >= 0),
    { faultedBg: [...hits.keys()].filter(u => u.indexOf('/backgrounds/') >= 0).length,
      faultedUi: [...hits.keys()].filter(u => u.indexOf('/Sprites/ui/') >= 0).length });
  ok('the gate no longer owns a pause and no keys are latched after release',
    !r.gateOwnsPause && !r.keysLatched, { gateOwnsPause: r.gateOwnsPause, keysLatched: r.keysLatched, paused: r.paused });
  ok('the post-boot self-heal is armed', r.healArmed, { healArmed: r.healArmed });
  await ctx.close();
}
// ---- 2: a permanent 404 must not hold the door ----
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  // the WATCH carries the npc idle FRAMES (the base file has its own
  // draw-time self-heal via _lxLoadNpcSpriteInto) — so the dead file must be
  // a watched one for this scenario to mean anything
  await ctx.route('**/Sprites/npc/idle/Guguma_0.webp', (route) => route.abort());   // never loads
  const page = await bootTo(ctx, 'permanent', errs);
  const t0 = Date.now();
  const r = await gateRun(page);
  const heldMs = Date.now() - t0;
  const gug = await page.evaluate(() => {
    for (const im of (window._lxSpriteWatch || []))
      if (im && im.src && im.src.indexOf('/npc/idle/Guguma_0') >= 0)
        return { retries: im._lxRetries | 0, broken: im.complete && !im.naturalWidth };
    return null;
  });
  ok('FAIL-OPEN: a permanently-dead file releases the gate without the 45s stall',
    r.gateDone && heldMs < 40000, { heldMs });
  // NOT vacuous: the dead file must be found in the watch with its retries spent
  ok('...after its retries were genuinely spent', !!gug && gug.retries >= 2 && gug.broken, gug);
  await ctx.close();
}
// ---- 3: heal sweep unit, through the real function ----
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('heal: ' + String(e).slice(0, 120)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxSpriteHealSweep === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const mk = (src) => new Promise((res) => { const im = new Image();
      im.onload = () => res(im); im.onerror = () => res(im); im.src = src; });
    const healthy = await mk('Sprites/npc/Guguma.webp');
    const errored = await mk('Sprites/npc/__does_not_exist__.webp');
    const spent = await mk('Sprites/npc/__gone_forever__.webp');
    spent._lxRetries = 3;
    window._lxSpriteWatch = [healthy, errored, spent];
    const retried = _lxSpriteHealSweep();
    const after = window._lxSpriteWatch;
    return { retried, kept: after.length, keptIsErrored: after[0] === errored,
             erroredRetries: errored._lxRetries | 0 };
  });
  ok('heal sweep retries the errored image once', r.retried === 1 && r.erroredRetries === 1, r);
  ok('...keeps only it (healthy + retry-spent images leave the list)',
    r.kept === 1 && r.keptIsErrored, r);
  await ctx.close();
}
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
