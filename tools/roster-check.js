/* ============================================================
   Roster check

       node tools/roster-check.js <site-dir>

   The site used to decide which champions exist from a list typed into
   site.js. That list was right when it was written and then quietly wasn't:
   the mode shipped nine champions it never heard about, and nothing failed.
   No error, no empty page, no broken image — the champions were simply
   absent, and the only way to notice was to go looking.

   That is the specific failure this harness exists for. A roster bug does
   not announce itself, so the test has to.

   Everything here runs against site.js's real loadChampions(), with both
   catalogues stubbed, so it exercises the actual join rather than a
   description of it.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";

/* ---- the two catalogues, as the real ones are shaped ----
   Deliberately includes the three joins that have historically disagreed:
   Wukong, whose archive id is MonkeyKing; Nunu, whom the mode renamed to
   "Nunu & Willump"; and Fiddlesticks, whose archive id capitalises the S. */
const DD_CHAMPS = {data: {
  Ashe:         {id: "Ashe",         key: "22",  name: "Ashe",         tags: ["Marksman"]},
  MonkeyKing:   {id: "MonkeyKing",   key: "62",  name: "Wukong",       tags: ["Fighter"]},
  Nunu:         {id: "Nunu",         key: "20",  name: "Nunu",         tags: ["Tank"]},
  FiddleSticks: {id: "FiddleSticks", key: "9",   name: "Fiddlesticks", tags: ["Mage"]},
  Shyvana:      {id: "Shyvana",      key: "102", name: "Shyvana",      tags: ["Fighter"]},
  Viktor:       {id: "Viktor",       key: "112", name: "Viktor",       tags: ["Mage"]}
}};
/* Shyvana is in the mode and was missing from the hand-written list.
   Viktor is in the 2013 archive and NOT in the mode — the case that proves
   the filter still filters. */
const SUMMARY = [
  {id: 60022, name: "Ashe",            alias: "Jade_Ashe"},
  {id: 60062, name: "Wukong",          alias: "Jade_Wukong"},
  {id: 60020, name: "Nunu & Willump",  alias: "Jade_Nunu"},
  {id: 60009, name: "Fiddlesticks",    alias: "Jade_Fiddlesticks"},
  {id: 60102, name: "Shyvana",         alias: "Jade_Shyvana"},
  {id: 1,     name: "Teemo",           alias: "Teemo"}   /* not a Jade row */
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

/* What the network does this run. Set per test. */
let world = {};
const json = body => ({ok:true, status:200, json: async () => body});
global.fetch = async url => {
  const u = String(url);
  if(/champion-summary\.json/.test(u)){
    if(world.catalogue === "down")  throw new Error("offline");
    if(world.catalogue === "404")   return {ok:false, status:404, json: async()=>null};
    if(world.catalogue === "empty") return json([]);
    return json(SUMMARY);
  }
  if(/\/champion\.json/.test(u)) return json(DD_CHAMPS);
  /* champSpells asks the mode for a champion's kit and skins. */
  if(/\/v1\/champions\/\d+\.json/.test(u)){
    if(world.classicKit === "down") throw new Error("offline");
    return json({
      passive: {name:"P", abilityIconPath:"/x.png", description:""},
      spells: ["q","w","e","r"].map(k => ({spellKey:k, name:k.toUpperCase(),
        abilityIconPath:"/x.png", description:"", dynamicDescription:"",
        cost:[0], cooldown:[0], range:[0], coefficients:{}})),
      skins: [{id: 60104000, isBase:true, name:"Base",
               uncenteredSplashPath:"/lol-game-data/assets/ASSETS/Characters/X/splash.jpg"}]
    });
  }
  /* And Data Dragon, for when the mode's file is unreachable. */
  const perChamp = /ddragon.*champion\/(\w+)\.json/.exec(u);
  if(perChamp){
    /* Keyed by the champion actually asked for: the caller reads
       .data[champ.id], so a fixed key silently yields undefined. */
    const id = perChamp[1];
    return json({data: {[id]: {id, key:"1", name:id,
      passive:{name:"p", image:{full:"p.png"}, description:""},
      spells: [1,2,3,4].map(i=>({id:"s"+i, name:"s"+i, image:{full:"s.png"},
        description:"", tooltip:"", cooldownBurn:"1", costBurn:"1",
        rangeBurn:"1", effectBurn:[], vars:[]}))}}});
  }
  if(/versions\.json/.test(u))   return json(["16.19.1"]);
  throw new Error("unexpected fetch: " + u);
};

/* The stub data and the network switch have to survive into the appended
   source below, which runs through indirect eval and therefore sees only
   globals. Same reason home-check.js hands its store over this way. */
global.__setWorld = how => { world = how; };
global.__memClear = () => mem.clear();
global.__DD = DD_CHAMPS;
global.__SUMMARY = SUMMARY;

/* site.js is a script, not a module, and its `let` bindings do not escape
   an indirect eval — so the checks are appended to its source rather than
   run beside it. CHAMPIONS, loadChampions and isExcludedItem are only
   reachable from inside. */
let src = fs.readFileSync(path.join(dir, "site.js"), "utf8");

src += `
;(async function(){
  let failed = 0;
  const check = (label, fn) => {
    try{
      const out = fn();
      if(out === false){ console.log("FAIL  " + label); failed++; }
      else console.log("ok    " + label);
    }catch(e){
      console.log("FAIL  " + label + "\\n        " + e.name + ": " + e.message);
      failed++;
    }
  };
  const acheck = async (label, fn) => {
    try{
      const out = await fn();
      if(out === false){ console.log("FAIL  " + label); failed++; }
      else console.log("ok    " + label);
    }catch(e){
      console.log("FAIL  " + label + "\\n        " + e.name + ": " + e.message);
      failed++;
    }
  };

/* Every test needs a roster built from scratch, and both caches are sticky
   on purpose in the browser. */
const fresh = async how => {
  __setWorld(how);
  CHAMPIONS.length = 0;      /* the roster caches on purpose in a browser */
  CLASSIC._roster = null;
  __memClear();              /* and so does sessionStorage */
  _champSpells.clear();      /* and kits are memoised per champion */
  return loadChampions();
};
const names = list => list.map(c => c.name).sort();

  console.log("with the mode's catalogue:");

  await acheck("the catalogue decides who is in", async () => {
    const r = await fresh({});
    return JSON.stringify(names(r)) ===
      JSON.stringify(["Ashe","Fiddlesticks","Nunu","Shyvana","Wukong"]);
  });

  /* The whole point. Shyvana is not in CLASSIC_ROSTER. */
  await acheck("  including one the built-in list never heard of", async () => {
    const r = await fresh({});
    return r.some(c => c.name === "Shyvana")
        && !CLASSIC_ROSTER.some(n => n === "Shyvana");
  });

  await acheck("  and a champion the mode does not have stays out", async () => {
    const r = await fresh({});
    return !r.some(c => c.name === "Viktor");
  });

  /* ---- the call shape, not just the function ----
     champions.html builds its own list with .filter(inRoster) rather than
     going through loadChampions(). Array.filter hands a callback THREE
     arguments, so a second parameter on inRoster silently receives the
     array index — which is how a working loadChampions() and a broken
     champions page coexisted, with every check in this file passing.
     These test the shape that page uses. */
  await acheck("inRoster works as a bare .filter() callback", async () => {
    await fresh({});
    const all = Object.values(__DD.data).filter(inRoster);
    return all.length === 5 && all.some(c => c.name === "Shyvana");
  });

  check("  and it takes exactly one argument, so .filter cannot confuse it", () =>
    inRoster.length === 1);

  await acheck("  the index .filter passes cannot be mistaken for a roster", async () => {
    await fresh({});
    /* Called the way .filter calls it, with an index and the array. */
    const shyvana = __DD.data.Shyvana;
    return inRoster(shyvana, 0, []) === true && inRoster(shyvana, 3, []) === true;
  });

  /* Three joins that break if you match on the name. */
  await acheck("Wukong survives, whose archive id is MonkeyKing", async () =>
    (await fresh({})).some(c => c.id === "MonkeyKing"));
  await acheck("Nunu survives, whom the mode calls Nunu & Willump", async () =>
    (await fresh({})).some(c => c.name === "Nunu"));
  await acheck("Fiddlesticks survives its capital S", async () =>
    (await fresh({})).some(c => c.id === "FiddleSticks"));

  /* Mutation guard. The three checks above only mean something if matching
     on the name would actually have broken them — so here is that match,
     run against the same two catalogues. Nunu is the one it loses, because
     the mode calls him "Nunu & Willump" and the archive calls him "Nunu". */
  check("  (a name match really would have dropped Nunu)", () => {
    const modeNames = new Set(__SUMMARY.filter(c => /^Jade_/.test(c.alias))
      .map(c => normKey(c.name)));
    const kept = Object.values(__DD.data).filter(c => modeNames.has(normKey(c.name)));
    return !kept.some(c => c.name === "Nunu") && kept.some(c => c.name === "Wukong");
  });

  console.log("\\nwhen the catalogue is unreachable:");

  const fallbackWorks = async how => {
    const r = await fresh(how);
    /* The built-in list has Ashe, Wukong, Nunu and Fiddlesticks in it and
       has never had Shyvana — so falling back is visible as her absence. */
    return r.some(c => c.name === "Ashe") && !r.some(c => c.name === "Shyvana");
  };

  await acheck("a refused connection falls back to the built-in list", () => fallbackWorks({catalogue:"down"}));
  await acheck("a 404 falls back too",                                 () => fallbackWorks({catalogue:"404"}));
  /* An empty catalogue is a broken answer, not a mode with no champions.
     Trusting it would empty the site, which is the one outcome worse than
     being nine champions out of date. */
  await acheck("an EMPTY catalogue falls back rather than emptying the site",
    () => fallbackWorks({catalogue:"empty"}));

  /* Removing the guard that rejects an empty catalogue changes nothing
     about WHO is on the roster — an empty set already falls through to the
     built-in list at the join. What it changes is that the empty answer
     gets written to sessionStorage, where it outlives the request that
     produced it and poisons every later page load in the session. That is
     the part worth asserting. */
  await acheck("  and the empty answer is never cached", async () => {
    await fresh({catalogue:"empty"});
    return sessionStorage.getItem("cd:classic-roster:v1") === null;
  });
  await acheck("  (a good catalogue IS cached, so that check can fail)", async () => {
    await fresh({});
    return sessionStorage.getItem("cd:classic-roster:v1") !== null;
  });

  await acheck("  and the site is never left with no champions at all", async () => {
    for(const how of [{catalogue:"down"},{catalogue:"404"},{catalogue:"empty"}])
      if((await fresh(how)).length === 0) return false;
    return true;
  });

  console.log("\\nsplash art from the wrong decade:");

  /* The mode ships post-rework Graves art under a period-correct portrait.
     There is no period painting anywhere in the files to swap in, so the
     splash is dropped and the hero uses its no-art state. */
  check("Graves gets no splash", () =>
    periodSplash("Graves", "https://cdn/jade_graves_splash.jpg") === null);
  check("  and everyone else keeps theirs", () =>
    periodSplash("Ashe", "https://cdn/jade_ashe_splash.jpg")
      === "https://cdn/jade_ashe_splash.jpg");
  check("  a champion with no art at all is null, not undefined", () =>
    periodSplash("Ashe", null) === null && periodSplash("Ashe", undefined) === null);

  /* A list of one, on purpose. If this grows without somebody having
     looked at the art, the comment above it is no longer true. */
  check("  the suppression list is exactly one champion", () =>
    NO_PERIOD_SPLASH.size === 1 && NO_PERIOD_SPLASH.has("Graves"));

  /* ---- the wiring, not just the filter ----
     periodSplash being correct means nothing if champSpells does not call
     it. A mutation that reverted the Classic-skin branch to its unfiltered
     form passed every check above, which is the same shape of miss as
     testing loadChampions while champions.html did its own filtering. */
  await acheck("loadChampSpells drops the splash for Graves", async () => {
    await fresh({});
    const doc = await loadChampSpells({id:"Graves", name:"Graves", key:"104"});
    return doc !== null && doc.splash === null;
  });

  await acheck("  and keeps it for everyone else", async () => {
    await fresh({});
    const doc = await loadChampSpells({id:"Ashe", name:"Ashe", key:"22"});
    return doc !== null && typeof doc.splash === "string" && doc.splash.length > 0;
  });

  /* The Data Dragon fallback builds its own splash URL from an endpoint
     that is not versioned, so it needs the same filter. */
  await acheck("  including down the Data Dragon fallback", async () => {
    await fresh({classicKit:"down"});
    const doc = await loadChampSpells({id:"Graves", name:"Graves", key:"104"});
    return doc !== null && doc.splash === null;
  });

  console.log("\\nchampion-locked items:");

  /* rosterNames() is the union, so a live catalogue can only ever reveal
     items, never hide them. */
  await acheck("an item locked to a champion in the mode is kept", async () => {
    await fresh({});
    return isExcludedItem("Dragonheart", "Shyvana") === false;
  });
  await acheck("  one locked to a champion outside it is dropped", async () => {
    await fresh({});
    return isExcludedItem("Hex Core", "Viktor") === true;
  });
  await acheck("  and with no catalogue the built-in names still answer", async () => {
    await fresh({catalogue:"down"});
    return isExcludedItem("Frozen Mallet", "Ashe") === false;
  });

  console.log(failed ? "\\n" + failed + " failure(s)" : "\\nthe roster holds up");
  if(failed) process.exitCode = 1;
})();
`;

(0, eval)(src);
