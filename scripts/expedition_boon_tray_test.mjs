// The expedition boon TRAY (v0.30.458). Per user: "make sure that the additional boons work
// properly, it should not affect the existing permanent 3 boons. There should be a simple separate
// on screen UI when bravo to select the 3 usable expedition boons".
//
// The central claim is a negative one — a run never writes the permanent bag or loadout — so it is
// checked by deep-snapshotting player.boons / player.boonsEquipped BEFORE a run and comparing byte
// for byte DURING and AFTER, not by inspecting the code path.
//   node scripts/expedition_boon_tray_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.457: Bravo pushes into player.boons and player.boonsEquipped, the cap rises
// to 6 mid-run, and there is no tray and no picker at all.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10331); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _boonCap === 'function' && typeof rollBoonInstance === 'function' && typeof _endExpedition === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION };
    const ids = POWERUPS.map((x) => x.id);
    const permSnap = () => JSON.stringify({ bag: player.boons, eq: player.boonsEquipped });
    const modsOf = () => JSON.stringify(player.mods);
    // --- a character with a real permanent loadout of 3
    game.expedition = { active: false, floor: 0 };
    player.boons = []; player.boonsEquipped = [];
    for (let i = 0; i < 5; i++) { const b = rollBoonInstance(ids[i]); if (b) player.boons.push(b); }
    equipBoon(0); equipBoon(1); equipBoon(2);
    _applyEquippedBoons();
    const permBefore = permSnap(), modsTown = modsOf();
    o.capTown = _boonCap();
    o.permEquipped = player.boonsEquipped.length;
    // --- into a run
    const snap = _expeditionSnapshotPlayer();
    game.expedition = { active: true, floor: 4, snapshot: snap, _baselineBoonCount: player.boons.length, _baselineEquipCount: 3 };
    o.capInRun = _boonCap();
    o.trayEmptyAtStart = _lxExpBoons().length;
    // --- Bravo hands over three blessings, through the REAL picker each time
    const bless = async (id) => {
      const inst = rollBoonInstance(id); const def = getBoonDef(inst);
      _lxExpTrayOpen(inst, def);
      await sleep(220);
      const modal = document.getElementById('exp-tray-modal');
      const slots = modal ? Array.from(modal.querySelectorAll('[data-tray-slot]')) : [];
      const enabled = slots.filter((b) => !b.disabled);
      return { modal: !!modal, slots: slots.length, enabled: enabled.length, tray: _lxExpBoons().length };
    };
    o.b1 = await bless(ids[5]);
    const done1 = document.querySelector('#exp-tray-modal [data-tray-done]'); if (done1) done1.click(); await sleep(150);
    o.b2 = await bless(ids[6]);
    const done2 = document.querySelector('#exp-tray-modal [data-tray-done]'); if (done2) done2.click(); await sleep(150);
    o.b3 = await bless(ids[7]);
    const done3 = document.querySelector('#exp-tray-modal [data-tray-done]'); if (done3) done3.click(); await sleep(150);
    o.trayAfter3 = _lxExpBoons().length;
    o.modsRoseInRun = modsOf() !== modsTown;
    // --- a FOURTH blessing with the tray full must ask which one it replaces
    const before4 = _lxExpBoons().map((b) => b.id).join(',');
    o.b4 = await bless(ids[8]);
    o.b4Pending = !!(document.querySelector('#exp-tray-modal [data-tray-decline]'));
    const slot0 = document.querySelector('#exp-tray-modal [data-tray-slot="0"]');
    if (slot0) slot0.click(); await sleep(200);
    o.after4 = { tray: _lxExpBoons().length, ids: _lxExpBoons().map((b) => b.id).join(','), before: before4,
                 replaced: _lxExpBoons().map((b) => b.id).join(',') !== before4 };
    const done4 = document.querySelector('#exp-tray-modal [data-tray-done]'); if (done4) done4.click(); await sleep(150);
    // --- a duplicate of an already-active type is declined, not silently stuffed in
    const dupId = player.boons[player.boonsEquipped[0]].id;
    const dupInst = rollBoonInstance(dupId);
    const trayBeforeDup = _lxExpBoons().length;
    _lxExpTrayOpen(dupInst, getBoonDef(dupInst)); await sleep(220);
    o.dup = { trayBefore: trayBeforeDup, trayAfter: _lxExpBoons().length,
              says: /already have/i.test((document.getElementById('exp-tray-modal') || {}).textContent || '') };
    const doneD = document.querySelector('#exp-tray-modal [data-tray-done]'); if (doneD) doneD.click(); await sleep(150);
    // --- THE CENTRAL CLAIM: the permanent bag and loadout are untouched, mid-run
    o.permUntouchedInRun = permSnap() === permBefore;
    o.permDuringDetail = { bag: player.boons.length, eq: player.boonsEquipped.length, cap: _boonCap() };
    // --- and every exit clears the tray and the stats it was giving
    const exits = {};
    for (const how of ['complete', 'death', 'leave', 'logoff']) {
      // rebuild the same run state each time
      game.expedition = { active: false, floor: 0 };
      player.boons = JSON.parse(permBefore).bag; player.boonsEquipped = JSON.parse(permBefore).eq;
      _applyEquippedBoons();
      const snap2 = _expeditionSnapshotPlayer();
      game.expedition = { active: true, floor: 9, snapshot: snap2, _baselineBoonCount: player.boons.length, _baselineEquipCount: 3 };
      for (let i = 5; i < 8; i++) _lxExpBoons().push(rollBoonInstance(ids[i]));
      _applyEquippedBoons();
      const inRunMods = modsOf(), inRunTray = _lxExpBoons().length;
      if (how === 'complete') _endExpedition('complete');
      else if (how === 'death') _endExpedition('death');
      else if (how === 'leave') { loadMap('forest', 300); await sleep(700); }
      else { game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null }; _applyEquippedBoons(); }
      await sleep(350);
      _applyEquippedBoons();
      exits[how] = { inRunTray, trayAfter: _lxExpBoons().length, modsRose: inRunMods !== modsTown,
                     modsBack: modsOf() === modsTown, permBack: permSnap() === permBefore, cap: _boonCap() };
    }
    o.exits = exits;
    // --- the bag's Equip buttons follow the LIVE permanent cap. This is the surviving half of the
    //     retired expedition_boon_slots_test: the v0.30.456 fix was never really about the
    //     expedition, it was that this gate read the raw BOON_EQUIP_CAP and so a Collector's-Slot
    //     player could never fill their 4th slot from the bag. Proven here with a real slot bonus.
    game.expedition = { active: false, floor: 0 };
    player.boons = []; player.boonsEquipped = [];
    for (let i = 0; i < 6; i++) { const b = rollBoonInstance(ids[i]); if (b) player.boons.push(b); }
    equipBoon(0); equipBoon(1); equipBoon(2);
    game.boonDex = game.boonDex || {}; game.boonDex.slotBonus = 1;      // the Collector's Slot
    try { openLevelUpPanel(); await sleep(350); renderBoonPanel(); await sleep(250); } catch (e) {}
    const bagHost = document.getElementById('lp-boons');
    const bagBtns = bagHost ? Array.from(bagHost.querySelectorAll('[data-equip]')) : [];
    const usable4 = bagBtns.filter((b) => !b.disabled);
    const eqB4 = player.boonsEquipped.length;
    if (usable4[0]) usable4[0].click();
    await sleep(250);
    o.collector = { cap: _boonCap(), enabled: usable4.length, before: eqB4, after: player.boonsEquipped.length };
    game.boonDex.slotBonus = 0;
    // --- synergies see the tray
    game.expedition = { active: false, floor: 0 };
    player.boons = JSON.parse(permBefore).bag; player.boonsEquipped = JSON.parse(permBefore).eq; _applyEquippedBoons();
    const syn = BOON_SYNERGIES[0];
    player.boons = [rollBoonInstance(syn.pair[0])]; player.boonsEquipped = [0]; _applyEquippedBoons(); _detectActiveSynergies();
    const synBefore = !!(player._activeSynergies && player._activeSynergies[syn.key]);
    game.expedition = { active: true, floor: 2, snapshot: null };
    _lxExpBoons().push(rollBoonInstance(syn.pair[1]));
    _applyEquippedBoons(); _detectActiveSynergies();
    o.syn = { key: syn.key, before: synBefore, after: !!(player._activeSynergies && player._activeSynergies[syn.key]) };
    return o;
  });
  console.log(`build ${r.ver}  cap town ${r.capTown} / in run ${r.capInRun}`);
  ok('the permanent cap NEVER changes — 3 in town and 3 inside a run', r.capTown === 3 && r.capInRun === 3, `${r.capTown} / ${r.capInRun}`);
  ok('a blessing goes into the tower TRAY, not the permanent bag', r.trayEmptyAtStart === 0 && r.trayAfter3 === 3, `tray ${r.trayEmptyAtStart} -> ${r.trayAfter3}`);
  ok('Bravo opens a separate on-screen picker showing the 3 tower slots', r.b1.modal && r.b1.slots === 3 && r.b2.slots === 3, `modal ${r.b1.modal}, slots ${r.b1.slots}`);
  ok('tray boons actually apply their stats', r.modsRoseInRun, String(r.modsRoseInRun));
  ok('a 4th blessing on a full tray asks which one it replaces, and replacing works', r.b4Pending && r.after4.replaced && r.after4.tray === 3,
    `pending ${r.b4Pending}, ${r.after4.before} -> ${r.after4.ids}`);
  ok('a duplicate of an already-active boon is declined and says why', r.dup.trayAfter === r.dup.trayBefore && r.dup.says,
    `tray ${r.dup.trayBefore} -> ${r.dup.trayAfter}, explained ${r.dup.says}`);
  ok('THE PERMANENT 3 ARE UNTOUCHED mid-run — bag and loadout byte-identical', r.permUntouchedInRun,
    `bag ${r.permDuringDetail.bag}, equipped ${r.permDuringDetail.eq}, cap ${r.permDuringDetail.cap}`);
  for (const how of ['complete', 'death', 'leave', 'logoff']) {
    const e = r.exits[how];
    ok(`${how.toUpperCase()}: the tray empties, its stats go, and the permanent 3 are intact`,
      e.inRunTray === 3 && e.trayAfter === 0 && e.modsRose && e.modsBack && e.permBack && e.cap === 3, JSON.stringify(e));
  }
  ok('the bag\'s Equip buttons follow the live permanent cap — a Collector\'s Slot 4th is fillable', r.collector.cap === 4 && r.collector.enabled > 0 && r.collector.after === r.collector.before + 1,
    `cap ${r.collector.cap}, ${r.collector.enabled} enabled, ${r.collector.before} -> ${r.collector.after}`);
  ok('synergies count a tray boon (it completes a pair with a permanent one)', r.syn.before === false && r.syn.after === true, JSON.stringify(r.syn));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
