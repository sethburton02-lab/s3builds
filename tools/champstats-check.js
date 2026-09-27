/* ============================================================
   Champion stats check

       node tools/champstats-check.js <site-dir>

   Champion pages showed Data Dragon's 3.13.24 numbers for years. Those are
   Season 3's, and this mode is not Season 3: every champion's base stats
   differ, and three of the ten first measured differ by a balance change
   that no formula predicts. The page looked completely fine the whole time,
   which is the point — a wrong stat is not a broken stat, and nothing about
   it fails loudly.

   So the reader has to fail loudly instead. Every fixture below is a real
   record pulled from the mode's own files, trimmed to the fields the reader
   touches and otherwise untouched, because the whole risk here is reading a
   real layout wrongly rather than reading an invented one correctly.

   The four fixtures are the four shapes that exist:

     Ashe    mana, every key present, ranged (no mrPerLevel)
     Graves  mana, ranged, the champion whose art and stats both bit us
     LeeSin  energy: arType 1, and NO per-level or regen-per-level keys
     Garen   manaless: the resource block is present, full of zeroes, and
             the arType key is simply absent

   Garen is the one that matters most. Reading a missing arType as 0 gives
   every manaless champion a mana bar, and reading his absent mpPerLevel as
   missing rather than zero puts "Resource 0" on the page as though the data
   had failed to load.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";

/* ---- fixtures: real records, trimmed ---- */
const F = {
  Ashe: {"Characters/Jade_Ashe/CharacterRecords/Root": {
    baseHPModifiable: {baseValue: 474}, hpPerLevelModifiable: {baseValue: 79},
    baseStaticHPRegenModifiable: {baseValue: 1.01},
    hpRegenPerLevelModifiable: {baseValue: 0.11},
    baseDamageModifiable: {baseValue: 49.15},
    damagePerLevelModifiable: {baseValue: 2.85},
    baseArmorModifiable: {baseValue: 18.9},
    armorPerLevelModifiable: {baseValue: 3.4},
    baseMR: {baseValue: 30},
    baseMoveSpeedModifiable: {baseValue: 325},
    attackRangeModifiable: {baseValue: 600},
    primaryAbilityResource: {arType: 0,
      "{726ee5cd}": {baseValue: 208}, "{6216bf7b}": {baseValue: 35},
      "{c4ab3550}": {baseValue: 1.34}, "{3a509002}": {baseValue: 0.08}}}},

  Graves: {"Characters/Jade_Graves/CharacterRecords/Root": {
    baseHPModifiable: {baseValue: 494}, hpPerLevelModifiable: {baseValue: 84},
    baseStaticHPRegenModifiable: {baseValue: 1.24},
    hpRegenPerLevelModifiable: {baseValue: 0.14},
    baseDamageModifiable: {baseValue: 54.1},
    damagePerLevelModifiable: {baseValue: 3.1},
    baseArmorModifiable: {baseValue: 22.2},
    armorPerLevelModifiable: {baseValue: 3.2},
    baseMR: {baseValue: 30},
    baseMoveSpeedModifiable: {baseValue: 330},
    attackRangeModifiable: {baseValue: 525},
    primaryAbilityResource: {arType: 0,
      "{726ee5cd}": {baseValue: 295}, "{6216bf7b}": {baseValue: 40},
      "{c4ab3550}": {baseValue: 1.49}, "{3a509002}": {baseValue: 0.14}}}},

  LeeSin: {"Characters/Jade_LeeSin/CharacterRecords/Root": {
    baseHPModifiable: {baseValue: 513}, hpPerLevelModifiable: {baseValue: 85},
    baseStaticHPRegenModifiable: {baseValue: 1.39},
    hpRegenPerLevelModifiable: {baseValue: 0.14},
    baseDamageModifiable: {baseValue: 59},
    damagePerLevelModifiable: {baseValue: 3.2},
    baseArmorModifiable: {baseValue: 23.7},
    armorPerLevelModifiable: {baseValue: 3.7},
    baseMR: {baseValue: 31.25}, mrPerLevel: {baseValue: 1.25},
    baseMoveSpeedModifiable: {baseValue: 350},
    attackRangeModifiable: {baseValue: 125},
    primaryAbilityResource: {arType: 1,
      "{726ee5cd}": {baseValue: 200}, "{c4ab3550}": {baseValue: 10}}}},

  Garen: {"Characters/Jade_Garen/CharacterRecords/Root": {
    baseHPModifiable: {baseValue: 551}, hpPerLevelModifiable: {baseValue: 96},
    baseStaticHPRegenModifiable: {baseValue: 1.8},
    hpRegenPerLevelModifiable: {baseValue: 0.15},
    baseDamageModifiable: {baseValue: 60},
    damagePerLevelModifiable: {baseValue: 3.5},
    baseArmorModifiable: {baseValue: 25.7},
    armorPerLevelModifiable: {baseValue: 3},
    baseMR: {baseValue: 31.25}, mrPerLevel: {baseValue: 1.25},
    baseMoveSpeedModifiable: {baseValue: 345},
    attackRangeModifiable: {baseValue: 125},
    primaryAbilityResource: {
      "{726ee5cd}": {baseValue: 0}, "{c4ab3550}": {baseValue: 0}}}}
};

const SUMMARY = [
  {id: 60022, name: "Ashe",    alias: "Jade_Ashe"},
  {id: 60104, name: "Graves",  alias: "Jade_Graves"},
  {id: 60064, name: "Lee Sin", alias: "Jade_LeeSin"},
  {id: 60086, name: "Garen",   alias: "Jade_Garen"},
  {id: 1,     name: "Teemo",   alias: "Teemo"}          /* not a Jade row */
];

/* ---- environment ---- */
class El {
  constructor(){ this.style={setProperty(){}}; this.dataset={}; this._html="";
    this.classList={add(){},remove(){},toggle(){},contains:()=>false}; this.textContent=""; }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html=String(v); }
  setAttribute(){} getAttribute(){ return null; } removeAttribute(){}
  appendChild(c){ return c; } remove(){} addEventListener(){} querySelector(){ return null; }
  querySelectorAll(){ return []; } closest(){ return null; }
}
global.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => new El(), createElementNS: () => new El(),
  addEventListener(){}, removeEventListener(){},
  body: new El(), documentElement: new El(), activeElement: null, title: "", readyState: "complete"
};
global.window = global; global.self = global;
global.location = {href:"file:///x.html", search:"", hash:"", protocol:"file:"};
global.navigator = {userAgent:"stub"};
const mem = new Map();
global.localStorage = global.sessionStorage = {
  getItem: k => mem.has(k) ? mem.get(k) : null,
  setItem: (k,v) => mem.set(k,String(v)), removeItem: k => mem.delete(k)
};
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = cb => setTimeout(cb,0);
global.matchMedia = () => ({matches:false, addListener(){}, addEventListener(){}});
global.Image = El; global.getComputedStyle = () => ({getPropertyValue:()=>""});
global.innerWidth = 1600; global.innerHeight = 900; global.scrollY = 0;
global.structuredClone = v => JSON.parse(JSON.stringify(v));

/* Every URL the reader asks for this run, and what it gets. `world` also
   records what was requested, because "did it ask for the right file" is
   half of what this harness is checking. */
let world = {};
const json = body => ({ok:true, status:200, json: async () => body});
global.fetch = async url => {
  const u = String(url);
  (world.asked = world.asked || []).push(u);
  if(/champion-summary\.json/.test(u)){
    if(world.catalogue === "down") throw new Error("offline");
    return json(SUMMARY);
  }
  const bin = /\/characters\/jade_([a-z0-9]+)\/jade_[a-z0-9]+\.bin\.json$/.exec(u);
  if(bin){
    const which = {ashe:"Ashe", graves:"Graves", leesin:"LeeSin", garen:"Garen"}[bin[1]];
    if(world.stats === "down")  throw new Error("offline");
    if(world.stats === "404")   return {ok:false, status:404, json: async()=>null};
    if(world.stats === "junk")  return json({nothing: true});
    if(world.stats === "empty") return json({"Characters/Jade_X/CharacterRecords/Root": {}});
    if(!which) throw new Error("no fixture for slug " + bin[1]);
    return json(F[which]);
  }
  if(/versions\.json/.test(u)) return json(["16.19.1"]);
  throw new Error("unexpected fetch: " + u);
};

global.__F = F;
global.__setWorld = how => { world = how; };
global.__asked = () => world.asked || [];
global.__memClear = () => mem.clear();

/* site.js is a script, not a module: its `let` bindings don't escape an
   indirect eval, so the checks are appended to its source instead of run
   beside it. Same arrangement as roster-check.js. */
let src = fs.readFileSync(path.join(dir, "site.js"), "utf8");

src += `
;(async function(){
  let failed = 0;
  const check = (label, fn) => {
    try{
      const out = fn();
      if(out === false){ console.log("FAIL  " + label); failed++; }
      else console.log("ok    " + label);
    }catch(err){ console.log("FAIL  " + label + " -- threw: " + err.message); failed++; }
  };
  const acheck = async (label, fn) => {
    try{
      const out = await fn();
      if(out === false){ console.log("FAIL  " + label); failed++; }
      else console.log("ok    " + label);
    }catch(err){ console.log("FAIL  " + label + " -- threw: " + err.message); failed++; }
  };
  /* Floats out of the export carry single-precision noise, so stats are
     compared to a tolerance rather than for equality. */
  const near = (a, b) => a !== null && a !== undefined && Math.abs(a - b) < 0.0005;
  const fresh = () => { CLASSIC._roster = null; CLASSIC._stats = null; __memClear(); };

  /* ---------- the reader, on the four real shapes ---------- */

  const ashe = CLASSIC.readStatBin(__F.Ashe);
  check("Ashe health is the mode's 474, not the archive's 395",
    () => ashe.hp === 474 && ashe.hpperlevel === 79);
  check("Ashe attack damage 49.15",     () => near(ashe.attackdamage, 49.15));
  check("Ashe armour 18.9 (+3.4/lvl)",  () => near(ashe.armor, 18.9) && near(ashe.armorperlevel, 3.4));
  check("Ashe mana 208 (+35/lvl)",      () => ashe.mp === 208 && ashe.mpperlevel === 35);
  check("Ashe is on mana",              () => ashe.resource === "mana");
  check("Ashe move speed 325, range 600",
    () => ashe.movespeed === 325 && ashe.attackrange === 600);

  /* The fivefold error. Both regens are stored per second and shown per 5s;
     1.34/s is 6.7 per 5s, and 1.34 under a "per 5s" label looks fine. */
  check("Ashe health regen converted to per-5s: 1.01/s -> 5.05",
    () => near(ashe.hpregen, 5.05));
  check("Ashe health regen growth converted too: 0.11/s -> 0.55",
    () => near(ashe.hpregenperlevel, 0.55));
  check("Ashe mana regen converted: 1.34/s -> 6.7",
    () => near(ashe.mpregen, 6.7));
  check("Ashe mana regen growth converted: 0.08/s -> 0.4",
    () => near(ashe.mpregenperlevel, 0.4));

  /* Ranged champions have no mrPerLevel key at all. Absent is zero growth,
     not missing data — undefined here would print "+undefined/lvl". */
  check("Ashe magic resist 30 with zero growth, from an absent key",
    () => ashe.spellblock === 30 && ashe.spellblockperlevel === 0);

  const graves = CLASSIC.readStatBin(__F.Graves);
  check("Graves health 494 (archive says 410)",
    () => graves.hp === 494 && graves.hpperlevel === 84);
  check("Graves armour 22.2 = archive 15 + growth 3.2 + the mode's flat 4",
    () => near(graves.armor, 22.2));
  check("Graves mana 295 (+40/lvl)", () => graves.mp === 295 && graves.mpperlevel === 40);

  /* Energy: arType 1, and neither per-level key exists. */
  const lee = CLASSIC.readStatBin(__F.LeeSin);
  check("Lee Sin is on energy, not mana",  () => lee.resource === "energy");
  check("Lee Sin energy 200 flat, absent growth read as 0",
    () => lee.mp === 200 && lee.mpperlevel === 0);
  check("Lee Sin energy regen 10/s -> 50 per 5s, growth absent -> 0",
    () => near(lee.mpregen, 50) && lee.mpregenperlevel === 0);
  check("Lee Sin is melee: MR 31.25 with 1.25 growth",
    () => lee.spellblock === 31.25 && near(lee.spellblockperlevel, 1.25));

  /* Manaless. The resource block is there, the arType key is not. */
  const garen = CLASSIC.readStatBin(__F.Garen);
  check("Garen has no resource: an absent arType is 'none', not mana",
    () => garen.resource === "none");
  check("Garen still reads his real health and armour",
    () => garen.hp === 551 && near(garen.armor, 25.7));

  /* ---------- the growth step, checked rather than assumed ----------
     The claim in site.js is that the mode's bases sit one growth step above
     the archive's, armour one step plus 4. If that is ever wrong the
     comment is a lie, so the fixtures are asked directly. Archive figures
     are 3.13.24's, quoted here so the sum is auditable. */
  const S3 = {
    Ashe:   {hp:395, hpG:79, ad:46.3,  adG:2.85, armor:11.5, armorG:3.4, mp:173, mpG:35},
    Graves: {hp:410, hpG:84, ad:51,    adG:3.1,  armor:15,   armorG:3.2, mp:255, mpG:40}
  };
  for(const [name, a] of Object.entries(S3)){
    const m = CLASSIC.readStatBin(__F[name]);
    check(name + ": health is exactly one growth step over Season 3",
      () => near(m.hp, a.hp + a.hpG));
    check(name + ": attack damage is exactly one growth step over Season 3",
      () => near(m.attackdamage, a.ad + a.adG));
    check(name + ": armour is one growth step over Season 3 plus 4 flat",
      () => near(m.armor, a.armor + a.armorG + 4));
    check(name + ": mana is one growth step over Season 3",
      () => near(m.mp, a.mp + a.mpG));
  }
  /* And the check that rules out "a flat buff that happens to fit": where
     growth is zero, there is no shift. Lee Sin's energy is 200 in both. */
  check("no growth means no shift -- Lee Sin's energy matches Season 3 exactly",
    () => lee.mp === 200 && lee.mpperlevel === 0);

  /* ---------- the reader refusing bad input ---------- */
  check("null in, null out",            () => CLASSIC.readStatBin(null) === null);
  check("a string is not a record",     () => CLASSIC.readStatBin("{}") === null);
  check("no CharacterRecords/Root -> null",
    () => CLASSIC.readStatBin({"Characters/Jade_X/Other": {baseHPModifiable: 1}}) === null);
  check("a Root whose name only contains the path doesn't count",
    () => CLASSIC.readStatBin({"CharacterRecords/Root/Extra": {baseHPModifiable: 1}}) === null);
  /* An empty record must not fold a wall of nulls over good archive values. */
  check("an empty record -> null rather than a record of nulls",
    () => CLASSIC.readStatBin({"Characters/Jade_X/CharacterRecords/Root": {}}) === null);
  check("a record with health but nothing else still reads",
    () => {
      const o = CLASSIC.readStatBin({"Characters/Jade_X/CharacterRecords/Root":
        {baseHPModifiable: {baseValue: 500}}});
      return o && o.hp === 500 && o.mp === null && o.resource === "none";
    });

  /* statNum is the one guard between the export and the page. A dict
     reaching a stat line renders as [object Object]; a string renders as a
     number that looks right. */
  check("statNum unwraps a baseValue",   () => CLASSIC.statNum({baseValue: 7}) === 7);
  check("statNum takes a bare number",   () => CLASSIC.statNum(7) === 7);
  check("statNum rejects a string",      () => CLASSIC.statNum("7") === null);
  check("statNum rejects true",          () => CLASSIC.statNum(true) === null);
  check("statNum rejects a bare object", () => CLASSIC.statNum({}) === null);
  check("statNum rejects Infinity",      () => CLASSIC.statNum(Infinity) === null);
  check("statNum keeps a real zero",     () => CLASSIC.statNum({baseValue: 0}) === 0);

  /* ---------- the URL ---------- */
  check("the slug comes off the alias, lowercased, with Jade_ stripped",
    () => /\\/characters\\/jade_leesin\\/jade_leesin\\.bin\\.json$/.test(CLASSIC.statBinUrl("Jade_LeeSin")));
  check("the stat path sits under /game, not under /plugins",
    () => {
      const u = CLASSIC.statBinUrl("Jade_Ashe");
      return u.includes("/game/data/characters/") && !u.includes("/plugins/");
    });
  check("no alias, no URL", () => CLASSIC.statBinUrl("") === null);

  /* ---------- champStats over the network ---------- */
  fresh(); __setWorld({});
  await acheck("champStats(104) fetches Graves by his catalogue alias", async () => {
    const s = await CLASSIC.champStats(104);
    return s && s.hp === 494 &&
      __asked().some(u => /jade_graves\\.bin\\.json/.test(u));
  });

  fresh(); __setWorld({});
  await acheck("champStats asks the mode's catalogue for the alias rather than guessing", async () => {
    await CLASSIC.champStats(64);
    return __asked().some(u => /champion-summary\\.json/.test(u)) &&
           __asked().some(u => /jade_leesin\\.bin\\.json/.test(u));
  });

  fresh(); __setWorld({});
  await acheck("the second call for the same champion doesn't refetch", async () => {
    await CLASSIC.champStats(22);
    const n = __asked().filter(u => /jade_ashe/.test(u)).length;
    await CLASSIC.champStats(22);
    return n === 1 && __asked().filter(u => /jade_ashe/.test(u)).length === 1;
  });

  /* Two champions through the same cache. A key that isn't per-champion
     passes every single-champion test above and then serves Ashe's stats on
     Graves' page — right on the first page load of a session, wrong on
     every one after it. The in-memory map is dropped between the calls so
     the answers have to come back out of the session cache. */
  fresh(); __setWorld({});
  await acheck("the session cache keeps champions apart", async () => {
    const a1 = await CLASSIC.champStats(22);
    CLASSIC._stats = null;
    const g1 = await CLASSIC.champStats(104);
    CLASSIC._stats = null;
    const a2 = await CLASSIC.champStats(22);
    return a1.hp === 474 && g1.hp === 494 && a2.hp === 474;
  });

  /* ---------- the fallback: null, never a throw ---------- */
  for(const [how, label] of [["down","the host is unreachable"],
                             ["404","the file is missing"],
                             ["junk","the file isn't a character record"],
                             ["empty","the record is empty"]]){
    fresh(); __setWorld({stats: how});
    await acheck("champStats returns null when " + label + " (and does not throw)",
      async () => await CLASSIC.champStats(22) === null);
  }

  fresh(); __setWorld({catalogue: "down"});
  await acheck("no catalogue means no alias means null, not a guessed URL", async () => {
    const s = await CLASSIC.champStats(22);
    return s === null && !__asked().some(u => /bin\\.json/.test(u));
  });

  fresh(); __setWorld({});
  await acheck("a champion outside the mode's roster gets null", async () =>
    await CLASSIC.champStats(112) === null);
  fresh(); __setWorld({});
  await acheck("a non-numeric key gets null without a request", async () => {
    const s = await CLASSIC.champStats("Ashe");
    return s === null && !__asked().some(u => /bin\\.json/.test(u));
  });

  /* ---------- the alias map ---------- */
  fresh(); __setWorld({});
  await acheck("rosterIndex carries an alias per champion and skips non-Jade rows", async () => {
    const idx = await CLASSIC.rosterIndex();
    return idx.aliases.get(104) === "Jade_Graves" &&
           idx.aliases.get(64)  === "Jade_LeeSin" &&
           idx.aliases.size === 4;
  });

  /* The alias is stored in the session cache already, so a cached roster
     still has to produce one — otherwise stats work on a first page load
     and silently stop working on the second. */
  await acheck("the alias survives the session cache", async () => {
    CLASSIC._roster = null;            /* memory dropped, cache kept */
    const idx = await CLASSIC.rosterIndex();
    return idx.aliases.get(104) === "Jade_Graves";
  });

  console.log(failed ? "\\n" + failed + " FAILED" : "\\nall checks passed");
  process.exit(failed ? 1 : 0);
})();
`;

/* Indirect eval, so site.js runs in global scope as a browser would run it. */
(0, eval)(src);
