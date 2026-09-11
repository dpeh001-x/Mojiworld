// The U panel's Skills tab prints what a cast really charges and waits.
//
// v0.30.630: the tab printed the raw table values, but castSkill charges a mage ceil(mp x 0.80) and
// sets every cooldown to cd x JOB_CD_MUL (0.75), x0.90 more for a mage, then applies the rank perk.
// So every cooldown pill read a third long and a mage's MP a quarter high. This casts every skill of
// every class, job and master at ranks 0 / 5 / 10 and checks the MP spent and the cooldown set
// against _skillPaidMp / _skillRealCd, then renders the Skills tab for each kit and checks every pill
// prints those same numbers. Charge skills are pressed until the full cooldown lands; Deadeye's is
// read when its window closes, with the rank-5 perk in it (it used to be thrown away).
//   node scripts/u_panel_numbers_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11630), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof castSkill === 'function' && typeof _skillRealCd === 'function' && typeof renderSkillsReference === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { applyClass('warrior'); } catch (e) {}
    player.level = 200; player.invulnerable = 9e9; loadMap('forest', 500); await sleep(2500); game.paused = false;
    // skills whose MP is refunded or banked inside the cast itself, and whose cooldown is a gate / window / charge
    const MP_SKIP = new Set(['bloodlust', 'warlord_ult', 'crusader_ult', 'holyLight', 'sage_ult', 'nightreaper_mark', 'phantom_cut']);
    const CHARGES = { sleight: 3, shinobi_seal: LX_KAGE_CHARGES, elementalist_ult: LX_APO_CHARGES };
    const WINDOW = new Set(['marksman_oneshot', 'marksman_ult', 'warlord_ult', 'crusader_ult', 'sage_ult']);
    const reset = () => {
      for (const k in player.buffs) if (typeof player.buffs[k] === 'number') player.buffs[k] = 0;
      player._momentum = 0; player.skillCooldowns = {}; player._skillLockTimer = 0; player._castLockUntil = 0; player.maxMp = player.mp = 99999;
      player._sleightCharges = 0; player._kageCharges = 0; player._apoCharges = 0; player._clones = [];
      player._deadeyeUntil = 0; player._protocolUntil = 0; player._warlordEnrageUntil = 0; player._sageUntil = 0; player._sageShots = 0; player._bastionArmedUntil = 0;
      player.hp = player.maxHp; player.x = 640; player.vx = player.vy = 0;
      if (game.minions) game.minions.length = 0;   // a full pack (4 wolves) makes the next pack cast a refunded no-op
      player.pack = []; player.pet = null;          // ...and the pack counts its slots from these two
    };
    const groups = {}; for (const [id, s] of Object.entries(SKILLS)) { if (!s || !s.desc || !s.cls) continue; const g = [s.cls, s.job || '', s.master || ''].join('/'); (groups[g] = groups[g] || []).push(id); }
    const mpBad = [], cdBad = [], pillBad = [], perkBad = []; let casts = 0, pills = 0;
    for (const [g, ids] of Object.entries(groups)) {
      const [cls, job, master] = g.split('/');
      try { applyClass(cls); } catch (e) {} player.cls = cls; player.job = job || null; player.master = master || null; player.level = 200; player.invulnerable = 9e9;
      for (const id of ids) for (const rank of [0, 5, 10]) {
        reset(); player.skillRanks = { [id]: rank };
        const wantMp = _skillPaidMp(id), wantCd = _skillRealCd(id), mp0 = player.mp;
        try { castSkill(id); } catch (e) { cdBad.push(id + '@' + rank + ' threw ' + e.message); continue; }
        casts++;
        if (!MP_SKIP.has(id) && Math.abs((mp0 - player.mp) - wantMp) > 0.01) mpBad.push(`${id}@${rank} paid ${mp0 - player.mp} shown ${wantMp}`);
        let n = CHARGES[id] || 1;
        while (--n > 0) { player.skillCooldowns[id] = 0; player._castLockUntil = 0; player.mp = 99999; castSkill(id); }
        const got = player.skillCooldowns[id] || 0;
        if (!WINDOW.has(id) && Math.abs(got - wantCd) > 1) cdBad.push(`${id}@${rank} set ${Math.round(got)} shown ${Math.round(wantCd)}`);
        // a cdMs override in the perk text is the multiplied value too
        const b = getSkillLv10(id);
        if (b && b.cdMs != null) { const txt = (rank >= 10 ? _formatSkillLv10Bonus(id) : _formatSkillLv5Bonus(id)) || ''; if (!txt.includes((b.cdMs * _skillCdMul(id) / 1000).toFixed(1) + ' s')) perkBad.push(`${id}@${rank}: ${txt}`); }
      }
      reset(); player.skillRanks = {};
      const host = document.createElement('div'); document.body.appendChild(host); renderSkillsReference(host);
      for (const tile of host.querySelectorAll('.skl-tile')) {
        const img = tile.querySelector('img[src*="Sprites/skills/"]'); if (!img) continue;
        const id = img.getAttribute('src').replace(/^.*\/skills\//, '').replace(/\.webp$/, ''); pills++;
        const mpP = tile.querySelector('.skl-pill.mp'), cdP = tile.querySelector('.skl-pill.cd');
        const wantMp = _skillPaidMp(id) ? _skillPaidMp(id) + 'MP' : null, wantCd = _skillRealCd(id) ? (_skillRealCd(id) / 1000).toFixed(1) + 's CD' : null;
        const gotMp = mpP ? mpP.textContent.trim() : null, gotCd = cdP ? cdP.textContent.trim() : null;
        if (gotMp !== wantMp || gotCd !== wantCd) pillBad.push(`${id}: ${gotMp}/${gotCd} want ${wantMp}/${wantCd}`);
      }
      host.remove();
    }
    // Deadeye at rank 5: the cooldown stamped when the window closes carries the -5% perk
    try { applyClass('archer'); } catch (e) {} player.cls = 'archer'; player.job = 'sniper'; player.master = 'marksman'; player.level = 200;
    // the loop above opened Deadeye windows whose close timers are still pending: cancel them, or they stamp here
    if (typeof cancelPendingSkillTimers === 'function') cancelPendingSkillTimers();
    reset(); player.skillRanks = { marksman_oneshot: 5 };
    const stamps = []; const raw = {}; let armed = false;
    player.skillCooldowns = new Proxy(raw, { set(t, k, v) { if (armed && k === 'marksman_oneshot' && v > (t[k] || 0) + 1000) stamps.push(Math.round(v)); t[k] = v; return true; } });
    castSkill('marksman_oneshot'); armed = true; await sleep(7200);
    const deadeye = { stamps, want: Math.round(_skillRealCd('marksman_oneshot')), unranked: Math.round(SKILLS.marksman_oneshot.cd * _skillCdMul('marksman_oneshot')) };
    return { casts, pills, mpBad, cdBad, pillBad, perkBad, deadeye, groups: Object.keys(groups).length };
  });
  console.log(`${r.casts} casts over ${r.groups} kits, ${r.pills} tiles`);
  ok('every cast charges the MP its pill shows (all kits, ranks 0/5/10)', r.mpBad.length === 0, r.mpBad.slice(0, 6));
  ok('every cast sets the cooldown its pill shows (charge skills after the last charge)', r.cdBad.length === 0, r.cdBad.slice(0, 6));
  ok('every Skills-tab tile prints those numbers', r.pills >= 60 && r.pillBad.length === 0, { tiles: r.pills, bad: r.pillBad.slice(0, 6) });
  ok("a cdMs rank perk names the cooldown the cast really sets", r.perkBad.length === 0, r.perkBad.slice(0, 4));
  ok('Deadeye stamps its ranked cooldown when the window closes (rank-5 perk kept)', r.deadeye.stamps.includes(r.deadeye.want) && r.deadeye.want < r.deadeye.unranked, r.deadeye);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
