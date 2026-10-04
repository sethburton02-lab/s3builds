/* ============================================================
   Ability numbers check

       node tools/ability-check.js <site-dir>

   The mode's champion file carries each ability's tooltip text with its
   numbers left as @Placeholders@, and its own coefficient and effectAmount
   arrays are all zeroes — the values are genuinely not in that file. They
   live in the character record as named data values and small formula
   trees, and this is the reader for those.

   Why it needs its own harness: a wrong number here is invisible. A
   tooltip saying an ability deals 70 damage when it deals 95 renders
   perfectly, reads plausibly, and is wrong on every guide on the site. The
   only defence is fixtures taken from the real records with the expected
   output worked out by hand.

   Every fixture below is Gangplank's, copied from his record rather than
   invented, because he happens to cover four of the shapes that matter:

     Q  a named value plus a ratio on a stat          (the common case)
     W  a named value plus a literal AP coefficient   (mStat omitted)
     R  a three-rank ultimate, so the rank count must be respected
     E  plain data values with no calculation at all

   The arrays are 7 long with a rank-0 entry leading, which is the layout
   that silently shifts every rank by one if read as a 6-long array.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";

/* ---- fixtures: Gangplank's record, trimmed to the spell blocks ---- */
const dv = (name, values) => ({name, values, __type: "SpellDataValue"});
const named = n => ({mDataValue: n, __type: "NamedDataValueCalculationPart"});
const statByNamed = (n, stat) => ({mStat: stat, mDataValue: n,
  __type: "StatByNamedDataValueCalculationPart"});

const GP = {
  /* The record's own Q/W/E/R mapping. Spell folders are named after the
     ability rather than the slot for most of the roster, so this is the
     only reliable way to tell which folder is the Q. */
  "Characters/Jade_Gangplank/CharacterRecords/Root": {
    spellNames: ["Jade_GangplankQAbility/Jade_GangplankQ",
                 "Jade_GangplankWAbility/Jade_GangplankW",
                 "Jade_GangplankEAbility/Jade_GangplankE",
                 "Jade_GangplankRAbility/Jade_GangplankR"]
  },
  "Characters/Jade_Gangplank/Spells/Jade_GangplankQAbility/Jade_GangplankQ": {
    mSpell: {
      DataValues: [
        dv("SpellDamage", [-5, 20, 45, 70, 95, 120, 145]),
        dv("ADRatio",     [1, 1, 1, 1, 1, 1, 1]),
        dv("GoldGain",    [2, 4, 6, 8, 10, 12, 14])
      ],
      mSpellCalculations: {
        ShotDamage: {__type: "GameCalculation",
          mFormulaParts: [named("SpellDamage"), statByNamed("ADRatio", 2)]}
      }
    }
  },
  "Characters/Jade_Gangplank/Spells/Jade_GangplankWAbility/Jade_GangplankW": {
    mSpell: {
      DataValues: [dv("BaseHeal", [10, 80, 150, 220, 290, 360, 430])],
      mSpellCalculations: {
        /* No mStat on the coefficient: ability power is the omitted
           default, and reading that as "no stat" loses the whole ratio. */
        TotalHeal: {__type: "GameCalculation",
          mFormulaParts: [named("BaseHeal"),
                          {mCoefficient: 1, __type: "StatByCoefficientCalculationPart"}]}
      }
    }
  },
  "Characters/Jade_Gangplank/Spells/Jade_GangplankEAbility/Jade_GangplankE": {
    mSpell: {
      DataValues: [
        dv("PassiveAD", [6, 8, 10, 12, 14, 16, 18]),
        dv("PassiveMS", [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08]),
        dv("Duration",  [7, 7, 7, 7, 7, 7, 7])
      ]
      /* No mSpellCalculations at all — these resolve as plain values. */
    }
  },
  "Characters/Jade_Gangplank/Spells/Jade_GangplankRAbility/Jade_GangplankR": {
    mSpell: {
      DataValues: [
        dv("BaseDamage", [30, 75, 120, 165, 210, 255, 300]),
        dv("APRatio",    [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]),
        dv("Slow",       [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25]),
        dv("Duration",   [7, 7, 7, 7, 7, 7, 7])
      ],
      mSpellCalculations: {
        TotalDamage: {__type: "GameCalculation",
          mFormulaParts: [named("BaseDamage"), statByNamed("APRatio", 0)]}
      }
    }
  },
  /* A child spell under the R ability. A quarter of all tooltip
     placeholders across the roster live on children like this one, and
     indexing only the root resolves 74% of tokens where folding the
     children in resolves 97%. */
  "Characters/Jade_Gangplank/Spells/Jade_GangplankRAbility/Jade_GangplankR_Slow": {
    mSpell: {DataValues: [dv("ChildOnly", [1, 11, 22, 33, 44, 55, 66])]}
  }
};

/* Master Yi, whose spell folders carry ability names rather than slot
   letters. Matching "<name>QAbility" finds nothing here, which is how a
   letter-based lookup scored 0 of 12 on him while looking correct on
   Gangplank. Only the Q is needed to prove the mapping is read. */
const YI = {
  "Characters/Jade_MasterYi/CharacterRecords/Root": {
    spellNames: ["Jade_MasterYiAlphaStrikeAbility/Jade_MasterYiAlphaStrike",
                 "Jade_MasterYiMeditateAbility/Jade_MasterYiMeditate",
                 "Jade_MasterYiWujuStyleAbility/Jade_MasterYiWujuStyle",
                 "Jade_MasterYiHighlanderAbility/Jade_MasterYiHighlander"]
  },
  "Characters/Jade_MasterYi/Spells/Jade_MasterYiAlphaStrikeAbility/Jade_MasterYiAlphaStrike": {
    mSpell: {
      DataValues: [dv("BaseDamage", [0, 25, 60, 95, 130, 165, 200])],
      mSpellCalculations: {
        TotalDamage: {__type: "GameCalculation", mFormulaParts: [named("BaseDamage")]}
      }
    }
  }
};

/* ---- environment: site.js is browser code ---- */
class El {
  constructor(){ this.style = {setProperty(){}}; this.dataset = {}; this._html = "";
    this.classList = {add(){}, remove(){}, toggle(){}, contains: () => false};
    this.textContent = ""; this.value = ""; }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html = String(v); }
  setAttribute(){} getAttribute(){ return null; } removeAttribute(){}
  appendChild(c){ return c; } remove(){} addEventListener(){}
  querySelector(){ return null; } querySelectorAll(){ return []; } closest(){ return null; }
}
global.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => new El(), createElementNS: () => new El(),
  addEventListener(){}, removeEventListener(){},
  body: new El(), documentElement: new El(), readyState: "complete", title: ""
};
global.window = global; global.self = global;
global.location = {href: "file:///x.html", search: "", hash: "", protocol: "file:"};
global.navigator = {userAgent: "stub"};
const mem = new Map();
global.localStorage = global.sessionStorage = {
  getItem: k => mem.has(k) ? mem.get(k) : null,
  setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k)
};
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.matchMedia = () => ({matches: false, addListener(){}, addEventListener(){}});
global.Image = El; global.getComputedStyle = () => ({getPropertyValue: () => ""});
global.innerWidth = 1600; global.innerHeight = 900; global.scrollY = 0;
global.structuredClone = v => JSON.parse(JSON.stringify(v));
global.fetch = async () => { throw new Error("offline"); };

global.__GP = GP;
global.__YI = YI;

let src = fs.readFileSync(path.join(dir, "site.js"), "utf8");
src += `
;(function(){
  let failed = 0;
  const check = (label, fn) => {
    try{
      const out = fn();
      if(out === false){ console.log("FAIL  " + label); failed++; }
      else console.log("ok    " + label);
    }catch(err){ console.log("FAIL  " + label + " -- threw: " + err.message); failed++; }
  };
  const scope = L => CLASSIC.spellScope(__GP, L);

  console.log("reading the record:");
  check("an ability's values and calculations are found", () => {
    const s = scope("Q");
    return !!s && s.values.has("SpellDamage") && s.calcs.has("ShotDamage");
  });
  check("child spells are folded in with the ability", () => {
    const s = scope("R");
    return s.values.has("BaseDamage") && s.values.has("ChildOnly");
  });
  check("one ability's values don't leak into another's", () => {
    const s = scope("Q");
    return !s.values.has("BaseHeal") && !s.values.has("PassiveAD");
  });
  /* The bug that made this whole reader look right and resolve nothing for
     most of the roster. */
  check("an ability folder named after the ability is still found", () => {
    const s = CLASSIC.spellScope(__YI, "Q");
    return !!s && CLASSIC.calcText("TotalDamage", s, 5) === "25 / 60 / 95 / 130 / 165";
  });
  check("  and the slot order comes from the record, not the folder name", () => {
    /* W is Meditate here, which has no block in the fixture at all — so a
       reader guessing "...WAbility" would have to invent one. */
    return CLASSIC.spellScope(__YI, "W") === null;
  });

  check("a letter with no spell block reads as nothing", () =>
    CLASSIC.spellScope({}, "Q") === null);
  check("a junk record reads as nothing, rather than throwing", () =>
    CLASSIC.spellScope(null, "Q") === null && CLASSIC.spellScope(__GP, "Z") === null);

  console.log("\\nrank arrays:");
  /* The 7-long layout leads with a rank-0 entry. Read as 6-long, rank 1
     returns -5 instead of 20 — plausible, and wrong at every rank. */
  check("a 7-long array skips its rank-0 entry", () =>
    CLASSIC.dataAt([-5, 20, 45, 70, 95, 120, 145], 0) === 20);
  check("  and rank 5 is the last real one, not the padding", () =>
    CLASSIC.dataAt([-5, 20, 45, 70, 95, 120, 145], 4) === 120);
  check("a 6-long array has no rank-0 entry", () =>
    CLASSIC.dataAt([55, 60, 65, 70, 75, 75], 0) === 55);
  check("asking past the end clamps rather than returning undefined", () =>
    CLASSIC.dataAt([1, 2, 3], 9) === 3);
  check("an empty array is null, not zero", () =>
    CLASSIC.dataAt([], 0) === null && CLASSIC.dataAt(null, 0) === null);

  console.log("\\nformulas:");
  /* 20 + 100% total AD at rank 1, rising to 120 at rank 5. */
  check("a named value plus a stat ratio", () =>
    CLASSIC.calcText("ShotDamage", scope("Q"), 5) === "20 / 45 / 70 / 95 / 120 (+100% AD)");
  /* The AP coefficient with mStat omitted — the default is ability power,
     and reading the omission as "no stat" drops the ratio entirely. */
  check("a literal coefficient defaults to ability power", () =>
    CLASSIC.calcText("TotalHeal", scope("W"), 5) === "80 / 150 / 220 / 290 / 360 (+100% AP)");
  /* An ultimate has three ranks stored in the same wide array. Reading
     five would invent two ranks the ability does not have. */
  check("an ultimate stops at three ranks", () =>
    CLASSIC.calcText("TotalDamage", scope("R"), 3) === "75 / 120 / 165 (+20% AP)");
  check("a value with no calculation around it still resolves", () =>
    CLASSIC.calcText("PassiveAD", scope("E"), 5) === "8 / 10 / 12 / 14 / 16");
  check("a value that is the same at every rank prints once", () =>
    CLASSIC.calcText("Duration", scope("R"), 3) === "7");
  check("a name that exists nowhere is null, not an empty string", () =>
    CLASSIC.calcText("NoSuchThing", scope("Q"), 5) === null);

  console.log("\\nparts the reader does not understand:");
  /* The whole calculation is abandoned rather than half-read. A formula
     that resolves its first term and silently drops a second reads as a
     complete answer and is wrong by exactly the part that went missing. */
  check("an unknown part type abandons the whole calculation", () => {
    const s = scope("Q");
    s.calcs.set("Mixed", {__type: "GameCalculation", mFormulaParts: [
      {mDataValue: "SpellDamage", __type: "NamedDataValueCalculationPart"},
      {__type: "ByCharLevelBreakpointsCalculationPart", mLevel1Value: 10}
    ]});
    return CLASSIC.calcText("Mixed", s, 5) === null;
  });
  check("  and a cycle can't hang it", () => {
    const s = scope("Q");
    s.calcs.set("Loop", {__type: "GameCalculationModified",
                         mModifiedGameCalculation: "Loop", mMultiplier: {mNumber: 2,
                         __type: "NumberCalculationPart"}});
    return CLASSIC.calcText("Loop", s, 5) === null;
  });

  console.log("\\ntooltip text:");
  const rText = (raw, L, n) => CLASSIC.tipText(raw, scope(L), n || 5);
  check("placeholders are replaced with their numbers", () =>
    rText("Deals @TotalDamage@ magic damage.", "R", 3)
      === "Deals 75 / 120 / 165 (+20% AP) magic damage.");
  /* The multiplier form is how percentages are written: a 0.25 slow is
     stored as 0.25 and printed as "@Slow*100@%". */
  check("the *100 form turns a ratio into a percentage", () =>
    rText("Slows by @Slow*100@% for @Duration@ seconds.", "R", 3)
      === "Slows by 25% for 7 seconds.");
  /* A slow is stored negative and printed positive, as "@X*-100@%". The
     minus was missing from the pattern, so the token never matched and
     survived onto the page verbatim — found on Shaco's E, where the
     tooltip read "Slow the target by @SlowAmount*-100@%". */
  check("a negative multiplier flips the sign rather than being skipped", () => {
    /* One scope object, reused — scope() rebuilds from the record on every
       call, so injecting into one and then going through rText() would
       quietly test an empty value. */
    const s = scope("R");
    s.values.set("SlowAmount", [0, -0.2, -0.2, -0.2, -0.2, -0.2, -0.2]);
    return CLASSIC.tipText("Slows by @SlowAmount*-100@%.", s, 3) === "Slows by 20%.";
  });
  /* The belt-and-braces sweep: whatever shape a token takes, the one thing
     that must never happen is the reader seeing the machinery. */
  check("a token shape the pattern misses is still never shown raw", () => {
    const out = CLASSIC.tipText("Deals @Weird:Thing!@ damage. Fine here.", scope("R"), 3);
    return !out.includes("@") && out.includes("Fine here.");
  });

  check("client boilerplate is dropped, not printed", () =>
    rText("Does a thing.@SpellModifierDescriptionAppend@", "R", 3) === "Does a thing.");
  /* The one outcome that looks unmistakably broken on the page. */
  check("an unresolved token never reaches the page as @Name@", () => {
    const out = rText("Deals @NoSuchThing@ damage. And this part is fine.", "R", 3);
    return !out.includes("@") && out.includes("And this part is fine.");
  });
  check("  and it takes its own sentence with it, not the next one", () => {
    const out = rText("Deals @NoSuchThing@ damage. Slows by @Slow*100@%.", "R", 3);
    return !out.includes("Deals") && out.includes("Slows by 25%.");
  });

  console.log("\\nmarkup:");
  check("line breaks survive", () =>
    rText("One.<br>Two.", "R", 3).includes("<br>"));
  check("the client's colour tags become spans", () => {
    const out = rText("<physicalDamage>@TotalDamage@</physicalDamage> damage.", "R", 3);
    return out.includes('<span class="tip-kw physicaldamage">') && out.includes("</span>");
  });
  /* This text is Riot's rather than a reader's, but it reaches the page
     through innerHTML either way and the sanitiser does not care where a
     string came from. */
  check("a script tag in the text cannot reach the page", () => {
    const out = rText("<script>alert(1)</script>Safe.", "R", 3);
    return !out.includes("<script") && out.includes("Safe.");
  });
  check("an unknown tag is removed rather than rendered", () =>
    !rText("<marquee>Hi</marquee> there.", "R", 3).includes("marquee"));
  check("an event handler cannot survive on an allowed tag", () =>
    !rText("<physicalDamage onmouseover=alert(1)>x</physicalDamage>", "R", 3)
      .includes("onmouseover"));
  check("no scope at all still returns readable text", () => {
    const out = CLASSIC.tipText("Deals @TotalDamage@ damage. Plain words here.", null, 5);
    return !out.includes("@") && out.includes("Plain words here.");
  });

  console.log(failed ? "\\n" + failed + " FAILED" : "\\nthe ability reader holds up");
  process.exit(failed ? 1 : 0);
})();
`;

(0, eval)(src);
