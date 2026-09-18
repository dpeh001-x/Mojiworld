// FINAL POLISH, SECOND PASS - AUDIO + FIRST HOUR (audit A10, A6, F10, B9; per user "continue working on bugs and final
// polish touches"). The game falls silent while its window is in the background (a setting, on by default) and comes back
// at the player's own mute state; an arena's own track speeds up when its boss is under a third; the death screen says
// what you keep; Legosaurus and the Master Conductor get their intro cards.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/polish_audio_hour_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11216';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof triggerDeath === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 80; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { audio.muted = false; if (!audio.ctx && audio.init) audio.init(); } catch (e) {}
    loadMap('forest', 300); await sleep(2500); try { closeAllModals(); } catch (e) {}
    // A10 - blur / focus, with the setting on and off
    const els = () => [typeof _bgmActiveMapEl !== 'undefined' ? _bgmActiveMapEl : null, typeof _bgmEl !== 'undefined' ? _bgmEl : null].filter(Boolean);
    const snap = () => ({ muted: els().map((e) => e.muted), ctx: audio.ctx ? audio.ctx.state : null });
    out.bgRow = !!document.getElementById('set-bgmute') && document.getElementById('set-bgmute').classList.contains('on');
    window.dispatchEvent(new Event('blur')); await sleep(80); out.blurred = snap();
    window.dispatchEvent(new Event('focus')); await sleep(80); out.focused = snap();
    out.savedMute = !!(_lxGetSettings() || {}).mute;
    const st = _lxGetSettings(); st.bgMute = false; _lxSaveSettings(st);
    window.dispatchEvent(new Event('blur')); await sleep(80); out.blurredOff = snap();
    window.dispatchEvent(new Event('focus')); await sleep(80);
    st.bgMute = true; _lxSaveSettings(st);
    try { if (typeof _lxAutoResume === 'function') _lxAutoResume(false); } catch (e) {}
    game.paused = false;
    // A6 - an arena with its own track: the boss under a third speeds it up, back to full puts it back
    loadMap('krookThrone', 300); await sleep(2500); try { closeAllModals(); } catch (e) {} game.paused = false;
    let boss = game.monsters.find((m) => m && m.isBoss);
    if (!boss) { spawnMonster(player.x + 400, player.y - 100, 'kingKrook', true, false); boss = game.monsters[game.monsters.length - 1]; }
    boss.invulnerable = 1e9; player.invulnerable = 1e9; player.hp = player.maxHp = 1e9;
    const arenaEl = typeof _bgmActiveMapEl !== 'undefined' ? _bgmActiveMapEl : null;
    out.arenaTrack = arenaEl ? decodeURIComponent(arenaEl.src).split('/').pop() : null;
    boss.currentHp = Math.floor(boss.maxHp * 0.2); for (let w = 0; w < 4000 && arenaEl && !(arenaEl.playbackRate > 1.05); w += 100) await sleep(100); out.rateLow = arenaEl ? arenaEl.playbackRate : null;
    boss.currentHp = boss.maxHp; for (let w = 0; w < 4000 && arenaEl && arenaEl.playbackRate !== 1; w += 100) await sleep(100); out.rateFull = arenaEl ? arenaEl.playbackRate : null;
    // B9 - the two hook-spawned bosses' cards
    const intros = []; const _pbi = window._playBossIntro; window._playBossIntro = function (t) { intros.push(t); return _pbi.apply(this, arguments); };
    MAPS.blockland_apex._blocklandFinalBoss = true; loadMap('blockland_apex', 300); await sleep(1600);
    player._pqFinaleBossPending = true; if (game.bossDefeated) game.bossDefeated.clockworkExpress = false; loadMap('clockworkExpress', 100); await sleep(1200);
    window._playBossIntro = _pbi; out.intros = intros.slice();
    try { closeAllModals(); } catch (e) {}
    // F10 - the death screen
    game.monsters.length = 0; player.invulnerable = 0; loadMap('forest', 300); await sleep(1200); try { closeAllModals(); } catch (e) {}
    player.hp = 0; triggerDeath(); await sleep(300);
    const ov = document.getElementById('death-overlay');
    out.death = { kicker: (ov.querySelector('.death-kicker') || {}).textContent, sub: (document.getElementById('death-sub') || {}).textContent };
    return out;
  });
  check(r.bgRow, 'Settings has "Mute in Background", on by default', J(r.bgRow));
  check(r.blurred.muted.length > 0 && r.blurred.muted.every(Boolean) && r.blurred.ctx !== 'running', 'losing the window mutes the music and suspends the synth', J(r.blurred));
  check(r.focused.muted.every((m) => !m) && r.focused.ctx === 'running' && !r.savedMute, '...and getting it back restores them, without saving a mute', J({ f: r.focused, saved: r.savedMute }));
  check(r.blurredOff.muted.every((m) => !m), 'with the setting off, the music keeps playing in the background', J(r.blurredOff));
  check(r.arenaTrack && r.rateLow > 1.05 && r.rateFull === 1, 'an arena\'s own track (King Krook) speeds up under a third and settles back', J({ track: r.arenaTrack, low: r.rateLow, full: r.rateFull }));
  check(r.intros.includes('legosaurus') && r.intros.includes('pqConductor'), 'Legosaurus and the Master Conductor get their intro cards', J(r.intros));
  check(/down, not out/.test(r.death.kicker || '') && /keep your level, your gear and your quests/.test(r.death.sub || ''), 'the death screen says what you keep, not "the end of your journey"', J(r.death));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
