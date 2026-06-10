"""HUD / UI elements for LevelX.

Outputs:
  sprites/ui/hp_bar.png             200x14  (red shell, empty — game draws fill)
  sprites/ui/mp_bar.png             200x14
  sprites/ui/exp_bar.png            200x14
  sprites/ui/skill_slot.png         52x64
  sprites/ui/skill_slot_cooldown.png 52x64 (grey overlay variant)
  sprites/ui/dialog_box.png         384x112 (wooden frame, parchment center)
  sprites/ui/menu_panel.png         256x320 (purple scroll style)
  sprites/ui/button.png             96x32   (wooden plaque, beveled)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixart import (P, canvas, px, rect, hline, vline, line,
                    circle_fill, circle_outline, ellipse_fill,
                    outline_silhouette, lighten, darken, save)

OUT = '/sessions/friendly-compassionate-albattani/mnt/LevelX/sprites/ui'


# ----------------------------------------------------------------------
# STAT BAR SHELL — 200 x 14, rounded ends with white border
# ----------------------------------------------------------------------
def make_bar_shell(fill_colors):
    """fill_colors = (dark, mid, light) — for the inner "empty" track.
    Game will overlay the actual fill amount on top.
    """
    img = canvas(200, 14)
    fd, fm, fl = fill_colors

    # White outer border
    # Top/bottom rows
    hline(img, 2, 197, 0, P['white'])
    hline(img, 2, 197, 13, P['white'])
    # Left/right rounded caps
    vline(img, 0, 2, 11, P['white'])
    vline(img, 199, 2, 11, P['white'])
    # Corner pixels (round)
    for (cx, cy) in [(1, 1), (198, 1), (1, 12), (198, 12)]:
        px(img, cx, cy, P['white'])

    # Dark inner frame (1 px in)
    hline(img, 2, 197, 1, P['black'])
    hline(img, 2, 197, 12, P['black'])
    vline(img, 1, 2, 11, P['black'])
    vline(img, 198, 2, 11, P['black'])

    # Inner fill track (2 px in) — shows as the "empty" muted version
    rect(img, 2, 2, 197, 11, fd)
    # Top-inner highlight line
    hline(img, 3, 196, 2, fm)
    # Bottom inner darkness
    hline(img, 3, 196, 11, darken(fd, 25))

    # Smaller inner pattern — a very subtle stripe for style
    for x in range(3, 196, 4):
        px(img, x, 7, fm)

    # Round inner corners
    px(img, 2, 2, P['black'])
    px(img, 197, 2, P['black'])
    px(img, 2, 11, P['black'])
    px(img, 197, 11, P['black'])

    return img


def gen_bars():
    save(make_bar_shell((P['red_d'], P['crimson'], P['red_l'])),   f'{OUT}/hp_bar.png')
    save(make_bar_shell((P['blue_d'], P['blue_m'], P['blue_l'])),   f'{OUT}/mp_bar.png')
    save(make_bar_shell((P['orange_d'], P['gold_m'], P['yellow'])), f'{OUT}/exp_bar.png')


# ----------------------------------------------------------------------
# SKILL SLOT — 52 x 64
#  Top band: key letter header (dark)
#  Middle: icon area (light background)
#  Bottom band: MP cost footer
# Cooldown variant is the same slot with a semi-transparent grey overlay.
# ----------------------------------------------------------------------
def make_skill_slot(cooldown=False):
    img = canvas(52, 64)
    # Outer wood frame
    rect(img, 0, 0, 51, 63, P['brown_d'])
    # Inner fill
    rect(img, 2, 2, 49, 61, P['tan_m'])
    # Header strip (dark purple for key letter)
    rect(img, 2, 2, 49, 12, P['purple_d'])
    rect(img, 2, 2, 49, 2, P['purple_l'])  # highlight top
    rect(img, 2, 12, 49, 12, P['black'])
    # Main icon box (light inset)
    rect(img, 4, 14, 47, 49, P['paper'])
    # Inset shadow top
    hline(img, 4, 47, 14, P['parchment_dk'])
    vline(img, 4, 14, 49, P['parchment_dk'])
    # Inset highlight bottom
    hline(img, 4, 47, 49, P['eggshell'])
    vline(img, 47, 14, 49, P['eggshell'])
    # Footer strip (MP cost)
    rect(img, 2, 51, 49, 61, P['blue_d'])
    rect(img, 2, 51, 49, 51, P['blue_l'])
    rect(img, 2, 61, 49, 61, P['navy'])
    # Outer frame bevel
    hline(img, 0, 51, 0, P['brown_l'])
    vline(img, 0, 0, 63, P['brown_l'])
    hline(img, 0, 51, 63, P['brown_d'])
    vline(img, 51, 0, 63, darken(P['brown_d'], 20))
    # Frame border
    outline_silhouette(img)

    if cooldown:
        # Semi-transparent grey overlay on the icon area
        overlay = (40, 40, 50, 160)
        for y in range(14, 50):
            for x in range(4, 48):
                # Pixelate the overlay for retro feel (every-other)
                if (x + y) % 2 == 0:
                    img.putpixel((x, y), overlay)
        # "CD" glyph would live here — but keep it data-free
    return img


def gen_skill_slots():
    save(make_skill_slot(cooldown=False), f'{OUT}/skill_slot.png')
    save(make_skill_slot(cooldown=True),  f'{OUT}/skill_slot_cooldown.png')


# ----------------------------------------------------------------------
# DIALOG BOX — 384 x 112, wooden frame + gold corner filigree + parchment
# ----------------------------------------------------------------------
def _corner_filigree(img, x, y, flip_h=False, flip_v=False):
    """Draws a ~10x10 gold filigree curl at (x, y).
    Axes flipped for each corner."""
    pattern = [
        "...####...",
        "..#....#..",
        ".#...#..#.",
        "#...#.#..#",
        "#..#..#..#",
        "#.#...#..#",
        ".#....#.#.",
        "..#..#.#..",
        "...##.#...",
        "......#...",
    ]
    for py, row in enumerate(pattern):
        for px_ in range(len(row)):
            if row[px_] == '#':
                dx = (len(row) - 1 - px_) if flip_h else px_
                dy = (len(pattern) - 1 - py) if flip_v else py
                nx, ny = x + dx, y + dy
                if 0 <= nx < img.width and 0 <= ny < img.height:
                    px(img, nx, ny, P['gold_l'])
    # Add a highlight dot
    hx = x + (len(row) - 3 if flip_h else 2)
    hy = y + (len(pattern) - 3 if flip_v else 2)
    px(img, hx, hy, P['yellow'])


def gen_dialog_box():
    W, H = 384, 112
    img = canvas(W, H)

    # Outer wood frame
    rect(img, 0, 0, W - 1, H - 1, P['brown_m'])
    # Plank grain darker lines
    for x in range(0, W, 16):
        vline(img, x, 0, H - 1, P['brown_d'])
    # Inner bevel
    rect(img, 3, 3, W - 4, H - 4, P['brown_d'])
    rect(img, 5, 5, W - 6, H - 6, P['brown_l'])
    rect(img, 7, 7, W - 8, H - 8, P['parchment_dk'])
    # Parchment interior
    rect(img, 8, 8, W - 9, H - 9, P['paper'])
    # Parchment subtle stippling
    for y in range(10, H - 10, 3):
        for x in range(10, W - 10, 7):
            px(img, x, y, P['parchment_dk'])

    # Outer highlight
    hline(img, 0, W - 1, 0, P['brown_l'])
    vline(img, 0, 0, H - 1, P['brown_l'])
    hline(img, 0, W - 1, H - 1, P['brown_d'])
    vline(img, W - 1, 0, H - 1, P['brown_d'])

    # Gold filigree in each corner
    _corner_filigree(img, 6, 6)
    _corner_filigree(img, W - 16, 6, flip_h=True)
    _corner_filigree(img, 6, H - 16, flip_v=True)
    _corner_filigree(img, W - 16, H - 16, flip_h=True, flip_v=True)

    save(img, f'{OUT}/dialog_box.png')


# ----------------------------------------------------------------------
# MENU PANEL — 256 x 320, purple-framed scroll style
# ----------------------------------------------------------------------
def gen_menu_panel():
    W, H = 256, 320
    img = canvas(W, H)

    # Outer deep-purple frame
    rect(img, 0, 0, W - 1, H - 1, P['purple_d'])
    # Beveled highlight
    hline(img, 0, W - 1, 0, P['purple_l'])
    vline(img, 0, 0, H - 1, P['purple_l'])
    hline(img, 0, W - 1, H - 1, P['navy'])
    vline(img, W - 1, 0, H - 1, P['navy'])
    # Inner frame ring
    rect(img, 4, 4, W - 5, H - 5, P['purple_m'])
    rect(img, 6, 6, W - 7, H - 7, P['purple_d'])
    rect(img, 8, 8, W - 9, H - 9, darken(P['purple_d'], 20))

    # Scroll "paper" — slightly pinkish off-white
    rect(img, 12, 12, W - 13, H - 13, (238, 226, 210, 255))
    # Paper shadow edge (subtle)
    hline(img, 12, W - 13, 12, P['parchment_dk'])
    vline(img, 12, 12, H - 13, P['parchment_dk'])
    hline(img, 12, W - 13, H - 13, (210, 195, 160, 255))

    # Rolled ends at top/bottom (darker purple scrolls)
    rect(img, 2, 2, W - 3, 12, P['purple_m'])
    rect(img, 2, H - 13, W - 3, H - 3, P['purple_m'])
    # Scroll end highlights
    hline(img, 2, W - 3, 2, P['purple_l'])
    hline(img, 2, W - 3, 11, P['purple_d'])
    hline(img, 2, W - 3, H - 13, P['purple_d'])
    hline(img, 2, W - 3, H - 3, P['purple_d'])
    # Center seam lines
    hline(img, 2, W - 3, 7, P['navy'])
    hline(img, 2, W - 3, H - 8, P['navy'])

    # Decorative gold studs in corners
    for (sx, sy) in [(18, 18), (W - 19, 18), (18, H - 19), (W - 19, H - 19)]:
        circle_fill(img, sx, sy, 2, P['gold_m'])
        px(img, sx - 1, sy - 1, P['yellow'])

    save(img, f'{OUT}/menu_panel.png')


# ----------------------------------------------------------------------
# BUTTON — 96 x 32, wooden plaque with beveled edges
# ----------------------------------------------------------------------
def gen_button():
    W, H = 96, 32
    img = canvas(W, H)
    # Outer frame
    rect(img, 0, 0, W - 1, H - 1, P['brown_d'])
    # Plaque body
    rect(img, 2, 2, W - 3, H - 3, P['brown_m'])
    # Bevel highlight top + left
    hline(img, 2, W - 3, 2, P['brown_l'])
    vline(img, 2, 2, H - 3, P['brown_l'])
    # Bevel shadow bottom + right
    hline(img, 2, W - 3, H - 3, darken(P['brown_d'], 30))
    vline(img, W - 3, 2, H - 3, darken(P['brown_d'], 30))
    # Inset panel
    rect(img, 6, 6, W - 7, H - 7, P['tan_l'])
    hline(img, 6, W - 7, 6, P['parchment_dk'])
    vline(img, 6, 6, H - 7, P['parchment_dk'])
    hline(img, 6, W - 7, H - 7, P['eggshell'])
    vline(img, W - 7, 6, H - 7, P['eggshell'])
    # Gold studs on left & right
    for sx in (8, W - 9):
        circle_fill(img, sx, H // 2, 2, P['gold_m'])
        px(img, sx - 1, H // 2 - 1, P['yellow'])
    save(img, f'{OUT}/button.png')


if __name__ == '__main__':
    gen_bars()
    gen_skill_slots()
    gen_dialog_box()
    gen_menu_panel()
    gen_button()
    print('ui done ->', OUT)
