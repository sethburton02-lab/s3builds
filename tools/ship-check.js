/* Pre-deploy check: what Cloudflare will actually serve.

   wrangler.jsonc sets "directory": "./", so the whole repo ships except
   what .assetsignore excludes. That file was added this cycle, which makes
   it the newest and least-tested thing in the deploy path -- and the
   failure mode is not a test going red, it is the live site 404ing on a
   script that works perfectly on localhost.

   So this resolves every asset the pages reference and confirms it both
   exists AND survives .assetsignore. It also looks for secrets in anything
   shipping, and checks the cache version is consistent. */
const fs = require("fs"), path = require("path");
const repo = path.join(__dirname, "..");
let bad = 0;
const flag = s => { bad++; console.log("  FAIL  " + s); };
const ok   = s => console.log("  ok    " + s);

/* ---- .assetsignore, as wrangler reads it: a path is excluded when a line
        matches it exactly or is a directory prefix of it ---- */
const ig = fs.readFileSync(path.join(repo, ".assetsignore"), "utf8")
  .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
const excluded = rel => ig.some(p => p.endsWith("/") ? rel.startsWith(p) : rel === p);

/* ---- every local asset the pages ask for ---- */
const pages = fs.readdirSync(repo).filter(f => f.endsWith(".html"));
const shipped = pages.filter(p => !excluded(p));
console.log("pages: " + pages.length + " in the repo, " + shipped.length + " shipping\n");

console.log("every referenced asset ships:");
const refs = new Map();
for(const p of shipped){
  const html = fs.readFileSync(path.join(repo, p), "utf8");
  const found = [];
  for(const re of [/<script[^>]+src="([^"]+)"/g, /<link[^>]+href="([^"]+)"/g,
                   /url\((['"]?)([^)'"]+)\1\)/g, /<img[^>]+src="([^"]+)"/g]){
    for(const m of html.matchAll(re)) found.push(m[2] !== undefined ? m[2] : m[1]);
  }
  for(let u of found){
    if(/^(https?:|data:|mailto:|#|\/\/)/.test(u)) continue;
    /* src="${esc(sp.icon)}" is a template expression, not a path. Treating
       one as a filename produced eighteen imaginary missing assets on the
       first run and buried the single real finding. */
    if(u.includes("${")) continue;
    const rel = u.split("?")[0].replace(/^\.\//, "");
    if(!rel) continue;
    if(!refs.has(rel)) refs.set(rel, new Set());
    refs.get(rel).add(p);
  }
}
/* site.css pulls fonts and art of its own */
const css = fs.readFileSync(path.join(repo, "site.css"), "utf8");
for(const m of css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)){
  const rel = m[2].split("?")[0].replace(/^\.\//, "");
  if(/^(https?:|data:)/.test(rel)) continue;
  if(!refs.has(rel)) refs.set(rel, new Set());
  refs.get(rel).add("site.css");
}
for(const [rel, by] of [...refs].sort()){
  const who = [...by].slice(0, 3).join(", ") + (by.size > 3 ? " +" + (by.size - 3) : "");
  if(!fs.existsSync(path.join(repo, rel)))      flag(rel + "  MISSING on disk   (" + who + ")");
  else if(excluded(rel))                        flag(rel + "  EXCLUDED by .assetsignore   (" + who + ")");
}
if(!bad) ok(refs.size + " assets, all present and all shipping");

/* ---- secrets ---- */
console.log("\nno secrets in anything shipping:");
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => {
  const full = path.join(d, e.name);
  const rel  = path.relative(repo, full).split(path.sep).join("/");
  if(rel.startsWith(".git/")) return [];
  if(excluded(rel) || excluded(rel + "/")) return [];
  return e.isDirectory() ? walk(full) : [rel];
});
const files = walk(repo);
/* Grepping for the WORD service_role flagged config.js, whose comment
   warns never to put one there -- a check that cries wolf on correct code
   gets ignored. So: find JWT-shaped strings, decode the payload, and judge
   the key by its own claimed role. That catches a real key under any
   variable name, and stays quiet about prose. */
const PAT = [[/-----BEGIN [A-Z ]*PRIVATE KEY/, "a private key"],
             [/\bsk-[A-Za-z0-9]{24,}/, "an sk- token"]];
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
let leaks = 0;
for(const rel of files){
  if(!/\.(html|js|css|json|jsonc|md|txt|sql)$/i.test(rel)) continue;
  const body = fs.readFileSync(path.join(repo, rel), "utf8");
  for(const [re, what] of PAT) if(re.test(body)){ flag(rel + " contains " + what); leaks++; }
  for(const m of body.matchAll(JWT)){
    let role = "";
    try{ role = (JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")) || {}).role || ""; }
    catch(_){ continue; }
    if(role && role !== "anon"){
      flag(rel + ' has a JWT whose role is "' + role + '" — anon is the only one that may ship');
      leaks++;
    }
  }
}
if(!leaks) ok(files.length + " files shipping, none mentioning a service key or private key");

/* ---- cache version ---- */
console.log("\ncache version is consistent:");
const vs = new Set();
for(const p of shipped)
  for(const m of fs.readFileSync(path.join(repo, p), "utf8").matchAll(/\?v=(\d+)/g)) vs.add(m[1]);
if(vs.size === 1) ok("every page asks for v=" + [...vs][0]);
else flag("mixed cache versions across pages: " + [...vs].join(", "));

/* ---- dead weight, reported but not failed ---- */
/* Most art is addressed by a path BUILT at runtime (runeArtUrl, the
   mastery icons), so "not in refs" does not mean unused. Search the
   shipping source for the filename before calling anything dead. */
const src = files.filter(x => /\.(html|js|css)$/i.test(x))
  .map(x => fs.readFileSync(path.join(repo, x), "utf8")).join("\n");
/* A basename test is still not enough: art/masteries/511_on.png is built
   as art/masteries/${id}_${on}.png, so neither the filename nor anything
   like it appears in source. What DOES appear is the directory. Treat a
   file as reachable when its folder is named in shipping source, and this
   section stops nominating live art for deletion. */
const dirNamed = d => d && d !== "." && src.includes(d + "/");
const dead = files.filter(f2 => /\.(png|jpg|jpeg|svg|ttf|otf|woff2?)$/i.test(f2)
  && !refs.has(f2) && !src.includes(path.basename(f2))
  && !dirNamed(path.dirname(f2)));
if(dead.length){
  console.log("\nshipping but referenced by no page (not an error):");
  dead.forEach(f => console.log("  - " + f));
}

console.log(bad ? "\n" + bad + " problem(s) — do not deploy" : "\nsafe to deploy");
process.exitCode = bad ? 1 : 0;
