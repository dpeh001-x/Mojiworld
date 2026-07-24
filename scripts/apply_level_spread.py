# v0.29.224 level-spread pass: remap MOB_NATURAL_LEVEL (sub-15 thinned, 15-70
# band spread onto 20-80), rescale each moved mob's base stat block with the
# house per-level coefficients (hp/atk/exp x1.032/lvl, def/coins x1.0264/lvl),
# and sync any def-block `level:` field. Atomic write + match-count guards.
import json, os, re, sys

GAME = 'mojiworld_game.html'
NEW = json.load(open(sys.argv[1]))['NEW'] if len(sys.argv) > 1 else None
OLD = {k: v['natural'] for k, v in json.load(open(sys.argv[2]))['mobs'].items() if v['natural'] is not None}
assert NEW and OLD

html = open(GAME, encoding='utf-8').read()

# --- slice bounds ---
nat_start = html.index('const MOB_NATURAL_LEVEL = {')
nat_end = html.index('\n};', nat_start)
mt_start = html.index('const monsterTypes = {')
mt_end = html.index('\n};', mt_start)

report, errors = [], []

# --- 1. natural-level table ---
nat = html[nat_start:nat_end]
for key, new_lv in sorted(NEW.items()):
    old_lv = OLD.get(key)
    if old_lv is None or old_lv == new_lv:
        continue
    pat = re.compile(r'\b%s:\s*%d\b' % (re.escape(key), old_lv))
    hits = pat.findall(nat)
    if len(hits) != 1:
        errors.append('natural %s: %d matches for %s->%s' % (key, len(hits), old_lv, new_lv))
        continue
    nat = pat.sub('%s: %d' % (key, new_lv), nat, count=1)
    report.append('lvl  %-26s %3d -> %3d' % (key, old_lv, new_lv))
html = html[:nat_start] + nat + html[nat_end:]

# --- 2. stat blocks ---
mt_end = html.index('\n};', mt_start)          # recompute after splice
mt = html[mt_start:mt_end]
starts = [(m.group(1), m.start()) for m in re.finditer(r'\n  (\w+):\s*\{', mt)]
blocks = {}
for i, (key, pos) in enumerate(starts):
    end = starts[i + 1][1] if i + 1 < len(starts) else len(mt)
    blocks[key] = (pos, end)

def scale_field(block, field, mul):
    m = re.search(r'\b%s:\s*(\d+)' % field, block)
    if not m:
        return block, None
    old = int(m.group(1))
    new = max(1, round(old * mul))
    return block[:m.start()] + '%s:%d' % (field, new) + block[m.end():], (old, new)

for key, new_lv in sorted(NEW.items()):
    old_lv = OLD.get(key)
    if old_lv is None or old_lv == new_lv or key not in blocks:
        if key not in blocks and old_lv != new_lv:
            errors.append('no def block for %s' % key)
        continue
    d = new_lv - old_lv
    mul_a = 1.032 ** d      # hp / atk / exp
    mul_b = 1.0264 ** d     # def / mojicoins
    pos, end = blocks[key]
    block = mt[pos:end]
    changes = []
    for f, mul in (('hp', mul_a), ('atk', mul_a), ('exp', mul_a), ('def', mul_b), ('mojicoins', mul_b)):
        block, ch = scale_field(block, f, mul)
        if ch:
            changes.append('%s %d->%d' % (f, ch[0], ch[1]))
    lv = re.search(r'\blevel:\s*(\d+)\b', block)
    if lv and int(lv.group(1)) == old_lv:
        block = block[:lv.start()] + 'level: %d' % new_lv + block[lv.end():]
        changes.append('level %d->%d' % (old_lv, new_lv))
    mt = mt[:pos] + block + mt[end:]
    # blocks after this one shift; rebuild index
    starts = [(m.group(1), m.start()) for m in re.finditer(r'\n  (\w+):\s*\{', mt)]
    blocks = {}
    for i, (k2, p2) in enumerate(starts):
        blocks[k2] = (p2, starts[i + 1][1] if i + 1 < len(starts) else len(mt))
    report.append('stat %-26s %s' % (key, ', '.join(changes)))

html = html[:mt_start] + mt + html[mt_end:]

if errors:
    print('ABORT - guards failed:')
    for e in errors:
        print(' ', e)
    sys.exit(1)

assert not any(0xD800 <= ord(c) <= 0xDFFF for c in html)
tmp = GAME + '.tmp'
open(tmp, 'w', encoding='utf-8').write(html)
assert os.path.getsize(tmp) > 6000000
os.replace(tmp, GAME)
for r in report:
    print(r)
print('OK: %d edits applied' % len(report))
