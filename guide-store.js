/* ============================================================
   THE STORE

   Guides and accounts, backed by Supabase when config.js has a key and by
   localStorage when it doesn't. Loaded before guide-load.js, which calls
   through the primitives at the bottom of this file.

   ---- why there is no Supabase SDK here ----

   The official client would be a 60KB script from a CDN, and the CSP in
   _headers says script-src 'self'. Adding a CDN to that list weakens the
   policy for every page, permanently, to save writing about eighty lines.
   Supabase's API is PostgREST and GoTrue over plain HTTP; fetch is enough.
   The site has no build step and no dependencies, and this keeps it that
   way.

   ---- why the reads are cached ----

   listPublished, guidesFor, voteCount and the rest are synchronous and are
   called from inside render functions that build HTML strings. A string
   builder cannot await. So the network happens once, at boot, and fills a
   cache the synchronous accessors read from. Writes are async — they are
   all in click handlers, which can await — and they update the cache when
   the server confirms, never before.
   ============================================================ */

const SB = {
  url: typeof SUPABASE_URL === "string" ? SUPABASE_URL : "",
  key: typeof SUPABASE_ANON_KEY === "string" ? SUPABASE_ANON_KEY : "",
  /* Whether to use the network at all. False in the node harnesses, false
     with no key, and false from file:// where there is no origin to come
     back to after a magic link. */
  get on(){ return !!(this.url && this.key); }
};

/* The session, kept where a page reload can find it again. Supabase's own
   client uses localStorage for this too; a token in localStorage is
   readable by any script on the origin, which is a reason to care about
   the sanitiser rather than a reason to pick a different store. */
const SESSION_KEY = "riftvault.session.v1";

function session(){
  try{
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if(!s || !s.access_token) return null;
    /* A minute of slack, so a token that expires mid-request is treated as
       expired before it is used rather than after it fails. */
    if(s.expires_at && s.expires_at * 1000 < Date.now() + 60000) return null;
    return s;
  }catch(_){ return null; }
}
function setSession(s){
  try{
    if(s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else  localStorage.removeItem(SESSION_KEY);
  }catch(_){}
}

/* ---------- talking to the API ---------- */

async function sbFetch(path, {method = "GET", body, auth = true, headers = {}} = {}){
  const s = auth ? session() : null;
  const res = await fetch(SB.url + path, {
    method,
    headers: {
      apikey: SB.key,
      Authorization: `Bearer ${s ? s.access_token : SB.key}`,
      "Content-Type": "application/json",
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if(!res.ok) throw new Error(friendlyError(data, res.status));
  return data;
}

/* Postgres speaks in constraint names. A reader should not have to. */
function friendlyError(data, status){
  const msg = String((data && (data.message || data.error_description || data.error)) || "");
  if(/duplicate key/i.test(msg) && /guide_votes/i.test(msg))
    return "You've already voted on this guide.";
  if(/duplicate key/i.test(msg))       return "A guide with that address already exists.";
  if(/row-level security/i.test(msg))  return "That isn't yours to change.";
  if(/100 guides/i.test(msg))          return "You've reached the limit of 100 guides.";
  if(/violates check constraint/i.test(msg)) return "Something in that guide is too long.";
  if(status === 401 || status === 403) return "You need to be signed in to do that.";
  if(status === 429) return "Too many requests just now — wait a moment and try again.";
  return msg || `Something went wrong (${status}).`;
}

/* ---------- accounts ---------- */

/* Email, no password: Supabase mails a link, the link comes back to the
   site with tokens in the fragment, and captureSession() picks them up.
   A password is one more thing to forget for a site whose whole job is
   letting someone post a build. */
async function sendMagicLink(email){
  if(!SB.on) throw new Error("Accounts aren't switched on yet.");
  await sbFetch("/auth/v1/otp", {
    method: "POST", auth: false,
    body: {email: String(email || "").trim(),
           options: {email_redirect_to: location.origin + location.pathname}}
  });
}

/* Tokens arrive in the fragment, which never reaches a server or a log.
   They are lifted out and the fragment is wiped from the address bar, so a
   copied URL cannot hand someone else a session. */
function captureSession(){
  if(!location.hash.includes("access_token")) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const token = p.get("access_token");
  if(!token) return false;
  setSession({
    access_token: token,
    refresh_token: p.get("refresh_token") || "",
    expires_at: Number(p.get("expires_at")) || 0
  });
  history.replaceState(null, "", location.pathname + location.search);
  return true;
}

let ME = null;
async function loadMe(){
  if(!SB.on || !session()){ ME = null; return null; }
  try{
    const u = await sbFetch("/auth/v1/user");
    ME = u && u.id
      ? {id: u.id, email: u.email || "",
         name: (u.user_metadata && u.user_metadata.name) || (u.email || "").split("@")[0]}
      : null;
  }catch(_){
    /* An expired or rejected token is not an error to shout about — it is
       just being signed out. */
    setSession(null); ME = null;
  }
  return ME;
}

async function setDisplayName(name){
  const clean = String(name || "").trim().slice(0, 24);
  if(!clean) return ME;
  await sbFetch("/auth/v1/user", {method: "PUT", body: {data: {name: clean}}});
  if(ME) ME.name = clean;
  return ME;
}

async function signOutRemote(){
  if(SB.on && session()){
    try{ await sbFetch("/auth/v1/logout", {method: "POST"}); }catch(_){}
  }
  setSession(null); ME = null;
}

/* ---------- the cache the sync accessors read ---------- */

let CACHE = {};          /* slug -> record, in guide-load.js's own shape */
let MY_VOTES = new Set();
let LOADED = false;

/* The table stores listing fields as columns and the guide itself as one
   jsonb document. These two put the record together and take it apart. */
function fromRow(r){
  return {
    ...(r.body || {}),
    slug: r.slug, title: r.title, blurb: r.blurb || "",
    champ: r.champ, role: r.role, tag: r.tag || "",
    author: r.author_name || "", authorId: r.author_id,
    votes: r.votes || 0,
    at: Date.parse(r.created_at) || 0,
    updated: r.updated_at ? Date.parse(r.updated_at) : 0
  };
}
function toRow(guide, slug, authorId, authorName){
  /* Sanitised on the way IN as well as out. normaliseGuide covers every
     guide the site renders, but not a row written straight to the API by
     someone bypassing the site — and that row is then served to everyone. */
  const clean = typeof normaliseGuide === "function" ? normaliseGuide(guide) : guide;
  const {title, blurb, champ, role, tag, ...body} = clean;
  delete body.author; delete body.authorId; delete body.votes;
  delete body.slug;   delete body.at;       delete body.updated;
  return {slug, title: title || "Untitled guide", blurb: blurb || "",
          champ: champ || null, role: role || "Mid", tag: tag || "",
          body, author_id: authorId, author_name: authorName || ""};
}

/* Called once per page before first paint. Everything downstream of this
   is synchronous. A failure here is not fatal: the site falls back to what
   is in this browser and says so, rather than showing a blank page. */
async function loadStore(){
  if(!SB.on){ LOADED = true; return false; }
  captureSession();
  await loadMe();
  try{
    const rows = await sbFetch("/rest/v1/guides?select=*", {auth: false});
    CACHE = Object.fromEntries((rows || []).map(r => [r.slug, fromRow(r)]));
    if(ME){
      const mine = await sbFetch(
        `/rest/v1/guide_votes?select=guide_slug&user_id=eq.${encodeURIComponent(ME.id)}`);
      MY_VOTES = new Set((mine || []).map(r => r.guide_slug));
    }
    LOADED = true;
    return true;
  }catch(err){
    console.warn("Guides unavailable, using this browser only:", err.message);
    LOADED = false;
    return false;
  }
}

/* ---------- what guide-load.js calls ----------
   Each of these has the same signature it had against localStorage. The
   writes gained an `await`, which is why their call sites are in click
   handlers and not in render functions. */

const STORE = {
  live: () => SB.on && LOADED,

  read(){ return CACHE; },

  me(){ return ME; },

  votedOn(slug){ return MY_VOTES.has(slug); },

  async publish(guide, slug){
    if(!ME) throw new Error("Sign in to publish a guide.");
    const row = toRow(guide, slug, ME.id, ME.name);
    await sbFetch("/rest/v1/guides", {method: "POST", body: row,
                                      headers: {Prefer: "return=minimal"}});
    CACHE[slug] = fromRow({...row, votes: 0, created_at: new Date().toISOString()});
    return slug;
  },

  async update(slug, guide){
    if(!ME) throw new Error("Sign in to edit a guide.");
    const row = toRow(guide, slug, ME.id, ME.name);
    /* author_id is not sent: it is not in the column grant, and an update
       that tried to change it would be refused anyway. */
    delete row.author_id; delete row.slug;
    row.updated_at = new Date().toISOString();
    await sbFetch(`/rest/v1/guides?slug=eq.${encodeURIComponent(slug)}`,
                  {method: "PATCH", body: row, headers: {Prefer: "return=minimal"}});
    CACHE[slug] = {...CACHE[slug], ...fromRow({...row, slug,
      author_id: ME.id, votes: (CACHE[slug] || {}).votes || 0,
      created_at: new Date((CACHE[slug] || {}).at || Date.now()).toISOString()})};
    return slug;
  },

  async unpublish(slug){
    await sbFetch(`/rest/v1/guides?slug=eq.${encodeURIComponent(slug)}`,
                  {method: "DELETE", headers: {Prefer: "return=minimal"}});
    delete CACHE[slug];
    MY_VOTES.delete(slug);
  },

  /* The tally is maintained by a database trigger, so this reads it back
     rather than guessing. Guessing is how a count drifts from the rows it
     is meant to be counting. */
  async toggleVote(slug){
    if(!ME) throw new Error("Sign in to upvote a guide.");
    const on = !MY_VOTES.has(slug);
    if(on) await sbFetch("/rest/v1/guide_votes",
                         {method: "POST", body: {guide_slug: slug, user_id: ME.id},
                          headers: {Prefer: "return=minimal"}});
    else   await sbFetch(`/rest/v1/guide_votes?guide_slug=eq.${encodeURIComponent(slug)}` +
                         `&user_id=eq.${encodeURIComponent(ME.id)}`,
                         {method: "DELETE", headers: {Prefer: "return=minimal"}});
    on ? MY_VOTES.add(slug) : MY_VOTES.delete(slug);
    const [row] = await sbFetch(
      `/rest/v1/guides?select=votes&slug=eq.${encodeURIComponent(slug)}`, {auth: false});
    const votes = (row && row.votes) || 0;
    if(CACHE[slug]) CACHE[slug].votes = votes;
    return {voted: on, votes};
  }
};

if(typeof module !== "undefined" && module.exports)
  module.exports = {STORE, fromRow, toRow, friendlyError};
