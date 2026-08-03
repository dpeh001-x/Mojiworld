// Transcendence · Batch 1 — transcendItem() engine + cost const, appended
// after openEnhancementModal. ★10 gear can transcend ONCE: stars reset to 0,
// base stats become 50% of the current ★10 totals (base × 1.08^10 × 0.5).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const ANCHOR = `function openEnhancementModal() {
  renderEnhancementModal(null);
  document.getElementById('enhance-modal').style.display = 'flex';
  game.paused = true;
}`;

const NEW = ANCHOR + `

// =========================================================================
// v0.26.836 — TRANSCENDENCE. A ★10 piece can be transcended ONCE: it restarts
// at ★0 but keeps 50% of its current (★10) stat totals baked into its BASE
// stats — i.e. base × 1.08^10 × 0.5 ≈ base × 1.079. Re-forged back to ★10 it
// peaks ~8% above the old cap. Costs TRANSCEND_COST setshards (above the
// 500◈ heirloom — this is the endgame pinnacle spend). Option lives in the
// enhancement UI's maxed-item preview (renderEnhancementModal).
// =========================================================================
const TRANSCEND_COST = 800;
// Meta keys that must never be treated as stats when baking.
const _TRANSCEND_META = new Set(['price', 'tier', 'rarity', 'stars', 'dropLevel', 'qty', 'id', 'x', 'y', 'w', 'h']);
async function transcendItem(it) {
  if (!it || (it.stars || 0) < MAX_STARS) { showToast('Only ★' + MAX_STARS + ' gear can transcend.', 'rare'); return; }
  if (it.transcended) { showToast('🜂 Already transcended — once per item.', 'rare'); return; }
  if ((player.setshards || 0) < TRANSCEND_COST) { showToast('Need ' + TRANSCEND_COST + '◈ setshards (you have ' + (player.setshards || 0) + '◈).', 'rare'); return; }
  const _keepMul = Math.pow(STAR_GROWTH, MAX_STARS) * 0.5;          // ≈ 1.079 — 50% of ★10 totals as new base
  const _newPeakPct = Math.round((_keepMul * Math.pow(STAR_GROWTH, MAX_STARS) - 1) * 100);
  const _body =
    'Transcendence reforges ' + (it.name || 'this item') + ' beyond its limits.\\n\\n' +
    '• ★ resets to 0 — but the new BASE stats are 50% of its current ★' + MAX_STARS + ' totals (≈ +' + Math.round((_keepMul - 1) * 100) + '% over the original base).\\n' +
    '• Forged back to ★' + MAX_STARS + ', it peaks at ~+' + _newPeakPct + '% over original base — beyond the old cap.\\n' +
    '• ONCE per equipment. Irreversible.\\n' +
    '• Cost: ' + TRANSCEND_COST + '◈ setshards  (you have ' + (player.setshards || 0) + '◈)';
  const _ok = (typeof uiConfirm === 'function')
    ? await uiConfirm({ title: '🜂 Transcend ' + (it.name || 'item'), body: _body, yesLabel: 'Transcend (' + TRANSCEND_COST + '◈)', noLabel: 'Not yet' })
    : true;
  if (!_ok) return;
  // Re-validate after the await (state may have changed during the confirm).
  if ((player.setshards || 0) < TRANSCEND_COST || it.transcended || (it.stars || 0) < MAX_STARS) { showToast('Transcendence conditions no longer met.', 'rare'); return; }
  player.setshards -= TRANSCEND_COST;
  // Bake: every star-scaled numeric stat × keepMul. Mirrors getEquipBonus's
  // scaling set — skips meta keys and the discrete _AFFIX_NO_SCALE flags
  // (multishot/burn/extraJumps are counts; stars never scaled them either).
  for (const k in it) {
    if (typeof it[k] !== 'number' || _TRANSCEND_META.has(k)) continue;
    if (typeof _AFFIX_NO_SCALE !== 'undefined' && _AFFIX_NO_SCALE.has(k)) continue;
    it[k] = Math.round(it[k] * _keepMul * 100) / 100;
  }
  it.stars = 0;
  it.transcended = true;
  if (typeof refreshGearCache === 'function') refreshGearCache();
  if (typeof flash === 'function') flash(0.35);
  if (typeof addShake === 'function') addShake(10);
  showToast('🜂 ' + (it.name || 'Equipment') + ' TRANSCENDS! Reborn at ★0 with half its peak power as base — forge it anew.', 'legendary');
  if (typeof saveState === 'function') saveState();
  renderEnhancementModal(it);
}`;

const c = src.split(ANCHOR).length - 1;
if (c !== 1) { console.error('FAIL anchor: ' + c); process.exit(2); }
src = src.replace(ANCHOR, NEW);
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: transcendItem engine inserted.');
