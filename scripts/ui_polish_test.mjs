// Live test: (1) story-beat slides advance IN-PLACE (no overlay drop + 700ms re-fade
// per click = the "slides lag" complaint); (2) toasts are compact (11px, wrapped,
// width-capped) and the visible stack caps at 4 so notifications can't flood.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof showToast === 'function' && typeof _playStoryBeat === 'function', null, { timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { game.paused = false; window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (e) {} });

  // ---- Story beat: play a real beat, advance a stanza, assert the overlay
  // NEVER drops .on mid-advance and the stage uses the fast .re path.
  const beat = await page.evaluate(async () => {
    const id = Object.keys(STORY_BEATS).find(k => STORY_BEATS[k] && STORY_BEATS[k].stanzas && STORY_BEATS[k].stanzas.length >= 2);
    if (!id) return { noBeat: true };
    if (player._storyBeatsSeen) delete player._storyBeatsSeen[id];
    const started = _playStoryBeat(id);
    const ov = document.getElementById('story-beat-overlay');
    const stage = document.getElementById('story-beat-stage');
    const onAfterOpen = ov.classList.contains('on');
    const text1 = document.getElementById('story-beat-text').textContent;
    // watch for any .on drop during the advance
    let dropped = false;
    const mo = new MutationObserver(() => { if (!ov.classList.contains('on')) dropped = true; });
    mo.observe(ov, { attributes: true, attributeFilter: ['class'] });
    ov.click();   // advance to stanza 2
    await new Promise(r => setTimeout(r, 120));
    mo.disconnect();
    const text2 = document.getElementById('story-beat-text').textContent;
    const usedFastPath = stage.classList.contains('re');
    const stillOn = ov.classList.contains('on');
    // clean up: click through the rest
    for (let i = 0; i < 12 && ov.classList.contains('on'); i++) { ov.click(); await new Promise(r => setTimeout(r, 30)); }
    return { id, started, onAfterOpen, textChanged: text1 !== text2, dropped, usedFastPath, stillOn };
  });
  ok('story beat opens', beat.started === true && beat.onAfterOpen === true, beat);
  ok('stanza advance swaps text IN-PLACE (no overlay drop → no lag)', beat.textChanged && beat.dropped === false && beat.stillOn === true, beat);
  ok('advance uses the fast .re transition (180ms, not 700ms re-fade)', beat.usedFastPath === true, beat);
  // transition duration on the stage is the shortened one
  const trans = await page.evaluate(() => getComputedStyle(document.getElementById('story-beat-stage')).transitionDuration);
  ok('stage entry fade shortened (0.36s, was 0.7s)', trans.includes('0.36'), { trans });

  // ---- Toasts: compact + capped.
  const toast = await page.evaluate(() => {
    for (let i = 0; i < 9; i++) showToast('✅ Quest complete — 🗺 A Very Long Quest Name That Used To Span The Whole Screen +250🪙 +80 EXP', 'legendary');
    const live = document.querySelectorAll('#toast-container .toast');
    const cs = getComputedStyle(live[0]);
    return {
      visible: live.length,
      fontSize: cs.fontSize, whiteSpace: cs.whiteSpace,
      maxWidth: cs.maxWidth, widthPx: live[0].offsetWidth,   // layout px — transform/scale-independent
      containerMaxH: getComputedStyle(document.getElementById('toast-container')).maxHeight,
    };
  });
  ok('toast stack capped at 4 (9 fired)', toast.visible === 4, toast);
  ok('legendary quest toast compact (12px, was 16px) + wrapping', toast.fontSize === '12px' && toast.whiteSpace === 'normal', toast);
  ok('long quest toast width-capped (≤ 492px layout, was screen-wide)', toast.widthPx <= 492, toast);

  ok('no page errors', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== STORY-SLIDE LAG + TOAST FLOOD ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
