// Verifies tall underwater maps express their FULL vertical height in game:
// camera follows the player down, world bottom is reachable/framed, and the
// background paints the whole viewport at depth (no void band).
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
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const page = await browser.newContext().then(c => c.newPage());
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof MAPS === 'object' && typeof loadMap === 'function' && typeof game === 'object', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { player.cls = player.cls || 'warrior'; game.paused = false; window._prologueActive = false; } catch (e) {} });

  for (const mapId of ['coralReef', 'abyssalTrench', 'kelpForest', 'bubbleGrotto']) {
    const r = await page.evaluate(async (id) => {
      loadMap(id); game.paused = false;
      const md = game.mapData;
      const wh = md.worldHeight || 560;
      // teleport to the bottom ground
      const ground = (md.platforms || []).filter(p => p.type === 'ground').sort((a, b) => b.y - a.y)[0];
      player.x = 400; player.y = ground.y - player.h; player.vy = 0; player.onGround = true;
      // run real frames so the camera lerps
      for (let i = 0; i < 240; i++) { try { updateCamera(); } catch (e) { return { id, err: String(e) }; } }
      const H = 560;
      const camY = game.camera.y;
      const playerScreenY = player.y - camY;
      return {
        id, wh, tower: !!md.isVerticalTower, groundY: ground.y,
        camY: Math.round(camY),
        camAtBottom: Math.abs(camY - (wh - H)) < 60,
        playerVisible: playerScreenY > 0 && playerScreenY < H,
      };
    }, mapId);
    if (r.err) { ok(mapId + ': ran without error', false, r.err); continue; }
    ok(r.id + ': camera follows to the bottom (' + r.wh + 'px world)', r.camAtBottom, r);
    ok(r.id + ': player at the floor is framed on screen', r.playerVisible, r);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
