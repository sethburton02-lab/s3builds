#!/usr/bin/env python3
"""Point the site at a domain.

    python3 tools/set-domain.py s3builds.pages.dev
    python3 tools/set-domain.py s3builds.gg

The absolute URL appears in robots.txt, sitemap.xml and the og:image tag on
every page. Open Graph needs absolute URLs — a relative one is ignored — so
these cannot simply be made relative and forgotten. Eleven places is exactly
the number you update ten of.

Prints what changed, so a deploy to the wrong host is visible before it
ships rather than after someone reports a broken preview.
"""
import re, sys, pathlib

if len(sys.argv) < 2:
    sys.exit(__doc__)
host = sys.argv[1].strip().rstrip("/").replace("https://", "").replace("http://", "")
if not re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", host):
    sys.exit(f"That doesn't look like a hostname: {host!r}")

root = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else ".")
OLD = re.compile(r"https://[a-z0-9.-]+\.[a-z]{2,}(?=/|\"|\s|$)")
NEW = f"https://{host}"

changed = 0
for p in sorted([*root.glob("*.html"), root / "robots.txt", root / "sitemap.xml"]):
    if not p.exists():
        continue
    s = p.read_text(encoding="utf8")
    # Only our own absolute URLs — never Riot's CDNs or the fan-policy link.
    out = OLD.sub(lambda m: NEW if not any(
        d in m.group(0) for d in ("riotgames.com", "leagueoflegends.com",
                                  "communitydragon.org", "example.com")) else m.group(0), s)
    if out != s:
        p.write_text(out, encoding="utf8")
        n = sum(1 for _ in OLD.finditer(s))
        print(f"  {p.name}")
        changed += 1
print(f"\n{changed} file(s) now point at {NEW}" if changed else "\nNothing to change.")
