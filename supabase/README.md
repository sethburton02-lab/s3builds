# Supabase

## Order of work

1. **Create the project.** supabase.com → new project. Note the project URL
   and the *anon* key. The anon key is meant to be public — it ships in the
   page, and the row-level policies in `schema.sql` are what protect the
   data. The `service_role` key is not; it bypasses every policy and must
   never appear in this repo.

2. **Run `schema.sql`.** SQL editor → paste → run. Re-running is safe.

3. **Turn on an auth provider.** Discord is the obvious fit — this is a
   League audience and nobody wants another password. Auth → Providers →
   Discord, then create an app at discord.com/developers and paste the
   client id and secret. Add
   `https://<project>.supabase.co/auth/v1/callback` as the redirect.
   Magic-link email works too and needs no third party, but "check your
   inbox" loses people who were one click from writing a guide.

4. **Add the config.** A small `config.js` with the project URL and anon
   key, loaded before `guide-load.js`.

5. **Write the adapter.** Below.

6. **Update the CSP.** `_headers` currently lists only Riot's CDNs in
   `connect-src`. Add `https://<project>.supabase.co` or every API call is
   blocked — and the failure looks like the site quietly having no guides,
   which is a confusing hour if you have forgotten this step.

## The adapter

The thing to understand before writing it: **the store API is synchronous
and has to stay that way.** `listPublished`, `guidesFor`,
`guideCountsByChampion`, `voteCount`, `hasVoted` and `readPublished` are
called seventeen times from inside render functions, and a function that
builds an HTML string cannot await. Making them async means rewriting all
seventeen call sites and every function that contains them.

So the network goes at the boot boundary, not in the accessors:

```js
let CACHE = {};                     // slug -> record, same shape as today
let MY_VOTES = new Set();

/* Called once per page, before first paint. Everything below stays sync. */
async function loadStore(){
  const {data} = await sb.from("guides").select("*");
  CACHE = Object.fromEntries((data || []).map(r => [r.slug, fromRow(r)]));
  const me = (await sb.auth.getUser()).data.user;
  if(me){
    const {data: v} = await sb.from("guide_votes")
      .select("guide_slug").eq("user_id", me.id);
    MY_VOTES = new Set((v || []).map(r => r.guide_slug));
  }
}

function readStore(){ return CACHE; }          // unchanged signature
const hasVoted  = slug => MY_VOTES.has(slug);
const voteCount = slug => (CACHE[slug] || {}).votes || 0;
```

Writes become async and update the cache on success, which is the one place
call sites change — `publishGuide`, `updateGuide`, `unpublishGuide` and
`toggleVote` are already called from click handlers, which *can* await:

```js
async function publishGuide(guide){
  const row = toRow(guide, slug);
  const {error} = await sb.from("guides").insert(row);
  if(error) throw new Error(friendly(error));
  CACHE[slug] = fromRow(row);                  // so the next paint sees it
  return slug;
}
```

`toRow` / `fromRow` are the only new concepts: the table stores the guide
body as one `jsonb` column and the listing fields as real columns, so they
split and rejoin the record. Everything else in `guide-load.js` — the slug,
the normaliser, the sanitiser, the pack/unpack for share links — is
unchanged and still runs.

## Do not skip

**Sanitise on the way in as well as out.** `normaliseGuide` runs in the
reader, which covers every guide the site renders. It does *not* cover a
row written directly to the API by someone bypassing the site, and that row
is then served to everyone. Sanitise in `toRow` too, so what lands in the
table is already clean.

**The anon key is not a secret, but the `service_role` key is.** If one ends
up in the repo, rotate it in the dashboard — deleting the commit is not
enough, it is in the history and in anyone's clone.

**Test with two accounts.** Every RLS policy looks correct when you are the
only user. Sign in as someone else and try to edit your own guide from their
session; the policy should refuse it. That five-minute check is what tells
you the policies are real.

## What this does not solve

Moderation. The moment strangers can publish, someone will publish something
you do not want on the site, and there is currently no way to remove it
except opening the SQL editor. A `hidden boolean` on `guides` and a filter in
`listPublished` is an afternoon and worth doing before you tell anyone the
site exists.
