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
  /* Class selectors resolve to a stable stub child, created on first ask.
     The page builds its snap-preview layer inside the canvas and then writes
     to it by class; with querySelector returning null that code silently did
     nothing here, and a check on it could only ever throw or pass vacuously. */
  querySelector(sel){
    const k = String(sel);
    if(k[0] !== ".") return null;
    this._q = this._q || {};
    if(!this._q[k]) this._q[k] = new El("svg");   /* no classList poking: this
       harness's stub has a different shape from guide-render's, and reaching
       into it was what broke every check at once */
    return this._q[k];
  }
  querySelectorAll(sel){ const one = this.querySelector(sel); return one ? [one] : []; }
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

/* The page's own source, so a check can assert that a control is ABSENT.
   It cannot do that through the DOM stub: getElementById there creates the
   element on demand, so it never returns null and every "is it gone?" check
   passes whether or not it is. */
/* TWO different strings, and the difference matters. __CREATE_JS is the
   page's inline script, which is where paintPlan builds its markup at
   runtime; __CREATE_HTML is the whole file, which is where the static
   markup lives. A check for a hand-written element has to look at the
   second -- looking in the first finds nothing and passes silently if the
   assertion is phrased as an absence. */
global.__CREATE_JS = inline;
global.__CREATE_HTML = html;
/* The stylesheet, so a check can catch a CSS bug — a rule that overrides
   [hidden] is as real a fault as a broken function, and nothing else in a
   node harness can see one. */
global.__SITE_CSS = fs.readFileSync(path.join(dir, "site.css"), "utf8");
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


  /* ---------- the game plan editor ----------
     NO BACKTICKS AND NO REGEX BACKSLASHES IN HERE: these checks are a
     template literal spliced into the page's own IIFE, so both are eaten
     before they ever run. */
  const atPct = (fx, fy) => ({clientX: fx * 560, clientY: fy * 560,
                              preventDefault(){}, target:{closest:()=>true}});
  /* planStepAt reads a bounding box off the canvas element; the stub returns
     zeroes, so it is replaced with a real 560-square for these checks */
  const canvas = document.getElementById("planCanvas");
  canvas.getBoundingClientRect = () => ({left:0, top:0, width:560, height:560});

  /* planEditing has to be cleared too: paintPlan refuses to rebuild while a
     label input is open, so a check that leaves one open silently disables
     every repaint in every check after it -- which is exactly what happened,
     taking seven unrelated checks down with it. */
  const freshPlan = () => { S.plans = []; S.planActive = 0; planUndo = [];
    planEditing = null;
    PLAN_TOOL.tool = "route"; PLAN_TOOL.route = null;
    planAdd(); return curPlan(); };

  /* The drag lives in handlers registered on window, which the DOM stub never
     fires. Capturing them and calling them is the only way to drive the real
     behaviour; asserting on planPointerDown alone stops before the decision
     that matters.

     And "click" exists because a press now ARMS a drag on anything movable:
     (no backticks in here -- these checks are inside a template literal)
     without a pointerup the gesture never resolves, so a check that only
     pressed appeared to do nothing at all. */
  const withPointer = fn => {
    const taps = {};
    const real = window.addEventListener;
    window.addEventListener = (k, h) => { taps[k] = h; };
    try { fn(taps); } finally { window.addEventListener = real; }
    return taps;
  };
  const click = at => {
    const taps = withPointer(() => planPointerDown(at));
    if(taps.pointerup) taps.pointerup();
  };

  check("a plan can be added and starts empty", () => {
    const p = freshPlan();
    return !!p && p.routes.length === 0 && S.plans.length === 1;
  });
  check("  and plans are capped", () => {
    S.plans = []; for(let i = 0; i < 20; i++) planAdd();
    return S.plans.length === PLAN_MAX;
  });

  /* THE CENTRAL CLAIM: a click near a camp stores the camp's NAME */
  check("a click near a camp snaps to it and stores the name", () => {
    const p = freshPlan();
    const c = MAP_CAMPS.find(x => x.key === "blue-buff");
    planPointerDown(atPct(c.x / MAP_SIZE, c.y / MAP_SIZE));
    const st = p.routes[0].steps[0];
    return st.place === "blue-buff" && st.x === undefined;
  });
  check("  a click in open ground falls back to a point", () => {
    const p = freshPlan();
    planPointerDown(atPct(0.5, 0.5));          /* dead centre: nothing there */
    const st = p.routes[0].steps[0];
    return st.place === undefined && typeof st.x === "number";
  });
  check("  snapping reaches turrets too, not just camps", () => {
    const p = freshPlan();
    const t = MAP_STRUCTURES.find(x => x.key === "blue-top-t1");
    planPointerDown(atPct(t.x / MAP_SIZE, t.y / MAP_SIZE));
    return p.routes[0].steps[0].place === "blue-top-t1";
  });
  check("successive clicks extend one route, in order", () => {
    const p = freshPlan();
    const a = MAP_CAMPS.find(x => x.key === "blue-buff");
    const b = MAP_CAMPS.find(x => x.key === "blue-wolves");
    planPointerDown(atPct(a.x / MAP_SIZE, a.y / MAP_SIZE));
    planPointerDown(atPct(b.x / MAP_SIZE, b.y / MAP_SIZE));
    return p.routes.length === 1 && p.routes[0].steps.length === 2
        && p.routes[0].steps[1].place === "blue-wolves";
  });
  check("  steps are capped", () => {
    const p = freshPlan();
    /* a full click each time: pressing the same spot twice now arms a drag,
       and without the release the gesture never becomes a new stop */
    for(let i = 0; i < 60; i++) click(atPct(0.5, 0.5));
    return p.routes[0].steps.length === PLAN_STEPS_MAX;
  });
  /* ---- text labels on the drawing ---- */
  check("the Text tool places a label where you click", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    return p.markers.length === 1 && p.markers[0].kind === "text"
        && p.markers[0].text === "";
  });
  check("  an empty label draws nothing and never publishes", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    const svg = mapPlanSvg(p);
    const out = normaliseGuide({plans: S.plans}).plans;
    return svg.indexOf("pl-text") < 0 && out.length === 0;
  });
  check("  typed words reach the map", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    p.markers[0].text = "freeze here";
    const svg = mapPlanSvg(p);
    return svg.indexOf("pl-text") >= 0 && svg.indexOf("freeze here") >= 0;
  });
  check("  and survive publishing", () => {
    const out = normaliseGuide({plans: S.plans}).plans;
    return out.length === 1 && out[0].markers[0].text === "freeze here";
  });
  check("  a label is capped, not left to grow", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    p.markers[0].text = "x".repeat(300);
    const out = normaliseGuide({plans: S.plans}).plans;
    return out[0].markers[0].text.length === PLAN_TEXT_MAX;
  });
  check("  markup in a label is text, not markup", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    p.markers[0].text = "<img src=x onerror=1>";
    const svg = mapPlanSvg(normaliseGuide({plans: S.plans}).plans[0]);
    return svg.indexOf("<img") < 0;
  });
  check("  the box to type in opens on the map, at the point", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    /* planEditText appends the input to the canvas and marks it open */
    return planEditing === 0 && __CREATE_HTML.indexOf("planLabels") < 0;
  });
  check("  and the canvas is not rebuilt while it is open", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));        /* leaves planEditing set */
    const before = document.getElementById("planCanvas").innerHTML;
    document.getElementById("planCanvas").innerHTML = "<input id=sentinel>";
    paintPlan();
    const after = document.getElementById("planCanvas").innerHTML;
    planEditing = null;
    return after.indexOf("sentinel") >= 0;
  });
  check("  a label left empty is removed, not kept as an invisible marker", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    planEditing = null;
    /* what the input's blur does when nothing was typed */
    if(!p.markers[0].text) p.markers.splice(0, 1);
    return p.markers.length === 0;
  });
  check("  a click opens the label for typing", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    planEditing = null; p.markers[0].text = "hold it here";
    const taps = withPointer(() => planPointerDown(atPct(0.40, 0.45)));
    if(taps.pointerup) taps.pointerup();        /* no movement: a click */
    const opened = planEditing === 0;
    planEditing = null;
    return opened && p.markers.length === 1;
  });
  check("  a twitch is still a click, not a drag", () => {
    /* Without a threshold the smallest tremor between pressing and releasing
       counts as a drag, and a label can never be opened at all. */
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    planEditing = null; p.markers[0].text = "hold it here";
    const at = {x: p.markers[0].x, y: p.markers[0].y};
    const taps = withPointer(() => planPointerDown(atPct(0.40, 0.45)));
    /* two pixels: a hand, not an intention */
    if(taps.pointermove) taps.pointermove({clientX: 0.40 * 560 + 2, clientY: 0.45 * 560 + 1,
                                           preventDefault(){}});
    if(taps.pointerup) taps.pointerup();
    const opened = planEditing === 0;
    const stayed = p.markers[0].x === at.x && p.markers[0].y === at.y;
    planEditing = null;
    return opened && stayed;
  });
  check("  a drag moves it and does not open it", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    planEditing = null; p.markers[0].text = "hold it here";
    const taps = withPointer(() => planPointerDown(atPct(0.40, 0.45)));
    if(taps.pointermove) taps.pointermove(atPct(0.70, 0.25));
    if(taps.pointerup) taps.pointerup();
    const moved = Math.abs(p.markers[0].x - 0.70) < 0.02;
    const opened = planEditing !== null;
    planEditing = null;
    return moved && !opened;
  });
  /* ---- everything drawn can be moved, not just labels ---- */
  check("a route stop can be dragged to a different camp", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    const a = MAP_CAMPS.find(x => x.key === "blue-buff");
    const b = MAP_CAMPS.find(x => x.key === "blue-wolves");
    const c = MAP_CAMPS.find(x => x.key === "blue-wraiths");
    planPointerDown(atPct(a.x / MAP_SIZE, a.y / MAP_SIZE));
    planPointerDown(atPct(b.x / MAP_SIZE, b.y / MAP_SIZE));
    const taps = withPointer(() => planPointerDown(atPct(b.x / MAP_SIZE, b.y / MAP_SIZE)));
    if(taps.pointermove) taps.pointermove(atPct(c.x / MAP_SIZE, c.y / MAP_SIZE));
    if(taps.pointerup) taps.pointerup();
    return p.routes.length === 1 && p.routes[0].steps.length === 2
        && p.routes[0].steps[1].place === "blue-wraiths";
  });
  check("  and a plain click still adds a stop rather than moving one", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    const a = MAP_CAMPS.find(x => x.key === "blue-buff");
    planPointerDown(atPct(a.x / MAP_SIZE, a.y / MAP_SIZE));
    const taps = withPointer(() => planPointerDown(atPct(a.x / MAP_SIZE, a.y / MAP_SIZE)));
    if(taps.pointerup) taps.pointerup();
    return p.routes[0].steps.length === 2;
  });
  check("  a dragged stop re-snaps, so it still names a place", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.50, 0.50));            /* open ground: a point */
    planPointerDown(atPct(0.52, 0.52));
    const g = {kind: "stop", ri: 0, si: 0};
    const c = MAP_CAMPS.find(x => x.key === "blue-buff");
    planMoveGrab(g, c.x / MAP_SIZE, c.y / MAP_SIZE);
    return p.routes[0].steps[0].place === "blue-buff"
        && p.routes[0].steps[0].x === undefined;
  });
  check("  a marker can be moved too", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "marker"; PLAN_TOOL.mark = "ward";
    planPointerDown(atPct(0.50, 0.50));
    const c = MAP_CAMPS.find(x => x.key === "dragon") || MAP_PITS.find(x => x.key === "dragon");
    planMoveGrab({kind: "marker", i: 0}, c.x / MAP_SIZE, c.y / MAP_SIZE);
    return p.markers[0].kind === "ward" && p.markers[0].place === "dragon";
  });
  check("  the grab finds the topmost thing: marker over stop", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.50, 0.50)); planPointerDown(atPct(0.55, 0.55));
    const onlyStop = planGrabAt(0.50, 0.50);
    PLAN_TOOL.tool = "marker"; PLAN_TOOL.mark = "danger";
    click(atPct(0.50, 0.50));            /* a full click, so the marker lands */
    const markerWins = planGrabAt(0.50, 0.50);
    return onlyStop && onlyStop.kind === "stop"
        && markerWins && markerWins.kind === "marker";
  });
  check("  and of two markers in one spot, the one drawn on top", () => {
    /* One marker cannot tell the iteration order apart: reversing the loop
       changed nothing the previous check looked at. */
    const p = freshPlan();
    PLAN_TOOL.tool = "marker";
    PLAN_TOOL.mark = "ward";   click(atPct(0.50, 0.50));
    PLAN_TOOL.mark = "danger"; click(atPct(0.50, 0.50));
    const g = planGrabAt(0.50, 0.50);
    return p.markers.length === 2 && g.kind === "marker" && g.i === 1
        && p.markers[g.i].kind === "danger";
  });
  check("  a twitch on a stop is a click, not a nudge", () => {
    /* The generic drag arm has its own threshold, separate from the label
       one -- a check that only twitched a label left this half untested. */
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.50, 0.50)); planPointerDown(atPct(0.55, 0.55));
    const was = JSON.stringify(p.routes[0].steps[0]);
    const taps = withPointer(() => planPointerDown(atPct(0.50, 0.50)));
    if(taps.pointermove) taps.pointermove({clientX: 0.50 * 560 + 2,
                                           clientY: 0.50 * 560 + 1, preventDefault(){}});
    if(taps.pointerup) taps.pointerup();
    return p.routes[0].steps.length === 3
        && JSON.stringify(p.routes[0].steps[0]) === was;
  });
  check("  the pen draws even when it starts on a stop", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.50, 0.50)); planPointerDown(atPct(0.55, 0.55));
    PLAN_TOOL.tool = "pen";
    const taps = withPointer(() => planPointerDown(atPct(0.50, 0.50)));
    return p.ink.length === 1 && p.routes[0].steps.length === 2;
  });
  check("  erase still removes rather than grabbing", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "marker"; PLAN_TOOL.mark = "danger";
    planPointerDown(atPct(0.50, 0.50));
    PLAN_TOOL.tool = "erase";
    planPointerDown(atPct(0.50, 0.50));
    return p.markers.length === 0;
  });

  check("  a label can be picked up and moved", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    p.markers[0].text = "freeze here";
    const was = {x: p.markers[0].x, y: p.markers[0].y};
    planMoveText(0, 0.70, 0.25);
    return p.markers[0].x === 0.7 && p.markers[0].y === 0.25
        && (was.x !== 0.7 || was.y !== 0.25);
  });
  check("  the hit test finds a label and misses empty ground", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    p.markers[0].text = "hold it here";
    return planTextHit(0.40, 0.45) === 0 && planTextHit(0.80, 0.80) === -1;
  });
  check("  clicking the words picks them up instead of stacking a new label", () => {
    /* Drives planPointerDown, not planTextHit: the pickup lives in the
       pointer handler, and checking the hit test alone passed happily with
       the handler ignoring it entirely. */
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.40, 0.45));
    p.markers[0].text = "hold it here";
    planPointerDown(atPct(0.40, 0.45));      /* same spot, on the words */
    const same = p.markers.length === 1;
    planPointerDown(atPct(0.85, 0.15));      /* empty ground */
    return same && p.markers.length === 2;
  });
  check("  the hit box follows the length of the words", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.50, 0.50));
    p.markers[0].text = "x";
    const shortReach = planTextHit(0.60, 0.50) >= 0;
    p.markers[0].text = "a much longer label than that one";
    const longReach = planTextHit(0.60, 0.50) >= 0;
    return !shortReach && longReach;
  });
  check("  a dragged label stops being tied to a camp", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    const c = MAP_CAMPS.find(x => x.key === "blue-buff");
    planPointerDown(atPct(c.x / MAP_SIZE, c.y / MAP_SIZE));
    p.markers[0].text = "start here";
    p.markers[0].place = "blue-buff"; delete p.markers[0].x; delete p.markers[0].y;
    planMoveText(0, 0.80, 0.20);
    return p.markers[0].place === undefined && p.markers[0].x === 0.8;
  });
  check("  moving clamps to the map", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "text";
    planPointerDown(atPct(0.50, 0.50));
    p.markers[0].text = "edge";
    planMoveText(0, -3, 9);
    return p.markers[0].x === 0 && p.markers[0].y === 1;
  });
  check("  and only text can be moved this way", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "marker"; PLAN_TOOL.mark = "ward";
    planPointerDown(atPct(0.50, 0.50));
    return planMoveText(0, 0.3, 0.3) === false;
  });
  check("the typing box is transparent, so it previews against the map", () => {
    const i = __SITE_CSS.indexOf(".plan-canvas input.plan-text-input{");
    if(i < 0) return false;
    const rule = __SITE_CSS.slice(i, __SITE_CSS.indexOf("}", i));
    return rule.indexOf("background:transparent") >= 0
        && rule.indexOf("text-shadow") >= 0;      /* still readable over terrain */
  });
  check("  and its selector beats the page's own input rule", () => {
    /* create.html styles every input[type=text] with background:#fff. An
       attribute selector outranks a plain class, so a rule written as
       ".plan-text-input" loses whatever the file order -- which is how the
       box stayed white while the stylesheet said transparent. */
    const generic = __CREATE_HTML.indexOf("input[type=text],textarea,select{") >= 0
                 && __CREATE_HTML.indexOf("background:#fff") >= 0;
    const score = sel => {
      let classes = 0, elements = 0;
      for(const part of sel.split(/\s+/)){
        classes  += (part.match(/\.[\w-]+/g) || []).length;
        classes  += (part.match(/\[[^\]]+\]/g) || []).length;
        elements += /^[a-z]/.test(part) ? 1 : 0;
        elements += (part.match(/(?<=[\]\w])[a-z]+(?=[.\[])/g) || []).length;
      }
      return classes * 10 + elements;
    };
    return generic && score(".plan-canvas input.plan-text-input") > score("input[type=text]");
  });
  check("map labels are not bold", () => {
    const i = __SITE_CSS.indexOf(".pl-text{font:");
    if(i < 0) return false;
    const weight = __SITE_CSS.slice(i + 14, i + 17);
    return weight !== "700" && weight !== "bol";
  });

  check("the wave tool is gone, not merely hidden", () =>
    __CREATE_HTML.indexOf('data-tool="wave"') < 0 &&
    __CREATE_JS.indexOf("WAVE_UI") < 0 &&
    __CREATE_JS.indexOf("PLAN_STYLES") < 0);

  check("markers drop with the chosen kind", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "marker"; PLAN_TOOL.mark = "ward";
    const c = MAP_CAMPS.find(x => x.key === "dragon") ||
              MAP_PITS.find(x => x.key === "dragon");
    planPointerDown(atPct(c.x / MAP_SIZE, c.y / MAP_SIZE));
    return p.markers.length === 1 && p.markers[0].kind === "ward"
        && p.markers[0].place === "dragon";
  });
  check("undo restores the previous state", () => {
    const p = freshPlan();
    planPointerDown(atPct(0.5, 0.5));
    planPointerDown(atPct(0.52, 0.52));
    const before = JSON.stringify(curPlan());
    planPointerDown(atPct(0.54, 0.54));
    S.plans[S.planActive] = JSON.parse(planUndo.pop());
    return JSON.stringify(curPlan()) === before;
  });
  check("erase removes the nearest thing", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "marker"; PLAN_TOOL.mark = "danger";
    planPointerDown(atPct(0.5, 0.5));
    PLAN_TOOL.tool = "erase";
    planEraseAt(atPct(0.5, 0.5));
    return p.markers.length === 0;
  });
  check("  and a route that loses its last stop goes with it", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.5, 0.5));
    PLAN_TOOL.tool = "erase";
    planEraseAt(atPct(0.5, 0.5));
    return p.routes.length === 0;
  });

  /* what the editor draws must be what the guide draws */
  check("the editor renders through the same map the guide uses", () => {
    const p = freshPlan();
    const c = MAP_CAMPS.find(x => x.key === "blue-buff");
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(c.x / MAP_SIZE, c.y / MAP_SIZE));
    planPointerDown(atPct(0.6, 0.6));
    paintPlan();
    const h = document.getElementById("planCanvas").innerHTML;
    return h.indexOf("m-fig") >= 0 && h.indexOf("m-plan") >= 0 && h.indexOf("pl-pip") >= 0;
  });
  check("  and what it stores survives normaliseGuide untouched", () => {
    const p = freshPlan();
    const c = MAP_CAMPS.find(x => x.key === "blue-buff");
    const d = MAP_CAMPS.find(x => x.key === "blue-wolves");
    planPointerDown(atPct(c.x / MAP_SIZE, c.y / MAP_SIZE));
    planPointerDown(atPct(d.x / MAP_SIZE, d.y / MAP_SIZE));
    const out = normaliseGuide({plans: S.plans}).plans;
    return out.length === 1 && out[0].routes[0].steps.length === 2
        && out[0].routes[0].steps[0].place === "blue-buff";
  });
  check("a plan with nothing drawn is dropped on publish, not stored empty", () => {
    freshPlan();
    return normaliseGuide({plans: S.plans}).plans.length === 0;
  });
  /* the simplified UI's own claims */
  check("a second path is given a different colour, with no swatch to pick", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    PLAN_TOOL.route = null;                       /* what "+ Second path" does */
    planPointerDown(atPct(0.60, 0.60)); planPointerDown(atPct(0.65, 0.65));
    return p.routes.length === 2 && p.routes[0].colour !== p.routes[1].colour;
  });
  check("  and there is no global colour mode, only a per-path chip", () =>
    /* The swatch row is gone; the only colour control is attached to the
       path it recolours, which is where the choice belongs. */
    __CREATE_HTML.indexOf("planColours") < 0 &&
    __CREATE_JS.indexOf("data-rcolour=") >= 0);
  check("  nor a kind select, since the plan's name is its label", () =>
    __CREATE_HTML.indexOf('id="planKind"') < 0);
  check("  and that check is looking at the markup, not the script", () =>
    /* guards the assertion above: if __CREATE_HTML ever stopped being the
       whole file, "is it absent?" would pass for everything */
    __CREATE_HTML.indexOf('id="planCanvas"') >= 0);
  check("even a single path gets an optional label field", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    paintPlan();
    const h = document.getElementById("planRoutes").innerHTML;
    return p.routes.length === 1 && h.indexOf('data-rlabel="0"') >= 0;
  });
  check("  the label is optional — an unlabelled path still publishes", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    const out = normaliseGuide({plans: S.plans}).plans;
    return out.length === 1 && out[0].routes.length === 1 && out[0].routes[0].label === "";
  });
  check("  and an unlabelled path is left out of the guide's legend", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    return mapPlanLegend(curPlan()) === "";
  });
  check("the colour chip cycles that path's colour", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    const was = p.routes[0].colour;
    const i = PLAN_COLOURS.indexOf(was);
    p.routes[0].colour = PLAN_COLOURS[(i + 1) % PLAN_COLOURS.length];
    return p.routes[0].colour !== was && PLAN_COLOURS.indexOf(p.routes[0].colour) >= 0;
  });
  check("every plan has somewhere to explain it, with no button to find", () => {
    const p = freshPlan(); paintPlan();
    const h = document.getElementById("planNote").innerHTML;
    return h.indexOf("contenteditable") >= 0 && h.indexOf("Explain this plan") >= 0
        && h.indexOf("planAddNote") < 0;
  });
  check("  the explanation belongs to its own plan, not to the editor", () => {
    S.plans = []; planAdd(); planAdd();
    S.planActive = 0; curPlan().note = "<p>first plan</p>";
    S.planActive = 1; curPlan().note = "<p>second plan</p>";
    S.planActive = 0; paintPlan();
    const a = document.getElementById("planNote").innerHTML;
    S.planActive = 1; paintPlan();
    const b = document.getElementById("planNote").innerHTML;
    return a.indexOf("first plan") >= 0 && a.indexOf("second plan") < 0
        && b.indexOf("second plan") >= 0 && b.indexOf("first plan") < 0;
  });
  check("  ids are unique even when two plans are added in one millisecond", () => {
    S.plans = [];
    for(let i = 0; i < 8; i++) planAdd();
    const ids = S.plans.map(p => p.id);
    return new Set(ids).size === ids.length;
  });
  check("  and it survives being published", () => {
    S.plans = []; planAdd();
    const p = curPlan();
    p.note = "<p>start blue, finish red</p>";
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    const out = normaliseGuide({plans: S.plans}).plans;
    return out.length === 1 && out[0].note.indexOf("start blue, finish red") >= 0;
  });

  check("freehand ink is always red, not whatever the palette cycles to", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "pen";
    /* two strokes: a cycling palette would differ on the second */
    for(let i = 0; i < 2; i++){
      planPointerDown({clientX: 100 + i * 50, clientY: 100, preventDefault(){}});
      p.ink[p.ink.length - 1].pts.push([0.4, 0.4]);   /* a real drag, not a tap */
    }
    return p.ink.length === 2 && p.ink[0].colour === "red" && p.ink[1].colour === "red";
  });
  check("the marker buttons are hidden under every tool except Mark", () => {
    const host = document.getElementById("planMarks");
    freshPlan();
    PLAN_TOOL.tool = "route";  paintPlan(); const a = host.hidden;
    PLAN_TOOL.tool = "pen";    paintPlan(); const b = host.hidden;
    PLAN_TOOL.tool = "erase";  paintPlan(); const c = host.hidden;
    PLAN_TOOL.tool = "marker"; paintPlan(); const d = host.hidden;
    return a && b && c && !d;
  });
  check("  and the stylesheet actually honours hidden on that element", () => {
    /* .pt-group sets display:flex, which beats the browser's own
       [hidden]{display:none} — so setting .hidden in script was correct and
       had no visible effect at all until this rule existed. */
    const i = __SITE_CSS.indexOf(".pt-group{display:flex");
    const j = __SITE_CSS.indexOf(".pt-group[hidden]{display:none}");
    return i >= 0 && j > i;
  });

  /* STRUCTURE. An unclosed <div> is not a JavaScript error, and every check
     on this page passed with one in it: the browser recovered by nesting
     everything after it one level deeper, which put the sticky preview rail
     inside the form instead of its own grid column, so it floated over the
     page once it began sticking.
     Scanned WITHOUT regex -- these checks are spliced into a template
     literal, where a backslash is eaten before the pattern compiles. */
  const bodyMarkup = () => {
    let t = __CREATE_HTML.slice(__CREATE_HTML.indexOf("<body"),
                                __CREATE_HTML.indexOf("</body>"));
    const cut = (open, close) => {
      let i;
      while((i = t.indexOf(open)) >= 0){
        const j = t.indexOf(close, i);
        if(j < 0){ t = t.slice(0, i); break; }
        t = t.slice(0, i) + t.slice(j + close.length);
      }
    };
    cut("<!--", "-->");
    cut("<script", "</script>");
    return t;
  };
  const divDepthAt = (t, stop) => {
    let depth = 0, i = 0;
    for(;;){
      const o = t.indexOf("<div", i), c = t.indexOf("</div", i);
      if(o < 0 && c < 0) break;
      const next = (o >= 0 && (c < 0 || o < c)) ? o : c;
      if(stop >= 0 && next >= stop) break;
      depth += (next === o) ? 1 : -1;
      i = next + 4;
    }
    return depth;
  };
  check("every div in the page body is closed", () =>
    divDepthAt(bodyMarkup(), -1) === 0);
  check("  and the preview rail is a direct child of the layout grid", () => {
    /* at depth 1 the grid can place it in column 2; nested deeper it cannot,
       and position:sticky then makes it overlap the form */
    const t = bodyMarkup();
    return divDepthAt(t, t.indexOf('class="rail"')) === 1;
  });

  /* ---- the snap preview: the editor's one invisible behaviour ---- */
  const ghost = () => document.getElementById("planCanvas").querySelector(".plan-ghost");
  check("hovering a camp previews the snap and names it", () => {
    freshPlan(); paintPlan();
    const c = MAP_CAMPS.find(x => x.key === "blue-buff");
    planGhost(atPct(c.x / MAP_SIZE, c.y / MAP_SIZE));
    const h = ghost().innerHTML;
    return h.indexOf("pg-ring") >= 0 && h.indexOf(c.name) >= 0;
  });
  check("  hovering open ground previews a free point instead", () => {
    freshPlan(); paintPlan();
    planGhost(atPct(0.5, 0.5));
    const h = ghost().innerHTML;
    return h.indexOf("pg-dot") >= 0 && h.indexOf("pg-ring") < 0;
  });
  check("  what it previews is what a click then stores", () => {
    const p = freshPlan(); paintPlan();
    const t = MAP_STRUCTURES.find(x => x.key === "blue-top-t1");
    planGhost(atPct(t.x / MAP_SIZE, t.y / MAP_SIZE));
    const previewed = ghost().innerHTML.indexOf("pg-ring") >= 0;
    planPointerDown(atPct(t.x / MAP_SIZE, t.y / MAP_SIZE));
    const stored = p.routes[0].steps[0];
    return previewed && stored.place === "blue-top-t1";
  });
  check("  and the preview name never runs off the edge of the map", () => {
    /* EVERY place, not just the camps. Looping camps alone made this
       vacuous: the nearest camp to a side edge is 184 units in, so removing
       the clamp entirely changed nothing it looked at. Exactly one of the
       44 places sits inside the margin -- red-bot-t1 at x=914 -- and it is
       the only one that can prove the clamp works. */
    freshPlan(); paintPlan();
    const places = mapPlaces();
    const edgy = places.filter(q => q.x < 90 || q.x > MAP_SIZE - 90);
    if(!edgy.length) return false;        /* nothing to prove it with */
    let bad = 0;
    for(const q of places){
      planGhost(atPct(q.x / MAP_SIZE, q.y / MAP_SIZE));
      const h = ghost().innerHTML;
      const m = h.indexOf('class="pg-name" x="');
      if(m < 0) continue;
      const x = parseFloat(h.slice(m + 19));
      if(x < 90 || x > MAP_SIZE - 90) bad++;
    }
    return bad === 0;
  });
  check("  the preview is a separate layer, so a mouse move redraws only it", () => {
    /* The map figure must not be rebuilt on pointer movement -- it is forty
       four icons. So the canvas markup stays put and only the ghost changes. */
    freshPlan(); paintPlan();
    const canvasBefore = document.getElementById("planCanvas").innerHTML;
    ghost().innerHTML = "";
    planGhost(atPct(0.5, 0.5));
    const canvasAfter = document.getElementById("planCanvas").innerHTML;
    return canvasBefore === canvasAfter && ghost().innerHTML.length > 0;
  });
  check("a marker carries no label field any more", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "marker"; PLAN_TOOL.mark = "ward";
    planPointerDown(atPct(0.5, 0.5));
    const out = normaliseGuide({plans: S.plans}).plans[0];
    return p.markers[0].label === undefined && out.markers[0].label === undefined;
  });
  check("the off state says what a game plan is before offering one", () => {
    S.plans = []; S.planActive = 0; paintPlan();
    return document.getElementById("planNone").hidden === false
        && __CREATE_HTML.indexOf("+ Add a game plan") >= 0
        && __CREATE_HTML.indexOf("snaps to it and stores its name") >= 0;
  });

  /* ---- renaming, through the same machinery as every other page ---- */
  check("a plan is a page kind, like a rune page or a skill order", () =>
    !!PAGE_KINDS.plan && PAGE_KINDS.plan.list() === S.plans);
  check("  and adding one goes through that machinery, not its own copy", () => {
    /* planAdd kept a hand-written body for a while after the kind existed.
       Comparing field names stopped telling the two apart once they happened
       to produce the same ones -- so this checks a SIDE EFFECT only the
       shared path has: the kind's select() resets the drawing state, which
       a hand-rolled push does not. */
    S.plans = []; planAdd();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    if(PLAN_TOOL.route == null) return false;      /* drawing, so it is set */
    planAdd();
    return PLAN_TOOL.route === null && planUndo.length === 0;
  });
  check("  renaming writes to the field the plan actually uses", () => {
    /* plans call it "title", every other kind calls it "name"; the shared
       rename code asks the kind rather than assuming.
       NO BACKTICKS ANYWHERE IN HERE, including inside comments: these checks
       are spliced into a template literal and a backtick ends it. */
    S.plans = []; planAdd();
    renamePage("plan", 0, "Full clear from blue");       /* the real commit */
    const K = PAGE_KINDS.plan;
    return curPlan().title === "Full clear from blue"
        && curPlan().name === undefined                  /* not the wrong field */
        && pageNameOf(K, curPlan()) === "Full clear from blue";
  });
  check("  and a rune page still renames through its own field", () => {
    const was = S.setups[0].name;
    renamePage("setup", 0, "vs AD");
    const ok = S.setups[0].name === "vs AD" && S.setups[0].title === undefined;
    S.setups[0].name = was;
    return ok;
  });
  check("  an empty or unchanged name is refused", () => {
    S.plans = []; planAdd();
    renamePage("plan", 0, "Keep this");
    return renamePage("plan", 0, "   ") === false
        && renamePage("plan", 0, "Keep this") === false
        && curPlan().title === "Keep this";
  });
  check("  the strip uses the client's tabs and pencil, not its own bar", () => {
    S.plans = []; planAdd(); paintPlan();
    const h = document.getElementById("planTabs").innerHTML;
    return h.indexOf("page-selector") >= 0 && h.indexOf("page-tab") >= 0
        && h.indexOf("page-name-box") >= 0 && h.indexOf("page-name-edit") >= 0;
  });
  check("  and there is no second way to rename it", () =>
    __CREATE_HTML.indexOf('id="planTitle"') < 0 &&
    __CREATE_HTML.indexOf("plan-tab") < 0);
  check("  Duplicate copies a plan's drawing, not just its name", () => {
    S.plans = []; planAdd();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    dupePage("plan");
    const a = S.plans[0], b = S.plans[1];
    return S.plans.length === 2 && b.routes.length === 1
        && b.routes[0].steps.length === 2
        && b.routes !== a.routes          /* a real copy, not a shared array */
        && b.id !== a.id;
  });
  check("  plans may be deleted down to none, unlike a rune page", () => {
    S.plans = []; planAdd();
    delPage("plan");
    return S.plans.length === 0;
  });
  check("  a repaint during a rename does not destroy the input", () => {
    S.plans = []; planAdd();
    const before = document.getElementById("planTabs").innerHTML;
    renaming = 0;
    document.getElementById("planTabs").innerHTML = "<input id=sentinel>";
    paintPlan();
    const after = document.getElementById("planTabs").innerHTML;
    renaming = null;
    return after.indexOf("sentinel") >= 0;
  });

  /* ---- the section is optional, and removable in one click ---- */
  check("with no plans the editor is off the page entirely", () => {
    S.plans = []; S.planActive = 0; paintPlan();
    return document.getElementById("planUI").hidden === true
        && document.getElementById("planNone").hidden === false;
  });
  check("  and the button brings it back", () => {
    S.plans = []; paintPlan();
    planAdd(); paintPlan();
    return S.plans.length === 1
        && document.getElementById("planUI").hidden === false
        && document.getElementById("planNone").hidden === true;
  });
  check("the card's plan count is the real counter, not a copy of it", () => {
    S.plans = []; planAdd(); planAdd();
    return shownPlanCount({plans: S.plans}) === 2
        && shownPlanCount({plans: []}) === 0
        && shownPlanCount({}) === 0 && shownPlanCount(null) === 0;
  });
  check("the opt-out is in the heading, above the editor", () => {
    const hd = __CREATE_HTML.indexOf('<h2 class="page-title">Game plan</h2>');
    const btn = __CREATE_HTML.indexOf('id="planScrap"');
    const ui = __CREATE_HTML.indexOf('id="planUI"');
    return hd >= 0 && btn > hd && btn < ui
        && __CREATE_HTML.indexOf("Do not include gameplan") >= 0;
  });
  check("  and it is hidden when there is no section to opt out of", () => {
    S.plans = []; paintPlan();
    const off = document.getElementById("planScrap").hidden;
    planAdd(); paintPlan();
    return off === true && document.getElementById("planScrap").hidden === false;
  });
  check("Do not include gameplan drops every plan, not just the open one", () => {
    S.plans = []; planAdd(); planAdd(); planAdd();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    scrapPlans("plan");
    return S.plans.length === 0 && S.planActive === 0;
  });
  check("  and that leaves nothing for the guide to publish", () => {
    S.plans = []; planAdd();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    scrapPlans("plan");
    return normaliseGuide({plans: S.plans}).plans.length === 0;
  });
  check("  and it ignores a call for any other page kind", () => {
    /* It only ever empties S.plans, so without the kind guard a Remove meant
       for some other strip would silently wipe the game plan. */
    S.plans = []; planAdd(); planAdd();
    scrapPlans("setup");
    return S.plans.length === 2;
  });
  check("no plan carries an off flag any more", () => {
    /* a per-plan "show this one" switch was the first attempt; the field
       would now be stored and read by nothing */
    S.plans = []; planAdd();
    const out = normaliseGuide({plans:[{off:true,
      routes:[{steps:[{place:"blue-buff"},{place:"blue-red"}]}]}]}).plans;
    return curPlan().off === undefined && out[0].off === undefined
        && __CREATE_HTML.indexOf("plan-toggle") < 0;
  });

  check("the explanation box is compact, not the full-height editor", () => {
    /* the shared .rt is 150px on white, which dominated the panel */
    const i = __SITE_CSS.indexOf(".plan-note-wrap .rt{");
    if(i < 0) return false;
    const rule = __SITE_CSS.slice(i, __SITE_CSS.indexOf("}", i));
    const m = rule.indexOf("min-height:");
    const h = parseInt(rule.slice(m + 11), 10);
    return h > 0 && h < 100 && rule.indexOf("background:#fff") < 0;
  });

  check("Clear plan sits in the toolbar, where it can be found", () => {
    /* It used to be the last element in the panel, below the note box. */
    const tools = __CREATE_HTML.indexOf('class="plan-tools"');
    const after = __CREATE_HTML.indexOf('class="plan-after"');
    const clear = __CREATE_HTML.indexOf('id="planClear"');
    return tools >= 0 && after > tools && clear > tools && clear < after;
  });
  check("  and it empties the plan without removing it", () => {
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    PLAN_TOOL.tool = "marker";
    planPointerDown(atPct(0.50, 0.50));
    planClearAll();
    return S.plans.length === 1 && curPlan() === p
        && p.routes.length === 0 && p.markers.length === 0;
  });
  check("  and Undo brings the whole plan back, so no confirm is needed", () => {
    /* Drives the real handler rather than re-implementing it: the earlier
       version called planSnapshot() itself and then checked undo worked,
       which passed even with the snapshot removed from the button. */
    const p = freshPlan();
    PLAN_TOOL.tool = "route";
    planPointerDown(atPct(0.30, 0.30)); planPointerDown(atPct(0.35, 0.35));
    const before = JSON.stringify(curPlan());
    const depth = planUndo.length;
    planClearAll();                       /* the real thing the button calls */
    if(curPlan().routes.length !== 0) return false;      /* it must clear */
    if(planUndo.length !== depth + 1) return false;      /* and snapshot */
    S.plans[S.planActive] = JSON.parse(planUndo.pop());
    return JSON.stringify(curPlan()) === before;
  });

  check("removing a plan keeps the active index in range", () => {
    S.plans = []; planAdd(); planAdd(); planAdd();
    S.planActive = 2; planRemove(2);
    return S.planActive === 1 && !!curPlan();
  });

  console.log(failed ? "\\n" + failed + " FAILED" : "\\nthe matchup combobox and the plan editor hold up");
  process.exit(failed ? 1 : 0);
})();
`;

src += inline.slice(0, closeAt) + CHECKS + inline.slice(closeAt);
(0, eval)(src);
