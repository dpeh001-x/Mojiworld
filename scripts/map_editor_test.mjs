// Standalone map_editor.html certification: click-to-place, drag-to-move,
// property edits, export format (must match the game's _lxSeFmt), and import.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'file:///home/user/Mojiworld/map_editor.html';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
try {
  const page = await browser.newContext().then(c => c.newPage());
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof state === 'object' && state.npcs, null, { timeout: 10000 });

  // Boot layout: 1 NPC + 1 portal seeded.
  const boot = await page.evaluate(() => ({ n: state.npcs.length, p: state.portals.length }));
  ok('boots with starter NPC + portal', boot.n === 1 && boot.p === 1, boot);

  const rect = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, cw: cv.width, ch: cv.height }; });
  const toClient = (wx, wy) => ({ x: rect.l + wx * (rect.w / rect.cw), y: rect.t + wy * (rect.h / rect.ch) });

  // 1) Arm NPC tool → click canvas → an NPC lands at ~those world coords.
  await page.click('#addNpc');
  const armed = await page.evaluate(() => state.mode);
  ok('NPC tool arms', armed === 'npc');
  let c = toClient(700, 300);
  await page.mouse.click(c.x, c.y);
  const afterPlace = await page.evaluate(() => ({ n: state.npcs.length, last: state.npcs[state.npcs.length - 1], mode: state.mode }));
  ok('click places a new NPC', afterPlace.n === 2, afterPlace);
  ok('placed NPC near click world-x (700±20)', Math.abs(afterPlace.last.x - 700) <= 20, afterPlace.last);
  ok('tool disarms after placing', afterPlace.mode === null, afterPlace);

  // 2) Drag that NPC to a new spot.
  const from = toClient(afterPlace.last.x, afterPlace.last.y);
  const to = toClient(1000, 260);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => state.npcs[state.npcs.length - 1]);
  ok('drag moves the NPC toward drop point (x~1000)', Math.abs(afterDrag.x - 1000) <= 25, afterDrag);

  // 3) Place a portal via the tool.
  await page.click('#addPortal');
  c = toClient(500, 420);
  await page.mouse.click(c.x, c.y);
  const pc = await page.evaluate(() => ({ p: state.portals.length, last: state.portals[state.portals.length - 1] }));
  ok('portal tool places a portal', pc.p === 2 && pc.last.dest === 'town', pc);

  // 4) Edit selected portal fields via the property editor.
  await page.fill('#fdest', 'forest');
  await page.fill('#fname', '▶ Whisperwood');
  await page.check('#fstar');
  const edited = await page.evaluate(() => state.portals[state.portals.length - 1]);
  ok('portal dest/name/star edits apply', edited.dest === 'forest' && edited.name === '▶ Whisperwood' && edited.iconStar === true, edited);

  // 5) Export produces valid, paste-ready npcs/portals arrays that re-parse.
  await page.click('#exportBtn');
  const out = await page.evaluate(() => $('out').value);
  ok('export contains both keys', /npcs:\s*\[/.test(out) && /portals:\s*\[/.test(out), out.slice(0, 60));
  // Extract each array body and eval it the way the game would when hardbaked.
  const evalArr = (label) => {
    const m = out.match(new RegExp(label + ':\\s*(\\[[\\s\\S]*?\\]),'));
    return Function('"use strict";return (' + m[1] + ');')();
  };
  let parsedNpcs, parsedPortals, parseErr = null;
  try { parsedNpcs = evalArr('npcs'); parsedPortals = evalArr('portals'); } catch (e) { parseErr = String(e); }
  ok('exported npcs array re-parses as JS', Array.isArray(parsedNpcs) && parsedNpcs.length === 2, parseErr || parsedNpcs);
  ok('exported portals array re-parses as JS', Array.isArray(parsedPortals) && parsedPortals.length === 2, parseErr || parsedPortals);
  ok('exported portal keeps iconStar + string dest', parsedPortals.some(p => p.dest === 'forest' && p.iconStar === true), parsedPortals);
  ok('exported NPC has x,y,name,role,color', parsedNpcs.every(n => 'x' in n && 'y' in n && 'name' in n && 'role' in n && 'color' in n), parsedNpcs);
  ok("no _-prefixed keys leaked into export", !/\b_[a-zA-Z]+:/.test(out), out);

  // 6) Import round-trips: paste a hand array and load as NPCs.
  await page.fill('#imp', "npcs: [ {x:200, y:434, name:'Milo', role:'usher', color:'#4a8acc'}, {x:900, y:279, name:'DJ Vinyl', role:'jukebox', color:'#ff44aa'} ]");
  await page.click('#impNpc');
  const imp = await page.evaluate(() => state.npcs.map(n => n.name));
  ok('import adds 2 NPCs from a pasted array', imp.filter(n => n === 'Milo' || n === 'DJ Vinyl').length === 2, imp);

  // 7) Clear-all wipes everything (dialog auto-accepted).
  page.on('dialog', d => d.accept());
  await page.click('#clearAll');
  const cleared = await page.evaluate(() => ({ n: state.npcs.length, p: state.portals.length }));
  ok('clear-all empties both lists', cleared.n === 0 && cleared.p === 0, cleared);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
