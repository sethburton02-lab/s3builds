/* ============================================================
   Item detail page check

       node tools/item-check.js <site-dir>

   The detail page's recipe tree is recursive and draws its own connector
   lines, which is the kind of thing that is either right or spectacularly
   wrong and boots identically either way. stub-check can't tell the
   difference because the page's boot is a network call that fails under
   file:// conditions, so paint() never runs at all.

   The DOM stub is the one from items-check.js. Kept as a copy rather than
   a shared module because these harnesses are read as much as they are
   run, and a reader following a failure should not have to open a second
   file to find out what `El` is.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const html = fs.readFileSync(path.join(dir, "item.html"), "utf8");

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
global.location = {href:"file:///item.html", search:"?i=3153", hash:"", protocol:"file:",
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
  /* split("?") drops the ?v= cache-buster; it belongs to the URL, not
     to the filename on disk. See tools/bump-version.py. */
  src += fs.readFileSync(path.join(dir, m[1].split("?")[0]), "utf8") + "\n;\n";
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

  /* Blade of the Ruined King, as the shop actually builds it: three
     components, one of which has components of its own that go two more
     levels down. The screenshot this was built from is exactly this tree. */
  const SHOP = {
    "3153":{name:"Blade of the Ruined King",total:3200,combine:400,from:["1043","3144","1043"]},
    "3144":{name:"Bilgewater Cutlass",      total:1400,combine:150,from:["1043","1053"]},
    "1053":{name:"Vampiric Scepter",        total:800, combine:0,  from:["1043"]},
    "1043":{name:"Recurve Bow",             total:400, combine:0,  from:[]}
  };
  BY_ID = new Map(Object.entries(SHOP).map(([id,v]) =>
    [id,{id,icon:id+".png",inStore:true,tags:[],descHtml:"",blurb:"",sell:null,to:[],...v}]));
  ITEM_BY_ID = BY_ID;
  IT = BY_ID.get("3153");
  SOURCE = "classic";

  const tree = () => recipeTree("3153");

  console.log("the recipe tree:");
  check("roots on the item itself",  () => tree().includes("3153.png"));
  check("draws its components",      () => tree().includes("3144.png"));
  /* One level deep was the old behaviour and the whole reason for this. */
  check("recurses past one level",   () => tree().includes("1053.png"));
  check("  and past two",            () => (tree().match(/1043\\.png/g) || []).length >= 4);
  check("keeps duplicate components", () =>
    (tree().match(/i=1043/g) || []).length >= 3);
  check("shows each node's total",   () => tree().includes(">3200g<") && tree().includes(">1400g<")
                                        && tree().includes(">800g<") && tree().includes(">400g<"));
  check("nests a child list",        () => /<li>[\\s\\S]*<ul>[\\s\\S]*<li>/.test(tree()));
  check("every node links onward",   () => tree().includes("item.html?i=3144"));
  check("every node carries a tip",  () => tree().includes('data-tip-item="3144"'));

  console.log("\\nbad data:");
  check("a cycle terminates", () => {
    BY_ID.get("1043").from = ["3153"];        /* basic requires the finished item */
    const h = recipeTree("3153");
    return h.length > 0 && h.length < 200000;
  });
  check("  and doesn't repeat forever", () =>
    (recipeTree("3153").match(/3153\\.png/g) || []).length < 12);
  check("depth is capped", () => {
    /* A chain longer than the cap: each item requires the next. */
    const deep = new Map();
    for(let i = 0; i < 12; i++)
      deep.set("d"+i, {id:"d"+i,icon:"d"+i+".png",total:i,from: i<11 ? ["d"+(i+1)] : [],
                       to:[],tags:[],inStore:true,name:"D"+i});
    BY_ID = deep; ITEM_BY_ID = deep;
    const drawn = (recipeTree("d0").match(/class="tnode"/g) || []).length;
    return drawn <= TREE_MAX_DEPTH + 1;
  });
  check("an unknown root draws nothing", () => recipeTree("nope") === '<div class="tree"><ul></ul></div>');

  console.log("\\nwhat the page claims:");
  /* paint() is the thing that makes claims, so these drive it rather than
     the tree builder. */
  const painted = it => { IT = it; paint(document.getElementById("main"));
                          return document.getElementById("main").innerHTML; };
  BY_ID = new Map(Object.entries(SHOP).map(([id,v]) =>
    [id,{id,icon:id+".png",inStore:true,tags:[],descHtml:"",blurb:"",sell:null,to:[],...v}]));
  ITEM_BY_ID = BY_ID;

  check("adds the parts up when it can", () => {
    const h = painted(BY_ID.get("3153"));
    /* 400 + 1400 + 400 components, 400 to combine, 3200 total. */
    return h.includes("Components cost 2200g, plus 400g to combine");
  });
  check("says so when a component is missing", () => {
    const h = painted({...BY_ID.get("3153"), from:["1043","3144","1043","9999"]});
    return h.includes("partial") && !h.includes("Components cost");
  });
  check("  and still states the total", () => {
    const h = painted({...BY_ID.get("3153"), from:["1043","9999"]});
    return h.includes("3200g in total");
  });
  check("a real standalone says standalone", () => {
    const h = painted({...BY_ID.get("1043"), from:[], to:[]});
    return h.includes("standalone item");
  });
  /* The bug: an item WITH a recipe whose parts are all filtered out used
     to be described as having no recipe at all. */
  check("an unshowable recipe is not called standalone", () => {
    const h = painted({...BY_ID.get("1043"), from:["9999"], to:[]});
    return !h.includes("standalone") && h.includes("has a recipe");
  });
  check("an empty blurb draws no line", () => {
    const h = painted({...BY_ID.get("1043"), blurb:"", from:[], to:[]});
    return !/font-size:12\\.5px"><\\/div>/.test(h);
  });
  check("builds-into links carry a tooltip", () => {
    const h = painted({...BY_ID.get("1043"), from:[], to:["3144"]});
    return h.includes('data-tip-item="3144"') && !h.includes('title="Bilgewater');
  });

  console.log("\\nthe shared index:");
  /* A lint, same as items-check: the checks above set ITEM_BY_ID
     themselves, so only reading the source can prove the page does. */
  check("the page fills it", () => /ITEM_BY_ID\\s*=\\s*byId/.test(PAGE_SRC));

  console.log(failed ? "\\n" + failed + " failure(s)" : "\\nthe item page holds up");
  if(failed) process.exitCode = 1;
})();
`;

global.PAGE_SRC = html;
(0, eval)(src);
