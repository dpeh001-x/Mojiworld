// SOLO launch smoke test — prove the co-op pivot did NOT regress single-player.
// Boots the real game, names a hero via the UI, enters a map, and verifies solo
// monsters spawn, combat + XP + contact damage work, and the co-op layer is inert.
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
const MAP = 'glasswindSteppe';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).slice(0, 180)));
  // Ignore the expected .webp->.png sprite-fallback 404 probes (the loader tries
  // webp first, falls back to png; all sprites still resolve — verified separately).
  // Ignore expected-optional 404s: the .webp->.png sprite fallback probes, and
  // assets_manifest.json (an optional SW cache-warm manifest, guarded r.ok?json:null).
  page.on('response', r => { const u = r.url(); if (r.status() === 404 && !/\.(webp|png|jpg|jpeg|mp3|ogg|wav)(\?|$)/.test(u) && !/assets_manifest\.json/.test(u)) errs.push('404: ' + u.replace('http://localhost:8080', '')); });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 30000 });
  // Real UI entry: name the hero and click Enter.
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 45000 }).catch(() => {});
  // v0.27.8 Steam-style menu gates naming behind New Game — click through it first.
  await page.click('#menu-newgame').catch(() => {});
  await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.fill('#auth-user', 'SoloHero').catch(() => {});
  await page.click('#auth-submit').catch(() => {});
  await sleep(1500);
  const ev = (f, a) => page.evaluate(f, a);

  ok('world revealed after naming', await ev(() => !document.getElementById('loading-overlay') || document.getElementById('loading-overlay').classList.contains('fade')));
  ok('hero name applied', (await ev(() => (player.look && player.look.name) || '')) === 'SoloHero');

  // Co-op layer must be INERT in solo.
  const coop = await ev(() => ({
    isHostDefault: net.isHost, active: (typeof _coopActive === 'function') ? _coopActive() : 'nofn',
    following: (typeof _coopFollowingHost === 'function') ? _coopFollowingHost() : 'nofn', connected: net.connected,
  }));
  ok('not connected in solo', coop.connected === false, coop);
  ok('_coopActive() is false in solo', coop.active === false, coop);
  ok('_coopFollowingHost() is false in solo', coop.following === false, coop);

  // Enter a real map — SOLO must spawn real monsters (NOT suppressed).
  await ev((m) => { player.cls = player.cls || 'warrior'; game.paused = false; window._prologueActive = false; loadMap(m); }, MAP);
  await sleep(800);
  const mon = await ev(() => ({
    n: game.monsters.length,
    suppressed: game.monsters.filter(m => m && m._suppressed).length,
    mirrors: game.monsters.filter(m => m && m._coopMirror).length,
    haveUid: game.monsters.every(m => m && m.uid != null),
    haveHp: game.monsters.every(m => m && m.currentHp > 0),
  }));
  ok('SOLO spawns real monsters', mon.n > 0, mon);
  ok('no suppressed stubs in game.monsters (solo)', mon.suppressed === 0, mon);
  ok('no co-op mirrors in solo', mon.mirrors === 0, mon);
  ok('all solo monsters valid (uid + hp)', mon.haveUid && mon.haveHp, mon);

  // Combat: hitMonster runs the REAL solo path (not forwarded), DEF-applied damage.
  // The evasive traits added in v0.29.320 roll INSIDE hitMonster and return
  // before any damage lands — and this map's roster includes glasswindHare
  // (phantomDodge: 0.20), so a single hit failed this assertion 20% of the time.
  // Clear the negating traits on the target first: what is under test here is
  // that the solo damage path runs at all rather than being forwarded to the
  // co-op host, not whether parry/dodge work (monster_traits_test covers those).
  // hitMonster also rolls to MISS before it writes HP, and the accuracy gate is
  // a level-gap curve that bottoms out at a 10% floor +16 levels above the
  // player. This harness names a fresh Lv1 hero and drops it on a Lv67-69 map,
  // so a single swing landed ~10% of the time — the assertion was flaky long
  // before it was ever wrong. Remove the RNG at its source rather than bypass
  // the path: match the player's level to the target (90% level-gap roll), zero
  // the separate evasion roll, and retry. The real DEF/multiplier pipeline still
  // runs, which is what the check is actually for. (player._oneShot would skip
  // the miss too, but it rewrites dmg to 999999 and would stop testing that.)
  const dmg = await ev(() => {
    const m = game.monsters[0]; if (!m) return null;
    if (m.traits) { delete m.traits.parryChance; delete m.traits.phantomDodge; }
    m.evasion = 0;
    try { player.level = Math.max(player.level || 1, _mobLevel(m)); } catch (e) {}
    const hp0 = m.currentHp; m.def = m.def || 0;
    for (let i = 0; i < 20 && m.currentHp === hp0; i++) hitMonster(m, 500, false, 'slash');
    return { hp0, hp1: m.currentHp, dropped: hp0 - m.currentHp, type: m.type };
  });
  ok('solo hitMonster damages a monster', dmg && dmg.dropped > 0, dmg);

  // Kill grants XP (real killMonster pipeline).
  // Same miss gate applies here — this picks a DIFFERENT monster, so neutralise
  // it on that one too rather than relying on the check above having done it.
  const kill = await ev(() => {
    const m = game.monsters.find(x => x && x.currentHp > 0); if (!m) return null;
    if (m.traits) { delete m.traits.parryChance; delete m.traits.phantomDodge; }
    m.evasion = 0;
    try { player.level = Math.max(player.level || 1, _mobLevel(m)); } catch (e) {}
    const xp0 = player.exp || 0;
    m.currentHp = 1;
    for (let i = 0; i < 20 && game.monsters.includes(m) && m.currentHp > 0; i++) hitMonster(m, 999999, false, 'slash');
    return { xp0, xp1: player.exp || 0, gained: (player.exp || 0) - xp0, stillAlive: game.monsters.includes(m) && m.currentHp > 0 };
  });
  ok('solo kill grants XP + removes monster', kill && kill.gained > 0 && !kill.stillAlive, kill);

  // Solo runs the FULL updateMonsters (not the co-op follower early-return), so the
  // real contact/attack/projectile damage path is reachable. (Driving on-screen
  // contact damage needs a rendered frame the headless harness can't produce; the
  // path itself is unchanged by the pivot — gated only by _coopFollowingHost().)
  const soloPath = await ev(() => {
    const early = _coopFollowingHost();   // must be false in solo -> full updateMonsters body runs
    let threw = false;
    try { for (let i = 0; i < 5; i++) updateMonsters(16); } catch (e) { threw = String(e).slice(0, 100); }
    return { early, threw };
  });
  ok('solo runs full updateMonsters (contact/AI path reachable, no throw)', soloPath.early === false && soloPath.threw === false, soloPath);

  // Menus open without crashing.
  const menus = await ev(() => {
    const r = {};
    try { if (typeof toggleInventory === 'function') { toggleInventory(); r.inv = true; toggleInventory(); } } catch (e) { r.invErr = String(e).slice(0,80); }
    try { if (typeof toggleWorldMap === 'function') { toggleWorldMap(); r.map = true; toggleWorldMap(); } } catch (e) { r.mapErr = String(e).slice(0,80); }
    try { if (typeof openSkillsModal === 'function') { openSkillsModal(); r.skills = true; closeAllModals(); } } catch (e) { r.skillsErr = String(e).slice(0,80); }
    return r;
  });
  ok('menus open without throwing', !menus.invErr && !menus.mapErr && !menus.skillsErr, menus);

  ok('no page/console errors through solo flow', errs.length === 0, errs.slice(0, 8));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== SOLO LAUNCH SMOKE TEST ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
