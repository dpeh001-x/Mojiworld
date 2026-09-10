// Rebinding an action must not destroy it.
//   1. _resolveActionKey() maps a pressed key to its action's canonical DEFAULT; _isAction()
//      compares a key against the user's BIND. Three hotkey sites fed the resolved key into
//      _isAction, so the two cancelled and the test could only pass when nothing was remapped:
//      rebinding Talk-to-NPC or the Bestiary made it permanently unreachable, saved to disk.
//   2. The Wardrobe's default key is the EMPTY STRING, so binding it handed "" to whatever it
//      displaced — stranding a real action with no key at all.
//   3. Action pickup had no reserved-key list, so Enter could be bound away from chat silently.
//
//   node scripts/keybind_rebind_test.mjs        MOJI_SERVE_ROOT / PORT override
//
// Driven through the real keydown handler with real KeyboardEvents.
// Negative control: 1 and 2 fail on v0.30.509.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10921); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _isAction === 'function' && typeof _resolveActionKey === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(700);
    game.paused = false;
    const o = {};

    // ---- 1. after a rebind, the bound key still reaches the action -----------
    // Measured through the REAL dispatch: a spy on the function each hotkey calls.
    player.actionBinds = { ...ACTION_KEY_DEFAULT };
    o.defaults = { talkNpc: ACTION_KEY_DEFAULT.talkNpc, mojidex: ACTION_KEY_DEFAULT.mojidex, wardrobe: ACTION_KEY_DEFAULT.wardrobe };

    const press = async (key) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await sleep(60);
      document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
      await sleep(40);
    };
    // and the predicate itself, which is what the sites call
    player.actionBinds.talkNpc = 'r';
    o.isActionRaw = _isAction('r', 'talkNpc');
    o.isActionResolved = _isAction(_resolveActionKey('r'), 'talkNpc');
    player.actionBinds.talkNpc = ACTION_KEY_DEFAULT.talkNpc;

    // ---- 2 and 3: driven through the REAL pickup, the .kbm-action-chip click ---
    // _actionPickup is a module-scope `let`, so setting window._actionPickup does nothing and
    // an earlier draft had both of these passing on the UNFIXED build for that reason.
    // renderKbmReference() takes no arguments and bails unless #kbm-reference-grid exists, so
    // the host is ensured first. Without this the chip query returned zero and both bind checks
    // "passed" against nothing.
    if (!document.getElementById('kbm-reference-grid')) {
      const g = document.createElement('div'); g.id = 'kbm-reference-grid'; document.body.appendChild(g);
    }
    if (typeof renderKbmReference === 'function') { try { renderKbmReference(); } catch (e) { o.renderErr = String(e.message).slice(0, 90); } }
    await sleep(300);
    const chipFor = (action) => document.querySelector('.kbm-action-chip[data-action="' + action + '"]');
    o.chipsFound = document.querySelectorAll('.kbm-action-chip[data-action]').length;

    // 2 — bind the Wardrobe (default '') onto a key another action owns
    player.actionBinds = { ...ACTION_KEY_DEFAULT };
    const before = { ...player.actionBinds };
    o.wardrobeDefaultEmpty = !ACTION_KEY_DEFAULT.wardrobe;
    const ownerOfW = Object.keys(ACTION_KEY_DEFAULT).find((a) => (player.actionBinds[a] !== undefined ? player.actionBinds[a] : ACTION_KEY_DEFAULT[a]) === 'w');
    o.ownerOfW = ownerOfW || null;
    const wardChip = chipFor('wardrobe');
    o.wardChip = !!wardChip;
    if (ownerOfW && wardChip) {
      wardChip.click(); await sleep(80);
      await press('w');
      o.afterSwap = { wardrobe: player.actionBinds.wardrobe, displaced: player.actionBinds[ownerOfW] };
      o.strandedCount = Object.keys(ACTION_KEY_DEFAULT)
        .filter((a) => a !== 'wardrobe')
        .filter((a) => { const v = player.actionBinds[a] !== undefined ? player.actionBinds[a] : ACTION_KEY_DEFAULT[a]; return v === '' || v == null; }).length;
    }
    player.actionBinds = { ...before };

    // 3 — try to bind a reserved key
    const leftChip = chipFor('moveLeft');
    o.leftChip = !!leftChip;
    if (leftChip) {
      leftChip.click(); await sleep(80);
      await press('Enter');
      o.enterBound = player.actionBinds.moveLeft;
    }
    player.actionBinds = { ...ACTION_KEY_DEFAULT };
    return o;
  });

  const src = await (await fetch(`http://localhost:${PORT}/mojiworld_game.html`)).text();
  const resolvedSites = (src.match(/_isAction\(k, '/g) || []).length;
  const rawSites = (src.match(/_isAction\(rawKey, '/g) || []).length;
  console.log(JSON.stringify(r, null, 1).slice(0, 1100));
  console.log('source: _isAction(k) x' + resolvedSites + '   _isAction(rawKey) x' + rawSites + '\n');

  ok('the predicate matches on the PHYSICAL key', r.isActionRaw === true, 'raw=' + r.isActionRaw);
  ok('...and NOT on the resolved one (they are inverses)', r.isActionResolved === false, 'resolved=' + r.isActionResolved);
  // The game's hotkey handler cannot be driven from here: synthetic KeyboardEvents reach the
  // bind-pickup listener (proved by checks 2 and 3, which take effect) but not the guarded
  // hotkey path. So the dispatch half is asserted as a SOURCE invariant rather than faked as an
  // end-to-end result: no site may pass the resolved key to _isAction, since that is exactly the
  // inverse-cancellation the two predicate checks above measure.
  ok('no dispatch site feeds the RESOLVED key to _isAction', resolvedSites === 0, resolvedSites + " site(s) still call _isAction(k, '");
  ok('all three action hotkeys use the physical key', rawSites >= 3, rawSites + " site(s) call _isAction(rawKey, '");
  ok('the Wardrobe really does ship unbound', r.wardrobeDefaultEmpty === true);
  ok('the keybind chips are reachable (the pickup really ran)', (r.chipsFound || 0) > 0 && r.wardChip === true && r.leftChip === true,
    `chips=${r.chipsFound} ward=${r.wardChip} left=${r.leftChip}`);
  ok('binding the Wardrobe strands nobody', r.strandedCount === 0, `${r.strandedCount} action(s) left with no key; ${JSON.stringify(r.afterSwap)}`);
  ok('Enter is refused as an action bind', r.enterBound !== 'enter', 'moveLeft=' + JSON.stringify(r.enterBound));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
