// Hit feel (v0.30.393): hit-stop climbs a tier when a blow takes a quarter of the
// target's max HP, a killing blow freezes for the full 150 ms cap, and a camera
// kick nudges the view toward the hit (tiered, crit bonus, kill bonus, decaying,
// off under reduce-motion). MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10053); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof hitMonster === 'function' && typeof spawnMonster === 'function' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, hasKick: typeof _lxCamKick === 'function', killStop: typeof LX_KILL_STOP === 'number' ? LX_KILL_STOP : null }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true; player.level = 30; player.hp = player.maxHp || 1000; game._reduceMotion = false; game._shakeMul = 1;
    const spawnSnail = () => { spawnMonster(player.x + 140, player.y, 'snail', false); const m = game.monsters.filter((x) => x && x.type === 'snail').pop(); m.currentHp = m.maxHp; m.evasion = 0; m.invulnerable = 0; m.freezeTimer = 0; return m; };
    const hit = (m, dmg, crit, skill) => { game.hitStop = 0; game._kickX = 0; game._kickY = 0; m.invulnerable = 0; m._lastHitAt = 0; game.time += 120; const h0 = m.currentHp; try { hitMonster(m, dmg, crit, skill || 'melee'); } catch (e) { return { err: String(e && e.message) }; } return { stop: game.hitStop, kick: +(game._kickX || 0).toFixed(2), loss: h0 - m.currentHp, frac: +((h0 - m.currentHp) / m.maxHp).toFixed(3) }; };
    let m = spawnSnail(); o.maxHp = m.maxHp;
    o.light = hit(m, Math.max(1, Math.round(m.maxHp * 0.01)), false);
    o.lightCrit = hit(m, Math.max(1, Math.round(m.maxHp * 0.01)), true);
    m.currentHp = m.maxHp; o.heavyFrac = hit(m, Math.round(m.maxHp * 0.3), false);      // 30% of the bar: one tier up
    m.currentHp = 10; o.kill = hit(m, 100000, false);
    m = spawnSnail(); game._reduceMotion = true; m.currentHp = 10; o.killNoMotion = hit(m, 100000, false); game._reduceMotion = false;
    m = spawnSnail(); game._shakeMul = 0.5; m.currentHp = 10; o.killHalf = hit(m, 100000, false); game._shakeMul = 1;
    // decay: the frame loop takes the kick down on its own
    game._kickX = 6; game._kickY = 3; await sleep(700); o.afterDecay = [game._kickX, game._kickY];
    // the view really moves: the frame translate carries the kick
    const src = await (await fetch(location.pathname)).text();
    o.src = { translate: src.indexOf('ctx.translate(Math.round(game.shakeX + (game._kickX || 0)), Math.round(game.shakeY + (game._kickY || 0)))') >= 0, tier: src.indexOf('>= 0.25 && _iw < 3) _iw++;') >= 0 };
    return o;
  });
  console.log('build ' + r.ver + '  maxHp ' + r.maxHp + '  light ' + JSON.stringify(r.light) + '  crit ' + JSON.stringify(r.lightCrit) + '  heavy ' + JSON.stringify(r.heavyFrac) + '  kill ' + JSON.stringify(r.kill));
  ok('the kick function and the kill-freeze constant exist (150 ms, the cap)', r.hasKick === true && r.killStop === 150, String(r.killStop));
  ok('a light hit still freezes 35 ms and does not kick', r.light && !r.light.err && r.light.stop === 35 && r.light.kick === 0, JSON.stringify(r.light));
  ok('a light crit freezes 80 ms and kicks 1.5 px toward the monster (to the right, so the view shifts left)', r.lightCrit && r.lightCrit.stop === 80 && r.lightCrit.kick === -1.5, JSON.stringify(r.lightCrit));
  // the pre-existing big-hit path already stops 35 + frac x 110 ms (66 ms at 30%); the tier bump's own 60 ms sits under it, and the bump's visible effect is the kick tier
  ok('a hit that takes 30% of the bar climbs a tier: at least 60 ms (the big-hit path may hold longer) and a 1.5 px kick', r.heavyFrac && r.heavyFrac.frac >= 0.25 && r.heavyFrac.stop >= 60 && r.heavyFrac.stop <= 90 && r.heavyFrac.kick === -1.5, JSON.stringify(r.heavyFrac));
  ok('a killing blow freezes the full 150 ms and kicks 6 px', r.kill && r.kill.stop === 150 && r.kill.kick === -6, JSON.stringify(r.kill));
  ok('reduce-motion: the kill still freezes, the kick is off', r.killNoMotion && r.killNoMotion.stop === 150 && r.killNoMotion.kick === 0, JSON.stringify(r.killNoMotion));
  ok('the shake slider scales the kick (50% -> 3 px)', r.killHalf && r.killHalf.kick === -3, JSON.stringify(r.killHalf));
  ok('the kick decays to nothing on its own within 0.7 s', r.afterDecay && r.afterDecay[0] === 0 && r.afterDecay[1] === 0, JSON.stringify(r.afterDecay));
  ok('the frame translate carries the kick and the tier bump is in the shipped source', r.src && r.src.translate && r.src.tier, JSON.stringify(r.src));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
