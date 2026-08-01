// UI injection test (v0.29.372). Feeds hostile markup into every player- or
// network-controlled string that reaches a UI render, then opens the panel and
// checks whether it EXECUTED or became live DOM. Detection uses a real global
// side-effect counter plus a marker element, so a false negative isn't possible.
//
// The vector this exists for: _mpPushLog writes its argument straight into
// innerHTML. The chat and error paths escape before calling it, but the room
// code did not — and a room code is a SHARED string ("join room X"), so a
// hostile code pasted from someone else would have run in your client.
//   node scripts/ui_injection_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8936)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8936;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const out = { cases: [] };
  window.__pwned = 0;
  const PAY = '<img src=x onerror="window.__pwned=(window.__pwned||0)+1">';
  const TAG = '<blockquote class="lx-inject-probe">x</blockquote>';
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  for (const id of ['story-beat-overlay', 'boss-intro-overlay']) {
    const el = document.getElementById(id); if (el && el.classList) el.classList.remove('on');
  }
  player.cls = player.cls || 'warrior'; player.level = 50; player.hp = 5000; player.maxHp = 5000;
  player.mojicoins = 100000;
  const arena = Object.entries(MAPS).find(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).length);
  if (arena) loadMap(arena[0]);

  const probe = (name, setup, render) => {
    const before = window.__pwned | 0;
    document.querySelectorAll('.lx-inject-probe').forEach(e => e.remove());
    let threw = null;
    try { setup(); } catch (e) { threw = 'setup: ' + String(e).slice(0, 80); }
    try { closeAllModals(); render(); } catch (e) { threw = threw || ('render: ' + String(e).slice(0, 80)); }
    out.cases.push({ name, executed: (window.__pwned | 0) > before,
                     liveTag: document.querySelectorAll('.lx-inject-probe').length > 0, threw });
    try { closeAllModals(); } catch (e) {}
  };

  probe('inventory item name', () => {
    player.inventory = [{ name: PAY + TAG + 'Sword', slot: 'weapon', atk: 5, rarity: 'common', id: 'inj1' }];
  }, () => { if (typeof openInventory === 'function') openInventory();
             else if (typeof renderInventory === 'function') renderInventory(); });

  probe('shop item name', () => {
    player.inventory = [{ name: PAY + TAG + 'Blade', slot: 'weapon', atk: 5, rarity: 'rare', id: 'inj2' }];
  }, () => { if (typeof openShop === 'function') openShop('general'); });

  probe('multiplayer peer name', () => {
    net.peers = { 9: { id: 9, name: PAY + TAG + 'Peer', map: game.currentMap, x: 0, y: 0, _last: performance.now() } };
  }, () => { if (typeof openMultiplayer === 'function') openMultiplayer();
             if (typeof _mpRenderPlayerList === 'function') _mpRenderPlayerList(); });

  // network chat, through the REAL receive path (which must escape)
  probe('network chat frame', () => {
    net.myId = 2; net.peers = { 9: { id: 9, name: 'Peer', map: game.currentMap, x: 0, y: 0, _last: performance.now() } };
  }, () => { if (typeof _mpHandle === 'function')
      _mpHandle({ t: 'chat', id: 9, name: PAY + TAG + 'N', text: PAY + TAG + 'hello' }); });

  // server-supplied room, through the REAL welcome path
  probe('welcome room name', () => { net.myId = null; },
    () => { if (typeof _mpHandle === 'function')
      _mpHandle({ t: 'welcome', id: 2, room: PAY + TAG + 'room', players: [] }); });

  // the room code YOU type or paste — reaches the connect log line
  probe('typed/pasted room code', () => {},
    () => { if (typeof mpConnect === 'function') {
      try { mpConnect('ws://127.0.0.1:1', 'me', PAY + TAG + 'myroom'); } catch (e) {}
      // the "Connected" line only fires on socket open; assert the stored value
      // is already scrubbed, which is what the log line renders
      out.roomIdStored = String(net.roomId || '');
    } });

  probe('co-op drop item name', () => {
    net.isHost = false; net.hostId = 7; net.myId = 2; net.connected = true;
    net.ws = { readyState: 1, send() {} };
    net.peers = { 7: { id: 7, name: 'H', map: game.currentMap, x: 0, y: 0, _last: performance.now() } };
    if (typeof _mpHandle === 'function') _mpHandle({ t: 'drop', id: 7, map: game.currentMap, u: 555001,
      k: 'item', x: 100, y: 100, it: { name: PAY + TAG + 'Loot', slot: 'weapon', atk: 1 } });
  }, () => {
    const d = (game.drops || []).find(x => x._coopMirror);
    if (d && typeof showItemTooltip === 'function') { try { showItemTooltip(d.item, 10, 10); } catch (e) {} }
  });

  probe('toast text', () => {}, () => { if (typeof showToast === 'function') showToast(PAY + TAG + 'note', 'rare'); });

  try { if (typeof mpDisconnect === 'function') mpDisconnect(); } catch (e) {}
  net.connected = false; net.ws = null; net.peers = {}; net.hostId = null; net.myId = null;
  player.inventory = [];
  out.totalPwned = window.__pwned | 0;
  return out;
});

const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
for (const c of o.cases) {
  ok(`${c.name}: no script execution`, !c.executed);
  ok(`${c.name}: no live markup injected`, !c.liveTag);
  if (c.threw) ok(`${c.name}: renders without throwing`, false, c.threw);
}
ok('room code is scrubbed before it can reach the log sink',
   !/[<>]/.test(o.roomIdStored || ''), `net.roomId = ${JSON.stringify((o.roomIdStored || '').slice(0, 60))}`);
ok('zero payload executions overall', o.totalPwned === 0, `${o.totalPwned}`);

for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}${t.e ? '  (' + t.e + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} injection assertions pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 4));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
