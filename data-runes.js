/* ============================================================
   League Classic runes
   Transcribed from the mode's own rune shop rather than the Data Dragon
   archive, because Classic reworked the system: no Greater/Lesser tiers,
   different values, IP prices, and Lethality as the name for flat armour
   penetration.

   Two tiers:
     standard — the stat the slot specialises in, 500 IP (quints 1250)
     minor    — an off-slot stat: weaker, and costs more at 650 IP
                (e.g. Health is a Seal stat, so a Mark of Health is minor)

   Scaling runes state a per-level value; the shop shows the level-18
   total alongside it, which is exactly perLevel × 18.

   CHECKED against the mode's own jade-perks.json: every rune below matches
   its `amount` exactly. Two were corrected in that pass — the scaling
   Armor seal was 0.15 here against 0.17 in the file, and the Cooldown
   Reduction quintessence had been missed altogether.

   jade-perks.json also carries six rows titled "Empty Rune" with no icon
   and no content id — a minor-tier Attack Speed mark, Armor seal, CDR
   glyph and three quintessences. They are unfinished records rather than
   shop entries, and are deliberately not transcribed.
   ============================================================ */

const RUNE_SLOTS = [
  {key:"mark",  name:"Mark",         plural:"Marks",         per:9,
   colour:"#c98b5e", note:"Offensive slot"},
  {key:"seal",  name:"Seal",         plural:"Seals",         per:9,
   colour:"#d9b64a", note:"Defensive slot"},
  {key:"glyph", name:"Glyph",        plural:"Glyphs",        per:9,
   colour:"#9db3c4", note:"Magic and utility slot"},
  {key:"quint", name:"Quintessence", plural:"Quintessences", per:3,
   colour:"#c8a355", note:"Strongest runes — only three slots"}
];
const SLOT_BY_KEY = Object.fromEntries(RUNE_SLOTS.map(s => [s.key, s]));

const RUNE_PAGE_COST = 1500;   /* "League Classic Rune Page" in the shop */
const RUNE_PRICES = {standard: 500, minor: 650, quint: 1250};

/* value      — per rune, at level 1 (0 for pure scaling runes)
   perLevel   — set on scaling runes; the shop's level-18 figure is ×18
   unit       — "" flat, "%" percentage, or a rate like "/ 5 sec"        */
const CLASSIC_RUNES = [
  /* ---------- Marks: offensive ---------- */
  {slot:"mark", tier:"standard", stat:"Attack Damage",        value:1,    unit:""},
  {slot:"mark", tier:"standard", stat:"Attack Damage",        perLevel:0.15, unit:"", scaling:true},
  {slot:"mark", tier:"standard", stat:"Attack Speed",         value:1.7,  unit:"%"},
  {slot:"mark", tier:"standard", stat:"Critical Damage",      value:2,    unit:"%"},
  {slot:"mark", tier:"standard", stat:"Critical Chance",      value:1,    unit:"%"},
  {slot:"mark", tier:"standard", stat:"Lethality",            value:1.25, unit:""},
  {slot:"mark", tier:"standard", stat:"Magic Penetration",    value:1,    unit:""},
  {slot:"mark", tier:"minor",    stat:"Health",               value:3,    unit:""},
  {slot:"mark", tier:"minor",    stat:"Armor",                value:0.8,  unit:""},
  {slot:"mark", tier:"minor",    stat:"Cooldown Reduction",   value:0.3,  unit:"%"},
  {slot:"mark", tier:"minor",    stat:"Ability Power",        value:0.7,  unit:""},

  /* ---------- Seals: defensive ---------- */
  {slot:"seal", tier:"standard", stat:"Health",               value:8,    unit:""},
  {slot:"seal", tier:"standard", stat:"Health",               perLevel:1.3,  unit:"", scaling:true},
  {slot:"seal", tier:"standard", stat:"Armor",                value:1,    unit:""},
  {slot:"seal", tier:"standard", stat:"Armor",                perLevel:0.17, unit:"", scaling:true},
  /* The client uses the short form in tooltips ("+0.5 Health Regen / 5
     sec.") and the long one in titles ("Seal of Health Regeneration"), so
     `stat` carries the short name — which is also what the icon table is
     keyed on — and `nameStat` the long one. */
  {slot:"seal", tier:"standard", stat:"Health Regen", nameStat:"Health Regeneration",
                                                              value:0.5,  unit:"", rate:"/ 5 sec"},
  {slot:"seal", tier:"standard", stat:"Mana Regen",   nameStat:"Mana Regeneration",
                                                              value:0.4,  unit:"", rate:"/ 5 sec"},
  {slot:"seal", tier:"standard", stat:"Energy Regeneration",  value:0.7,  unit:"", rate:"/ 5 sec"},
  {slot:"seal", tier:"standard", stat:"Gold",                 value:0.25, unit:"", rate:"/ 10 sec"},
  {slot:"seal", tier:"minor",    stat:"Attack Speed",         value:0.8,  unit:"%"},
  {slot:"seal", tier:"minor",    stat:"Critical Damage",      value:0.7,  unit:"%"},
  {slot:"seal", tier:"minor",    stat:"Critical Chance",      value:0.45, unit:"%"},
  {slot:"seal", tier:"minor",    stat:"Magic Resist",         value:0.75, unit:""},

  /* ---------- Glyphs: magic and utility ---------- */
  {slot:"glyph", tier:"standard", stat:"Magic Resist",        value:1.4,  unit:""},
  {slot:"glyph", tier:"standard", stat:"Magic Resist",        perLevel:0.2,  unit:"", scaling:true},
  {slot:"glyph", tier:"standard", stat:"Cooldown Reduction",  value:0.8,  unit:"%"},
  {slot:"glyph", tier:"standard", stat:"Cooldown Reduction",  perLevel:0.1,  unit:"%", scaling:true},
  {slot:"glyph", tier:"standard", stat:"Ability Power",       value:1.2,  unit:""},
  {slot:"glyph", tier:"standard", stat:"Ability Power",       perLevel:0.2,  unit:"", scaling:true},
  {slot:"glyph", tier:"standard", stat:"Mana",                value:12,   unit:""},
  {slot:"glyph", tier:"minor",    stat:"Attack Speed",        value:0.8,  unit:"%"},
  {slot:"glyph", tier:"minor",    stat:"Critical Damage",     value:0.7,  unit:"%"},
  {slot:"glyph", tier:"minor",    stat:"Health",              value:3,    unit:""},
  {slot:"glyph", tier:"minor",    stat:"Armor",               value:0.8,  unit:""},
  {slot:"glyph", tier:"standard", stat:"Energy",              value:2.3,  unit:""},
  {slot:"glyph", tier:"minor",    stat:"Mana Regen", nameStat:"Mana Regeneration",
                                                              value:0.33, unit:"", rate:"/ 5 sec"},

  /* ---------- Quintessences ---------- */
  {slot:"quint", tier:"standard", stat:"Attack Damage",       value:2.25, unit:""},
  {slot:"quint", tier:"standard", stat:"Attack Speed",        value:4.5,  unit:"%"},
  {slot:"quint", tier:"standard", stat:"Critical Damage",     value:4.5,  unit:"%"},
  {slot:"quint", tier:"standard", stat:"Health",              value:26,   unit:""},
  {slot:"quint", tier:"standard", stat:"Armor",               value:4.3,  unit:""},
  {slot:"quint", tier:"standard", stat:"Ability Power",       value:5,    unit:""},
  {slot:"quint", tier:"standard", stat:"Cooldown Reduction",  value:2.5,  unit:"%"},
  {slot:"quint", tier:"standard", stat:"Movement Speed",      value:1.5,  unit:"%"},
  {slot:"quint", tier:"standard", stat:"Percent Health",      value:1.5,  unit:"%"},
  {slot:"quint", tier:"standard", stat:"Spell Vamp",          value:2,    unit:"%"},
  {slot:"quint", tier:"standard", stat:"Life Steal",          value:1.5,  unit:"%"},
  {slot:"quint", tier:"standard", stat:"Gold",                value:1,    unit:"", rate:"/ 10 sec"},
  {slot:"quint", tier:"standard", stat:"Experience",          value:2,    unit:"%", suffix:"Experience Gained"},
  {slot:"quint", tier:"standard", stat:"Energy",              value:6,    unit:""},
  {slot:"quint", tier:"standard", stat:"Energy Regeneration", value:1.8,  unit:"", rate:"/ 5 sec"},
  {slot:"quint", tier:"standard", stat:"Health Regen", nameStat:"Health Regeneration",
                                                              value:1.3,  unit:"", rate:"/ 5 sec"},
  {slot:"quint", tier:"standard", stat:"Mana",                value:38,   unit:""}
];

/* Which glow a placed rune gets. The client colours by the rune's stat
   group, not by the slot it sits in — a Minor Glyph of Attack Speed glows
   red like the other offensive runes. Groups read off `primaryStatGroup`
   in jade-perks.json; the mapping is consistent per stat, so it lives here
   as a stat lookup rather than a field on every rune.

   Energy and Energy Regeneration are kNone in the game data and get no
   glow at all, which is why the new energy runes stay unlit. */
const RUNE_STAT_GROUP = {
  "Attack Damage":"offense", "Attack Speed":"offense", "Critical Chance":"offense",
  "Critical Damage":"offense", "Lethality":"offense", "Magic Penetration":"offense",
  "Life Steal":"offense",

  "Armor":"defense", "Health":"defense", "Health Regen":"defense",
  "Magic Resist":"defense", "Percent Health":"defense",

  "Ability Power":"magical", "Cooldown Reduction":"magical", "Mana":"magical",
  "Mana Regen":"magical", "Spell Vamp":"magical",

  "Gold":"utility", "Experience":"utility", "Movement Speed":"utility"
  /* "Energy", "Energy Regeneration" -> none */
};

/* ---------- derived fields ---------- */
const runeSlug = r =>
  [r.tier === "minor" ? "minor" : "", r.slot, r.scaling ? "scaling" : "", r.stat]
    .filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

CLASSIC_RUNES.forEach(r => {
  r.value    = r.value || 0;
  r.perLevel = r.perLevel || 0;
  r.at18     = r.scaling ? Math.round(r.perLevel * 18 * 100) / 100 : 0;
  r.ip       = r.slot === "quint" ? RUNE_PRICES.quint : RUNE_PRICES[r.tier];
  const titleStat = r.nameStat || r.stat;
  r.name     = r.slot === "quint"
    ? `Quintessence of ${r.scaling ? "Scaling " : ""}${titleStat}`
    : `${r.tier === "minor" ? "Minor " : ""}${SLOT_BY_KEY[r.slot].name} of ` +
      `${r.scaling ? "Scaling " : ""}${titleStat}`;
  r.group    = RUNE_STAT_GROUP[r.stat] || "none";
  r.id = runeSlug(r);
});

/* "+1.7% Attack Speed", "+0.5 Health Regen / 5 sec", "+0.15 AD per level" */
function runeEffect(r, n = 1){
  const round = v => Math.round(v * 1000) / 1000;
  if(r.scaling){
    return `+${round(r.perLevel * n)}${r.unit} ${r.stat} per level`;
  }
  /* `suffix` replaces the stat name (Experience Gained); `rate` follows it. */
  const label = r.suffix || [r.stat, r.rate].filter(Boolean).join(" ");
  return `+${round(r.value * n)}${r.unit} ${label}`.replace(/\s+/g, " ").trim();
}
function runeAt18(r, n = 1){
  if(!r.scaling) return null;
  return `+${Math.round(r.perLevel * 18 * n * 100) / 100}${r.unit} ${r.stat} at level 18`;
}

/* Short label for the badge face. */
const STAT_ABBR = {
  "Attack Damage":"AD", "Attack Speed":"AS", "Critical Damage":"CDmg",
  "Critical Chance":"Crit", "Lethality":"Leth", "Magic Penetration":"MPen",
  "Health":"HP", "Armor":"Arm", "Magic Resist":"MR", "Ability Power":"AP",
  "Mana":"MP", "Cooldown Reduction":"CDR", "Health Regeneration":"HP5",
  "Mana Regeneration":"MP5", "Gold":"Gold", "Movement Speed":"MS",
  "Health Regen":"HP5", "Mana Regen":"MP5", "Energy":"EN", "Energy Regeneration":"EN5",
  "Percent Health":"%HP", "Spell Vamp":"SV", "Life Steal":"LS",
  "Experience":"XP"
};
const runeAbbr = r => STAT_ABBR[r.stat] || r.stat.slice(0, 4);

/* ------------------------------------------------------------
   ART
   Data Dragon's rune icons are keyed by colour + motif + tier, not by
   the individual stat — several stats share one file. Classic reuses the
   same taxonomy, so matching a curated rune to its Data Dragon twin by
   slot + stat + scaling lands on the right artwork.

   Data Dragon also ships three tiers of every rune, and the tier-1 art is
   the duller variant. That maps neatly onto Classic's minor runes, so
   minor uses tier 1 and standard uses tier 3 — real art either way, no
   image editing needed. If a tier-1 file is missing the standard art is
   reused with a CSS treatment to keep the two readable apart.
   ------------------------------------------------------------ */
const DD_SLOT_BY_TYPE = {red:"mark", yellow:"seal", blue:"glyph", black:"quint"};
const STAT_ALIASES = {           /* Classic wording -> Data Dragon wording */
  "lethality": "armorpenetration",
  "percenthealth": "health"
};
const statKey = s => {
  const k = String(s).toLowerCase().replace(/[^a-z]/g, "");
  return STAT_ALIASES[k] || k;
};

/* "Greater Glyph of Scaling Ability Power" -> {scaling:true, stat:"abilitypower"} */
function parseDDName(name){
  let n = String(name).replace(/^(Greater|Lesser|Minor)\s+/i, "");
  const m = /^(Mark|Seal|Glyph|Quintessence)\s+of\s+(.*)$/i.exec(n);
  if(!m) return null;
  let rest = m[2];
  const scaling = /^Scaling\s+/i.test(rest);
  rest = rest.replace(/^Scaling\s+/i, "");
  return {scaling, stat: statKey(rest)};
}

let RUNE_ART_READY = false;
async function loadRuneArt(){
  if(RUNE_ART_READY) return;
  try{
    const data = (await DD.runes()).data;
    /* slot|scaling|stat|tier -> icon file */
    const index = new Map();
    for(const rec of Object.values(data)){
      if(!rec.rune || !rec.image) continue;
      const slot = DD_SLOT_BY_TYPE[rec.rune.type];
      const parsed = parseDDName(rec.name);
      if(!slot || !parsed) continue;
      index.set(`${slot}|${parsed.scaling}|${parsed.stat}|${rec.rune.tier}`, rec.image.full);
    }
    for(const r of CLASSIC_RUNES){
      const base = `${r.slot}|${!!r.scaling}|${statKey(r.stat)}`;
      const wanted = r.tier === "minor" ? "1" : "3";
      const other  = r.tier === "minor" ? "3" : "1";
      const exact  = index.get(`${base}|${wanted}`);
      const spare  = index.get(`${base}|${other}`) || index.get(`${base}|2`);
      r.icon = exact || spare || null;
      /* true when we had to borrow the standard art for a minor rune */
      r.iconBorrowed = !exact && !!spare && r.tier === "minor";
    }
    RUNE_ART_READY = true;
  }catch(err){
    console.warn("Rune art unavailable, using CSS badges:", err.message);
  }
}

/* Data Dragon art when we have it, CSS badge otherwise. */
function runeBadge(r, size = ""){
  const s = SLOT_BY_KEY[r.slot];
  const url = runeArtUrl(r);
  if(url){
    /* Only the Data Dragon fallback ever needs the "borrowed" treatment;
       the mode's own art already distinguishes minor runes. */
    const jade = typeof JADE_RUNE_ICONS !== "undefined" && JADE_RUNE_ICONS[r.id];
    return `<img class="rune-img ${size} ${r.tier} ${(!jade && r.iconBorrowed) ? "borrowed" : ""}"
      src="${url}" alt="" loading="lazy">`;
  }
  return `<span class="rune-badge ${size} ${r.tier} ${r.scaling ? "scaling" : ""}"
    style="--slot:${s.colour}" aria-hidden="true"><i>${runeAbbr(r)}</i></span>`;
}

/* ------------------------------------------------------------
   PAGE LAYOUT
   Slot positions as percentages of the parchment, traced from the
   in-game editor: marks clustered lower-left, seals arcing up through
   the middle, glyphs gathered upper-right, and three large
   quintessences set among them.
   ------------------------------------------------------------ */
const RUNE_SLOT_POS = {
  /* Placed by hand against the artwork with a drag-to-arrange tool that
     has since been removed — so these are measured, not estimated.
     Percentages of the parchment; [x, y] is the socket's centre. */
  mark: [[21,78],[6,76],[9,65],[15,56],[9,89],[14,76],[16,89],[24,89],[19,66]],
  seal: [[34,19],[21,31],[20,47],[15,38],[10,47],[41,14],[27,24],[49,10],[52,22]],
  glyph:[[57,10],[65,12],[70,21],[59,24],[66,31],[76,13],[81,43],[76,32],[82,22]],
  quint:[[12,16],[69,49],[35,65]]
};

/* An empty page: 9 marks, 9 seals, 9 glyphs, 3 quintessences. */
function emptyRunePage(){
  const page = {};
  for(const s of RUNE_SLOTS) page[s.key] = Array(s.per).fill(null);
  return page;
}
const runeSlotArt = slot => `assets/rune-slot-${slot}.png`;

/* Sum every placed rune into one stat table. Flat and per-level are kept
   apart, since a scaling rune contributes nothing at level 1. */
function runePageStats(page){
  const flat = new Map(), scaling = new Map();
  for(const s of RUNE_SLOTS){
    for(const id of (page[s.key] || [])){
      if(!id) continue;
      const r = CLASSIC_RUNES.find(x => x.id === id);
      if(!r) continue;
      const key = (r.suffix || r.stat) + (r.rate ? " " + r.rate : "") + "|" + r.unit;
      const bag = r.scaling ? scaling : flat;
      bag.set(key, (bag.get(key) || 0) + (r.scaling ? r.perLevel : r.value));
    }
  }
  const fmt = (m, mult = 1) => [...m.entries()].map(([key, v]) => {
    const [label, unit] = key.split("|");
    return {label, unit, value: Math.round(v * mult * 100) / 100};
  }).sort((a, b) => a.label.localeCompare(b.label));
  return {flat: fmt(flat), atEighteen: fmt(scaling, 18)};
}
const runePageCount = page =>
  RUNE_SLOTS.reduce((n, s) => n + (page[s.key] || []).filter(Boolean).length, 0);
const runePageTotal = () => RUNE_SLOTS.reduce((n, s) => n + s.per, 0);

/* ------------------------------------------------------------
   The mode's own rune art (assets/runes/), keyed by rune id via
   data-rune-icons.js. Falls back to the Data Dragon icon that
   loadRuneArt() resolves, and to a CSS badge if neither is there.
   ------------------------------------------------------------ */
function runeArtUrl(r){
  const f = (typeof JADE_RUNE_ICONS !== "undefined") ? JADE_RUNE_ICONS[r.id] : null;
  if(f) return "assets/runes/" + f;
  return r.icon ? DD.runeImg(r.icon) : null;
}
