// The U panel's words say what the game does.
//
// v0.30.631-632 corrected what six audits found wrong: 45 skill descriptions (mechanics that do not
// exist, numbers that drifted, cooldowns restated), the Block row ("Hold", "400 ms"), hardcoded key
// chips, the Level Up labels, the Innate Growth roll (it rolled one die, not the two its text, tally
// and ledger describe), boon and synergy texts, and MojiMon's "10x HP / your attack". This pins them:
// no stale phrase survives in any skill text, no skill text restates a cooldown, the Block row reads
// the class's real block profile, the chips follow a rebind, the innate roll reaches 0, 1 and 2, the
// boon texts match their code, and MojiMon's points stop at the cap they stop scaling at.
//   node scripts/u_panel_text_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11632), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
// fragments of what the texts used to claim; none may survive in any skill description
const STALE = ['slow but long reach', 'twin shockwaves', 'lifesteal, speed', '+50% range on every skill', 'then a ground-slam finisher', '~38x ATK', 'on screen (+1% execute',
  'faster than most', 'each strike a guaranteed crit', 'Cooldown 60s', 'teleport-chains through every nearby foe', 'converging at mid-height', 'Phantom V:', 'soul-scythes',
  'pierces 40% DEF', 'into a singularity', 'Costs 3 MP', 'lane, launching', '3.2x ATK', 'refunds 80% of its MP', 'refund up to its own MP', 'heals allies inside', 'pillar of judgment',
  'large void AoE', 'at 100% of your ATK', '1.5× ATK burst', 'RUPTURES for 5.5×', '10×–16×', '2.2× ATK/sec', 'that cannot miss', 'your own hits on the marked', '~46 s', 'The 30s cooldown', 'The 60s cooldown', '66s cooldown', '62s cooldown'];
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof renderSkillsReference === 'function' && typeof _applyInnateLevelupRng === 'function' && typeof POWERUPS !== 'undefined', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async (STALE) => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 200; loadMap('forest', 500); await sleep(2500);
    const descs = Object.entries(SKILLS).filter(([, s]) => s && s.desc);
    out.stale = []; for (const [id, s] of descs) for (const f of STALE) if (s.desc.includes(f)) out.stale.push(id + ': ' + f);
    out.cdInText = descs.filter(([, s]) => /\b\d+(\.\d+)?\s?s (cooldown|recast)\b|cooldown \d|\brecast\b.*\d+(\.\d+)?s/i.test(s.desc)).map(([id]) => id);
    out.count = descs.length;
    // Skills tab: the Block row and footer, the chips, the locked V tile
    const render = () => { const h = document.createElement('div'); document.body.appendChild(h); renderSkillsReference(h); const t = h.innerText; const chips = [...h.querySelectorAll('.skl-chip')].map((c) => c.textContent.trim()); h.remove(); return { t, chips }; };
    const P = getBlockProfile(); let v = render();
    out.block = { hasPress: v.t.includes('Press to block for ' + (P.block / 1000) + 's'), parry: v.t.includes('first ' + P.parry + ' ms'), noHold: !/Hold (to mitigate|A to block)/.test(v.t), noOld: !v.t.includes('400 ms'), footer: v.t.includes('s cooldown') };
    const oldD = SLOT_TO_KEY.d; SLOT_TO_KEY.d = 'Q'; v = render(); SLOT_TO_KEY.d = oldD; out.rebind = v.chips.includes('Q') && !v.chips.includes('Z');
    // every locked tile names ONE level - its text and its "Unlocks at Lv N" pill agree (V's text said Lv 20 beside a
    // Lv 25 pill) - and none shows an internal slot id. All four classes, no job, Lv 22.
    out.locked = []; out.noSlotId = true;
    for (const c of ['warrior', 'rogue', 'mage', 'archer']) {
      player.cls = c; player.job = null; player.master = null; player.level = 22;
      const h = document.createElement('div'); document.body.appendChild(h); renderSkillsReference(h);
      // textContent, not innerText: the tile's description lives in its collapsed detail panel
      for (const el of h.querySelectorAll('.skl-tile.locked')) out.locked.push(c + ':' + [...new Set(el.textContent.match(/Lv (\d+)/g) || [])].join('|'));
      if (/Slot [QCXBSAEW]\b/.test(h.textContent)) out.noSlotId = false; h.remove();
    }
    player.cls = 'warrior'; player.level = 200;
    // Level Up labels and the innate roll
    out.labels = LEVELUP_OPTIONS.filter((o) => ['hp', 'mp', 'atk', 'def', 'speed'].includes(o.id)).map((o) => o.label);
    const sp0 = player.skillPoints, seen = [0, 0, 0]; let sum = 0; for (let i = 0; i < 600; i++) { const t = _applyInnateLevelupRng(); seen[t]++; sum += t; } player.skillPoints = sp0;
    out.innate = { seen, mean: +(sum / 600).toFixed(2) };
    // boons and synergies against their code
    const P_ = (id) => POWERUPS.find((p) => p.id === id), SY = (k) => BOON_SYNERGIES.find((s) => s.key === k);
    player.cls = 'mage'; const mageSurge = P_('mpreg').fmt(3); player.cls = 'warrior'; const warSurge = P_('mpreg').fmt(3);
    out.boons = { mageSurge, warSurge, thorns: P_('thorns').fmt(30), exe: P_('execute').fmt(10), curse: SY('burningCurse').desc, casc: SY('cascadingCrits').desc, razor: SY('razorStorm').desc, flame: SY('flameVolley').desc };
    out.panelSrc = { mm: String(renderMojiMonPanel).includes('15× your max HP') && String(renderMojiMonPanel).includes('MOJIMON_ATK_MULT * 100'), boonEmpty: String(renderBoonPanel).includes('rarely from monsters once you reach Lv 20') };
    // MojiMon: a stat at the cap takes no more points
    const mm = _mojimonEnsure(); mm.roster = mm.roster || {}; mm.roster.slime = { upg: { hp: MOJIMON_UPG_PT_CAP, atk: 0, def: 0 } };
    _mojimonUi.upg('slime', 'hp', 1); out.mmCap = { hp: mm.roster.slime.upg.hp, cap: MOJIMON_UPG_PT_CAP };
    _mojimonUi.upg('slime', 'atk', 1); out.mmAtk = mm.roster.slime.upg.atk; delete mm.roster.slime;
    return out;
  }, STALE);
  ok(`no stale claim survives in the ${r.count} skill texts`, r.stale.length === 0, r.stale.slice(0, 6));
  ok('no skill text restates a cooldown (the pill carries the real one)', r.cdInText.length === 0, r.cdInText);
  ok('the Block row reads the class profile: a press, its length, a 300 ms parry, a cooldown', Object.values(r.block).every(Boolean), r.block);
  ok('the key chips follow a rebind (Z -> Q shows Q)', r.rebind === true);
  ok('every locked tile names one level (text and pill agree), and no tile shows an internal slot id', r.locked.length > 0 && r.locked.every((x) => !x.split(':')[1].includes('|')) && r.noSlotId, { locked: r.locked, noSlotId: r.noSlotId });
  ok('the Level Up cards say they add to the base stat', r.labels.length === 5 && r.labels.every((l) => l.includes('base')), r.labels);
  ok('the innate roll reaches 0, 1 and 2 bonus SP, 1 on average', r.innate.seen.every((n) => n > 60) && r.innate.mean > 0.85 && r.innate.mean < 1.15, r.innate);
  ok("Mana Surge names each class's own speed-up (mage 5x, others 30x at roll 3)", /5× faster/.test(r.boons.mageSurge) && /30× faster/.test(r.boons.warSurge), [r.boons.mageSurge, r.boons.warSurge]);
  ok('Thorns and Executioner say what they cover', r.boons.thorns.includes('contact') && r.boons.exe.includes('elites'), [r.boons.thorns, r.boons.exe]);
  ok('the synergy texts give their real odds and scope', r.boons.curse.includes('35 %') && r.boons.casc.includes('all your crits') && r.boons.razor.includes('max +60 %') && r.boons.flame.includes('25 % chance'), r.boons);
  ok('MojiMon says 15x HP and its real ATK share; the empty boon bag lists every source', r.panelSrc.mm && r.panelSrc.boonEmpty, r.panelSrc);
  ok('a MojiMon stat at the cap takes no more points; an open stat still does', r.mmCap.hp === r.mmCap.cap && r.mmAtk === 1, { cap: r.mmCap, atk: r.mmAtk });
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
