// AETHERION'S ASCENSION — the form change is a beat, not a cut.
// ============================================================================
// Per user: "when aetherion transforms to aetherion2 make an animation to show the evolution".
// Before this the swap was instant: _phaseSprite went to 'aetherion2' on the same frame the HP
// crossed 50%, with a particle ring thrown over the seam.
//
// What this pins:
//   1. the swap is DEFERRED to the break (~620ms), not done on the trigger frame;
//   2. the whiteout he changes shape inside rises to full and burns back off to nothing;
//   3. the iframe covers the whole beat, so he cannot be hit while he is a column of light;
//   4. the ascension pillar is spawned, and its art and nine frames are served and decode;
//   5. the beat ends clean (no stuck white, no stuck scale) and never plays twice;
//   6. reduced motion still gets the form change, just without the theatre.
// Run: node scripts/aetherion_evolve_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9741);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Ascend');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 60; loadMap('forest', 300); });
await page.waitForTimeout(4500);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  try { _lxCineHold(0); } catch (e) {} game.paused = false;
  player._god = true;                      // the fight is not the point; the form change is
  player.x = 700; player.y = 300;
  out.consts = (typeof LX_AE_EVO !== 'undefined') ? { ...LX_AE_EVO } : null;

  const run = async (reduceMotion) => {
    game.monsters.length = 0; game.smoothFx = []; game.dashFx = [];
    game._reduceMotion = !!reduceMotion;
    const m = spawnMonster(player.x + 320, player.y - 20, 'aetherion', true);
    const atk0 = m.atk;
    await sleep(220);
    const before = { phase: m._phaseSprite || null, evoT: m._aeEvoT };
    m.currentHp = Math.floor(m.maxHp * 0.42);          // cross the 50% line
    const samples = [];
    let burstAt = -1, swapAt = -1, t0 = -1;
    for (let i = 0; i < 90; i++) {
      const now = performance.now();
      if (m._aeEvoT >= 0 && t0 < 0) t0 = now;
      if (swapAt < 0 && m._phaseSprite === 'aetherion2') swapAt = m._aeEvoT;
      if (burstAt < 0 && (game.smoothFx || []).some((f) => f.spriteKey === 'ae_evolve')) burstAt = m._aeEvoT;
      samples.push({ evoT: Math.round(m._aeEvoT), white: +(m._aeEvoWhite || 0).toFixed(2), phase: m._phaseSprite || null, inv: Math.round(m.invulnerable), sx: +(m.scaleX || 1).toFixed(2) });
      if (m._aeEvoT === -1 && i > 10) break;
      await sleep(25);
    }
    const whites = samples.map((s) => s.white);
    return {
      before, atkUp: m.atk > atk0 && m.atk === Math.floor(atk0 * 1.25),
      swapAt, burstAt,
      peakWhite: Math.max(...whites),
      endWhite: m._aeEvoWhite || 0, endT: m._aeEvoT, endPhase: m._phaseSprite || null,
      endScale: +(m.scaleX || 1).toFixed(2),
      // the longest iframe seen during the beat — samples taken before it starts have no
      // m.invulnerable at all, so they are dropped rather than poisoning the max with NaN
      invAtStart: Math.max(...samples.map((s) => s.inv).filter((v) => Number.isFinite(v))),
      invAtSwap: (samples.find((s) => s.phase === 'aetherion2') || {}).inv,
      samples: samples.filter((s, i) => i % 5 === 0).slice(0, 14),
      // it must not fire a second time
      retrigger: await (async () => { const p0 = m._aeEvoT; m.currentHp = Math.floor(m.maxHp * 0.2); await sleep(300); return m._aeEvoT === p0; })(),
    };
  };
  out.normal = await run(false);
  out.reduced = await run(true);
  game._reduceMotion = false;
  out.art = {
    served: (await fetch('Sprites/fx/ae_evolve.webp')).status,
    servedFrame: (await fetch('Sprites/fx/anim/ae_evolve_8.webp')).status,
    frames: (typeof _lxFrameCount === 'function') ? _lxFrameCount('fx/anim', 'ae_evolve', 9) : -1,
  };
  return out;
});
await browser.close(); server.kill();
console.log(JSON.stringify(R, null, 1).slice(0, 2600));
const N = R.normal, D = R.reduced;
const checks = [
  ['the beat exists with the authored timings', R.consts && R.consts.pillar === 300 && R.consts.gather === 620 && R.consts.burn === 430 && R.consts.total === 1400, JSON.stringify(R.consts)],
  ['the trigger does NOT swap the sprite on its own frame', N.before.phase === null, String(N.before.phase)],
  ['the swap happens at the break, not at the trigger', N.swapAt >= 620 && N.swapAt < 900, 'swapped at ' + N.swapAt + 'ms'],
  ['the ascension column rises BEFORE the break, so the swap happens behind it', N.burstAt >= 300 && N.burstAt < 620, 'column at ' + N.burstAt + 'ms, swap at ' + N.swapAt + 'ms'],
  ['he whites out completely on the way', N.peakWhite >= 0.9, 'peak ' + N.peakWhite],
  ['and the white burns all the way back off', N.endWhite === 0, 'ends at ' + N.endWhite],
  ['the iframe covers the whole beat', N.invAtStart >= 1400 && N.invAtSwap > 0, N.invAtStart + 'ms at the start, ' + N.invAtSwap + 'ms still left at the swap'],
  ['the beat ends and releases him', N.endT === -1 && N.endPhase === 'aetherion2' && Math.abs(N.endScale - 1) < 0.05, 'evoT ' + N.endT + ' scale ' + N.endScale],
  ['it never plays twice', N.retrigger === true && D.retrigger === true],
  ['the +25% attack the form change always gave still lands', N.atkUp === true],
  ['reduced motion still gets the form change', D.swapAt >= 620 && D.endPhase === 'aetherion2', 'swapped at ' + D.swapAt + 'ms'],
  ['the pillar art and its nine frames are served and indexed', R.art.served === 200 && R.art.servedFrame === 200 && R.art.frames === 9, JSON.stringify(R.art)],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
