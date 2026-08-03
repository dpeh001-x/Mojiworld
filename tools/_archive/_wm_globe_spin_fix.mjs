// Globe-spin hardening — animationend can be missed (occluded windows freeze
// CSS animations; modal closed mid-spin cancels it). A hard timeout now
// guarantees the class drops, so the map can never stay stuck at the 0%
// keyframe (scale 0.55 / opacity 0).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const OLD = `    const _spinSvg = _spinGrid.querySelector('svg');
    if (_spinSvg) _spinSvg.addEventListener('animationend', () => _spinGrid.classList.remove('wm-globe-spin'), { once: true });`;
const NEW = `    const _spinSvg = _spinGrid.querySelector('svg');
    const _spinDone = () => { _spinGrid.classList.remove('wm-globe-spin'); if (_spinGrid._spinT) { clearTimeout(_spinGrid._spinT); _spinGrid._spinT = null; } };
    if (_spinSvg) _spinSvg.addEventListener('animationend', _spinDone, { once: true });
    // Hard fallback: occluded/throttled windows freeze CSS animations at the
    // 0% keyframe and never fire animationend — without this the map would
    // sit invisible (opacity 0, scale 0.55). 1.8s > the 1.6s animation.
    if (_spinGrid._spinT) clearTimeout(_spinGrid._spinT);
    _spinGrid._spinT = setTimeout(_spinDone, 1800);`;

const c = src.split(OLD).length - 1;
if (c !== 1) { console.error('FAIL: ' + c); process.exit(2); }
src = src.replace(OLD, NEW);
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: spin fallback applied.');
