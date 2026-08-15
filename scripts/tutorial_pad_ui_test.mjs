// A controller player can read the tutorial's prompts, and can always get the
// card back after minimising it.
// Per user: "controller function is very clunky", "when i minimise it there is
// no way to reopen the tutorial", "this part here is not calibrated".
// Run: node scripts/tutorial_pad_ui_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9192;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  window.__pad = { id: 'probe-pad', index: 0, connected: true, mapping: 'standard',
    timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__setBtn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 };
                                window.__pad.timestamp = performance.now(); };
});
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  window._prologueAfterCreation = false; window._prologueActive = false; window._prologuePending = false;
  player.cls = 'archer'; player._tutorialSeen = false;
  player._storyBeatsSeen = { tutorial_intro: true, tutorial_outro: true };
  // mark the pad as freshly used so the glyph path is live
  window.__setBtn(0, 1); await wait(120); window.__setBtn(0, 0);
  window.dispatchEvent(new Event('gamepadconnected'));
  await wait(400);
  if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
  startTutorial();
  await wait(700);
  const r = {};
  r.padActive = (typeof _lxPadActive === 'function') ? _lxPadActive(30000) : null;

  // ── the prompt a pad player reads ──
  const step = TUTORIAL_STEPS.find(s => /character panel/i.test(s.tryIt || ''));
  r.rawTryIt = step ? step.tryIt : null;
  r.renderedTryIt = step ? _tutTouchify(step.tryIt) : null;
  r.hasPadBadge = /class="pad-btn/.test(r.renderedTryIt || '');
  r.hasKeycap = /<kbd>/.test(r.renderedTryIt || '');
  // the attack step: a face button, with its hardware colour class
  const atk = TUTORIAL_STEPS.find(s => /swing your weapon/i.test(s.tryIt || ''));
  r.attackRendered = atk ? _tutTouchify(atk.tryIt) : null;
  r.attackIsFace = /pad-btn face x/.test(r.attackRendered || '');
  // the badge must actually be styled, not an unstyled span
  const probe = document.createElement('div');
  probe.innerHTML = r.renderedTryIt || '';
  document.body.appendChild(probe);
  const badge = probe.querySelector('.pad-btn');
  const cs = badge ? getComputedStyle(badge) : null;
  r.badgeStyled = !!(cs && cs.borderRadius !== '0px' && cs.display.indexOf('flex') >= 0);
  r.badgeRadius = cs ? cs.borderRadius : null;
  probe.remove();

  // ── MINIMISE, then can the card come back? ──
  const modal = document.getElementById('tutorial-modal');
  document.getElementById('tut-collapse').click();
  await wait(200);
  r.collapsed = modal.classList.contains('tut-collapsed');
  r.navRowHidden = getComputedStyle(document.getElementById('tut-nav-row')).display === 'none';
  // a) the tour advancing to a new step restores it on its own
  _tutStep++; _renderTutorialStep();
  await wait(300);
  r.reopenedOnAdvance = !modal.classList.contains('tut-collapsed');

  // b) the Settings route, which is what a pad reaches via Start
  document.getElementById('tut-collapse').click();
  await wait(200);
  r.collapsedAgain = modal.classList.contains('tut-collapsed');
  openSettingsModal();
  await wait(300);
  const btn = document.getElementById('set-tutorial-open');
  r.settingsBtnExists = !!btn;
  r.settingsIsPadRoot = (() => { try { _lxPadRootAt = -1; return (_lxPadModalRoot() || {}).id || null; } catch (e) { return 'ERR'; } })();
  r.settingsBtnFocusable = !!(btn && btn.offsetParent !== null && !btn.disabled);
  if (btn) btn.click();
  await wait(500);
  r.reopenedFromSettings = !modal.classList.contains('tut-collapsed')
    && !!document.querySelector('#tutorial-modal.tut-dock');
  // ── the U-panel jump row: the route the tutorial now names ──
  try { if (document.querySelector("#tutorial-modal.tut-dock")) document.getElementById("tut-skip").click(); } catch (e) {}
  try { closeSettingsModal(); } catch (e) {}
  await wait(300);
  openLevelUpPanel();          // the U panel that owns #u-tabs
  await wait(500);
  r.uOpen = !!document.getElementById("u-jump-row");
  const jumps = [...document.querySelectorAll("#u-jump-row .u-jump")];
  r.jumpLabels = jumps.map(b => b.dataset.ujump);
  r.jumpsVisible = jumps.every(b => b.offsetParent !== null);
  r.uIsPadRoot = (() => { try { _lxPadRootAt = -1; return (_lxPadModalRoot() || {}).id || null; } catch (e) { return "ERR"; } })();
  // the pad focus walker must be able to see them
  try {
    const foc = document.querySelectorAll("#u-tabs .inv-tab, #u-jump-row .u-jump");
    r.focusableCount = foc.length;
  } catch (e) { r.focusableCount = -1; }
  // press World Map and see the map actually open
  const mapBtn = jumps.find(b => b.dataset.ujump === "map");
  if (mapBtn) mapBtn.click();
  await wait(600);
  r.mapOpened = ((document.getElementById("worldmap-modal") || {}).style || {}).display === "flex";
  r.worldmapTagSeen = !!(typeof _TUT_SEEN_TAGS !== "undefined" && _TUT_SEEN_TAGS["worldmap"]);
  try { toggleWorldMap(); } catch (e) {}
  await wait(300);
  // and Quests
  openLevelUpPanel(); await wait(400);
  const qBtn = [...document.querySelectorAll("#u-jump-row .u-jump")].find(b => b.dataset.ujump === "quest");
  if (qBtn) qBtn.click();
  await wait(600);
  r.questTagSeen = !!(typeof _TUT_SEEN_TAGS !== "undefined" && _TUT_SEEN_TAGS["quest"]);
  return r;
});

ok('the pad is recognised as active', out.padActive === true, String(out.padActive));
ok('a pad prompt renders a CONTROLLER badge, not a keyboard keycap',
   out.hasPadBadge === true && out.hasKeycap === false,
   `padBadge=${out.hasPadBadge} keycap=${out.hasKeycap} :: ${out.renderedTryIt}`);
ok('the badge is really styled (round/pill, not a bare span)',
   out.badgeStyled === true, 'border-radius ' + out.badgeRadius);
ok('face buttons carry their hardware colour class', out.attackIsFace === true,
   out.attackRendered);
ok('minimising hides the card controls (the dead end)',
   out.collapsed === true && out.navRowHidden === true, `collapsed=${out.collapsed} navHidden=${out.navRowHidden}`);
ok('the tour re-opens itself when it advances to a new step',
   out.reopenedOnAdvance === true, String(out.reopenedOnAdvance));
ok('Settings is a pad-reachable root and carries the Tutorial button',
   out.settingsIsPadRoot === 'settings-modal-bg' && out.settingsBtnExists === true && out.settingsBtnFocusable === true,
   `root=${out.settingsIsPadRoot} btn=${out.settingsBtnExists}`);
ok('that button brings the minimised tour back',
   out.collapsedAgain === true && out.reopenedFromSettings === true,
   `collapsed=${out.collapsedAgain} reopened=${out.reopenedFromSettings}`);

ok("the U panel carries a jump row for the pad-unreachable panels",
   out.uOpen === true && out.jumpLabels && out.jumpLabels.join(",") === "map,quest,codex,mojidex",
   JSON.stringify(out.jumpLabels));
ok("its buttons are visible and the U panel is a pad root",
   out.jumpsVisible === true && !!out.uIsPadRoot, "padRoot=" + out.uIsPadRoot + " visible=" + out.jumpsVisible);
ok("the World Map button really opens the map", out.mapOpened === true, String(out.mapOpened));
ok("...and that ticks the worldmap objective", out.worldmapTagSeen === true, String(out.worldmapTagSeen));
ok("the Quests button ticks the quest objective", out.questTagSeen === true, String(out.questTagSeen));

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
