// BOSS-FIGHT LAG: THE WARRIOR'S CHOP AND THE SKILL BAR (per user: "reduce lag even more especially boss fights").
//   1. the chop crescent no longer re-walks the arm chain for every past pose each frame: over a warm swing the pose function
//      runs at most twice per hero draw (the build before: ~17.5)
//   2. the cache is exact: a cached crescent and one computed fresh (memo cleared) draw the same pixels
//   3. the cooldown pie writes --cd-pct at most 20 times a second per slot: 30 renders inside ~40 ms write it at most twice,
//      and a render 60 ms later writes again; the number and the clear at the end still land
//   [MOJI_SERVE_ROOT / PORT] node scripts/boss_lag_hero_skillbar_test.mjs      (serves mojiworld_game.html)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10063); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderSkillBar === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const o of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(o); if (e) e.style.display = 'none'; }
    window._lxBootGateDone = true; window._prologueActive = false;
    if (typeof applyClass === 'function') applyClass('warrior'); else player.cls = 'warrior';
    try { const b = document.getElementById('plg-skip'); if (b) b.click(); } catch (e) {}
    loadMap('forest', 400); await sleep(2500); game.paused = true;
    const out = { ver: GAME_VERSION };
    // 1. pose calls per draw over warm swings
    const c = document.createElement('canvas'); c.width = 240; c.height = 240; const g = c.getContext('2d');
    const draw = (t) => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 240, 240); g.save(); g.translate(120, 150); g.scale(1.9, 1.9); _drawVectorHero(0, 0, g, { animName: 'attack_warrior', animTime: t }); g.restore(); };
    for (let t = 0.2; t < 0.86; t += 0.011) draw(t);   // warm
    const o = window._hvAttackFlow; let calls = 0; window._hvAttackFlow = function () { calls++; return o.apply(this, arguments); };
    let n = 0; for (let sw = 0; sw < 3; sw++) for (let t = 0.2; t < 0.86; t += 0.011) { draw(t); n++; }
    window._hvAttackFlow = o; out.callsPerDraw = +(calls / n).toFixed(2);
    // 2. cached vs fresh pixels
    out.px = [];
    for (const t of [0.45, 0.6]) {
      draw(t); draw(t); const a = g.getImageData(0, 0, 240, 240).data;
      if (typeof _lxChopMemo !== 'undefined') _lxChopMemo.clear();
      draw(t); const b = g.getImageData(0, 0, 240, 240).data;
      let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
      out.px.push({ t, memo: typeof _lxChopMemo !== 'undefined', diff });
    }
    // 3. the pie
    const slot = Object.keys(_sbSlots).map((k) => _sbSlots[k]).find((x) => x && x.skillId && SKILLS[x.skillId] && SKILLS[x.skillId].cd > 0);
    const cd = SKILLS[slot.skillId].cd; let writes = 0, last = null;
    const read = () => { const v = slot.cdEl.style.getPropertyValue('--cd-pct'); if (v !== last) { last = v; writes++; } };
    player.skillCooldowns[slot.skillId] = cd; renderSkillBar(); read();
    const t0 = performance.now();
    for (let i = 1; i <= 30; i++) { player.skillCooldowns[slot.skillId] = cd * (1 - i * 0.01); renderSkillBar(); read(); }
    out.burstMs = Math.round(performance.now() - t0); out.burstWrites = writes;
    const txt = slot.cdEl.textContent;
    await sleep(60); player.skillCooldowns[slot.skillId] = cd * 0.5; renderSkillBar(); read(); out.afterWrites = writes;
    out.txtLive = txt !== '' && slot.cdEl.textContent !== txt;
    player.skillCooldowns[slot.skillId] = 0; renderSkillBar(); out.cleared = slot.cdEl.style.getPropertyValue('--cd-pct') === '' && slot.cdEl.style.display === 'none';
    return out;
  });
  console.log('build', R.ver, JSON.stringify(R));
  ok('1. a warm chop runs the pose function at most twice per hero draw (it walked up to 25 poses)', R.callsPerDraw <= 2, 'calls/draw ' + R.callsPerDraw);
  ok('2. a cached crescent draws the same pixels as one computed fresh', R.px.every((p) => p.memo && p.diff === 0), JSON.stringify(R.px));
  ok('3. 30 renders in one burst write the pie at most twice; one 60 ms later writes again', R.burstMs < 50 ? R.burstWrites <= 2 : true, 'burst ' + R.burstWrites + ' writes in ' + R.burstMs + ' ms');
  ok('3. ...and a render 60 ms later writes it, the number follows, the end clears it', R.afterWrites === R.burstWrites + 1 && R.txtLive && R.cleared, JSON.stringify({ after: R.afterWrites, txt: R.txtLive, cleared: R.cleared }));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL  the harness runs to the end  ' + JSON.stringify(String(e.message).slice(0, 300))); }
finally { await browser.close(); server.kill(); }
console.log(fail ? `FAIL(${fail}) - ${pass} passed, ${fail} failed` : `PASS(0) - ${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
