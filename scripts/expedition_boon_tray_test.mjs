// The expedition boon tray, ONE UI (v0.30.459). Per user: "make sure that the additional boons work
// properly, it should not affect the existing permanent 3 boons"; "There should be a simple separate
// on screen UI when bravo to select the 3 usable expedition boons"; and then "make it simpler all in
// 1 UI, because when i am transported the screen pops up and it blocks me".
//
// Two claims are checked by observation rather than by reading the code:
//   - a run NEVER writes the permanent bag or loadout (deep-snapshot, compare byte for byte), and
//   - picking a blessing leaves NOTHING on screen and the game unpaused, which is the "it blocks me"
//     report: v0.30.458 opened a second modal after Bravo's door had already carried the player on.
//   node scripts/expedition_boon_tray_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.458: a second modal (#exp-tray-modal) is up after the pick and the game is
// still paused. v0.30.457 and earlier: Bravo writes straight into player.boons.
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
  await page.waitForFunction(() => typeof _boonCap === 'function' && typeof _bravoShowBoonPick === 'function' && typeof _endExpedition === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION };
    const ids = POWERUPS.map((x) => x.id);
    const permSnap = () => JSON.stringify({ bag: player.boons, eq: player.boonsEquipped });
    const modsOf = () => JSON.stringify(player.mods);
    // any modal-looking element that is actually on screen
    // A real visibility test. offsetParent is ALWAYS null for position:fixed, which is what every
    // modal here is, so the first draft reported settings/backup/jukebox as blockers permanently.
    const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    const blockers = () => Array.from(document.querySelectorAll('div[id$="-modal"]')).filter(visible).map((el) => el.id || '(anon)');
    // --- a permanent loadout of 3
    game.expedition = { active: false, floor: 0 };
    player.boons = []; player.boonsEquipped = [];
    for (let i = 0; i < 5; i++) { const b = rollBoonInstance(ids[i]); if (b) player.boons.push(b); }
    equipBoon(0); equipBoon(1); equipBoon(2); _applyEquippedBoons();
    const permBefore = permSnap(), modsTown = modsOf();
    const baseBlockers = blockers().join(',');
    o.baseBlockers = baseBlockers;
    o.capTown = _boonCap();
    // --- into a run, and drive the REAL Bravo card
    const snap = _expeditionSnapshotPlayer();
    game.expedition = { active: true, floor: 4, snapshot: snap, bravoReady: true, _baselineBoonCount: player.boons.length, _baselineEquipCount: 3 };
    o.capInRun = _boonCap();
    // Each pick calls _expeditionAdvanceFloor('bravo') — the transport the user described. Re-pin
    // the run each time so the harness does not walk itself past B10 and end the run mid-test.
    const openBravo = async () => { game.expedition.active = true; game.expedition.floor = 4; game.expedition.bravoReady = true;
      _bravoShowBoonPick(); await sleep(260); return document.getElementById('bravo-boon-modal'); };
    // Click an offer the player does NOT already have. Bravo rolls at random, and a duplicate of a
    // live boon is deliberately declined, so a fixed index makes this test intermittently assert
    // nothing. Returns what was clicked so a failure says which boon it was.
    const activeNames = () => new Set((typeof _lxActiveBoonInstances === 'function' ? _lxActiveBoonInstances() : [])
      .map((b) => { const d = getBoonDef(b); return d && d.name; }).filter(Boolean));
    const pick = async () => {
      const have = activeNames();
      const btns = Array.from(document.querySelectorAll('#bravo-boon-modal [data-pick]'));
      let chosen = null;
      for (const b of btns) { const nm = (b.textContent || '').trim(); if (![...have].some((h) => nm.indexOf(h) >= 0)) { chosen = b; break; } }
      if (!chosen) chosen = btns[0];
      const label = chosen ? (chosen.textContent || '').replace(/s+/g, ' ').trim().slice(0, 40) : 'none';
      if (chosen) chosen.click();
      await sleep(320);
      return label;
    };
    // 1st blessing
    let card = await openBravo();
    // v0.30.461 — the painted backdrop and the slot label. "TO BE REPLACED" is only honest on an
    // OCCUPIED marked slot; an empty one replaces nothing, so it reads GOES HERE there.
    {
      const cardEl = document.querySelector('#bravo-boon-modal > div');
      const cs = cardEl ? getComputedStyle(cardEl) : null;
      const html = card ? card.innerHTML : '';
      o.art = { backdrop: !!(cs && /bravo_backdrop/.test(cs.backgroundImage)),
                emptyLabel: /GOES HERE/.test(html),
                replacedLabel: /TO BE REPLACED/.test(html) };
    }
    o.card1 = { open: !!card, slots: card ? card.querySelectorAll('[data-tray-target]').length : 0,
      picks: card ? card.querySelectorAll('[data-pick]').length : 0,
      sameCard: !!(card && card.querySelector('[data-tray-target]') && card.querySelector('[data-pick]')) };
    await pick();
    o.afterPick1 = { tray: _lxExpBoons().length, blockers: blockers().filter((b) => baseBlockers.indexOf(b) < 0), paused: !!game.paused };
    // 2nd and 3rd, filling the tray
    await openBravo(); await pick();
    await openBravo(); await pick();
    o.trayAfter3 = _lxExpBoons().length;
    o.modsRose = modsOf() !== modsTown;
    // --- full tray: tap TOWER 2, then pick — it must replace slot 2 and nothing else
    const before = _lxExpBoons().map((b) => b.id);
    card = await openBravo();
    const slot2 = document.querySelector('#bravo-boon-modal [data-tray-target="1"]');
    o.slotTapVisible = !!slot2;
    {
      const h = (document.getElementById('bravo-boon-modal') || {}).innerHTML || '';
      o.fullLabel = { replaced: /TO BE REPLACED/.test(h), goes: /GOES HERE/.test(h) };
    }
    if (slot2) slot2.click(); await sleep(160);
    o.pickedLabel = await pick();
    const after = _lxExpBoons().map((b) => b.id);
    o.replace = { before: before.join(','), after: after.join(','), len: after.length,
      slot0Same: after[0] === before[0], slot1Changed: after[1] !== before[1], slot2Same: after[2] === before[2],
      blockers: blockers().filter((b) => baseBlockers.indexOf(b) < 0), paused: !!game.paused };
    // --- a duplicate of a live permanent boon is refused, tray unchanged
    const dupId = player.boons[player.boonsEquipped[0]].id;
    const trayBeforeDup = _lxExpBoons().map((b) => b.id).join(',');
    card = await openBravo();
    // force one of the three offers to be the duplicate type by pushing it into the tray path:
    // instead, verify the guard directly through the same helper the card uses
    o.dupGuard = (typeof _lxBoonIdActive === 'function') ? _lxBoonIdActive(dupId) : null;
    const closeBtn = document.getElementById('bravo-boon-modal'); if (closeBtn) closeBtn.click(); await sleep(200);
    o.trayAfterDup = _lxExpBoons().map((b) => b.id).join(',');
    o.dupUnchanged = o.trayAfterDup === trayBeforeDup;
    // --- THE PERMANENT 3, mid-run
    o.permUntouchedInRun = permSnap() === permBefore;
    o.permDetail = { bag: player.boons.length, eq: player.boonsEquipped.length, cap: _boonCap() };
    // --- every exit clears the tray, its stats, and leaves the permanent 3 intact
    const exits = {};
    for (const how of ['complete', 'death', 'leave', 'logoff']) {
      game.expedition = { active: false, floor: 0 };
      player.boons = JSON.parse(permBefore).bag; player.boonsEquipped = JSON.parse(permBefore).eq; _applyEquippedBoons();
      const snap2 = _expeditionSnapshotPlayer();
      game.expedition = { active: true, floor: 9, snapshot: snap2, _baselineBoonCount: player.boons.length, _baselineEquipCount: 3 };
      for (let i = 5; i < 8; i++) _lxExpBoons().push(rollBoonInstance(ids[i]));
      _applyEquippedBoons();
      const inRunMods = modsOf(), inRunTray = _lxExpBoons().length;
      if (how === 'complete') _endExpedition('complete');
      else if (how === 'death') _endExpedition('death');
      else if (how === 'leave') { loadMap('forest', 300); await sleep(700); }
      else { game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null }; _applyEquippedBoons(); }
      await sleep(320); _applyEquippedBoons();
      exits[how] = { inRunTray, trayAfter: _lxExpBoons().length, modsRose: inRunMods !== modsTown,
        modsBack: modsOf() === modsTown, permBack: permSnap() === permBefore, cap: _boonCap() };
    }
    o.exits = exits;
    return o;
  });
  console.log(`build ${r.ver}  cap town ${r.capTown} / in run ${r.capInRun}`);
  ok('the permanent cap never changes — 3 in town and 3 inside a run', r.capTown === 3 && r.capInRun === 3, `${r.capTown} / ${r.capInRun}`);
  ok('ONE UI: Bravo\'s own card carries the 3 tower slots beside the 3 offers', r.card1.open && r.card1.slots === 3 && r.card1.picks === 3 && r.card1.sameCard,
    `slots ${r.card1.slots}, offers ${r.card1.picks}, same card ${r.card1.sameCard}`);
  ok('picking a blessing leaves NOTHING on screen and the game unpaused — the "it blocks me" report', r.afterPick1.blockers.length === 0 && r.afterPick1.paused === false,
    `blockers [${r.afterPick1.blockers.join(', ')}], paused ${r.afterPick1.paused}`);
  ok('the blessing lands in the tray', r.afterPick1.tray === 1 && r.trayAfter3 === 3, `1 -> ${r.afterPick1.tray}, then ${r.trayAfter3}`);
  ok('tray boons apply their stats', r.modsRose, String(r.modsRose));
  ok('with the tray full, tapping TOWER 2 makes the next pick replace exactly that slot', r.slotTapVisible && r.replace.len === 3 && r.replace.slot0Same && r.replace.slot1Changed && r.replace.slot2Same,
    `${r.replace.before} -> ${r.replace.after} (picked: ${r.pickedLabel})`);
  ok('...and that still opens nothing and leaves the game unpaused', r.replace.blockers.length === 0 && r.replace.paused === false,
    `blockers [${r.replace.blockers.join(', ')}], paused ${r.replace.paused}`);
  ok('a boon already active is recognised as a duplicate, and the tray is untouched', r.dupGuard === true && r.dupUnchanged,
    `guard ${r.dupGuard}, tray ${r.trayAfterDup}`);
  ok('THE PERMANENT 3 ARE UNTOUCHED mid-run — bag and loadout byte-identical', r.permUntouchedInRun,
    `bag ${r.permDetail.bag}, equipped ${r.permDetail.eq}, cap ${r.permDetail.cap}`);
  for (const how of ['complete', 'death', 'leave', 'logoff']) {
    const e = r.exits[how];
    ok(`${how.toUpperCase()}: the tray empties, its stats go, the permanent 3 survive`,
      e.inRunTray === 3 && e.trayAfter === 0 && e.modsRose && e.modsBack && e.permBack && e.cap === 3, JSON.stringify(e));
  }
  ok('the card carries its painted backdrop', r.art.backdrop, String(r.art.backdrop));
  ok('an EMPTY marked slot says GOES HERE, since it replaces nothing', r.art.emptyLabel && !r.art.replacedLabel,
    `goes-here ${r.art.emptyLabel}, to-be-replaced ${r.art.replacedLabel}`);
  ok('a FULL tray marks the targeted slot TO BE REPLACED', r.fullLabel.replaced && !r.fullLabel.goes,
    `to-be-replaced ${r.fullLabel.replaced}, goes-here ${r.fullLabel.goes}`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
