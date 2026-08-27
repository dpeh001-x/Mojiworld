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
const URL = 'http://localhost:8080/mojiworld_game.html';
const OUT = '/tmp/claude-0/-home-user-Mojiworld/1652515c-62db-56d2-8863-1459f775405a/scratchpad';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const p = await b.newContext({ viewport: { width: 1100, height: 700 } }).then(c => c.newPage());
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => typeof MAPS === 'object' && typeof loadMap === 'function');
await p.waitForTimeout(3000);
await p.evaluate(() => { try { player.cls = player.cls || 'warrior'; game.paused = false; window._prologueActive = false; const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none'; } catch (e) {} });
for (const [id, depth] of [['coralReef', 'top'], ['coralReef', 'mid'], ['coralReef', 'bottom']]) {
  await p.evaluate(({ id, depth }) => {
    loadMap(id); game.paused = false;
    const md = game.mapData; const wh = md.worldHeight || 560;
    const y = depth === 'top' ? 100 : depth === 'mid' ? wh / 2 : wh - 160;
    player.x = 500; player.y = y; player.vy = 0;
    for (let i = 0; i < 120; i++) updateCamera();
  }, { id, depth });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/uw_${id}_${depth}.png`, timeout: 60000, animations: "disabled" }).catch(e => console.log("shot fail", depth, String(e).slice(0,80)));
}
await b.close();
console.log('saved');
