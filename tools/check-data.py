#!/usr/bin/env python3
"""
S3 Builds data check
====================

Compares everything the site ships against League Classic's own game files
and reports what has drifted. Run it after each re-export of the client's
rcp-be-lol-game-data plugin:

    python3 tools/check-data.py  path/to/rcp-be-lol-game-data

Exit code is 0 when everything matches and 1 when anything has drifted, so
it can gate a commit if you ever want that.

WHY THIS EXISTS
---------------
The site's data comes from three places, and only one of them is safe:

  · fetched live from Community Dragon at page load — items, champion
    abilities, summoner spells, icons. These follow the mode automatically
    and cannot go stale.

  · bundled snapshots — data-mastery-tree.js and data-rune-icons.js. They
    are copies, taken by hand, and they go stale silently.

  · hand-transcribed — data-runes.js, typed out from the in-game rune shop.

The hand-written ones are where the errors were. A single pass of this
check found four: the scaling Armor seal at 0.15 instead of 0.17, a missing
Cooldown Reduction quintessence, "Artifacer" for "Artificer", and Wealth
giving 35 starting gold instead of 40. None of them were visible by eye.

WHAT IT CANNOT CHECK
--------------------
Champion base stats. They are not in the LCU export at all — the mode's
champion files carry abilities, skins and roles but no health, armour or
per-level growth, and champion-summary.json is only names and roles. The
site therefore reads Data Dragon 3.13.24 for them, which is the right era
but will not reflect any Classic-specific tuning. See probe_base_stats()
at the bottom for where to look if you want to chase it.

Summoner spell range is the same story on a smaller scale: the mode's
summoner-spells.json has cooldown, description, icon and level, but no
range, so range stays with Data Dragon.
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)

# ---------------------------------------------------------------- helpers

class Report:
    """Collects findings so the whole run is shown at once."""

    def __init__(self):
        self.sections = []
        self.problems = 0

    def section(self, title):
        self.sections.append((title, []))
        return self

    def ok(self, msg):
        self.sections[-1][1].append(("ok", msg))

    def bad(self, msg):
        self.sections[-1][1].append(("!!", msg))
        self.problems += 1

    def note(self, msg):
        self.sections[-1][1].append(("--", msg))

    def show(self):
        for title, lines in self.sections:
            print(f"\n{title}")
            print("-" * len(title))
            for mark, msg in lines:
                print(f"  {mark}  {msg}")
        print()
        if self.problems:
            print(f"{self.problems} problem(s) found.")
        else:
            print("Everything matches the game files.")
        return 1 if self.problems else 0


def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def js_object(path, marker):
    """Parse an object/array literal out of one of the site's data files.

    These are plain <script> files rather than JSON — unquoted keys, inline
    comments, trailing commas — so they need tidying before json.loads.
    """
    src = open(path, encoding="utf-8").read()
    body = src[src.index(marker):]
    body = body[body.index("[") if "[" in marker or marker.endswith("[") else body.index("{"):]

    # walk to the matching close so trailing code is not swallowed
    open_ch = body[0]
    close_ch = "]" if open_ch == "[" else "}"
    depth, end, in_str, esc = 0, None, False, False
    for i, ch in enumerate(body):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    body = body[:end]

    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    body = re.sub(r"(?m)//.*$", "", body)
    body = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', body)
    body = body.replace("'", '"')
    body = re.sub(r",(\s*[}\]])", r"\1", body)
    return json.loads(body)


def stat_key(s):
    """The game and the site spell a few stats differently."""
    s = re.sub(r"\s+", " ", str(s)).strip().lower()
    return s.replace("regeneration", "regen").replace("experience gained", "experience")


# ------------------------------------------------------------------ runes

SLOT_OF = {"kMark": "mark", "kSeal": "seal", "kGlyph": "glyph", "kQuintessence": "quint"}
SLOT_NAME = {"mark": "Mark", "seal": "Seal", "glyph": "Glyph", "quint": "Quintessence"}


def check_runes(v1, rep):
    rep.section("Runes  (data-runes.js vs jade-perks.json)")

    game_all = read_json(os.path.join(v1, "jade-perks.json"))
    # Rows titled "Empty Rune" have no icon and no contentId: unfinished
    # records rather than shop entries. Deliberately not transcribed.
    game = [r for r in game_all if r["title"] != "Empty Rune"]
    skipped = len(game_all) - len(game)

    mine = js_object(os.path.join(SITE, "data-runes.js"), "const CLASSIC_RUNES = [")

    def key_of(slot, stat, per_level, minor):
        return (slot, stat_key(stat), bool(per_level), bool(minor))

    index = {key_of(SLOT_OF[r["type"]], r["statName"], r["isPerLevel"], r["isLowQuality"]): r
             for r in game}

    def display_name(r):
        stat = r.get("nameStat") or r["stat"]
        scaling = "Scaling " if r.get("scaling") else ""
        if r["slot"] == "quint":
            return f"Quintessence of {scaling}{stat}"
        minor = "Minor " if r["tier"] == "minor" else ""
        return f"{minor}{SLOT_NAME[r['slot']]} of {scaling}{stat}"

    matched = 0
    for r in mine:
        k = key_of(r["slot"], r.get("nameStat") or r["stat"], r.get("scaling"),
                   r["tier"] == "minor")
        g = index.get(k)
        if not g:
            rep.bad(f"{display_name(r)} is on the site but not in the game file")
            continue
        want = float(g["amount"])
        got = float(r.get("perLevel") or 0) if r.get("scaling") else float(r.get("value") or 0)
        if abs(want - got) > 1e-6:
            rep.bad(f"{g['title']}: site {got}, game {want}   ({g['tooltip']})")
        elif display_name(r) != g["title"]:
            rep.bad(f"name differs: site {display_name(r)!r}, game {g['title']!r}")
        else:
            matched += 1

    have = {key_of(r["slot"], r.get("nameStat") or r["stat"], r.get("scaling"),
                   r["tier"] == "minor") for r in mine}
    for r in game:
        if key_of(SLOT_OF[r["type"]], r["statName"], r["isPerLevel"],
                  r["isLowQuality"]) not in have:
            rep.bad(f"missing from the site: {r['title']} — {r['tooltip']}")

    if matched == len(mine) and len(mine) == len(game):
        rep.ok(f"all {matched} runes match name and value")
    rep.note(f"{skipped} unfinished 'Empty Rune' rows ignored")
    check_rune_icons(rep, mine)


def check_rune_icons(rep, runes):
    """Every rune needs an icon slug, and every slug needs a file."""
    mapping = js_object(os.path.join(SITE, "data-rune-icons.js"), "JADE_RUNE_ICONS")

    def slug(r):
        parts = ["minor" if r.get("tier") == "minor" else "", r["slot"],
                 "scaling" if r.get("scaling") else "", r["stat"]]
        s = "-".join(p for p in parts if p).lower()
        return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s))

    no_icon = [slug(r) for r in runes if slug(r) not in mapping]
    for s in no_icon:
        rep.bad(f"no icon mapped for rune {s}")
    absent = [v for v in mapping.values()
              if not os.path.exists(os.path.join(SITE, "assets", "runes", v))]
    for v in sorted(set(absent)):
        rep.bad(f"icon file missing from assets/runes: {v}")
    if not no_icon and not absent:
        rep.ok(f"all {len(runes)} runes have an icon and every file is present")


# -------------------------------------------------------------- masteries

def check_masteries(v1, rep):
    rep.section("Masteries  (data-mastery-tree.js vs jade-mastery-display.json)")

    game = read_json(os.path.join(v1, "jade-mastery-display.json"))
    src = open(os.path.join(SITE, "data-mastery-tree.js"), encoding="utf-8").read()
    bundled = json.loads(re.search(r"=\s*(\{.*\})\s*;?\s*$", src, re.S).group(1))

    def flatten(doc):
        out = {}
        for tree in doc["trees"]:
            for row_i, row in enumerate(tree["rows"]):
                for m in row["masteries"]:
                    if m:
                        out[str(m["id"])] = {
                            "tree": tree["name"], "row": row_i, "name": m["name"],
                            "maxRank": m["maxRank"],
                            "description": (m.get("description") or "").strip(),
                        }
        return out

    a, b = flatten(bundled), flatten(game)
    for mid in sorted(set(a) - set(b)):
        rep.bad(f"{a[mid]['name']} ({mid}) is bundled but no longer in the game file")
    for mid in sorted(set(b) - set(a)):
        rep.bad(f"{b[mid]['name']} ({mid}) is in the game file but not bundled")

    diffs = 0
    for mid in sorted(set(a) & set(b)):
        for field in ("tree", "row", "name", "maxRank", "description"):
            if a[mid][field] != b[mid][field]:
                diffs += 1
                rep.bad(f"{b[mid]['name']} ({mid}) {field}: "
                        f"site {a[mid][field]!r}, game {b[mid][field]!r}")

    costs_a = [(t["name"], [r["pointsRequired"] for r in t["rows"]]) for t in bundled["trees"]]
    costs_b = [(t["name"], [r["pointsRequired"] for r in t["rows"]]) for t in game["trees"]]
    if costs_a != costs_b:
        rep.bad(f"row unlock costs differ: site {costs_a}, game {costs_b}")

    if not diffs and set(a) == set(b) and costs_a == costs_b:
        rep.ok(f"all {len(b)} masteries match, including rank counts and row costs")


# ---------------------------------------------------------- spells / items

def check_spells(v1, rep):
    rep.section("Summoner spells  (site.js vs summoner-spells.json)")

    rows = read_json(os.path.join(v1, "summoner-spells.json"))
    jade = [r for r in rows if "JADE" in (r.get("gameModes") or [])]

    names = [r["name"] for r in jade]
    dupes = sorted({n for n in names if names.count(n) > 1})
    if dupes:
        rep.bad(f"the mode lists the same spell twice: {dupes}")
    else:
        rep.ok(f"{len(jade)} spells flagged JADE, no duplicate names")

    # The site joins archive spells to this table BY NAME. That only works
    # while the names agree; the ids do not follow any rule (Clairvoyance is
    # 75, Fortify 705, Rally 709, Revive 777).
    archive = {"Barrier", "Surge", "Cleanse", "Clairvoyance", "Ignite", "Exhaust",
               "Flash", "Fortify", "Ghost", "Heal", "Clarity", "Garrison",
               "Promote", "Rally", "Revive", "Smite", "Teleport"}
    unmatched = sorted(set(names) - archive)
    if unmatched:
        rep.bad("these mode spells have no Data Dragon name to join to, so they "
                f"would be dropped from the picker: {unmatched}")
    else:
        rep.ok("every mode spell has a matching Data Dragon name")

    if not any("range" in k.lower() for k in jade[0]):
        rep.note("the mode's file has no range field — range stays on Data Dragon")


def site_item_exclusions():
    """The name patterns site.js drops, read from site.js rather than copied.

    Keeping a second copy here would be exactly the kind of hand-maintained
    duplicate this script exists to catch.
    """
    src = open(os.path.join(SITE, "site.js"), encoding="utf-8").read()
    block = re.search(r"EXCLUDED_ITEM_PATTERNS\s*=\s*\[(.*?)\]", src, re.S).group(1)
    block = re.sub(r"/\*.*?\*/", "", block, flags=re.S)
    return [re.compile(p, re.I) for p in re.findall(r"/(.+?)/i", block)]


def check_items(v1, rep):
    rep.section("Items  (fetched live, so this is a sanity check only)")

    rows = read_json(os.path.join(v1, "items.json"))
    classic = [r for r in rows if 770000 <= r.get("id", 0) < 780000]
    rep.ok(f"{len(classic)} items in Classic's id range")

    # The site shows items that are inStore, cost something, and aren't on
    # the exclusion list. The free ones are internal: bot rune replacers and
    # Arena augment abilities.
    free = [r for r in classic if r.get("inStore") and not r.get("priceTotal")]
    if free:
        rep.note(f"{len(free)} free inStore items excluded by the price test "
                 f"(e.g. {', '.join(sorted(r['name'] for r in free)[:3])})")

    excluded = site_item_exclusions()
    dropped = [r for r in classic
               if r.get("inStore") and r.get("priceTotal")
               and any(p.search(r["name"] or "") for p in excluded)]
    if dropped:
        rep.note(f"{len(dropped)} dropped by site.js's exclusion list "
                 f"({', '.join(sorted(r['name'] for r in dropped)[:4])})")

    shown = [r for r in classic
             if r.get("inStore") and r.get("priceTotal")
             and not any(p.search(r["name"] or "") for p in excluded)]
    rep.ok(f"{len(shown)} buyable items would appear in the pool")

    no_desc = [r["name"] for r in shown if not (r.get("description") or "").strip()]
    if no_desc:
        rep.bad(f"buyable items with no description: {no_desc[:5]}")


# ------------------------------------------------------------- base stats

def probe_base_stats(v1, rep):
    rep.section("Champion base stats  (the known gap)")

    champ_dir = os.path.join(v1, "champions")
    sample = None
    for name in sorted(os.listdir(champ_dir)):
        if name.endswith(".json") and not name.startswith("-"):
            sample = read_json(os.path.join(champ_dir, name))
            break

    stat_fields = [k for k in (sample or {})
                   if any(w in k.lower() for w in ("stat", "health", "armor", "damage"))]
    if stat_fields:
        rep.ok(f"the export's champion files DO carry stats now: {stat_fields} — "
               "champion.html could be switched off Data Dragon")
    else:
        rep.note("the export's champion files still carry no base stats "
                 "(abilities, skins and roles only)")
        rep.note("champion.html therefore uses Data Dragon 3.13.24 — right era, "
                 "but blind to any Classic-specific tuning")
        rep.note("to chase it: League Classic is map 453, and its map bin references "
                 "'CharacterRecords/JADE' variants, so Riot does ship mode-specific "
                 "character records. Look for a JADE record in "
                 "raw.communitydragon.org/latest/game/data/characters/<champ>/<champ>.bin.json "
                 "— note the keys there are hashed, so you need CommunityDragon's "
                 "hash tables to read them.")


# ------------------------------------------------------------------- main

def main():
    if len(sys.argv) < 2:
        default = os.path.join(os.path.expanduser("~"), "Downloads", "rcp-be-lol-game-data")
        export = default
        print(f"No path given; trying {export}")
    else:
        export = sys.argv[1]

    v1 = os.path.join(export, "plugins", "rcp-be-lol-game-data", "global", "default", "v1")
    if not os.path.isdir(v1):
        v1 = export if os.path.isdir(os.path.join(export, "jade-perks.json")) else None
    if not v1:
        print(f"Could not find the game files under {export}")
        print("Expected .../plugins/rcp-be-lol-game-data/global/default/v1")
        return 2

    print(f"Checking the site against {v1}")
    rep = Report()
    check_runes(v1, rep)
    check_masteries(v1, rep)
    check_spells(v1, rep)
    check_items(v1, rep)
    probe_base_stats(v1, rep)
    return rep.show()


if __name__ == "__main__":
    sys.exit(main())
