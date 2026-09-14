// A skill icon that fails to load once is not lost for the session.
// ============================================================================
// Per user, over a screenshot of the warrior bar: "some of the icons here are a
// little weird from warrior, ensure to use the original skill icons" - then,
// asked whether they recover: "they stay like that for full session".
//
// WHAT WAS RULED OUT FIRST. The art is not missing and not wrong: all fourteen
// warrior icons exist, are on origin, and are proper game art (a crescent
// slash, a roaring lion for War Cry, crossed flaming axes for Rampage...). On a
// clean boot every one of them loads - probed live, the desktop bar reported
// `art` for all nine slots and not one skill-icon request returned >= 400. So
// the emoji in that screenshot are the FALLBACK, with the real file sitting
// there loadable.
//
// THE MECHANISM. The probe is a one-way latch:
//
//     if (_skillIconStatus[id] === undefined) { ...probe once... }
//     im.onerror = () => { _skillIconStatus[id] = 'fail'; };
//
// `undefined` is the only state that probes. So the first failure is final: the
// id never asks again, and `_skillIconUrl` returns null for the rest of the
// session, which is precisely "they stay like that for full session". Those
// nine probes are fired during the ~2700-sprite boot storm - the one moment a
// request is most likely to be dropped, aborted or starved - and a drop there
// is indistinguishable from a skill that genuinely has no art.
//
// THE FIX. 'fail' becomes recoverable: up to LX_ICON_TRIES attempts, spaced by
// LX_ICON_RETRY_MS, and then final. The retry rides the HUD tick that was
// already calling _skillIconUrl rather than a timer, so nothing new is
// scheduled and an id that is never asked for again costs nothing. Retries
// carry a cache-buster, because a browser that cached the failed response would
// otherwise hand back the same failure. A genuinely missing icon still settles
// on its emoji after three tries and stops asking.
//
// THE GATE IS NOT DISTURBED. _lxSkillIconGateOpen latches open and returns
// early once latched, so an id going back to 'pending' for a retry cannot
// re-close it and drop already-resolved icons back to emoji - the exact
// regression its own comment warns about.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) icon-retry/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the bookkeeping, beside the status map -------------------------------------
sub('state',
  "const _skillIconStatus = Object.create(null);   // id -> 'pending' | 'ok' | 'fail'",
  J("const _skillIconStatus = Object.create(null);   // id -> 'pending' | 'ok' | 'fail'",
    '// v0.30.754 icon-retry — a failed probe used to be FINAL: `undefined` is the only state that',
    '// probes, so one dropped request pinned that skill to its emoji for the whole session with the',
    '// file perfectly loadable. These nine probes fire during the ~2700-sprite boot storm, which is',
    '// exactly when a request is most likely to be starved. Now a failure is retried a few times,',
    '// spaced, and only then final - so a genuinely missing icon still stops asking.',
    'const _skillIconTries = Object.create(null);    // id -> attempts so far',
    'const _skillIconFailAt = Object.create(null);   // id -> when the last attempt failed',
    'const _LX_ICON_TRIES = 3;',
    'const _LX_ICON_RETRY_MS = 1500;'));

// ---- 2. the probe records its failures, and can be asked again ----------------------
sub('probe',
  J('function _skillIconUrl(id) {',
    '  if (!id) return null;',
    '  if (_skillIconStatus[id] === undefined) {',
    "    _skillIconStatus[id] = 'pending';",
    '    const im = new Image();',
    "    im.onload = () => { _skillIconStatus[id] = 'ok'; };",
    "    im.onerror = () => { _skillIconStatus[id] = 'fail'; };"),
  J('function _skillIconUrl(id) {',
    '  if (!id) return null;',
    '  // v0.30.754 icon-retry — a failure is no longer the end of it. Retried on the HUD tick that was',
    '  // already going to call this, so no timer is scheduled and an id nobody asks for costs nothing.',
    "  if (_skillIconStatus[id] === 'fail') {",
    '    const _tn = _skillIconTries[id] | 0;',
    "    const _now = (typeof performance !== 'undefined' ? performance.now() : Date.now());",
    '    if (_tn < _LX_ICON_TRIES && (_now - (_skillIconFailAt[id] || 0)) >= _LX_ICON_RETRY_MS) {',
    '      _skillIconTries[id] = _tn + 1;',
    '      delete _skillIconStatus[id];   // falls into the probe below on this same call',
    '    } else return null;',
    '  }',
    '  if (_skillIconStatus[id] === undefined) {',
    "    _skillIconStatus[id] = 'pending';",
    '    const im = new Image();',
    "    im.onload = () => { _skillIconStatus[id] = 'ok'; };",
    "    im.onerror = () => {",
    "      // record WHEN, so the retry above can space itself without a timer",
    "      _skillIconFailAt[id] = (typeof performance !== 'undefined' ? performance.now() : Date.now());",
    "      _skillIconStatus[id] = 'fail';",
    '    };'));

// ---- 3. the retry must not be served the cached failure ------------------------------
sub('src',
  "    im.src = 'Sprites/skills/' + id + '.webp';",
  J('    // A retry carries a cache-buster: a browser that cached the failed response would hand',
    '    // back the same failure and the retry would prove nothing. The first attempt stays clean',
    '    // so the common path is still a plain, cacheable URL.',
    "    const _tq = _skillIconTries[id] | 0;",
    "    im.src = 'Sprites/skills/' + id + '.webp' + (_tq ? ('?r=' + _tq) : '');   // v0.30.754 icon-retry"));

const grew = s.length - n0;
if (grew < 800 || grew > 4000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: a failed skill-icon probe now retries ${3} times instead of being final (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
