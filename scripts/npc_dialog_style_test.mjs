// NPC dialog restyle: painted backdrop + chunky option buttons.
//
// Per user: "Create a better background image and UI buttons for NPCs."
// Asserts COMPUTED styles on a rendered dialog, not CSS text — and (per the
// banner incident) that the backdrop art actually decodes at its new size
// rather than the old 6KB texture the gradients used to bury.
//   node scripts/npc_dialog_style_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const ART = 'Sprites/ui/npc_dialog_bg.webp';
ok('the backdrop art ships (new painted art, not the old 6KB texture)',
   existsSync(ART) && statSync(ART).size > 15000 && statSync(ART).size < 300000,
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
  // stage the dialog exactly as openNPC renders it, without needing an NPC
  const dlg = document.getElementById('dialog');
  const optDiv = document.getElementById('dialog-options');
  optDiv.innerHTML = '';
  const mk = (t, cls) => { const b2 = document.createElement('button'); b2.textContent = t; if (cls) b2.className = cls; optDiv.appendChild(b2); return b2; };
  const shop = mk('🛒 Shop — buy & sell', 'opt-shop');
  const plain = mk('✦ Improve — enhance · reforge');
  const action = mk('⚔ Spar with the smith', 'opt-action');
  const leave = mk('Leave', 'opt-leave');
  dlg.style.display = 'block';

  const cs = (el) => getComputedStyle(el);
  out.panelBg = cs(dlg).backgroundImage;
  out.artInStack = /npc_dialog_bg\.webp/.test(out.panelBg);
  // the mid violet wash must be light enough for the art to read (0.24, not 0.55)
  out.lightWash = /rgba\(30, 16, 50, 0\.24\)/.test(out.panelBg);
  // and the art itself must decode at the new authored size
  out.art = await new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ ok: true, w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => res({ ok: false });
    im.src = 'Sprites/ui/npc_dialog_bg.webp?t=' + performance.now();
  });

  const btn = cs(plain), gold = cs(shop), grey = cs(leave), red = cs(action);
  out.btn = { radius: btn.borderRadius, pad: btn.padding, weight: btn.fontWeight,
    ledge: /0px 3px 0px/.test(btn.boxShadow), keyline: /1\.5px/.test(btn.boxShadow) };
  out.gold = { darkText: gold.color, gradient: gold.backgroundImage.includes('255, 223, 138') || gold.backgroundImage.includes('rgb(255, 223, 138)') };
  out.grey = { tint: grey.backgroundImage.includes('109, 98, 128') || grey.backgroundImage.includes('rgb(109, 98, 128)'), dimmed: parseFloat(grey.opacity) < 1 };
  out.red = { tint: red.backgroundImage.includes('224, 106, 126') || red.backgroundImage.includes('rgb(224, 106, 126)') };
  // gloss band: the 4-stop gradient has stops at 46% and 54%
  out.glossBand = btn.backgroundImage.includes('46%') && btn.backgroundImage.includes('54%');

  dlg.style.display = 'none'; optDiv.innerHTML = '';
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('art:', JSON.stringify(r.art), '| inStack:', r.artInStack, '| lightWash:', r.lightWash);
console.log('btn:', JSON.stringify(r.btn), '| gloss:', r.glossBand);
console.log('gold:', JSON.stringify(r.gold), '| grey:', JSON.stringify(r.grey), '| red:', JSON.stringify(r.red));

ok('the painted backdrop is in the panel background stack', r.artInStack === true, {});
ok('the violet wash over it is light (0.24) — the art can actually be seen',
   r.lightWash === true, { bg: (r.panelBg || '').slice(0, 120) });
ok('the art DECODES at its authored 768px size', r.art.ok === true && r.art.w === 768 && r.art.h === 768, r.art);
ok('buttons are the chunky build (11px radius, 700 weight)',
   r.btn.radius === '11px' && r.btn.weight === '700', r.btn);
ok('buttons carry the underside ledge + dark keyline ring', r.btn.ledge && r.btn.keyline, r.btn);
ok('buttons bake a hard gloss band (46/54% gradient stops)', r.glossBand === true, {});
ok('shop buttons: gold coinage with espresso text',
   r.gold.gradient === true && r.gold.darkText === 'rgb(64, 38, 10)', r.gold);
ok('Leave: dimmed slate glass', r.grey.tint === true && r.grey.dimmed === true, r.grey);
ok('action buttons: crimson tint', r.red.tint === true, r.red);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
