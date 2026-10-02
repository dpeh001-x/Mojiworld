// Shared harness for coop_boss_sweep_test / coop_battle_sweep_test: two real clients (host A, guest B) in one room on the local relay.
//   PORT=<p> node mp/server.mjs   (the relay also serves the game)   MOJI_GAME_FILE picks the build (basename only)
import { createRequire } from 'node:module'; import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
export const PORT = process.env.PORT || '8080';
export const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
export const URL = `http://localhost:${PORT}/${FILE}`, WS = `ws://localhost:${PORT}`;
const EXE = [process.env.PW_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => p && existsSync(p));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
// poll fn (an in-page predicate returning {ok, v}) until ok or the deadline; returns the last value
export const until = async (page, fn, a, ms = 8000) => { const t0 = Date.now(); for (;;) { const r = await page.evaluate(fn, a); if (r && r.ok) return r.v === undefined ? true : r.v; if (Date.now() - t0 > ms) return r ? (r.v === undefined ? false : r.v) : false; await sleep(120); } };
export async function boot(browser, name) {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); page._errors = []; page._name = name;
  page.on('pageerror', (e) => page._errors.push(String(e.message).slice(0, 180)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function' && typeof MAPS === 'object' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate((nm) => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true });
    if (player.look) player.look.name = nm; game.paused = false; window._god = true; player.invulnerable = 1e9; window.triggerDeath = function () {};
    window.__pump = setInterval(() => { try { if (!window.__noGod) player.invulnerable = 1e9; _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 40);
    // in-page helpers shared by both sweeps
    window.__sw = {
      live: () => (game.monsters || []).filter((m) => m && m.currentHp > 0 && !m.ally && !m.isSummon),
      snap: (m) => ({ u: m.uid, t: m.type, n: String(m.name || ''), lv: m.level | 0, hp: Math.round(m.currentHp), mx: Math.round(m.maxHp), df: Math.round(m.def || 0), at: Math.round(m.atk || 0), w: Math.round(m.w), h: Math.round(m.h), x: Math.round(m.x), y: Math.round(m.y), fl: (m.isBoss ? 1 : 0) | (m.isMiniBoss ? 2 : 0) | (m.zodiacBoss ? 4 : 0) | (m.isElite ? 8 : 0), mir: m._coopMirror ? 1 : 0, bk: m._pqBooked | 0 }),
      strip: (u) => { const m = (game.monsters || []).find((x) => x && x.uid === u); if (m) m.traits = null; return !!m; },   // no revive / explode traits: a kill test wants the monster dead and gone
      hit: (u, dmg) => { const m = (game.monsters || []).find((x) => x && x.uid === u && x.currentHp > 0); if (!m) return false; m.evasion = 0; game.comboMult = 1; game.combo = 0; player._lxSureHit = true; try { hitMonster(m, Math.max(1, Math.floor(dmg)), false, 'sweep'); } finally { player._lxSureHit = false; } return true; },
    };
  }, name);
  return page;
}
export async function launch() { return chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] }); }
export async function room(browser, tag) {
  const A = await boot(browser, 'Ann'), B = await boot(browser, 'Ben'), R = tag + Math.floor(Math.random() * 1e9).toString(36);
  for (const [p, nm] of [[A, 'Ann'], [B, 'Ben']]) { await p.evaluate(({ ws, room, nm }) => mpConnect(ws, nm, room), { ws: WS, room: R, nm }); await p.waitForFunction(() => net.myId != null, null, { timeout: 15000 }); await sleep(700); }
  await sleep(1200); return { A, B, R };
}
// both clients to a neutral town so the next map's host election starts clean
export async function reset(A, B) { for (const p of [A, B]) await p.evaluate(() => { try { loadMap('town'); } catch (e) {} }); await sleep(900); }
// the wire cost of a window on one client: frames sent / skipped by my own send budget
export const budget = (p) => p.evaluate(() => ({ s: net._budget ? net._budget.sent : 0, k: net._budget ? net._budget.skipped : 0, t: Date.now() }));
export const gained = (a, b) => b.lvl > a.lvl || (b.lvl === a.lvl && b.exp > a.exp);
export const expOf = (p) => p.evaluate(() => ({ lvl: player.level | 0, exp: player.exp || 0 }));
