#!/usr/bin/env python3
"""Contrast check for site.css

    python3 tools/contrast-check.py <site-dir>

The site has two surfaces and one set of class names. `.dd` is shop and
ability rich text; it renders on a parchment card AND inside a near-black
tooltip, and the tooltip block restates the palette in light equivalents.
Every time that pairing has drifted, text has gone unreadable somewhere and
nothing has caught it:

  · tooltip stat text stayed parchment-brown on black
  · .tag kept dark-theme pale blues on a cream card
  · the whole .dd damage-type palette stayed the client's bright inks on
    parchment, at ratios of 1.0-1.5:1 -- not hard to read, absent

The pattern is always the same: a colour is correct on the surface it was
written for and nobody checks the other one. So this reads the declarations
out of site.css and measures both.

Exits 1 if anything is under WCAG AA for body text.
"""

import re
import sys
import pathlib

MIN = 4.5

# The two composited backgrounds, measured rather than guessed:
# a .card is hsla(43,47%,60%,.28) over --bg #d9c9a3; the tooltip panel
# composites to rgb(43,40,33) over the same sheet.
SURFACES = {
    "parchment card": (213, 193, 147),
    "bare sheet":     (217, 201, 163),
    "tooltip panel":  (43, 40, 33),
}

TOKENS = {"--text": "#1e2328", "--muted": "#7d5444", "--muted-2": "#8a6552",
          "--gold-hi": "#a46c34", "--teal": "#0ac8b9", "--blue": "#2c66aa",
          "--title": "#600000", "--red": "#c73e00", "--purple": "#c084fc"}


def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = (_lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def parse(colour):
    """A hex literal or a var() we know the value of, else None."""
    colour = colour.strip()
    m = re.fullmatch(r"var\((--[\w-]+)\)", colour)
    if m:
        colour = TOKENS.get(m.group(1), "")
    m = re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", colour)
    if not m:
        return None
    h = m.group(1)
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ratio(fg, bg):
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def rules(css):
    """(selector, colour) for every rule that sets a colour."""
    out = []
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        m = re.search(r"(?<![-\w])color\s*:\s*([^;}]+)", body)
        if not m:
            continue
        rgb = parse(m.group(1))
        if rgb:
            out.append((" ".join(sel.split()), rgb))
    return out


def main():
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    css = (root / "site.css").read_text(encoding="utf8")

    dark_shell = re.compile(r"\.(mast|spell|item)-tip")
    failures = []
    checked = 0

    for sel, rgb in rules(css):
        # A rule scoped to a tooltip shell is judged on the panel; a rule
        # mentioning .dd but not a shell is judged on the page. Anything
        # else isn't part of this pairing and isn't this script's business.
        if dark_shell.search(sel):
            where = ["tooltip panel"]
        elif re.search(r"(^|[\s,])\.dd(\b|[\s.,:>])", sel) or sel.startswith(".tag"):
            where = ["parchment card", "bare sheet"]
        else:
            continue

        for name in where:
            checked += 1
            r = ratio(rgb, SURFACES[name])
            if r < MIN:
                failures.append((sel, "#%02x%02x%02x" % rgb, name, r))

    # Measuring each rule where its selector puts it misses the other half
    # of the problem: a .dd class with no tooltip counterpart still RENDERS
    # in the tooltip, inheriting the parchment ink onto black. The measuring
    # pass can't see that, because the rule it would have to judge doesn't
    # exist. So check the pairing itself.
    page_classes, tip_classes = set(), set()
    for sel, _ in rules(css):
        for cls in re.findall(r"\.dd\s+\.([\w-]+)", sel):
            (tip_classes if dark_shell.search(sel) else page_classes).add(cls)
    orphans = sorted(page_classes - tip_classes)

    print(f"Checked {checked} colour/surface pairs in site.css")
    print(f"and {len(page_classes)} .dd classes for a tooltip counterpart\n")

    if orphans:
        print("Coloured on the page but not restated for the dark panel --\n")
        for cls in orphans:
            print(f"  .dd .{cls}")
        print("\nEach of these renders inside a tooltip too, where the page's")
        print("ink is the wrong one. Add a .mast-tip/.spell-tip/.item-tip rule.")
        print(f"\n{len(orphans)} unpaired class(es)")

    if not failures and not orphans:
        print(f"Everything clears {MIN}:1, and every .dd class is paired.")
        return 0
    if not failures:
        return 1
    if orphans:
        print()

    print(f"Below {MIN}:1 --\n")
    for sel, hexv, surface, r in failures:
        print(f"  {r:5.2f}  {hexv}  on the {surface}")
        print(f"         {sel}")
    print(f"\n{len(failures)} failing pair(s)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
