// A live boss's current form is never released by the canvas budget mid-fight (boss set pin, 2026-10-16).
// ============================================================================
// Per user: boss visuals must never lag a fight. Since v0.30.1639 the game's cached canvas copies (decode pins, boss frame
// bakes, tints, backdrops) share one budget: 160M px on a desktop-class device, 40M px on an iOS-class one, with a 1.5x
// ceiling while a boss lives on a desktop-class budget (v0.30.1790). Gravitos's third form outgrew it: measured on v0.30.1814
// with his seven form-3 sets in rotation and a kit bot hitting him,
//   - DPR 2 / 3 (desktop): his form-3 frames alone are ~169M px; the fight's other copies grow ~1M px a second, so every ~60 s
//     the pool met the 240M ceiling and the trim dropped ~45M px - his star / walk / attack frames among them. Each came back
//     as an off-thread re-bake with his pose held meanwhile: 20 releases, 17 re-bakes, 13 held poses in ~150 s (DPR 3: 14 / 11 / 18).
//   - iPhone (iOS-class 40M budget, DPR 1, CPU x4): his form 3 is 60M px against 40M, so a set was released 5 s after its
//     last draw and re-baked on its next use: 135 releases, 80+ re-bakes, 158 held poses; the re-bakes cost 0.8 s of main
//     thread (one 147 ms) and the re-pins 0.4 s.
// Now, while a boss lives, every frame of its CURRENT form (m._phaseSprite or m.type with its cast sets; a zodiac boss's sign)
// is skipped by the trim and rides on top of the budget: the trim's lines rise to (pinned px + half the budget), so everything
// else keeps at least half the budget (a first cut that left the lines alone squeezed the rest of an iPhone's art out: 354
// in-frame re-pins, 1.9 s of main thread, against 145 before). When the pool is over that line the boss's other forms and bosses
// no longer alive go first (forms only go forward), then everything else as before. Past _LX_CV_PIN_CAP (2x the budget on a
// desktop-class budget, 2.5x on an iOS-class one) anything idle goes, least recently drawn first, down to 0.9x of it, and the
// raised line never passes that 0.9x - so memory stays bounded. Desktop DPR 2: ~249M px in his form 3 against ~240M before.
// A form too big to keep WHOLE under the cap (an iPad at Sharp Display: Gravitos form 3 at DPR 2.5 is ~169M px against 100M) is
// left to the old rule: pinning part of it only moved the churn (measured: held poses 59 -> 165).
//   - _lxCvUseStamp: marks each live boss's current-form frames (and their sources) with a stamp, once per game frame
//   - _lxCvInUse: a tracked copy whose source carries the stamp
//   - _lxCvPinnedPx: the in-use copies' pixels, for the raised line
//   - _lxCvTrim: lines raised; pass 1 and pass 2 skip in-use copies; _lxCvTrimOldForms runs between them; _lxCvTrimCap past the cap
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxCvUseStamp(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the pin: cap, stamp, membership, and the two extra passes - beside the trim's own constants
{
  const A = "const _LX_CV_AWAY_MS = 5000, _LX_CV_HERE_MS = (_LX_CV_BUDGET_PX < 1e8) ? 5000 : 15000;";
  once(A, J(A,
    "// v0.30.1825 boss-set-pin - A LIVE BOSS'S CURRENT FORM STAYS BAKED (per user: boss visuals must never lag a fight). Measured on v0.30.1814 with",
    "// Gravitos's seven form-3 sets in rotation: at DPR 2 / 3 his form-3 frames alone are ~169M px of canvas and the fight's other copies",
    "// grow ~1M px a second, so every ~60 s the pool met the 1.5x ceiling and the trim dropped ~45M px - his star / walk / attack frames",
    "// among them - each coming back as a re-bake with his pose held meanwhile (20 releases, 17 re-bakes, 13 held poses in 150 s). On an",
    "// iOS-class budget it never stopped (DPR 1: 135 releases, 80 re-bakes, 158 held poses). While a boss lives, every frame of its CURRENT",
    "// form (m._phaseSprite or m.type, with its cast sets; a zodiac boss's sign) is skipped by the trim and rides ON TOP of the budget:",
    "// the lines below rise to (pinned px + half the budget), so the rest of the art keeps at least half of it. Over that line the boss's",
    "// other forms and bosses no longer alive go first (forms only go forward), then the rest as before. Past _LX_CV_PIN_CAP anything",
    "// idle goes, least recently drawn first, down to 0.9x of it, and the raised line never passes that 0.9x: memory is bounded by the",
    "// cap - 2x the budget on a desktop-class budget (320M px), 2.5x on an iOS-class one (100M px, ~400 MB). Gravitos form 3 is 60M px",
    "// at DPR 1 (an iPhone keeps all of it) and 169M at DPR 2+ (a desktop keeps all of it). A form that cannot be kept WHOLE under the",
    "// cap (an iPad at Sharp Display, DPR ~2.5: 169M px against 100M) is left to the old rule - pinning part of it only moved the",
    "// churn (held poses 59 -> 165 in the same fight).",
    "const _LX_CV_PIN_CAP = _LX_CV_BUDGET_PX * (_LX_CV_BUDGET_PX < 1e8 ? 2.5 : 2);   // v0.30.1825 boss-set-pin",
    "let _lxCvUseSeq = 0, _lxCvUseAt = -1, _lxCvUseNow = 0;   // v0.30.1825 boss-set-pin - the stamp, memoised per game frame",
    "function _lxCvUseStamp() {   // v0.30.1825 boss-set-pin - marks every frame of each live boss's current form; 0 when no boss lives",
    "  const t = (typeof game !== 'undefined' && game) ? (game.time | 0) : 0;",
    "  if (t > 0 && t === _lxCvUseAt) return _lxCvUseNow;",
    "  _lxCvUseAt = t; _lxCvUseNow = 0;",
    "  const ms = (typeof game !== 'undefined' && game && game.monsters) || null;",
    "  if (!ms || !ms.length) return 0;",
    "  const st = ++_lxCvUseSeq; let any = false, want = 0;",
    "  const mark = (a) => { if (!Array.isArray(a)) return; const c = _lxShrinkCap(Math.max(720, a._lxBaseMin || 0));",
    "    for (const x of a) if (x) { x._lxCvUse = st; if (x._lxSrc) x._lxSrc._lxCvUse = st;",
    "      if (x.tagName === 'CANVAS') want += x.width * x.height;   // v0.30.1825 boss-set-pin - its copy as baked; a raw frame counts at the size it will bake to",
    "      else { const w = x.naturalWidth | 0, h = x.naturalHeight | 0, k = (w > 0 && h > 0) ? Math.min(1, c / Math.max(w, h)) : 0; want += w * h * k * k; } } };",
    "  const fam = (k, p) => k === p || (k.length > p.length && k.indexOf(p) === 0 && k.charCodeAt(p.length) >= 97 && k.charCodeAt(p.length) <= 122);",
    "  try {",
    "    const B = [BOSS_IDLE_FRAMES, BOSS_WALK_FRAMES, BOSS_ATTACK_FRAMES, BOSS_WEAVE_FRAMES, BOSS_DUCK_FRAMES];",
    "    const Z = [ZODIAC_IDLE_FRAMES, ZODIAC_WALK_FRAMES, ZODIAC_ATTACK_FRAMES, ZODIAC_CHARGE_FRAMES, ZODIAC_POUNCE_FRAMES, ZODIAC_FLY_FRAMES, ZODIAC_TURN_FRAMES];",
    "    for (const m of ms) {",
    "      if (!m || !(m.currentHp > 0) || !(m.isBoss || m.boss || m.zodiacBoss || m.superBoss)) continue;",
    "      any = true;",
    "      if (m.zodiacSign) { for (const S of Z) if (S) mark(S[m.zodiacSign]); continue; }",
    "      const p = m._phaseSprite || m.type; if (!p) continue;   // v0.30.1825 boss-set-pin - gravitos3 -> gravitos3, gravitos3punch, ... (not gravitos / gravitos2*)",
    "      for (const S of B) if (S) for (const k in S) if (fam(k, p)) mark(S[k]);",
    "    }",
    "  } catch (e) {}",
    "  if (want + _LX_CV_BUDGET_PX * 0.5 > _LX_CV_PIN_CAP * 0.9) return 0;   // v0.30.1825 boss-set-pin - too big to keep whole: the old rule (see above)",
    "  return (_lxCvUseNow = any ? st : 0);",
    "}",
    "function _lxCvPinnedPx(st) { let n = 0; for (const [cv, e] of _lxCvLru) if (_lxCvInUse(cv, st)) n += e.px; return n; }   // v0.30.1825 boss-set-pin",
    "function _lxCvInUse(cv, st) { if (cv._lxCvUse === st) return true; const sr = cv._lxSrc; return !!(sr && sr._lxCvUse === st); }   // v0.30.1825 boss-set-pin - a bake / pin carries its <img> as _lxSrc",
    "function _lxCvTrimOldForms(target, now, st) {   // v0.30.1825 boss-set-pin - boss frames NOT in use (other forms, bosses gone), idle 5 s: first",
    "  for (const [cv, e] of _lxCvLru) {",
    "    if (_lxCvLruPx <= target || now - cv._lxLruT < _LX_CV_AWAY_MS) break;",
    "    const sr = cv._lxSrc;",
    "    if (sr && sr._lxSet && !_lxCvInUse(cv, st)) _lxCvRelease(cv, e);   // v0.30.1825 boss-set-pin - _lxSet: a boss frame (_loadBossFrames)",
    "  }",
    "}",
    "function _lxCvTrimCap(now) {   // v0.30.1825 boss-set-pin - past the pin cap anything idle goes (the pinned frames too), least recently drawn first",
    "  const to = _LX_CV_PIN_CAP * 0.9;",
    "  for (const [cv, e] of _lxCvLru) {",
    "    if (_lxCvLruPx <= to || now - cv._lxLruT < _LX_CV_HERE_MS) break;",
    "    _lxCvRelease(cv, e);",
    "  }",
    "}"), 'trim constants');
}
// 2) the trim: stamp once, skip in-use copies in both passes, old forms between them, the cap at the end
{
  const A = "  const target = _LX_CV_BUDGET_PX * 0.8, now = performance.now(), map = _lxCvMapNow();";
  once(A, J("  const _use = _lxCvUseStamp(), _pf = _use ? Math.min(_lxCvPinnedPx(_use) + _LX_CV_BUDGET_PX * 0.5, _LX_CV_PIN_CAP * 0.9) : 0;   // v0.30.1825 boss-set-pin - 0 when no boss lives: the trim runs exactly as before",
    "  const target = Math.max(_LX_CV_BUDGET_PX * 0.8, _pf), now = performance.now(), map = _lxCvMapNow();   // v0.30.1825 boss-set-pin - the line rides above the pinned form"), 'trim head');
}
{
  const A = "    if (cv._lxMapT === map && now - cv._lxLruT < 120000) continue;   // this map's copies (its monsters' rarer frames, made at warm-up) stay - for now";
  once(A, J(A, "    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin - a live boss's current form stays"), 'trim pass 1');
}
{
  const A = J("  if (_lxCvLruPx <= target) return;", "  // v0.30.1790 boss-lag - a boss fight on a desktop-class budget keeps");
  once(A, J("  if (_lxCvLruPx <= target) return;",
    "  if (_use) { _lxCvTrimOldForms(target, now, _use); if (_lxCvLruPx <= target) return; }   // v0.30.1825 boss-set-pin - the boss's other forms first",
    "  // v0.30.1790 boss-lag - a boss fight on a desktop-class budget keeps"), 'trim between passes');
}
{
  once("  if (_ceil && _lxCvLruPx <= _ceil) return;", "  if (_ceil && _lxCvLruPx <= Math.max(_ceil, _pf)) return;   // v0.30.1825 boss-set-pin - raised with the pinned form", 'trim ceiling');
  once("  const _target2 = _ceil ? _ceil * 0.8 : target;", "  const _target2 = _ceil ? Math.max(_ceil * 0.8, _pf) : target;   // v0.30.1825 boss-set-pin", 'trim target2');
}
{
  const A = J("    if (_lxCvLruPx <= _target2 || now - cv._lxLruT < _LX_CV_HERE_MS) break;", "    _lxCvRelease(cv, e);", "  }", "}");
  once(A, J("    if (_lxCvLruPx <= _target2 || now - cv._lxLruT < _LX_CV_HERE_MS) break;",
    "    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin",
    "    _lxCvRelease(cv, e);", "  }",
    "  if (_use && _lxCvLruPx > _LX_CV_PIN_CAP) _lxCvTrimCap(now);   // v0.30.1825 boss-set-pin - the memory line still holds", "}"), 'trim pass 2');
}

const grew = s.length - n0;
if (grew < 5300 || grew > 6500) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: boss-set-pin (+' + grew + ' chars)');
