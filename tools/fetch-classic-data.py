#!/usr/bin/env python3
"""Snapshot the mode's own champion numbers.

    python3 tools/fetch-classic-data.py            # write data/classic-champions.json
    python3 tools/fetch-classic-data.py --check    # has anything changed since the snapshot?
    python3 tools/fetch-classic-data.py --self-test  # offline, proves the trimming works

WHY THIS EXISTS

champion.html gets its base stats from Data Dragon 3.13.24 — the 2013
archive. Those are not the mode's numbers. Ashe is 395 health and 11.5
armour in the archive and 474 / 18.9 in the mode, and nothing on the page
says so. The only place the mode's stats exist is the character bins, one
file per champion, and there is no bulk endpoint: not in the client data
plugin (checked every field), not on the map (map453 carries skins and fog
of war, nothing else), nowhere.

So this walks the roster and pulls them.

WHAT IT IS FOR, AND WHAT IT IS NOT FOR

The output is a FALLBACK, not the source. The site should read the bins
live, the same way it reads the roster live, because a committed copy of
someone else's data is exactly the thing that quietly went nine champions
out of date and cost an afternoon to notice. This file is what the page
falls back to when Community Dragon is unreachable, and the raw material
for a patch-to-patch diff later.

Which also means: re-run it per patch, and let --check tell you when it
matters. It is not supposed to be edited by hand.
"""

import argparse
import datetime
import json
import os
import sys
import urllib.request

CD = "https://raw.communitydragon.org/latest"
PLUGIN = CD + "/plugins/rcp-be-lol-game-data/global/default"
VERSIONS = "https://ddragon.leagueoflegends.com/api/versions.json"
CHAMP_OFFSET = 60000
OUT = os.path.join("data", "classic-champions.json")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


# ---------------------------------------------------------------- shapes
#
# Everything below was read off the real files rather than assumed. The
# bins are a converted binary format and they show it: numbers are wrapped,
# some field names survive only as hashes, and a champion with no mana has
# a mana block full of zeroes rather than no block.

def unwrap(v):
    """A number, or a {"baseValue": n, "__type": "ModifiableFloat"} holding one.

    Every stat in the record is wrapped, baseMR and mrPerLevel included —
    an earlier draft of this comment claimed those two were bare, which was
    simply wrong and checked against eight champions before being fixed.
    Both forms are accepted because the wrapper is a detail of the export
    and not worth trusting either way.

    Strict about the return: handing a dict back where a float belongs
    serialises into the snapshot without complaint and shows up much later
    as [object Object] on a stat line."""
    if isinstance(v, dict):
        v = v.get("baseValue")
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return round(float(v), 4)


# The resource block's field names did not survive the export. These are
# their hashes, confirmed against Data Dragon's Season 3 values:
# Ashe 208 = 173 base + 35 per level, and 1.34/sec = (6.3 + 0.4) per 5s.
RESOURCE_KEYS = {
    "base":         "{726ee5cd}",
    "perLevel":     "{6216bf7b}",
    "regen":        "{c4ab3550}",   # per SECOND
    "regenPerLevel": "{3a509002}",  # per SECOND
}
# arType 0 is mana and 1 is energy. A manaless champion has no arType at
# all — Garen's block is present with zeroes and the key simply missing —
# so absent means "none" rather than "mana", which is the trap.
RESOURCE_TYPES = {0: "mana", 1: "energy"}


def ranks(values, count=5):
    """The five real ranks out of a spell's value array.

    Two layouts, both in the same file:

      7 long -> a rank-0 entry sits at index 0 and the last value repeats.
                Olaf's E cooldown is [9,9,8,7,6,5,5] and the spell is
                9/8/7/6/5, so ranks 1-5 are indices 1..5.
      6 long -> no rank-0 entry. Olaf's Q cost is [55,60,65,70,75,75] and
                the spell costs 55/60/65/70/75, so ranks 1-5 are 0..4.

    Reading a 7-long array as though it were 6-long shifts every value one
    rank — which looks entirely plausible and is wrong everywhere. The
    anchors in --verify exist because of exactly this.

    An ultimate has three ranks; it is stored in the same five-wide array,
    so take the first three of what comes back."""
    if not isinstance(values, list) or not values:
        return None
    out = values[1:1 + count] if len(values) >= 7 else values[:count]
    return [round(float(v), 4) if isinstance(v, (int, float)) else v for v in out]


def trim_spell(spell):
    """One ability, reduced to the numbers that describe it."""
    if not isinstance(spell, dict):
        return None
    data = {}
    for dv in spell.get("DataValues") or []:
        name, values = dv.get("name"), dv.get("values")
        got = ranks(values)
        if name and got:
            data[name] = got
    out = {
        "cooldown": ranks(spell.get("cooldownTime")),
        "cost":     ranks(spell.get("mana")),
        "range":    ranks(spell.get("castRange")),
        "values":   data or None,
    }
    return {k: v for k, v in out.items() if v is not None} or None


def trim_champion(binj, row):
    """Pure: a parsed bin plus its catalogue row, in and a small record out.

    Kept free of network and disk so --self-test can drive it."""
    record_key = next((k for k in binj if k.endswith("/CharacterRecords/Root")), None)
    if not record_key:
        raise ValueError("no CharacterRecords/Root in the bin")
    R = binj[record_key]

    res = R.get("primaryAbilityResource") or {}
    res_type = RESOURCE_TYPES.get(res.get("arType"), "none")
    regen = unwrap(res.get(RESOURCE_KEYS["regen"]))
    regen_lvl = unwrap(res.get(RESOURCE_KEYS["regenPerLevel"]))
    hp_regen = unwrap(R.get("baseStaticHPRegenModifiable"))
    hp_regen_lvl = unwrap(R.get("hpRegenPerLevelModifiable"))

    # Regen is stored per second and every page on this site labels it per
    # 5 seconds, so the unit is converted here and spelled out in the field
    # name. A silent per-second number under a "per 5s" label is a fivefold
    # error that reads as plausible.
    x5 = lambda n: None if n is None else round(n * 5, 4)

    stats = {
        "hp":            unwrap(R.get("baseHPModifiable")),
        "hpPerLevel":    unwrap(R.get("hpPerLevelModifiable")),
        "hpRegen5":      x5(hp_regen),
        "hpRegen5PerLevel": x5(hp_regen_lvl),
        "resource":      res_type,
        "mp":            unwrap(res.get(RESOURCE_KEYS["base"])),
        "mpPerLevel":    unwrap(res.get(RESOURCE_KEYS["perLevel"])),
        "mpRegen5":      x5(regen),
        "mpRegen5PerLevel": x5(regen_lvl),
        "ad":            unwrap(R.get("baseDamageModifiable")),
        "adPerLevel":    unwrap(R.get("damagePerLevelModifiable")),
        "armor":         unwrap(R.get("baseArmorModifiable")),
        "armorPerLevel": unwrap(R.get("armorPerLevelModifiable")),
        # Absent means zero growth, not missing data: ranged champions
        # simply have no mrPerLevel key, melee ones carry 1.25.
        "mr":            unwrap(R.get("baseMR")),
        "mrPerLevel":    unwrap(R.get("mrPerLevel")) or 0.0,
        "moveSpeed":     unwrap(R.get("baseMoveSpeedModifiable")),
        "attackRange":   unwrap(R.get("attackRangeModifiable")),
        "attackSpeed":   unwrap(R.get("attackSpeedModifiable")),
        "attackSpeedRatio":    unwrap(R.get("attackSpeedRatioModifiable")),
        "attackSpeedPerLevel": unwrap(R.get("attackSpeedPerLevelModifiable")),
        "critDamage":    unwrap(R.get("critDamageMultiplier")),
    }
    if res_type == "none":
        for k in ("mp", "mpPerLevel", "mpRegen5", "mpRegen5PerLevel"):
            stats[k] = None

    # Slots come from spellNames, which is ordered Q, W, E, R. Matching on
    # the spell's own name instead would be guesswork: Ashe's W is called
    # Volley and her E is SpiritOfTheHawk, and nothing in either name says
    # which key it sits on.
    spells = {}
    for letter, path in zip("QWER", R.get("spellNames") or []):
        entry = binj.get("Characters/" + R.get("mCharacterName", "") + "/Spells/" + path) \
            or next((binj[k] for k in binj if k.endswith("/" + path.split("/")[-1])), None)
        got = trim_spell((entry or {}).get("mSpell"))
        if got:
            spells[letter] = got

    passive_path = R.get("mCharacterPassiveSpell") or ""
    if passive_path:
        entry = binj.get(passive_path) \
            or next((binj[k] for k in binj if k.endswith("/" + passive_path.split("/")[-1])), None)
        got = trim_spell((entry or {}).get("mSpell"))
        if got:
            spells["P"] = got

    return {
        "id":    row["id"],
        "key":   row["id"] - CHAMP_OFFSET,
        "name":  row.get("name", ""),
        "alias": row.get("alias", ""),
        "stats": stats,
        "spells": spells,
    }


# ---------------------------------------------------------------- anchors
#
# Values read by hand off the live files and cross-checked against Data
# Dragon's Season 3 records. If the export's shape shifts under us — a
# renamed field, a changed array layout, a resource block that moves — the
# script keeps running and produces confident nonsense. These stop that.
ANCHORS = [
    ("Ashe",    "stats.hp", 474),
    ("Ashe",    "stats.ad", 49.15),
    ("Ashe",    "stats.armor", 18.9),
    ("Ashe",    "stats.mp", 208),
    ("Ashe",    "stats.attackSpeed", 0.658),
    ("Ashe",    "stats.attackRange", 600),
    ("Ashe",    "stats.mrPerLevel", 0.0),
    ("Garen",   "stats.resource", "none"),
    ("Lee Sin", "stats.resource", "energy"),
    ("Lee Sin", "stats.mp", 200),
    ("Lee Sin", "stats.mrPerLevel", 1.25),
    # The rank layout, which is the easiest thing here to get subtly wrong.
    ("Olaf",    "spells.E.values.BaseDamage", [100, 160, 220, 280, 340]),
    ("Olaf",    "spells.E.values.BaseHealthCost", [40, 64, 88, 112, 136]),
    ("Olaf",    "spells.E.cooldown", [9, 8, 7, 6, 5]),
    ("Kayle",   "spells.Q.values.Damage", [60, 110, 160, 210, 260]),
    ("Kayle",   "spells.Q.values.SlowPercent", [35, 40, 45, 50, 55]),
]


def dig(obj, path):
    for part in path.split("."):
        if not isinstance(obj, dict) or part not in obj:
            return None
        obj = obj[part]
    return obj


def verify(by_name):
    """Returns a list of complaints; empty means the shape still holds."""
    bad = []
    for name, path, want in ANCHORS:
        champ = by_name.get(name)
        if not champ:
            bad.append(f"{name}: not in the snapshot at all")
            continue
        got = dig(champ, path)
        if isinstance(want, list):
            ok = isinstance(got, list) and len(got) >= len(want) and \
                 all(abs(a - b) < 0.01 for a, b in zip(got[:len(want)], want))
        elif isinstance(want, (int, float)):
            ok = isinstance(got, (int, float)) and abs(got - want) < 0.01
        else:
            ok = got == want
        if not ok:
            bad.append(f"{name}.{path}: expected {want}, got {got}")
    return bad


# ---------------------------------------------------------------- network

def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "s3builds-fetch"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def roster():
    rows = get_json(PLUGIN + "/v1/champion-summary.json")
    out = [c for c in rows if str(c.get("alias", "")).lower().startswith("jade_")]
    if not out:
        raise SystemExit("champion-summary.json listed no Jade champions — "
                         "refusing to write an empty snapshot")
    return sorted(out, key=lambda c: c["id"])


def bin_url(alias):
    slug = alias.split("_", 1)[1].lower() if "_" in alias else alias.lower()
    return f"{CD}/game/data/characters/jade_{slug}/jade_{slug}.bin.json"


def build():
    rows = roster()
    champions, failures = {}, []
    for i, row in enumerate(rows, 1):
        name = row.get("name", row["id"])
        try:
            binj = get_json(bin_url(row["alias"]))
            champions[str(row["id"])] = trim_champion(binj, row)
            print(f"  [{i:2}/{len(rows)}] {name}")
        except Exception as e:                       # noqa: BLE001
            failures.append(f"{name}: {e}")
            print(f"  [{i:2}/{len(rows)}] {name} — FAILED: {e}")
    try:
        patch = ".".join(get_json(VERSIONS)[0].split(".")[:2])
    except Exception:                                # noqa: BLE001
        patch = None
    return {
        "patch": patch,
        "fetched": datetime.date.today().isoformat(),
        "source": CD + "/game/data/characters/",
        "note": "A fallback for when Community Dragon is unreachable. "
                "The site reads these numbers live; do not edit by hand.",
        "champions": champions,
    }, failures


# ---------------------------------------------------------------- self-test
#
# Offline, because the trimming is where the bugs are and the network is
# not. The fixture reproduces the shapes the real files actually have —
# wrapped floats, hashed resource keys, a 7-long array beside a 6-long one,
# a manaless resource block — so a change to the trimming breaks it.

FIXTURE_BIN = {
    "Characters/Jade_Test/CharacterRecords/Root": {
        "mCharacterName": "Jade_Test",
        "baseHPModifiable": {"__type": "ModifiableFloat", "baseValue": 474},
        "hpPerLevelModifiable": {"__type": "ModifiableFloat", "baseValue": 79},
        "baseStaticHPRegenModifiable": {"__type": "ModifiableFloat", "baseValue": 1.01},
        "hpRegenPerLevelModifiable": {"__type": "ModifiableFloat", "baseValue": 0.11},
        "baseDamageModifiable": {"__type": "ModifiableFloat", "baseValue": 49.15},
        "baseArmorModifiable": {"__type": "ModifiableFloat", "baseValue": 18.9},
        "baseMR": {"__type": "ModifiableFloat", "baseValue": 30},
        # mrPerLevel deliberately absent — ranged champions have no key.
        "baseMoveSpeedModifiable": {"__type": "ModifiableFloat", "baseValue": 325},
        "attackRangeModifiable": {"__type": "ModifiableFloat", "baseValue": 600},
        "attackSpeedModifiable": {"__type": "ModifiableFloat", "baseValue": 0.658},
        "primaryAbilityResource": {
            "arType": 0,
            "{726ee5cd}": {"__type": "ModifiableFloat", "baseValue": 208},
            "{6216bf7b}": {"__type": "ModifiableFloat", "baseValue": 35},
            "{c4ab3550}": {"__type": "ModifiableFloat", "baseValue": 1.34},
            "{3a509002}": {"__type": "ModifiableFloat", "baseValue": 0.08},
        },
        "spellNames": ["Jade_TestQAbility/Jade_TestQ", "Jade_TestWAbility/Jade_TestW"],
        "mCharacterPassiveSpell": "Characters/Jade_Test/Spells/Jade_TestPassive",
    },
    "Characters/Jade_Test/Spells/Jade_TestQAbility/Jade_TestQ": {"mSpell": {
        # 7 long: a rank-0 entry leads and the tail repeats.
        "cooldownTime": [9, 9, 8, 7, 6, 5, 5],
        # 6 long: no rank-0 entry.
        "mana": [55, 60, 65, 70, 75, 75],
        "DataValues": [{"name": "BaseDamage", "values": [40, 100, 160, 220, 280, 340, 400]}],
    }},
    "Characters/Jade_Test/Spells/Jade_TestWAbility/Jade_TestW": {"mSpell": {
        "cooldownTime": [16, 16, 16, 16, 16, 16, 16],
    }},
    "Characters/Jade_Test/Spells/Jade_TestPassive": {"mSpell": {
        "DataValues": [{"name": "Thing", "values": [0.01] * 7}],
    }},
}
FIXTURE_ROW = {"id": 60022, "name": "Test", "alias": "Jade_Test"}


def self_test():
    fails = []

    def check(label, got, want):
        """`got` may be a value or a callable. A callable that raises is a
        failure, not a crash — a mutation that makes trim_champion throw
        should read as a red line next to its name like any other, instead
        of a traceback that takes the rest of the run with it."""
        try:
            value = got() if callable(got) else got
        except Exception as e:                       # noqa: BLE001
            fails.append(f"{label}: raised {type(e).__name__}: {e}")
            print(f"FAIL  {label}  ({type(e).__name__}: {e})")
            return
        if value != want:
            fails.append(f"{label}: expected {want!r}, got {value!r}")
            print(f"FAIL  {label}")
        else:
            print(f"ok    {label}")

    # Not bare: if a change makes trim_champion raise, that has to read as
    # a failure with a name on it, not a traceback that hides every check
    # below it. An empty record keeps the rest of the run meaningful.
    try:
        c = trim_champion(FIXTURE_BIN, FIXTURE_ROW)
    except Exception as e:                           # noqa: BLE001
        fails.append(f"trim_champion raised: {type(e).__name__}: {e}")
        print(f"FAIL  trim_champion runs at all  ({type(e).__name__}: {e})")
        c = {"key": None, "stats": {}, "spells": {}}

    check("the key is the id minus the offset", c["key"], 22)
    check("wrapped floats are unwrapped", c["stats"]["hp"], 474)
    check("an absent mrPerLevel reads as no growth", c["stats"]["mrPerLevel"], 0.0)
    check("mana comes out from behind its hash", c["stats"]["mp"], 208)
    check("the resource type is named", c["stats"]["resource"], "mana")
    # Per-second under a per-5s label is a fivefold error that looks fine.
    check("health regen is converted to per 5s", c["stats"]["hpRegen5"], 5.05)
    check("mana regen is converted to per 5s", c["stats"]["mpRegen5"], 6.7)

    check("a 7-long array drops its rank-0 entry",
          lambda: c["spells"]["Q"]["cooldown"], [9, 8, 7, 6, 5])
    check("  and so does a 7-long data value",
          lambda: c["spells"]["Q"]["values"]["BaseDamage"], [100, 160, 220, 280, 340])
    check("a 6-long array does NOT drop its first entry",
          lambda: c["spells"]["Q"]["cost"], [55, 60, 65, 70, 75])
    check("slots come from spellNames, in order",
          sorted(c["spells"].keys()), ["P", "Q", "W"])

    # A manaless champion: the block is present and full of zeroes, and the
    # arType key is simply missing. Reading that as mana gives every
    # manaless champion a 0-mana bar instead of none.
    manaless = json.loads(json.dumps(FIXTURE_BIN))
    manaless["Characters/Jade_Test/CharacterRecords/Root"]["primaryAbilityResource"] = {
        "{726ee5cd}": {"__type": "ModifiableFloat", "baseValue": 0},
        "{c4ab3550}": {"__type": "ModifiableFloat", "baseValue": 0},
    }
    m = trim_champion(manaless, FIXTURE_ROW)
    check("a missing arType means no resource, not mana",
          m["stats"]["resource"], "none")
    check("  and its mana is absent rather than zero", m["stats"]["mp"], None)

    energy = json.loads(json.dumps(FIXTURE_BIN))
    energy["Characters/Jade_Test/CharacterRecords/Root"]["primaryAbilityResource"]["arType"] = 1
    check("arType 1 is energy",
          trim_champion(energy, FIXTURE_ROW)["stats"]["resource"], "energy")

    # The anchors have to be able to fail, or they are decoration.
    bad = verify({"Ashe": {"stats": {"hp": 999}}})
    check("the anchors notice a wrong value", bool(bad), True)
    check("  and notice a champion going missing",
          any("not in the snapshot" in b for b in verify({})), True)

    # unwrap must refuse a dict rather than pass one through into JSON.
    check("unwrap refuses a shape it does not understand",
          lambda: unwrap({"nope": 1}), None)
    check("  and handles a bare number", lambda: unwrap(7.25), 7.25)

    print("\n" + (f"{len(fails)} failure(s)" if fails else "the trimming holds up"))
    return 1 if fails else 0


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="fetch and compare against the committed snapshot; "
                         "exit 1 if the numbers have moved")
    ap.add_argument("--self-test", action="store_true",
                    help="offline checks of the trimming, no network")
    ap.add_argument("--out", default=os.path.join(ROOT, OUT))
    args = ap.parse_args()

    if args.self_test:
        return self_test()

    print("Reading the mode's roster…")
    snapshot, failures = build()
    champs = snapshot["champions"]
    print(f"\n{len(champs)} champions, patch {snapshot['patch'] or 'unknown'}")

    by_name = {c["name"]: c for c in champs.values()}
    complaints = verify(by_name)
    if complaints:
        print("\nThe export's shape has changed — NOT writing:")
        for c in complaints:
            print("  " + c)
        print("\nEvery number this produced should be treated as wrong until\n"
              "the trimming is updated. See the shapes section of this file.")
        return 1
    print("Anchors pass; the shapes still hold.")

    if failures:
        # A champion that could not be fetched is a hole in a FALLBACK, and
        # a fallback with holes is worse than an obvious failure.
        print(f"\n{len(failures)} champion(s) failed — NOT writing:")
        for f in failures:
            print("  " + f)
        return 1

    if args.check:
        try:
            with open(args.out, encoding="utf-8") as fh:
                old = json.load(fh)
        except FileNotFoundError:
            print("\nNo snapshot on disk yet.")
            return 1
        moved = [n for n, c in champs.items()
                 if (old.get("champions") or {}).get(n) != c]
        if moved:
            names = sorted(champs[n]["name"] for n in moved)
            print(f"\n{len(moved)} champion(s) have changed since the snapshot:")
            print("  " + ", ".join(names))
            print("\nRe-run without --check to update it.")
            return 1
        print("\nNothing has moved since the snapshot.")
        return 0

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(snapshot, fh, indent=1, sort_keys=True)
        fh.write("\n")
    size = os.path.getsize(args.out)
    print(f"\nWrote {args.out} ({size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
