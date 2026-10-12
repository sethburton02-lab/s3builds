/* The moderation page's engagement section.

   Rendering is a pure function of one object, so it is lifted out of
   moderate.html and run directly rather than booting the page. The thing
   most worth asserting is not the layout but the WORDING: the site records
   views of guide pages and nothing else, so a panel that said "site
   visits" would be showing a number that looks like traffic and isn't.
   That is a correctness property, and it is the sort that drifts silently.

   Run: node tools/moderate-check.js
*/
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "moderate.html"), "utf8");

function lift(name){
  const i = src.indexOf("function " + name);
  if(i < 0) throw new Error("not found: " + name);
  let d = 0;
  for(let k = src.indexOf("{", i); k < src.length; k++){
    if(src[k] === "{") d++;
    else if(src[k] === "}" && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error("unbalanced: " + name);
}
const nLine = src.split("\n").find(l => l.trim().startsWith("const n = v =>"));
if(!nLine) throw new Error("the number formatter moved");

global.esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
(0, eval)(nLine + "\n" + lift("engagementHtml") + "\n;globalThis.__E = engagementHtml;");
const render = globalThis.__E;

let failed = 0;
const check = (label, fn) => {
  let ok = false, note = "";
  try { const r = fn(); ok = r === true; if(r !== true && r !== false) note = " — " + r; }
  catch(e){ note = " — threw: " + e.message; }
  console.log((ok ? "ok    " : "FAIL  ") + label + note);
  if(!ok) failed++;
};

const FULL = {accounts: 12, accounts_7d: 3, guide_views: 1643, viewers: 376,
  views_7d: 210, comments_live: 4, comments_hidden: 2, votes: 10,
  guides_live: 11, guides_hidden: 1, first_day: "2026-08-19", last_day: "2026-10-12"};

console.log("engagement panel:");
check("every count reaches the page", () => {
  const h = render(FULL);
  return ["12", "376", "10", "11"].every(v => h.includes(v));
});
check("  large numbers are grouped, not run together", () =>
  render(FULL).includes("1,643"));
check("  the date span is stated", () => {
  const h = render(FULL);
  return h.includes("2026-08-19") && h.includes("2026-10-12");
});

/* The honesty checks. */
check("it says guide views, not site visits", () => {
  const h = render(FULL).toLowerCase();
  return h.includes("guide views") && !h.includes("site visit");
});
check("  and says plainly what isn't counted", () => {
  const h = render(FULL).toLowerCase();
  return h.includes("only guide pages are counted");
});

check("hidden counts show only when there are some", () => {
  const some = render(FULL);
  const none = render({...FULL, comments_hidden: 0, guides_hidden: 0});
  return some.includes("2 hidden") && !none.includes("hidden");
});
check("a missing number renders as a dash, not undefined or NaN", () => {
  const h = render({accounts: 5});
  return !h.includes("undefined") && !h.includes("NaN") && h.includes("–");
});
check("no backend says so instead of showing zeroes", () => {
  const h = render(null);
  return h.includes("need the database") && !h.includes("eng-grid");
});
check("values are escaped on the way out", () => {
  const h = render({...FULL, first_day: '<img src=x onerror=alert(1)>'});
  return !h.includes("<img") && h.includes("&lt;img");
});

console.log(failed ? "\n" + failed + " failure(s)" : "\nthe engagement panel holds up");
process.exitCode = failed ? 1 : 0;
