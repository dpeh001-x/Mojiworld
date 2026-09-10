// The two expedition findings from the v0.30.500 audit (fixed v0.30.501).
//   1. Bravo's OFFER pool filtered on player.boons, while the ACCEPT path rejected duplicates
//      with _lxBoonIdActive — which also sees the expedition tray. A boon already in the tray
//      was still offered; taking it hit the inert branch and STILL cleared bravoReady and
//      advanced the floor, spending that floor's blessing on nothing.
//   2. The soft-lock recovery path set bravoReady by hand instead of going through
//      _expeditionFloorCleared, so a floor cleared that way never paid its EXP budget.
//
//   node scripts/audit_expedition_bravo_test.mjs      MOJI_SERVE_ROOT / PORT override
//
// Negative control: 5 of these fail on v0.30.500.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10461); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _bravoShowBoonPick === 'function' && typeof _lxExpBoons === 'function' && typeof _expeditionFloorCleared === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION };
    const ids = POWERUPS.map((x) => x.id);

    // ---- 1. the offer pool must never contain a boon that is already live ----
    player.boons = []; player.boonsEquipped = [];
    const snap = _expeditionSnapshotPlayer();
    game.expedition = { active: true, floor: 4, snapshot: snap, bravoReady: true,
      _baselineBoonCount: 0, _baselineEquipCount: 0 };
    // seed the TRAY (not player.boons) with three known boons — the exact state the pool missed
    const tray = _lxExpBoons();
    tray.length = 0;
    const seeded = [];
    for (let i = 0; i < 3; i++) { const b = rollMaxBoonInstance(ids[i]); if (b) { tray.push(b); seeded.push(ids[i]); } }
    _applyEquippedBoons();
    o.seeded = seeded;
    o.trayLen = _lxExpBoons().length;
    o.activeIds = (typeof _lxActiveBoonInstances === 'function' ? _lxActiveBoonInstances() : []).map((b) => b.id);

    // open Bravo repeatedly and record whether a live boon was ever offered
    const offeredLive = [];
    let opens = 0;
    for (let k = 0; k < 40; k++) {
      game.expedition.active = true; game.expedition.floor = 4; game.expedition.bravoReady = true;
      game.expedition._bravoOffer = null;   // v0.30.524 binds the trio to its floor; every open here must be a fresh sample
      const old = document.getElementById('bravo-boon-modal'); if (old) old.remove();
      _bravoShowBoonPick(); await sleep(40);
      const modal = document.getElementById('bravo-boon-modal');
      if (!modal) break;
      opens++;
      for (const b of modal.querySelectorAll('[data-pick]')) {
        const nm = (b.textContent || '');
        for (const id of seeded) {
          const d = getBoonDef({ id });
          if (d && d.name && nm.indexOf(d.name) >= 0) offeredLive.push(d.name);
        }
      }
      modal.remove();
    }
    o.opens = opens;
    o.offeredLive = offeredLive.slice(0, 6);
    o.offeredLiveCount = offeredLive.length;

    // ---- 1b. an inert pick must not cost the floor its blessing --------------
    // Force the fallback that CAN still offer a live boon: shrink the pool to the seeded ids.
    const _realPowerups = POWERUPS.slice();
    try {
      POWERUPS.length = 0;
      for (const id of seeded) { const d = _realPowerups.find((p) => p.id === id); if (d) POWERUPS.push(d); }
      game.expedition.active = true; game.expedition.floor = 4; game.expedition.bravoReady = true;
      game.expedition._bravoOffer = null;   // v0.30.524 binds the trio to its floor; every open here must be a fresh sample
      const old = document.getElementById('bravo-boon-modal'); if (old) old.remove();
      _bravoShowBoonPick(); await sleep(60);
      const modal = document.getElementById('bravo-boon-modal');
      const btn = modal && modal.querySelector('[data-pick]');
      o.inertOffered = !!btn;
      const floorBefore = game.expedition.floor;
      if (btn) { btn.click(); await sleep(300); }
      o.inert = { floorBefore, floorAfter: game.expedition.floor,
                  bravoStillReady: !!game.expedition.bravoReady,
                  trayLen: _lxExpBoons().length };
    } finally {
      POWERUPS.length = 0; for (const p of _realPowerups) POWERUPS.push(p);
    }

    // ---- 2. recovery-cleared floors pay their EXP ---------------------------
    // Driven through the REAL dialog — openNPC({role:'bravoGuide'}) — and not by calling
    // _expeditionFloorCleared directly. An earlier draft did call it directly and passed on
    // the UNFIXED build too, because that function was never the broken part: the bug was the
    // dialog reaching around it to set the flag by hand.
    const runRecovery = async () => {
      game.monsters.length = 0;                     // the recovery condition: nothing alive...
      game.mapData = game.mapData || {};
      game.mapData.isBossArena = false;             // ...and not a boss arena
      game.mapData._expeditionMap = true;
      game.expedition = { active: true, floor: 3, snapshot: snap, bravoReady: false,
        _baselineBoonCount: 0, _baselineEquipCount: 0, _floorClearedFor: null,
        _expBudget: 5000000, _expPaid: 0, currentQuest: { title: 'T', goal: 'g' } };
      const expBefore = player.exp, lvBefore = player.level;
      try { openNPC({ role: 'bravoGuide', name: 'Bravo', x: player.x, y: player.y }); }
      catch (e) { return { err: String(e.message).slice(0, 90) }; }
      await sleep(900);   // the dialog text is revealed by a typewriter, so give it time to finish
      const _exp = game.expedition;
      const out = { expBefore, lvBefore, expAfter: player.exp, lvAfter: player.level,
                    ready: !!_exp.bravoReady, stamped: _exp._floorClearedFor,
                    questCleared: _exp.currentQuest === null,
                    offered: /blessing/i.test((document.getElementById('dialog') || {}).textContent || '') };
      try { closeDialog(); } catch (e) {}
      return out;
    };
    player.level = 60; player.exp = 0;
    o.recovery = await runRecovery();

    try { _endExpedition && _endExpedition(); } catch (e) {}
    return o;
  });

  console.log('build ' + r.ver);
  console.log(JSON.stringify(r, null, 1).slice(0, 1600) + '\n');

  ok('the tray really was seeded with three live boons', r.trayLen === 3 && r.seeded.length === 3, JSON.stringify(r.seeded));
  ok('Bravo opened enough times to be a real sample', r.opens >= 30, 'opens=' + r.opens);
  ok('a boon already in the TRAY is never offered', r.offeredLiveCount === 0, `${r.offeredLiveCount} offers across ${r.opens} opens: ${r.offeredLive.join(', ')}`);

  ok('the forced-duplicate case still presents a card', r.inertOffered);
  ok('an inert pick does NOT advance the floor', r.inert.floorAfter === r.inert.floorBefore, `${r.inert.floorBefore} -> ${r.inert.floorAfter}`);
  ok('an inert pick leaves Bravo ready to try again', r.inert.bravoStillReady, JSON.stringify(r.inert));

  ok('a recovery-cleared floor pays EXP', r.recovery.expAfter > r.recovery.expBefore || r.recovery.lvAfter > r.recovery.lvBefore,
    `exp ${r.recovery.expBefore} -> ${r.recovery.expAfter}, level ${r.recovery.lvBefore} -> ${r.recovery.lvAfter}`);
  ok('...and stamps the floor so it cannot pay twice', r.recovery.stamped === 3, 'stamped=' + r.recovery.stamped);
  ok('...and clears the floor quest', r.recovery.questCleared);
  ok('...and still arms Bravo', r.recovery.ready);
  ok('Bravo actually offered the pick (the recovery path really ran)', r.recovery.offered, JSON.stringify(r.recovery).slice(0,120));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
