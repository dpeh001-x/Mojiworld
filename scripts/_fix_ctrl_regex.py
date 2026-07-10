#!/usr/bin/env python3
# Replace the character-name sanitizer (which currently holds raw control bytes
# from an editor round-trip) with a pure-ASCII WHITELIST: keep letters, digits,
# space and hyphen; drop everything else (control chars, tag chars, punctuation).
# Matches the line by its ASCII anchors and spans the control bytes with .*?.
# Atomic write + match-count guard per CLAUDE.md file-safety rules.
import re, os

PATH = 'mojiworld_game.html'
src = open(PATH, encoding='utf-8').read()

pat = re.compile(r"let name = \(user\.value \|\| ''\)\.replace\(/\[.*?\]/g, ''\)\.trim\(\)\.slice\(0, 16\);")
repl = "let name = (user.value || '').replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 16);"

matches = pat.findall(src)
assert len(matches) == 1, f'expected exactly 1 sanitizer line, found {len(matches)}'
src = pat.sub(repl.replace('\\', '\\\\'), src)

for cp in (0x00, 0x1f, 0x7f):
    assert chr(cp) not in src, f'control byte {hex(cp)} still present'
assert repl in src, 'replacement not applied'

data = src.encode('utf-8')
tmp = PATH + '.tmp'
with open(tmp, 'wb') as f:
    f.write(data)
assert os.path.getsize(tmp) > 5_000_000
os.replace(tmp, PATH)
print(f'OK — sanitizer replaced with ASCII whitelist; control bytes purged; {len(data)} bytes')
