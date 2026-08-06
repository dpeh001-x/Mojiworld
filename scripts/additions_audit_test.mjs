// Adversarial audit of the additions from this session: entity shadows
// (v0.29.420), co-op banner / relay / invite (v0.29.423-426), graphics presets
// (v0.29.431). Written to FIND bugs, not to confirm the happy paths the
// feature tests already cover.
//
//   node serve.js 8819 && node scripts/additions_audit_test.mjs 8819
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8819';
// Second arg picks the page, so this can audit a copy of the PUSHED tree
// rather than the working copy:
//   git show origin/main:mojiworld_game.html > _tmp_pushed.html
//   node scripts/additions_audit_test.mjs 8819 _tmp_pushed.html
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('LX_GFX') === 'object' && typeof eval('_mpBanner') === 'function' && typeof eval('_lxDrawBlobShadow') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

// === 1. Custom preset must not silently drop the perf tier ==================
const custom = await page.evaluate(() => {
  const P = eval('LX_PERF');
  const sel = document.getElementById('set-gfx');
  eval('openSettingsModal')();
  sel.value = 'low'; eval('_lxGfxPresetChanged')(); eval('applySettingsLive')();
  const atLow = { lowFx: P.lowFx, veryLowFx: P.veryLowFx };
  // Player keeps Low but wants damage numbers off -> becomes Custom.
  document.getElementById('set-fx-dmgnum').classList.toggle('on');
  eval('_lxGfxSwitchChanged')(); eval('applySettingsLive')();
  const afterTweak = { preset: sel.value, lowFx: P.lowFx, veryLowFx: P.veryLowFx };
  return { atLow, afterTweak };
});
ok('Low engages both tiers', custom.atLow.lowFx && custom.atLow.veryLowFx, custom.atLow);
ok('tweaking ONE effect from Low keeps the perf tiers (does not silently un-optimise)',
   custom.afterTweak.preset === 'custom' && custom.afterTweak.lowFx === true && custom.afterTweak.veryLowFx === true,
   custom.afterTweak);

// === 2. Auto-reconnect must not spam the failure banner =====================
const spam = await page.evaluate(() => {
  const N = eval('net');            // not `net` â€” see the TDZ note in coop_e2e
  let shown = 0;
  const el = document.getElementById('mp-banner') || (eval('_mpBanner')('x', 'work', {}), document.getElementById('mp-banner'));
  const obs = new MutationObserver(() => { if (el.style.display !== 'none') shown++; });
  obs.observe(el, { attributes: true, childList: true, subtree: true });
  eval('_mpBannerDismiss')();
  // Simulate an outage: five consecutive auto-reconnect failures.
  N._reconnectTries = 3;                 // we are mid-backoff, not a fresh join
  for (let i = 0; i < 5; i++) {
    N._reconnectTries++;
    eval('_mpBanner')('Could not join that party - the server refused the connection.', 'bad', { retry: () => {} });
  }
  obs.disconnect();
  const visible = el.style.display !== 'none';
  const dismissible = [...el.querySelectorAll('button')].some(x => x.title === 'Dismiss');
  eval('_mpBannerDismiss')();
  return { visible, dismissible };
});
ok('a failure banner is always dismissible (never traps the player)', spam.dismissible === true, spam);

// Reconnect retries forever, so a dismissed outage banner must STAY dismissed.
const mute = await page.evaluate(() => {
  const el = () => document.getElementById('mp-banner');
  eval('_mpBanner')('Could not reach the party server.', 'bad', { retry: () => {} });
  const shownFirst = el().style.display !== 'none';
  [...el().querySelectorAll('button')].find(x => x.title === 'Dismiss').click();   // player dismisses
  const hidden = el().style.display === 'none';
  for (let i = 0; i < 6; i++) eval('_mpBanner')('Could not reach the party server.', 'bad', { retry: () => {} });
  const stayedHidden = el().style.display === 'none';
  // A SUCCESS must still be allowed through, and must un-mute.
  eval('_mpBanner')('In party TESTME - share the code', 'good', { autoHide: 30000 });
  const goodShown = el().style.display !== 'none';
  eval('_mpBannerDismiss')();                       // auto-hide style, not the player
  eval('_mpBanner')('Joining party TESTME...', 'work', { dismiss: false });
  const worksAgain = el().style.display !== 'none';
  eval('_mpBannerDismiss')();
  return { shownFirst, hidden, stayedHidden, goodShown, worksAgain };
});
ok('dismissing an outage banner survives repeated reconnect failures',
   mute.shownFirst && mute.hidden && mute.stayedHidden, mute);
ok('a successful connect still breaks through, and un-mutes',
   mute.goodShown && mute.worksAgain, mute);

// === 3. Banner must not swallow clicks meant for the game ===================
const clicks = await page.evaluate(() => {
  eval('_mpBannerMuted = false');   // the mute test above dismissed one; start clean
  eval('_mpBanner')('Joining party TESTME...', 'work', { dismiss: false });
  const el = document.getElementById('mp-banner');
  const r = el.getBoundingClientRect();
  const hitInside = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  eval('_mpBannerDismiss')();
  const hitAfter = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    ownsItsOwnBox: !!(hitInside && (hitInside === el || el.contains(hitInside))),
    releasesWhenHidden: !!(hitAfter && hitAfter !== el && !el.contains(hitAfter)),
    display: el.style.display,
  };
});
ok('banner is interactive while shown (its buttons are clickable)', clicks.ownsItsOwnBox, clicks);
ok('banner stops intercepting input once dismissed', clicks.releasesWhenHidden, clicks);

// === 4. Shadow ground-lookup cost is bounded ================================
const shadowPerf = await page.evaluate(() => {
  const g = eval('game');
  const saved = g.mapData;
  const plats = [];
  for (let i = 0; i < 220; i++) plats.push({ x: i * 60, y: 400 + (i % 5) * 30, w: 55, h: 12 });
  g.mapData = { platforms: plats, worldWidth: 14000 };
  const below = eval('_lxGroundBelow');
  const N = 70 * 60;                        // 70 monsters, 60 frames
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < N; i++) { const r = below((i * 37) % 13000, 28, 350); if (r !== null) acc++; }
  const ms = performance.now() - t0;
  g.mapData = saved;
  return { ms: +ms.toFixed(2), perCall: +(ms / N * 1000).toFixed(2), hits: acc, plats: plats.length };
});
ok('ground lookup stays cheap at 70 entities x 60 frames on a 220-platform map',
   shadowPerf.ms < 60, shadowPerf);

// === 5. Corrupt / hostile settings must not brick the panel =================
const corrupt = await page.evaluate(() => {
  const before = localStorage.getItem('LX_SETTINGS');
  const out = {};
  for (const bad of ['{"gfx":12345}', '{"gfx":"nonsense"}', '{"gfx":null,"fxWeather":"yes"}', '{']) {
    localStorage.setItem('LX_SETTINGS', bad);
    try { eval('openSettingsModal')(); eval('applySettingsLive')(); out[bad] = 'ok'; }
    catch (e) { out[bad] = 'THREW: ' + e.message; }
  }
  if (before) localStorage.setItem('LX_SETTINGS', before); else localStorage.removeItem('LX_SETTINGS');
  eval('openSettingsModal')(); eval('applySettingsLive')();
  return out;
});
ok('a corrupt/unknown gfx value never throws in Settings',
   Object.values(corrupt).every(v => v === 'ok'), corrupt);

// === 6. Reset-to-defaults must cover the new keys ===========================
const reset = await page.evaluate(() => {
  const D = eval('LX_SETTINGS_DEFAULTS');
  return {
    hasGfx: 'gfx' in D, hasWeather: 'fxWeather' in D, hasAmbient: 'fxAmbient' in D,
    hasShadows: 'fxShadows' in D, hasDmg: 'fxDmgNum' in D, gfxValue: D.gfx,
    presetExists: !!eval('LX_GFX_PRESETS')[D.gfx],
  };
});
ok('the new keys are in LX_SETTINGS_DEFAULTS (so Reset restores them)',
   reset.hasGfx && reset.hasWeather && reset.hasAmbient && reset.hasShadows && reset.hasDmg, reset);
ok('the default preset name resolves to a real preset', reset.presetExists && reset.gfxValue === 'high', reset);

// === 7. Web ?join= must not double-fire with the Steam path =================
// The guard belongs at the two BOOT call sites, not inside the shared parser:
// SteamAPI.onJoin must still be able to move the player to a different friend's
// party mid-session. An earlier cut of this check asserted the parser itself
// early-returns, which would have been the wrong fix.
const dbl = await page.evaluate(() => {
  const web = eval('_lxWebTryAutoJoin').toString();
  const html = document.documentElement.innerHTML;
  return {
    webGuarded: /if\s*\(\s*_lxSteamJoinDone\s*\)\s*return/.test(web),
    parserStillReRunnable: !/if\s*\(\s*_lxSteamJoinDone\s*\)\s*return/.test(eval('_lxSteamTryAutoJoin').toString()),
    setsDoneFlag: /_lxSteamJoinDone\s*=\s*true/.test(eval('_lxSteamTryAutoJoin').toString()),
  };
});
ok('the web ?join= boot path will not run after another boot join already did', dbl.webGuarded === true, dbl);
ok('the shared parser stays re-runnable so friend invites still work mid-session',
   dbl.parserStillReRunnable === true && dbl.setsDoneFlag === true, dbl);
const bootGuard = await page.evaluate(() => {
  // The Steam boot timer must consult the same flag.
  const src = [...document.querySelectorAll('script')].map(x => x.textContent).join('\n');
  return /if\s*\(!_lxSteamJoinDone\)\s*_lxSteamTryAutoJoin\(\);/.test(src);
});
ok('the Steam boot timer checks the flag too', bootGuard === true);

// === 8. Shadows: no shadow drawn for an entity in a bottomless pit ==========
const pit = await page.evaluate(() => {
  const g = eval('game'); const saved = g.mapData;
  g.mapData = { platforms: [{ x: 0, y: 500, w: 200, h: 20 }], worldWidth: 2000 };
  const CTX = eval('ctx'); let n = 0;
  const o = CTX.ellipse; CTX.ellipse = function () { n++; };
  try { eval('_lxDrawBlobShadow')(900, 300, 300, 880, 28); } catch (e) {}
  CTX.ellipse = o; g.mapData = saved;
  return n;
});
ok('no shadow is painted over a pit (nothing to cast onto)', pit === 0, { ellipses: pit });

// === 9. The Custom tier must also survive a RELOAD ==========================
// The live case is checked above; this is the half that depends on gfxBase
// being persisted, not just held in a module variable.
await page.evaluate(() => {
  eval('openSettingsModal')();
  const sel = document.getElementById('set-gfx');
  sel.value = 'low'; eval('_lxGfxPresetChanged')(); eval('applySettingsLive')();
  document.getElementById('set-fx-dmgnum').classList.toggle('on');   // -> Custom
  eval('_lxGfxSwitchChanged')(); eval('applySettingsLive')();
});
const page2 = await (await b.contexts()[0]).newPage();
await page2.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => { try { return typeof eval('applySettingsLive') === 'function' && typeof eval('LX_PERF') === 'object'; } catch { return false; } }, null, { timeout: 180000 });
const afterReload = await page2.evaluate(async () => {
  await new Promise(r => setTimeout(r, 400));      // let the 100ms boot apply run
  const st = JSON.parse(localStorage.getItem('LX_SETTINGS') || '{}');
  return { gfx: st.gfx, base: st.gfxBase, dmg: st.fxDmgNum,
           lowFx: eval('LX_PERF').lowFx, veryLowFx: eval('LX_PERF').veryLowFx };
});
ok('a Custom set-up persists its tier source', afterReload.gfx === 'custom' && afterReload.base === 'low', afterReload);
ok('and still holds BOTH tiers after a reload', afterReload.lowFx === true && afterReload.veryLowFx === true, afterReload);
ok('while keeping the effect the player switched off', afterReload.dmg === false, afterReload);

ok('no page errors during the whole audit', errs.length === 0, errs.slice(0, 4));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} audit checks passed`);
process.exit(fail ? 1 : 0);

