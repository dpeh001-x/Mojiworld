// AUDIO, TOASTS, STEAM STATS (v0.30.920 bug audit, recent-commit review). Driven in the game:
// a suspended synth scheduled every cue at its frozen clock and they burst together on return; mute, switch away and
// back, unmute left the synth dead; a toast waiting for a slot was drawn under a story scene and timed out unread; the
// Muted / Unmuted toasts deduped to a stale state; Steam stats (one push a minute) lost their last minute on quit.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/audio_guard_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11314';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const boot = async (page) => { await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 }); };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    window._stubStats = 0; window.SteamAPI = { available: true, stats: { set: async () => { window._stubStats++; return true; } }, achievement: { unlock: async () => true },
      cloud: { read: async () => null, write: async () => true, writeSync: () => true }, presence: { set: async () => true, clear: async () => true } }; });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
  await page.evaluate(() => { try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._tutorialSeen = true; audio.init(); audio.muted = false; });
  const wait = (ms) => page.waitForTimeout(ms);
  // 1. a suspended synth builds nothing
  const r1 = await page.evaluate(async () => { await audio.ctx.resume(); await audio.ctx.suspend(); let n = 0; const orig = audio.ctx.createOscillator.bind(audio.ctx);
    audio.ctx.createOscillator = () => { n++; return orig(); }; audio.play('crit'); audio.play('death'); audio.ctx.createOscillator = orig; const st = audio.ctx.state; await audio.ctx.resume(); return { st, n }; });
  check(r1.st === 'suspended' && r1.n === 0, 'a suspended synth schedules nothing (no burst on return)', J(r1));
  // 2. mute, background, foreground, unmute: the synth runs
  const r2 = await page.evaluate(async () => { await audio.ctx.resume(); audio.toggleMute(); _lxBackgroundMute(true); await new Promise((r) => setTimeout(r, 100));
    _lxBackgroundMute(false); audio.toggleMute(); await new Promise((r) => setTimeout(r, 200)); return { muted: audio.muted, st: audio.ctx.state }; });
  check(!r2.muted && r2.st === 'running', 'mute, switch away and back, unmute: the synth is running again', J(r2));
  // 3. the Muted / Unmuted toast shows the state you are in
  const r3 = await page.evaluate(async () => { document.querySelectorAll('#toast-container .toast').forEach((t) => t.remove());
    audio.toggleMute(); audio.toggleMute(); audio.toggleMute(); const live = [...document.querySelectorAll('#toast-container .toast')].map((t) => t._lxTxt).filter((t) => /Muted|Unmuted/.test(t || ''));
    const muted = audio.muted; const dbg = { story: _lxStoryUp(), wait: _lxToastWait.map((w) => w.txt), q: _lxToastQueue.map((x) => x[0]), kids: [...document.querySelectorAll('#toast-container > *')].map((t) => t.textContent.slice(0, 30)) }; audio.toggleMute(); return { muted, live, dbg }; });
  const pend = r3.live.concat(r3.dbg.q.filter((x) => /Muted|Unmuted/.test(x || '')), r3.dbg.wait.filter((x) => /Muted|Unmuted/.test(x || '')));
  check(r3.muted && pend.length === 1 && pend[0] === '🔇 Muted', 'three presses of M leave one toast (shown, or held under a story scene), and it says Muted', J(r3));
  // 4. a waiting toast is not drawn under a story scene
  const r4 = await page.evaluate(async () => { document.querySelectorAll('#toast-container .toast').forEach((t) => t.remove());
    let sb = document.getElementById('story-beat-overlay'); const made = !sb; if (!sb) { sb = document.createElement('div'); sb.id = 'story-beat-overlay'; document.body.appendChild(sb); }
    sb.classList.add('on'); _lxToastWait.push({ txt: 'waited toast', rarity: 'rare', at: performance.now() }); _lxToastDrain();
    const under = [...document.querySelectorAll('#toast-container .toast')].some((t) => t._lxTxt === 'waited toast');
    sb.classList.remove('on'); if (made) sb.remove(); await new Promise((r) => setTimeout(r, 900));
    const after = [...document.querySelectorAll('#toast-container .toast')].some((t) => t._lxTxt === 'waited toast'); return { under, after }; });
  check(!r4.under && r4.after, 'a toast waiting for a slot waits out a story scene, then shows', J(r4));
  // 5. the last minute of Steam stats goes out on quit
  const r5 = await page.evaluate(async () => { window._stubStats = 0; _lxSteamStatsAt = 0; _lxSteamPushStats(); _lxSteamPushStats(); const throttled = window._stubStats;
    window.dispatchEvent(new Event('beforeunload')); await new Promise((r) => setTimeout(r, 100)); return { throttled, onQuit: window._stubStats - throttled }; });
  check(r5.throttled === 1 && r5.onQuit === 1, 'stats stay throttled in play and are pushed once more on quit', J(r5));
  // 6. Boss Rush: leave and come straight back, one boss
  const r6 = await page.evaluate(async () => { game.mojidexSeen = game.mojidexSeen || {}; game.mojidexSeen.king = 1; game.bossDefeated = game.bossDefeated || {}; game.bossDefeated.king = true;
    loadMap('boss_rush', 300); _bossRushAutoStart(); loadMap('town', 400); loadMap('boss_rush', 300); _bossRushAutoStart();
    await new Promise((r) => setTimeout(r, 3200));
    for (let i = 0; i < 6; i++) { try { closeAllModals(); } catch (e) {} game.paused = false; await new Promise((r) => setTimeout(r, 500)); }   // the first boss's intro pauses; a stale timer waits behind it
    const n =game.monsters.filter((x) => x && x._rushBoss && x.currentHp > 0).length; loadMap('town', 400); return { n }; });
  check(r6.n === 1, 'a quick leave and return to the Boss Rush hall spawns one boss', J(r6));
  // 7. the red edge is for hits, not a lower max HP
  const r7 = await page.evaluate(async () => { player.hp = getMaxHp(); updateUI(); await new Promise((r) => setTimeout(r, 50)); updateUI(); game._lxHurtA = 0;
    const mx = getMaxHp(); player.maxHp = Math.floor(player.maxHp * 0.6); if (typeof invalidateEquipBonusCache === 'function') invalidateEquipBonusCache(); player.hp = Math.min(player.hp, getMaxHp());
    updateUI(); const clamp = game._lxHurtA || 0; player.hp = Math.floor(player.hp * 0.5); updateUI(); const hit = game._lxHurtA || 0; return { mx, now: getMaxHp(), clamp, hit }; });
  check(r7.now < r7.mx && r7.clamp === 0 && r7.hit > 0, 'a lower max HP draws no hurt edge; a real drop still does', J(r7));
  // 8. the footstep lets go of its nodes
  const r8 = await page.evaluate(async () => { await audio.ctx.resume(); let src = null; const orig = audio.ctx.createBufferSource.bind(audio.ctx);
    audio.ctx.createBufferSource = () => (src = orig()); try { _lxSurfaceStep(1); } catch (e) {} audio.ctx.createBufferSource = orig; return { made: !!src, cleans: !!(src && typeof src.onended === 'function') }; });
  check(!r8.made || r8.cleans, 'a footstep disconnects its nodes when it ends', J(r8));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
