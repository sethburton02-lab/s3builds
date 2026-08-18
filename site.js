/* ============================================================
   S3 Builds — shared data layer
   Assets and data come from Riot's Data Dragon CDN, pinned to a
   Season 3 patch so the art matches the League Classic era.
   ============================================================ */

/* ------------------------------------------------------------
   ART SOURCE
   League Classic (dev codename "Jade", launched July 2026) is not a
   recreation of one patch. It uses Season 3 as a foundation, pulls in
   bits from later years up to late Season 2015, and ships its own
   newly-drawn "Classic Skins" as champions' default look — so its art
   is NOT the 2013 art in the Data Dragon archive, and several items are
   renamed outright.

   The mode numbers its content with fixed offsets:
       champion id = 60000 + live champion key   (Twisted Fate 4 -> 60004)
       item id     = 770000 + live item id       (Sorcerer's Shoes 3020 -> 773020)

   The site renders the mode's own art, from Community Dragon's mirror of
   Riot's raw game data (CLASSIC.base below, verified). Data Dragon's 2013
   archive is still loaded, but only as a per-image fallback: an asset that
   404s swaps to its Season 3 equivalent rather than leaving a broken box.

   There used to be a switch in the header that flipped the whole site to
   the archive, from when the mirror was unconfirmed. It is gone — with
   CLASSIC.base working, it only offered a less accurate site.
   ------------------------------------------------------------ */
const CLASSIC = {
  /* Community Dragon mirrors Riot's raw game data, including League
     Classic's own assets. Verified: champion-summary.json lists the mode's
     60 champions with alias "Jade_<Name>" and icons at
     /v1/champion-icons/<60000+key>.png. */
  base:    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default",
  pbeBase: "https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default",
  champOffset: 60000,
  itemOffset:  770000,
  champId: key => CLASSIC.champOffset + Number(key),
  itemId:  id  => CLASSIC.itemOffset  + Number(id),

  /* Champions that exist only on the PBE branch, whose art has to come
     from /pbe rather than /latest. Empty since 12 Aug 2026, when Akali,
     Kennen and Shen shipped to live — verified by their champion files
     appearing under /latest. Add a name here if a future champion lands
     on PBE first; everything downstream keys off this one set. */
  pbeOnly: new Set(),
  isPBE: name => CLASSIC.pbeOnly.has(normKey(name)),

  champIcon(key, name){
    const root = CLASSIC.isPBE(name) ? CLASSIC.pbeBase : CLASSIC.base;
    return `${root}/v1/champion-icons/${CLASSIC.champId(key)}.png`;
  },

  /* The mode's own item table. Item icons aren't named purely from the id
     — raw data uses files like "773020_sorcerers_shoes.png" — and the real
     stats live inside each record's description markup, so the whole slice
     is worth keeping, not just the icon paths. Fetched once per session. */
  _items: null,
  async itemData(){
    if(CLASSIC._items) return CLASSIC._items;
    const key = "cd:classic-items:v3";   /* bump when the cached shape changes */
    try{
      const hit = sessionStorage.getItem(key);
      if(hit) return (CLASSIC._items = new Map(JSON.parse(hit)));
    }catch(_){}
    try{
      const res = await fetch(`${CLASSIC.base}/v1/items.json`, {mode:"cors"});
      if(!res.ok) throw new Error(`items.json ${res.status}`);
      const rows = await res.json();
      const map = new Map();
      for(const it of rows){
        if(it.id < CLASSIC.itemOffset) continue;
        map.set(it.id, {
          id: it.id, name: it.name, description: it.description || "",
          price: it.price, priceTotal: it.priceTotal,
          from: it.from || [], to: it.to || [],
          categories: it.categories || [], inStore: it.inStore !== false,
          requiredChampion: it.requiredChampion || "",
          icon: it.iconPath ? assetUrl(it.iconPath) : null
        });
      }
      try{ sessionStorage.setItem(key, JSON.stringify([...map])); }catch(_){}
      return (CLASSIC._items = map);
    }catch(err){
      console.warn("Classic item data unavailable, falling back to Season 3:", err.message);
      return (CLASSIC._items = new Map());
    }
  },
  itemIcon(id){
    const rec = CLASSIC._items && CLASSIC._items.get(CLASSIC.itemId(id));
    return rec ? rec.icon : null;
  }
};

/* Raw data paths look like "/lol-game-data/assets/ASSETS/Items/Icons2D/x.png".
   Community Dragon serves them lowercased under its plugin root. */
function assetUrl(path){
  return CLASSIC.base + String(path)
    .replace(/^\/lol-game-data\/assets/i, "")
    .toLowerCase();
}

/* The site renders the mode's own art. There was a switch here that let a
   reader fall the whole site back to the 2013 archive, from when I couldn't
   confirm Riot published Classic's assets anywhere public. CLASSIC.base is
   confirmed now, so the switch was offering a worse version of the site for
   no reason. The per-image fallback below stays — it covers the one asset
   that is missing, which is a different problem from the CDN being wrong. */
const classicReady = () => !!CLASSIC.base;

/* ------------------------------------------------------------
   THE PATCH THE MODE IS ON

   Two different patches are in play and conflating them is the trap.
   DD.patch below is 3.13.24 — the Season 3 archive the ART comes from,
   and a fixed part of every asset URL. It is not what the game is on.

   League Classic ships with the live client, so a guide written for it is
   current as of the LIVE patch, and that is what a reader needs to see.
   Data Dragon's version list has it; the newest entry is live.

   Cached for the session so every page doesn't re-ask, and it degrades to
   an honest "live" rather than a wrong number if the fetch fails.
   ------------------------------------------------------------ */
let LIVE_PATCH = null;
const PATCH_KEY = "cd:live-patch";

/* "16.16.1" -> "16.16". Riot writes patches with two parts; the third is
   Data Dragon's build number and is not how anyone refers to a patch. */
const shortPatch = v => String(v || "").split(".").slice(0, 2).join(".");

function livePatch(){
  if(LIVE_PATCH) return LIVE_PATCH;
  try{
    const hit = sessionStorage.getItem(PATCH_KEY);
    if(hit) return (LIVE_PATCH = hit);
  }catch(_){}
  return null;
}

async function loadLivePatch(){
  if(livePatch()) return LIVE_PATCH;
  try{
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {mode:"cors"});
    if(!res.ok) throw new Error(`versions.json ${res.status}`);
    const list = await res.json();
    LIVE_PATCH = shortPatch(list[0]);
    try{ sessionStorage.setItem(PATCH_KEY, LIVE_PATCH); }catch(_){}
  }catch(err){
    console.warn("Live patch unavailable:", err.message);
  }
  return LIVE_PATCH;
}

/* What every page prints. Never DD.patch — that is the art archive. */
const patchLabel = () => livePatch() ? "Patch " + livePatch() : "Live patch";

const DD = {
  /* 3.13.24 is the last Season 3 patch on Data Dragon — before the
     preseason-4 item overhaul. Item icons, champion portraits, ability
     icons and rune icons are all versioned, so they render as 2013 art. */
  patch: "3.13.24",
  base: "https://ddragon.leagueoflegends.com/cdn",
  lang: "en_US",

  img(kind, file){ return `${DD.base}/${DD.patch}/img/${kind}/${file}` },
  champImg:  id => DD.img("champion", id + ".png"),
  spellImg:  f  => DD.img("spell", f),
  passImg:   f  => DD.img("passive", f),
  itemImg:   f  => DD.img("item", f),
  runeImg:   f  => DD.img("rune", f),

  /* Fetch + cache a Data Dragon file for this patch. */
  async json(path){
    const key = `dd:${DD.patch}:${path}`;
    try{
      const hit = sessionStorage.getItem(key);
      if(hit) return JSON.parse(hit);
    }catch(_){}
    const url = `${DD.base}/${DD.patch}/data/${DD.lang}/${path}`;
    const res = await fetch(url, {mode:"cors"});
    if(!res.ok) throw new Error(`Data Dragon returned ${res.status} for ${path}`);
    const body = await res.json();
    try{ sessionStorage.setItem(key, JSON.stringify(body)); }catch(_){ /* quota — fine */ }
    return body;
  },

  champions: () => DD.json("champion.json"),
  champion:  id => DD.json(`champion/${id}.json`),
  items:     () => DD.json("item.json"),
  runes:     () => DD.json("rune.json"),
  spells:    () => DD.json("summoner.json")
};

/* ------------------------------------------------------------
   SUMMONER SPELLS
   League Classic runs the 16 that existed in the Season 3 era —
   including the ones since retired from live (Clairvoyance, Fortify,
   Promote, Rally). Data Dragon 3.13.24 carries those 16 plus Garrison,
   which was Dominion-only and isn't in the mode.

   The mode numbers spells by prefixing a 7: Flash 4 -> 74,
   Ignite 14 -> 714, Teleport 12 -> 712.
   ------------------------------------------------------------ */
/* Only used when the mode's own table isn't available — it decides the
   roster itself when it is. */
const SPELLS_NOT_IN_MODE = new Set(["Garrison"]);

let _spellCache = null;
async function loadSpells(){
  if(_spellCache) return _spellCache;
  /* Pull the mode's own table first. Callers used to fire this and
     CLASSIC.spellIndex() in parallel, which meant the list could be built
     and cached from the archive before the mode's numbers arrived — and
     then never corrected. */
  await CLASSIC.spellIndex().catch(() => {});
  const data = (await DD.spells()).data;
  _spellCache = Object.values(data)
    .filter(s => !SPELLS_NOT_IN_MODE.has(s.name))
    .map(s => ({
      id: s.id, key: s.key, name: s.name,
      /* Filled in from the mode's table by classicSpell_; there is no rule
         that derives it from the archive key. See CLASSIC.spellIndex. */
      classicId: null,
      description: s.description || "",
      tooltip: s.tooltip || "",
      /* Old Data Dragon records 0 for several spells rather than the real
         number, so treat 0 as "unknown" instead of printing a wrong value. */
      cooldown: Number(s.cooldownBurn) || 0,
      range: s.rangeBurn === "self" ? "Self" : (s.rangeBurn || ""),
      icon: DD.spellImg(s.image.full)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  /* When the mode's table is loaded it decides which spells exist, so the
     archive's extras drop out without needing a hand-kept exclusion list. */
  if(CLASSIC._spells && CLASSIC._spells.size)
    _spellCache = _spellCache.filter(sp => CLASSIC.spellByName(sp.name)).map(classicSpell_);
  SPELLS = _spellCache;          /* pages read this rather than each keeping a copy */
  return _spellCache;
}

/* Classic's own spell icons, same approach as items: index once from
   Community Dragon, fall back to the Season 3 art if unavailable. */
CLASSIC._spells = null;
/* The mode publishes its own summoner spell table, and it is better than the
   archive on every count: its own cooldowns (Ignite is 210s here against the
   archive's 180), its own wording — including the mastery lines, "Summoner's
   Resolve: Smite grants 10 gold per cast" — and its own art. The rows that
   belong to the mode are the ones whose gameModes list JADE.

   Keeps the whole record now, not just the icon path.

   Matched to the archive BY NAME, not by id. The mode's ids look like the
   archive's key with a 7 in front — Flash 4 -> 74, Ignite 14 -> 714 — and
   that holds for twelve of the sixteen, but not all: Clairvoyance is 75,
   Fortify 705, Rally 709, Revive 777. Following the rule sent archive
   Fortify to row 75, which is Clairvoyance, so Fortify was renamed and
   given Clairvoyance's text and art while the real Clairvoyance found no
   row and kept the archive's — two Clairvoyances in the picker. The names
   agree across all sixteen, so they are the reliable join. */
CLASSIC.spellIndex = async function(){
  if(CLASSIC._spells) return CLASSIC._spells;
  const key = "cd:classic-spells:v2";        /* v1 held icon paths only */
  try{
    const hit = sessionStorage.getItem(key);
    if(hit) return (CLASSIC._spells = indexSpellNames(new Map(JSON.parse(hit))));
  }catch(_){}
  try{
    const res = await fetch(`${CLASSIC.base}/v1/summoner-spells.json`, {mode:"cors"});
    if(!res.ok) throw new Error(`summoner-spells.json ${res.status}`);
    const rows = await res.json();
    const map = new Map();
    for(const s of rows){
      if(!s.id) continue;
      if(!(s.gameModes || []).includes("JADE")) continue;
      map.set(s.id, {
        id: s.id, name: s.name || "",
        description: s.description || "",
        cooldown: Number(s.cooldown) || 0,
        level: Number(s.summonerLevel) || 1,
        icon: s.iconPath ? assetUrl(s.iconPath) : null
      });
    }
    try{ sessionStorage.setItem(key, JSON.stringify([...map])); }catch(_){}
    return (CLASSIC._spells = indexSpellNames(map));
  }catch(err){
    console.warn("Classic spell data unavailable, using Season 3:", err.message);
    return (CLASSIC._spells = new Map());
  }
};
/* Both lookups come off the one fetch: by id for art, by name for the join
   with the archive. Lower-cased so a capitalisation change can't break it. */
CLASSIC._spellsByName = null;
function indexSpellNames(map){
  CLASSIC._spellsByName = new Map();
  for(const row of map.values())
    if(row.name) CLASSIC._spellsByName.set(row.name.toLowerCase(), row);
  return map;
}
CLASSIC.spellRow  = id   => (CLASSIC._spells && CLASSIC._spells.get(Number(id))) || null;
CLASSIC.spellByName = name => (CLASSIC._spellsByName &&
  CLASSIC._spellsByName.get(String(name || "").toLowerCase())) || null;
CLASSIC.spellIcon = id => (CLASSIC.spellRow(id) || {}).icon || null;

/* Fold the mode's own values over the archive's for one spell. Range isn't
   in the mode's file, so that stays with Data Dragon. */
function classicSpell_(sp){
  const row = CLASSIC.spellByName(sp.name);
  if(!row) return sp;
  return {...sp,
    classicId: row.id,          /* the mode's real id, for its art */
    name: row.name || sp.name,
    description: row.description || sp.description,
    cooldown: row.cooldown || sp.cooldown,
    source: "classic"};
}

/* ------------------------------------------------------------
   SHARED CATALOGUES

   The roster, the shop index and the guide tags. These began in
   create.html, which was fine while the creator was the only page that
   needed them — and stopped being fine the moment guide.html had to read
   the same guide the creator writes. Both pages now share one definition
   rather than two that can drift.
   ------------------------------------------------------------ */
let CHAMPIONS = [];
let ITEM_BY_ID = new Map();
/* The 16 summoner spells the mode runs, filled by loadSpells(). */
let SPELLS = [];

const TAGS = [{k:"comp", label:"Competitive"},
              {k:"fun",  label:"For fun"},
              {k:"new",  label:"Beginner friendly"}];

async function loadChampions(){
  if(CHAMPIONS.length) return CHAMPIONS;
  const data = (await DD.champions()).data;
  CHAMPIONS = Object.values(data).filter(inRoster).map(c => ({
    id: c.id, name: c.name, key: c.key,
    cls: (c.tags && c.tags[0]) || "Champion"
  })).sort((a, b) => a.name.localeCompare(b.name));
  return CHAMPIONS;
}
const champByName = n => CHAMPIONS.find(c => c.name === n) || null;
function champImgTag(c, cls){
  return art({s3: DD.champImg(c.id), classic: CLASSIC.champIcon(c.key, c.name),
              alt: c.name, cls, lazy: true});
}

async function loadItemIndex(){
  if(ITEM_BY_ID.size) return ITEM_BY_ID;
  const {byId} = await loadItems();
  ITEM_BY_ID = byId;
  return ITEM_BY_ID;
}
/* What counts as a buyable item. The mode's table carries a few internal
   entries that are inStore but free — "AD Rune Replacer" and "AP Rune
   Replacer", which hand a bot a rune page's worth of stats — and they are
   not things a guide would ever recommend. Costing nothing is what tells
   them apart. */
const inShop = it => !!it && it.inStore && it.total > 0;
const itemName = id => (ITEM_BY_ID.get(String(id)) || {}).name || String(id);
function itemImgTag(id, cls){
  const it = ITEM_BY_ID.get(String(id));
  if(!it) return `<span class="${cls} missing" title="Unknown item"></span>`;
  return art({s3: it.icon, classic: it.icon, alt: it.name, cls, lazy: true});
}

/* One place that decides which art a spell renders with. */
function spellArt(sp, extra = {}){
  return art({s3: sp.icon, classic: CLASSIC.spellIcon(sp.classicId), alt: sp.name, ...extra});
}

/* ------------------------------------------------------------
   TOOLTIPS

   One floating panel for the whole site, positioned fixed so nothing can
   clip it — the reason the creator's item pool needed this in the first
   place was a tooltip trying to escape a scroll box with overflow:auto.

   A page opts in by rendering data-tip-item on anything, and by
   registering its own kinds. Everything else — the panel, the placement,
   the hover wiring, hiding on scroll — is handled here, because the guide
   view and the creator had each grown their own copy and this is the third
   page that wants them.
   ------------------------------------------------------------ */
function tipHost(){
  let el = document.getElementById("siteTip");
  if(!el){
    el = document.createElement("div");
    el.id = "siteTip"; el.className = "item-tip"; el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

/* Above the thing it describes, unless that would run off the top, and
   never off either side. */
function placeTip(tip, el){
  const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), pad = 10;
  const left = r.left + r.width / 2 - t.width / 2;
  let   top  = r.top - t.height - 8;
  if(top < pad) top = r.bottom + 8;
  tip.style.left = Math.max(pad, Math.min(left, innerWidth  - t.width  - pad)) + "px";
  tip.style.top  = Math.max(pad, Math.min(top,  innerHeight - t.height - pad)) + "px";
}

let tipKey = null, tipTimer = null;
function showTip(el, kind, html){
  if(!html) return;
  const tip = tipHost();
  clearTimeout(tipTimer);
  tipKey = kind;
  /* Items get the wider shell; everything else the standard one. */
  tip.className = kind === "item" ? "item-tip" : "spell-tip";
  tip.innerHTML = html;
  tip.hidden = false;
  placeTip(tip, el);
  tip.classList.add("show");
}
function hideTip(){
  if(tipKey === null) return;
  tipKey = null;
  const tip = tipHost();
  tip.classList.remove("show");
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { tip.hidden = true; }, 120);
}

/* What the shop card shows: the name, the gold cost beside it, and the
   mode's own rich text — already converted by cdText(), which is why it
   goes in as HTML rather than being escaped. */
function itemTipHtml(id){
  const it = ITEM_BY_ID.get(String(id));
  if(!it) return "";
  /* Only worth printing the combine cost when the item is built from
     something — for a component it's the same number twice. */
  const combine = it.combine && it.total && it.combine !== it.total ? it.combine : null;
  return `<div class="tip-hd">
      ${art({s3: it.icon, classic: it.icon, alt: ""})}
      <h4>${esc(it.name)}</h4>
      ${it.total ? `<span class="rank">${it.total}g</span>` : ""}
    </div>
    ${it.descHtml ? `<div class="dd">${it.descHtml}</div>` : ""}
    ${combine ? `<div class="tip-nums"><span>Combine cost <b>${combine}g</b></span></div>` : ""}
    ${buildPathHtml(it)}`;
}

/* What it's made of and what it turns into — the one thing the in-game
   shop panel shows that this didn't. Icons rather than names: a list of
   six item names is a paragraph, six icons is a glance.

   "Builds into" is capped, because a basic component like Long Sword feeds
   most of the shop and an uncapped list would run off the screen. */
const BUILDS_INTO_CAP = 8;
function buildPathHtml(it){
  const row = (label, ids, cap) => {
    const known = ids.map(id => ITEM_BY_ID.get(String(id))).filter(Boolean);
    if(!known.length) return "";
    const shown = cap ? known.slice(0, cap) : known;
    const rest  = known.length - shown.length;
    return `<div class="tip-path">
      <span class="lbl">${label}</span>
      ${shown.map(c => art({s3: c.icon, classic: c.icon, alt: c.name, cls: "pi"})).join("")}
      ${rest ? `<span class="more">+${rest}</span>` : ""}
    </div>`;
  };
  return row("Builds from", it.from || [], 0)
       + row("Builds into", it.to   || [], BUILDS_INTO_CAP);
}

/* Kinds, in the order they're tried. Items are registered here so any page
   that renders data-tip-item gets them without writing a line of script;
   a page with its own kinds (abilities, runes, reference chips) adds them
   with registerTip. One listener serves all of them, so pages can't end up
   fighting each other over whether the panel should be up. */
const TIP_KINDS = [];
function registerTip(selector, kind, build){ TIP_KINDS.push({selector, kind, build}); }
registerTip("[data-tip-item]", "item", el => itemTipHtml(el.dataset.tipItem));

document.addEventListener("mouseover", e => {
  for(const {selector, kind, build} of TIP_KINDS){
    const hit = e.target.closest?.(selector);
    if(hit) return showTip(hit, kind, build(hit));
  }
  hideTip();
});
/* The panel is fixed, so a scroll would leave it pointing at nothing. */
addEventListener("scroll", hideTip, {passive: true});

/* ------------------------------------------------------------
   CHAMPION ABILITIES

   The mode ships a file per champion at v1/champions/<60000+key>.json
   carrying its own ability names, art, descriptions and per-rank numbers.
   That's the right source — Classic renamed and reworked enough kits that
   the 2013 archive would be quietly wrong in places.

   Two things about the raw shape are worth knowing:

   - `cost` and `cooldown` are unresolved templates ("@Cost@
     @AbilityResourceName@"). The real numbers are in costCoefficients /
     cooldownCoefficients, so those are used and the templates ignored —
     except for the literal "No Cost", which is a reliable free-cast flag.
   - Every coefficient array is 6 long regardless of the ability. Basics
     have 5 real ranks and ultimates 3; the tail is padding, which is why
     Annie's R reads [100,100,100,0,0,0]. Reading past the rank count would
     invent a "0 mana" rank, so each array is cut to length first.

   Falls back to Data Dragon 3.13.24 when the Classic file can't be had.
   ------------------------------------------------------------ */
const ABILITY_KEYS = ["q", "w", "e", "r"];
const ranksOf = key => (key === "r" ? 3 : 5);

/* "60/65/70/75/80", or just "60" when every rank is the same. */
function burnList(values){
  if(!values || !values.length) return null;
  const tidy = values.map(v => Math.round(Number(v) * 100) / 100);
  if(tidy.every(v => v === tidy[0])) return String(tidy[0]);
  return tidy.join(" / ");
}
const allZero = v => !v || !v.length || v.every(n => !Number(n));

function classicSpell(raw){
  const key = String(raw.spellKey || "").toLowerCase();
  const n = ranksOf(key);
  const cut = a => Array.isArray(a) ? a.slice(0, n) : null;
  const cost = cut(raw.costCoefficients), cd = cut(raw.cooldownCoefficients), rng = cut(raw.range);

  /* Most costs come through as the template "@Cost@ @AbilityResourceName@"
     and have to be read from the coefficients. A few are written out in
     full instead — Akali's ultimate costs "1 Essence Of Shadow", which no
     coefficient array can express — so a literal string wins when there is
     one. "No Cost" is the free-cast flag. */
  const raw_cost = String(raw.cost || "").replace(/<[^>]+>/g, "").trim();
  const literalCost = raw_cost && !raw_cost.includes("@") && !/no\s*cost/i.test(raw_cost)
    /* Warwick E, Jax R and Vayne W give their cost as "Passive" — that's a
       statement about the ability, not a price, so it isn't a cost line. */
    && !/^passive$/i.test(raw_cost)
    ? raw_cost : null;
  const free = /no\s*cost/i.test(raw_cost) || (!literalCost && allZero(cost));
  return {
    key, letter: key.toUpperCase(), name: raw.name || key.toUpperCase(),
    icon: raw.abilityIconPath ? assetUrl(raw.abilityIconPath) : null,
    desc: raw.description || "",
    cost: free ? null : (literalCost || burnList(cost)),
    cooldown: allZero(cd) ? null : burnList(cd),
    range: allZero(rng) ? null : burnList(rng),
    /* The same numbers rank by rank, for "what does this do at rank 3".
       literalCost has no per-rank form, so it repeats. */
    perRank: {
      cost: free ? null : (literalCost ? Array(n).fill(literalCost)
                                       : cost.map(v => String(Math.round(v * 100) / 100))),
      cooldown: allZero(cd) ? null : cd.map(v => String(Math.round(v * 100) / 100)),
      range: allZero(rng) ? null : rng.map(v => String(Math.round(v * 100) / 100))
    },
    ranks: n
  };
}

/* "60/65/70/75/80" -> ["60","65","70","75","80"]; a single value repeats,
   which is how Data Dragon writes an ability that doesn't scale. */
function burnSplit(s, n){
  const parts = String(s || "").split("/").map(x => x.trim()).filter(Boolean);
  if(!parts.length) return null;
  return Array.from({length: n}, (_, i) => parts[i] ?? parts[parts.length - 1]);
}

/* What an ability costs, waits and reaches at one particular rank. */
function spellAtRank(sp, rank){
  if(!sp) return {};
  const at = a => a && a.length ? a[Math.max(0, Math.min(rank, a.length) - 1)] : null;
  const p = sp.perRank || {};
  return {cooldown: at(p.cooldown), cost: at(p.cost), range: at(p.range)};
}

/* Data Dragon's own per-rank strings are already burned into "60/65/70". */
function s3Spell(raw, key){
  const clean = s => ddText(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    key, letter: key.toUpperCase(), name: raw.name || key.toUpperCase(),
    icon: raw.image && raw.image.full ? DD.spellImg(raw.image.full) : null,
    desc: clean(raw.description),
    cost: /^0( \/ 0)*$/.test(raw.costBurn || "") ? null : (raw.costBurn || "").replace(/\//g, " / "),
    cooldown: (raw.cooldownBurn || "").replace(/\//g, " / ") || null,
    range: /^self$/i.test(raw.rangeBurn || "") ? null : (raw.rangeBurn || "").replace(/\//g, " / "),
    perRank: {
      cost: /^0( \/ 0)*$/.test(raw.costBurn || "") ? null : burnSplit(raw.costBurn, ranksOf(key)),
      cooldown: burnSplit(raw.cooldownBurn, ranksOf(key)),
      range: /^self$/i.test(raw.rangeBurn || "") ? null : burnSplit(raw.rangeBurn, ranksOf(key))
    },
    ranks: ranksOf(key)
  };
}

const _champSpells = new Map();     /* champion id -> promise */

function loadChampSpells(champ){
  if(!champ) return Promise.resolve(null);
  if(_champSpells.has(champ.id)) return _champSpells.get(champ.id);

  const job = (async () => {
    /* Classic first. The PBE root stays in the fallback chain so a
       champion that lands there before live still resolves. */
    if(champ.key){
      const roots = CLASSIC.isPBE(champ.name)
        ? [CLASSIC.pbeBase, CLASSIC.base]
        : [CLASSIC.base, CLASSIC.pbeBase];
      for(const root of roots){
        try{
          const url = `${root}/v1/champions/${CLASSIC.champId(champ.key)}.json`;
          const res = await fetch(url, {mode:"cors"});
          if(!res.ok) continue;
          const doc = await res.json();
          const byKey = new Map((doc.spells || []).map(s => [String(s.spellKey).toLowerCase(), s]));
          if(ABILITY_KEYS.some(k => !byKey.has(k))) continue;
          /* The same file carries the skins, so the splash comes free with
             the abilities. Prefer the mode's own Classic skin (301) — that
             is the art the game actually shows — then the base skin. */
          const skins = doc.skins || [];
          const skin = skins.find(s => /classic/i.test(s.name || "") || String(s.id).endsWith("301"))
                    || skins.find(s => s.isBase) || skins[0];
          /* Uncentered, because that's the framing the face table below was
             measured against — the centered version reframes the art. */
          return {
            source: "classic",
            splash: skin ? assetUrl(skin.uncenteredSplashPath || skin.splashPath) : null,
            passive: doc.passive ? {
              key: "p", letter: "P", name: doc.passive.name || "Passive",
              icon: doc.passive.abilityIconPath ? assetUrl(doc.passive.abilityIconPath) : null,
              desc: doc.passive.description || "", ranks: 0
            } : null,
            spells: ABILITY_KEYS.map(k => classicSpell(byKey.get(k)))
          };
        }catch(_){ /* try the next root, then Data Dragon */ }
      }
    }

    const doc = (await DD.champion(champ.id)).data[champ.id];
    return {
      source: "season3",
      splash: `${DD.base}/img/champion/splash/${champ.id}_0.jpg`,
      passive: doc.passive ? {
        key: "p", letter: "P", name: doc.passive.name,
        icon: doc.passive.image ? DD.passImg(doc.passive.image.full) : null,
        desc: ddText(doc.passive.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        ranks: 0
      } : null,
      spells: (doc.spells || []).slice(0, 4).map((s, i) => s3Spell(s, ABILITY_KEYS[i]))
    };
  })().catch(err => {
    console.warn(`Abilities unavailable for ${champ.name}:`, err.message);
    return null;
  });

  _champSpells.set(champ.id, job);
  return job;
}

/* ------------------------------------------------------------
   Image helper — emits an <img> that tries the preferred art source
   and silently drops back to the Season 3 archive if it 404s.
   Call as art({s3:"...", classic:"...", alt:"", cls:"", lazy:true}).
   ------------------------------------------------------------ */
function art({s3, classic, alt = "", cls = "", lazy = false, style = ""}){
  const useClassic = classicReady() && classic;
  const src = useClassic ? classic : s3;
  const fb  = useClassic && classic !== s3 ? ` data-fb="${esc(s3)}"` : "";
  return `<img${cls ? ` class="${esc(cls)}"` : ""}${style ? ` style="${esc(style)}"` : ""}` +
         `${lazy ? ' loading="lazy"' : ""} src="${esc(src)}" alt="${esc(alt)}"${fb}>`;
}

/* One capture-phase listener covers every image on the page. */
addEventListener("error", e => {
  const el = e.target;
  if(!(el instanceof HTMLImageElement)) return;
  const fb = el.dataset.fb;
  if(fb && el.src !== fb){ el.removeAttribute("data-fb"); el.src = fb; }
}, true);

/* ------------------------------------------------------------
   The League Classic roster.
   Matched on a normalised key so it works whether Data Dragon spells a
   champion "Chogath" or "Cho'Gath", "MonkeyKing" or "Wukong" — ids have
   changed casing between patches, display names are steadier.
   ------------------------------------------------------------ */
const CLASSIC_ROSTER = [
  "Ahri","Alistar","Amumu","Anivia","Annie","Ashe","Blitzcrank","Brand","Cho'Gath","Corki",
  "Dr. Mundo","Evelynn","Ezreal","Fiddlesticks","Gangplank","Garen","Gragas","Heimerdinger",
  "Janna","Jarvan IV","Jax","Karthus","Kassadin","Katarina","Kayle","Kog'Maw","Lee Sin","Leona",
  "Lulu","Lux","Malphite","Malzahar","Master Yi","Miss Fortune","Morgana","Nasus","Nidalee",
  "Nunu","Olaf","Pantheon","Rammus","Ryze","Shaco","Singed","Sion","Sivir","Skarner","Sona",
  "Soraka","Taric","Teemo","Tristana","Tryndamere","Twisted Fate","Twitch","Vayne","Veigar",
  "Warwick","Wukong","Zilean",
  /* Shipped to live 12 Aug 2026. */
  "Akali","Kennen","Shen"
];
const normKey = s => String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const ROSTER_SET = new Set(CLASSIC_ROSTER.map(normKey).concat(["monkeyking"]));
const inRoster = c => ROSTER_SET.has(normKey(c.id)) || ROSTER_SET.has(normKey(c.name));

/* ------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------ */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const qs = k => new URLSearchParams(location.search).get(k);
const num = n => Number.isInteger(n) ? n : Math.round(n*100)/100;

/* Data Dragon descriptions use custom pseudo-tags. Translate the ones we
   care about into spans and drop everything else — never inject raw. */
const DD_TAGS = {
  unique:     ['<span class="u">',      "</span>"],
  stats:      ['<span class="stat">',   "</span>"],
  active:     ['<span class="active">', "</span>"],
  passive:    ['<span class="passive">',"</span>"],
  grouplimit: ['<span class="lim">',    "</span>"],
  rules:      ['<span class="lim">',    "</span>"],
  i:          ["<em>",                  "</em>"],
  b:          ["<b>",                   "</b>"]
};
function ddText(html){
  if(!html) return "";
  let s = String(html);
  /* Drop dangerous elements *and* their contents outright. */
  s = s.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");

  /* Swap known tags for placeholders, bin the rest, then escape whatever
     text is left before restoring the placeholders. Nothing an attacker
     controls can reach the output as markup. */
  const marks = [];
  s = s.replace(/<(\/?)([a-zA-Z][\w-]*)[^>]*>/g, (m, close, tag) => {
    const pair = DD_TAGS[tag.toLowerCase()];
    if(!pair) return "";
    marks.push(close ? pair[1] : pair[0]);
    return ` ${marks.length - 1} `;
  });
  s = esc(s).replace(/ (\d+) /g, (m, i) => marks[+i] || "");

  /* Joined with <br> rather than one <div> per line: a <stats> block can
     legally span several lines, and wrapping each line in its own element
     would close the span inside the wrong parent. */
  return s.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
}

/* ------------------------------------------------------------
   Community Dragon uses a different markup vocabulary to Data Dragon —
   <mainText>, <stats>, <attention>, damage-type tags and bare <li>.
   Same whitelist-and-escape approach: nothing unknown reaches the page.
   ------------------------------------------------------------ */
const CD_TAGS = {
  stats:["<span class=\"cd-stats\">","</span>"], attention:["<span class=\"cd-num\">","</span>"],
  passive:["<span class=\"passive\">","</span>"], active:["<span class=\"active\">","</span>"],
  rules:["<span class=\"lim\">","</span>"],      flavortext:["<span class=\"cd-flavor\">","</span>"],
  unique:["<span class=\"u\">","</span>"],        keyword:["<span class=\"u\">","</span>"],
  keywordstealth:["<span class=\"u\">","</span>"],status:["<span class=\"u\">","</span>"],
  spellname:["<span class=\"u\">","</span>"],     gold:["<span class=\"cd-gold\">","</span>"],
  magicdamage:["<span class=\"cd-magic\">","</span>"],
  physicaldamage:["<span class=\"cd-phys\">","</span>"],
  truedamage:["<span class=\"cd-true\">","</span>"],
  healing:["<span class=\"cd-heal\">","</span>"], lifesteal:["<span class=\"cd-heal\">","</span>"],
  shield:["<span class=\"cd-shield\">","</span>"],speed:["<span class=\"cd-speed\">","</span>"],
  attackspeed:["<span class=\"cd-num\">","</span>"], onhit:["<span class=\"cd-num\">","</span>"],
  scaleap:["<span class=\"cd-magic\">","</span>"],scalead:["<span class=\"cd-phys\">","</span>"],
  scalehealth:["<span class=\"cd-heal\">","</span>"],scalemana:["<span class=\"cd-mana\">","</span>"],
  b:["<b>","</b>"]
};
function cdText(html){
  if(!html) return "";
  let s = String(html);
  s = s.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<li>/gi, "\n• ");           /* bare <li>, never closed */
  const marks = [];
  s = s.replace(/<(\/?)([a-zA-Z][\w-]*)[^>]*>/g, (m, close, tag) => {
    const pair = CD_TAGS[tag.toLowerCase()];
    if(!pair) return "";
    marks.push(close ? pair[1] : pair[0]);
    return ` ${marks.length - 1} `;
  });
  s = esc(s).replace(/ (\d+) /g, (m, i) => marks[+i] || "");
  /* Joined with <br> rather than one <div> per line: a <stats> block can
     legally span several lines, and wrapping each line in its own element
     would close the span inside the wrong parent. */
  return s.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
}

/* ------------------------------------------------------------
   One normalised item shape, whichever source it came from, so the
   browse and detail pages don't each need two code paths.
     {id, name, blurb, descHtml, total, combine, sell, icon, from, to,
      tags, inStore, source}
   ids stay in live-item space (3020, not 773020) so links are stable
   across sources.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   Items that sit in the raw data but aren't in League Classic.
   Two reasons an item gets dropped:
     · it belongs to a champion the mode doesn't have (Viktor's Hex Core)
     · it's a developer or joke item that never reaches a real shop
   The champion check is generic, so Kalista's spear or Ornn's upgrades
   would be filtered the same way without another edit here.
   ------------------------------------------------------------ */
const EXCLUDED_ITEM_PATTERNS = [
  /golden\s*spatula/i,    /* developer item, never in a real shop */
  /hex\s*core/i,          /* Viktor — "Prototype Hex Core", "The Hex Core mk-1", etc. */
  /zz.?rot\s*portal/i     /* Season 5 item; not in the mode's shop */
];
function isExcludedItem(name, requiredChampion){
  if(EXCLUDED_ITEM_PATTERNS.some(re => re.test(name || ""))) return true;
  /* Champion-locked to someone outside the roster. */
  if(requiredChampion && !ROSTER_SET.has(normKey(requiredChampion))) return true;
  return false;
}

async function loadItems(){
  const classic = await CLASSIC.itemData();
  if(classic.size){
    const byId = new Map();
    for(const rec of classic.values()){
      if(isExcludedItem(rec.name, rec.requiredChampion)) continue;
      const liveId = String(rec.id - CLASSIC.itemOffset);
      byId.set(liveId, {
        id: liveId, name: rec.name, blurb: "",
        descHtml: cdText(rec.description),
        total: rec.priceTotal, combine: rec.price, sell: null,
        icon: rec.icon,
        from: rec.from.map(x => String(x - CLASSIC.itemOffset)),
        to:   rec.to.map(x => String(x - CLASSIC.itemOffset)),
        tags: rec.categories, inStore: rec.inStore, source: "classic"
      });
    }
    return {byId, source: "classic"};
  }
  /* Season 3 archive. Not a preference any more — this is what's left when
     the mode's own table can't be reached at all. */
  const data = (await DD.items()).data;
  const byId = new Map();
  for(const [id, it] of Object.entries(data)){
    if(!(it.maps && it.maps["1"] === true)) continue;
    if(!(it.gold && it.gold.purchasable !== false && it.gold.total > 0)) continue;
    if(isExcludedItem(it.name, it.requiredChampion)) continue;
    byId.set(id, {
      id, name: it.name, blurb: it.plaintext || "",
      descHtml: ddText(it.description),
      total: it.gold.total, combine: it.gold.base, sell: it.gold.sell,
      icon: DD.itemImg(it.image.full),
      from: (it.from || []), to: (it.into || []),
      tags: it.tags || [], inStore: true, source: "season3",
      stats: it.stats || {}
    });
  }
  return {byId, source: "season3"};
}

/* ------------------------------------------------------------
   ITEM TIERS
   League's shop sorts items by how far along a recipe they sit. Season 3
   called the middle rung "Advanced"; modern League renamed it "Epic".
   Since Classic is built on Season 3, the older names are used here.

   Tier is derived from the recipe rather than a hand-kept list, so it
   stays correct as the mode patches:
     builds from nothing, builds into something  -> Basic (a component)
     builds from something, builds into something-> Advanced
     builds from something, builds into nothing  -> Legendary (finished)
     no recipe either way                        -> Starter, if it's cheap
   ------------------------------------------------------------ */
const ITEM_TIERS = [
  {key:"starter",    name:"Starter",     colour:"#7fd8a0",
   blurb:"No recipe — bought with opening gold and sold on later."},
  {key:"basic",      name:"Basic",       colour:"#8b9bb0",
   blurb:"Components. Built from nothing, feed into everything else."},
  {key:"advanced",   name:"Advanced",    colour:"#6fbfe0",
   blurb:"Built from basics, and usually a step toward a legendary. Modern League calls these Epic."},
  {key:"legendary",  name:"Legendary",   colour:"#e8cd8a",
   blurb:"Finished items — the highest stats, and they build into nothing."},
  {key:"consumable", name:"Consumables", colour:"#d48fb5",
   blurb:"Potions, wards and elixirs."},
  {key:"trinket",    name:"Trinkets",    colour:"#a48fd4",
   blurb:"Free utility items."}
];
const TIER_BY_KEY = Object.fromEntries(ITEM_TIERS.map(t => [t.key, t]));
const STARTER_MAX_GOLD = 1000;

function itemTier(it){
  const cat = new Set(it.tags || []);
  if(cat.has("Trinket"))    return "trinket";
  if(cat.has("Consumable")) return "consumable";
  const hasFrom = (it.from || []).length > 0;
  const hasTo   = (it.to   || []).length > 0;
  if(hasFrom && hasTo)  return "advanced";
  if(hasFrom && !hasTo) return "legendary";
  if(!hasFrom && hasTo) return "basic";
  /* No recipe in either direction: cheap means it's a starter, otherwise
     it's a finished item that simply has no components. */
  return (it.total || 0) <= STARTER_MAX_GOLD ? "starter" : "legendary";
}

/* ------------------------------------------------------------
   Chrome — header and footer, shared across every page
   ------------------------------------------------------------ */
const NAV = [
  ["Guides",    "index.html#guides"],
  ["Champions", "champions.html"],
  ["Items",     "items.html"],
  ["Runes",     "runes.html"],
  ["Spells",    "spells.html"]
  /* "Tier List" used to sit here, pointing at index.html#tierlist — a
     section the home page has never had. There is no masteries page to put
     in its place either: the mastery builder lives in the creator, and
     masteries.html is only a redirect for old bookmarks. */
];

/* ------------------------------------------------------------
   ACCOUNT

   There is no auth yet, so this is a stand-in — but a deliberately
   shaped one. Every page asks the same two questions a real session
   would answer: who is signed in, and are they signed in at all. When
   auth arrives, currentUser() calls the provider and signIn/signOut
   redirect; the header, the publish stamp and "My guides" don't change.

   The id is what published guides are stamped with, not the name, so
   renaming yourself doesn't orphan everything you have written.
   ------------------------------------------------------------ */
/* Storage keys keep the old "riftvault." prefix on purpose, and so do the
   draft, published and vote keys in guide-load.js. They are private names
   nobody sees, and renaming them would orphan every draft and published
   guide already sitting in a browser — a silent data loss with no visible
   upside. Rename them only alongside a migration that copies the old keys
   across, and only if there is ever a reason to. */
const ACCOUNT_KEY = "riftvault.account.v1";

let currentUser = function(){
  try{
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if(raw) return JSON.parse(raw);
  }catch(_){}
  return null;
};
function signIn(name){
  const user = currentUser() || {id: "u" + Math.random().toString(36).slice(2, 10)};
  user.name = String(name || user.name || "Summoner").trim().slice(0, 24) || "Summoner";
  try{ localStorage.setItem(ACCOUNT_KEY, JSON.stringify(user)); }catch(_){}
  return user;
}
function signOut(){
  try{ localStorage.removeItem(ACCOUNT_KEY); }catch(_){}
  if(typeof signOutRemote === "function") signOutRemote();
}

/* With a backend configured, who you are is whoever the token says. The
   local record above is the offline stand-in and is ignored entirely.

   THIS IS KEYED ON CONFIGURATION, NOT ON LOAD STATE, and that distinction
   is the whole bug it fixes. It used to ask STORE.live(), which is false
   until loadStore() has finished — so the header painted once from the
   leftover local record (showing whatever name had been typed into the old
   prompt), then again from the real session, and the username visibly
   changed a second after every page load. Two identity systems taking
   turns.

   Now: backend configured means the local record is never consulted, even
   before the network answers. */
function realAccounts(){
  /* try/catch, not a typeof guard. SB is a `const` in guide-store.js,
     which loads after this file, and `typeof` on a const in its temporal
     dead zone THROWS rather than returning "undefined" — the usual
     defensive check is no defence at all here. Pages that never load the
     store never define SB, and land in the same catch. */
  try{ return typeof SB !== "undefined" && SB.on; }
  catch(_){ return false; }
}
const _localUser = currentUser;
currentUser = function(){
  try{
    if(realAccounts()) return typeof STORE !== "undefined" ? STORE.me() : null;
  }catch(_){}
  return _localUser();
};

/* Whether we simply don't know yet. Between first paint and loadStore()
   resolving there is no answer, and guessing produces the flicker above. */
function accountPending(){
  try{
    if(!realAccounts() || typeof STORE === "undefined") return false;
    /* settled(), not live(). live() is false both while the request is in
       flight AND after it has failed, so keying the placeholder on it meant
       a failed load showed … for the rest of the session with no way out.
       A failure is an answer: signed out, offline, here is a Sign in
       button. The fallback keeps this working against an older store. */
    return typeof STORE.settled === "function" ? !STORE.settled() : !STORE.live();
  }catch(_){ return false; }
}

/* A leftover from before real accounts existed. Left in place it does
   nothing visible, but it is a second source of truth for "who am I",
   which is what caused the flicker in the first place. Cleared on first
   paint rather than at load: at load, SB does not exist yet. */
let legacyCleared = false;
function clearLegacyAccount(){
  if(legacyCleared || !realAccounts()) return;
  legacyCleared = true;
  try{ localStorage.removeItem(ACCOUNT_KEY); }catch(_){}
}
const signedIn = () => !!currentUser();

/* `cta` replaces the header's call to action for pages where "Write a
   guide" is the wrong offer — the creator, where you already are. Passed in
   rather than swapped out afterwards, so no page has to reach into the
   chrome and hope the markup hasn't moved. */
/* The mark, inline. Kept as one definition here rather than an <img> so it
   costs no request and inherits the page's own colours if it ever needs to;
   logo.svg on disk is the same artwork for the favicon and for sharing.
   Change one, change the other — tools/make-icons.py rebuilds the rasters. */
function logoSvg(size){
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 64 64"
      aria-hidden="true" focusable="false">
    <defs><linearGradient id="s3f${size}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6cf9a"/><stop offset="1" stop-color="#8a6d24"/>
    </linearGradient></defs>
    <rect x="2" y="2" width="60" height="60" rx="6" fill="url(#s3f${size})"/>
    <rect x="7" y="7" width="50" height="50" rx="3" fill="#1d1811"/>
    <g fill="none" stroke="#e6cf9a" stroke-width="3.5" stroke-linecap="round">
      <path d="M27.95 20.05 A7 7 0 1 0 23 32 A7 7 0 1 1 18.05 43.95"/>
      <path d="M36.05 20.05 A7 7 0 1 1 41 32 A7 7 0 1 1 36.05 43.95"/>
    </g>
  </svg>`;
}

function renderChrome(active, cta){
  const header = document.createElement("header");
  header.className = "site";
  header.innerHTML = `<div class="wrap hdr">
    <a class="brand" href="index.html">${logoSvg(26)}Builds</a>
    <nav class="main">${NAV.map(([label, href]) =>
      `<a href="${href}" class="${label===active?"on":""}">${label}</a>`).join("")}</nav>
    <span class="patch-chip" title="The patch League Classic is running">
      <span data-patch>${patchLabel()}</span></span>
    ${cta || `<a class="btn btn-gold" href="create.html">Write a guide</a>`}
    <div class="account" id="account"></div>
  </div>`;
  document.body.prepend(header);
  paintAccount();

  const footer = document.createElement("footer");
  footer.className = "site";
  footer.innerHTML = `<div class="wrap">
    <p class="legal">S3 Builds is a fan-made community project. It is not endorsed by, sponsored by,
      or affiliated with Riot Games. Guides here are written for League Classic, currently on
      <span data-patch>${patchLabel()}</span>; the Season 3 artwork is loaded from Riot's Data Dragon
      service at patch ${DD.patch}. League of Legends and Riot Games are trademarks or
      registered trademarks of Riot Games, Inc. See Riot's
      <a href="https://www.riotgames.com/en/legal" target="_blank" rel="noopener">Legal Jibber Jabber policy</a>.</p>
    <div class="flinks"><a href="index.html">Home</a><a href="champions.html">Champions</a>
      <a href="items.html">Items</a><a href="runes.html">Runes</a>
      <span style="margin-left:auto;color:var(--muted-2)">© 2026 S3 Builds</span></div>
  </div>`;
  document.body.append(footer);

  /* The label renders before the number is known, so every place that shows
     it is marked and filled in once. */
  loadLivePatch().then(paintPatch);
}

/* Safe to call at any time, and pages that paint asynchronously call it
   after their own render — the chrome resolves the number once, but the
   elements that show it may not exist yet when it does. */
function paintPatch(){
  for(const el of document.querySelectorAll("[data-patch]")) el.textContent = patchLabel();
}

/* The account corner: who you are, and the one thing you want from it —
   your own guides. Everything here is delegated from the document, so it
   survives being repainted. */
function paintAccount(){
  const box = document.getElementById("account");
  if(!box) return;
  clearLegacyAccount();

  /* Say nothing rather than something wrong. The session is one round trip
     away and a wrong name for that second is worse than a blank space. */
  if(accountPending()){
    box.innerHTML = `<span class="acct-wait" aria-live="polite">…</span>`;
    return;
  }

  const user = currentUser();

  /* Signed in but nameless. Every guide they publish would be bylined with
     nothing, so this is a prompt rather than a preference — but a link,
     not a modal: interrupting someone mid-page to demand a nickname is
     worse than a button that waits. */
  if(user && user.named === false){
    box.innerHTML = `<a class="btn btn-sm btn-gold acct-setup" href="account.html">
      Pick a display name</a>`;
    return;
  }

  box.innerHTML = user
    ? `<button type="button" class="acct-btn" id="acctBtn" aria-haspopup="true">
         ${user.avatar && typeof champByName === "function" && (CHAMPIONS || []).length
             ? (() => { const c = (CHAMPIONS || []).find(x => x.id === user.avatar);
                        return c ? champImgTag(c, "acct-face img") : ""; })()
             : `<span class="acct-face">${esc((user.name || "?").slice(0, 1).toUpperCase())}</span>`}
         <span class="acct-name">${esc(user.name)}</span>
         <span class="acct-caret">▾</span>
       </button>
       <div class="acct-menu" id="acctMenu" hidden>
         <a href="account.html">Your account</a>
         <a href="guide.html?list=1">My guides</a>
         <a href="create.html">Write a guide</a>
         <button type="button" data-acct="out">Sign out</button>
       </div>`
    : realAccounts()
      /* The field is behind a button rather than always open. An email box
         sitting in the header of every page asks a question most visitors
         have no reason to answer — they came to read a guide. */
      ? `<span class="acct-out">
           <button type="button" class="btn btn-sm" data-acct="open">Sign in</button>
         </span>`
      /* No backend: the old local stand-in, so the creator still works
         offline and every node harness keeps passing. */
      : `<button type="button" class="btn btn-sm" data-acct="in">Sign in</button>`;
}

/* The store finished (or failed). Repaint the header from what it knows
   now, and say so if we've just come back from an email link. */
addEventListener("s3:store-loaded", () => {
  paintAccount();
  signInLanding();
});

/* Opening the sign-in form. Rendered next to the button rather than as a
   modal: it is one field, and it should not take the page away from
   someone who clicked it by accident. */
/* A real dialog. <dialog> rather than a hand-rolled overlay: it traps
   focus, closes on Escape, and renders above everything without a z-index
   argument — all things a div would have to reimplement badly. */
function signInDialog(){
  let d = document.getElementById("signinDlg");
  if(d) return d;
  d = document.createElement("dialog");
  d.id = "signinDlg";
  d.className = "signin-dlg";
  d.innerHTML = `
    <form method="dialog" class="signin-close-row">
      <button class="signin-x" value="cancel" aria-label="Close">×</button>
    </form>
    <div class="signin-body">
      <h2>Sign in to S3 Builds</h2>
      <p class="signin-lede">No password. We'll email you a link that signs you
        straight in.</p>
      <form class="acct-in" id="acctIn">
        <input type="email" name="email" required placeholder="you@example.com"
               aria-label="Email address" autocomplete="email">
        <button type="submit" class="btn btn-gold">Send the link</button>
      </form>
      <p class="signin-fine">You need an account to publish a guide or upvote one.
        Reading needs nothing.</p>
    </div>`;
  document.body.appendChild(d);
  /* Clicking the backdrop closes it. A dialog's own rect is the whole
     element, so a click landing outside those bounds is the backdrop. */
  d.addEventListener("click", ev => {
    const r = d.getBoundingClientRect();
    const inside = ev.clientX >= r.left && ev.clientX <= r.right &&
                   ev.clientY >= r.top  && ev.clientY <= r.bottom;
    if(!inside) d.close();
  });
  return d;
}

document.addEventListener("click", e => {
  if(!e.target.closest('[data-acct="open"]')) return;
  const d = signInDialog();
  d.showModal();
  const input = d.querySelector("input");
  if(input){ input.value = ""; input.focus(); }
});

/* Email, no password. Supabase mails a link; following it lands back here
   with a token in the fragment, which guide-store.js lifts out and wipes.

   The form is replaced by its own confirmation rather than a toast: the
   next thing to do is go and read an email, and that instruction should
   stay on screen rather than fading after three seconds. */
document.addEventListener("submit", async e => {
  const form = e.target.closest("#acctIn");
  if(!form) return;
  e.preventDefault();
  const email = form.email.value.trim();
  const btn = form.querySelector("button");
  btn.disabled = true; btn.textContent = "Sending…";
  try{
    await sendMagicLink(email);
    const body = form.closest(".signin-body") || form.parentElement;
    body.innerHTML = `<h2>Check your email</h2>
      <p class="signin-lede">A sign-in link is on its way to
        <b>${esc(email)}</b>. Open it on this device and you'll land back here,
        signed in.</p>
      <p class="signin-fine">Nothing yet? Look in spam — and note the free tier
        only sends a handful of these an hour.</p>`;
  }catch(err){
    btn.disabled = false; btn.textContent = "Send link";
    /* Replaced rather than appended: clicking twice used to stack two
       identical errors under the field. */
    const old = form.parentElement.querySelector(".acct-err");
    if(old) old.remove();
    form.insertAdjacentHTML("afterend", `<span class="acct-err">${esc(err.message)}</span>`);
  }
});

/* Arriving back from the email. captureSession() has already taken the
   token out of the address bar by the time anything paints, so without
   this the page just silently looks different and the reader is left to
   infer that it worked. */
function signInLanding(){
  if(!sessionStorage.getItem("riftvault.just-signed-in")) return;
  sessionStorage.removeItem("riftvault.just-signed-in");
  const me = currentUser();
  if(!me) return;
  const bar = document.createElement("p");
  bar.className = "signin-bar";
  bar.innerHTML = me.named
    ? `Signed in as <b>${esc(me.name)}</b>.`
    : `Signed in. <a href="account.html">Pick a display name</a> before you publish.`;
  const header = document.querySelector("header.site");
  if(header) header.insertAdjacentElement("afterend", bar);
  setTimeout(() => bar.remove(), 8000);
}

document.addEventListener("click", e => {
  const menu = document.getElementById("acctMenu");

  if(e.target.closest("#acctBtn")){
    if(menu) menu.hidden = !menu.hidden;
    return;
  }
  const act = e.target.closest("[data-acct]");
  if(!act){
    if(menu && !e.target.closest("#acctMenu")) menu.hidden = true;
    return;
  }
  if(act.dataset.acct === "in"){
    const name = prompt("Signed-in name (there is no real account system yet):", "Summoner");
    if(name === null) return;
    signIn(name);
  }
  if(act.dataset.acct === "rename"){
    const name = prompt("Change your display name:", (currentUser() || {}).name || "");
    if(name === null || !name.trim()) return;
    signIn(name);
  }
  if(act.dataset.acct === "out") signOut();
  paintAccount();
});

/* ------------------------------------------------------------
   Loading + failure states
   ------------------------------------------------------------ */
function showLoading(el, msg="Loading from Data Dragon…"){
  el.innerHTML = `<div class="state"><div class="skel" style="height:14px;width:180px;margin:0 auto 12px"></div>${esc(msg)}</div>`;
}
function showError(el, err){
  const offline = !navigator.onLine;
  el.innerHTML = `<div class="state">
    <h3>${offline ? "You appear to be offline" : "Couldn't reach Data Dragon"}</h3>
    <p style="max-width:56ch;margin:6px auto 0">
      ${offline
        ? "Champion, item and rune data is loaded live from Riot's CDN, so this page needs an internet connection."
        : `The request was blocked or failed. If you opened this file directly from your computer, some browsers
           refuse the request for security reasons. Serving the folder over a local address fixes it:`}
    </p>
    ${offline ? "" : `<p style="margin:10px 0 0"><code>python3 -m http.server 8000</code> &nbsp;then visit&nbsp;
      <code>http://localhost:8000</code></p>`}
    <p style="color:var(--muted-2);font-size:12px;margin-top:12px">${esc(err && err.message || err || "")}</p>
    <button class="btn" onclick="location.reload()">Try again</button>
  </div>`;
}

/* Run a page's loader with shared loading / error handling. */
async function boot(target, fn){
  const el = typeof target === "string" ? $(target) : target;
  showLoading(el);
  try{ await fn(el); }
  catch(err){ console.error(err); showError(el, err); }
}
