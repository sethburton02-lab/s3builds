/* ============================================================
   Page smoke check

       node tools/stub-check.js <site-dir> <page.html>
       node tools/stub-check.js .                     (every page)

   Runs a page's scripts under the conditions it actually ships in —
   opened from file://, so no fetch — against a DOM stub with enough
   surface for the render functions to execute. It catches the things
   that are invisible until you open the page: a typo, a missing id, a
   function called before it is defined, a template literal that throws.

   It does NOT do layout, styling or events. Anything about how the page
   looks, or what happens when you click, needs a real browser.

   Two details that matter and are easy to get wrong:

     · all scripts are concatenated into ONE eval. `let` and `const` at
       the top level of eval code are scoped to that eval, so evaluating
       each file separately would hide every cross-file binding — every
       page would fail on the first shared constant it touched.

     · ids are seeded from the page AND from the scripts, because site.js
       injects chrome carrying ids the page file never mentions.
   ============================================================ */

const fs = require("fs");
const path = require("path");

function checkPage(dir, file){
  const html = fs.readFileSync(path.join(dir, file), "utf8");

  class El {
    constructor(tag = "div"){
      this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
      this.style = {setProperty(){}, removeProperty(){}};
      this.dataset = {}; this.attrs = {}; this._html = "";
      this.classList = {
        _s: new Set(),
        add: (...c) => c.forEach(x => x && this.classList._s.add(x)),
        remove: (...c) => c.forEach(x => this.classList._s.delete(x)),
        toggle: (c, f) => { f === undefined
          ? (this.classList._s.has(c) ? this.classList._s.delete(c) : this.classList._s.add(c))
          : (f ? this.classList._s.add(c) : this.classList._s.delete(c)); },
        contains: c => this.classList._s.has(c)
      };
      this.value = ""; this.textContent = ""; this.hidden = false;
      this.disabled = false; this.checked = false; this.onclick = null;
      this.maxLength = 0; this.type = "";
    }
    get className(){ return [...this.classList._s].join(" "); }
    set className(v){ this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get innerHTML(){ return this._html; }  set innerHTML(v){ this._html = String(v); }
    get outerHTML(){ return this._html; }  set outerHTML(v){ this._html = String(v); }
    setAttribute(k, v){ this.attrs[k] = String(v); }
    getAttribute(k){ return this.attrs[k] ?? null; }
    removeAttribute(k){ delete this.attrs[k]; }
    appendChild(c){ c.parentNode = this; this.children.push(c); return c; }
    replaceWith(){} remove(){} focus(){} select(){} blur(){} click(){}
    addEventListener(){} removeEventListener(){} scrollIntoView(){}
    prepend(){} append(){} before(){} after(){} replaceChildren(){}
    setAttributeNS(){} matches(){ return false; }
    insertAdjacentHTML(){} cloneNode(){ return new El(this.tagName); }
    getBoundingClientRect(){ return {top:0,left:0,width:0,height:0,bottom:0,right:0}; }
    querySelector(sel){ return global.__bySel ? global.__bySel(sel) : null; }
    querySelectorAll(){ return []; }
    closest(){ return null; } contains(){ return false; }
  }

  const byId = new Map();
  for(const m of html.matchAll(/id="([\w-]+)"/g)) byId.set(m[1], new El());

  const bySel = sel => {
    const m = /^#([\w-]+)$/.exec(String(sel).trim());
    return m ? (byId.get(m[1]) || null) : null;
  };
  global.__bySel = bySel;

  global.document = {
    getElementById: id => byId.get(id) || null,
    querySelector: bySel, querySelectorAll: () => [],
    createElement: t => new El(t), createElementNS: (ns, t) => new El(t),
    addEventListener(){}, removeEventListener(){},
    body: new El("body"), documentElement: new El("html"),
    activeElement: null, title: "", readyState: "complete",
    getSelection: () => null, execCommand: () => false,
    queryCommandState: () => false, queryCommandValue: () => ""
  };
  global.window = global; global.self = global;
  global.location = {href: "file:///" + file, search: "", hash: "",
                     pathname: "/" + file, protocol: "file:",
                     replace(){}, assign(){}, reload(){}};
  global.navigator = {userAgent: "stub"};
  global.localStorage = {
    _d: new Map(),
    getItem(k){ return this._d.has(k) ? this._d.get(k) : null; },
    setItem(k, v){ this._d.set(k, String(v)); },
    removeItem(k){ this._d.delete(k); }
  };
  global.sessionStorage = global.localStorage;
  global.fetch = () => Promise.reject(new Error("fetch blocked (file:// conditions)"));
  global.addEventListener = () => {}; global.removeEventListener = () => {};
  global.requestAnimationFrame = cb => setTimeout(cb, 0);
  global.matchMedia = () => ({matches: false, addListener(){}, addEventListener(){}});
  global.innerWidth = 1920; global.innerHeight = 1080; global.scrollY = 0;
  global.confirm = () => true; global.alert = () => {}; global.prompt = () => null;
  global.structuredClone = v => JSON.parse(JSON.stringify(v));
  global.Image = El; global.HTMLImageElement = El;
  global.getComputedStyle = () => ({getPropertyValue: () => ""});

  let src = "", failed = false;
  for(const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)){
    const p = path.join(dir, m[1]);
    if(!fs.existsSync(p)){ console.log(`  ${file}: missing ${m[1]}`); failed = true; continue; }
    src += fs.readFileSync(p, "utf8") + "\n;\n";
  }
  for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) src += m[1] + "\n;\n";

  /* Chrome that site.js injects carries ids the page file never mentions. */
  for(const m of src.matchAll(/id="([\w-]+)"/g))
    if(!byId.has(m[1])) byId.set(m[1], new El());

  try{
    (0, eval)(src);
  }catch(e){
    console.log(`  ${file}: ${e.name}: ${e.message}`);
    if(process.env.TRACE) console.log(e.stack);
    if(["SyntaxError", "ReferenceError", "TypeError"].includes(e.name)) failed = true;
  }

  /* Every page wears the shared chrome. This is here because create.html
     didn't — it carried a hand-written header from before renderChrome
     existed, so the creator had no account corner, no art switch and a nav
     item for a page that was never built. Nothing caught it: a page with
     its own header boots perfectly well.

     paintAccount() fills #account, so an empty one means renderChrome()
     was never called. */
  /* A redirect stub is not a page and has no chrome to wear. */
  const isRedirect = /http-equiv="refresh"/.test(html);
  const acct = byId.get("account");
  if(!isRedirect && (!acct || !acct.innerHTML)){
    console.log(`  ${file}: no account corner — renderChrome() wasn't called`);
    failed = true;
  }

  /* A page that loads guide-store.js but never calls loadStore() gets an
     empty cache, so backendLive() answers false and the page silently uses
     localStorage instead of the database. It looks completely fine. Every
     page was in that state once, because wiring the adapter and calling it
     are two jobs and only the first one is visible in a diff. */
  if(/guide-store\.js/.test(html) && !/loadStore\(\)/.test(html)){
    console.log(`  ${file}: loads the store but never calls loadStore()`);
    failed = true;
  }

  console.log(`${failed ? "FAIL" : "PASS"} ${file}`);
  return failed;
}

const dir = process.argv[2] || ".";
const one = process.argv[3];

/* Named a page: check it here and stop. Named none: fan out to one child
   process per page, because the globals above are set once and a second
   page in the same process would inherit the first one's state. The child
   is this same file with a page argument, which is why this branch has to
   come first — without it the child would fan out again, forever. */
if(one){
  process.exit(checkPage(dir, one) ? 1 : 0);
}

const pages = fs.readdirSync(dir).filter(f => f.endsWith(".html")).sort();
let bad = 0;
for(const page of pages){
  const r = require("child_process").spawnSync(process.execPath,
    [__filename, dir, page], {encoding: "utf8", env: process.env});
  process.stdout.write(r.stdout || "");
  if((r.stdout || "").includes("FAIL")) bad++;
}
console.log(`\n${pages.length - bad}/${pages.length} pages OK`);
process.exit(bad ? 1 : 0);
