// THE AMNESIAC EASES IN, AND THE EDICTS GO POP PUNK (per user: "Change amnesiac dialogue about 'why is it always almost morning' to what are
// you struggling to remember : my family, and this undiscernible noise in my head. Also in who are you, there is way too much information
// too deep, ease it in"; "the edicts of the weight bearer UI needs to be more pop punk in design").
//   Talk menu: "What are you struggling to remember?" (his family, a noise he cannot make out) and "What is the Everdawn?" (the Dawn hints,
//     which stay - the old label claimed a morning that half the maps are not in); nothing says almost-morning
//   Who are you?: three short pages the player steps down - the lost name, the door (with the offer to unmake one tap away), and, only if
//     asked, why the watcher sent you and the Twelve - not one long wall; Back works on each
//   Edicts: the panel is the Settings frame (paper keyline, pink offset), each card in its group's colour, filled when borne, a butter
//     Weight sticker; the rows still toggle
//   node scripts/amnesiac_ease_test.mjs [port]      (MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10311);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 360) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function' && typeof openEdictsPanel === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {};
    applyClass('warrior'); player.level = 60; player.quests = { active: {}, completed: {}, unlocked: {} }; try { _ensureQuests(); tickQuestUnlocks(); } catch (e) {}
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    const npc = game.npcs.find((x) => x.name === 'The Amnesiac');
    let last = ''; const rt = window._runDialogTypewriter; window._runDialogTypewriter = function (t) { last = String(t); return rt.apply(this, arguments); };
    const labels = () => [...document.querySelectorAll('#dialog-options > button')].map((b) => b.textContent.trim());
    const plain = () => last.replace(/<[^>]*>/g, '').replace(/\*/g, '').trim();
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options > button')].find((x) => re.test(x.textContent)); if (!b) return false; b.click(); await W8(200); return true; };
    const page = () => ({ text: plain(), words: plain().split(/\s+/).filter(Boolean).length, labels: labels() });
    const out = {};
    game._amnesiacStage = 0; game._amnesiacMenu = null; game._amnesiacSagaView = false; game.paused = false; openNPC(npc); await W8(250);
    out.top = labels(); await click(/Talk/); out.talk = labels();
    await click(/Who are you\?/); out.who1 = page();
    await click(/Go on/); out.who2 = page();
    await click(/Why was I sent here\?/); out.who3 = page();
    await click(/Back/); out.backTo2 = page();
    await click(/A door\? To what\?/); out.reset = page();
    out.unmakeRow = labels().some((l) => /Unmake me/.test(l));
    await click(/not ready/); game._amnesiacStage = 0; game._amnesiacMenu = null;
    openNPC(npc); await W8(200); await click(/Talk/); await click(/Who are you\?/); await click(/Back/); out.whoBack = labels();
    await click(/struggling to remember/); out.strug = page(); await click(/Back/); out.strugBack = labels();
    await click(/What is the Everdawn\?/); out.saga = page();
    try { closeDialog(); } catch (e) {}
    // the Edicts panel
    game.edicts = {}; openEdictsPanel(); await W8(300);
    const ed = document.getElementById('edicts-modal'), q = (s) => ed.querySelector(s), cs = (el) => getComputedStyle(el);
    const rows = [...ed.querySelectorAll('.edict-row')];
    out.ed = { n: rows.length, foe: rows.filter((r) => r.classList.contains('ed-foe')).length, self: rows.filter((r) => r.classList.contains('ed-self')).length, asc: rows.filter((r) => r.classList.contains('ed-asc')).length,
      card: { border: cs(q('.ed-card')).borderTopColor, bw: cs(q('.ed-card')).borderTopWidth, shadow: cs(q('.ed-card')).boxShadow, plate: /edicts_bg\.webp/.test(cs(q('.ed-card')).backgroundImage) },
      h2: { face: cs(q('h2')).fontFamily.split(',')[0].replace(/["']/g, ''), shadow: cs(q('h2')).textShadow, fill: cs(q('h2')).webkitTextFillColor },
      blur: cs(ed).backdropFilter || cs(ed).webkitBackdropFilter,
      offFoe: { bg: cs(rows[0]).backgroundColor, shadow: cs(rows[0]).boxShadow }, offSelf: { shadow: cs(rows[3]).boxShadow }, weight: { bg: cs(q('.ed-weight')).backgroundColor, w0: q('.ed-weight').textContent.trim() } };
    rows[0].click(); await W8(150); rows[3].click(); await W8(150);
    const ed2 = [...document.getElementById('edicts-modal').querySelectorAll('.edict-row')];
    out.on = { foe: { on: ed2[0].classList.contains('on'), bg: cs(ed2[0]).backgroundColor, border: cs(ed2[0]).borderTopColor, name: cs(ed2[0].querySelector('.ed-name')).color, tf: cs(ed2[0]).transform },
      self: { on: ed2[3].classList.contains('on'), bg: cs(ed2[3]).backgroundColor }, weight: document.getElementById('edicts-modal').querySelector('.ed-weight').textContent.trim(), edict: [game.edicts.ironVerdict, game.edicts.waningHand] };
    const lock = ed2.find((r) => r.classList.contains('locked')); out.lockedBorder = lock ? cs(lock).borderTopStyle : null;
    document.getElementById('edicts-close').click(); await W8(200); out.closed = !document.getElementById('edicts-modal');
    return out;
  });
  const T = R.talk || [];
  ok('the Talk menu asks what he is struggling to remember, and has no almost-morning', T.some((l) => /^What are you struggling to remember\?$/.test(l)) && !T.some((l) => /almost.morning/i.test(l)) && T.some((l) => /Who are you\?/.test(l)), T);
  ok('the Dawn hints stay, under a label that is true on every map', T.some((l) => /What is the Everdawn\?/.test(l)), T);
  ok('Who are you? opens on one short page: the lost name and the gate, none of the deep lore', R.who1.words <= 45 && /I had a name once/.test(R.who1.text) && /at a gate/.test(R.who1.text) && !/interference|nightmare|door|Twelve|watcher|champions|dream/i.test(R.who1.text), R.who1);
  ok('"Go on." steps one layer down: the door that opens only inward, a page of its own, with the offer to unmake', R.who2.words <= 60 && /opens only inward/.test(R.who2.text) && /start again/.test(R.who2.text) && !/Twelve|watcher|champions/.test(R.who2.text)
    && ['A door? To what?', 'Why was I sent here?', 'Back away slowly'].every((l) => R.who2.labels.includes(l)), R.who2);
  ok('only on asking does he say why the watcher sent you and who the Twelve are, and Back returns to the door', /watcher/.test(R.who3.text) && /Twelve champions/.test(R.who3.text) && /stuck mid-question/.test(R.who3.text) && /opens only inward/.test(R.backTo2.text), { who3: R.who3.words, back: R.backTo2.text.slice(0, 50) });
  ok('the unmake offer is still two taps from Who are you? ("A door? To what?" -> the reset page with Unmake me)', /To the beginning/.test(R.reset.text) && R.unmakeRow, R.reset.labels);
  ok('Back from the first page returns to the Talk menu', (R.whoBack || []).some((l) => /What are you struggling to remember\?/.test(l)), R.whoBack);
  ok('"What are you struggling to remember?" answers: his family, and a noise he cannot make out - no sister, no song named', /My family/.test(R.strug.text) && /noise/.test(R.strug.text) && /make it out|slips/.test(R.strug.text) && !/sister|brother|song/i.test(R.strug.text) && R.strug.words <= 55, R.strug);
  ok('Back from his answer returns to the Talk menu', (R.strugBack || []).some((l) => /Who are you\?/.test(l)), R.strugBack);
  ok('"What is the Everdawn?" still gives the Dawn monologue (its first act asks why no one can dream)', /You ask why no one here can dream/.test(R.saga.text) && /Dawn Fragments recovered/.test(R.saga.text), R.saga.text.slice(0, 80));
  const E = R.ed;
  ok('the Edicts panel lists its eight cards in three groups: three foes\' burdens, three of yours, two Ascendant', E.n === 8 && E.foe === 3 && E.self === 3 && E.asc === 2, [E.n, E.foe, E.self, E.asc]);
  ok('the card is the Settings frame: a 3 px paper keyline and a hard hot-pink offset over the painted plate', E.card.border === 'rgb(247, 245, 239)' && E.card.bw === '3px' && /rgb\(255, 61, 139\) 9px 9px 0px/.test(E.card.shadow) && E.card.plate, E.card);
  ok('the title is a white sticker with an ink ring and a pink offset, set in Nunito; the overlay keeps its blur', E.h2.face === 'Nunito' && /rgb\(255, 61, 139\) 4px 4px 0px/.test(E.h2.shadow) && E.h2.fill === 'rgb(255, 255, 255)' && /blur/.test(E.blur || ''), { h2: E.h2, blur: E.blur });
  ok('a card at rest is dark with a hard offset in its group colour (foe pink, yours violet)', E.offFoe.bg === 'rgb(21, 19, 28)' && /rgb\(255, 61, 139\) 4px 4px 0px/.test(E.offFoe.shadow) && /rgb\(183, 140, 255\) 4px 4px 0px/.test(E.offSelf.shadow), E);
  ok('a borne card fills solid in its group colour with ink text and a paper offset, tipped a touch; the Edict is switched on', R.on.foe.on && R.on.foe.bg === 'rgb(255, 61, 139)' && R.on.foe.border === 'rgb(12, 11, 16)' && R.on.foe.name === 'rgb(12, 11, 16)'
    && R.on.foe.tf !== 'none' && R.on.self.on && R.on.self.bg === 'rgb(183, 140, 255)' && R.on.edict[0] === true && R.on.edict[1] === true, R.on);
  ok('the Weight is a butter sticker that counts the borne Edicts', E.weight.bg === 'rgb(255, 228, 92)' && E.weight.w0 === 'WEIGHT 0' && R.on.weight === 'WEIGHT 2', { before: E.weight, after: R.on.weight });
  ok('a locked Ascendant card reads as locked (dashed edge), and the panel still closes', R.lockedBorder === 'dashed' && R.closed, { locked: R.lockedBorder, closed: R.closed });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
