/* Build a self-contained page that runs the plan renderer in a REAL browser
   engine and asserts COMPUTED styles and rendered geometry.

   The node harnesses read the stylesheet as text and confirm a property was
   written. They cannot see the cascade, which is how a rule that never
   applied — the white typing box — passed twelve of them. This page asks the
   browser what it actually computed.

   Everything is inlined because the preview surface fetches nothing. */
const fs = require("fs");
const S = require("path").join(__dirname, "..") + "/";
const css   = fs.readFileSync(S + "site.css", "utf8");
const dmap  = fs.readFileSync(S + "data-map.js", "utf8");
const create= fs.readFileSync(S + "create.html", "utf8");
/* the creator's OWN style block, so the cascade fight is the real one */
const pageCss = (create.match(/<style>([\s\S]*?)<\/style>/) || [,""])[1];
const b64 = f => fs.readFileSync(S + "art/" + f).toString("base64");
const plate = "data:image/jpeg;base64," + b64("rift-season3-clean.jpg");
const wg = "data:image/png;base64," + b64("ward-green.png");
const wp = "data:image/png;base64," + b64("ward-pink.png");

/* MAP_IMAGE and MAP_WARD_ICON are const in the real file -- assigning over
   them throws. Substitute the values into the source, asserting each hit, so
   the page uses data: URLs without the file being edited. */
const sub = (src, name, value) => {
  const re = new RegExp("const " + name + "\\s*=\\s*[^;]+;");
  if(!re.test(src)) throw new Error("no " + name + " to substitute");
  return src.replace(re, "const " + name + " = " + value + ";");
};
let dm = dmap.replace(/<\/script>/g, "<\\/script>");
dm = sub(dm, "MAP_IMAGE", JSON.stringify(plate));
dm = sub(dm, "MAP_WARD_ICON",
  JSON.stringify({ward: wg, pink: wp}));

const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>browser check</title>
<style>${css}</style>
<style>${pageCss}</style>
<style>
 body{background:#d9c9a3;font:13px system-ui;padding:14px;margin:0}
 #res{font:12.5px ui-monospace,monospace;white-space:pre;line-height:1.45}
 .ok{color:#1d6b33}.bad{color:#b02020;font-weight:700}
 #stage{width:560px;position:relative}
 h2{font:600 15px system-ui;margin:0 0 8px}
</style></head><body>
<h2 id="head">running…</h2>
<div id="res"></div>
<div class="plan-canvas" id="stage"></div>
<script>${dm}</script>
<script>
window.onerror = (m, f, l) => {
  document.getElementById("head").textContent = "script error: " + m + " (line " + l + ")";
  document.getElementById("head").className = "bad";
};
const out = [];
let bad = 0;
const t = (name, fn) => {
  let pass = false, note = "";
  try { const r = fn(); pass = r === true; if(r !== true && r !== false) note = " — " + r; }
  catch(e){ note = " — threw: " + e.message; }
  if(!pass) bad++;
  out.push((pass ? "ok   " : "FAIL ") + name + note);
};

const plan = {
  routes:[{colour:"blue", label:"Levels 1-4",
           steps:[{place:"blue-buff"},{place:"blue-wolves"},{place:"blue-wraiths"}]}],
  markers:[{place:"blue-wraiths",kind:"ward"},{place:"red-buff",kind:"pink"},
           {place:"baron",kind:"danger"},{place:"dragon",kind:"objective"},
           {x:0.5,y:0.3,kind:"text",text:"freeze here"}],
  ink:[{colour:"red",w:9,pts:[[0.2,0.2],[0.4,0.4]]}]
};
const stage = document.getElementById("stage");
stage.innerHTML = mapFigure("photo", mapPlanSvg(plan)) +
  '<input class="plan-text-input" type="text" value="typing" style="left:50%;top:30%">';

const css$ = (sel, prop) => getComputedStyle(document.querySelector(sel)).getPropertyValue(prop);

/* --- the class of bug the node harnesses cannot see --- */
t("the label typing box really computes a transparent background", () => {
  const bg = css$(".plan-text-input", "background-color");
  return /rgba\\(0, 0, 0, 0\\)|transparent/.test(bg) ? true : "computed " + bg;
});
t("  and is not stretched by the page's generic input width", () => {
  const w = parseFloat(css$(".plan-text-input", "width"));
  return w < 400 ? true : "computed width " + w + "px";
});
t("map labels compute as not bold", () => {
  const fw = css$(".pl-text", "font-weight");
  return (fw === "400" || fw === "normal") ? true : "computed " + fw;
});
t("a hidden tool group really computes display:none", () => {
  const g = document.createElement("div");
  g.className = "pt-group"; g.hidden = true; document.body.appendChild(g);
  const d = getComputedStyle(g).display; g.remove();
  return d === "none" ? true : "computed " + d;
});

/* --- geometry: does the overlay line up with the map --- */
t("the map figure renders square", () => {
  const r = document.querySelector(".m-fig").getBoundingClientRect();
  return Math.abs(r.width - r.height) < 2 ? true : r.width + "x" + r.height;
});
/* The real invariant is not "plan matches figure" -- it is that the surface
   clicks are measured against, the art, and the snap preview all occupy ONE
   box. A 1px border on .m-fig broke this: inset:0 resolves against the
   padding box, so the art shrank while the click surface did not. */
const same = (a, b) => Math.abs(a.width-b.width) < 0.5 && Math.abs(a.height-b.height) < 0.5 &&
                       Math.abs(a.top-b.top) < 0.5 && Math.abs(a.left-b.left) < 0.5;
const say = (a, b) => Math.round(a.width) + "@" + a.left.toFixed(1) +
                      " vs " + Math.round(b.width) + "@" + b.left.toFixed(1);
t("the plan layer sits exactly on the map art", () => {
  const a = document.querySelector(".m-photo").getBoundingClientRect();
  const b = document.querySelector(".m-plan").getBoundingClientRect();
  return same(a, b) ? true : say(a, b);
});
t("the art fills the frame clicks are measured against", () => {
  const a = document.querySelector("#stage").getBoundingClientRect();
  const b = document.querySelector(".m-photo").getBoundingClientRect();
  return same(a, b) ? true : say(a, b);
});
t("the snap preview shares that same box", () => {
  const g = document.createElement("div");   /* stand-in for .plan-ghost: a */
  g.className = "plan-ghost";                /* sibling of .m-fig, inset:0   */
  document.querySelector("#stage").appendChild(g);
  const a = g.getBoundingClientRect();
  const b = document.querySelector(".m-photo").getBoundingClientRect();
  g.remove();
  return same(a, b) ? true : say(a, b);
});
t("a route stop lands on the camp it names", () => {
  /* the first pip must sit where blue-buff is drawn */
  const camp = MAP_CAMPS.find(c => c.key === "blue-buff");
  const fig = document.querySelector(".m-photo").getBoundingClientRect();
  const pip = document.querySelector(".pl-pip circle").getBoundingClientRect();
  const wantX = fig.left + camp.x / MAP_SIZE * fig.width;
  const wantY = fig.top  + camp.y / MAP_SIZE * fig.height;
  const gotX = pip.left + pip.width/2, gotY = pip.top + pip.height/2;
  const off = Math.hypot(gotX - wantX, gotY - wantY);
  return off < 0.6 ? true : "off by " + off.toFixed(1) + "px";
});
t("the ward icons actually load", () => {
  const imgs = [...document.querySelectorAll(".pl-mark")].filter(e => e.tagName === "image");
  return imgs.length >= 2 ? true : "found " + imgs.length;
});
t("the author's text label is drawn", () => {
  const el = document.querySelector(".pl-text");
  return el && el.textContent === "freeze here" ? true : "missing";
});
t("every plan colour resolves to a real colour", () => {
  const stroke = document.querySelector(".pl-line").getAttribute("stroke");
  return /^#[0-9a-f]{6}$/i.test(stroke) ? true : "stroke " + stroke;
});

/* dump the real boxes so a mismatch names its own cause */
const box = sel => { const r = document.querySelector(sel).getBoundingClientRect();
  const cs = getComputedStyle(document.querySelector(sel));
  return sel + "  " + r.width.toFixed(1) + "x" + r.height.toFixed(1) +
    "  at " + r.left.toFixed(1) + "," + r.top.toFixed(1) +
    "  border " + cs.borderTopWidth + "/" + cs.borderLeftWidth +
    "  pad " + cs.paddingTop + "/" + cs.paddingLeft +
    "  pos " + cs.position + "  inset " + cs.top + "/" + cs.left; };
out.push("");
["#stage", ".m-fig", ".m-photo", ".m-overlay", ".m-plan"].forEach(se => {
  try { out.push("     " + box(se)); } catch(e){ out.push("     " + se + " missing"); }
});

/* The preview surface fetches nothing from the network, which reproduces an
   icon-host outage exactly. Give the browser a moment to fail the thirty
   requests, then check the map did not fill with broken-image glyphs. */
const late = () => {
  const n0 = out.length, b0 = bad;
  t("a dead icon host leaves no broken images", () => {
    const left = document.querySelectorAll(".m-struct image, .m-camp image, .m-pit image").length;
    return left === 0 ? true : left + " failed icons still in the document";
  });
  t("  and the markers underneath come back", () => {
    const lit = document.querySelectorAll("[data-noicon]").length;
    if(!lit) return "nothing was marked as missing an icon";
    const o = getComputedStyle(document.querySelector(".m-struct[data-noicon] rect, .m-struct[data-noicon] path")).opacity;
    return Number(o) > .9 ? true : "backing shape still at opacity " + o;
  });
  document.getElementById("res").innerHTML = out
    .map(l => '<div class="' + (l.startsWith("FAIL") ? "bad" : "ok") + '">' + l + "</div>").join("");
  document.getElementById("head").textContent =
    bad ? (bad + " FAILED of " + out.length) : ("all " + out.length + " browser checks passed");
  document.getElementById("head").className = bad ? "bad" : "ok";
};
setTimeout(late, 1200);

document.getElementById("res").innerHTML = out
  .map(l => '<div class="' + (l.startsWith("FAIL") ? "bad" : "ok") + '">' + l + "</div>").join("");
document.getElementById("head").textContent =
  bad ? (bad + " FAILED of " + out.length) : ("all " + out.length + " browser checks passed");
document.getElementById("head").className = bad ? "bad" : "ok";
</script></body></html>`;
const dest = process.argv[2] || (S + "tools/browser-check.html");
fs.writeFileSync(dest, page);
console.log("built " + dest + " (" + (page.length/1024).toFixed(0) + " KB)");
console.log("Open it in a browser. The node harnesses read the stylesheet as\ntext; this one asks a real engine what it COMPUTED, which is how the\nwhite typing box passed twelve checks while being broken.");
