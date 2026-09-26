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
