/* ============================================================
   Guide loading

   One job: hand back a guide object. Where it came from is this file's
   business and nobody else's — guide.html renders what it is given and
   never reads localStorage, never looks at the URL, never fetches.

   That separation is the whole point. Going live means writing one more
   source here (an HTTP call to wherever guides end up living) and adding
   a line to the switch. Nothing in the renderer changes.

       loadGuide()                     -> whatever the address asks for
       loadGuide({from:"draft"})       -> the creator's current draft
       loadGuide({from:"hash", data})  -> a shared link's payload
       loadGuide({from:"file", file})  -> an exported .json
       loadGuide({from:"url",  url})   -> a hosted guide

   Every one resolves to the same shape, described in normalise() below.
   ============================================================ */

const GUIDE_DRAFT_KEY = "riftvault.draft.v2";

/* Published guides, keyed by slug. This is a stand-in for the table a real
   backend will hold, and deliberately the same shape: publish writes a
   record, the reader fetches one by slug, and a list page reads the index.
   Swapping localStorage for a server means rewriting three functions here
   and nothing anywhere else. */
const GUIDE_STORE_KEY = "riftvault.published.v1";

/* ---------- the shape ----------
   Normalising here rather than in the renderer means a guide from a file
   written months ago, a link made by an older build, and today's draft all
   arrive identical. The renderer can then assume every field exists. */
function normaliseGuide(raw){
  const g = raw && typeof raw === "object" ? raw : {};
  /* Plain fields lose their angle brackets and rich fields go through the
     sanitiser. This is THE choke point: every source — draft, store, hash
     link, file, url, and whatever a backend hands back — funnels through
     normaliseGuide, so sanitising here covers all of them at once and
     cannot be forgotten at a call site. A guide that skipped this would be
     rendered into the page with innerHTML exactly as it arrived. */
  const str = v => sanitiseText(typeof v === "string" ? v : "");
  const rich = v => sanitiseRich(typeof v === "string" ? v : "");
  const arr = v => (Array.isArray(v) ? v : []);

  /* Runes are stored per slot; a page from an older build may be short or
     missing a slot entirely, and a socket count that doesn't match the slot
     would break the plate's layout. */
  const runePage = p => {
    const out = {};
    for(const s of (typeof RUNE_SLOTS !== "undefined" ? RUNE_SLOTS : [])){
      const have = arr(p && p[s.key]).slice(0, s.per);
      while(have.length < s.per) have.push(null);
      out[s.key] = have;
    }
    return out;
  };

  const setups = arr(g.setups).map((s, i) => ({
    id:    str(s.id) || `p${i}`,
    name:  str(s.name) || `Setup ${i + 1}`,
    mast:  (s.mast && typeof s.mast === "object") ? s.mast : {},
    runes: runePage(s.runes)
  }));

  const skillPages = arr(g.skillPages).map((p, i) => {
    const skills = arr(p.skills).slice(0, 18)
      .map(x => (["Q", "W", "E", "R"].includes(x) ? x : null));
    while(skills.length < 18) skills.push(null);
    return {id: str(p.id) || `s${i}`, name: str(p.name) || `Skill order ${i + 1}`, skills};
  });

  /* Drafts predating skill pages carry a flat `skills`. */
  if(!skillPages.length && arr(g.skills).length)
    skillPages.push({id: "s0", name: "Standard",
                     skills: arr(g.skills).slice(0, 18)});

  /* Same for summoner spells, which used to be one flat pair. */
  let spellSets = arr(g.spellSets).slice(0, 2)
    .map(set => arr(set).filter(x => typeof x === "string").slice(0, 2));
  if(!spellSets.length) spellSets = [arr(g.spells).filter(x => typeof x === "string").slice(0, 2)];

  return {
    title:  str(g.title),
    blurb:  str(g.blurb),
    champ:  g.champ == null ? null : str(g.champ),
    role:   str(g.role) || "Mid",
    tag:    str(g.tag),
    author: str(g.author),
    spellSets,
    items:  arr(g.items).map((r, i) => ({
              id: str(r.id) || `r${i}`,
              label: str(r.label) || "Build line",
              ordered: !!r.ordered,
              items: arr(r.items).map(String),
              note: rich(r.note)         /* the author's note on this line */
            })).filter(r => r.items.length),
    skillPages: skillPages.length ? skillPages
              : [{id: "s0", name: "Standard", skills: Array(18).fill(null)}],
    setups: setups.length ? setups
          : [{id: "p0", name: "Standard", mast: {}, runes: runePage(null)}],
    sections: arr(g.sections).map(s => ({h: str(s.h), b: rich(s.b)}))
                             .filter(s => s.h || s.b),
    /* The per-builder notes, keyed by section. Values are rich text and
       get the same treatment; unknown keys are dropped rather than carried
       through unread. */
    notes: Object.fromEntries(
             Object.entries((g.notes && typeof g.notes === "object") ? g.notes : {})
                   .filter(([k]) => /^[\w-]{1,32}$/.test(k))
                   .map(([k, v]) => [k, rich(typeof v === "string" ? v : "")]))
  };
}

/* ---------- sharing a guide in a link ----------
   deflate-raw then base64url. The browser does the compression, so there
   is no library to ship; a full guide — two setups, two skill orders, a
   complete rune page and a few hundred words — packs to roughly a
   thousand characters, which is inside the ~2000 that is safe in a URL
   anywhere. The payload rides in the fragment, so it is never sent to a
   server and never lands in anyone's access log.

   CompressionStream is missing on older Safari, so both directions fall
   back to plain base64 of the JSON. Longer, still correct, and marked so
   the decoder knows which it is reading. */
const B64URL = {
  to: bytes => btoa(String.fromCharCode(...bytes))
                 .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  from: text => {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - b64.length % 4) % 4);
    return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
  }
};

async function packGuide(guide){
  const json = JSON.stringify(guide);
  if(typeof CompressionStream === "undefined") return "0" + B64URL.to(new TextEncoder().encode(json));
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  return "1" + B64URL.to(packed);
}

/* A truncated or mangled link is the likely failure here — they get copied
   out of chat windows that wrap them — so every way this can go wrong ends
   in one sentence a reader can act on, rather than atob's empty throw. */
async function unpackGuide(text){
  const damaged = new Error("That link looks damaged — it may have been cut short when it was copied.");
  const flag = text[0];
  if(flag !== "0" && flag !== "1") throw damaged;

  let body;
  try{ body = B64URL.from(text.slice(1)); }
  catch(_){ throw damaged; }

  try{
    if(flag === "0") return JSON.parse(new TextDecoder().decode(body));
    if(typeof DecompressionStream === "undefined")
      throw new Error("This browser is too old to open compressed guide links.");
    const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return JSON.parse(await new Response(stream).text());
  }catch(err){
    if(/too old/.test(err.message)) throw err;
    throw damaged;
  }
}

/* ---------- the published store ---------- */

/* One question decides where a guide lives: is the backend up? When it is,
   reads come from the cache guide-store.js filled at boot; when it isn't —
   no key, no network, or a node harness — this browser is the store, and
   every function below works exactly as it did before. */
const backendLive = () => typeof STORE !== "undefined" && STORE.live();

function readStore(){
  if(backendLive()) return STORE.read();
  try{ return JSON.parse(localStorage.getItem(GUIDE_STORE_KEY) || "{}"); }
  catch(_){ return {}; }
}
/* Only the local store is written this way. With the backend live, writes
   go through STORE's own methods so a failure is caught and reported —
   silently writing to a cache the server rejected is the one outcome worth
   designing against. */
function writeStore(all){
  if(backendLive()) return true;
  try{ localStorage.setItem(GUIDE_STORE_KEY, JSON.stringify(all)); return true; }
  catch(_){ return false; }          /* quota, or storage disabled */
}

/* Newest first, with just enough to render a list. `mine` filters to the
   signed-in author, which is what "My guides" wants; without it this is
   every guide in the store, which is what a site-wide index would want. */
function listPublished({mine = false} = {}){
  const me = typeof currentUser === "function" ? currentUser() : null;
  return Object.entries(readStore())
    /* A guide published before accounts existed has no authorId. Treating
       that as "not yours" would hide it from My guides with no way to get
       it back, so an unowned guide belongs to whoever is signed in. */
    .filter(([, g]) => !mine || !me || !g.authorId || g.authorId === me.id)
    .map(([slug, g]) => ({slug, title: g.title || "Untitled guide",
                          blurb: g.blurb || "",     /* the card's one line */
                          champ: g.champ,
                          role: g.role, tag: g.tag, at: g.at || 0, updated: g.updated || 0,
                          votes: g.votes || 0,
                          author: g.author || "", authorId: g.authorId || ""}))
    .sort((a, b) => b.at - a.at);
}

/* ---------- upvotes ----------
   Two halves, because a real backend has two: the tally, which belongs to
   the guide and everyone reads, and who voted, which belongs to the reader.
   Keeping them apart is what lets the button know it is already lit without
   the guide record having to carry a list of voters around.

   Here both live in this browser, so the tally is only ever this browser's
   votes — the same stand-in the published store already is. When there is a
   server, `votes` comes off the record it sends and this key becomes a row
   in a votes table keyed by user and guide. Nothing else has to change. */
const GUIDE_VOTE_KEY = "riftvault.votes.v1";

function readMyVotes(){
  try{ const v = JSON.parse(localStorage.getItem(GUIDE_VOTE_KEY) || "[]");
       return Array.isArray(v) ? v : []; }
  catch(_){ return []; }
}
function writeMyVotes(list){
  try{ localStorage.setItem(GUIDE_VOTE_KEY, JSON.stringify(list)); return true; }
  catch(_){ return false; }
}

const hasVoted = slug => backendLive() ? STORE.votedOn(slug) : readMyVotes().includes(slug);
const voteCount = slug => (readStore()[slug] || {}).votes || 0;

/* Click once to upvote, again to take it back. Returns the state the button
   should now show, so a caller repaints from the answer rather than
   re-reading storage and hoping the two agree.

   The tally is recomputed from the vote rather than incremented blindly: a
   double click, or two tabs open on the same guide, must not be able to add
   two votes for one reader. */
async function toggleVote(slug){
  if(backendLive()) return STORE.toggleVote(slug);
  const all = readStore();
  const rec = all[slug];
  if(!rec) throw new Error("That guide is no longer published.");

  const mine = readMyVotes();
  const at = mine.indexOf(slug);
  const voting = at < 0;

  if(voting) mine.push(slug); else mine.splice(at, 1);
  rec.votes = Math.max(0, (rec.votes || 0) + (voting ? 1 : -1));

  if(!writeStore(all) || !writeMyVotes(mine))
    throw new Error("Couldn't record that vote — this browser's storage is full or blocked.");
  return {voted: voting, votes: rec.votes};
}

/* Guides for one champion, newest first. Matched on the stored name — the
   champion page knows its own name, and a name is what a guide records. */
function guidesFor(champ){
  const want = String(champ || "").toLowerCase();
  if(!want) return [];
  return listPublished().filter(g => String(g.champ || "").toLowerCase() === want);
}

/* How many guides each champion has, for badges and for sorting a roster
   by "has something to read". One pass rather than one query per champion. */
function guideCountsByChampion(){
  const out = Object.create(null);
  for(const g of listPublished()){
    const name = g.champ;
    if(name) out[name] = (out[name] || 0) + 1;
  }
  return out;
}

/* The slug is the title, and a short random tail so two guides with the
   same title don't overwrite each other. */
function guideSlug(title){
  const base = String(title || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44) || "guide";
  return base + "-" + Math.random().toString(36).slice(2, 8);
}

async function publishGuide(guide){
  const slug = guideSlug(guide.title);
  if(backendLive()) return STORE.publish(guide, slug);
  const all = readStore();
  /* Stamped with the id, not the name: renaming yourself later must not
     orphan everything you have already published. */
  const me = typeof currentUser === "function" ? currentUser() : null;
  /* Stored as a plain snapshot: the accessors on the live draft are
     non-enumerable, so JSON keeps the page lists and not a stale copy of
     whichever page happened to be active. */
  all[slug] = {...JSON.parse(JSON.stringify(guide)), slug, at: Date.now(),
               votes: 0,
               author: me ? me.name : "", authorId: me ? me.id : ""};
  if(!writeStore(all)) throw new Error("Couldn't save the guide — this browser's storage is full or blocked.");
  return slug;
}

/* One published record, as stored. Used by the editor to load a guide for
   editing — normaliseGuide() is for the reader and drops anything the
   renderer doesn't need, which is exactly what an editor must not do. */
function readPublished(slug){
  return readStore()[slug] || null;
}

/* Write over an existing guide, keeping everything that identifies it. The
   slug is the address people have already shared, the author is who wrote
   it, and `at` is when it first went up — an edit changes none of those.
   Nor do the votes: an edit is the author's doing, and clearing what
   readers gave the guide would punish anyone who fixes a typo. */
async function updateGuide(slug, guide){
  if(backendLive()) return STORE.update(slug, guide);
  const all = readStore();
  const old = all[slug];
  if(!old) throw new Error("That guide is no longer published.");
  all[slug] = {...JSON.parse(JSON.stringify(guide)),
               slug,
               at: old.at,
               votes: old.votes || 0,
               author: old.author, authorId: old.authorId,
               updated: Date.now()};
  if(!writeStore(all)) throw new Error("Couldn't save the guide — this browser's storage is full or blocked.");
  return slug;
}

async function unpublishGuide(slug){
  if(backendLive()) return STORE.unpublish(slug);
  const all = readStore();
  delete all[slug];
  writeStore(all);
  /* The vote goes with the guide. Left behind, it would relight the button
     for a slug that no longer exists, and — since slugs carry a random tail
     — could only ever be cleared by hand. */
  const mine = readMyVotes();
  const at = mine.indexOf(slug);
  if(at >= 0){ mine.splice(at, 1); writeMyVotes(mine); }
}

/* ---------- the sources ---------- */

async function fromDraft(){
  let raw = null;
  try{ raw = localStorage.getItem(GUIDE_DRAFT_KEY); }catch(_){}
  if(!raw) throw new Error("No draft saved in this browser yet.");
  return JSON.parse(raw);
}

async function fromHash(data){
  if(!data) throw new Error("That link has no guide in it.");
  return unpackGuide(data);
}

async function fromStore(slug){
  const g = readStore()[slug];
  if(!g) throw new Error("No published guide with that address.");
  return g;
}

async function fromFile(file){
  if(!file) throw new Error("No file chosen.");
  return JSON.parse(await file.text());
}

/* A guide hosted alongside the site. Same-origin only, and deliberately so:
   this reads ?url= straight out of the address bar, so without the check
   anyone could hand out a link that renders THEIR json inside a page
   wearing this site's name, chrome and domain. The sanitiser stops it
   executing, but "the site showed me this" is a claim about trust, not just
   about script, and a phishing page made of real chrome and a stranger's
   words is a bad thing to be able to construct for free.

   Relative paths only. No scheme, no host, no protocol-relative "//host"
   — which is the one that reads as a path at a glance and isn't. If a
   cross-origin source is ever wanted, it belongs behind an explicit
   allowlist here rather than as the default. */
function sameOriginPath(url){
  const raw = String(url || "");
  if(!raw || raw.length > 300) return null;
  /* The origin comparison below is what actually decides this — resolving
     against location.href and checking the result catches every one of
     these on its own, including the protocol-relative case. They are kept
     because they say what the rule is at a glance, and because rejecting
     early means a malformed input never reaches URL() at all. Removing any
     of them does not open a hole; a mutation test confirmed that. */
  if(/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;    /* any scheme */
  if(raw.startsWith("//")) return null;                /* protocol-relative */
  if(raw.includes("\\")) return null;                  /* backslash tricks */
  try{
    const u = new URL(raw, location.href);
    return u.origin === location.origin ? u.href : null;
  }catch(_){ return null; }
}

async function fromUrl(url){
  const safe = sameOriginPath(url);
  if(!safe) throw new Error("Guides can only be loaded from this site.");
  const res = await fetch(safe);
  if(!res.ok) throw new Error(`Couldn't fetch that guide (${res.status}).`);
  return res.json();
}

/* What the address bar is asking for, so the page itself doesn't have to
   parse it: #g=<packed> is a shared guide, ?draft=1 is your own draft. */
function guideSourceFromLocation(){
  const hash = location.hash.replace(/^#/, "");
  const inHash = new URLSearchParams(hash).get("g");
  if(inHash) return {from: "hash", data: inHash};
  const q = new URLSearchParams(location.search);
  if(q.get("g"))    return {from: "store", slug: q.get("g")};
  if(q.get("url"))  return {from: "url", url: q.get("url")};
  return {from: "draft"};
}

async function loadGuide(source){
  const src = source || guideSourceFromLocation();
  let raw;
  switch(src.from){
    case "draft": raw = await fromDraft();          break;
    case "store": raw = await fromStore(src.slug);  break;
    case "hash":  raw = await fromHash(src.data);   break;
    case "file":  raw = await fromFile(src.file);   break;
    case "url":   raw = await fromUrl(src.url);     break;
    default: throw new Error(`Unknown guide source: ${src.from}`);
  }
  const guide = normaliseGuide(raw);
  guide.source = src.from;          /* for the page's own chrome, not the render */
  /* Identity travels with the guide rather than being looked up by the
     page: the renderer stays ignorant of accounts and storage, and a
     hosted guide will answer the same question the same way. */
  guide.slug = typeof raw.slug === "string" ? raw.slug : "";
  const me = typeof currentUser === "function" ? currentUser() : null;
  guide.mine = !!(me && guide.slug && (!raw.authorId || raw.authorId === me.id));
  return guide;
}
