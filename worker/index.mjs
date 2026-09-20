/* ============================================================
   LINK PREVIEWS

   Every page on this site is drawn by JavaScript. That is fine for a
   browser and useless for a link unfurler: Discord, Slack, iMessage,
   Twitter and every search crawler that doesn't run scripts read the HTML
   as it arrives, and the HTML as it arrives says

       <title>Guide — S3 Builds</title>
       <meta property="og:description" content="A community build guide…">
       <meta property="og:image" content="https://s3builds.net/logo-512.png">

   for every guide on the site. So a guide posted in a Discord server — the
   way League guides actually travel — unfurls as an anonymous grey card
   with the site logo on it, no matter whose guide it is or who it's about.

   This worker runs in front of guide.html and champion.html, looks up what
   the page is actually about, and rewrites those tags before the response
   leaves Cloudflare. Nothing else on the site changes: the page still
   renders itself in the browser exactly as it did.

   ---------------------------------------------------------------- rules

   1. A preview is never worth a page. Every failure path here — the
      database is down, Community Dragon moved a file, the slug is
      nonsense, the whole thing is taking too long — ends the same way, by
      serving the unmodified page. There is no error this file can raise
      that a reader will ever see.

   2. It rewrites by string, not with HTMLRewriter. HTMLRewriter is the
      idiomatic tool and it streams, which is better. It is also only
      available inside the Workers runtime, and wrangler cannot be
      installed here — so choosing it would mean the transform that runs on
      every guide page was the one piece of this repo no test could touch.
      The input is a 50KB file in this same repo whose head this worker
      owns, so a targeted string rewrite is exact, and tools/worker-check.js
      runs the real function over the real file.

      The fragility that buys is that the rewrite depends on the shape of
      the markup. That is handled rather than hoped about: every rule below
      must match EXACTLY ONCE or the rewrite is abandoned and the page goes
      out untouched, and worker-check.js asserts the same thing against the
      files on disk, so editing a meta tag in guide.html breaks a test
      rather than quietly turning previews off.

   3. Titles, blurbs and author names are things strangers typed. They go
      into HTML attributes, so they go through esc() — see the note there.
   ============================================================ */

const SITE = "S3 Builds";

/* Community Dragon's mirror of the mode's own art, same root the site
   itself uses. See the CLASSIC block at the top of site.js. */
const CD = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";

/* Season 3 Data Dragon, consulted for one thing only — see champByParam. */
const DD_CHAMPS = "https://ddragon.leagueoflegends.com/cdn/3.13.24/data/en_US/champion.json";

/* The mode's champion ids are 60000 + the champion's numeric key. Verified
   against all 67 champions the mode and the 3.13.24 archive have in
   common: there is not one exception. */
const CHAMP_OFFSET = 60000;

/* A preview that takes longer than this isn't a preview, it's a slow page.
   Unfurlers give up somewhere around five seconds and readers notice much
   sooner than that. */
const BUDGET_MS = 1200;


/* ============================================================
   ROUTING
   ============================================================ */

/* Which page this is, if it is one we have anything to say about.
   `.html` is optional because this platform serves /guide for guide.html,
   so both spellings are real URLs that people really paste. */
export function previewRoute(url){
  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  const page = path.endsWith(".html") ? path.slice(0, -5) : path;

  /* The parameters keep their case — champion ids are CamelCase. */
  if(page === "/guide"){
    const slug = (url.searchParams.get("g") || "").trim();
    return slug ? {kind: "guide", slug} : null;
  }
  if(page === "/champion"){
    const id = (url.searchParams.get("c") || "").trim();
    return id ? {kind: "champion", id} : null;
  }
  return null;
}


/* ============================================================
   TEXT
   ============================================================ */

/* Everything below is written into a double-quoted HTML attribute, and
   almost all of it is text a stranger typed into the guide creator. A
   title of  ">  <script>…  would otherwise close the attribute, close the
   tag, and land a script in the head of the page — in the one part of the
   document guide-sanitise.js never sees, because the sanitiser guards
   guide BODIES and this is the <head>.
   & first, or it would double-escape the escapes. */
export function esc(s){
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Collapse whitespace and cut to a length that survives the card. Cut on a
   word if there is one nearby, so it doesn't end mid-syllable. */
export function clip(s, max){
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if(t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, "") + "…";
}

/* What the card says about a guide.

   og:title carries the guide's own title and nothing else — og:site_name
   already puts "S3 Builds" above it in every client, so repeating it there
   spends the widest line in the card on the same three words twice.
   <title> is the opposite case: it is the tab and the search result, it
   has no site name beside it, so it gets the suffix. That is also exactly
   what the page's own script sets once it runs, which keeps the tab from
   visibly changing under the reader a second after it opens. */
export function guideCard(row, splash, canonical){
  const champ = (row.champ || "").trim();
  const role  = (row.role  || "").trim();
  const who   = (row.author_name || "").trim();
  const title = (row.title || "").trim() || "Untitled guide";
  const blurb = (row.blurb || "").trim();

  /* "Ashe ADC guide by Rayne." — the line a reader most wants before
     deciding to click, and it exists for every guide. The blurb is the
     author's own pitch and goes after it when there is one. */
  const subject = [champ, role].filter(Boolean).join(" ");
  const lead = `${subject ? subject + " " : ""}guide${who ? " by " + who : ""}.`;
  const description = clip(blurb ? `${lead} ${blurb}` : lead, 280);

  return {
    documentTitle: `${title} — ${SITE}`,
    title: clip(title, 110),
    description,
    image: splash,
    type: "article",
    canonical
  };
}

/* And about a champion. `summary.description` is the champion's epithet —
   "The Frost Archer" — which is the second half of what the page's own
   script puts in the tab. */
export function championCard(summary, splash, canonical){
  const name = (summary.name || "").trim();
  const epithet = (summary.description || "").trim();
  return {
    documentTitle: `${name}${epithet ? ", " + epithet : ""} — ${SITE}`,
    title: `${name}${epithet ? ", " + epithet : ""}`,
    description: `${name}'s abilities, stats and community build guides for `
               + `League of Legends Classic.`,
    image: splash,
    type: "website",
    canonical
  };
}


/* ============================================================
   THE REWRITE
   ============================================================ */

const meta = (attr, name, content) =>
  `<meta ${attr}="${name}" content="${esc(content)}">`;

/* Each rule is [what to find, what to put there]. A rule whose pattern
   does not appear EXACTLY once in the document is a rule written against
   markup that no longer exists, and the honest response to that is to stop
   and serve the page as it is. */
function rules(card){
  const list = [
    [/<title>[\s\S]*?<\/title>/g,
     () => `<title>${esc(card.documentTitle)}</title>`],
    [/<meta name="description" content="[^"]*">/g,
     () => meta("name", "description", card.description)],
    [/<meta property="og:type" content="[^"]*">/g,
     () => meta("property", "og:type", card.type)],
    [/<meta property="og:title" content="[^"]*">/g,
     () => meta("property", "og:title", card.title)],
    [/<meta property="og:description" content="[^"]*">/g,
     () => meta("property", "og:description", card.description)],
    [/<meta name="twitter:card" content="[^"]*">/g,
     /* A 1215x717 splash in a 120px square is a thumbnail of a shoulder.
        The big card is the whole point of having the art. Without art
        there is nothing to make big, and the small card is correct. */
     () => meta("name", "twitter:card",
                card.image ? "summary_large_image" : "summary")]
  ];
  /* Only when there is something better than the logo to show. Leaving the
     existing tag alone is deliberate — a card with the site logo is a
     worse card, not a broken one. */
  if(card.image) list.push([/<meta property="og:image" content="[^"]*">/g,
     () => meta("property", "og:image", card.image)]);
  return list;
}

/* Returns the rewritten HTML, or null if the document is not the shape
   this was written against. Never throws. */
export function applyCard(html, card){
  if(typeof html !== "string" || !html || !card) return null;

  let out = html;
  for(const [find, make] of rules(card)){
    const hits = out.match(find);
    if(!hits || hits.length !== 1) return null;
    /* A function replacement, so a $& or $1 in a guide title is inserted
       literally instead of being read as a backreference. This is the
       second escaping trap in this file and it is invisible in testing
       unless somebody writes a title with a dollar sign in it. */
    out = out.replace(find, make);
  }

  /* Tags the pages don't carry at all, added rather than replaced. og:url
     and the canonical link both say "this address is the address of this
     page", which is what stops ?g=slug&utm_source=… being collected as a
     second copy of the same guide. */
  const head = out.indexOf("</head>");
  if(head < 0) return null;
  const extra = `${meta("property", "og:url", card.canonical)}\n`
              + `<link rel="canonical" href="${esc(card.canonical)}">\n`;
  return out.slice(0, head) + extra + out.slice(head);
}


/* ============================================================
   LOOKING THINGS UP
   ============================================================ */

/* The project and its publishable key, read out of the file the browser
   already gets. Keeping a second copy in wrangler.jsonc would work until
   the day they disagree, and the failure then is silent: previews quietly
   stop resolving while the site carries on. */
export function readConfig(js){
  const url = /SUPABASE_URL\s*=\s*"([^"]+)"/.exec(String(js || ""));
  const key = /SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/.exec(String(js || ""));
  return url && key ? {url: url[1].replace(/\/+$/, ""), key: key[1]} : null;
}

/* One guide. Hidden guides are absent rather than filtered here: the read
   policy on the table only sends a hidden row to its author or a
   moderator, and this request carries no session at all. So a guide a
   moderator has taken down stops unfurling the moment they hide it, which
   is the behaviour you would have to write by hand otherwise. */
async function fetchGuide(cfg, slug, signal){
  const q = `${cfg.url}/rest/v1/guides`
          + `?select=title,blurb,champ,role,author_name`
          + `&slug=eq.${encodeURIComponent(slug)}&limit=1`;
  const res = await fetch(q, {signal, headers: {
    apikey: cfg.key, authorization: `Bearer ${cfg.key}`, accept: "application/json"
  }});
  if(!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/* Community Dragon files are catalogues that change a few times a year and
   are read on every preview, so they are worth pinning at the edge. */
const cd = (path, signal) =>
  fetch(CD + path, {signal, cf: {cacheTtl: 3600, cacheEverything: true}});

async function roster(signal){
  const res = await cd("/v1/champion-summary.json", signal);
  if(!res.ok) return [];
  const all = await res.json();
  /* The file lists every champion the client knows; the mode's own are the
     ones aliased Jade_<Name>. */
  return (Array.isArray(all) ? all : []).filter(c => /^Jade_/i.test(c.alias || ""));
}

export function champByName(list, name){
  const want = String(name || "").trim().toLowerCase();
  if(!want) return null;
  return list.find(c => String(c.name || "").toLowerCase() === want) || null;
}

/* champion.html is addressed by Data Dragon's id — champion.html?c=Ashe —
   and the mode's catalogue is keyed by its own alias. Those agree for 66
   of the 67 champions, case aside.
   They disagree for Wukong, whose Data Dragon id is MonkeyKing, and there
   is no reason to believe he is the last one. So: try the cheap match
   first, and when it misses, spend one more request on the archive's own
   champion list and bridge on the numeric key, which is the thing both
   sides genuinely agree on. A future mismatch costs a request, not a
   broken preview. */
export function champByAlias(list, id){
  const want = String(id || "").trim().toLowerCase();
  if(!want) return null;
  return list.find(c => String(c.alias || "").replace(/^Jade_/i, "").toLowerCase() === want)
      || null;
}

async function champByParam(list, id, signal){
  const direct = champByAlias(list, id);
  if(direct) return direct;

  const res = await fetch(DD_CHAMPS, {signal, cf: {cacheTtl: 86400, cacheEverything: true}});
  if(!res.ok) return null;
  const doc = await res.json();
  const rec = Object.values((doc && doc.data) || {})
    .find(c => String(c.id).toLowerCase() === String(id).trim().toLowerCase());
  if(!rec) return null;
  const jadeId = CHAMP_OFFSET + Number(rec.key);
  return list.find(c => c.id === jadeId) || null;
}

/* Which skin's art to show. Lifted from champSpells() in site.js so the
   card and the page agree: the mode's own Classic skin where there is one
   — Lee Sin has "Classic Lee Sin" at id …301 — then the base skin. */
export function pickSkin(skins){
  const list = Array.isArray(skins) ? skins : [];
  return list.find(s => /classic/i.test(s.name || "") || String(s.id).endsWith("301"))
      || list.find(s => s.isBase)
      || list[0]
      || null;
}

/* Riot's paths are absolute into the game client's asset tree; Community
   Dragon serves the same tree, lowercased, under its own root. Same
   function as assetUrl() in site.js. */
export function assetUrl(path){
  return CD + String(path).replace(/^\/lol-game-data\/assets/i, "").toLowerCase();
}

/* The uncentered splash, which is the wide one — the right shape for a
   preview card, and the same art the guide page puts behind its title.
   The path is NOT derivable from the id: base skins are …_0.project_jade
   and the Classic ones …_301.project_jade, with the casing varying between
   them, so the champion's own file is the only honest source. */
async function splashFor(champ, signal){
  if(!champ) return null;
  const res = await cd(`/v1/champions/${champ.id}.json`, signal);
  if(!res.ok) return null;
  const doc = await res.json();
  const skin = pickSkin(doc && doc.skins);
  const path = skin && (skin.uncenteredSplashPath || skin.splashPath);
  return path ? assetUrl(path) : null;
}


/* ============================================================
   PUTTING IT TOGETHER
   ============================================================ */

function canonicalFor(url, route){
  const c = new URL(url.origin + url.pathname);
  if(route.kind === "guide") c.searchParams.set("g", route.slug);
  else c.searchParams.set("c", route.id);
  return c.toString();
}

async function buildCard(route, env, url, signal){
  const canonical = canonicalFor(url, route);

  if(route.kind === "champion"){
    const list = await roster(signal);
    const champ = await champByParam(list, route.id, signal);
    if(!champ) return null;
    return championCard(champ, await splashFor(champ, signal), canonical);
  }

  const cfgRes = await env.ASSETS.fetch(new URL("/config.js", url.origin).toString());
  const cfg = cfgRes.ok ? readConfig(await cfgRes.text()) : null;
  if(!cfg) return null;

  const row = await fetchGuide(cfg, route.slug, signal);
  if(!row) return null;

  /* The art is a bonus, not a requirement. A guide with no champion, or a
     champion whose file is missing, still gets its real title and blurb —
     so this leg is allowed to fail on its own. */
  let splash = null;
  try{
    const champ = champByName(await roster(signal), row.champ);
    splash = await splashFor(champ, signal);
  }catch(_){ splash = null; }

  return guideCard(row, splash, canonical);
}

/* Copying a response's headers verbatim onto a body you have decoded is a
   good way to serve a broken page: content-encoding still claims gzip and
   content-length still describes the compressed bytes, and the browser
   believes both. The runtime sets them again for the body it is actually
   sending. */
function reheader(res){
  const h = new Headers(res.headers);
  h.delete("content-encoding");
  h.delete("content-length");
  return h;
}

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);

    /* Everything that is not one of the two pages goes straight through.
       In practice wrangler.jsonc's run_worker_first means those requests
       never reach this line, but a worker that only behaves when its
       routing config is right is a worker with a trap in it. */
    const route = (request.method === "GET" || request.method === "HEAD")
      ? previewRoute(url) : null;

    const asset = env.ASSETS.fetch(request);
    if(!route) return asset;

    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), BUDGET_MS);
    const card = buildCard(route, env, url, stop.signal)
      .catch(err => { console.warn("preview:", err && err.message); return null; })
      .finally(() => clearTimeout(timer));

    const [res, cardData] = await Promise.all([asset, card]);

    /* Not a page, not ours, or nothing to say: serve exactly what the
       static site would have served. */
    if(!cardData || !res.ok) return res;
    if(!/^text\/html/i.test(res.headers.get("content-type") || "")) return res;

    const html = applyCard(await res.text(), cardData);
    if(html === null){
      /* The body has been read. Re-fetch rather than return a used one —
         this only happens if the page's head stopped matching, which is a
         bug to fix, not a reason to 500. */
      console.warn("preview: markup did not match, serving the page as is");
      return env.ASSETS.fetch(request);
    }
    return new Response(html, {status: res.status, headers: reheader(res)});
  }
};
