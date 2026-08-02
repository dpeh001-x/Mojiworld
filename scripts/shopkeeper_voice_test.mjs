// Open every smith and potion seller and read back the dialogue actually
// rendered: each must name ITSELF and no one else.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof openNPC === 'function' && typeof MAPS !== 'undefined', { timeout: 60000 });

const res = await page.evaluate(() => {
  const found = [];
  for (const id of Object.keys(MAPS)) {
    for (const n of (MAPS[id].npcs || [])) {
      if (n && (n.role === 'weapon' || n.role === 'potion')) found.push(n);
    }
  }
  const NAMES = ['Brok', 'Barnaby', 'Oakhart', 'Nurse Joyce', 'Petunia'];
  // the dialogue is revealed by _runDialogTypewriter, so #dialog-text is empty
  // the instant openNPC returns — capture the string it is handed instead.
  let captured = '';
  const origTw = window._runDialogTypewriter;
  window._runDialogTypewriter = function (t) { captured = String(t == null ? '' : t); };
  const out = [];
  for (const npc of found) {
    const screens = {};
    for (const menu of (npc.role === 'weapon' ? [null, 'shop', 'improve', 'craft'] : [null])) {
      game._brokMenu = menu;
      captured = '';
      let txt = '';
      try { openNPC(npc); txt = captured; }
      catch (e) { txt = 'THREW: ' + e.message; }
      screens[menu || 'main'] = txt;
    }
    game._brokMenu = null;
    const all = Object.values(screens).join(' ');
    out.push({
      name: npc.name, role: npc.role,
      namesSelf: all.includes(npc.name),
      foreign: NAMES.filter((x) => x !== npc.name && all.includes(x)),
      threw: /THREW:/.test(all),
      main: (screens.main || '').slice(0, 150).replace(/\s+/g, ' '),
    });
  }
  return out;
});
await browser.close();

let bad = 0;
for (const r of res) {
  const ok = r.namesSelf && !r.foreign.length && !r.threw;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(13)} (${r.role})  self=${r.namesSelf}  foreign=${r.foreign.join(',') || 'none'}${r.threw ? '  THREW' : ''}`);
  console.log(`       "${r.main}…"\n`);
}
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
console.log(bad ? `${bad} shopkeeper(s) still wrong.` : `all ${res.length} shopkeepers speak as themselves.`);
process.exit(bad || errs.length ? 1 : 0);
