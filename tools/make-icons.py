#!/usr/bin/env python3
"""Raster icons from logo.svg

    python3 tools/make-icons.py <site-dir>

cairosvg isn't available here, so the mark is re-drawn with PIL against the
same numbers logo.svg uses. That means two definitions of one shape, which
is a thing to be honest about: logo.svg is the source of truth, this is a
port, and they have to be changed together. The constants below are lifted
straight from the SVG so a diff between the two is easy to eyeball.

PIL angles run clockwise from 3 o'clock, which matches SVG's screen-space
convention, so each arc is (centre, radius, start, end) clockwise.
"""
import sys, pathlib
from PIL import Image, ImageDraw

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

FRAME_TOP, FRAME_BOT = (0xe6, 0xcf, 0x9a), (0x8a, 0x6d, 0x24)
WELL = (0x1d, 0x18, 0x11, 255)
INK = (0xe6, 0xcf, 0x9a, 255)
STROKE = 3.5
R = 7
# (centre x, centre y, start angle, end angle) — clockwise, degrees.
ARCS = [
    (23, 25,  90, 315),   # S, top bowl
    (23, 39, 270, 135),   # S, bottom bowl
    (41, 25, 225,  90),   # 3, top bowl
    (41, 39, 270, 135),   # 3, bottom bowl
]

def render(px):
    SS = 8                                  # supersample, then downscale
    n, k = px * SS, px * SS / 64.0
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))

    grad = Image.new("RGBA", (n, n))
    gd = ImageDraw.Draw(grad)
    for y in range(n):
        t = y / max(1, n - 1)
        gd.line([(0, y), (n, y)],
                fill=tuple(round(a + (b - a) * t)
                           for a, b in zip(FRAME_TOP, FRAME_BOT)) + (255,))
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([2*k, 2*k, 62*k, 62*k], radius=6*k, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    d.rounded_rectangle([7*k, 7*k, 57*k, 57*k], radius=3*k, fill=WELL)
    for cx, cy, a0, a1 in ARCS:
        d.arc([(cx-R)*k, (cy-R)*k, (cx+R)*k, (cy+R)*k], a0, a1,
              fill=INK, width=max(1, round(STROKE * k)))
    return img.resize((px, px), Image.LANCZOS)

out = {s: render(s) for s in (16, 32, 48, 64, 180, 512)}
out[512].save(root / "logo-512.png")
out[180].save(root / "apple-touch-icon.png")
out[32].save(root / "favicon.png")
out[64].save(root / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

# A contact sheet, so the small sizes can actually be looked at.
sheet = Image.new("RGBA", (620, 140), (40, 36, 28, 255))
x = 20
for s in (16, 32, 48, 64):
    sheet.alpha_composite(out[s], (x, 20 + (64 - s) // 2))
    x += s + 26
sheet.alpha_composite(out[64].resize((110, 110), Image.LANCZOS), (300, 15))
pale = Image.new("RGBA", (170, 140), (213, 193, 147, 255))
pale.alpha_composite(out[64].resize((110, 110), Image.LANCZOS), (30, 15))
sheet.alpha_composite(pale, (440, 0))
sheet.save(root / "tools" / "icon-preview.png")
print("wrote logo-512, apple-touch-icon, favicon.png, favicon.ico")
