/* ============================================================
   Home page check

       node tools/home-check.js <site-dir>

   The home page is now a filtered view over the published store, and every
   interesting state of it is one a visitor reaches by clicking — an empty
   site, a search that matches nothing, a role tab with no guides under it.
   stub-check.js only proves the page boots, which for a page whose first
   paint is the empty state proves almost nothing.

   So this seeds a store, boots the page against it, and then drives the
   real event handlers with synthetic clicks rather than poking `q` by hand.
   The handlers are where the fiddly parts live: the tag pill that toggles
   off when you click it twice, and the page-size reset that stops a "show
   them all" from carrying into the next filter.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");

/* ---- what's been published ---- */
const now = Date.now();
const DAY = 86400000;
const STORE = {
  "ap-kogmaw": {slug:"ap-kogmaw", title:"AP Kog'Maw — artillery mid", blurb:"Range is the plan.",
                champ:"Kog'Maw", role:"Mid", tag:"comp", at: now - 1*DAY, votes: 0,
                author:"Seth", authorId:"u1"},
  "jungle-warwick": {slug:"jungle-warwick", title:"Warwick jungle for beginners", blurb:"",
                champ:"Warwick", role:"Jungle", tag:"new", at: now - 3*DAY, votes: 3,
                /* Edited later than it was published — the one guide that
                   should move under "recently updated" and nowhere else. */
                updated: now - 1000, author:"Mira", authorId:"u2"},
  "kog-adc": {slug:"kog-adc", title:"Kog'Maw bot lane", blurb:"The other Kog.",
                champ:"Kog'Maw", role:"ADC", tag:"", at: now - 2*DAY, votes: 1,
                author:"Seth", authorId:"u1"},
  "zed-fun":  {slug:"zed-fun", title:"Zed but it's all lethality", blurb:"Do not do this.",
                champ:"Zed", role:"Mid", tag:"fun", at: now - 5*DAY, votes: 7,
                author:"Kai", authorId:"u3"}
};
const DRAFT = {title:"Half-written Ashe guide", champ:"Ashe", role:"ADC"};

/* ---- DOM stub ---- */
class El {
  constructor(tag="div"){
    this.tagName = tag.toUpperCase(); this.children = []; this._html = "";
    this.style = {setProperty(){}}; this.dataset = {}; this.attrs = {};
    this.classList = {add(){}, remove(){}, toggle(){}, contains:()=>false};
    this.value = ""; this.textContent = ""; this.hidden = false;
    this.selectionStart = 0;
  }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html = String(v); }
  get outerHTML(){ return this._html; } set outerHTML(v){ this._html = String(v); }
  get className(){ return ""; } set className(v){}
  setAttribute(k,v){ this.attrs[k]=String(v); } getAttribute(k){ return this.attrs[k] ?? null; }
  removeAttribute(){} appendChild(c){ this.children.push(c); return c; }
  replaceWith(){} remove(){} focus(){} select(){} blur(){} click(){}
  setSelectionRange(){} addEventListener(){} removeEventListener(){}
  prepend(){} append(){} insertAdjacentHTML(){} cloneNode(){ return new El(this.tagName); }
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

/* The page binds its controls with delegated listeners on document, so the
   only honest way to test them is to keep the listeners and fire at them. */
const listeners = {};
global.document = {
  getElementById: id => byId.get(id) || (byId.set(id, new El()), byId.get(id)),
  querySelector: bySel, querySelectorAll: () => [],
  createElement: t => new El(t), createElementNS: (n,t) => new El(t),
  addEventListener(type, fn){ (listeners[type] ||= []).push(fn); },
  removeEventListener(){},
  body: new El("body"), documentElement: new El("html"),
  activeElement: null, title: "", readyState: "complete"
};
global.window = global; global.self = global;
global.location = {href:"file:///index.html", search:"", hash:"", protocol:"file:"};
global.navigator = {userAgent:"stub"};
global.localStorage = {
  _d: new Map([
    ["riftvault.published.v1", JSON.stringify(STORE)],
    ["riftvault.draft.v2", JSON.stringify(DRAFT)]
  ]),
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
global.TextEncoder = TextEncoder; global.TextDecoder = TextDecoder;
global.__listeners = listeners;

let src = "";
for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))
  /* split("?") drops the ?v= cache-buster; it belongs to the URL, not
     to the filename on disk. See tools/bump-version.py. */
  src += fs.readFileSync(path.join(dir, m[1].split("?")[0]), "utf8") + "\n;\n";
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) src += m[1] + "\n;\n";
for(const m of src.matchAll(/id="([\w-]+)"/g)) if(!byId.has(m[1])) byId.set(m[1], new El());

/* Same reason as guide-render.js: `const q` and the render functions are
   scoped to the eval that defines them, so the checks have to be appended
   to the page's own source rather than run beside it. */
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
  /* Where to read the answer from. A full paint writes the Guides section
     inline into #main as a string, and the stub DOM does not parse that
     back into elements — so after a filter move, which rewrites only the
     #guides element, the section lives there instead. Reading the wrong one
     was the first draft of this test reporting a working page as broken. */
  const zone = () => document.getElementById("guides").innerHTML
                  || document.getElementById("main").innerHTML;
  const main = () => document.getElementById("main").innerHTML;
  /* A full repaint has to drop the section the last filter click left
     behind, or zone() would keep answering with it. */
  const repaintAll = () => { document.getElementById("guides").innerHTML = ""; paint(); };

  /* A click as the page's own handler sees one: something with a target
     that answers closest() the way a real element would. */
  const fire = (type, target) => {
    for(const fn of (__listeners[type] || [])) fn({target});
  };
  const el = attrs => ({
    id: attrs.id || "", value: attrs.value, dataset: attrs.dataset || {},
    closest(sel){
      /* "[data-role]" asks about dataset.role — the data- prefix is part of
         the attribute name, not of the key. Camel-casing without stripping
         it looked for dataset.dataRole and matched nothing, which read as
         four broken filters. */
      const m = /^\\[data-([\\w-]+)\\]$/.exec(sel);
      if(!m) return null;
      const key = m[1].replace(/-(\\w)/g, (_, c) => c.toUpperCase());
      return key in this.dataset ? this : null;
    }
  });
  const click = (attr, value) => fire("click", el({dataset:{[attr]: value}}));
  const search = text => {
    const box = el({id:"hSearch"}); box.value = text;
    fire("input", box);
  };
  /* Count the cards actually on the page, not the rows the filter returned. */
  const cards = () => (zone().match(/class="h-guide"/g) || []).length;

  console.log("first paint:");
  check("hero counts the store",   () => main().includes("4 guides across 3 champions"));
  check("all four guides show",    () => cards() === 4);
  check("the newest is first",     () => main().indexOf("artillery mid") < main().indexOf("Zed but"));
  check("blurbs render",           () => main().includes("Range is the plan"));
  check("a missing blurb is just absent", () => main().includes("Warwick jungle for beginners"));
  check("an edited guide says so", () => main().includes("edited"));
  check("every card carries its count", () => (main().match(/class="tally/g) || []).length === 4);
  check("  with the real number",  () => main().includes("<b>7</b>"));
  check("an unvoted guide shows a dimmed zero", () => main().includes('class="tally none"')
                                                     && main().includes("<b>0</b>"));
  check("one vote reads as singular", () => main().includes('title="1 upvote"'));
  check("tags render",             () => main().includes('class="tag comp"'));
  check("the unpublished draft is offered", () => main().includes("Half-written Ashe guide"));
  check("  and names its champion",() => main().includes("Ashe"));

  console.log("\\nfilters:");
  check("role narrows",            () => { click("role","Mid"); return cards() === 2; });
  check("  and keeps the pill on", () => zone().includes('data-role="Mid" class="on"'));
  check("role clears",             () => { click("role",""); return cards() === 4; });
  check("tag narrows",             () => { click("tag","fun"); return cards() === 1
                                            && zone().includes("Zed but"); });
  check("the same tag clicked twice clears it",
                                   () => { click("tag","fun"); return cards() === 4; });
  check("role and tag stack",      () => { click("role","Mid"); click("tag","comp");
                                           return cards() === 1 && zone().includes("artillery"); });
  check("clearing resets both",    () => { click("clear","1"); return cards() === 4; });

  console.log("\\nsearch:");
  check("matches a title",         () => { search("lethality"); return cards() === 1; });
  check("matches a champion",      () => { search("kog"); return cards() === 2; });
  check("matches an author",       () => { search("mira"); return cards() === 1; });
  check("is case-insensitive",     () => { search("WARWICK"); return cards() === 1; });
  check("nothing matching says so",() => { search("zzzz");
                                           return cards() === 0 && zone().includes("Nothing matches"); });
  check("  and quotes what you typed", () => zone().includes("zzzz"));
  check("  and offers a way out",  () => zone().includes("data-clear"));
  check("clearing the search restores", () => { click("clear","1"); return cards() === 4; });

  console.log("\\nsort:");
  const sort = v => { const s = el({id:"hSort"}); s.value = v; fire("change", s); };
  check("newest is the default",   () => zone().indexOf("artillery mid") < zone().indexOf("Kog&#39;Maw bot"));
  /* Warwick was published third but edited a second ago, so it is the one
     guide whose position depends on which question you ask. */
  check("recently updated lifts an edited guide", () => {
    sort("updated");
    return zone().indexOf("Warwick jungle") < zone().indexOf("artillery mid");
  });
  check("A–Z sorts by title",      () => {
    sort("title");
    return zone().indexOf("AP Kog") < zone().indexOf("Warwick jungle")
        && zone().indexOf("Warwick jungle") < zone().indexOf("Zed but");
  });
  check("sorting doesn't filter",  () => cards() === 4);
  check("top rated leads with the most votes", () => {
    sort("top");
    return zone().indexOf("Zed but") < zone().indexOf("Warwick jungle")
        && zone().indexOf("Warwick jungle") < zone().indexOf("artillery mid");
  });
  check("ties fall back to newest", () => {
    /* Warwick and AP Kog are both on 3; the newer of the two wins. */
    const all = JSON.parse(localStorage.getItem("riftvault.published.v1"));
    all["ap-kogmaw"].votes = 3;
    localStorage.setItem("riftvault.published.v1", JSON.stringify(all));
    sort("top");
    return zone().indexOf("artillery mid") < zone().indexOf("Warwick jungle");
  });
  check("sorting leaves the counts alone", () => {
    sort("new");
    return (zone().match(/class="tally/g) || []).length === 4;
  });

  console.log("\\npaging:");
  check("caps the list at " + HOME_GUIDES, () => {
    q.limit = 2; repaintGuides();
    return cards() === 2 && zone().includes("Showing 2 of 4");
  });
  check("show them all opens it up", () => { click("all","1"); return cards() === 4; });
  check("  and the count line goes", () => !zone().includes("Showing"));
  check("narrowing afterwards resets the page size", () => {
    click("role","Mid");
    return q.limit === HOME_GUIDES;
  });
  check("sorting afterwards does not", () => {
    q.limit = Infinity; sort("new");
    return q.limit === Infinity;
  });

  console.log("\\nchampion strip:");
  check("waits for the roster",    () => main().includes("Loading the roster"));
  check("champions with guides come first", () => {
    CHAMPIONS = [{id:"Ashe",name:"Ashe",key:"22",cls:"Marksman"},
                 {id:"KogMaw",name:"Kog'Maw",key:"96",cls:"Marksman"},
                 {id:"Warwick",name:"Warwick",key:"19",cls:"Fighter"},
                 {id:"Zed",name:"Zed",key:"238",cls:"Assassin"}];
    q.limit = HOME_GUIDES; q.role = ""; q.tag = ""; q.text = "";
    repaintAll();
    const s = main();
    return s.indexOf("champion.html?c=KogMaw") < s.indexOf("champion.html?c=Ashe");
  });
  check("a guide count is badged", () => main().includes('class="n">2<'));
  check("a champion with none isn't", () => {
    /* Ashe has a draft, not a guide — no badge. Counting the badges is
       enough: three champions have guides, one does not. */
    return (main().match(/class="n"/g) || []).length === 3;
  });

  console.log("\\nempty site:");
  /* Asserted against the rendered TEXT, not the markup. The first version
     of this matched "vault is waiting" anywhere in innerHTML, and after the
     rename it went on passing by matching an HTML COMMENT that explained
     the rename — a check quietly measuring the wrong thing. Comments ship
     inside innerHTML; substring assertions have to allow for that. */
  const words = () => main().replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " ");
  check("invites the first guide", () => {
    localStorage.setItem("riftvault.published.v1", "{}");
    repaintAll();
    return words().includes("No guides published yet") && cards() === 0;
  });
  check("  and says whose it would be", () => words().includes("Yours would be the first"));
  check("  and hides the filters",  () => !main().includes("hSearch"));
  check("  and drops the guide count from the hero", () => !main().includes("guides across"));
  check("  and still lists champions", () => main().includes("champion.html?c=Ashe"));
  check("a blank draft isn't advertised", () => {
    localStorage.setItem("riftvault.draft.v2", JSON.stringify({title:"", champ:null}));
    repaintAll();
    return !main().includes("unpublished draft");
  });
  check("no draft at all is fine",  () => {
    localStorage.removeItem("riftvault.draft.v2");
    repaintAll();
    return !main().includes("unpublished draft");
  });

  console.log(failed ? "\\n" + failed + " failure(s)" : "\\nthe home page holds up");
  if(failed) process.exitCode = 1;
})();
`;

(0, eval)(src);
