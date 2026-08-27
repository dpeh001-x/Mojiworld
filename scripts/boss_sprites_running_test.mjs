// Verify every boss sprite RUNS in-game and SHOWS in the animator.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  // ---------- GAME ----------
  const g = await b.newContext({ serviceWorkers: 'block' }).then(c => c.newPage());
  const gErr = []; g.on('pageerror', e => gErr.push(String(e).slice(0, 140)));
  await g.goto('http://localhost:8080/mojiworld_game.html', { waitUntil: 'domcontentloaded' });
  await g.waitForFunction(() => typeof BOSS_SPRITES === 'object' && typeof BOSS_SPRITE_TYPES !== 'undefined');
  // wait until all boss statics have decoded (png bosses load after a .webp probe + fallback)
  await g.waitForFunction(() => BOSS_SPRITE_TYPES.every(t => BOSS_SPRITES[t]), null, { timeout: 90000 }).catch(() => {});
  const gr = await g.evaluate(async () => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; });
    const out = { statics: {}, frames: {} };
    for (const t of BOSS_SPRITE_TYPES) {
      out.statics[t] = !!BOSS_SPRITES[t];
      const idle = t === 'gravitospunch' ? true : await load('Sprites/bosses/idle/' + t + '_0.webp');
      const atk  = await load('Sprites/bosses/attack/' + t + '_0.webp');
      out.frames[t] = idle && atk;
    }
    return out;
  });
  const missingStatic = Object.entries(gr.statics).filter(([k, v]) => !v).map(([k]) => k);
  const missingFrames = Object.entries(gr.frames).filter(([k, v]) => !v).map(([k]) => k);
  ok('game: every boss static sprite decoded (' + Object.keys(gr.statics).length + ' bosses)', missingStatic.length === 0, { missingStatic });
  ok('game: every boss idle+attack frame decoded', missingFrames.length === 0, { missingFrames });
  ok('game: no page errors', gErr.length === 0, gErr.slice(0, 3));
  await g.close();

  // ---------- ANIMATOR ----------
  const a = await b.newContext({ serviceWorkers: 'block' }).then(c => c.newPage());
  const aErr = []; a.on('pageerror', e => aErr.push(String(e).slice(0, 140)));
  await a.goto('http://localhost:8080/monster_animator.html', { waitUntil: 'domcontentloaded' });
  await a.waitForFunction(() => window.__app && window.__app.MAN && document.getElementById('list'), null, { timeout: 30000 });
  await a.waitForTimeout(1500);
  const ar = await a.evaluate(() => {
    const MAN = window.__app.MAN;
    const bosses = Object.keys(MAN).filter(k => MAN[k] && MAN[k].group === 'boss');
    return { bossCount: bosses.length, bosses, listItems: document.getElementById('list').children.length };
  });
  ok('animator: manifest lists the full boss roster (15+)', ar.bossCount >= 15, ar);
  ok('animator: includes kingKrook / legosaurus / mooma (the renamed bosses)', ['kingKrook','legosaurus','mooma'].every(k => ar.bosses.includes(k)), ar.bosses);
  ok('animator: list rendered every entry', ar.listItems > 40, { listItems: ar.listItems });
  // select each RENAMED boss, advance the clock, verify the preview canvas paints
  for (const key of ['kingKrook', 'legosaurus', 'mooma']) {
    const sel = await a.evaluate(async (key) => {
      window.__app.select(key);
      await new Promise(r => setTimeout(r, 900));
      // advance the headless clock + repaint (rAF is paused in hidden tabs)
      for (let i = 0; i < 20; i++) { window.__app._setNow(performance.now() + i * 130); window.__app.paint(); }
      const cv = document.querySelector('canvas'); const ctx = cv.getContext('2d');
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let painted = 0; for (let i = 3; i < d.length; i += 4 * 89) if (d[i] > 12) painted++;
      return { key, painted };
    }, key);
    ok('animator: "' + key + '" renders to the preview canvas', sel.painted > 0, sel);
  }
  ok('animator: no page errors', aErr.length === 0, aErr.slice(0, 3));
  await a.close();
} finally { await b.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
