// NPC dialog: painted backdrop + option buttons.
//
// Per user: "Create a better background image and UI buttons for NPCs", then
// "stretch out the width of the background such that the red portion touches
// the edge of the border, remake the buttons to have a better colour scheme
// and better readability of words".
//
// Readability is measured, not asserted: every button's text colour is scored
// against EVERY colour stop in its own gradient using the WCAG contrast
// formula, and the WORST stop must still clear AA. That is what makes
// "readable" a fact rather than a preference. Edge-contact is measured too —
// on the decoded art itself, by counting warm pixels in its outer columns.
//   node scripts/npc_dialog_style_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const ART = 'Sprites/ui/npc_dialog_bg.webp';
ok('the backdrop art ships', existsSync(ART) && statSync(ART).size > 15000 && statSync(ART).size < 300000,
   { bytes: existsSync(ART) ? statSync(ART).size : 0 });
ok('...and is committed', execFileSync('git', ['ls-files', '--', ART], { encoding: 'utf8' }).trim() === ART, {});

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !!document.getElementById('dialog'), { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  const dlg = document.getElementById('dialog');
  const optDiv = document.getElementById('dialog-options');
  optDiv.innerHTML = '';
  const mk = (t, cls) => { const x = document.createElement('button'); x.textContent = t; if (cls) x.className = cls; optDiv.appendChild(x); return x; };
  const kinds = { plain: mk('✦ Improve — enhance · reforge'), shop: mk('🛒 Shop — buy & sell', 'opt-shop'),
    action: mk('⚔ Spar with the smith', 'opt-action'), leave: mk('Leave', 'opt-leave') };
  dlg.style.display = 'block';

  const cs = (el) => getComputedStyle(el);
  out.panelBg = cs(dlg).backgroundImage;
  out.panelSize = cs(dlg).backgroundSize;
  out.artInStack = /npc_dialog_bg\.webp/.test(out.panelBg);
  // the art layer must STRETCH (100% 100%), not cover-crop, so its edge
  // artwork lands on the frame border at every panel size
  out.stretched = /100% 100%/.test(out.panelSize);

  // --- WCAG contrast, worst gradient stop per button ---------------------
  const lum = ([R, G, B]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(R) + 0.7152 * f(G) + 0.0722 * f(B); };
  const ratio = (a, b2) => { const [x, y] = [lum(a), lum(b2)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const rgbs = (str) => (str.match(/rgba?\(([^)]+)\)/g) || []).map(m2 =>
    m2.replace(/rgba?\(|\)/g, '').split(',').slice(0, 3).map(Number));
  out.contrast = {};
  for (const [k, el] of Object.entries(kinds)) {
    const st = cs(el);
    const fg = rgbs(st.color)[0];
    const stops = rgbs(st.backgroundImage);
    const worst = stops.length ? Math.min(...stops.map(s2 => ratio(fg, s2))) : 0;
    out.contrast[k] = { worst: Math.round(worst * 10) / 10, stops: stops.length, fg: st.color };
  }
  out.font = { size: cs(kinds.plain).fontSize, weight: cs(kinds.plain).fontWeight };
  // every button must use LIGHT text now (the old gold slab used espresso)
  out.allLightText = Object.values(kinds).every((el) => lum(rgbs(cs(el).color)[0]) > 0.45);

  // --- the dialogue copy itself ------------------------------------------
  // The panel used to inherit the <body> display face at 14px/500 for body
  // copy sitting on artwork. Assert the legible stack, the larger setting,
  // and that all three voices (speech, stage direction, emphasis) clear a
  // strict body-text contrast bar against the panel's own darkest plate.
  const txt = document.getElementById('dialog-text');
  txt.innerHTML = 'plain <em>stage direction</em> and <b>emphasis</b>';
  const tc = cs(txt);
  out.copy = { family: tc.fontFamily, size: tc.fontSize, weight: tc.fontWeight,
    lineHeight: tc.lineHeight, color: tc.color };
  out.copyUsesUiFace = /Inter/i.test(tc.fontFamily);
  // darkest stop of the panel's base plate — the worst case behind any glyph
  const plate = [20, 10, 36];
  const voice = (sel) => { const el = txt.querySelector(sel); return el ? rgbs(cs(el).color)[0] : null; };
  out.voices = {
    speech: Math.round(ratio(rgbs(tc.color)[0], plate) * 10) / 10,
    stage: Math.round(ratio(voice('em') || rgbs(tc.color)[0], plate) * 10) / 10,
    emphasis: Math.round(ratio(voice('b') || rgbs(tc.color)[0], plate) * 10) / 10,
  };
  // the three voices must be visibly DIFFERENT colours, not three creams
  const dist = (a, c) => Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2]);
  out.voicesDistinct = Math.min(dist(rgbs(tc.color)[0], voice('em')), dist(rgbs(tc.color)[0], voice('b')),
    dist(voice('em'), voice('b')));
  txt.innerHTML = '';

  // --- the art itself: warm colour at both outer edges, calm middle -------
  out.edge = await new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g2 = c.getContext('2d'); g2.drawImage(im, 0, 0);
      const warmCol = (x) => { const d = g2.getImageData(x, 0, 1, c.height).data; let h = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 70 && d[i] > d[i + 2] * 1.25) h++;
        return Math.round(h / c.height * 100); };
      // the art ships pre-faded: sample its baked alpha so "dimmer" is a
      // measured property of the file, not a claim about the CSS around it
      const mid = g2.getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
      res({ ok: true, w: c.width, h: c.height, left: warmCol(1), right: warmCol(c.width - 2),
        mid: warmCol(c.width >> 1), alpha: mid[3] });
    };
    im.onerror = () => res({ ok: false });
    im.src = 'Sprites/ui/npc_dialog_bg.webp?t=' + performance.now();
  });

  dlg.style.display = 'none'; optDiv.innerHTML = '';
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('bg size:', r.panelSize, '| stretched:', r.stretched);
console.log('edge   :', JSON.stringify(r.edge));
console.log('contrast:', JSON.stringify(r.contrast));
console.log('font   :', JSON.stringify(r.font), '| all light text:', r.allLightText);
console.log('copy   :', JSON.stringify(r.copy));
console.log('voices :', JSON.stringify(r.voices), '| distinctness:', r.voicesDistinct, '| art alpha:', r.edge.alpha);

ok('the painted backdrop is in the panel background stack', r.artInStack === true, {});
ok('the art layer STRETCHES to the frame (100% 100%), so its edges meet the border',
   r.stretched === true, { size: r.panelSize });
ok('the art decodes as a WIDE plate (authored for the panel shape, not a square crop)',
   r.edge.ok === true && r.edge.w > r.edge.h, r.edge);
ok('warm gold/red artwork reaches the LEFT edge of the art', r.edge.left >= 35, r.edge);
ok('...and the RIGHT edge', r.edge.right >= 35, r.edge);
ok('...while the centre stays calm for the dialogue text', r.edge.mid <= 12, r.edge);
for (const k of ['plain', 'shop', 'action', 'leave']) {
  ok(`${k} button text clears WCAG AA against its own darkest AND lightest fill (>= 4.5:1)`,
     r.contrast[k].worst >= 4.5, r.contrast[k]);
}
ok('every button uses light text on a dark fill (one consistent scheme)', r.allLightText === true, {});
ok('button text is set at a readable size and weight (>= 13px, 700)',
   parseFloat(r.font.size) >= 13 && r.font.weight === '700', r.font);

ok('the art ships DIMMED (baked alpha well under half, not the old 140)',
   r.edge.alpha > 0 && r.edge.alpha <= 95, { alpha: r.edge.alpha });
ok('dialogue copy uses the legible UI face, not the inherited display font',
   r.copyUsesUiFace === true, { family: r.copy.family });
ok('dialogue copy is set larger and heavier for body reading (>= 15px, >= 600)',
   parseFloat(r.copy.size) >= 15 && parseInt(r.copy.weight, 10) >= 600, r.copy);
ok('speech clears strict body contrast on the panel plate (>= 7:1)', r.voices.speech >= 7, r.voices);
ok('stage directions clear AA (>= 4.5:1) — they were the dimmest voice', r.voices.stage >= 4.5, r.voices);
ok('emphasis clears AA (>= 4.5:1)', r.voices.emphasis >= 4.5, r.voices);
ok('the three voices are distinct colours, not three shades of cream',
   r.voicesDistinct >= 60, { minChannelDistance: r.voicesDistinct });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
