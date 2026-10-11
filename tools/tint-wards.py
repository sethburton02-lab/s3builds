#!/usr/bin/env python3
"""Colour the game's ward icons locally.

    python3 tools/tint-wards.py

WHAT THESE FILES ACTUALLY ARE. Not greyscale masks, which was the first
guess and wrong. They are fully coloured, and both are BLUE: Riot names the
ward TYPE in the filename -- "green" is the trinket, "pink" is the control
ward, from the days when those were the item colours -- while the colour in
the pixels is the TEAM. Blue is the ally version; there are _enemy variants
in red. So the pair that reads as green-and-pink in the filename arrives as
two blue icons, which is exactly how they looked on the map.

The shapes differ, and that is the part worth keeping: the trinket is a
totem, the control ward is an eye. This recolours each to the colour a
player expects while leaving those silhouettes alone.

It looks for the source files in the usual download spots. Put them anywhere
on that list and run it; nothing needs to be passed in.

HOW IT TINTS: brightness comes from the source's VALUE (its brightest
channel), not its luminance. Luminance weights blue at 11%, so a blue icon
run through it comes out muddy and loses its internal shading -- which is
most of what makes the totem read as a totem. Alpha is kept exactly, so the
soft edge survives; a flat fill through the alpha channel would give a solid
blob with none of the original shape showing."""
import os, sys
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOOK = [os.path.join(HERE, "art", "src"), HERE,
        os.path.expanduser("~/Downloads"),
        "/sessions/bold-intelligent-curie/mnt/Downloads",
        "/sessions/bold-intelligent-curie/mnt/Jade",
        "/sessions/bold-intelligent-curie/mnt/uploads"]

WANT = [
  # (what to find,                      what to write,        tint)
  # "green" is the trinket (a totem), "pink" is the control ward (an eye)
  ("minimap_ward_green_full.png",       "ward-green.png",     (0x5f, 0xd8, 0x80)),
  ("minimap_ward_pink_friendly.png",    "ward-pink.png",      (0xf0, 0x6f, 0xbc)),
]

def find(name):
    for d in LOOK:
        p = os.path.join(d, name)
        if os.path.isfile(p):
            return p
    return None

UPSCALE = 2      # 32px sources, drawn at ~24px on a normal screen and twice
                 # that on a hidpi one, so a 64px file is the honest size

def tint(src, rgb):
    im = Image.open(src).convert("RGBA")
    r, g, b, a = im.split()
    val = ImageChops.lighter(ImageChops.lighter(r, g), b)   # max channel
    lo, hi = val.getextrema()
    if hi > lo:
        val = val.point(lambda v: int(45 + 210 * (v - lo) / (hi - lo)))
    out = Image.merge("RGBA", (
        val.point(lambda v: v * rgb[0] // 255),
        val.point(lambda v: v * rgb[1] // 255),
        val.point(lambda v: v * rgb[2] // 255), a))
    if UPSCALE > 1:
        out = out.resize((out.width * UPSCALE, out.height * UPSCALE), Image.LANCZOS)
    return out

missing, made = [], []
for name, out, rgb in WANT:
    src = find(name)
    if not src:
        missing.append(name); continue
    dst = os.path.join(HERE, "art", out)
    img = tint(src, rgb)
    img.save(dst, optimize=True)
    made.append(f"  {out}  {img.size[0]}x{img.size[1]}  {os.path.getsize(dst)} bytes  <- {src}")

if made:
    print("written:"); print("\n".join(made))
if missing:
    print("\nNOT FOUND, so nothing was written for these:")
    for m in missing: print("  " + m)
    print("\nSave them from:")
    print("  https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/"
          "minimap_ward_green_full.png")
    print("  https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/"
          "minimap_ward_pink_friendly.png")
    print("and drop them in any of:")
    for d in LOOK[:4]: print("  " + d)
    sys.exit(1)
