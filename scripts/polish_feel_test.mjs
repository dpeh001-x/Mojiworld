// FINAL POLISH, SECOND PASS - COMBAT FEEL (audit C5, C8, C9, C10, A5; per user "continue working on bugs and final
// polish touches"). The player stays drawn on the frames a hit lands; a pet's, wolf's or MojiMon's hit does not freeze or
// flash the screen; over the cap the plain numbers go before crits and damage taken; Sky Lance, Skyfall Dominion and the
// Pandemic Hex finale land with a sound; the dash whooshes.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/polish_feel_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11215';
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { audio.muted = false; } catch (e) {}
    loadMap('forest', 300); await sleep(2500); try { closeAllModals(); } catch (e) {} game.paused = true;
    const sfx = []; const _pu = window._playUiSfx; window._playUiSfx = function (id) { sfx.push(id); return _pu.apply(this, arguments); };
    // C5 - draw calls made by drawPlayer after its shadow: 0 means the player was skipped (the blink's hidden half)
    const drawn = (inv, sinceHit) => {
      player.invulnerable = inv; player.dodgeTimer = 0; player._downed = false; player._hitIframeAt = game.time - sinceHit;
      let after = false, n = 0; const _sh = window._lxDrawBlobShadow, _di = ctx.drawImage;
      window._lxDrawBlobShadow = function () { const v = _sh.apply(this, arguments); after = true; return v; };
      ctx.drawImage = function () { if (after) n++; return _di.apply(this, arguments); };
      try { drawPlayer(); } finally { window._lxDrawBlobShadow = _sh; ctx.drawImage = _di; }
      return n;
    };
    out.blink = { hitFrame: drawn(1000, 0), during: drawn(1000, 6), later: drawn(1000, 12), odd: drawn(940, 30) };
    player.invulnerable = 0;
    // C8 - hit-stop and flashes from an ally's hit vs your own
    const mob = () => { game.monsters.length = 0; spawnMonster(player.x + 120, player.y - 20, 'slime', false, false); const m = game.monsters[game.monsters.length - 1]; m.maxHp = m.currentHp = 1e9; m.evasion = 0; return m; };
    const flashes = []; const _fl = window.flash; window.flash = function (a) { flashes.push(a); return _fl.apply(this, arguments); };
    const feel = (skill) => { game.hitStop = 0; flashes.length = 0; game.critStreak = 0; game.time = (game.time | 0) + 7; hitMonster(mob(), 50, true, skill); return { stop: Math.round(game.hitStop), flashes: flashes.length }; };
    out.ally = { pet: feel('pet'), pack: feel('pack'), mojimon: feel('mojimon'), minion: feel('minion'), own: feel('melee') };
    const kill = (skill, elite) => { game.hitStop = 0; game.critStreak = 0; game.time = (game.time | 0) + 7; game.monsters.length = 0; spawnMonster(player.x + 120, player.y - 20, 'slime', false, false); const m = game.monsters[game.monsters.length - 1]; m.maxHp = m.currentHp = 5; m.evasion = 0; if (elite) m.isMiniBoss = true; hitMonster(m, 50, false, skill); return Math.round(game.hitStop); };
    out.kills = { petTrash: kill('pet'), ownTrash: kill('melee'), petElite: kill('pet', true) };
    window.flash = _fl; game.hitStop = 0; game.monsters.length = 0;
    // C9 - 40 numbers: 6 damage-taken (oldest), 6 crits, 28 plain; the draw caps at 30
    game.damageNumbers.length = 0;
    const base = { x: player.x, y: player.y - 40, vy: 0, life: 60, maxLife: 60, color: '#fff', size: 14 };
    for (let i = 0; i < 6; i++) game.damageNumbers.push({ ...base, taken: true, big: true, text: '-' + (100 + i), id: 't' + i });
    for (let i = 0; i < 6; i++) game.damageNumbers.push({ ...base, crit: true, tier: 1, text: String(900 + i), id: 'c' + i });
    for (let i = 0; i < 28; i++) game.damageNumbers.push({ ...base, tier: 0, text: String(10 + i), id: 'p' + i });
    drawDamageNumbers();
    const ids = game.damageNumbers.map((d) => d.id);
    out.dn = { n: ids.length, taken: ids.filter((x) => x[0] === 't').length, crit: ids.filter((x) => x[0] === 'c').length,
      ordered: ids.join(',') === ids.slice().sort((a, b) => (a[0] === b[0] ? +a.slice(1) - +b.slice(1) : 'tcp'.indexOf(a[0]) - 'tcp'.indexOf(b[0]))).join(',') };
    game.damageNumbers.length = 0;
    // A5 - the dash
    sfx.length = 0; player.quickDashTimer = 0; quickDash(1); await sleep(30); out.dash = sfx.slice();
    sfx.length = 0; audio.play('dash'); out.dashPlay = sfx.slice();
    // C10 - the three delayed landings (the game runs for them; a mob stands in reach)
    player.hp = player.maxHp = 1e9; player.invulnerable = 1e9;
    const land = async (fn, ms) => { mob(); sfx.length = 0; const t0 = game.time; fn(); game.paused = false; for (let w = 0; w < ms && !sfx.includes('slam_ult'); w += 100) await sleep(100); game.paused = true; return { n: sfx.filter((x) => x === 'slam_ult').length, frames: game.time - t0, slam: player.dragoonSlam | 0, ground: !!player.onGround }; };
    out.skyLance = await land(() => { SKILL_FNS.dragoon_skylance(); }, 4000);
    out.skyfall = await land(() => { player.onGround = false; SKILL_FNS.dragoon_ult(); }, 4000);
    out.pandemic = await land(() => { SKILL_FNS.hexmaster_ult(); }, 5000);
    window._playUiSfx = _pu;
    return out;
  });
  check(r.blink.hitFrame > 0 && r.blink.during > 0, 'the player stays drawn on the frame a hit lands and through its hit-stop', J(r.blink));
  check(r.blink.later === 0 && r.blink.odd > 0, '...and the mercy blink still runs after that', J(r.blink));
  const ally = ['pet', 'pack', 'mojimon', 'minion'].every((k) => r.ally[k].stop === 0 && r.ally[k].flashes === 0);
  check(ally, 'a pet, wolf, MojiMon or minion hit neither freezes the frame nor flashes the screen', J(r.ally));
  check(r.kills.petTrash === 0 && r.kills.ownTrash > 0 && r.kills.petElite > 0, 'a pet killing an ordinary mob does not stop the frame; your kill and an elite kill still do', J(r.kills));
  check(r.ally.own.stop > 0 && r.ally.own.flashes > 0, 'your own crit still freezes and flashes', J(r.ally.own));
  check(r.dn.n === 30 && r.dn.taken === 6 && r.dn.crit === 6 && r.dn.ordered, 'over the cap, plain hits go first: every damage-taken and crit number survives, in order', J(r.dn));
  check(r.dash.includes('quick_dash') && r.dashPlay.includes('quick_dash'), 'the dash whooshes (Shift / double-tap and the chained dash)', J({ quickDash: r.dash, play: r.dashPlay }));
  check(r.skyLance.n >= 1, 'Sky Lance lands with a sound', J(r.skyLance));
  check(r.skyfall.n >= 1, 'Skyfall Dominion\'s slam lands with a sound', J(r.skyfall));
  check(r.pandemic.n >= 1, 'the Pandemic Hex finale lands with a sound', J(r.pandemic));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
