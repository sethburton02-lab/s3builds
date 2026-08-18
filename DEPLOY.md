# Deploying S3 Builds

There is no build step. The site is plain HTML, CSS and JavaScript, and the
directory you have is the directory that gets served. That is deliberate:
nothing between the files and the browser means nothing to go wrong on
someone else's machine, and the whole thing can be opened from `file://`
for a quick look.

## Cloudflare Pages

1. Push this folder to a Git repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
4. Deploy. `_headers` and `_redirects` are picked up automatically.
5. Custom domain → add `s3builds.net`, follow the DNS steps.

The domain is baked into `robots.txt`, `sitemap.xml` and the `og:image` on
every page — eleven places, which is exactly the number you update ten of.
One command moves them all:

```
python3 tools/set-domain.py s3builds.net
```

It leaves Riot's CDN URLs, the Supabase project and the fan-policy link
alone, and prints what it touched.

## Pointing the domain at Cloudflare

The registrar has to hand DNS over. Two ways:

**Nameservers (simplest).** Cloudflare dashboard → Add a site → `s3builds.net`
→ Free plan. Cloudflare gives you two nameservers; set those at your
registrar, replacing whatever is there. Propagation is usually minutes,
occasionally a few hours. Then Pages → your project → Custom domains → add
`s3builds.net` and `www.s3builds.net`; the records are created for you.

**CNAME only.** If you'd rather leave DNS where it is, point a CNAME at
`<project>.pages.dev`. Works, but you lose Cloudflare's caching and the apex
`s3builds.net` may not be supported by your registrar — many won't CNAME an
apex.

Either way HTTPS is automatic and takes a few minutes after the domain
verifies. Until the certificate is issued you may see a warning; that is
expected, not a misconfiguration.

**Then redirect one to the other.** Pick `s3builds.net` as canonical and
send `www` to it (Pages → Redirects, or a bulk redirect rule). Serving both
means search engines index the site twice and each copy competes with the
other.

## What's in the deploy files

**`_headers`** — security headers and cache policy. The Content-Security-Policy
there is defence in depth, not the defence; `guide-sanitise.js` is what
actually stops a hostile guide. See the note at the top of `_headers` for the
one real weakness (`'unsafe-inline'` on `script-src`) and what removing it
would take.

**`_redirects`** — deliberately empty, and the file explains why at length.
Every rule ever put in it was either useless or actively broke the site:
extensionless-URL rewrites caused an infinite redirect (Cloudflare already
does that itself), and a `/masteries` rule matched as a *prefix* and
swallowed every image under `art/masteries/`. Cloudflare's defaults are
correct on their own. Add nothing here without testing it.

## Why the art folder is called `art` and not `assets`

It was `assets`, which is the obvious name, and it cost an afternoon.

This project deploys as a **Cloudflare Worker with static assets**, not
Cloudflare Pages — the deployment URL ends `.workers.dev`. On that
platform, `/assets/*` is claimed by the runtime's own asset routing, so
every file under a folder with that name returns 404 while sibling folders
serve normally.

It is a miserable failure to diagnose because nothing errors: the files are
in the repo, in the commit, on the remote, with the right names and the
right case, and the deployment reports success. The only symptom is a page
with no pictures.

How it was actually pinned down, in case something similar happens again:
put a plain **text** file in the suspect folder and fetch it directly. A
missing PNG tells you nothing — could be the image, the path, the cache,
the CSP. A text file that 404s while `/data/something.json` and
`/tools/something.py` both return their contents tells you the folder is
the variable, and nothing else is.

Don't rename it back.

## Running the checks

Nothing here needs installing.

```
node tools/xss-check.js .        # the sanitiser, 53 payloads
node tools/stub-check.js .       # every page boots
node tools/items-check.js .      # shop grid, recipes, filters
node tools/item-check.js .       # detail page, recipe tree
node tools/guide-render.js .     # the guide view end to end
node tools/home-check.js .       # filters, sort, empty states
python3 tools/contrast-check.py .          # WCAG AA on both surfaces
python3 tools/check-data.py <lol-game-data> # data vs. the client's own files
python3 tools/bump-version.py --check      # every asset URL carries ?v=
```

`check-data.py` needs a path to an extracted `rcp-be-lol-game-data` plugin
from the live client. The rest are self-contained.

## Before this takes guides from strangers

Everything below is unfinished, in the order I'd do it.

1. **A backend.** Guides currently live in `localStorage`, which means the
   home page is empty for every new visitor and nobody can read anyone
   else's work. The seam is already cut for this: `guide-load.js` has one
   `loadGuide(source)` and the renderer never learns where a guide came
   from. Going live is `fromUrl()` plus rewriting `readStore`, `writeStore`,
   `publishGuide`, `updateGuide` and `unpublishGuide` to hit a database.
   The record shape those five functions read and write is already the table
   shape — `slug`, `at`, `updated`, `votes`, `author`, `authorId`, plus the
   guide body.

   **It is not quite mechanical, and an earlier draft of this file said it
   was.** `listPublished`, `guidesFor`, `guideCountsByChampion`, `voteCount`,
   `hasVoted` and `readPublished` are all synchronous, and they are called
   seventeen times from inside render functions — `guideCardHtml` builds a
   string, it cannot await anything. Making the store async would mean
   rewriting every one of those call sites.

   The way through is to keep them synchronous and put the network at the
   boot boundary instead: one `await loadStore()` before first paint fills
   an in-memory cache, `readStore()` returns the cache, and writes go async
   and update it on success. Every render function is then untouched. See
   `supabase/schema.sql` for the tables and `supabase/README.md` for the
   shape of the adapter.

2. **Move inline scripts out of the HTML.** This is what lets the CSP drop
   `'unsafe-inline'`, and it's the difference between a policy that reads
   well and one that stops an injected script.

3. **Rate limiting and moderation.** Anyone who can publish can publish a
   thousand times. Not a code problem yet; it becomes one on day one of a
   backend.

## Two things that are not code problems

**The fonts.** `site.css` serves *Friz Quadrata Pro* and *Gill Sans MT
Pro* from `art/fonts/` via `@font-face`. These are commercial typefaces
from ITC and Monotype. Riot's fan-content policy covers *Riot's* assets and
says nothing about third-party ones, so it does not cover these — every
visitor downloads two font files nobody here has a webfont licence for.

An earlier version of this file said no font files were served and that the
arrangement was low-risk. **That was wrong**, and it was wrong in the
direction that matters: it described the safe setup while the unsafe one
was already in place. Seth has read the corrected version and chosen to
publish them anyway, which is his call to make — but it is a real exposure,
not a theoretical one, and it is the first thing to change if a foundry
ever gets in touch.

Backing it out is three lines: delete the `@font-face` blocks at the top of
`site.css` and the `art/fonts/` folder. The stacks fall through to
Georgia and Optima, which are close in weight and shape.

**Riot's assets.** Champion, item and rune art is loaded from Riot's own
CDNs under the Legal Jibber Jabber fan content policy. The footer disclaimer
on every page is part of holding up that end. Don't remove it, and don't
mirror the art onto this domain — hotlinking their CDN is the arrangement
the policy anticipates.
