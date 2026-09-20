// THE THREE CALLS THE 2026-09-19 AUDIT LEFT OPEN (v0.30.931). The Stormbearer's pact was priced off the wallet
// alone, so banking the purse bought it for a coin; coins spent inside a tower run were handed back by the run's
// own wallet restore, which made potions free down there; and the co-op damage cap was one FULL health bar, so a
// tampered guest could still delete a boss in a single packet - the thing that cap exists to stop.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/econ_calls_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11323';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const boot = async (page) => { await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 }); };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
  await page.evaluate(async () => { try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; player._tutorialSeen = true; window.uiConfirm = () => Promise.resolve(true);
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 800)); });
  // 1. the pact is priced off wallet + bank, and collected from both
  const storm = await page.evaluate(async () => {
    player.mojicoins = 4; player.bankBalance = 100000; player._spawnBoostUntil = 0;
    const npc = { role: 'stormbearer', name: 'Stormbearer', x: player.x + player.w / 2, y: 404 };
    openNPC(npc);
    const b = [...document.querySelectorAll('#dialog-options button')].find((x) => /Accept|Extend the pact/.test(x.textContent));
    const label = b ? b.textContent : ''; if (b) b.click(); await new Promise((r) => setTimeout(r, 150));
    const out = { label, wallet: player.mojicoins, bank: player.bankBalance, boost: (player._spawnBoostUntil | 0) > 0 };
    try { closeDialog(); } catch (e) {} return out;
  });
  check(storm.boost && (100004 - (storm.wallet + storm.bank)) > 20000 && /2[0-9],?[0-9]{3}/.test(storm.label), 'the Stormbearer quotes and bills a quarter of wallet + bank', J(storm));
  // 2. coins spent inside a tower run are still gone when it ends
  const tower = await page.evaluate(async () => {
    player.mojicoins = 50000; player.bankBalance = 0; player.consumables = {}; player.hp = Math.max(1, Math.floor(getMaxHp() * 0.3));
    game.expedition = game.expedition || {}; game.expedition.active = true; game.expedition._spentInRun = 0;
    useQuickPotion('hp');                                        // buys the cheapest affordable potion from gold
    const spentNow = 50000 - player.mojicoins, tracked = game.expedition._spentInRun | 0;
    const snap = { mojicoins: 50000, bankBalance: 0, boons: [], boonsEquipped: [], inventory: [], consumables: {}, equipped: {} };
    _expeditionRestorePlayer(snap);                              // what the end of a run does to the wallet
    const after = player.mojicoins; game.expedition.active = false;
    return { spentNow, tracked, after };
  });
  check(tower.spentNow > 0 && tower.tracked === tower.spentNow && tower.after === (50000 - tower.spentNow), 'a potion bought inside a tower run is not refunded when the run ends', J(tower));
  // 3. one co-op packet cannot delete a boss, but trash still dies in one
  const coop = await page.evaluate(async () => {
    const was = net.isHost; net.isHost = true;
    game.monsters.length = 0;
    const boss = spawnMonster(player.x + 300, player.y - 40, 'king', true, false);
    const mob = spawnMonster(player.x + 360, player.y - 40, 'snail', false, false);
    if (!boss || !mob) { net.isHost = was; return { err: 'no spawn' }; }
    boss.uid = 90001; mob.uid = 90002; boss.invulnerable = 0; mob.invulnerable = 0;
    const bossHp0 = boss.currentHp, mobHp0 = mob.currentHp;
    _coopHostApplyDamage(90001, 99999999, false, 'probe', null);
    _coopHostApplyDamage(90002, 99999999, false, 'probe', null);
    const out = { bossHp0, bossLeft: boss.currentHp, mobHp0, mobLeft: mob.currentHp };
    net.isHost = was; game.monsters.length = 0; return out;
  });
  check(!coop.err && coop.bossLeft > 0 && coop.bossLeft >= coop.bossHp0 * 0.45 && coop.mobLeft <= 0, 'a single guest packet takes at most half a boss bar, and still one-shots trash', J(coop));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
