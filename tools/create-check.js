/* ============================================================
   Creator check — the matchup combobox

       node tools/create-check.js <site-dir>

   create.html had no coverage beyond "it boots". That was tolerable while
   every control in it was a native element; the matchup picker is not. It
   started as a <datalist>, which handled filtering, arrow keys, Enter and
   dismissal for free — and could not draw a portrait, because the browser
   renders datalist options as plain strings. Replacing it with a listbox we
   render ourselves bought the art and inherited all of that behaviour as
   code that can break.

   So this checks the parts a smoke test can't see: that the options carry
   portraits AND names, that filtering and exclusion work, that the keyboard
   cursor is somewhere and only one place, and that picking actually adds.

   What it still cannot check: how any of it looks, whether the panel is
   positioned over the rows beneath it, or that a real browser fires these
   events in this order. That needs a real browser.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const html = fs.readFileSync(path.join(dir, "create.html"), "utf8");

/* ---- environment ---- */
class El {
  constructor(tag = "div"){
    this.tagName = tag; this.children = []; this.attrs = {}; this.dataset = {};
    this._html = ""; this.textContent = ""; this.value = ""; this.hidden = false;
    this.disabled = false; this.checked = false;
    this.style = {setProperty(){}, removeProperty(){}};
    this.classList = {add(){}, remove(){}, toggle(){}, contains: () => false};
  }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html = String(v); }
  get outerHTML(){ return this._html; } set outerHTML(v){ this._html = String(v); }
  get className(){ return ""; } set className(v){}
  setAttribute(k, v){ this.attrs[k] = String(v); }
  getAttribute(k){ return this.attrs[k] ?? null; }
  removeAttribute(k){ delete this.attrs[k]; }
  appendChild(c){ this.children.push(c); return c; }
  insertAdjacentHTML(){} insertAdjacentElement(){} replaceWith(){} remove(){}
  focus(){} blur(){} click(){} select(){} setSelectionRange(){}
  addEventListener(){} removeEventListener(){} prepend(){} append(){}
  cloneNode(){ return new El(this.tagName); }
  scrollIntoView(){}
  querySelector(){ return null; } querySelectorAll(){ return []; }
  closest(){ return null; } matches(){ return false; }
  getBoundingClientRect(){ return {top:0,left:0,width:0,height:0,bottom:0,right:0}; }
}
const byId = new Map();
for(const m of html.matchAll(/id="([\w-]+)"/g)) byId.set(m[1], new El());
const getEl = id => byId.get(id) || (byId.set(id, new El()), byId.get(id));

global.document = {
  getElementById: getEl,
  querySelector: sel => {
    const m = /^#([\w-]+)$/.exec(String(sel).trim());
    return m ? getEl(m[1]) : null;
  },
  querySelectorAll: () => [],
  createElement: t => new El(t), createElementNS: (n, t) => new El(t),
  addEventListener(){}, removeEventListener(){},
  body: new El("body"), documentElement: new El("html"),
  activeElement: null, title: "", readyState: "complete",
  execCommand(){ return true; },
  createRange: () => ({selectNodeContents(){}, collapse(){}, setStart(){}, setEnd(){}}),
  getSelection: () => ({removeAllRanges(){}, addRange(){}, rangeCount: 0})
};
global.window = global; global.self = global;
global.location = {href:"file:///create.html", search:"", hash:"", protocol:"file:",
                   reload(){}, assign(){}, replace(){}};
global.navigator = {userAgent:"stub", clipboard:{writeText: async()=>{}}};
const mem = new Map();
global.localStorage = global.sessionStorage = {
  getItem: k => mem.has(k) ? mem.get(k) : null,
  setItem: (k,v) => mem.set(k,String(v)), removeItem: k => mem.delete(k),
  clear: () => mem.clear()
};
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.setTimeout = global.setTimeout;
global.matchMedia = () => ({matches:false, addListener(){}, addEventListener(){}});
global.Image = El; global.HTMLImageElement = El;
global.getComputedStyle = () => ({getPropertyValue: () => ""});
global.innerWidth = 1600; global.innerHeight = 900; global.scrollY = 0;
global.scrollTo = () => {};
global.structuredClone = v => JSON.parse(JSON.stringify(v));
global.MutationObserver = class { observe(){} disconnect(){} };
global.IntersectionObserver = class { observe(){} disconnect(){} unobserve(){} };
/* Opened from file://, like stub-check: no network, every catch exercised. */
global.fetch = async () => { throw new Error("offline"); };
global.CompressionStream = undefined;

let src = "";
for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)){
  const p = path.join(dir, m[1].split("?")[0]);
  if(fs.existsSync(p)) src += fs.readFileSync(p, "utf8") + "\n;\n";
}
/* The page's whole script is wrapped in one IIFE, on purpose — its short
   helpers ($, esc, paint…) would otherwise collide with site.js's. That
   also puts S, renderMu, muShow and every other thing worth testing out of
   reach of anything appended after it, which is why this page has only ever
   had a smoke test.

   So the checks are injected INSIDE the wrapper, immediately before the
   closing `})();`, rather than appended after it. Nothing in the shipped
   page changes to accommodate the test — the alternative was a test-only
   hook on window, and production code should not carry one. */
let inline = "";
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) inline += m[1] + "\n;\n";
const closeAt = inline.lastIndexOf("})();");
if(closeAt < 0){
  console.error("create.html's script is no longer wrapped in an IIFE — " +
                "this harness injects its checks inside that wrapper and " +
                "must be updated to match.");
  process.exit(1);
}

for(const m of (src + inline).matchAll(/id="([\w-]+)"/g))
  if(!byId.has(m[1])) byId.set(m[1], new El());

const CHECKS = `
;(function(){
  let failed = 0;
  const check = (label, fn) => {
    try{
      const out = fn();
      if(out === false){ console.log("FAIL  " + label); failed++; }
      else console.log("ok    " + label);
    }catch(err){ console.log("FAIL  " + label + " -- threw: " + err.message); failed++; }
  };
  const opts  = () => document.getElementById("muOpts").innerHTML;
  const box   = () => document.getElementById("muOpts");
  const input = () => document.getElementById("muChamp");
  const reset = () => { S.matchups = []; input().value = ""; muActive = -1; muShow(false); };

  /* A roster with the two joins that have historically disagreed, so the
     filter is exercised on a punctuated name and a renamed one. */
  CHAMPIONS = [
    {id:"Ashe",       name:"Ashe",        key:"22",  cls:"Marksman"},
    {id:"KogMaw",     name:"Kog'Maw",     key:"96",  cls:"Marksman"},
    {id:"MonkeyKing", name:"Wukong",      key:"62",  cls:"Fighter"},
    {id:"Shaco",      name:"Shaco",       key:"35",  cls:"Assassin"},
    {id:"Singed",     name:"Singed",      key:"27",  cls:"Tank"}
  ];

  console.log("the matchup combobox:");

  reset(); muShow(true);
  /* The whole reason the datalist had to go. */
  check("every option carries a portrait, not just a name", () => {
    const o = opts();
    return (o.match(/<img/g) || []).length === 5
        && (o.match(/class="nm"/g) || []).length === 5;
  });
  /* The mode addresses its icons as 60000 + the archive key, so Kog'Maw
     at key 96 is 60096. Asserting the id rather than merely "an <img> is
     present" is what would catch a portrait pointing at Season 3 art. */
  check("  and the portrait is the mode's icon, not the archive's", () =>
    opts().includes("champion-icons/60096.png"));
  check("  and the champion's class, as a hint", () => opts().includes("Marksman"));
  check("options are real buttons, not list items", () =>
    (opts().match(/role="option"/g) || []).length === 5);

  check("closed by default", () => { muShow(false); return box().hidden === true; });
  check("open sets aria-expanded on the input", () => {
    muShow(true); return input().getAttribute("aria-expanded") === "true";
  });

  /* Filtering */
  check("typing narrows the list", () => {
    input().value = "sha"; muShow(true);
    const o = opts();
    return o.includes("Shaco") && !o.includes(">Ashe<") && !o.includes(">Singed<");
  });
  check("  matching the archive id as well as the name", () => {
    input().value = "monkey"; muShow(true);
    return opts().includes("Wukong");
  });
  check("  and ignoring punctuation and case", () => {
    input().value = "kogmaw"; muShow(true);
    return opts().includes("Kog");
  });
  check("  a query matching nothing says so rather than going blank", () => {
    input().value = "zzzz"; muShow(true);
    return opts().includes("No champion left") && !opts().includes("role=\\"option\\"");
  });

  /* Exclusion */
  reset();
  check("a champion already listed drops out of the options", () => {
    S.matchups = [{champ:"Shaco", diff:"even", note:""}];
    input().value = ""; muShow(true);
    const o = opts();
    return !o.includes(">Shaco<") && (o.match(/role="option"/g) || []).length === 4;
  });

  /* Keyboard cursor */
  reset(); input().value = ""; muShow(true);
  check("no row is highlighted until you arrow", () => {
    muActive = -1; renderMuList();
    return !opts().includes("mu-opt on") && !input().getAttribute("aria-activedescendant");
  });
  check("arrowing highlights exactly one row", () => {
    muActive = 1; renderMuList();
    return (opts().match(/class="mu-opt on"/g) || []).length === 1;
  });
  check("  and points the input at it for a screen reader", () => {
    return input().getAttribute("aria-activedescendant") === "muOpt1";
  });
  check("  and marks it selected", () =>
    (opts().match(/aria-selected="true"/g) || []).length === 1);

  /* Adding */
  reset();
  check("picking a champion adds a matchup, at even by default", () => {
    input().value = "Singed"; addMatchup();
    return S.matchups.length === 1 && S.matchups[0].champ === "Singed"
        && S.matchups[0].diff === "even" && S.matchups[0].note === "";
  });
  check("  and clears the box for the next one", () => input().value === "");
  check("a name the roster spells differently is stored the roster's way", () => {
    reset(); input().value = "kogmaw"; addMatchup();
    return S.matchups[0].champ === "Kog'Maw";
  });
  check("a champion the roster doesn't have is still accepted as typed", () => {
    reset(); input().value = "Nocturne"; addMatchup();
    return S.matchups.length === 1 && S.matchups[0].champ === "Nocturne";
  });
  check("the same champion can't be added twice", () => {
    reset(); input().value = "Ashe"; addMatchup();
    input().value = "ashe"; addMatchup();
    return S.matchups.length === 1;
  });
  check("an empty box adds nothing", () => {
    reset(); input().value = "   "; addMatchup();
    return S.matchups.length === 0;
  });
  check("the 40 cap is enforced in the editor, not just on publish", () => {
    reset();
    for(let i = 0; i < 45; i++){ input().value = "Champ" + i; addMatchup(); }
    return S.matchups.length === 40;
  });

  /* The rows under the box */
  check("each row renders a portrait, a verdict and a note field", () => {
    reset(); input().value = "Shaco"; addMatchup();
    const h = document.getElementById("muRows").innerHTML;
    return h.includes("<img") && h.includes("data-mu-diff=\\"hard\\"")
        && h.includes("input") && h.includes("mu-del");
  });
  check("  and an empty list explains itself rather than showing nothing", () => {
    reset(); renderMu();
    return document.getElementById("muRows").innerHTML.includes("No matchups yet");
  });

  console.log(failed ? "\\n" + failed + " FAILED" : "\\nthe matchup combobox holds up");
  process.exit(failed ? 1 : 0);
})();
`;

src += inline.slice(0, closeAt) + CHECKS + inline.slice(closeAt);
(0, eval)(src);
