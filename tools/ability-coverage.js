/* ============================================================
   Ability tooltip coverage

       node tools/ability-coverage.js <site-dir>            summary
       node tools/ability-coverage.js <site-dir> --misses   every unresolved token

   NEEDS THE NETWORK. Unlike every other harness here this one talks to
   Community Dragon, because the question it answers is about Riot's data
   rather than about this code: of all the @Placeholders@ in the mode's
   ability text, how many can the reader in site.js actually fill in?

   ability-check.js proves the reader is correct on known shapes. This
   proves it is correct ENOUGH across all 72 champions — and that number
   moves on its own. A patch can add an ability built from a formula shape
   the reader skips, and nothing else on the site would notice. Run it
   after a patch and compare against the figure below.

   Measured when written, patch 26.19: 97% of real tokens resolve. The rest
   depend on something a resting tooltip has no value for — a stack count,
   the reader's level, a live resource — and are deliberately skipped.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const showMisses = process.argv.includes("--misses");

/* Node's own fetch, taken BEFORE site.js is evaluated — site.js is browser
   code and the stub below replaces the global one while it loads. */
const realFetch = globalThis.fetch.bind(globalThis);

const PLUGIN = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";
const GAME   = "https://raw.communitydragon.org/latest/game/data/characters";

/* ---- the minimum browser surface site.js needs in order to load ---- */
class El {
  constructor(){ this.style = {setProperty(){}}; this.dataset = {}; this._html = "";
    this.classList = {add(){}, remove(){}, toggle(){}, contains: () => false};
    this.textContent = ""; this.value = ""; }
  get innerHTML(){ return this._html; } set innerHTML(v){ this._html = String(v); }
  setAttribute(){} getAttribute(){ return null; } removeAttribute(){}
  appendChild(c){ return c; } remove(){} addEventListener(){}
  querySelector(){ return null; } querySelectorAll(){ return []; } closest(){ return null; }
}
global.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => new El(), createElementNS: () => new El(),
  addEventListener(){}, removeEventListener(){},
  body: new El(), documentElement: new El(), readyState: "complete", title: ""
};
global.window = global; global.self = global;
global.location = {href: "file:///x.html", search: "", hash: "", protocol: "file:"};
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
global.fetch = async () => { throw new Error("site.js should not fetch at load"); };

(0, eval)(fs.readFileSync(path.join(dir, "site.js"), "utf8"));

const json = async url => {
  const res = await realFetch(url);
  if(!res.ok) throw new Error(res.status + " " + url);
  return res.json();
};

/* Tokens that are never a number: client boilerplate, and the cost and
   cooldown the tooltip prints from its own fields. Same list site.js uses;
   duplicated rather than exported because it is a property of Riot's text
   format, and a copy that drifts would only make this report wrong, not
   the site. */
const BOILERPLATE = /^(SpellModifierDescriptionAppend|AbilityResourceName|Cost|Cooldown|f\d+)$/;

(async function(){
  let roster;
  try{
    roster = (await json(PLUGIN + "/v1/champion-summary.json"))
      .filter(c => /^Jade_/i.test(c.alias || ""));
  }catch(err){
    console.error("Couldn't reach Community Dragon:", err.message);
    console.error("This harness needs the network; the rest of the suite doesn't.");
    process.exit(2);
  }

  let tokens = 0, resolved = 0, boilerplate = 0, unreadable = 0;
  const misses = new Map();
  const perChamp = [];

  for(const c of roster){
    const slug = c.alias.replace(/^Jade_/i, "").toLowerCase();
    let bin, doc;
    try{
      [bin, doc] = await Promise.all([
        json(`${GAME}/jade_${slug}/jade_${slug}.bin.json`),
        json(`${PLUGIN}/v1/champions/${c.id}.json`)
      ]);
    }catch(err){
      console.log(`  ${c.name}: ${err.message}`);
      unreadable++;
      continue;
    }

    let champTok = 0, champOk = 0;
    for(const sp of (doc.spells || [])){
      const letter = String(sp.spellKey || "").toUpperCase();
      const scope = CLASSIC.spellScope(bin, letter);
      const ranks = letter === "R" ? 3 : 5;
      for(const m of String(sp.dynamicDescription || "")
                       .matchAll(/@([A-Za-z0-9_.]+)(\*[\d.]+)?@/g)){
        tokens++;
        if(BOILERPLATE.test(m[1])){ boilerplate++; continue; }
        champTok++;
        const got = scope ? CLASSIC.calcText(m[1], scope, ranks) : null;
        if(got !== null && got !== undefined){ resolved++; champOk++; }
        else misses.set(`${c.name} ${letter} @${m[1]}@`,
                        (misses.get(`${c.name} ${letter} @${m[1]}@`) || 0) + 1);
      }
    }
    if(champTok) perChamp.push([c.name, champOk, champTok]);
  }

  const real = tokens - boilerplate;
  const pct = real ? (resolved / real * 100) : 0;

  console.log(`\nchampions read      ${roster.length - unreadable} of ${roster.length}`);
  console.log(`tooltip tokens      ${tokens} (${boilerplate} boilerplate)`);
  console.log(`resolved            ${resolved} of ${real}  ${pct.toFixed(1)}%`);

  const worst = perChamp.filter(([, ok, n]) => ok < n)
    .sort((a, b) => (a[1] / a[2]) - (b[1] / b[2])).slice(0, 10);
  if(worst.length){
    console.log("\nchampions with gaps:");
    for(const [name, ok, n] of worst)
      console.log(`  ${name.padEnd(18)} ${ok}/${n}`);
  }
  if(showMisses && misses.size){
    console.log("\nevery unresolved token:");
    for(const [k] of [...misses].sort()) console.log("  " + k);
  }else if(misses.size){
    console.log(`\n${misses.size} distinct unresolved tokens — rerun with --misses to list them.`);
  }

  /* A threshold rather than a pass/fail on zero: some tokens genuinely
     cannot be resolved at rest, and demanding 100% would mean a harness
     that is always red and therefore never read. */
  if(pct < 90){
    console.log(`\nFAIL  coverage fell below 90% — a new formula shape probably needs handling.`);
    process.exit(1);
  }
  console.log(`\ncoverage holds`);
})();
