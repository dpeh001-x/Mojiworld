// v0.30.x — Audio findings from the audit backlog.
//   node scripts/audio_paths_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11303);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Aud');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const out = {};
  // F2: two maps that share an ambient file share the element
  const byFile = {};
  for (const k in _AMBIENT_FILES) (byFile[_AMBIENT_FILES[k]] = byFile[_AMBIENT_FILES[k]] || []).push(k);
  const pair = Object.values(byFile).find((v) => v.length >= 2);
  out.pair = pair ? pair.slice(0, 2) : null;
  const a = pair ? _ambientEl(pair[0]) : null, b = pair ? _ambientEl(pair[1]) : null;
  out.ambientShared = !!(a && b && a === b);
  // F1: the mute sync reaches the ambient bed, the cinematic bed and a boss stinger
  const stinger = (typeof _bossSfxEl === 'function') ? _bossSfxEl('gravitos') : null;
  const wasMuted = audio.muted;
  _lxSyncSfxMuted(true);
  out.muteAmbient = a ? a.muted === true : null;
  out.muteCine = (typeof _cineBgm !== 'undefined') ? _cineBgm.muted === true : null;
  out.muteStinger = stinger ? stinger.muted === true : null;
  _lxSyncSfxMuted(false);
  out.unmuteAmbient = a ? a.muted === false : null;
  _lxSyncSfxMuted(!!wasMuted);
  // F3: the switchboard has the four missing branches
  const src = audio.play.toString();
  out.branches = ['hit_heavy', 'quake_hit', 'charge', 'void'].filter((k) => src.includes("kind === '" + k + "'"));
  out.hiddenGate = src.includes('document.hidden');
  out.hiddenGateMon = (typeof _playMonsterSfx === 'function') && _playMonsterSfx.toString().includes('document.hidden');
  out.hiddenGateBoss = (typeof _playBossSfx === 'function') && _playBossSfx.toString().includes('document.hidden');
  // F4 / F5: the unmapped ids
  out.tick = !!_UI_SFX_FILES.tick;
  out.lego = !!_BOSS_SFX_FILES.legosaurus;
  // F6: the probe cap
  out.cap = (typeof _MONSTER_CUSTOM_SFX_CAP === 'number') ? _MONSTER_CUSTOM_SFX_CAP : null;
  // F8: the unlock waits for a successful play
  out.unlock = (typeof startBgm === 'function') && startBgm.toString().includes('_okP.then(_done)');
  return out;
});
console.log(JSON.stringify(r));
const checks = [
  ['maps that share an ambient file share the element', r.ambientShared === true, String(r.pair)],
  ['the mute sync reaches the ambient bed', r.muteAmbient === true && r.unmuteAmbient === true],
  ['the mute sync reaches the cinematic bed', r.muteCine === true],
  ['the mute sync reaches the boss stingers', r.muteStinger === true],
  ['hit_heavy / quake_hit / charge / void have branches', r.branches.length === 4, r.branches.join(',')],
  ['no cues in a hidden tab (switchboard, monsters, bosses)', r.hiddenGate && r.hiddenGateMon && r.hiddenGateBoss],
  ["Bravo's tray tick is mapped", r.tick === true],
  ['the Legosaurus arena has a stinger', r.lego === true],
  ['the per-monster probe cache is capped', r.cap != null && r.cap > 0, String(r.cap)],
  ['the BGM unlock waits for a successful play', r.unlock === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
