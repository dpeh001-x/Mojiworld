// CROWD CONTROL HOLDS (v0.30.919 bug audit). Ways out of a stun, freeze or shackle the audit found, driven in the game:
// closing any panel (Esc, U, J, pad Start) broke a shackle for free; Up at a door walked out of one (Up is a shackle key)
// and out of a freeze; block and dash only asked about hit-stun, and the block clocks stopped under a stun, so one press
// held a parry window open for the whole of it; 29 boss deadlines ran on behind the pause menu; K opened under the pause card.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/cc_guard_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11313';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const boot = async (page) => { await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 }); };
const hero = () => {
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) { applyClass('warrior'); player.level = 30; }
  player._tutorialSeen = true; player._god = false; player.hp = getMaxHp(); player.invulnerable = 0; game.paused = false;
  player.frozenTimer = 0; player.stunTimer = 0; player.hitStun = 0; player.blockTimer = 0; player.parryWindow = 0; player.blockCD = 0;
  try { if (_QTE.active) _qteEnd(false); } catch (e) {}
};
const SHACKLE = () => _qteShackleStart({ type: 'king', x: player.x, y: player.y, w: 60, h: 60 });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
  const run = (fn) => page.evaluate(`(async () => { (${hero})(); const SHACKLE = ${SHACKLE}; ${fn} })()`);
  // 1. a shackle outlasts every panel close
  const q = await run(`SHACKLE(); const a0 = _QTE.active; closeAllModals(); const a1 = _QTE.active && player.stunTimer > 0;
    closeDialog(); const a2 = _QTE.active && player.stunTimer > 0; try { _qteEnd(false); } catch (e) {} return { a0, a1, a2 };`);
  check(q.a0 && q.a1 && q.a2, 'closing panels does not break a shackle (Esc / U / J / pad Start)', J(q));
  // 2. no door while held
  const pt = await run(`loadMap('town', 400); await new Promise((r) => setTimeout(r, 300)); const po = game.portals[0]; if (!po) return { err: 'no portal' };
    const at = () => { player.x = po.x - player.w / 2; player.y = ((typeof po.y === 'number') ? po.y : _defaultPortalY(po.x)) - player.h; };
    at(); player.frozenTimer = 2000; tryPortal(); const frozen = game.currentMap; player.frozenTimer = 0;
    if (game.currentMap !== 'town') { loadMap('town', 400); await new Promise((r) => setTimeout(r, 300)); }
    at(); SHACKLE(); tryPortal(); const shackled = game.currentMap; try { _qteEnd(false); } catch (e) {}
    if (game.currentMap !== 'town') loadMap('town', 400); return { frozen, shackled };`);
  check(pt.frozen === 'town' && pt.shackled === 'town', 'Up at a door does nothing while frozen or shackled', J(pt));
  // 3. no block and no dash while stunned
  const bl = await run(`player.stunTimer = 1500; startBlock(); const pw = player.parryWindow; const x0 = player.x; quickDash(1); const dq = player.quickDashTimer | 0;
    player.stunTimer = 0; return { pw, dq };`);
  check(!(bl.pw > 0) && !(bl.dq > 0), 'a stunned hero cannot block or dash', J(bl));
  // 4. a block pressed just before a freeze does not hold its parry window through it
  const bc = await run(`startBlock(); const pw0 = player.parryWindow; player.frozenTimer = 3000;
    for (let i = 0; i < 90; i++) updatePlayer(1000 / 60); const out = { pw0, pw: player.parryWindow, bt: player.blockTimer, cd: player.blockCD };
    player.frozenTimer = 0; return out;`);
  check(bc.pw0 > 0 && bc.pw <= 0 && bc.bt <= 0, 'the block and parry clocks keep running under a freeze', J(bc));
  // 5. boss deadlines ride the pause
  const pz = await run(`loadMap('graniteBluffs', 200); await new Promise((r) => setTimeout(r, 400)); const m = game.monsters.find((x) => x && x.currentHp > 0); if (!m) return { err: 'no mob' };
    m._cancerShellAt = (game.time | 0) + 600; m._stormAt = (game.time | 0) + 600; const s0 = m._cancerShellAt, st0 = m._stormAt, t0 = game.time;
    game.paused = true; await new Promise((r) => setTimeout(r, 1200)); game.paused = false;
    return { ran: (game.time - t0) | 0, shell: m._cancerShellAt - s0, storm: m._stormAt - st0 };`);
  check(pz.ran > 10 && pz.shell >= pz.ran - 2 && pz.storm >= pz.ran - 2, 'a paused game holds Cancer\'s shell clock and every other boss deadline', J(pz));
  // 6. K over the pause card
  const kb = await run(`loadMap('town', 400); _lxPauseOpen(); const had = !!document.getElementById('lx-pause'); toggleKeybindModal();
    const km = document.getElementById('keybind-modal'); const out = { had, pause: !!document.getElementById('lx-pause'), kb: !!(km && km.style.display === 'flex') };
    try { closeAllModals(); } catch (e) {} return out;`);
  check(kb.had && !kb.pause && kb.kb, 'K on the pause card opens the keybinds on top (the card closes)', J(kb));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
