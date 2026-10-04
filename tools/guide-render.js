/* ============================================================
   Guide render check

       node tools/guide-render.js <site-dir>

   stub-check.js proves a page's scripts parse and boot. It cannot prove
   the guide view RENDERS, because with no draft in storage guide.html
   takes its "nothing to show" branch and every render function is
   skipped — which is exactly how three identifiers that lived only in
   create.html (CHAMPIONS, ITEM_BY_ID, TAGS) sat broken behind a passing
   test.

   This seeds a full draft, boots the page against it, and then calls the
   render functions directly with the catalogues both empty and populated.
   Empty matters as much as populated: the catalogues arrive over the
   network after first paint, so every section has to survive being drawn
   before its data exists.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const html = fs.readFileSync(path.join(dir, "guide.html"), "utf8");
/* The checks read the stylesheet back to verify the column arithmetic. */
global.__GUIDE_HTML = html;

/* ---- a draft with something in every section ---- */
const DRAFT = {
  title: "AP Kog'Maw — the artillery mage nobody bans",
  blurb: "Two items and a rune page that turn lane bullying into objectives.",
  champ: "Kog'Maw", role: "Mid", tag: "comp",
  spellSets: [["Flash", "Ignite"], ["Flash", "Teleport"]], spellSet: 0,
  items: [
    {id:"a", label:"Starting items", ordered:false, items:["1056","2003"]},
    {id:"b", label:"Core build",     ordered:true,  items:["3020","3116","3089"],
     note:"<p>Sheen first against a melee lane.</p>"}
  ],
  cardRow: "b",
  /* Deliberately out of display order, with a bad enum, an over-long note
     and a hostile one: the renderer sorts hardest first, an unknown
     difficulty becomes "even" rather than dropping the row, and the note is
     plain text so markup in it must come back escaped. */
  matchups: [
    {champ:"Ashe",   diff:"easy", note:"Outrange her <b>before 6</b>."},
    {champ:"Zed",    diff:"nonsense", note:""},
    {champ:"Ahri",   diff:"hard", note:"<img src=x onerror=alert(1)>charm dodges the ult"},
    {champ:"Teemo",  diff:"hard", note:"x".repeat(400)}
  ],
  skillPages: [
    {id:"s1", name:"Standard", skills:["W","Q","E","Q","Q","R","Q","W","W","R","W","E","E","R","E","E","E","E"]},
    {id:"s2", name:"Poke",     skills:["Q","W","E","Q","Q","R",null,null,null,null,null,null,null,null,null,null,null,null]}
  ],
  skillActive: 0,
  setups: [
    {id:"p1", name:"Standard", mast:{"512":4,"513":4,"522":4},
     runes:{mark:Array(9).fill("mark-attack-damage"), seal:Array(9).fill("seal-armor"),
            glyph:Array(9).fill("glyph-magic-resist"), quint:Array(3).fill("quint-attack-damage")}},
    {id:"p2", name:"vs AD", mast:{"613":4},
     runes:{mark:[], seal:Array(9).fill("seal-armor"), glyph:[], quint:[]}}
  ],
  active: 0,
  sections: [{h:"Why this build works", b:"<p>Range is the whole plan.</p>"}],
  notes: {items:"<p>Rush the component.</p>", runes:"<p>Armour seals.</p>"}
};

/* ---- DOM stub, enough to render into ---- */
class El {
  constructor(tag="div"){
    this.tagName = tag.toUpperCase(); this.children = []; this._html = "";
    this.style = {setProperty(){}}; this.dataset = {}; this.attrs = {};
    this.classList = {_s:new Set(), add(){}, remove(){}, toggle(){}, contains:()=>false};
    this.value = ""; this.textContent = ""; this.hidden = false;
  }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html = String(v); }
  get outerHTML(){ return this._html; } set outerHTML(v){ this._html = String(v); }
  get className(){ return ""; } set className(v){}
  setAttribute(k,v){ this.attrs[k]=String(v); } getAttribute(k){ return this.attrs[k] ?? null; }
  removeAttribute(){} appendChild(c){ this.children.push(c); return c; }
  replaceWith(){} remove(){} focus(){} select(){} blur(){} click(){}
  addEventListener(){} removeEventListener(){} prepend(){} append(){}
  insertAdjacentHTML(){} cloneNode(){ return new El(this.tagName); }
  /* site.js does element-level lookups on chrome it has just built, so
     querySelector has to resolve ids from an element, not just document. */
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
global.location = {href:"file:///guide.html", search:"", hash:"", protocol:"file:"};
global.navigator = {userAgent:"stub"};
global.localStorage = {
  _d: new Map([["riftvault.draft.v2", JSON.stringify(DRAFT)]]),
  getItem(k){ return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k,v){ this._d.set(k,String(v)); }, removeItem(k){ this._d.delete(k); }
};
global.sessionStorage = global.localStorage;
/* No network: every catalogue stays empty, which is the state the page is
   in for its first paint. */
global.fetch = () => Promise.reject(new Error("offline"));
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.matchMedia = () => ({matches:false, addListener(){}, addEventListener(){}});
global.innerWidth = 1600; global.innerHeight = 900; global.scrollY = 0;
global.structuredClone = v => JSON.parse(JSON.stringify(v));
global.Image = El; global.getComputedStyle = () => ({getPropertyValue:()=>""});
global.Blob = Blob; global.Response = Response;
global.btoa = s => Buffer.from(s,"binary").toString("base64");
global.atob = s => Buffer.from(s,"base64").toString("binary");
global.TextEncoder = TextEncoder; global.TextDecoder = TextDecoder;

let src = "";
for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))
  /* split("?") drops the ?v= cache-buster; it belongs to the URL, not
     to the filename on disk. See tools/bump-version.py. */
  src += fs.readFileSync(path.join(dir, m[1].split("?")[0]), "utf8") + "\n;\n";
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) src += m[1] + "\n;\n";
for(const m of src.matchAll(/id="([\w-]+)"/g)) if(!byId.has(m[1])) byId.set(m[1], new El());

/* The checks run INSIDE the page's own scope, appended to its source and
   evaluated with it. `let` and `const` at the top of eval code are scoped
   to that eval, so a test living outside could not see G, view, or any of
   the render functions — it would report a ReferenceError for each and
   look like a broken page. */
/* The page's own <style> block, handed to the checks as a string. A CSS
   bug can be as real as a JS one — see the 98px section gap — and this
   is the only way a node harness can see one. */
const PAGE_STYLE = (html.match(/<style>([\s\S]*?)<\/style>/) || [,""])[1];

src += `
const PAGE_CSS = ${JSON.stringify(PAGE_STYLE)};
;(async function(){
  let failed = 0;
  /* publishGuide, updateGuide, unpublishGuide and toggleVote became async
     when the store gained a backend — they are network calls now, even
     though with no backend configured they resolve immediately. A sync
     check would see a Promise, which is truthy, and pass everything
     regardless. So the result is awaited. */
  const check = async (label, fn) => {
    try{
      const out = await fn();
      if(out === false){ console.log("FAIL  " + label); failed++; }
      else console.log("ok    " + label);
    }catch(e){
      console.log("FAIL  " + label + "\\n        " + e.name + ": " + e.message);
      failed++;
    }
  };

  /* esc() escapes the apostrophe, so search for the escaped form — the
     page is right and a naive includes("Kog'Maw") is what is wrong. */
  const KOG = "Kog&#39;Maw";

  console.log("with the catalogues empty (the first paint):");
  await check("normalises the draft", async () => (G = normaliseGuide(DRAFT_FIXTURE)) && G.title.length > 0);
  await check("hero renders", async () => heroHtml().includes(KOG));
  await check("introduction renders", async () => introHtml().includes("Range is the whole plan"));
  await check("item build renders", async () => itemsHtml().includes("Core build"));
  await check("  and its note", async () => itemsHtml().includes("Rush the component"));
  await check("  and the note on one line", async () => itemsHtml().includes("Sheen first against a melee lane"));
  await check("spells render", async () => spellsHtml().includes("Flash"));
  await check("skill order renders", async () => skillsHtml().includes("Skill order"));
  await check("runes render", async () => runesHtml().includes("rune-slot"));
  await check("  and its note", async () => runesHtml().includes("Armour seals"));
  /* The mastery tree is bundled rather than fetched, so it is the one
     catalogue available immediately — but only after loadMasteries() has
     read it. Before that, an empty section is the correct output. */
  await check("masteries wait for their tree", async () => {
    /* Stated rather than timed. The old version depended on this running
       before loadMasteries() had resolved, which stopped being true the
       moment the checks gained an await between them. */
    const had = MASTERY_TREE; MASTERY_TREE = null;
    const out = masteriesHtml(); MASTERY_TREE = had;
    return out === "";
  });
  await check("whole page paints", async () => { paint(); return document.getElementById("main").innerHTML.length > 500; });

  console.log("\\nwith the catalogues populated:");
  CHAMPIONS = [{id:"KogMaw", name:"Kog'Maw", key:"96", cls:"Marksman"}];
  ITEM_BY_ID = new Map([
    ["1056",{id:"1056",name:"Doran's Ring",total:400,icon:"i.png",inStore:true}],
    ["3020",{id:"3020",name:"Sorcerer's Shoes",total:1100,icon:"i.png",inStore:true}]
  ]);
  SPELLS = [{id:"SummonerFlash",name:"Flash",icon:"f.png",classicId:74}];
  ABILITIES_DOC = {splash:"s.jpg", passive:{letter:"P",name:"Icathian Surprise",icon:"p.png"},
                   spells:[{letter:"Q",name:"Caustic Spittle",icon:"q.png"}]};
  await check("hero shows the kit", async () => heroHtml().includes("Icathian Surprise"));
  await check("hero shows the splash", async () => heroHtml().includes("s.jpg"));
  /* The two priced items sit in different lines, so each line totals its
     own — 400g for the start, 1,100g for the core. */
  await check("items name and total", async () => itemsHtml().includes("Doran&#39;s Ring")
                                       && itemsHtml().includes("400g")
                                       && itemsHtml().includes("1,100g"));
  await check("skills name abilities", async () => skillsHtml().includes("Caustic Spittle"));
  await check("repaints cleanly", async () => { paint(); return document.getElementById("main").innerHTML.includes(KOG); });

  console.log("\\nreader aids:");
  await check("max order sits above the grid", async () => {
    G = normaliseGuide(DRAFT_FIXTURE);
    ABILITIES_DOC = {passive:null, spells:[{letter:"Q",name:"Caustic Spittle",icon:"q.png"}]};
    return skillsHtml().includes("g-maxorder") && skillsHtml().includes("Max order");
  });
  await check("items carry a tooltip target", async () => itemsHtml().includes("data-tip-item"));
  await check("spells carry one", async () => spellsHtml().includes("data-tip-spell"));
  await check("hero abilities carry one", async () => heroHtml().includes("data-tip-ab"));
  await check("an item tooltip builds", async () => {
    ITEM_BY_ID = new Map([["3020",{id:"3020",name:"Sorcerer&#39;s Shoes",total:1100,
                                   icon:"i.png",descHtml:"<b>+20</b> magic pen",inStore:true}]]);
    return itemTipHtml("3020").includes("1100g");
  });
  await check("  and shows the shop text", async () => itemTipHtml("3020").includes("magic pen"));
  await check("  and an unknown id gives nothing", async () => itemTipHtml("999999") === "");
  await check("a reference tooltip resolves by kind", async () => refTipHtml("item:3020").includes("1100g"));
  await check("an unknown token gives nothing", async () => refTipHtml("bogus:1") === "");

  /* The panel and the hover wiring moved to site.js so the items page could
     have them too. What this checks is that the move didn't leave a page
     silently unregistered — a tooltip that never appears looks exactly like
     a page that was never meant to have one. */
  const kindFor = sel => TIP_KINDS.find(k => k.selector === sel);
  await check("items are registered by site.js", async () => !!kindFor("[data-tip-item]"));
  await check("  and build through the registry", async () =>
    kindFor("[data-tip-item]").build({dataset:{tipItem:"3020"}}).includes("1100g"));
  await check("the guide registers abilities", async () => !!kindFor("[data-tip-ab]"));
  await check("  spells", async () => !!kindFor("[data-tip-spell]"));
  await check("  and reference chips", async () => !!kindFor(".ref[data-ref]"));
  /* Runes and masteries had a title attribute and nothing else, so the two
     sections a reader most wants detail from were the two without it. */
  await check("  runes in the rune page", async () => !!kindFor("[data-tip-rune]"));
  await check("  and masteries in the tree", async () => !!kindFor("[data-tip-mastery]"));
  await check("a rune tip says what the rune does", async () => {
    const k = kindFor("[data-tip-rune]");
    const id = (typeof CLASSIC_RUNES !== "undefined" && CLASSIC_RUNES[0])
      ? CLASSIC_RUNES[0].id : null;
    if(!id) return false;
    return k.build({dataset:{tipRune:id}}).includes("tip-body");
  });
  await check("a mastery tip carries this build's points", async () => {
    const k = kindFor("[data-tip-mastery]");
    const id = Object.keys(MASTERY_BY_ID || {})[0];
    if(!id) return false;
    return k.build({dataset:{tipMastery:id, tipPts:"3/4"}}).includes("3/4");
  });
  await check("one listener serves them all", async () => TIP_KINDS.length === 6);

  /* The markup has to carry the hooks, or the registrations above match
     nothing. Asserted on what the section actually renders. */
  await check("the rune page marks its filled sockets", async () =>
    /data-tip-rune="/.test(runesHtml()));
  await check("  and leaves empty ones a plain title", async () => {
    /* The fixture fills every slot, so an empty socket has to be made.
       Restored afterwards — later checks render this same setup. */
    const keep = G.setups[0].runes.mark[0];
    G.setups[0].runes.mark[0] = null;
    const out = runesHtml();
    G.setups[0].runes.mark[0] = keep;
    return /title="[^"]*socket"/.test(out) && !/data-tip-rune="null"/.test(out);
  });
  await check("the mastery tree marks its cells", async () =>
    /data-tip-mastery="/.test(masteriesHtml()));

  /* site.css's bare section{padding:26px 0 60px} also hit .g-sec, so the
     gap between guide sections was 98px while the rule here claimed 12.
     A margin can't override someone else's padding. */
  await check("guide sections reset the inherited padding", async () =>
    /\.g-sec\{padding:0/.test(PAGE_CSS));

  console.log("\\nbuild path:");
  /* The upgrades have to exist in the map to be drawn — buildPathHtml only
     renders ids it can resolve. A first pass at this fixture listed nine
     ids and defined one, so the cap check saw a single icon and read as a
     broken cap when the page was fine. */
  const UPGRADES = ["3006","3009","3020","3047","3111","3117","3158","3ưa","3xx","3yy"];
  const shop = () => new Map([
    ["1001",{id:"1001",name:"Boots of Speed",total:325,icon:"b.png",inStore:true,
             from:[],to:UPGRADES}],
    ...UPGRADES.map((id, i) => [id,
      {id,name:"Upgrade " + i,total:1000+i,icon:"u"+i+".png",
       descHtml:"<b>+20</b> magic pen",inStore:true,from:["1001"],to:[]}])
  ]);
  await check("components show", async () => {
    ITEM_BY_ID = shop();
    const h = itemTipHtml("3020");
    return h.includes("Builds from") && h.includes("b.png");
  });
  await check("a component has none", async () => !itemTipHtml("1001").includes("Builds from"));
  await check("what it builds into shows", async () => itemTipHtml("1001").includes("Builds into"));
  /* Long Sword feeds most of the shop; an uncapped row would run off the
     panel, so the tail is counted rather than drawn. */
  await check("  and is capped", async () => {
    const h = itemTipHtml("1001");
    return (h.match(/class="pi"/g) || []).length === BUILDS_INTO_CAP && h.includes("+2");
  });
  await check("unknown ids are dropped, not drawn", async () => {
    ITEM_BY_ID = new Map([["9",{id:"9",name:"Orphan",total:100,icon:"o.png",
                                inStore:true,from:["nope"],to:["nope"]}]]);
    return !itemTipHtml("9").includes("tip-path");
  });

  console.log("\\nmy guides:");
  await check("lists a published guide", async () => {
    ITEM_BY_ID = new Map();
    const s = await publishGuide(DRAFT_FIXTURE);
    await toggleVote(s); await toggleVote(s);          /* on, then off — tally back to 0 */
    await toggleVote(s);                          /* and on again */
    paintList();
    return document.getElementById("main").innerHTML.includes("Kog");
  });
  await check("  with its upvote tally", async () => {
    const out = document.getElementById("main").innerHTML;
    return out.includes("g-tally") && out.includes("<b>1</b>")
        && out.includes('title="1 upvote"');
  });
  await check("an unvoted guide is dimmed, not blank", async () => {
    const s2 = await publishGuide({...DRAFT_FIXTURE, title:"Second guide"});
    paintList();
    const out = document.getElementById("main").innerHTML;
    return out.includes("g-tally none") && out.includes("<b>0</b>");
  });
  console.log("\\nmatchups:");
  /* The whitelist is the trap: normaliseGuide builds its return value field
     by field, so a field nobody named there is dropped in silence between
     the editor and the page. Every other check here would still pass. */
  await check("survive normaliseGuide's whitelist", async () => {
    const g = normaliseGuide(DRAFT_FIXTURE);
    return Array.isArray(g.matchups) && g.matchups.length === 4;
  });
  await check("an unknown difficulty becomes even, not a dropped row", async () => {
    const g = normaliseGuide(DRAFT_FIXTURE);
    const zed = g.matchups.find(m => m.champ === "Zed");
    return !!zed && zed.diff === "even";
  });
  await check("a long note is capped rather than carried", async () => {
    const g = normaliseGuide(DRAFT_FIXTURE);
    return g.matchups.find(m => m.champ === "Teemo").note.length === 200;
  });
  await check("the rail renders, hardest first", async () => {
    G = normaliseGuide(DRAFT_FIXTURE); paint();
    const out = document.getElementById("main").innerHTML;
    const i = n => out.indexOf(">" + n + "<");
    return out.includes("g-rail") && out.includes('id="matchups"')
        && i("Ahri") < i("Zed") && i("Zed") < i("Ashe");
  });
  await check("  and the body makes room for it", async () => {
    return document.getElementById("main").innerHTML.includes("has-rail");
  });
  await check("  and it earns a jump link", async () => {
    return document.getElementById("main").innerHTML.includes('href="#matchups"');
  });
  /* The note is the one author field here that is NOT rich text. If it ever
     goes through the rich sanitiser instead, markup starts rendering in a
     field the rail prints inline. */
  /* Two layers, and the test checks both. normaliseGuide STRIPS angle
     brackets from plain fields rather than escaping them, so nothing with a
     tag in it should survive that far; and the renderer escapes on the way
     out, so a note that reached it with a bracket intact still cannot open
     one. Testing only the first would pass if the renderer stopped escaping. */
  await check("  with the note stripped of markup on the way in", async () => {
    const g = normaliseGuide(DRAFT_FIXTURE);
    const note = g.matchups.find(m => m.champ === "Ahri").note;
    return !/[<>]/.test(note) && note.includes("charm dodges the ult");
  });
  /* <b> is on the rich sanitiser's allowlist and <img> is not, so a note
     carrying <b> is the only thing that tells the two apart. Without it,
     swapping this field to rich text passes every check here. */
  await check("  and plain, not rich: even an allowed tag is stripped", async () => {
    const note = normaliseGuide(DRAFT_FIXTURE).matchups
      .find(m => m.champ === "Ashe").note;
    /* sanitiseText removes the brackets and leaves the letters, so this is
       "Outrange her bbefore 6/b." — ugly, and the same treatment every
       other plain field gets. What matters is that no bracket survives:
       rich() would have kept <b> intact right here. */
    return !/[<>]/.test(note) && note.includes("bbefore 6/b");
  });
  await check("  and escaped again on the way out", async () => {
    /* Straight into G, bypassing normalise, so this is the renderer alone. */
    G = {...normaliseGuide(DRAFT_FIXTURE),
         matchups: [{champ: "Ahri", diff: "hard", note: '<img src=x onerror=alert(1)>'}]};
    paint();
    const out = document.getElementById("main").innerHTML;
    return out.includes("&lt;img") && !out.includes("<img src=x");
  });
  await check("no matchups drops the card and the jump link", async () => {
    G = normaliseGuide({...DRAFT_FIXTURE, matchups: []}); paint();
    const out = document.getElementById("main").innerHTML;
    return !out.includes('id="matchups"') && !out.includes('href="#matchups"');
  });
  /* The rail used to BE the matchups card, so a guide without matchups
     showed an empty 340px column — which was most guides, and was why the
     page still looked blank after that pass. It now carries the build and
     the champion's other guides too, so it survives on its own. */
  await check("  but the rail itself survives on the build card", async () => {
    const out = document.getElementById("main").innerHTML;
    return out.includes("g-rail") && out.includes("has-rail")
        && out.includes('id="rail-build"');
  });

  console.log("\\nthe rail:");
  await check("the build card shows the showcase six", async () => {
    G = normaliseGuide(DRAFT_FIXTURE); paint();
    const out = document.getElementById("main").innerHTML;
    /* Core build is the ordered row showcaseItems() picks: 3020/3116/3089. */
    return out.includes('id="rail-build"') && out.includes("3020") && out.includes("3089");
  });
  await check("  and totals the gold once every item resolves", async () => {
    ITEM_BY_ID = new Map([["3020",{id:"3020",name:"A",total:1000}],
                          ["3116",{id:"3116",name:"B",total:2000}],
                          ["3089",{id:"3089",name:"C",total:3000}]]);
    paint();
    return document.getElementById("main").innerHTML.includes("6,000 gold");
  });
  /* A partial total while the shop is still loading is a wrong number that
     looks like a right one, which is worse than showing none. */
  /* Scoped to the card: the Item build section further down prices its own
     lines, so checking the whole page for "gold" tests nothing. */
  await check("  and says nothing when an item hasn't resolved yet", async () => {
    ITEM_BY_ID = new Map([["3020",{id:"3020",name:"A",total:1000}]]);
    paint();
    const out = document.getElementById("main").innerHTML;
    const i = out.indexOf('id="rail-build"');
    const card = out.slice(i, out.indexOf("</div>", out.indexOf("g-rc-items", i)) + 6);
    return i > -1 && !card.includes("gold");
  });
  await check("a guide with no items has no build card", async () => {
    ITEM_BY_ID = new Map();
    G = normaliseGuide({...DRAFT_FIXTURE, items: [], cardRow: ""}); paint();
    return !document.getElementById("main").innerHTML.includes('id="rail-build"');
  });
  await check("other guides for the champion are listed, best first", async () => {
    await publishGuide({...DRAFT_FIXTURE, title: "Second Kog guide"});
    G = normaliseGuide(DRAFT_FIXTURE); G.slug = "not-a-real-slug"; paint();
    const out = document.getElementById("main").innerHTML;
    return out.includes('id="rail-more"') && out.includes("Second Kog guide");
  });
  await check("  and the guide you are reading is not one of them", async () => {
    const slug = await publishGuide({...DRAFT_FIXTURE, title: "Self link test"});
    G = normaliseGuide(DRAFT_FIXTURE); G.slug = slug; paint();
    const out = document.getElementById("main").innerHTML;
    return !out.includes("Self link test");
  });
  /* Best first, because the card shows at most five of them and the five
     worth showing are the ones people upvoted. */
  /* The upvoted guide is published FIRST and the unvoted one second, so
     listPublished's own newest-first order would put them the wrong way
     round. Publishing them the other way made this pass with no sort at
     all — recency alone produced the expected order. */
  await check("  sorted by votes, not by publish order", async () => {
    const high = await publishGuide({...DRAFT_FIXTURE, title: "High vote Kog"});
    await publishGuide({...DRAFT_FIXTURE, title: "Low vote Kog"});
    await toggleVote(high);
    G = normaliseGuide(DRAFT_FIXTURE); G.slug = "reading-something-else"; paint();
    const out = document.getElementById("main").innerHTML;
    const i = out.indexOf('id="rail-more"');
    return out.indexOf("High vote Kog", i) < out.indexOf("Low vote Kog", i);
  });
  /* The column is 340px and this is a sidebar, not an index — a champion
     with twenty guides would otherwise push everything below it off screen. */
  await check("  and capped at five however many exist", async () => {
    for(let i = 0; i < 8; i++)
      await publishGuide({...DRAFT_FIXTURE, title: "Filler Kog " + i});
    G = normaliseGuide(DRAFT_FIXTURE); G.slug = "reading-something-else"; paint();
    const out = document.getElementById("main").innerHTML;
    const card = out.slice(out.indexOf('id="rail-more"'));
    const rows = (card.slice(0, card.indexOf("</aside>")).match(/class="g-rc-row"/g) || []).length;
    return rows === 5;
  });
  /* A moderator hid it. Listing it in the rail would both promote a guide
     that was taken down and send readers to a page they cannot open. */
  await check("  and a hidden guide is never promoted there", async () => {
    const slug = await publishGuide({...DRAFT_FIXTURE, title: "Taken down Kog"});
    /* setGuideHidden() refuses without a backend — that is itself checked
       further down — so the flag goes straight onto the stored record, which
       is the shape a moderator's hide would leave behind. */
    const all = readStore(); all[slug].hidden = true; writeStore(all);
    G = normaliseGuide(DRAFT_FIXTURE); G.slug = "reading-something-else"; paint();
    return !document.getElementById("main").innerHTML.includes("Taken down Kog");
  });

  await check("a champion with no other guides has no more-guides card", async () => {
    G = normaliseGuide({...DRAFT_FIXTURE, champ: "Nobody"}); paint();
    return !document.getElementById("main").innerHTML.includes('id="rail-more"');
  });
  /* With every card empty there is nothing to put in the column, and a
     340px strip of blank parchment beside the text is exactly the thing
     this whole pass exists to remove. */
  await check("a guide with nothing for the rail gets no rail at all", async () => {
    /* Every source empty, not just the guide's own fields: the kit and stat
       cards come from catalogues rather than from the document, so leaving
       either loaded would keep the rail alive and make this check vacuous. */
    const kit = ABILITIES_DOC, stats = RAIL_STATS;
    ABILITIES_DOC = null; RAIL_STATS = null;
    G = normaliseGuide({...DRAFT_FIXTURE, champ: "Nobody", items: [],
                        cardRow: "", matchups: []});
    paint();
    const ok = (() => {
      const out = document.getElementById("main").innerHTML;
      return !out.includes("g-rail") && !out.includes("has-rail");
    })();
    ABILITIES_DOC = kit; RAIL_STATS = stats;
    return ok;
  });
  await check("the abilities card carries cooldowns and costs", async () => {
    ABILITIES_DOC = {splash:"", passive:{name:"Backstab",icon:"p.png",desc:"From behind."},
      spells:[{key:"q",letter:"Q",name:"Deceive",icon:"q.png",desc:"Blink.",
               cooldown:[16,14,12,10,8], cost:[90,80,70,60,50], range:[400]}]};
    G = normaliseGuide(DRAFT_FIXTURE); paint();
    const out = document.getElementById("main").innerHTML;
    return out.includes('id="rail-kit"') && out.includes("Deceive")
        && out.includes("16 / 14 / 12 / 10 / 8s") && out.includes("90 / 80 / 70 / 60 / 50 cost");
  });
  /* The hero strip lists the passive, so a rail that didn't disagreed with
     the icons directly above it about the size of the champion's kit. */
  await check("  including the passive, led by it", async () => {
    const out = document.getElementById("main").innerHTML;
    const card = out.slice(out.indexOf('id="rail-kit"'));
    return card.indexOf("Backstab") < card.indexOf("Deceive");
  });
  /* Hover tips come from the page's existing delegated handler, so the row
     only has to carry the hook the selector matches. If the attribute is
     dropped the rows still render and look right — nothing else would
     notice, which is why this is asserted rather than eyeballed. */
  await check("  and every row carries the tooltip hook", async () => {
    const out = document.getElementById("main").innerHTML;
    const card = out.slice(out.indexOf('id="rail-kit"'));
    const end  = card.indexOf("</div></aside>") > -1 ? card.indexOf("</div></aside>") : card.length;
    const rows = (card.slice(0, end).match(/class="g-rc-kit"/g) || []).length;
    const hook = (card.slice(0, end).match(/data-tip-ab="/g) || []).length;
    return rows === 2 && hook === 2;
  });
  await check("  and the tip the hook resolves to is the real ability text", async () => {
    return abilityTipHtml("Q").includes("Blink.")
        && abilityTipHtml("P").includes("From behind.");
  });
  await check("the stats card shows level 1 and level 18", async () => {
    RAIL_STATS = {hp:600, hpperlevel:85, attackdamage:50, attackdamageperlevel:3,
                  armor:20, armorperlevel:3, spellblock:30, spellblockperlevel:0,
                  movespeed:345};
    paint();
    const out = document.getElementById("main").innerHTML;
    /* 600 + 17 x 85 = 2045, and move speed has no growth so both columns match. */
    return out.includes('id="rail-stats"') && out.includes("2045") && out.includes("345");
  });
  await check("  and is absent until the record arrives", async () => {
    RAIL_STATS = null; paint();
    return !document.getElementById("main").innerHTML.includes('id="rail-stats"');
  });



  /* The one CSS fact worth asserting from here. Everything else about
     layout needs a real browser, but this is arithmetic: the wrap has to be
     wide enough for nav + content + rail + gutters, or the rail is paid for
     out of the content column and the item, rune and mastery tables get
     squeezed below the 988 they are built for. Shipping exactly that was
     the bug in the previous pass. */
  /* The one CSS fact worth asserting from here. Everything else about
     layout needs a real browser, but this is arithmetic: the wrap has to be
     wide enough for nav + content + rail + gutters, or the rail gets paid
     for out of the content column and the item, rune and mastery tables are
     squeezed below the 988 they are built for. Shipping exactly that was
     the bug in the previous pass.

     Parsed by hand rather than by regex: these checks live inside a
     template literal, which eats the backslashes before the regex sees
     them, so /\d+/ silently became /d+/ and every match returned null. */
  /* Both the prose and the note panels span the content column. The 66ch
     measure was correct typography and wrong layout: a text block ending
     361px short of the table above it reads as broken. Pinned here because
     the comment arguing FOR the cap is still in the stylesheet, and it is
     persuasive enough that someone will try to restore it. */
  await check("prose and note panels both span the column", () => {
    const h = __GUIDE_HTML;
    return h.includes(".g-prose{max-width:none}")
        && h.includes(".g-note{max-width:none}")
        && !h.includes("max-width:66ch");
  });

  await check("the wrap is wide enough to hold the rail without squeezing the tables", () => {
    const h = __GUIDE_HTML;
    const after = (block, key) => {
      const i = h.indexOf(block); if(i < 0) return 0;
      const j = h.indexOf(key, i); if(j < 0) return 0;
      return parseInt(h.slice(j + key.length), 10) || 0;
    };
    const wrap = after(".guide-wrap{", "max-width:");
    const pad  = after(".guide-wrap{", "padding:0 ");
    const gap  = after(".g-body{", "gap:");
    const ci   = h.indexOf(".g-body.has-rail{grid-template-columns:");
    const cols = ci < 0 ? "" : h.slice(ci + ".g-body.has-rail{grid-template-columns:".length,
                                       h.indexOf("}", ci)).trim();
    const nav  = parseInt(cols, 10) || 0;
    /* split(" ") rather than a regex: this block lives inside a template
       literal, which eats the backslash, so /\s+/ arrived as /s+/ and split
       on the letter s. rail then parsed as the nav's 186 and the whole
       check went vacuous — it passed on a deliberately broken layout. */
    const parts = cols.split(" ").filter(Boolean);
    const rail = parseInt(parts[parts.length - 1], 10) || 0;
    const need = nav + gap + 988 + gap + rail + pad * 2;
    if(![wrap, nav, rail, gap, pad].every(n => n > 0))
      console.log("      could not parse the columns:",
                  JSON.stringify({wrap, nav, rail, gap, pad}));
    return [wrap, nav, rail, gap, pad].every(n => n > 0) && wrap >= need;
  });

  console.log("\\nthe hero:");
  await check("the hero spans the viewport, not the centred column", async () => {
    G = normaliseGuide(DRAFT_FIXTURE); paint();
    const out = document.getElementById("main").innerHTML;
    return out.includes("g-hero-bleed");
  });
  await check("  and no longer sits inside guide-wrap", async () => {
    const out = document.getElementById("main").innerHTML;
    const hero = out.indexOf("g-hero-bleed");
    const wrap = out.indexOf("guide-wrap");
    /* The first guide-wrap in the document now belongs to the body below
       the hero, not to the hero itself. */
    return hero > -1 && (wrap === -1 || wrap > hero);
  });
  await check("they round-trip through publish and reload", async () => {
    const slug = await publishGuide(DRAFT_FIXTURE);
    const back = readStore()[slug];
    return back && Array.isArray(back.matchups) && back.matchups.length === 4
        && back.matchups.some(m => m.champ === "Ahri" && m.diff === "hard");
  });
  await check("and a list card counts them", async () => {
    const row = listPublished().find(r => r.matchups);
    return !!row && row.matchups === 4;
  });

  console.log("\\nthe guides list:");
  await check("cards carry the champion portrait", async () => {
    paintList();
    return document.getElementById("main").innerHTML.includes("g-card");
  });
  await check('the stale stored-in-this-browser line is gone', async () => {
    return !document.getElementById("main").innerHTML.includes("Stored in this browser");
  });

  await check("scrollspy survives no observer", async () => { watchSections(); return true; });

  console.log("\\nedge cases:");
  await check("masteries render with the bundled tree", async () => {
    /* loadMasteries() reads the bundled JADE_MASTERY_DISPLAY, no network. */
    loadMasteries();
    G = normaliseGuide(DRAFT_FIXTURE);
    return masteriesHtml().includes("mast-panels");
  });
  await check("an empty guide says so", async () => {
    G = normaliseGuide({}); paint();
    return document.getElementById("main").innerHTML.includes("still empty");
  });
  await check("no champion still renders", async () => {
    G = normaliseGuide({title:"No champ", sections:[{h:"x",b:"<p>y</p>"}]}); paint();
    return document.getElementById("main").innerHTML.includes("No champ");
  });
  await check("second setup tab renders", async () => {
    G = normaliseGuide(DRAFT_FIXTURE); view.setup = 1; paint();
    const out = document.getElementById("main").innerHTML;
    view.setup = 0;
    return out.length > 500;
  });
  await check("a half-filled skill page renders", async () => {
    G = normaliseGuide(DRAFT_FIXTURE); view.skills = 1;
    const out = skillsHtml(); view.skills = 0;
    return out.includes("Skill order");
  });
  /* A barely-started guide is the common case while writing, and the one
     that showed big empty gaps: a 230px hero with no art to fill it, and a
     186px nav column beside two paragraphs. */
  await check("a thin guide drops the nav column", async () => {
    G = normaliseGuide({title:"Just started", champ:"Kog'Maw",
                        sections:[{h:"Intro", b:"<p>One line.</p>"}]});
    ABILITIES_DOC = null;
    paint();
    return document.getElementById("main").innerHTML.includes("no-nav");
  });
  await check("  and does not claim the splash's height", async () => {
    return !heroHtml().includes("has-art");
  });
  await check("a full guide keeps the nav", async () => {
    G = normaliseGuide(DRAFT_FIXTURE);
    ABILITIES_DOC = {splash:"s.jpg", passive:null, spells:[]};
    paint();
    const out = document.getElementById("main").innerHTML;
    return !out.includes("no-nav") && out.includes("has-art");
  });
  await check("sections with nothing in them are omitted", async () => {
    G = normaliseGuide({title:"bare", champ:"Kog'Maw"});
    return !itemsHtml() && !runesHtml() && !skillsHtml();
  });

  console.log("\\nupvotes:");
  /* Publish the fixture so there is a record with a tally to move. */
  const SLUG = await publishGuide(DRAFT_FIXTURE);
  const asPublished = () => {
    G = normaliseGuide(readPublished(SLUG));
    G.source = "store"; G.slug = SLUG;
  };
  await check("a draft preview offers no vote", async () => {
    G = normaliseGuide(DRAFT_FIXTURE); G.source = "draft"; G.slug = "";
    return voteBtnHtml() === "";
  });
  /* A shared link renders the same page from packed text with no record
     behind it, so there is nothing a vote could be recorded against. */
  await check("a shared link offers no vote", async () => {
    G = normaliseGuide(DRAFT_FIXTURE); G.source = "hash"; G.slug = SLUG;
    return voteBtnHtml() === "";
  });
  await check("a published guide starts at zero", async () => {
    asPublished();
    return voteBtnHtml().includes("<b>0</b>") && voteBtnHtml().includes("upvotes");
  });
  await check("  and is not lit", async () => !voteBtnHtml().includes("g-vote on"));
  await check("voting counts it", async () => (await toggleVote(SLUG)).votes === 1);
  await check("  the button lights up", async () => voteBtnHtml().includes("g-vote on"));
  await check("  and reads as singular", async () => voteBtnHtml().includes(">upvote<"));
  await check("  and says so to a screen reader", async () => voteBtnHtml().includes('aria-pressed="true"'));
  await check("voting again takes it back", async () => (await toggleVote(SLUG)).votes === 0);
  await check("  and the button goes dark", async () => !voteBtnHtml().includes("g-vote on"));
  await check("one reader can only vote once", async () => {
    await toggleVote(SLUG); await toggleVote(SLUG); await toggleVote(SLUG);
    return voteCount(SLUG) === 1 && hasVoted(SLUG);
  });
  /* An author who fixes a typo must not lose what readers gave the guide —
     updateGuide rebuilds the record from the draft, so the tally has to be
     carried across explicitly. */
  await check("editing keeps the votes", async () => {
    await updateGuide(SLUG, {...DRAFT_FIXTURE, title:"AP Kog'Maw — revised"});
    return voteCount(SLUG) === 1;
  });
  await check("  and the author's vote", async () => hasVoted(SLUG));
  await check("a tally never goes below zero", async () => {
    const all = JSON.parse(localStorage.getItem("riftvault.published.v1"));
    all[SLUG].votes = 0;                         /* tally lost, vote kept */
    localStorage.setItem("riftvault.published.v1", JSON.stringify(all));
    await toggleVote(SLUG);                            /* un-votes against zero */
    return voteCount(SLUG) === 0;
  });
  await check("unpublishing forgets your vote", async () => {
    await toggleVote(SLUG);
    await unpublishGuide(SLUG);
    return !hasVoted(SLUG);
  });
  await check("voting on a guide that's gone says so", async () => {
    try{ await toggleVote(SLUG); return false; }
    catch(e){ return /no longer published/.test(e.message); }
  });

  /* ---- moderation ----
     The dangerous failure here is silent: a bug that shows the controls to
     the wrong person doesn't throw, it just quietly offers a button. The
     database is what actually enforces this — these only check that the
     client doesn't draw moderator controls for someone who isn't one. */
  console.log("\\nmoderation:");

  await check("no moderator controls with no backend", async () =>
    isModerator() === false);

  await check("  so the hero draws no mod button", async () => {
    G.slug = "seeded";
    return modBtnHtml() === "";
  });

  await check("a guide isn't hidden unless the row says so", async () =>
    isHidden("seeded") === false);

  await check("hiding offline refuses rather than pretending", async () => {
    try{ await setGuideHidden("seeded", true); return false; }
    catch(e){ return /live site/i.test(e.message); }
  });

  /* hidden is a column the moderator owns, like votes and views. Carried in
     the body jsonb an author's edit would drag a stale copy around. */
  await check("hidden is kept out of the guide body", async () => {
    const keep = globalThis.normaliseGuide;
    globalThis.normaliseGuide = undefined;
    let row;
    try{ row = toRow({title:"t", hidden:true, votes:9, views:9}, "s", "u", "n"); }
    finally{ globalThis.normaliseGuide = keep; }
    return row.body.hidden === undefined;
  });

  await check("a guide isn't featured unless the row says so", async () =>
    isFeatured("seeded") === false);

  await check("featuring offline refuses rather than pretending", async () => {
    try{ await setGuideFeatured("seeded", true); return false; }
    catch(e){ return /live site/i.test(e.message); }
  });

  /* featured matters more than hidden here. It is granted to NO client role
     at all — the only write path is an RPC that checks the moderator role
     itself — so a copy riding along inside the body jsonb would be the one
     place an author could put the value, and the home page reads the record
     rather than the column. */
  await check("featured is kept out of the guide body", async () => {
    const keep = globalThis.normaliseGuide;
    globalThis.normaliseGuide = undefined;
    let row;
    try{ row = toRow({title:"t", featured:true}, "s", "u", "n"); }
    finally{ globalThis.normaliseGuide = keep; }
    return row.body.featured === undefined && row.featured === undefined;
  });

  await check("  and the badge follows the column, not the body", async () => {
    /* fromRow spreads the body first and the columns after, so a body that
       claims featured:true is overwritten by a column that says false.
       Order-dependent, and the order is not obvious from reading it. */
    const g = fromRow({slug:"s", title:"t", body:{featured:true}, featured:false,
                       created_at:new Date().toISOString()});
    return g.featured === false;
  });

  /* ---- which patch a guide was checked on ----
     The byline used to print the LIVE patch, which reads as a claim the
     guide was written for it. These are mostly about what it must NOT say. */
  /* ---- the hero with no splash ----
     Graves has no period-correct art anywhere in the mode's files, so his
     splash is suppressed. That only works if the hero degrades: without
     has-art the block collapses to its content, and with it the CSS holds
     230px open for a picture that is not coming. */
  console.log("\\nthe hero without art:");

  await check("no splash means no has-art", async () => {
    const keep = ABILITIES_DOC;
    ABILITIES_DOC = {splash: null, spells: []};
    const html = heroHtml();
    ABILITIES_DOC = keep;
    return !/g-hero[^"]*has-art/.test(html);
  });

  await check("  and no empty image tag either", async () => {
    const keep = ABILITIES_DOC;
    ABILITIES_DOC = {splash: null, spells: []};
    const html = heroHtml();
    ABILITIES_DOC = keep;
    const zone = (/<div class="g-splash">([\\s\\S]*?)<\\/div>/.exec(html) || [,""])[1];
    return !/<img/.test(zone);
  });

  await check("  while art still produces has-art", async () => {
    const keep = ABILITIES_DOC;
    ABILITIES_DOC = {splash: "https://cdn/x.jpg", spells: []};
    const html = heroHtml();
    ABILITIES_DOC = keep;
    return /has-art/.test(html) && /<img src="https:\\/\\/cdn\\/x\\.jpg"/.test(html);
  });

  /* ---- the byline ----
     Its parts are optional and its separators are not part of them. A
     guide published before the patch column existed rendered
     "by sefferton ·  · 42 views" for weeks, because the template wrote the
     dots and only the middle piece went missing. */
  console.log("\\nthe byline:");

  const doubled = h => /·\\s*·/.test(h) || /^\\s*·/.test(h) || /·\\s*$/.test(h);

  await check("no stray separator when the patch stamp is missing", async () => {
    G.author = "sefferton"; G.patch = ""; G.slug = "s"; LIVE_PATCH = "16.19";
    const h = bylineHtml();
    return h.includes("sefferton") && !doubled(h);
  });
  await check("  (the detector catches a doubled separator)", async () =>
    doubled("by x ·  · 42 views") === true);

  await check("all three parts join cleanly", async () => {
    G.author = "sefferton"; G.patch = "16.16"; G.slug = "s"; LIVE_PATCH = "16.16";
    const h = bylineHtml();
    return h.includes("sefferton") && h.includes("16.16") && !doubled(h);
  });

  await check("an author on their own has no separators at all", async () => {
    G.author = "sefferton"; G.patch = ""; G.slug = ""; LIVE_PATCH = null;
    const h = bylineHtml();
    return h.includes("sefferton") && !/·/.test(h);
  });

  await check("no author, no leading separator", async () => {
    G.author = ""; G.patch = "16.16"; G.slug = ""; LIVE_PATCH = null;
    const h = bylineHtml();
    return h.includes("16.16") && !doubled(h);
  });

  await check("nothing at all is an empty line, not a lone dot", async () => {
    G.author = ""; G.patch = ""; G.slug = ""; LIVE_PATCH = null;
    return bylineHtml().trim() === "";
  });

  G.author = "Seth"; G.patch = ""; G.slug = "seeded"; LIVE_PATCH = null;

  console.log("\\nthe patch stamp:");

  await check("a stamped guide says which patch it was checked on", async () => {
    G.patch = "16.16"; LIVE_PATCH = null;
    return /Checked on patch 16\.16/.test(guidePatchText());
  });

  await check("  and flags it when the live patch has moved on", async () => {
    G.patch = "16.16"; LIVE_PATCH = "16.19";
    const out = guidePatchText();
    return /Checked on patch 16\.16/.test(out) && /live is 16\.19/.test(out);
  });

  await check("  but says nothing extra when they match", async () => {
    G.patch = "16.19"; LIVE_PATCH = "16.19";
    return !/live is/.test(guidePatchText());
  });

  /* The important one. Every guide published before the column existed has
     no stamp, and the honest answer there is silence — not today's patch,
     which is exactly the false claim this replaced. */
  await check("an unstamped guide claims nothing at all", async () => {
    G.patch = ""; LIVE_PATCH = "16.19";
    return guidePatchText() === "";
  });

  await check("  (and the check would notice a stamp that leaked back in)", async () => {
    G.patch = "16.19"; LIVE_PATCH = "16.19";
    return guidePatchText() !== "";
  });

  await check("the stamp is escaped like any other stored string", async () => {
    G.patch = '"><script>alert(1)</script>'; LIVE_PATCH = null;
    const out = guidePatchText();
    return !/<script/i.test(out) && !out.includes('">');
  });

  await check("patch is kept out of the guide body", async () => {
    const keep = globalThis.normaliseGuide;
    globalThis.normaliseGuide = undefined;
    let row;
    try{ row = toRow({title:"t", patch:"9.9"}, "s", "u", "n"); }
    finally{ globalThis.normaliseGuide = keep; }
    return row.body.patch === undefined;
  });

  /* With no live patch there is nothing to stamp WITH, and a guessed value
     would be worse than an absent one — the whole point of the column. */
  await check("nothing is stamped when the live patch is unknown", async () => {
    LIVE_PATCH = null;
    const row = toRow({title:"t"}, "s", "u", "n");
    return !("patch" in row);
  });

  await check("  and it is stamped when the live patch is known", async () => {
    LIVE_PATCH = "16.19";
    const row = toRow({title:"t"}, "s", "u", "n");
    return row.patch === "16.19";
  });

  G.patch = ""; LIVE_PATCH = null;

  /* ---- views ----
     Counting a read must never be able to cost the reader anything. With
     no backend there is nothing to count into, which is the state this
     harness runs in — so the important assertion is that it stays quiet
     and returns rather than throwing into the page's boot. */
  console.log("\\nviews:");

  await check("a view is not counted with no backend", async () =>
    (await recordView("anything")) === false);

  await check("counting a view never throws", async () => {
    /* Boot calls this without awaiting; an exception here would be an
       unhandled rejection on every guide page. */
    await recordView(null);
    await recordView("no-such-guide");
    return true;
  });

  await check("a guide with no views says nothing", async () => {
    G.slug = "seeded"; G.views = 0;
    return viewsText() === "";
  });

  await check("one view reads as singular", async () => {
    const all = readStore(); all["seeded"] = {slug:"seeded", views:1};
    localStorage.setItem("riftvault.published.v1", JSON.stringify(all));
    G.slug = "seeded";
    return viewsText().includes("1 view") && !viewsText().includes("views");
  });

  await check("  and two as plural", async () => {
    const all = readStore(); all["seeded"] = {slug:"seeded", views:2};
    localStorage.setItem("riftvault.published.v1", JSON.stringify(all));
    return viewsText().includes("2 views");
  });

  await check("a draft preview is never given a count", async () => {
    const keep = G.slug; G.slug = null;
    const out = viewsText(); G.slug = keep;
    return out === "";
  });

  /* The counts are columns the database keeps. Carried in the body jsonb
     they would become a stale second copy that an edit drags along.

     Tested with normaliseGuide out of the picture, because with it present
     this passes no matter what toRow does — it rebuilds the guide from an
     allowlist, so an unknown key never reaches the body and the assertion
     measures nothing. That path is real, not hypothetical: the reference
     pages load guide-store.js WITHOUT guide-load.js, and toRow falls back
     to the raw object when normaliseGuide is undefined. */
  await check("views are kept out of the guide body", async () => {
    const keep = globalThis.normaliseGuide;
    globalThis.normaliseGuide = undefined;
    let row;
    try{ row = toRow({title:"t", views: 999, votes: 7}, "s", "u", "n"); }
    finally{ globalThis.normaliseGuide = keep; }
    return row.body.views === undefined && row.body.votes === undefined;
  });

  await check("  (and the allowlist is the first line of defence)", async () =>
    normaliseGuide({title:"t", views: 999}).views === undefined);

  /* ---- chips get their pictures back ----
     The sanitiser deliberately strips the author's <img> and marks every
     chip "pending", on the promise that the renderer rebuilds the art from
     the token. The creator kept that promise; this page never did, so the
     first guide written by somebody outside the project came out with
     nineteen iconless blue words in it.

     Asserted through refIcon() rather than by looking for the class,
     because "pending" disappearing would also pass if hydrateRefs simply
     removed it without finding anything. */
  console.log("\\nreference chips resolve to art:");

  /* Seeded directly. The harness runs with fetch rejecting, which is the
     point elsewhere in this file — but a chip cannot resolve against a
     catalogue that was never delivered, and "no icon while offline" is
     correct behaviour, not the bug being tested. */
  ITEM_BY_ID = new Map([["3020", {id:"3020", name:"Sorcerer&#39;s Shoes",
                                  total:1100, icon:"sorc.png", inStore:true}]]);
  CHAMPIONS = [{id:"Ashe", name:"Ashe", key:"22", cls:"Marksman"}];

  await check("an item chip finds its icon", async () =>
    /<img[^>]+class="ref-ico"/.test(refIcon("item:3020")));
  await check("a champion chip finds its portrait", async () =>
    /<img[^>]+class="ref-ico"/.test(refIcon("champ:Ashe")));
  await check("an unknown token stays pending rather than guessing", async () =>
    refIcon("champ:NotAChampion") === "" && refIcon("bogus:1") === "");

  /* hydrateRefs() itself walks the real DOM — querySelectorAll and
     insertAdjacentHTML, neither of which this stub implements. A check
     written against the stub PASSED while doing nothing at all, which is
     the same trap as every other test in this repo that measured its own
     assumptions. So the DOM half is verified in a browser instead, and
     what is asserted here is the wiring: that paint() calls it, since the
     chips were iconless for the plainer reason that nothing ever ran. */
  await check("paint() runs the hydrator", async () =>
    /hydrateRefs\s*\(\s*\)/.test(String(paint)));

  console.log(failed ? "\\n" + failed + " failure(s)" : "\\nthe guide view renders end to end");
  if(failed) process.exitCode = 1;
})();
`;

global.DRAFT_FIXTURE = DRAFT;
(0, eval)(src);
