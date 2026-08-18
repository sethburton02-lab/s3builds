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
src += `
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
  await check("one listener serves them all", async () => TIP_KINDS.length === 4);

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

  console.log(failed ? "\\n" + failed + " failure(s)" : "\\nthe guide view renders end to end");
  if(failed) process.exitCode = 1;
})();
`;

global.DRAFT_FIXTURE = DRAFT;
(0, eval)(src);
