// Co-op loot cannot carry a script into the item windows (v0.30.x coop-rarity).
//   node scripts/coop_rarity_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// A co-op guest mirrors the host's loot drops. Before the fix a host could send an item whose rarity was
// 'x" onmouseover="window.__pwn=1" data-y="': only < > were stripped, so the quote closed class="rarity-text-..." and
// the handler ran on hover - from the bag, the tooltip, the Forge, the Reforge bench and the sell desk, and on every
// load after, since the item rode the save. Drives the real receive handler (_mpHandle 'drop') as a guest following a
// host, picks the item up by walking over it, opens every item window, and loads a poisoned save through loadState.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11321';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _mpHandle === 'function' && typeof renderInventory === 'function' && typeof loadState === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0; player.inventory = []; game.drops = [];
    // a guest (id 9) following the elected host (id 3) on this map; a stub socket that swallows what we send
    net.connected = true; net.ws = { readyState: 1, send() {}, close() {} }; net.myId = 9;
    net.peers = { 3: { id: 3, name: 'Host', map: game.currentMap, x: player.x, y: player.y, cap: 3, _last: performance.now() } };
    window.__keepHost = setInterval(() => { const h = net.peers[3]; if (h) { h._last = performance.now(); h.map = game.currentMap; } net.hostId = 3; net.isHost = false; }, 250);
    net.hostId = 3; net.isHost = false;
    window.__u = 5000;
    // what the relay hands _mpHandle: a parsed JSON frame (JSON.parse reads 1e999 as Infinity)
    window.__frame = (it, extra) => JSON.parse(JSON.stringify(Object.assign({ t: 'drop', id: 3, map: game.currentMap, u: ++window.__u, k: 'item',
      x: Math.round(player.x + player.w / 2), y: Math.round(player.y + player.h / 2), it }, extra || {})).replace('"atk":987654321', '"atk":1e999'));
    // injected = a handler attribute carrying the payload, or the payload's own marker attributes (data-y / data-z)
    window.__scan = () => { let n = 0; const where = [];
      for (const el of document.querySelectorAll('*')) for (const a of el.attributes) {
        if (a.name === 'onmouseover' || a.name === 'data-y' || a.name === 'data-z' || (/^on/.test(a.name) && /__pwn/.test(a.value))) { n++; if (where.length < 4) where.push(el.tagName + '.' + el.className + ' @' + a.name); }
      }
      return { n, where }; };
    window.__fire = () => { for (const el of document.querySelectorAll('[onmouseover]')) { el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); el.dispatchEvent(new MouseEvent('mouseenter')); } };
    window.__close = () => { try { closeAllModals(); } catch (e) {} for (const id of ['inventory-modal', 'craft-modal', 'reforge-modal', 'shop-modal']) { const m = document.getElementById(id); if (m) m.style.display = 'none'; } game.paused = false; };
  });
  const tick = (n) => p.evaluate(async (n) => { const t0 = game.time, w0 = performance.now(); while (game.time - t0 < n && performance.now() - w0 < 30000) await new Promise((s) => setTimeout(s, 50)); return game.time - t0; }, n);
  const hits = [];   // injected attributes seen after each window, for the one summary check
  const scan = async (what) => { const r = await p.evaluate(() => { const r = __scan(); __fire(); return r; }); hits.push({ what, ...r }); return r; };

  // the two drops, through the real receive handler: a hostile one and an ordinary epic
  const sent = await p.evaluate(() => {
    const setId = Object.keys(SETS)[0];
    const evil = { name: 'Evil"><img src=x onerror="window.__pwn=1">Blade', baseName: 'Steel Blade', slot: 'weapon', icon: 'x', cls: 'any',
      rarity: 'x" onmouseover="window.__pwn=1" data-y="', stars: '2" onmouseover="window.__pwn=1" data-z="', tier: 3, dropLevel: 60,
      atk: 987654321, def: 5, affixes: ['savage'], setId, vis: { blade: '#fff"><b onmouseover="window.__pwn=1">' }, tag: 'evil1' };
    const base = ITEM_POOL.weapons.find((b) => b.name === "Hunter's Shortbow");
    const legit = rollAffixedItem({ ...base, slot: _catToSlot('weapons') }, 'epic', 30); legit.tag = 'legit1';   // the boss-drop shape
    _mpHandle(__frame(legit)); _mpHandle(__frame(evil));
    // the boon-orb frame, dropped out of reach so it is read before anyone collects it
    const orbs0 = (game.powerupOrbs || []).length;
    _mpHandle(__frame(null, { k: 'orb', rr: 'x" onmouseover="window.__pwn=1"', x: Math.round(player.x + 900) }));
    _mpHandle(__frame(null, { k: 'orb', rr: 'epic', x: Math.round(player.x + 950) }));
    const orbs = (game.powerupOrbs || []).slice(orbs0).map((o) => o.rarity);
    return { legit: JSON.parse(JSON.stringify(legit)), drops: game.drops.filter((d) => d._coopMirror).length, orbs };
  });
  check(sent.drops === 2, 'a guest following the host mirrors both drop frames onto its own map', sent);
  check(sent.orbs.length === 2 && sent.orbs[0] === 'common' && sent.orbs[1] === 'epic', "the host's boon-orb rarity is pinned to a known id (an ordinary one is kept)", sent.orbs);
  const got = await p.evaluate(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 90000 && !(player.inventory.some((i) => i && i.tag === 'evil1') && player.inventory.some((i) => i && i.tag === 'legit1'))) {
      for (const d of game.drops) if (d._coopMirror) { d.x = player.x + player.w / 2 - 10; d.y = player.y + player.h / 2 - 10; }
      await new Promise((s) => setTimeout(s, 100));
    }
    const e = player.inventory.find((i) => i && i.tag === 'evil1'), l = player.inventory.find((i) => i && i.tag === 'legit1');
    return { e: e ? JSON.parse(JSON.stringify(e)) : null, eAtk: e ? e.atk : null, l: l ? JSON.parse(JSON.stringify(l)) : null };
  });
  check(!!got.e && !!got.l, 'walking over them puts both mirrored items in the bag', { e: !!got.e, l: !!got.l });
  const e = got.e || {};
  check(e.rarity === 'common', "the hostile item's rarity is normalised to a known id", e.rarity);
  check(typeof e.stars === 'number' && Number.isFinite(e.stars) && Number.isFinite(got.eAtk), 'its stars (printed into aria-label) and its ATK (sent as 1e999) arrive as finite numbers', { stars: e.stars, atk: got.eAtk });
  const strs = []; (function walk(o) { for (const k in o) { if (typeof o[k] === 'string') strs.push(o[k]); else if (o[k] && typeof o[k] === 'object') walk(o[k]); } })(e);
  check(strs.length > 3 && strs.every((x) => !/["'`<>]/.test(x)), 'every string on it, nested ones too, has lost its quotes and angle brackets', strs.filter((x) => /["'`<>]/.test(x)));
  check(!!got.l && JSON.stringify(got.l) === JSON.stringify(sent.legit), "an ordinary epic drop arrives intact (\"Hunter's Shortbow\" keeps its apostrophe)", { sent: sent.legit.name + ' / ' + sent.legit.rarity, got: got.l && (got.l.name + ' / ' + got.l.rarity) });

  // every item window, hovered
  await p.evaluate(() => { const m = document.getElementById('inventory-modal'); m.style.display = 'flex'; game._invTab = 'equip'; renderInventory(''); });
  const slotSel = async (tag) => p.evaluate((tag) => { const i = player.inventory.findIndex((x) => x && x.tag === tag); return `#inv-grid .inv-slot[data-invidx="${i}"]`; }, tag);
  const hover = async (sel) => { try { await p.hover(sel, { timeout: 4000, force: true }); } catch (err) {} await p.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.dispatchEvent(new MouseEvent('mouseenter')); }, sel); await p.waitForTimeout(120); };
  await hover(await slotSel('evil1')); await scan('bag + tooltip');
  await p.evaluate(() => { const i = player.inventory.findIndex((x) => x && x.tag === 'legit1'); document.querySelector(`#inv-grid .inv-slot[data-invidx="${i}"]`).click(); renderInventory(''); });
  await hover(await slotSel('evil1')); await scan('tooltip with the compare lines');
  await p.evaluate(() => { const ev = player.inventory.find((x) => x && x.tag === 'evil1'); showGearChange(player.equipped.weapon, ev, 5); }); await scan('better-gear compare card');
  const eq = await p.evaluate(() => { const i = player.inventory.findIndex((x) => x && x.tag === 'evil1'); document.querySelector(`#inv-grid .inv-slot[data-invidx="${i}"]`).click(); renderInventory('');
    for (const el of document.querySelectorAll('.equip-slot')) el.dispatchEvent(new MouseEvent('mouseenter')); return player.equipped.weapon && player.equipped.weapon.tag; });
  await scan('equipped + its tooltip');
  await p.evaluate(() => { __close(); openCraftingModal(); }); await scan('the Forge lists');
  await p.evaluate(() => { __close(); openReforgeModal(); }); await scan('the Reforge bench + preview');
  await p.evaluate(() => { __close(); openShop('sell'); }); await scan('the sell desk');
  await p.evaluate(() => __close());
  const inj = hits.filter((h) => h.n > 0);
  check(eq === 'evil1' && inj.length === 0, 'bag, tooltip, compare, equipped slot, Forge, Reforge and sell desk: no element carries an injected attribute', { equipped: eq, inj });
  const pwn = await p.evaluate(() => window.__pwn);
  check(pwn === undefined, 'hovering everything never runs the payload (window.__pwn stays undefined)', pwn);

  // a save written before the fix: the poisoned item in the bag and in an equipped slot, loaded through loadState
  const sv = await p.evaluate(async () => {
    const poison = 'x" onmouseover="window.__pwn=1" data-y="';
    player.inventory.push({ name: 'Old Loot', baseName: 'Steel Blade', slot: 'weapon', icon: 'x', rarity: poison, stars: '1" onmouseover="window.__pwn=1" data-z="', tier: 2, atk: 10, tag: 'saved1' });
    player.equipped.armor = { name: 'Old "Coat"', slot: 'armor', icon: 'x', rarity: poison, tier: 2, def: 10, tag: 'saved2' };
    player.inventory.push({ name: 'Plain Epic', baseName: 'Steel Blade', slot: 'weapon', icon: 'x', rarity: 'epic', stars: 2, tier: 2, atk: 11, tag: 'saved3' });
    _flushSaveStateNow();
    const raw = localStorage.getItem(SAVE_KEY) || '';
    const ok = loadState();
    const a = player.inventory.find((x) => x && x.tag === 'saved1'), b = player.equipped.armor, c = player.inventory.find((x) => x && x.tag === 'saved3');
    return { stored: raw.indexOf('onmouseover') >= 0, ok, a: a && [a.rarity, a.stars], b: b && [b.tag, b.rarity, b.name], c: c && [c.rarity, c.stars] };
  });
  check(sv.stored && sv.ok && sv.a && sv.a[0] === 'common' && sv.a[1] === 0 && sv.b && sv.b[0] === 'saved2' && sv.b[1] === 'common' && sv.b[2] === 'Old Coat',
    'a poisoned save heals on load: bag and equipped items get a known rarity, a number of stars, a clean name', sv);
  check(sv.c && sv.c[0] === 'epic' && sv.c[1] === 2, 'an ordinary item in the same save loads untouched', sv.c);
  const after = await p.evaluate(async () => {
    const m = document.getElementById('inventory-modal'); m.style.display = 'flex'; renderInventory('');
    for (const el of document.querySelectorAll('#inv-grid .inv-slot, .equip-slot')) el.dispatchEvent(new MouseEvent('mouseenter'));
    const r = __scan(); __fire(); __close(); return { r, pwn: window.__pwn };
  });
  check(after.r.n === 0 && after.pwn === undefined, 'after that load, hovering every bag and equipped item injects nothing', after);
  check(errs.length === 0, 'no page errors', errs);
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
