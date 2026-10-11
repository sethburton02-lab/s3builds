"""Generate the S3 mark at every size the site uses.

The letters were previously stroked arcs -- two circles for an S, two for a
3 -- which read as broken strokes rather than letterforms. They are now
Friz Quadrata Pro Bold, the face the site already ships.

The SVG carries OUTLINES, not a <text> element, so it still renders with no
font installed. That was the original reason for the arc construction and
it matters for a favicon, where the renderer may have no fonts at all.

Small sizes get a thinner frame and larger letters: at 16px the 5-unit
frame of the full mark eats a third of the width and the letters collapse.

    python3 tools/make-logo.py
"""
import os
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FONT = os.path.join(REPO, "art", "fonts", "frizquadratapro-bold.ttf")
GOLD_HI, GOLD_LO = (0xe6, 0xcf, 0x9a), (0x8a, 0x6d, 0x24)
WELL = (0x1d, 0x18, 0x11)

# ---- the vector mark -------------------------------------------------
def build_svg():
    font = TTFont(FONT)
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    def glyph(ch):
        pen = SVGPathPen(gs)
        gs[cmap[ord(ch)]].draw(pen)
        return pen.getCommands(), gs[cmap[ord(ch)]].width
    dS, wS = glyph("S")
    d3, w3 = glyph("3")
    gap, cap = 20, font["OS/2"].sCapHeight
    total = wS + gap + w3
    target = 30.0
    scale = target / total
    x0, y0 = 32 - target / 2, 32 + cap * scale / 2
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"
     role="img" aria-label="S3 Builds">
  <title>S3 Builds</title>
  <!-- An item slot: gold frame, dark well, S3 inside.
       Letters are Friz Quadrata Pro Bold as OUTLINES, so no font need be
       installed or licensed at render time. Regenerate with
       tools/make-logo.py; this file cannot be edited by retyping. -->
  <defs>
    <linearGradient id="s3frame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6cf9a"/>
      <stop offset="1" stop-color="#8a6d24"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="6" fill="url(#s3frame)"/>
  <rect x="7" y="7" width="50" height="50" rx="3" fill="#1d1811"/>
  <g fill="#e6cf9a" transform="translate({x0:.3f} {y0:.3f}) scale({scale:.6f} -{scale:.6f})">
    <path d="{dS}"/>
    <path transform="translate({wS + gap} 0)" d="{d3}"/>
  </g>
</svg>
'''

# ---- raster ----------------------------------------------------------
def render(n, supersample=8):
    """Small marks get a thinner frame and bigger letters, or they mush."""
    small = n <= 32
    pad, inset, rad_o, rad_i = (2, 7, 6, 3) if not small else (1, 4, 5, 2)
    letters = 30.0 if not small else 38.0
    N = n * supersample
    u = N / 64.0
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    grad = Image.new("RGBA", (N, N))
    gd = ImageDraw.Draw(grad)
    for y in range(N):
        t = y / (N - 1)
        gd.line([(0, y), (N, y)],
                fill=tuple(int(a + (b - a) * t) for a, b in zip(GOLD_HI, GOLD_LO)) + (255,))
    mask = Image.new("L", (N, N), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [pad * u, pad * u, (64 - pad) * u, (64 - pad) * u], radius=rad_o * u, fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([inset * u, inset * u, (64 - inset) * u, (64 - inset) * u],
                        radius=rad_i * u, fill=WELL + (255,))
    f = ImageFont.truetype(FONT, int(letters * u))
    bb = d.textbbox((0, 0), "S3", font=f)
    d.text((N / 2 - (bb[2] - bb[0]) / 2 - bb[0], N / 2 - (bb[3] - bb[1]) / 2 - bb[1]),
           "S3", font=f, fill=GOLD_HI + (255,))
    return img.resize((n, n), Image.LANCZOS)

svg = build_svg()
for name in ("logo.svg", "favicon.svg"):
    open(os.path.join(REPO, name), "w").write(svg)
    print("wrote", name)

for name, n in (("logo-512.png", 512), ("apple-touch-icon.png", 180),
                ("favicon.png", 32), ("favicon-16.png", 16)):
    render(n).save(os.path.join(REPO, name))
    print("wrote %-22s %dx%d" % (name, n, n))

render(48).save(os.path.join(REPO, "favicon.ico"),
                sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote favicon.ico        16/32/48")
