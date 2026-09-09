// Ascension resets to the CLASS baseline, and resets crit (v0.30.495 audit fixes).
//   * baseCrit was never in the reset list, so job + master crit compounded across
//     ascensions until getCrit() capped at 100 — permanent 100% crit, persisted AND signed.
//   * base stats were reset to a hardcoded 100/50/12/5, below every class's atk, so the
//     v0.29.856 "Repaired corrupted stats" alarm fired after EVERY ascension.
//
//   node scripts/ascension_reset_test.mjs        MOJI_SERVE_ROOT / PORT override
//
// Driven through the real offerPrestige() flow and its real confirm dialog. The 1.2 s
// location.reload() at the end of that flow is suppressed so several classes can be run.
// Negative control: crit and the repair-alarm checks all fail on v0.30.494.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10413); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof offerPrestige === 'function' && typeof CLASSES !== 'undefined' && typeof getCrit === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION, runs: {} };

    // suppress the 1.2 s location.reload() that ends the prestige flow
    const _rt = window.setTimeout;
    window.setTimeout = function (fn, ms, ...a) {
      try { if (typeof fn === 'function' && /location\s*\.\s*reload/.test(Function.prototype.toString.call(fn))) return 0; } catch (e) {}
      return _rt.call(window, fn, ms, ...a);
    };
    const _realConfirm = window.uiConfirm;
    window.uiConfirm = async (opts) => { o.dialogBody = (opts && opts.body) || ''; return true; };

    for (const cls of ['warrior', 'rogue', 'mage', 'archer']) {
      const cs = CLASSES[cls].stats;
      applyClass(cls);
      // stand in for a job + master having been taken: both do baseCrit += stats.crit
      player.baseCrit = (player.baseCrit || 5) + 12 + 12;
      player.level = PRESTIGE_LEVEL;
      player.exp = 0;
      game._prestigeOffered = false;
      const critBefore = player.baseCrit;
      offerPrestige(false);
      await sleep(350);
      const belowBaseline = [];
      if (player.baseAtk   < cs.atk)   belowBaseline.push('ATK');
      if (player.baseDef   < cs.def)   belowBaseline.push('DEF');
      if (player.baseSpeed < cs.speed) belowBaseline.push('Speed');
      if (player.baseJump  < cs.jump)  belowBaseline.push('Jump');
      if (player.maxHp     < cs.hp)    belowBaseline.push('Max HP');
      if (player.maxMp     < cs.mp)    belowBaseline.push('Max MP');
      o.runs[cls] = {
        classBase: { hp: cs.hp, mp: cs.mp, atk: cs.atk, def: cs.def, crit: cs.crit },
        after: { hp: player.maxHp, mp: player.maxMp, atk: player.baseAtk, def: player.baseDef, crit: player.baseCrit },
        critBefore, level: player.level, job: player.job, master: player.master,
        belowBaseline,
      };
    }

    // crit really does stop compounding across repeated ascensions
    applyClass('rogue');
    const seq = [];
    for (let i = 0; i < 4; i++) {
      player.baseCrit = (player.baseCrit || 5) + 12 + 12;   // a job + master each cycle
      player.level = PRESTIGE_LEVEL; player.exp = 0; game._prestigeOffered = false;
      offerPrestige(false); await sleep(300);
      seq.push(player.baseCrit);
    }
    o.critSeq = seq;
    o.critCapped = getCrit();

    window.uiConfirm = _realConfirm; window.setTimeout = _rt;
    return o;
  });

  console.log('build ' + r.ver);
  console.log(JSON.stringify(r.runs, null, 1).slice(0, 1800));
  console.log('critSeq ' + JSON.stringify(r.critSeq) + '  getCrit=' + r.critCapped + '\n');

  for (const cls of ['warrior', 'rogue', 'mage', 'archer']) {
    const x = r.runs[cls];
    ok(`${cls}: ascension resets baseCrit to the class base`, x.after.crit === x.classBase.crit, `was ${x.critBefore} -> ${x.after.crit}, class base ${x.classBase.crit}`);
    ok(`${cls}: base stats land on the class baseline`,
      x.after.hp === x.classBase.hp && x.after.mp === x.classBase.mp && x.after.atk === x.classBase.atk && x.after.def === x.classBase.def,
      JSON.stringify(x.after) + ' vs ' + JSON.stringify(x.classBase));
    ok(`${cls}: nothing left below baseline (no "corrupted stats" alarm)`, x.belowBaseline.length === 0, x.belowBaseline.join(', '));
    ok(`${cls}: job and master really were cleared`, !x.job && !x.master, `job=${x.job} master=${x.master}`);
    ok(`${cls}: level really was reset`, x.level === 1, 'level=' + x.level);
  }
  ok('crit does not compound over four ascensions', r.critSeq.every((v) => v === 25), JSON.stringify(r.critSeq));
  ok('getCrit is not pinned at the 100 ceiling', r.critCapped < 100, 'getCrit=' + r.critCapped);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
