/* Diff the site's hand-kept data against a game-file extract.
   Usage:  node tools/extract-check.js <path to .../global/default/v1>

   Champions, items, stats and item tiers are read from the mode's own
   catalogue at runtime, so they follow a patch on their own. These do not:

     CLASSIC_ROSTER     offline fallback roster      (site.js)
     CHAMP_FACE_Y       splash face offsets          (data-champ-focus.js)
     CLASSIC_RUNES      transcribed rune values      (data-runes.js)

   A rune value moving is invisible without a diff -- the page keeps showing
   a confident wrong number. On 10 Oct 2026 this found two (the Cooldown
   Reduction glyph and the Health Regeneration quintessence) and nine
   champions missing from the fallback, none of which any other check could
   have seen.

   Extract with Obsidian; the four files worth having are jade-perks.json,
   champion-summary.json, jade-items.json and items.json. Whatever is
   absent is reported as unchecked rather than quietly skipped. */
const fs = require("fs"), path = require("path");
const dir = process.argv[2];
if(!dir){ console.error("usage: node tools/extract-check.js <.../global/default/v1>"); process.exit(2); }
const repo = path.join(__dirname, "..");
const read = f => { try{ return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }catch(_){ return null; } };
const norm = s => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
/* data-runes.js and data-champ-focus.js are pure data and evaluate clean.
   site.js is not: it wires up document listeners at the top level, so
   evaluating it here threw "document is not defined". That branch had
   never run -- the first extract had no champion-summary.json, so the
   roster check was skipped and the crash stayed hidden. Rather than stub a
   DOM to read one array, slice the declaration out and evaluate only it. */
const load = (file, name) => {
  const src = fs.readFileSync(path.join(repo, file), "utf8");
  (0, eval)(src + ";globalThis.__X = " + name + ";");
  return globalThis.__X;
};
const loadLiteral = (file, name) => {
  const src = fs.readFileSync(path.join(repo, file), "utf8");
  const i = src.indexOf("const " + name + " =");
  if(i < 0) throw new Error(name + " not found in " + file);
  const open = src.indexOf("[", i);
  if(open < 0) throw new Error(name + " is not an array literal");
  let d = 0;
  for(let k = open; k < src.length; k++){
    if(src[k] === "[") d++;
    else if(src[k] === "]" && --d === 0)
      return (0, eval)("(" + src.slice(open, k + 1) + ")");
  }
  throw new Error("unbalanced brackets reading " + name);
};
let problems = 0, unchecked = [];
const say  = s => console.log(s);
const flag = s => { problems++; console.log("  " + s); };

/* ---- the roster fallback ---- */
const summary = read("champion-summary.json");
const splashDir = path.join(dir, "champion-splashes");
let liveNames = null;
if(summary){
  liveNames = summary.filter(r => /^Jade_/i.test(r.alias || "")).map(r => r.name);
}else if(fs.existsSync(splashDir) && summary === null){
  unchecked.push("champion-summary.json (names unavailable; roster checked by splash id only)");
}
say("\nROSTER FALLBACK");
if(liveNames){
  const baked = loadLiteral("site.js", "CLASSIC_ROSTER");
  /* The catalogue name may EXTEND the archive one -- "Nunu" against
     "Nunu & Willump" -- which is a deliberate spelling difference, not a
     champion missing from either side. Prefix matching says that, and has
     to run in BOTH directions: checking only the extras left "Nunu &
     Willump" reported as missing, which is the same fact wearing the
     other hat. */
  const pairs = (a, b) => a.filter(n =>
    !b.some(m => norm(m) === norm(n) || norm(m).startsWith(norm(n)) || norm(n).startsWith(norm(m))));
  const missing = pairs(liveNames, baked);
  const extra   = pairs(baked, liveNames);
  say("  live " + liveNames.length + ", fallback " + baked.length);
  if(missing.length){ flag("missing: " + missing.join(", "));
    say("    " + missing.map(n => '"' + n + '"').join(",")); }
  /* "Nunu" vs "Nunu & Willump" is a deliberate spelling difference, not a
     champion the mode dropped: the catalogue name EXTENDS the archive one.
     Matching on a prefix says exactly that, where the first-four-characters
     version I wrote first both missed this case and would have swallowed
     any real extra sharing a four-letter opening. */
  const realExtra = extra;
  if(realExtra.length) flag("in the fallback but not live: " + realExtra.join(", "));
  if(!missing.length && !realExtra.length) say("  ok");
}else{
  /* jade-champions.json is the mode's own roster but carries ids, not
     names, so it cannot say WHICH champion is missing -- only how many.
     A count is still the difference between "nine short" and "fine", and
     this file turned out to be far easier to extract than the summary. */
  const jc = read("jade-champions.json");
  const rows = jc && jc[0] && jc[0].mChampions;
  if(rows && rows.length){
    const baked = loadLiteral("site.js", "CLASSIC_ROSTER");
    say("  live " + rows.length + ", fallback " + baked.length + "   (counts only — no champion-summary.json for names)");
    if(rows.length !== baked.length)
      flag("off by " + (rows.length - baked.length) + " — extract champion-summary.json to see which");
    else say("  ok");
  }else{ say("  UNCHECKED — no champion-summary.json or jade-champions.json"); }
}

/* ---- splash face offsets ---- */
say("\nSPLASH FACE OFFSETS");
if(fs.existsSync(splashDir)){
  const ids = fs.readdirSync(splashDir).filter(d => /^60\d+$/.test(d)).map(Number);
  const focus = load("data-champ-focus.js", "CHAMP_FACE_Y");
  const miss = ids.filter(id => focus[id] == null);
  say("  " + Object.keys(focus).length + " measured, " + ids.length + " champions in the mode");
  if(miss.length) flag("no offset for id(s): " + miss.join(", ") + "  — measure in face-offsets.html");
  else say("  ok");
}else{ say("  UNCHECKED — no champion-splashes/ in the extract"); }

/* ---- rune values ---- */
say("\nRUNE VALUES");
const perks = read("jade-perks.json");
if(perks){
  const live = perks.filter(r => !/empty rune/i.test(r.title || ""));
  const byTitle = new Map(live.map(r => [norm(r.title), r]));
  const site = load("data-runes.js", "CLASSIC_RUNES");
  let bad = 0, matched = 0;
  for(const b of site){
    const r = byTitle.get(norm(b.name));
    if(!r) { flag("on the site but not in the mode: " + b.name); continue; }
    matched++;
    const mine = b.scaling ? b.perLevel : b.value;
    if(Math.abs(Number(r.amount) - Number(mine)) > 1e-9){
      bad++; flag(b.name + ": site " + mine + ", mode " + r.amount);
    }
  }
  /* Duplicate title rows exist in the file (same title, same amount,
     isRecommended false). Counted, not reported as missing runes. */
  const names = new Set(site.map(b => norm(b.name)));
  const onlyLive = live.filter(r => !names.has(norm(r.title)));
  say("  " + matched + " of " + site.length + " matched, " + bad + " value mismatch(es)");
  if(onlyLive.length) flag("in the mode but not on the site: " +
    onlyLive.map(r => r.title + " (" + r.tooltip + ")").join("; "));
  if(!bad && !onlyLive.length) say("  ok");
}else{ say("  UNCHECKED — no jade-perks.json in the extract"); }

/* ---- the item shop list ---- */
say("\nITEM SHOP LIST");
const jadeItems = read("jade-items.json"), items = read("items.json");
if(jadeItems && items){
  const mode = new Set(jadeItems[0].items.map(x => Number(x.value.itemId)));
  const by = new Map(items.map(i => [Number(i.id), i]));
  const slice = [...by.keys()].filter(k => k >= 770000);
  const pats = [/golden\s*spatula/i, /hex\s*core/i, /zz.?rot\s*portal/i];
  const leak = slice.filter(k => !mode.has(k)).map(k => by.get(k))
    .filter(it => !pats.some(p => p.test(it.name || "")))
    .filter(it => it.inStore && (it.priceTotal || 0) > 0);
  say("  mode's own list " + mode.size + ", site's id>=770000 filter " + slice.length);
  if(leak.length) flag("reaches the shop page but is not in the mode's list: " +
    leak.map(i => i.id + " " + i.name).join(", "));
  /* The direction that hid Zz'Rot Portal: the mode sells it, the site does
     not show it. loadItems walks items.json and keeps what the shop list
     names, so an id in the list with no item record vanishes in silence. */
  const orphan = [...mode].filter(id => !by.has(id));
  if(orphan.length) flag("in the mode's shop list but with no record in items.json: " +
    orphan.join(", "));
  if(!leak.length && !orphan.length) say("  ok");
}else if(jadeItems){
  /* Since 10 Oct 2026 the site reads jade-items.json itself, so the
     heuristic it used to rely on is only a fallback. Without items.json
     there are no names to check it against, but the shop SIZE is still
     worth stating -- a sudden change there is the signal. */
  const mode = jadeItems[0].items.length;
  say("  the mode lists " + mode + " items (no items.json, so no name check)");
  say("  ok — the site reads this same file at runtime");
}else{ unchecked.push("jade-items.json"); say("  UNCHECKED — not in the extract"); }

if(unchecked.length) say("\nnot checked: " + unchecked.join("; "));
say(problems ? "\n" + problems + " thing(s) to look at" : "\nthe hand-kept data matches the extract");
process.exitCode = problems ? 1 : 0;
