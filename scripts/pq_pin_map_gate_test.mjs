// The PQ objective pin must belong to the PQ map, and only to the PQ map.
//
// Per user (screenshot, Everdawn Central): "I left the PQ and somehow the
// message still persist outside of the PQ" — the Stage 1 banner still filling
// the top-left of town.
//
// _renderPqObjectivePin gates on game.currentMap being a PQ stage map, and that
// gate is correct. The bug is WHEN loadMap calls it: the call sits ~500 lines
// ABOVE `game.currentMap = id`, so every map load renders the pin against the
// map being LEFT. Leaving the PQ therefore re-renders it as if still inside,
// and nothing after that assignment renders it again — so it sticks. The
// inverse half is the same bug: ARRIVING in a PQ map hides the pin, and it only
// appears once some later event (a kill) happens to re-render it.
//   node scripts/pq_pin_map_gate_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _renderPqObjectivePin === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.hp = getMaxHp(); window._prologueActive = false;
  player.quests = player.quests || {}; player.quests.active = player.quests.active || {};
  // Mid-PQ: Stage 1 accepted, well past the authored count (the state in the
  // report — 420 kills against an authored 150).
  player.quests.active.q_clockwork_underpass = { progress: 420, targetCount: 500 };

  const pin = () => {
    const el = document.getElementById('pq-objective-pin');
    if (!el) return { shown: false, text: '' };
    const st = getComputedStyle(el);
    return { shown: st.display !== 'none' && st.visibility !== 'hidden', text: (el.textContent || '').trim() };
  };

  loadMap('clockworkUnderpassLobby');
  await new Promise(r => setTimeout(r, 400));
  out.insidePq = pin();

  loadMap('town');
  await new Promise(r => setTimeout(r, 400));
  out.afterLeaving = pin();

  // back in, and out again by a different door, to be sure it is the map gate
  // doing the work and not one lucky ordering.
  loadMap('clockworkUnderpassLobby');
  await new Promise(r => setTimeout(r, 400));
  out.backInside = pin();
  loadMap('wildflowerPlains');
  await new Promise(r => setTimeout(r, 400));
  out.afterLeavingAgain = pin();

  out.currentMap = game.currentMap;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('inside the PQ map :', JSON.stringify(r.insidePq).slice(0, 160));
console.log('after leaving     :', JSON.stringify(r.afterLeaving).slice(0, 160));
console.log('back inside       :', JSON.stringify(r.backInside).slice(0, 160));
console.log('left again        :', JSON.stringify(r.afterLeavingAgain).slice(0, 160));

ok('the pin is up on arrival in the PQ map, without waiting for a kill',
   r.insidePq.shown === true, r.insidePq);
ok('it names the stage it is on', /Stage 1/i.test(r.insidePq.text), { text: r.insidePq.text.slice(0, 80) });
ok('leaving the PQ hides the pin — the reported bug',
   r.afterLeaving.shown === false, r.afterLeaving);
ok('re-entering brings it straight back', r.backInside.shown === true, r.backInside);
ok('leaving by another route hides it too', r.afterLeavingAgain.shown === false, r.afterLeavingAgain);
ok('the remaining count is never negative', !/-\d+\s*left/.test(r.insidePq.text),
   { text: r.insidePq.text.slice(0, 80) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
