/* Render the PUBLISHED game-plan section -- what a reader sees on a guide,
   not what an author sees in the editor -- as a self-contained page.

   The markup is not reimplemented here. plansHtml and tabs are lifted out of
   guide.html verbatim at build time (asserted), with only their small
   dependencies stubbed, so what renders is the real section. */
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "..") + "/";
const css   = fs.readFileSync(S + "site.css", "utf8");
const dmap  = fs.readFileSync(S + "data-map.js", "utf8");
const guide = fs.readFileSync(S + "guide.html", "utf8");
const demo  = fs.readFileSync(S + "demo-plans.html", "utf8");

/* guide.html carries its own <style> block -- .g-sec, .g-body, the heading
   plates. Without it the preview was showing the section unstyled against a
   black page, which is not what a reader sees. */
const guideCss = (guide.match(/<style>([\s\S]*?)<\/style>/) || [,""])[1];
if(!/\.g-sec\s*{/.test(guideCss))
  throw new Error("guide.html's style block no longer defines .g-sec");

/* lift a top-level function out of guide.html by brace matching */
function lift(src, sig){
  const i = src.indexOf(sig);
  if(i < 0) throw new Error("not found: " + sig);
  let d = 0, j = src.indexOf("{", i);
  for(let k = j; k < src.length; k++){
    if(src[k] === "{") d++;
    else if(src[k] === "}" && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error("unbalanced: " + sig);
}
const plansHtml = lift(guide, "function plansHtml()");
const tabsFn    = lift(guide, "function tabs(name, pages, current)");
if(!/mapFigure\("photo", mapPlanSvg\(p\)\)/.test(plansHtml))
  throw new Error("plansHtml no longer renders the figure the way this page assumes");

/* the demo plans, parsed from the dev page rather than re-typed */
const m = demo.match(/const DEMO = (\[[\s\S]*?\n\]);/);
if(!m) throw new Error("could not find DEMO in demo-plans.html");
const DEMO = JSON.parse(m[1]);

const b64 = f => fs.readFileSync(S + "art/" + f).toString("base64");
const sub = (src, name, value) => {
  const re = new RegExp("const " + name + "\\s*=\\s*[^;]+;");
  if(!re.test(src)) throw new Error("no " + name + " to substitute");
  return src.replace(re, "const " + name + " = " + value + ";");
};
let dm = dmap.replace(/<\/script>/g, "<\\/script>");
dm = sub(dm, "MAP_IMAGE", JSON.stringify("data:image/jpeg;base64," + b64("rift-season3-clean.jpg")));
dm = sub(dm, "MAP_WARD_ICON", JSON.stringify({
  ward: "data:image/png;base64," + b64("ward-green.png"),
  pink: "data:image/png;base64," + b64("ward-pink.png")}));

const page = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Published guide — game plan</title>
<style>${css}</style>
<style>${guideCss}</style>
<style>
 /* only the chrome the hero would otherwise provide; nothing here touches
    .plan-*, .m-* or .g-* */
 .which{font:600 12px system-ui;letter-spacing:.08em;text-transform:uppercase;
   color:#9a8c74;margin:0 0 10px;padding-top:18px}
 .sheet{display:grid;grid-template-columns:1fr 1fr;gap:20px 24px}
 .sheet .cell .g-sec > h2{display:none}      /* one heading, not five */
 .sheet .cell .plan-note{font-size:13px}
</style></head><body>
<!-- the real wrapper from guide.html: guide-wrap > g-body > main -->
<div class="guide-wrap">
  <p class="which">as a reader sees it</p>
  <div class="g-body no-nav"><main id="out"></main></div>
</div>
<script>${dm}</script>
<script>
const esc = s => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const G = {plans: ${JSON.stringify(DEMO)}};
const view = {plan: 0};
${tabsFn}
${plansHtml}
/* ?all -- every plan at once, for looking at them side by side. Each one
   still goes through the real plansHtml; only the viewing frame differs. */
const ALL = location.search.indexOf("all") >= 0 || location.hash.indexOf("all") >= 0;
const paint = () => {
  const o = document.getElementById("out");
  if(!ALL){ o.innerHTML = plansHtml(); return; }
  const all = G.plans, keep = view.plan;
  o.innerHTML = '<div class="sheet">' + all.map((_, i) => {
    view.plan = i;
    G.plans = [all[i]];          /* one at a time, so no tab strip */
    return '<div class="cell">' + plansHtml() + '</div>';
  }).join("") + '</div>';
  G.plans = all; view.plan = keep;
};
paint();
/* the published tab strip is wired on the real page too */
document.getElementById("out").addEventListener("click", e => {
  const b = e.target.closest("[data-tab=plan]");
  if(b){ view.plan = +b.dataset.i; paint(); }
});
</script></body></html>`;
const dest = process.argv[2] || (S + "tools/guide-preview.html");
fs.writeFileSync(dest, page);
console.log("built " + dest + " (" + (page.length/1024).toFixed(0) + " KB), " +
            DEMO.length + " plans: " + DEMO.map(p => p.title).join(", "));
