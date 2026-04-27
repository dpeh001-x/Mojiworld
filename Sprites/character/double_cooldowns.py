#!/usr/bin/env python3
"""One-shot script: double all `cd:NNN` values inside the SKILLS object
(maple_game.html lines 3755..3832) so every player skill cools down twice
as slowly. Monster skills + defense move cooldowns are left alone.

Used for v0.25.84.
"""
import re
import sys

PATH = r"C:\Users\Xenon\Desktop\LevelX\maple_game.html"
START_MARKER = "const SKILLS = {"
END_MARKER = "// Classes with base stat profiles and starting kit"


def double_cd(match):
    return f"cd:{int(match.group(1)) * 2}"


def main():
    with open(PATH, "r", encoding="utf-8", newline="") as f:
        src = f.read()
    start = src.find(START_MARKER)
    end = src.find(END_MARKER, start)
    if start < 0 or end < 0:
        print("Markers not found")
        sys.exit(1)
    head = src[:start]
    body = src[start:end]
    tail = src[end:]
    # Match cd: optionally followed by spaces and digits. Only inside the SKILLS body.
    new_body, count = re.subn(r"cd:\s*(\d+)", double_cd, body)
    print(f"Replaced {count} cd: entries (player skills only)")
    with open(PATH, "w", encoding="utf-8", newline="") as f:
        f.write(head + new_body + tail)


if __name__ == "__main__":
    main()
