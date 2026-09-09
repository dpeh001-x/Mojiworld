// Expedition-only boon slots (v0.30.455). Per user: "For expedition mode when choosing the boon, for
// temporary equipping can add additional 3 slots of boon just for within the expedition mode only.
// the boons gained during expedition will be removed after finishing / leaving / logging off".
//
// Driven through the real cap, the real equipBoon, the real panel render and the real exit paths, and
// asserted on what player.boonsEquipped actually holds afterwards.
//   node scripts/expedition_boon_slots_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.454: the cap is 3 inside the tower as well as outside, the 4th equip is
// refused, and the panel draws 3 slots on every floor.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10311); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _boonCap === 'function' && typeof equipBoon === 'function' && typeof rollBoonInstance === 'function' && typeof _endExpedition === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION };
    const ids = POWERUPS.slice(0, 8).map((p) => p.id);
    // a bag of distinct boon TYPES (duplicates are refused by _boonTypeEquipped, which is not what
    // this test is about) and an empty loadout
    const fill = (n) => {
      player.boons = []; player.boonsEquipped = [];
      for (let i = 0; i < n; i++) { const b = rollBoonInstance(ids[i]); if (b) player.boons.push(b); }
      return player.boons.length;
    };
    // how many of the bag can actually be equipped through the REAL equipBoon
    const equipAsManyAsPossible = () => {
      let n = 0;
      for (let i = 0; i < player.boons.length; i++) if (equipBoon(i)) n++;
      return n;
    };
    // --- 1. outside the tower nothing changes
    game.expedition = { active: false, floor: 0 };
    o.bagged = fill(8);
    o.capTown = _boonCap();
    o.equippedTown = equipAsManyAsPossible();
    // --- 2. inside the tower: three more
    game.expedition = { active: true, floor: 3, snapshot: null };
    o.capTower = _boonCap();
    fill(8);
    o.equippedTower = equipAsManyAsPossible();
    // --- 3. the panel draws them, and says which are on loan
    let html = '';
    // Count the real slot ELEMENTS, not a string that also occurs in the bag list below the grid:
    // the loadout grid is the element right after the "Boon Loadout" heading.
    const slotGrid = () => {
      const host = document.getElementById('lp-boons'); if (!host) return null;
      const h3 = Array.from(host.querySelectorAll('h3')).find((x) => /Boon Loadout/.test(x.textContent || ''));
      return h3 ? h3.nextElementSibling : null;
    };
    try { openLevelUpPanel(); await sleep(400); renderBoonPanel(); await sleep(250); html = (document.getElementById('lp-boons') || {}).innerHTML || ''; } catch (e) {}
    const g1 = slotGrid();
    const head = () => { const host = document.getElementById('lp-boons'); const h3 = host && Array.from(host.querySelectorAll('h3')).find((x) => /Boon Loadout/.test(x.textContent || '')); return h3 ? (h3.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
    o.panelTower = { slots: g1 ? g1.children.length : -1, heading: head(), amber: /d9a441|8a6a2a/.test(html) };
    // with two equipped, the four empty slots should include the three loaned ones, named
    player.boonsEquipped.length = 2;
    try { renderBoonPanel(); await sleep(250); html = (document.getElementById('lp-boons') || {}).innerHTML || ''; } catch (e) {}
    o.panelEmpty = { loanMarks: (html.match(/expedition slot/g) || []).length, plainEmpty: (html.match(/— empty slot —/g) || []).length };
    // --- 4. the expedition's OWN grant path must see the loaned slots (it read the raw constant)
    game.expedition = { active: true, floor: 4, snapshot: null };
    fill(8); equipAsManyAsPossible();               // fill to the base 3 first
    player.boonsEquipped.length = 3;
    const beforeGrant = player.boonsEquipped.length;
    let granted = null;
    try { const pw = POWERUPS.find((p) => !player.boons.some((b) => b.id === p.id)); granted = pw ? (acquirePowerup(pw), player.boonsEquipped.length) : null; } catch (e) { granted = 'err:' + e.message.slice(0, 40); }
    o.grant = { before: beforeGrant, after: granted };
    // --- 5. every exit hands the loan back. Build a REAL pre-run snapshot of 2 equipped, go in,
    //        fill to 6, then leave each way and read what survived.
    const runAndExit = async (how) => {
      game.expedition = { active: false, floor: 0 };
      fill(8);
      player.boonsEquipped = [0, 1];                                  // what they walked in with
      const snap = _expeditionSnapshotPlayer();
      game.expedition = { active: true, floor: 5, snapshot: snap, _baselineBoonCount: player.boons.length, _baselineEquipCount: 2, _startExp: player.exp | 0, _startLevel: player.level | 0 };
      const extra = rollBoonInstance(ids[6]); if (extra) player.boons.push(extra);   // "gained in the run"
      const inRunBag = player.boons.length;
      equipAsManyAsPossible();
      const inRun = player.boonsEquipped.length;
      if (how === 'finish') { _endExpedition('complete'); }
      else if (how === 'die') { _endExpedition('death'); }
      else if (how === 'leave') { loadMap('forest', 300); await sleep(700); }
      else if (how === 'logoff') {
        // the load path: an active run found at boot is treated as abandoned
        if (game.expedition && game.expedition.active) {
          try { _expeditionRestorePlayer(game.expedition.snapshot); } catch (e) {}
          game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null };
          try { if (typeof _lxClampBoonSlots === 'function') _lxClampBoonSlots(); } catch (e) {}
        }
      }
      await sleep(400);
      return { inRun, inRunBag, after: player.boonsEquipped.length, bagAfter: player.boons.length, cap: _boonCap() };
    };
    o.finish = await runAndExit('finish');
    o.die = await runAndExit('die');
    o.leave = await runAndExit('leave');
    o.logoff = await runAndExit('logoff');
    // --- 6. the corrupt-snapshot path: restore bails, so the clamp is the only thing left
    game.expedition = { active: false, floor: 0 };
    fill(8); player.boonsEquipped = [0, 1];
    game.expedition = { active: true, floor: 6, snapshot: null };
    equipAsManyAsPossible();
    const corruptIn = player.boonsEquipped.length;
    _endExpedition('complete');
    await sleep(300);
    o.corrupt = { inRun: corruptIn, after: player.boonsEquipped.length, cap: _boonCap() };
    return o;
  });
  console.log(`build ${r.ver}  cap town ${r.capTown} / tower ${r.capTower}`);
  ok('outside the tower the cap is unchanged at 3, and only 3 equip', r.capTown === 3 && r.equippedTown === 3, `cap ${r.capTown}, equipped ${r.equippedTown}`);
  ok('inside the tower the cap is 6 — three loaned slots', r.capTower === 6, String(r.capTower));
  ok('...and the real equipBoon lets all six on', r.equippedTower === 6, `${r.equippedTower} of 8 bagged equipped`);
  ok('the panel draws six slots inside the tower', r.panelTower.slots === 6, `${r.panelTower.slots} slots`);
  ok('the panel counts against the LIVE cap, not "6 / 3 equipped"', /6 \/ 6 equipped/.test(r.panelTower.heading) && /on loan/.test(r.panelTower.heading), r.panelTower.heading);
  ok('the loaned slots are visibly marked and amber, not passed off as permanent', r.panelEmpty.loanMarks === 3 && r.panelEmpty.plainEmpty === 1 && r.panelTower.amber,
    `loan-marked ${r.panelEmpty.loanMarks}, plain empty ${r.panelEmpty.plainEmpty}, amber ${r.panelTower.amber}`);
  ok('the expedition\'s own boon grant fills a loaned slot (it read the raw cap before)', r.grant.after === r.grant.before + 1,
    `${r.grant.before} -> ${r.grant.after} equipped`);
  ok('FINISHING the run hands the loan back — the pre-run 2 return, the run\'s boons are gone', r.finish.inRun === 6 && r.finish.after === 2 && r.finish.cap === 3,
    JSON.stringify(r.finish));
  ok('DYING does the same', r.die.inRun === 6 && r.die.after === 2 && r.die.cap === 3, JSON.stringify(r.die));
  ok('LEAVING the tower on foot does the same', r.leave.inRun === 6 && r.leave.after === 2 && r.leave.cap === 3, JSON.stringify(r.leave));
  ok('LOGGING OFF mid-run does the same on next load', r.logoff.inRun === 6 && r.logoff.after === 2 && r.logoff.cap === 3, JSON.stringify(r.logoff));
  ok('the boons gained in the run really leave the bag, not just the slots', r.finish.bagAfter < r.finish.inRunBag && r.logoff.bagAfter < r.logoff.inRunBag,
    `bag ${r.finish.inRunBag} -> ${r.finish.bagAfter} (finish), ${r.logoff.inRunBag} -> ${r.logoff.bagAfter} (logoff)`);
  ok('even with the snapshot lost, no six-slot loadout walks out of the tower', r.corrupt.inRun === 6 && r.corrupt.after <= 3,
    JSON.stringify(r.corrupt));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
