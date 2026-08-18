/* ============================================================
   Items page check

       node tools/items-check.js <site-dir>

   Same reason guide-render.js exists: stub-check proves the page boots,
   and this page's boot is a network call that fails under file:// test
   conditions, so every render function is skipped and a passing check
   means very little.

   Written after the item tooltips on this page turned out never to open:
   items.html kept loadItems()' map to itself, so the shared ITEM_BY_ID
   that itemTipHtml() reads stayed empty, the builder returned "", and
   showTip() declined without a sound. A tooltip that never appears looks
   exactly like a page that was never given one.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const html = fs.readFileSync(path.join(dir, "items.html"), "utf8");

class El {
  constructor(tag="div"){
    this.tagName = tag.toUpperCase(); this.children = []; this._html = "";
    this.style = {setProperty(){}}; this.dataset = {}; this.attrs = {};
    this.classList = {add(){}, remove(){}, toggle(){}, contains:()=>false};
    this.value = ""; this.textContent = ""; this.hidden = false; this.disabled = false;
  }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html = String(v); }
  get outerHTML(){ return this._html; } set outerHTML(v){ this._html = String(v); }
  get className(){ return ""; } set className(v){}
  setAttribute(k,v){ this.attrs[k]=String(v); } getAttribute(k){ return this.attrs[k] ?? null; }
  removeAttribute(){} appendChild(c){ this.children.push(c); return c; }
  replaceWith(){} remove(){} focus(){} select(){} blur(){} click(){}
  addEventListener(){} removeEventListener(){} prepend(){} append(){}
  insertAdjacentHTML(){} cloneNode(){ return new El(this.tagName); }
  querySelector(sel){ return global.__bySel ? global.__bySel(sel) : null; }
  querySelectorAll(){ return []; }
  closest(){ return null; } matches(){ return false; }
  getBoundingClientRect(){ return {top:0,left:0,width:0,height:0,bottom:0,right:0}; }
  scrollIntoView(){}
}
const byId = new Map();
for(const m of html.matchAll(/id="([\w-]+)"/g)) byId.set(m[1], new El());
const bySel = sel => {
  const m = /^#([\w-]+)$/.exec(String(sel).trim());
  return m ? (byId.get(m[1]) || null) : null;
};
global.__bySel = bySel;
global.document = {
  getElementById: id => byId.get(id) || (byId.set(id, new El()), byId.get(id)),
  querySelector: bySel, querySelectorAll: () => [],
  createElement: t => new El(t), createElementNS: (n,t) => new El(t),
  addEventListener(){}, removeEventListener(){},
  body: new El("body"), documentElement: new El("html"),
  activeElement: null, title: "", readyState: "complete"
};
global.window = global; global.self = global;
global.location = {href:"file:///items.html", search:"", hash:"", protocol:"file:",
                   replace(){}, assign(){}};
global.history = {replaceState(){}};
global.navigator = {userAgent:"stub"};
global.localStorage = {
  _d: new Map(),
  getItem(k){ return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k,v){ this._d.set(k,String(v)); }, removeItem(k){ this._d.delete(k); }
};
global.sessionStorage = global.localStorage;
global.fetch = () => Promise.reject(new Error("offline"));
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.matchMedia = () => ({matches:false, addListener(){}, addEventListener(){}});
global.innerWidth = 1600; global.innerHeight = 900; global.scrollY = 0;
global.structuredClone = v => JSON.parse(JSON.stringify(v));
global.Image = El; global.getComputedStyle = () => ({getPropertyValue:()=>""});
global.btoa = s => Buffer.from(s,"binary").toString("base64");
global.atob = s => Buffer.from(s,"base64").toString("binary");

let src = "";
for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))
  src += fs.readFileSync(path.join(dir, m[1]), "utf8") + "\n;\n";
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) src += m[1] + "\n;\n";
for(const m of src.matchAll(/id="([\w-]+)"/g)) if(!byId.has(m[1])) byId.set(m[1], new El());

src += `
;(function(){
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

  /* A finished item, its three components, and one component that feeds
     more things than a card should ever draw. */
  const FEEDS = ["3020","3006","3009","3047","3111","3117"];
  ITEM_BY_ID = new Map([
    ["3089",{id:"3089",name:"Rabadon's Deathcap",total:3300,combine:800,icon:"cap.png",
             descHtml:"<b>+120</b> ability power",inStore:true,tags:["SpellDamage"],
             from:["1058","1058","1052"],to:[]}],
    ["1058",{id:"1058",name:"Needlessly Large Rod",total:1600,icon:"rod.png",
             descHtml:"<b>+60</b> ability power",inStore:true,tags:["SpellDamage"],
             from:[],to:["3089"]}],
    ["1052",{id:"1052",name:"Amplifying Tome",total:435,icon:"tome.png",
             descHtml:"<b>+20</b> ability power",inStore:true,tags:["SpellDamage"],
             from:[],to:["3089"]}],
    ["1001",{id:"1001",name:"Boots of Speed",total:325,icon:"boots.png",
             descHtml:"<b>+25</b> movement speed",inStore:true,tags:["Boots"],
             from:[],to:FEEDS}],
    ...FEEDS.map((id,i) => [id,{id,name:"Upgrade "+i,total:1000+i,icon:"u"+i+".png",
             inStore:true,tags:["Boots"],from:["1001"],to:[]}])
  ]);
  const cap = () => card(ITEM_BY_ID.get("3089"));

  console.log("the shop card:");
  check("names the item",        () => cap().includes("Rabadon&#39;s Deathcap"));
  check("prices it",             () => cap().includes("3300g"));
  check("links to the detail page", () => cap().includes("item.html?i=3089"));

  console.log("\\nthe recipe strip:");
  check("draws the components",  () => cap().includes("rod.png") && cap().includes("tome.png"));
  /* Two Needlessly Large Rods, not one — a recipe that silently collapsed
     duplicates would price wrong in a reader's head. */
  check("keeps duplicates",      () => (cap().match(/rod\\.png/g) || []).length === 2);
  check("joins them with a plus", () => cap().includes("<i>+</i>"));
  check("says so for a screen reader", () => cap().includes("Builds from"));
  check("a component has no strip", () =>
    !card(ITEM_BY_ID.get("1058")).includes("class=\\"recipe\\""));
  check("is capped",             () => {
    /* A five-component recipe can't exist in the shop, but the cap is what
       stops a bad data row from stretching the card. */
    const wide = {id:"x",name:"Wide",total:1,icon:"x.png",inStore:true,tags:[],
                  from:["1058","1052","1001","3006","3009"],to:[]};
    const h = card(wide);
    return (h.match(/class="ri"/g) || []).length === RECIPE_CAP && h.includes("+1");
  });
  check("unknown components are dropped", () =>
    !card({id:"y",name:"Y",total:1,icon:"y.png",inStore:true,tags:[],
           from:["nope","nah"],to:[]}).includes("class=\\"recipe\\""));

  console.log("\\nthe tooltip:");
  /* A lint, not a behaviour check, and worth being honest about: the
     checks below set ITEM_BY_ID themselves, so they pass whether or not
     the page ever fills it. Deleting the assignment was the actual bug and
     they sailed straight past it. Booting for real would need the network
     the harness deliberately doesn't have, so this reads the source. */
  check("the page fills the shared index", () =>
    /ITEM_BY_ID\\s*=\\s*byId/.test(PAGE_SRC));
  check("cards carry the hook",  () => cap().includes('data-tip-item="3089"'));
  check("no title to fight it",  () => !cap().includes("title="));
  /* This is the one that was broken: the builder reads the shared index,
     which this page has to fill from what loadItems() hands back. */
  check("the builder resolves an item", () => itemTipHtml("3089").includes("3300g"));
  check("  and shows the shop text",    () => itemTipHtml("3089").includes("ability power"));
  check("  and the build path",         () => itemTipHtml("3089").includes("Builds from"));
  check("  and what it builds into",    () => itemTipHtml("1001").includes("Builds into"));
  check("items are registered",         () =>
    TIP_KINDS.some(k => k.selector === "[data-tip-item]"));

  console.log("\\nfilters:");
  ALL = [...ITEM_BY_ID.values()];
  ALL.forEach(it => it.tier = itemTier(it));
  STAT_FILTERS = [["SpellDamage","Ability power"],["Boots","Boots"]];
  check("an item with no description doesn't break the grid", () => basePool().length > 0);
  check("search matches a name", () => {
    query = "deathcap";
    return basePool().length === 1;
  });
  check("search reads the stat text", () => {
    query = "movement";
    return basePool().some(it => it.name === "Boots of Speed");
  });
  check("a stat filter narrows", () => {
    query = ""; sel = new Set(["SpellDamage"]);
    return basePool().filter(it => matchesStats(it)).length === 3;
  });
  check("match-all needs both",  () => {
    sel = new Set(["SpellDamage","Boots"]); match = "all";
    return basePool().filter(it => matchesStats(it)).length === 0;
  });
  check("match-any takes either", () => {
    match = "any";
    return basePool().filter(it => matchesStats(it)).length > 3;
  });

  console.log(failed ? "\\n" + failed + " failure(s)" : "\\nthe items page holds up");
  if(failed) process.exitCode = 1;
})();
`;

global.PAGE_SRC = html;
(0, eval)(src);
