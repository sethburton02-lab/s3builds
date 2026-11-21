/* Do the words on the page carry the numbers?

   Reported from Reddit, 14 Oct 2026: "All of the Summoner Spells don't
   even say what they do", and Dr. Mundo's passive reading "regenerates a
   portion of his maximum Health each second. HOW MUCH????"

   Both are the same failure. A description is not a tooltip. The mode's
   own catalogue carries a SHORT description for the client's spell
   picker — deliberately vague, because the client shows numbers
   elsewhere — and the site renders that string as if it were the
   ability's text. The Season 3 archive's description, by contrast, has
   the numbers in it.

   So this check asserts a property the site should never have been
   without: a description shown as an ability's text must contain a
   number. It is crude on purpose. "Restores Health to your champion and
   to nearby allies" is indistinguishable from good prose to anything
   subtler, and it was live for months.

   RUN IT AGAINST LIVE DATA. The site fetches Community Dragon at page
   load, so the strings a reader sees are the ones on the CDN right now,
   not the ones in whatever extract is on this disk. Those disagree, and
   the disagreement is not academic: on 14 Oct 2026 the local extract
   gave Dr. Mundo's passive as "regenerates 0.3% of his maximum Health
   each second" while the live file served "regenerates A PORTION OF his
   maximum Health each second". Riot had genericised the string upstream.
   Checking the extract would have declared Mundo fine on the very day a
   reader posted a screenshot of Mundo being not fine.

   Run: node tools/numbers-check.js --live          (what readers see)
        node tools/numbers-check.js <path to .../global/default/v1>
*/
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "site.js"), "utf8");

/* ---- lift ddText and its tag table out of site.js ----
   By line, closing on a brace in column 0. Brace counting is the obvious
   way and the wrong one here: ddText's body contains both regex literals
   and a template literal, and a counter that does not lex strings
   truncates the function somewhere in the middle of it. The house style
   closes every top-level declaration at column 0, so that is the anchor. */
const lines = src.split("\n");
/* A one-line declaration has no closing brace to anchor on. */
function liftLine(startsWith){
  const l = lines.find(x => x.startsWith(startsWith));
  if(!l) throw new Error("not found: " + startsWith);
  return l;
}
function liftTop(startsWith){
  const i = lines.findIndex(l => l.startsWith(startsWith));
  if(i < 0) throw new Error("not found: " + startsWith);
  for(let k = i + 1; k < lines.length; k++)
    if(lines[k] === "}" || lines[k] === "};")
      return lines.slice(i, k + 1).join("\n");
  throw new Error("never closed: " + startsWith);
}
global.esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

(0, eval)(liftTop("const DD_TAGS").replace(/^const /, "globalThis.DD_TAGS_ = ")
            .replace("DD_TAGS_ = DD_TAGS =", "DD_TAGS_ ="));
globalThis.DD_TAGS = globalThis.DD_TAGS_;
(0, eval)(liftTop("function ddText") + ";globalThis.__ddText = ddText;");
const ddText = globalThis.__ddText;

/* ---- the strings themselves ---- */
const DATA = process.argv[2];
let failed = 0, checked = 0;
const say = (ok, label, note) => {
  console.log((ok ? "ok    " : "FAIL  ") + label + (note ? " — " + note : ""));
  if(!ok) failed++;
  checked++;
};

/* A number the reader can act on. Deliberately not \d: "Summoner's
   Resolve: Gain 5 Health per level" is a mastery rider, not the spell's
   own numbers, so the mastery clause is cut before testing. */
const hasNumber = s => /\d/.test(String(s).replace(/Summoner's (Wrath|Resolve|Insight):.*$/s, ""));

if(!DATA){
  console.log("No game-data path given — checking only that ddText keeps numbers.\n" +
              "Pass .../global/default/v1 to check the catalogue's own strings.\n");
}

/* ddText must not eat digits. It swaps known tags for " N " placeholders
   and restores them by matching / (\d+) /, which is the same shape as a
   bare number in prose: "you deal 9 bonus damage to minions" offers " 9 "
   to that regex. Whether it currently collides or not, assert it doesn't. */
const PROSE = [
  "Grants invulnerability to all allied turrets and causes them to attack 100% faster. While Fortify is ready to cast, you deal 9 bonus damage to minions.",
  "Dr. Mundo regenerates 0.3% of his maximum Health each second.",
  "Restores 90-345 Health (depending on champion level) to your champion and to nearby allies.",
  "Summons a beacon with 200 + 25 x level Health for 15 seconds which increases allied Attack Damage by 10-35.",
  "<stats>Deals 7 damage</stats> and heals for 3 over 2 seconds, then 5 more.",
  "<b>Toggle:</b> deals 30 <i>(+0.2)</i> magic damage and reduces disables by 30 %."
];
for(const p of PROSE){
  const out = ddText(p);
  const want = (p.match(/\d+(\.\d+)?/g) || []);
  const got  = (out.match(/\d+(\.\d+)?/g) || []);
  const lost = want.filter(n => !got.includes(n));
  say(lost.length === 0, "ddText keeps every number: " + p.slice(0, 48) + "…",
      lost.length ? "lost " + lost.join(", ") + " → " + out : "");
}

const LIVE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1";
const live = DATA === "--live";

(async () => {
if(DATA){
  console.log("");
  const j = live
    ? async f => {
        const r = await fetch(`${LIVE}/${f}`);
        if(!r.ok) throw new Error(`${f} ${r.status}`);
        return r.json();
      }
    : async f => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

  console.log(live ? "Source: Community Dragon, live — what readers see.\n"
                   : "Source: " + DATA + "\n  WARNING: an extract goes stale. " +
                     "Re-run with --live before believing a pass.\n");

  /* Summoner spells: the mode's catalogue, which is what the page shows. */
  const spells = (await j("summoner-spells.json"))
    .filter(s => (s.gameModes || []).includes("JADE"));
  say(spells.length === 16, "16 spells in the mode", "found " + spells.length);
  const vague = spells.filter(s => !hasNumber(s.description));
  say(vague.length === 0,
      "every summoner spell description states a number",
      vague.length + " say nothing: " + vague.map(s => s.name).join(", "));

  /* Champion passives: same question, same answer shape. The roster comes
     from the mode's own catalogue so a champion added upstream is checked
     the day it appears, rather than whenever someone remembers to look. */
  let ids;
  if(live){
    const roster = await j("jade-champions.json");
    ids = (roster[0].mChampions || []).map(c => c.value.championId);
  }else{
    ids = fs.readdirSync(path.join(DATA, "champions"))
      .filter(f => /^60\d+\.json$/.test(f)).map(f => parseInt(f, 10));
  }
  const noNum = [];
  for(const id of ids){
    let d;
    try{ d = await j(`champions/${id}.json`); }catch(_){ continue; }
    if(d.passive && !hasNumber(d.passive.description))
      noNum.push({id, passiveName: d.passive.name,
                  label: (d.name || id) + " — " + d.passive.name});
  }
  say(noNum.length === 0,
      `every champion passive states a number (${ids.length} champions)`,
      noNum.length + " don't:\n        " + noNum.map(p => p.label).join("\n        "));

  /* Can the Season 3 archive rescue them? Reported rather than asserted:
     this is the input to a decision about whether to fall back to the
     archive's passive text, and the decision is not this file's to make.
     Joined on the passive's NAME, because a champion reworked since 2013
     has the same champion id and a different ability — the trap the
     splash art fell into. A name match means both sources are describing
     the same thing. */
  if(live && noNum.length){
    console.log("\n  Could the 3.13.24 archive supply those numbers?");
    const dd = await (await fetch(
      "https://ddragon.leagueoflegends.com/cdn/3.13.24/data/en_US/championFull.json")).json();
    const arch = new Map();
    for(const c of Object.values(dd.data))
      if(c.passive) arch.set(String(c.key), c.passive);
    let yes = 0, renamed = 0, absent = 0;
    for(const p of noNum){
      const a = arch.get(String(p.id - 60000));
      if(!a){ absent++; console.log("    no  " + p.label + " — not in the archive"); }
      else if(a.name !== p.passiveName){
        renamed++;
        console.log("    no  " + p.label + " — archive calls it \"" + a.name +
                    "\", so it is a different ability");
      }else if(hasNumber(a.description)){
        yes++;
        console.log("    YES " + p.label + "\n          " + a.description);
      }else{
        console.log("    no  " + p.label + " — archive is vague too");
      }
    }
    console.log(`\n  ${yes} rescued by the archive, ${renamed} renamed since, ` +
                `${absent} absent, ${noNum.length - yes - renamed - absent} vague in both.`);
  }

  /* The one a reader actually posted about. Named explicitly so the
     regression has a name, and so a pass against a stale extract reads
     as the suspicious thing it is. */
  const mundo = await j("champions/60036.json").catch(() => null);
  if(mundo) say(hasNumber(mundo.passive.description),
    "Dr. Mundo's Adrenaline Rush says how much",
    JSON.stringify(mundo.passive.description));

  /* ---- the call site ----
     The two assertions above are about the DATA. This one is about what
     the site does with it, which is the part that was wrong: the mode's
     blurb was taken wholesale and overwrote a sentence that had the
     numbers in it. Asserting the catalogue is vague proves nothing on
     its own — the catalogue is allowed to be vague. */
  if(!live){
    console.log("\nSKIPPED the call-site check: it needs the Season 3 archive,\n" +
                "  which is only fetched with --live. A skip is not a pass.");
  }else{
    console.log("");
    /* One eval, and `var` rather than `const`, so the three declarations
       can see each other — a const inside an indirect eval is scoped to
       that eval and is invisible to the next one. */
    (0, eval)(
      liftLine("const MASTERY_CLAUSE").replace(/^const /, "var ") + "\n" +
      liftTop("function splitMasteryNote_") + "\n" +
      liftTop("function classicSpell_") + "\n" +
      ";globalThis.__cs = classicSpell_;"
    );
    const byName = new Map(spells.map(s => [s.name.toLowerCase(), s]));
    globalThis.CLASSIC = {spellByName: n => byName.get(String(n).toLowerCase()) || null};

    const dd = await (await fetch(
      "https://ddragon.leagueoflegends.com/cdn/3.13.24/data/en_US/summoner.json")).json();
    const archive = Object.values(dd.data);
    const silent = [], unsplit = [];
    for(const row of spells){
      const a = archive.find(x => x.name === row.name);
      if(!a) continue;
      const out = globalThis.__cs({
        id: a.id, name: a.name,
        description: a.description || "", cooldown: Number(a.cooldownBurn) || 0
      });
      if(!/\d/.test(out.description)) silent.push(row.name);
      /* The rider must come out as its own field, not be left sitting in
         the sentence — otherwise "says a number" passes on the strength
         of "Gain 5 Health per level", which is the mastery, not the spell. */
      if(/Summoner's (Wrath|Resolve|Insight):/.test(out.description))
        unsplit.push(row.name);
    }
    /* Three spells state no figure in EITHER source, so there is nothing
       honest to print. Named individually rather than waved through,
       because the whole failure here was a blanket rule applied without
       looking at what it produced:
         Flash    "a short distance" — the distance is 425, and the page
                  already shows it under Range. Nothing is hidden.
         Promote  vague in the archive and in the catalogue both. The
                  minion's stats live in the game's own data, not here.
         Revive   the only figure anywhere is in the mastery rider, and
                  that is rendered as the rider.
       A fourth spell joining this list is a regression, not a fact. */
    const NO_FIGURE = new Set(["Flash", "Promote", "Revive"]);
    const unexpected = silent.filter(n => !NO_FIGURE.has(n));
    const fixed = [...NO_FIGURE].filter(n => !silent.includes(n));
    say(unexpected.length === 0, "every spell that can state a number does",
        unexpected.length + " silent and not on the known list: " + unexpected.join(", "));
    say(fixed.length === 0, "the known-silent list has no spares",
        fixed.join(", ") + " now states a number — drop it from NO_FIGURE");
    say(unsplit.length === 0, "the mastery rider is split out, not counted as the spell",
        unsplit.join(", "));
  }
}

console.log(failed ? "\n" + failed + " of " + checked + " failed"
                   : "\nall ok (" + checked + ")");
process.exit(failed ? 1 : 0);
})();
