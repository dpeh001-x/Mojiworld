# Prologue patch — save gates, boot rewire, controller block insertion.
import os, io
HERE = os.path.dirname(__file__)
P = os.path.join(HERE, '..', 'mojiworld_game.html')
s = io.open(P, encoding='utf-8').read()
assert len(s) > 4_000_000, 'file suspiciously small — aborting'

def rep(anchor, new, n=1):
    assert s.count(anchor) == n, 'anchor not unique (%d): %r' % (s.count(anchor), anchor[:70])
    return s.replace(anchor, new)

# P1 — hard save gates: nothing persists while the prologue owns the state.
a = "function _flushSaveStateNow() {\n  try {"
s = rep(a, "function _flushSaveStateNow() {\n  // v0.26.x — Prologue: the flash-forward plays at Lv.100 on a fresh save;\n  // a flush here would persist the apex state. Hard-gated until restore.\n  if (window._prologueActive) return;\n  try {")
a = "function saveState() {\n  game._saveDirty = true;"
s = rep(a, "function saveState() {\n  if (window._prologueActive) return;   // v0.26.x — Prologue save gate (see _flushSaveStateNow)\n  game._saveDirty = true;")

# P2 — boot rewire: fresh saves enter the flash-forward prologue.
a = """if (!loadState()) {
  // v0.25.503 — Fresh-start lands the player in The Void (a quiet black
  // hub with a single bobbing-star portal back to Everdawn Central).
  loadMap('void', 400);
  openClassSelect();
}"""
s = rep(a, """if (!loadState()) {
  // v0.26.x — Fresh-start now opens on the flash-forward prologue: a
  // skippable cinematic + ~30s as the Lv.100 memory vs Gravitos, then the
  // strip beat lands the player in The Void for class select (the
  // pre-prologue flow, kept as the fallback).
  if (typeof _startPrologue === 'function') {
    _startPrologue();
  } else {
    loadMap('void', 400);
    openClassSelect();
  }
}""")

# P3 — controller block, inserted just above the Boss Rush block.
block = io.open(os.path.join(HERE, 'prologue_block.js'), encoding='utf-8').read()
assert 'function _startPrologue' in block and 'function _prologueFinish' in block
assert not any(0xD800 <= ord(c) <= 0xDFFF for c in block), 'lone surrogate in block'
a = '// v0.26.x — BOSS RUSH ("Hall of Echoes"). Re-fight every boss the player'
assert s.count('function _startPrologue') == 0, 'prologue already inserted?'
i = s.index(a)
head = s.rindex('// ====================================================================', 0, i)
s = s[:head] + block + s[head:]

assert not any(0xD800 <= ord(c) <= 0xDFFF for c in s), 'lone surrogate detected'
tmp = P + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
assert os.path.getsize(tmp) > 4_000_000
os.replace(tmp, P)
print('prologue patch OK, new size', os.path.getsize(P))
