/* ============================================================
   Champion page check

       node tools/champ-page-check.js <site-dir>

   champstats-check.js proves site.js reads the mode's stat file correctly.
   This proves champion.html then puts those numbers on the page — which is
   a separate question, and the one that has burned this codebase before:
   inRoster() was correct and its call site passed it an array index, so the
   function's own tests were green while the page showed the wrong thing.

   What's checked here is the rendering, against a real record:

     - the mode's numbers replace the archive's, rather than sitting beside
       them unused
     - a manaless champion gets no resource rows instead of "Resource 0"
     - an energy champion's row says Energy
     - the level slider scales from the mode's base, not the archive's
     - the source line stays silent until the fetch settles, then names the
       source it actually used
     - when the file can't be reached the page still renders, on archive
       values, and says so

   The page's script is appended to site.js's source and run the way the
   browser runs it, so this exercises the real paint path.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const html = fs.readFileSync(path.join(dir, "champion.html"), "utf8");

/* The mode's Lee Sin and Garen, trimmed to what the reader touches. Lee Sin
   is the energy case, Garen the manaless one. */
const BINS = {
  leesin: {"Characters/Jade_LeeSin/CharacterRecords/Root": {
    baseHPModifiable: {baseValue: 513}, hpPerLevelModifiable: {baseValue: 85},
    baseStaticHPRegenModifiable: {baseValue: 1.39},
    hpRegenPerLevelModifiable: {baseValue: 0.14},
    baseDamageModifiable: {baseValue: 59}, damagePerLevelModifiable: {baseValue: 3.2},
    baseArmorModifiable: {baseValue: 23.7}, armorPerLevelModifiable: {baseValue: 3.7},
    baseMR: {baseValue: 31.25}, mrPerLevel: {baseValue: 1.25},
    baseMoveSpeedModifiable: {baseValue: 350}, attackRangeModifiable: {baseValue: 125},
    primaryAbilityResource: {arType: 1,
      "{726ee5cd}": {baseValue: 200}, "{c4ab3550}": {baseValue: 10}}}},

  /* A record with holes. The mode has shipped complete records so far, but
     a missing field must drop its row rather than print an empty one -- a
     stat line reading "Move speed" with nothing after it looks like the page
     broke, and is the shape a future field rename would take. */
  sparse: {"Characters/Jade_Sparse/CharacterRecords/Root": {
    baseHPModifiable: {baseValue: 500},
    baseDamageModifiable: {baseValue: 55}, damagePerLevelModifiable: {baseValue: 3},
    baseArmorModifiable: {baseValue: 20}, armorPerLevelModifiable: {baseValue: 3},
    baseMR: {baseValue: 30},
    primaryAbilityResource: {arType: 0, "{726ee5cd}": {baseValue: 300}}}},

  /* Gangplank's real shape, and the reason statValue() falls back per field
     rather than per record: he is the only champion of the 72 whose record
     has no baseStaticHPRegenModifiable, while hpRegenPerLevelModifiable is
     present and matches the archive's 0.75 per 5s exactly. */
  gangplank: {"Characters/Jade_Gangplank/CharacterRecords/Root": {
    baseHPModifiable: {baseValue: 576}, hpPerLevelModifiable: {baseValue: 81},
    hpRegenPerLevelModifiable: {baseValue: 0.15},
    baseDamageModifiable: {baseValue: 57}, damagePerLevelModifiable: {baseValue: 3},
    baseArmorModifiable: {baseValue: 23.8}, armorPerLevelModifiable: {baseValue: 3.3},
    baseMR: {baseValue: 31.25}, mrPerLevel: {baseValue: 1.25},
    baseMoveSpeedModifiable: {baseValue: 345}, attackRangeModifiable: {baseValue: 125},
    primaryAbilityResource: {arType: 0,
      "{726ee5cd}": {baseValue: 255}, "{6216bf7b}": {baseValue: 40},
      "{c4ab3550}": {baseValue: 1.44}, "{3a509002}": {baseValue: 0.14}}}},

  garen: {"Characters/Jade_Garen/CharacterRecords/Root": {
    baseHPModifiable: {baseValue: 551}, hpPerLevelModifiable: {baseValue: 96},
    baseStaticHPRegenModifiable: {baseValue: 1.8},
    hpRegenPerLevelModifiable: {baseValue: 0.15},
    baseDamageModifiable: {baseValue: 60}, damagePerLevelModifiable: {baseValue: 3.5},
    baseArmorModifiable: {baseValue: 25.7}, armorPerLevelModifiable: {baseValue: 3},
    baseMR: {baseValue: 31.25}, mrPerLevel: {baseValue: 1.25},
    baseMoveSpeedModifiable: {baseValue: 345}, attackRangeModifiable: {baseValue: 125},
    primaryAbilityResource: {
      "{726ee5cd}": {baseValue: 0}, "{c4ab3550}": {baseValue: 0}}}}
};

/* Data Dragon 3.13.24, i.e. what the page used to show. Deliberately the
   real archive figures: the test that the mode's numbers won is worthless
   if the two sources agree. */
const DD = {
  LeeSin: {id: "LeeSin", key: "64", name: "Lee Sin", title: "the Blind Monk",
    tags: ["Fighter"], info: {attack: 8, magic: 3, defense: 5, difficulty: 7},
    stats: {hp: 428, hpperlevel: 85, mp: 200, mpperlevel: 0, hpregen: 6.25,
      hpregenperlevel: 0.7, mpregen: 50, mpregenperlevel: 0, armor: 16,
      armorperlevel: 3.7, spellblock: 30, spellblockperlevel: 1.25,
      attackdamage: 55.8, attackdamageperlevel: 3.2, movespeed: 350, attackrange: 125},
    passive: {name: "Flurry", image: {full: "p.png"}, description: "d"},
    spells: [1,2,3,4].map(i => ({id: "s"+i, name: "s"+i, image: {full: "s.png"},
      description: "d", tooltip: "t", cooldownBurn: "1", costBurn: "1",
      rangeBurn: "1", effectBurn: [], vars: []}))},
  Garen: {id: "Garen", key: "86", name: "Garen", title: "the Might of Demacia",
    tags: ["Fighter"], info: {attack: 7, magic: 1, defense: 7, difficulty: 3},
    stats: {hp: 455, hpperlevel: 96, mp: 0, mpperlevel: 0, hpregen: 7,
      hpregenperlevel: 0.5, mpregen: 0, mpregenperlevel: 0, armor: 19,
      armorperlevel: 2.7, spellblock: 30, spellblockperlevel: 1.25,
      attackdamage: 52, attackdamageperlevel: 3.5, movespeed: 345, attackrange: 125},
    passive: {name: "Perseverance", image: {full: "p.png"}, description: "d"},
    spells: [1,2,3,4].map(i => ({id: "s"+i, name: "s"+i, image: {full: "s.png"},
      description: "d", tooltip: "t", cooldownBurn: "1", costBurn: "1",
      rangeBurn: "1", effectBurn: [], vars: []}))}
};

DD.Gangplank = {id: "Gangplank", key: "41", name: "Gangplank", title: "the Saltwater Scourge",
  tags: ["Fighter"], info: {attack: 8, magic: 4, defense: 5, difficulty: 3},
  stats: {hp: 495, hpperlevel: 81, mp: 215, mpperlevel: 40, hpregen: 4.25,
    hpregenperlevel: 0.75, mpregen: 6.5, mpregenperlevel: 0.7, armor: 16.5,
    armorperlevel: 3.3, spellblock: 30, spellblockperlevel: 1.25,
    attackdamage: 54, attackdamageperlevel: 3, movespeed: 345, attackrange: 125},
  passive: {name: "Grog-Soaked Blade", image: {full: "p.png"}, description: "d"},
  spells: [1,2,3,4].map(i => ({id: "s"+i, name: "s"+i, image: {full: "s.png"},
    description: "d", tooltip: "t", cooldownBurn: "1", costBurn: "1",
    rangeBurn: "1", effectBurn: [], vars: []}))};

DD.Sparse = {id: "Sparse", key: "99", name: "Sparse", title: "the Incomplete",
  tags: ["Mage"], info: {attack: 5, magic: 5, defense: 5, difficulty: 5},
  stats: {hp: 400, hpperlevel: 80, mp: 300, mpperlevel: 50, hpregen: 5,
    hpregenperlevel: 0.5, mpregen: 7, mpregenperlevel: 0.5, armor: 15,
    armorperlevel: 3, spellblock: 30, spellblockperlevel: 0,
    attackdamage: 50, attackdamageperlevel: 3, movespeed: 335, attackrange: 550},
  passive: {name: "P", image: {full: "p.png"}, description: "d"},
  spells: [1,2,3,4].map(i => ({id: "s"+i, name: "s"+i, image: {full: "s.png"},
    description: "d", tooltip: "t", cooldownBurn: "1", costBurn: "1",
    rangeBurn: "1", effectBurn: [], vars: []}))};

const SUMMARY = [
  {id: 60064, name: "Lee Sin", alias: "Jade_LeeSin"},
  {id: 60086, name: "Garen",   alias: "Jade_Garen"},
  {id: 60099, name: "Sparse",  alias: "Jade_Sparse"},
  {id: 60041, name: "Gangplank", alias: "Jade_Gangplank"}
];

/* ---- environment ---- */
class El {
  constructor(tagName){ this.tagName = tagName || "div"; this._html = ""; this.attrs = {};
    this.children = []; this.dataset = {}; this.textContent = ""; this.value = "";
    this.hidden = false; this.disabled = false;
    this.style = {setProperty(){}, removeProperty(){}};
    this.classList = {add(){}, remove(){}, toggle(){}, contains: () => false}; }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html = String(v); }
  get outerHTML(){ return this._html; } set outerHTML(v){ this._html = String(v); }
  get className(){ return ""; } set className(v){}
  setAttribute(k, v){ this.attrs[k] = String(v); }
  getAttribute(k){ return this.attrs[k] ?? null; }
  removeAttribute(){} appendChild(c){ this.children.push(c); return c; }
  replaceWith(){} remove(){} focus(){} blur(){} click(){}
  addEventListener(type, fn){ (this._on ||= {})[type] = fn; }
  removeEventListener(){} prepend(){} append(){} insertAdjacentHTML(){}
  insertAdjacentElement(){} cloneNode(){ return new El(this.tagName); }
  querySelector(sel){ return global.__bySel ? global.__bySel(sel) : null; }
  querySelectorAll(){ return []; } closest(){ return null; } matches(){ return false; }
  getBoundingClientRect(){ return {top:0,left:0,width:0,height:0,bottom:0,right:0}; }
  scrollIntoView(){}
  /* The page fires the slider's own input handler; this is how the test
     moves the level without a real event loop. */
  __fire(type, ev){ const fn = this._on && this._on[type]; if(fn) fn(ev || {target: this}); }
}
const byId = new Map();
/* The stat rows and the source line are written into ids that only exist
   inside a template literal, so the id sweep has to see the whole file. */
for(const m of html.matchAll(/id="([\w-]+)"/g)) byId.set(m[1], new El());
const bySel = sel => {
  const m = /^#([\w-]+)$/.exec(String(sel).trim());
  return m ? (byId.get(m[1]) || null) : null;
};
global.__bySel = bySel;
global.document = {
  getElementById: id => byId.get(id) || (byId.set(id, new El()), byId.get(id)),
  querySelector: bySel, querySelectorAll: () => [],
  createElement: t => new El(t), createElementNS: (n, t) => new El(t),
  addEventListener(){}, removeEventListener(){},
  body: new El("body"), documentElement: new El("html"),
  activeElement: null, title: "", readyState: "complete"
};
global.window = global; global.self = global;
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

let world = {champ: "LeeSin", stats: "ok"};
global.location = {href: "file:///champion.html?c=LeeSin", search: "?c=LeeSin",
  hash: "", protocol: "file:"};

const json = body => ({ok: true, status: 200, json: async () => body});
global.fetch = async url => {
  const u = String(url);
  if(/champion-summary\.json/.test(u)) return json(SUMMARY);
  const bin = /\/characters\/jade_([a-z0-9]+)\//.exec(u);
  if(bin){
    if(world.stats === "down") throw new Error("offline");
    if(world.stats === "404")  return {ok: false, status: 404, json: async () => null};
    return json(BINS[bin[1]] || null);
  }
  const per = /ddragon.*champion\/(\w+)\.json/.exec(u);
  if(per) return json({data: {[per[1]]: DD[per[1]]}});
  if(/versions\.json/.test(u)) return json(["16.19.1"]);
  /* The mode's kit, skins and item table: not what this harness is about,
     so they answer emptily rather than being stubbed in detail. */
  if(/\/v1\/champions\/\d+\.json/.test(u)) throw new Error("not under test");
  if(/\/v1\/items\.json/.test(u))          throw new Error("not under test");
  if(/\/v1\/summoner-spells\.json/.test(u)) throw new Error("not under test");
  if(/supabase|rest\/v1|auth\/v1/.test(u)) throw new Error("not under test");
  throw new Error("unexpected fetch: " + u);
};

global.__byId = id => byId.get(id);
global.__setWorld = h => { world = {...world, ...h};
  global.location.search = "?c=" + world.champ;
  global.location.href = "file:///champion.html?c=" + world.champ; };
/* Clears storage and the rendered DOM. CLASSIC's own caches can't be
   reached from out here — it's a const inside the eval'd scope — so the
   checks drop those themselves; see fresh() below. */
global.__reset = () => {
  mem.clear();
  for(const el of byId.values()){ el._html = ""; el.textContent = ""; }
};

let src = fs.readFileSync(path.join(dir, "site.js"), "utf8");
/* The page leans on these for the guides card and the patch stamp. Loaded
   for the same reason home-check loads them: without them the page's own
   script throws before it reaches the stats. */
for(const f of ["config.js", "guide-sanitise.js", "guide-store.js", "guide-load.js"]){
  const p = path.join(dir, f);
  if(fs.existsSync(p)) src += "\n;" + fs.readFileSync(p, "utf8") + "\n";
}
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) src += m[1] + "\n;\n";

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
  /* A fresh page load. The in-memory stat cache has to go with the session
     storage: left populated, the unreachable-file cases got Lee Sin's real
     stats handed back out of memory and the fallback looked broken when it
     was the harness holding the answer. */
  /* _bins too — see the note in champstats-check: the stat block is read
     out of a cached character record, and a stale one survives __reset. */
  const fresh = () => { __reset(); CLASSIC._stats = null; CLASSIC._roster = null;
                        CLASSIC._bins = null; };
  const rows = () => __byId("statList").innerHTML;
  const srcLine = () => __byId("statSrc").textContent;
  /* One stat row's value, by its label. */
  const row = label => {
    const re = new RegExp("<span>" + label + "(?:\\\\s*<em>[^<]*</em>)?</span><b>([^<]*)");
    const m = re.exec(rows());
    return m ? m[1] : null;
  };

  /* ---------- Lee Sin: energy, and the mode's numbers ---------- */
  __setWorld({champ: "LeeSin", stats: "ok"});
  C = (await DD_CHAMP_FOR_TEST("LeeSin"));
  level = 1; CSTATS = null; statsResolved = false;
  paint(document.getElementById("main"));
  check("before the stat file answers, the source line says nothing",
    () => srcLine() === "");
  check("the page paints on archive values in the meantime",
    () => row("Health") === "428");

  await loadClassicStats();
  check("the mode's health replaces the archive's: 513, not 428",
    () => row("Health") === "513");
  check("the mode's attack damage replaces the archive's: 59, not 55.8",
    () => row("Attack damage") === "59");
  check("the mode's armour replaces the archive's: 23.7, not 16",
    () => row("Armor") === "23.7");
  check("the source line now names the mode's files",
    () => /mode's own game files/.test(srcLine()));
  check("an energy champion's row is labelled Energy, not Resource",
    () => /<span>Energy/.test(rows()) && !/<span>Resource/.test(rows()));
  check("energy is 200 with no growth shown",
    () => row("Energy") === "200");

  /* The level slider has to scale from the mode's base. Scaling from the
     archive's while displaying the mode's would be right at level 1 and
     wrong at every other level -- the kind of bug nobody reads off a page. */
  level = 18; paintStats();
  check("level 18 health is the mode's base plus 17 growths (513 + 17x85 = 1958)",
    () => row("Health") === "1958");
  check("level 18 armour scales from the mode's base too (23.7 + 17x3.7 = 86.6)",
    () => Math.abs(parseFloat(row("Armor")) - 86.6) < 0.05);
  level = 1; paintStats();

  /* ---------- Garen: no resource at all ---------- */
  fresh(); __setWorld({champ: "Garen", stats: "ok"});
  C = (await DD_CHAMP_FOR_TEST("Garen"));
  level = 1; CSTATS = null; statsResolved = false;
  paint(document.getElementById("main"));
  await loadClassicStats();
  check("Garen's health comes from the mode: 551, not 455",
    () => row("Health") === "551");
  check("a manaless champion gets no resource row at all",
    () => !/<span>Resource/.test(rows()) && !/<span>Energy/.test(rows()));
  check("and no resource regen row either",
    () => (rows().match(/regen/gi) || []).length === 1);
  check("his health regen row survives",
    () => row("Health regen") === "9");

  /* ---------- paint() has to start the load itself ----------
     Every check above calls loadClassicStats() by hand, so all of them stay
     green if paint() forgets to. That is exactly the shape of the inRoster
     bug: a correct function nobody called correctly. */
  fresh(); __setWorld({champ: "LeeSin", stats: "ok"});
  C = (await DD_CHAMP_FOR_TEST("LeeSin"));
  level = 1; CSTATS = null; statsResolved = false;
  paint(document.getElementById("main"));
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  check("paint() loads the mode's stats without being asked",
    () => CSTATS !== null && row("Health") === "513");

  /* ---------- a record with missing fields ---------- */
  fresh(); __setWorld({champ: "Sparse", stats: "ok"});
  C = (await DD_CHAMP_FOR_TEST("Sparse"));
  level = 1; CSTATS = null; statsResolved = false;
  paint(document.getElementById("main"));
  await loadClassicStats();
  check("a field the mode's record omits falls back to the archive's value",
    () => row("Move speed") === "335" && row("Attack range") === "550");
  check("the rows the mode does carry are still the mode's",
    () => row("Health") === "500" && row("Armor") === "20");
  /* The pairing rule, made observable: the mode has the health BASE (500)
     and not its growth, and the archive's growth (80) is a figure the mode
     never states. Correct is 500 + 17x80 = 1860. Taking the growth from
     "whichever object is on show" instead drops it and gives 500 -- a
     number from nowhere that looks like a stat. */
  check("a mode base with an archive growth still scales (500 + 17x80 = 1860)",
    () => { level = 18; paintStats(); const v = row("Health");
            level = 1; paintStats(); return v === "1860"; });
  check("the source line names the rows that fell back",
    () => /mode's own game files, except/.test(srcLine()) &&
          /move speed/.test(srcLine()) && /attack range/.test(srcLine()));
  console.log("      source line: " + srcLine());
  check("and doesn't list a row that came from the mode",
    () => { const ex = (srcLine().split("except")[1] || "").split(", which")[0];
            return !/\barmor\b/.test(ex) && !/\bhealth,/.test(ex); });

  /* ---------- Gangplank: base absent, growth present ---------- */
  fresh(); __setWorld({champ: "Gangplank", stats: "ok"});
  C = (await DD_CHAMP_FOR_TEST("Gangplank"));
  level = 1; CSTATS = null; statsResolved = false;
  paint(document.getElementById("main"));
  await loadClassicStats();
  check("Gangplank's health regen row survives on the archive's base",
    () => row("Health regen") === "4.25");
  /* The growth has to come from the same source as the base it is added to.
     Pairing the archive's 4.25 with the mode's 0.75 is the same number here,
     but the rule is what keeps a future mismatch from inventing a figure. */
  check("and it scales by the archive's growth, not a mix (4.25 + 17x0.75 = 17)",
    () => { level = 18; paintStats(); const v = row("Health regen");
            level = 1; paintStats(); return v === "17"; });
  check("his health and attack damage are still the mode's, not the archive's",
    () => row("Health") === "576" && row("Attack damage") === "57");
  check("the source line singles out health regen only",
    () => /except health regen, which/.test(srcLine()));

  /* ---------- the file unreachable ---------- */
  for(const how of ["down", "404"]){
    fresh(); __setWorld({champ: "LeeSin", stats: how});
    C = (await DD_CHAMP_FOR_TEST("LeeSin"));
    level = 1; CSTATS = null; statsResolved = false;
    paint(document.getElementById("main"));
    await loadClassicStats();
    check("with the stat file " + how + ", the page still renders archive values",
      () => row("Health") === "428");
    check("with the stat file " + how + ", the page says it's the archive",
      () => /Season 3 archive/.test(srcLine()));
    check("with the stat file " + how + ", Lee Sin keeps a resource row",
      () => /<span>Resource/.test(rows()));
  }

  console.log(failed ? "\\n" + failed + " FAILED" : "\\nthe champion page holds up");
  process.exit(failed ? 1 : 0);
})();

/* The page normally fetches this inside boot(); the checks need it without
   boot's other work, so it is reached the same way boot does. */
async function DD_CHAMP_FOR_TEST(id){
  const res = await DD.champion(id);
  return res.data[Object.keys(res.data)[0]];
}
`;

(0, eval)(src);
