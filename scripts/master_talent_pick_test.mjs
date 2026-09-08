// Master talent pick from the stats panel (v0.30.425). Per user (video): clicking a master talent card in the
// U panel, then "Learn it (permanent)", did nothing - the cards stayed unchosen. The delegated card handler
// resolved the tier that owns the card (job or master) and then committed the pick to player.job regardless,
// so chooseTalent rejected the master id and returned silently.
// Drives the REAL path: the card is clicked in the DOM, the real confirm dialog is answered with its own Yes
// button, and the OUTCOME is asserted: player.talents[master] is set, the panel re-renders the chosen card,
// the job-tier pick still works, and the cost the confirm and the respec button quote is the level-scaled
// one (_lxRespecCost), not the retired flat 1500.
//   node scripts/master_talent_pick_test.mjs          MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree
// Negative control: v0.30.424 fails the master pick (the choice is dropped) and quotes 1500.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10231); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof openLevelUpPanel === 'function' && typeof chooseTalent === 'function' && typeof MASTER_TALENTS === 'object' && typeof player === 'object', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    // a level-66 Necromancer (Mage > Warlock > Necromancer) with the job talent taken and the master talent still owed
    player.cls = 'mage'; player.job = 'warlock'; player.master = 'necromancer'; player.level = 66;
    const jobPick = JOB_TALENTS.warlock[0].id; player.talents = { warlock: jobPick };
    const master = MASTER_TALENTS.necromancer.find((t) => /gravecall/i.test(t.name)) || MASTER_TALENTS.necromancer[0];
    o.masterId = master.id; o.cost = (typeof _lxRespecCost === 'function') ? _lxRespecCost() : null;
    openLevelUpPanel(); await sleep(300);
    const host = document.getElementById('lp-talent-host'); o.hostRendered = !!host;
    const card = host && host.querySelector('[data-talent="' + master.id + '"]'); o.cardRendered = !!card;
    o.respecLabelBefore = host ? ((host.textContent.match(/Respec \([^)]*\)/) || [''])[0]) : '';
    if (!card) return o;
    card.click();
    let modal = null; for (let i = 0; i < 30; i++) { await sleep(50); modal = document.getElementById('confirm-modal'); if (modal && modal.style.display !== 'none' && modal.offsetParent !== null) break; }
    o.confirmShown = !!(modal && modal.style.display !== 'none'); o.confirmTitle = (document.getElementById('confirm-title') || {}).textContent || '';
    o.confirmBody = (document.getElementById('confirm-body') || {}).textContent || '';
    const yes = document.getElementById('confirm-yes'); o.yesLabel = yes ? yes.textContent : ''; if (yes) yes.click();
    await sleep(500);
    o.masterAfter = player.talents.necromancer || null; o.jobKept = player.talents.warlock === jobPick;
    const host2 = document.getElementById('lp-talent-host'); o.hostAfter = host2 ? host2.textContent.replace(/\s+/g, ' ') : '';
    o.respecLabelAfter = host2 ? ((host2.textContent.match(/Respec \([^)]*\)/g) || []).join(' | ')) : '';
    // the job tier still learns through the same path
    player.talents = {}; openLevelUpPanel(); await sleep(300);
    const jc = document.getElementById('lp-talent-host').querySelector('[data-talent="' + jobPick + '"]'); o.jobCard = !!jc; if (jc) { jc.click(); for (let i = 0; i < 30; i++) { await sleep(50); const m2 = document.getElementById('confirm-modal'); if (m2 && m2.style.display !== 'none') break; } const y2 = document.getElementById('confirm-yes'); if (y2) y2.click(); await sleep(500); }
    o.jobAfter = player.talents.warlock || null;
    return o;
  });
  console.log('build ' + r.ver + ', master ' + r.masterId + ', level-scaled respec ' + r.cost + '◈');
  ok('the stats panel renders the master talent cards', r.hostRendered && r.cardRendered, JSON.stringify(r));
  ok('clicking a master card opens the permanence confirm for that talent', r.confirmShown && /Gravecall|Learn/.test(r.confirmTitle) && /Learn it/.test(r.yesLabel), r.confirmTitle + ' / ' + r.yesLabel);
  ok('"Learn it (permanent)" learns the MASTER talent (player.talents[master] set) and keeps the job talent', r.masterAfter === r.masterId && r.jobKept, 'master ' + r.masterAfter + ' jobKept ' + r.jobKept);
  ok('the panel re-renders the chosen master card', /✓/.test(r.hostAfter) && new RegExp('Gravecall ✓|' + r.masterId).test(r.hostAfter), r.hostAfter.slice(0, 200));
  ok('the confirm quotes the level-scaled respec cost, not 1500', r.cost != null && r.confirmBody.includes(r.cost + '◈') && !r.confirmBody.includes('1500◈'), r.confirmBody.slice(-80));
  ok('the respec buttons quote the level-scaled cost', r.respecLabelAfter.includes(r.cost + '◈') && !r.respecLabelAfter.includes('1500◈'), r.respecLabelBefore + ' -> ' + r.respecLabelAfter);
  ok('the job-tier card still learns through the same path', r.jobCard && r.jobAfter && r.jobAfter === JSON.parse(JSON.stringify(r.jobAfter)), 'job ' + r.jobAfter);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
