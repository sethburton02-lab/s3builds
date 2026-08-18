#!/usr/bin/env python3
"""Stamp every local .js and .css reference with the same ?v= number.

WHY THIS EXISTS
---------------
The Sign in button was missing from the live site for a whole session. The
code was correct, the deploy was correct, and fetching site.js over HTTP
returned the new file — but the browser was still running an older copy.
A cached asset was shadowing the deploy.

site.css never had this problem, because it was always written as
`site.css?v=93`. Every deploy changed the URL, so no cache could hold a
stale copy. The .js files carried no version at all, so their URLs never
changed and a cache had no way to know the bytes had.

`Cache-Control: max-age=600` in _headers is not a fix. It shortens the
window; it does not close it, and it says nothing about what the CDN edge
holds. The only reliable cache-buster is a URL that changes when the
content does.

USAGE
-----
    python tools/bump-version.py            # bump by one
    python tools/bump-version.py --set 120  # set explicitly
    python tools/bump-version.py --check    # non-zero exit if any ref is unversioned

Run it before every commit that touches a .js or .css file. Missing it is
not catastrophic — it just means the old bug is available again.
"""

import os, re, sys, glob

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Local assets only. A versioned query on a CDN URL would be a cache miss
# for everyone else on the internet as well as for us.
REF = re.compile(r'(?P<attr>src|href)="(?P<file>[A-Za-z0-9_.-]+\.(?:js|css))(?:\?v=(?P<ver>\d+))?"')


def current_version(files):
    seen = {int(m.group("ver")) for f in files
            for m in REF.finditer(open(f, encoding="utf-8").read())
            if m.group("ver")}
    return max(seen) if seen else 0


def main():
    args = sys.argv[1:]
    pages = sorted(glob.glob(os.path.join(SITE, "*.html")))
    if not pages:
        print("no html files found"); return 1

    now = current_version(pages)

    if "--check" in args:
        bad = []
        for f in pages:
            for m in REF.finditer(open(f, encoding="utf-8").read()):
                if not m.group("ver"):
                    bad.append(f"{os.path.basename(f)}: {m.group('file')}")
        if bad:
            print("Unversioned asset references (a cache can shadow these):")
            for b in bad: print("  " + b)
            return 1
        print(f"All asset references carry ?v={now}.")
        return 0

    if "--set" in args:
        new = int(args[args.index("--set") + 1])
    else:
        new = now + 1

    touched = 0
    for f in pages:
        text = open(f, encoding="utf-8").read()
        out = REF.sub(lambda m: f'{m.group("attr")}="{m.group("file")}?v={new}"', text)
        if out != text:
            open(f, "w", encoding="utf-8", newline="").write(out)
            touched += 1

    print(f"v={now} -> v={new} across {touched} page(s).")
    print("Commit and push; the new URLs cannot be served from a stale cache.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
