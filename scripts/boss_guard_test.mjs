// WHAT A BOSS FIGHT USED TO DO BY ACCIDENT (v0.30.933 audit). Four of them, driven in the running game:
// every zodiac opened HEAVENSPLIT on the same frame as its phase toast (the seed delay was dead code, because
// phase 1 wrote 0 where the seed tests null); a heal across a phase line re-ran the whole escalation beat, nova
// and all; the Tower Sovereign's drain pillars and homing volley outlived him (a pillar resolving after his
// death forces HP and MP to 1, past Block and Aegis); and Aetherion's choir kept casting after he fell.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/boss_guard_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11324';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(/_cm\._aetherionChoir = true;/.test(src), 'the choir is tagged where it is summoned, so the sweep can find it');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof zodiacBossAI === 'function' && typeof killMonster === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 70; player._tutorialSeen = true; player._god = true;
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 900));
  });
  // 1. crossing into phase 2 does not open HEAVENSPLIT on the same frame
  const desp = await page.evaluate(() => {
    const z = ZODIAC_SIGNS[0];
    const m = { type: 'zodiac_' + z.id, zodiacSign: z.id, currentHp: 1000, maxHp: 1000, x: player.x + 300, y: player.y, w: 60, h: 60, atk: 50 };
    _zodiacDesperationTick(m, 16, 1, z);                 // a phase-1 frame, as the fight starts
    const afterP1 = m._despCD;
    _zodiacDesperationTick(m, 16, 2, z);                 // the frame the boss crosses 66%
    return { afterP1, cd: m._despCD, state: m._despState };
  });
  check(desp.state !== 'warning' && desp.cd > 3000, 'crossing into phase 2 seeds the desperation delay instead of firing at once', J(desp));
  // 2. a heal back over the line does not re-run the phase beat
  const heal = await page.evaluate(async () => {
    game.monsters.length = 0; game.projectiles.length = 0;
    const z = ZODIAC_SIGNS[0];
    const m = spawnMonster(player.x + 320, player.y - 40, 'zodiac_' + z.id, true, false) || null;
    if (!m) return { err: 'no zodiac spawn' };
    m.zodiacSign = z.id; m.maxHp = 1000; m.currentHp = 600;               // phase 2
    zodiacBossAI(m, 16, 300); const afterFirst = game.projectiles.length;
    m.currentHp = 700; zodiacBossAI(m, 16, 300);                          // healed back to phase 1
    game.projectiles.length = 0;
    m.currentHp = 600; zodiacBossAI(m, 16, 300);                          // and chipped back down
    const afterSecond = game.projectiles.length;
    game.monsters.length = 0; game.projectiles.length = 0;
    return { afterFirst, afterSecond };
  });
  check(!heal.err && heal.afterFirst > 0 && heal.afterSecond === 0, 'the phase nova fires once per phase reached, not on every re-cross', J(heal));
  // 3. the Sovereign takes his pillars and roamers with him
  const sov = await page.evaluate(() => {
    game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(player.x + 300, player.y - 40, 'towerSovereign', true, false);
    if (!m) return { err: 'no sovereign' };
    game.hazards.push({ type: 'sovereign_drain_pillar', x: player.x, y: 0, w: 60, h: 600, life: 84, maxLife: 84 });
    game.hazards.push({ type: 'gloop_puddle', x: 0, y: 0, w: 10, h: 10, life: 50 });
    game.projectiles.push({ owner: 'enemy', skill: 'msovereign', homing: true, x: 0, y: 0, w: 8, h: 8, vx: 1, vy: 0, life: 200, damage: 5 });
    game.projectiles.push({ owner: 'enemy', skill: 'other', x: 0, y: 0, w: 8, h: 8, vx: 1, vy: 0, life: 200, damage: 5 });
    // he revives once at 30% (traits.revivesOnce), so the first kill is not his death: mark that beat spent.
    m._revivedOnce = true;
    m.currentHp = 0; try { killMonster(m); } catch (e) {}
    const out = { pillars: game.hazards.filter((h) => h && h.type === 'sovereign_drain_pillar').length,
                  others: game.hazards.filter((h) => h && h.type === 'gloop_puddle').length,
                  roamers: game.projectiles.filter((p) => p && p.skill === 'msovereign').length,
                  otherShots: game.projectiles.filter((p) => p && p.skill === 'other').length };
    game.hazards.length = 0; game.projectiles.length = 0; game.monsters.length = 0; return out;
  });
  check(!sov.err && sov.pillars === 0 && sov.roamers === 0 && sov.others === 1 && sov.otherShots === 1,
    'the Sovereign\'s death clears his drain pillars and homing volley, and nothing else', J(sov));
  // 4. Aetherion's choir leaves with him
  const choir = await page.evaluate(() => {
    game.monsters.length = 0;
    const m = spawnMonster(player.x + 300, player.y - 40, 'aetherion', true, false);
    if (!m) return { err: 'no aetherion' };
    for (const t of ['cherub', 'archon', 'cherub']) { const c = spawnMonster(player.x + 200, player.y - 20, t, false, false); if (c) c._aetherionChoir = true; }
    const before = game.monsters.filter((x) => x && x._aetherionChoir).length;
    m.currentHp = 0; try { killMonster(m); } catch (e) {}
    const after = game.monsters.filter((x) => x && x._aetherionChoir && x.currentHp > 0).length;
    game.monsters.length = 0; return { before, after };
  });
  check(!choir.err && choir.before === 3 && choir.after === 0, 'Aetherion\'s celestial choir does not outlive him', J(choir));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
