// World-map label placement, second round and young maps (round2-seat).
// _wmDeoverlapLabels seats every name in a first round, then re-seats whatever still sits on something. The second round
// measured a label where its first round had put it but offset every candidate from its AUTHORED seat, so it judged
// every seat in a frame shifted by the first move: a name that had to settle for a crowded seat "found" one that was
// clean only in the shifted frame and moved onto what it had been avoiding. And (per user) a young map - few places
// discovered - keeps its names the way the close view does, so fixing the judgement does not cost a new character a name.
// Built on synthetic diagrams in the real game page, calling the shipped function, so no pin layout can move the result:
//   [1] a name every seat of which is crowded ends on its least crowded seat - the second round does not "find" a
//       better one that is better only in a shifted frame
//   [2] in a young map a name that has to sit on something is still drawn
//   [3] ...while in a well-explored map the same name is left out (the drop rule itself is unchanged)
//   [4] no page errors
// Against main [1] and [2] fail; against the fix all hold.
//   node scripts/worldmap_label_round2_test.mjs [page.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 9957);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
const res = [];
const ok = (n, c, x) => { res.push({ n, pass: !!c }); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x === undefined ? '' : '  ' + JSON.stringify(x).slice(0, 400)}`); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: '' } });
let browser;
try {
  await new Promise((r) => setTimeout(r, 1500));
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _wmDeoverlapLabels === 'function' && typeof _wmPlaceNodeLabel === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const NS = 'http://www.w3.org/2000/svg';
    // the names' seat ring, read out of the shipped function so the test follows it
    const m = /const SEATS = (\[[\s\S]*?\n {2}\]);/.exec(_wmDeoverlapLabels.toString());
    const SEATS = Function('"use strict"; return ' + m[1].replace(/\/\/[^\n]*/g, ''))();
    const board = (band, sparse) => {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;z-index:2147483647;background:#fff';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 800 600'); svg.setAttribute('width', '800'); svg.setAttribute('height', '600');
      svg.setAttribute('data-wm-zoom', band); if (sparse) svg.classList.add('wm-sparse');
      host.appendChild(svg); document.body.appendChild(host);
      const node = (id, x, y, rad) => {
        const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'wm-node'); g.setAttribute('data-map-id', id); g.setAttribute('transform', `translate(${x},${y})`);
        const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', 'wm-disc'); c.setAttribute('r', rad); c.setAttribute('fill', '#888'); g.appendChild(c); svg.appendChild(g); return g;
      };
      const g = node('here', 400, 300, 21);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'wm-node-label wm-lbl ' + (band === 'far' ? 'wm-lbl-far' : 'wm-lbl-mid'));
      t.setAttribute('font-size', '14'); t.setAttribute('style', 'font-size:14px;font-family:Arial,sans-serif;opacity:1');
      t.setAttribute('x', '0'); t.setAttribute('y', '55'); t.setAttribute('text-anchor', 'middle'); t.textContent = 'Test Place'; g.appendChild(t);
      return { host, svg, t, node };
    };
    // an obstacle disc in the middle of the label's box at every seat: the one at `easy` small, the rest bigger
    const crowd = (B, easy) => {
      const sr = B.svg.getBoundingClientRect(), centres = [];
      for (const [sx, sy, a] of SEATS) { _wmPlaceNodeLabel(B.t, sx, sy, a); const b = B.t.getBoundingClientRect(); centres.push([(b.left + b.right) / 2 - sr.left, (b.top + b.bottom) / 2 - sr.top]); }
      centres.forEach(([x, y], i) => B.node('o' + i, x, y, i === easy ? 3 : 6));
      _wmPlaceNodeLabel(B.t, 0, 55, 'middle'); B.t.removeAttribute('data-y0');
    };
    // what the label really sits on at a seat: the pass's own measure (overlap area + 40 for every disc it touches)
    const realCost = (B, seat) => {
      const save = [B.t.getAttribute('x'), B.t.getAttribute('y'), B.t.getAttribute('text-anchor')];
      if (seat) _wmPlaceNodeLabel(B.t, seat[0], seat[1], seat[2]);
      const b = B.t.getBoundingClientRect(); let cost = 0;
      for (const c of B.svg.querySelectorAll('g.wm-node:not([data-map-id="here"]) .wm-disc')) {
        const d = c.getBoundingClientRect(), w = Math.min(b.right, d.right) - Math.max(b.left, d.left), h = Math.min(b.bottom, d.bottom) - Math.max(b.top, d.top);
        if (b.left - 3 < d.right && b.right + 3 > d.left && b.top - 3 < d.bottom && b.bottom + 3 > d.top) cost += Math.max(0, w) * Math.max(0, h) + 40;
      }
      _wmPlaceNodeLabel(B.t, save[0], save[1], save[2]);
      return cost;
    };
    const out = { seats: SEATS.length };
    // [1] every seat crowded; the far-over seat least. The second round must leave the name there.
    const easy = SEATS.findIndex(([x, y]) => x === 0 && y === Math.min(...SEATS.map((s) => s[1])));
    const B1 = board('far', false); crowd(B1, easy);
    _wmDeoverlapLabels(B1.svg);
    const at = [B1.t.getAttribute('x'), B1.t.getAttribute('y'), B1.t.getAttribute('text-anchor')].join(' ');
    const costs = SEATS.map((s) => realCost(B1, s));
    out.one = { easy: SEATS[easy].join(' '), endedAt: at, costThere: realCost(B1, null), least: Math.min(...costs) };
    B1.host.remove();
    // [2] + [3] the same crowding with no easy seat, in the mid view: young map vs explored map
    for (const [key, sparse] of [['young', true], ['explored', false]]) {
      const B = board('mid', sparse); crowd(B, -1);
      _wmDeoverlapLabels(B.svg);
      out[key] = { dropped: B.t.classList.contains('wm-lbl-drop'), cost: realCost(B, null) };
      B.host.remove();
    }
    return out;
  });
  ok('[1] a name whose every seat is crowded ends on its least crowded one (the second round judges from where it stands)', r.one.costThere <= r.one.least + 0.5, r.one);
  ok('[2] in a young map a name that has to sit on something is still drawn', r.young && r.young.dropped === false, r.young);
  ok('[3] ...while in a well-explored map the same name is left out', r.explored && r.explored.dropped === true, r.explored);
  ok('[4] no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) {
  ok('the run completes', false, String(e && e.message || e).slice(0, 300));
} finally {
  try { if (browser) await browser.close(); } catch (e) {}
  server.kill();
}
const f = res.filter((x) => !x.pass).length;
console.log(f ? `FAIL(${f})` : 'ALL PASS');
process.exit(f ? 1 : 0);
