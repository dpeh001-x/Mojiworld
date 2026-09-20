// THE VOLUME SLIDERS REACH THE AUDIO (v0.30.952).
//
// Two sliders and a mute, each landing somewhere different, and none of it visible in the DOM:
//   - SFX drives _SFX_MASTER_VOL, the scalar every synth cue multiplies its peak by (a v0.25.799 fix:
//     before it, only mute silenced them and the slider did nothing);
//   - BGM drives _bgmEl.volume as (bgm / 100) * 0.6, and _bgmEl is a `new Audio()` that is NEVER in
//     the document - querySelectorAll('audio') finds nothing, so a DOM-based check silently measures
//     an empty list and passes;
//   - mute is a separate property (_bgmEl.muted / audio.muted), not volume 0, so checking volume
//     alone would report that muting does nothing.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/audio_settings_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11346';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.02;
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const at = () => page.evaluate(() => ({
  sfx: (typeof _SFX_MASTER_VOL !== 'undefined') ? +Number(_SFX_MASTER_VOL).toFixed(3) : null,
  bgmVol: (typeof _bgmEl !== 'undefined' && _bgmEl) ? +Number(_bgmEl.volume).toFixed(3) : null,
  bgmMuted: (typeof _bgmEl !== 'undefined' && _bgmEl) ? !!_bgmEl.muted : null,
  synthMuted: (typeof audio !== 'undefined' && audio) ? !!audio.muted : null }));
const set = (bgm, sfx, mute) => page.evaluate(async ({ bgm, sfx, mute }) => {
  openSettingsModal(); await new Promise((r) => setTimeout(r, 200));
  const sl = (id, v) => { const e = document.getElementById(id); if (!e) return; e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  sl('set-bgm', bgm); sl('set-sfx', sfx);
  const m = document.getElementById('set-mute');
  if (m && m.classList.contains('on') !== !!mute) m.click();
  await new Promise((r) => setTimeout(r, 400));
  try { closeSettingsModal(); } catch (e) {}
  await new Promise((r) => setTimeout(r, 250));
}, { bgm, sfx, mute });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openSettingsModal === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); loadMap('town', 300); await new Promise((r) => setTimeout(r, 1800)); game.paused = false;
  });
  const probe = await at();
  check(probe.sfx !== null && probe.bgmVol !== null, 'the engine exposes both volumes to read', J(probe));
  await set(90, 70, false); const loud = await at();
  check(near(loud.sfx, 0.7), 'SFX at 70% reaches the synth cues as 0.70', 'got ' + loud.sfx);
  check(near(loud.bgmVol, 0.54), 'BGM at 90% reaches the music as 0.54  ((90/100)*0.6)', 'got ' + loud.bgmVol);
  await set(35, 25, false); const quiet = await at();
  check(near(quiet.sfx, 0.25), 'SFX at 25% follows', 'got ' + quiet.sfx);
  check(near(quiet.bgmVol, 0.21), 'BGM at 35% follows  ((35/100)*0.6)', 'got ' + quiet.bgmVol);
  await set(35, 25, true); const muted = await at();
  check(muted.bgmMuted === true && muted.synthMuted === true, 'mute silences music AND the synth cues', J({ bgm: muted.bgmMuted, synth: muted.synthMuted }));
  check(near(muted.bgmVol, 0.21), 'and does it without discarding the volume the player chose', 'bgm volume still ' + muted.bgmVol);
  await set(90, 70, false); const back = await at();
  check(back.bgmMuted === false && back.synthMuted === false && near(back.sfx, 0.7) && near(back.bgmVol, 0.54),
    'unmuting restores both at the new levels', J(back));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
