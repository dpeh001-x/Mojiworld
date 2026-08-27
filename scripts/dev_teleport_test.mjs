// Dev Console teleport = W-map view certification.
//   1. The Teleport section renders the world-map SVG (galaxy diagram), not
//      the old flat button wall.
//   2. devMode reveals every node name (no "???" fog) and every node is
//      clickable (isAccessible forced ok).
//   3. Clicking a node teleports (devTeleport) — including UNVISITED maps.
//   4. Chip row covers every MAPS id missing from the diagram → ALL maps
//      teleportable (diagram nodes + chips == Object.keys(MAPS)).
//   5. devTeleport lands the player ON the ground line (no mid-air drop on
//      tall maps like frozenPeak / coralReef).
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
  await page.waitForFunction(() => typeof MAPS === 'object' && typeof openDevConsole === 'function' && typeof renderDev === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3000);

  // unlock dev tools + open the console
  const open = await page.evaluate(() => {
    localStorage.setItem('LX_DEV', '1');
    try { player.cls = player.cls || 'warrior'; game.paused = false; window._prologueActive = false; } catch (e) {}
    game.visitedMaps = { town: 1 };            // fresh-save fog: only town visited
    openDevConsole();
    const modal = document.getElementById('dev-modal');
    return { shown: modal && modal.style.display === 'flex' };
  });
  ok('dev console opens with LX_DEV=1', open.shown, open);

  // 1+2) W-map SVG present in the teleport section, names revealed, all clickable
  const view = await page.evaluate(() => {
    const modal = document.getElementById('dev-modal');
    const svg = modal.querySelector('svg');
    const nodes = svg ? [...svg.querySelectorAll('g')].filter(g => g.querySelector('circle')) : [];
    const texts = svg ? [...svg.querySelectorAll('text')].map(t => t.textContent) : [];
    const qm = texts.filter(t => t && t.trim() === '???').length;
    return { hasSvg: !!svg, nodeCount: nodes.length, fogged: qm };
  });
  ok('teleport section renders the W-map SVG diagram', view.hasSvg && view.nodeCount > 50, view);
  ok('devMode reveals ALL names (zero ??? fog labels)', view.fogged === 0, view);

  // 4) full coverage: diagram positions + chip row == every MAPS id
  const coverage = await page.evaluate(() => {
    const positions = _wmComputePositions().positions || {};
    const all = Object.keys(MAPS);
    const onMap = all.filter(id => positions[id]);
    const modal = document.getElementById('dev-modal');
    const chipLabels = [...modal.querySelectorAll('button')].map(b => b.textContent);
    const missing = all.filter(id => !positions[id]);
    const chipCovered = missing.filter(id => chipLabels.some(t => t.includes(MAPS[id].name || id)));
    return { total: all.length, onMap: onMap.length, missing: missing.length, chipCovered: chipCovered.length, uncovered: missing.filter(id => !chipCovered.includes(id)).slice(0, 5) };
  });
  ok('every map is reachable (diagram nodes + chips = ' + coverage.total + ')', coverage.onMap + coverage.chipCovered === coverage.total, coverage);

  // 3) click an UNVISITED node on the diagram → teleports there
  const nodeTp = await page.evaluate(() => {
    const positions = _wmComputePositions().positions || {};
    const target = Object.keys(positions).find(id => id !== game.currentMap && !(game.visitedMaps && game.visitedMaps[id]) && MAPS[id]);
    const modal = document.getElementById('dev-modal');
    const svg = modal.querySelector('svg');
    // find the node <g> whose <title> contains the target's name
    const g = [...svg.querySelectorAll('g')].find(el => { const t = el.querySelector('title'); return t && t.textContent.includes(MAPS[target].name); });
    if (!g) return { target, err: 'node not found' };
    g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { target, now: game.currentMap, moved: game.currentMap === target };
  });
  ok('clicking an UNVISITED diagram node teleports there', nodeTp.moved, nodeTp);

  // 5) grounded arrival on tall maps (frozenPeak ground y=14070)
  const tall = await page.evaluate(() => {
    devTeleport('frozenPeak');
    const g = (game.mapData.platforms || []).find(p => p.type === 'ground');
    return { map: game.currentMap, py: Math.round(player.y), groundY: g && g.y, onGround: player.onGround, feetOnGround: Math.abs((player.y + (player.h || 46)) - g.y) < 4 };
  });
  ok('devTeleport lands ON the ground line of a tall map (no freefall)', tall.map === 'frozenPeak' && tall.feetOnGround, tall);

  // chip teleport: The Void is diagram-hidden — chip must reach it
  const voidTp = await page.evaluate(() => {
    openDevConsole();
    const modal = document.getElementById('dev-modal');
    const chip = [...modal.querySelectorAll('button')].find(b => b.textContent.includes(MAPS.void.name));
    if (!chip) return { err: 'no void chip' };
    chip.click();
    return { now: game.currentMap };
  });
  ok('chip row teleports to a diagram-hidden map (The Void)', voidTp.now === 'void', voidTp);

  // regression: the normal W-key travel map still fogs unvisited maps
  const fog = await page.evaluate(() => {
    devTeleport('town');
    const host = document.createElement('div'); document.body.appendChild(host);
    _renderWorldMapDiagram(host, { mode: 'travel', isAccessible: () => ({ ok: true }) });
    const qm = [...host.querySelectorAll('text')].filter(t => t.textContent.trim() === '???').length;
    host.remove();
    return { fogged: qm };
  });
  ok('regression: normal travel W-map still fogs unvisited maps', fog.fogged > 10, fog);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
