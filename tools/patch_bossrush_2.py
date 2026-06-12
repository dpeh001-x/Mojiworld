# Boss Rush patch 2/2 — insert the controller block before the boot block.
import os, io
HERE = os.path.dirname(__file__)
P = os.path.join(HERE, '..', 'mojiworld_game.html')
s = io.open(P, encoding='utf-8').read()
assert len(s) > 4_000_000, 'file suspiciously small — aborting'

block = io.open(os.path.join(HERE, 'bossrush_block.js'), encoding='utf-8').read()
assert 'function _bossRushComplete' in block and 'function _bossRushAutoStart' in block
assert not any(0xD800 <= ord(c) <= 0xDFFF for c in block), 'lone surrogate in block'

anchor = '\nif (!loadState()) {'
assert s.count(anchor) == 1, 'boot anchor count = %d' % s.count(anchor)
assert s.count('function _bossRushAutoStart') == 0, 'controller already inserted?'
s = s.replace(anchor, '\n' + block + anchor)

assert not any(0xD800 <= ord(c) <= 0xDFFF for c in s), 'lone surrogate detected'
tmp = P + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
assert os.path.getsize(tmp) > 4_000_000
os.replace(tmp, P)
print('patch 2 OK, new size', os.path.getsize(P))
