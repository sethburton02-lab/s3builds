/* ============================================================
   Link preview worker check

       node tools/worker-check.js <site-dir>

   worker/index.mjs runs in front of every guide and champion page on the
   live site, so the bar for it is not "the preview is nice" but "a reader
   never notices it exists". Most of what is checked here is therefore the
   failure behaviour: a database that says no, a champion that isn't in the
   mode, a lookup that hangs, markup that has moved. Every one of those has
   to end with the ordinary page going out unmodified.

   Two things make this testable at all:

   · the rewrite is a pure function over an HTML string, so it can be run
     here over the REAL guide.html rather than over a sample of it — which
     means editing a meta tag in that file breaks this harness instead of
     silently switching previews off in production;

   · the worker touches the network only through the global fetch and its
     ASSETS binding, both of which are stubbed below. Nothing here reaches
     the internet, same as every other harness in this folder.

   What it does NOT prove: that Cloudflare routes /guide to the worker at
   all. That lives in wrangler.jsonc's run_worker_first, and the only place
   to verify it is a deployment. See DEPLOY.md.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const read = f => fs.readFileSync(path.join(dir, f), "utf8");

let failed = 0;
const check = (label, fn) => {
  try{
    const out = fn();
    if(out === false){ console.log("FAIL  " + label); failed++; }
    else console.log("ok    " + label);
  }catch(e){
    console.log("FAIL  " + label + "\n        " + e.name + ": " + e.message);
    failed++;
  }
};
const acheck = async (label, fn) => {
  try{
    const out = await fn();
    if(out === false){ console.log("FAIL  " + label); failed++; }
    else console.log("ok    " + label);
  }catch(e){
    console.log("FAIL  " + label + "\n        " + e.name + ": " + e.message);
    failed++;
  }
};

/* ---- the shapes the real catalogues have ----
   Trimmed from the live files, keeping the fields the worker reads and the
   three champions that make the mapping interesting: one with an
   apostrophe, one with a Classic skin, and Wukong, whose Data Dragon id is
   nothing like his name. */
const SUMMARY = [
  {id: 60022, name: "Ashe",     alias: "Jade_Ashe",     description: "The Frost Archer"},
  {id: 60064, name: "Lee Sin",  alias: "Jade_LeeSin",   description: "The Blind Monk"},
  {id: 60096, name: "Kog'Maw",  alias: "Jade_KogMaw",   description: "The Mouth of the Abyss"},
  {id: 60062, name: "Wukong",   alias: "Jade_Wukong",   description: "The Monkey King"},
  {id: 60009, name: "Fiddlesticks", alias: "Jade_Fiddlesticks", description: "The Harbinger of Doom"}
];
const DD = {data: {
  Ashe:        {id: "Ashe",        key: "22", name: "Ashe"},
  LeeSin:      {id: "LeeSin",      key: "64", name: "Lee Sin"},
  KogMaw:      {id: "KogMaw",      key: "96", name: "Kog'Maw"},
  MonkeyKing:  {id: "MonkeyKing",  key: "62", name: "Wukong"},
  FiddleSticks:{id: "FiddleSticks",key: "9",  name: "Fiddlesticks"}
}};
const SKINS = {
  60022: [{id: 60022000, name: "Ashe", isBase: true,
           uncenteredSplashPath: "/lol-game-data/assets/ASSETS/Characters/Jade_Ashe/Skins/Base/Images/Jade_Ashe_splash_uncentered_0.project_jade.jpg"},
          {id: 60022005, name: "Amethyst Ashe", isBase: false,
           uncenteredSplashPath: "/lol-game-data/assets/ASSETS/Characters/Jade_Ashe/Skins/Skin05/Images/x.jpg"}],
  60064: [{id: 60064000, name: "Lee Sin", isBase: true,
           uncenteredSplashPath: "/lol-game-data/assets/ASSETS/Characters/Jade_LeeSin/Skins/Base/Images/b.jpg"},
          {id: 60064301, name: "Classic Lee Sin", isBase: false,
           uncenteredSplashPath: "/lol-game-data/assets/ASSETS/Characters/Jade_LeeSin/Skins/Skin301/Images/Jade_LeeSin_splash_uncentered_301.project_jade.jpg"}],
  60062: [{id: 60062000, name: "Wukong", isBase: true,
           uncenteredSplashPath: "/lol-game-data/assets/ASSETS/Characters/Jade_Wukong/Skins/Base/Images/w.jpg"}]
};

const GUIDE = {
  title: "The most generic Ashe ADC guide ever.",
  blurb: "Range is the plan and the plan is range.",
  champ: "Ashe", role: "ADC", author_name: "Rayne"
};

/* ---- the network, as far as the worker can tell ---- */
const CD = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";
const json = body => new Response(JSON.stringify(body),
  {status: 200, headers: {"content-type": "application/json"}});

/* Every call is recorded so a test can assert what was NOT asked for. */
let calls = [];
let world = {};

function stubFetch(){
  globalThis.fetch = async (input, init) => {
    const u = String(input && input.url ? input.url : input);
    calls.push(u);
    if(init && init.signal && init.signal.aborted){
      const e = new Error("aborted"); e.name = "AbortError"; throw e;
    }
    /* A refused connection, not an error response. These are different
       code paths — an HTTP 500 is a Response the worker inspects, a DNS
       or TLS failure is a thrown TypeError — and only one of them was
       covered until a mutation pointed out the other never ran. */
    if(world.throwOn && world.throwOn.test(u)) throw new TypeError("fetch failed");
    if(world.hang) return new Promise((_, rej) => {
      if(!init || !init.signal) return;
      init.signal.addEventListener("abort", () => {
        const e = new Error("aborted"); e.name = "AbortError"; rej(e);
      });
    });
    if(/\/rest\/v1\/guides/.test(u)){
      if(world.dbDown) return new Response("nope", {status: 500});
      return json(world.row === undefined ? [GUIDE] : (world.row ? [world.row] : []));
    }
    if(u === CD + "/v1/champion-summary.json"){
      if(world.noSummary) return new Response("", {status: 404});
      return json(SUMMARY.concat([{id: 1, name: "Not In Mode", alias: "Teemo"}]));
    }
    const champ = /\/v1\/champions\/(\d+)\.json$/.exec(u);
    if(champ){
      const skins = SKINS[Number(champ[1])];
      return skins ? json({skins}) : new Response("", {status: 404});
    }
    if(/ddragon\.leagueoflegends\.com/.test(u)) return json(DD);
    return new Response("", {status: 404});
  };
}

function makeEnv(pageFile){
  const page = read(pageFile);
  return {ASSETS: {fetch: async input => {
    const u = String(input && input.url ? input.url : input);
    calls.push("ASSET " + u);
    if(/config\.js/.test(u)){
      return world.noConfig
        ? new Response("", {status: 404})
        : new Response(read("config.js"), {status: 200,
            headers: {"content-type": "text/javascript"}});
    }
    return new Response(page, {status: 200, headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      /* Deliberately present: the worker has to drop these when it hands
         back a decoded body, or the browser is told the HTML is gzip. */
      "content-encoding": "gzip",
      "content-length": "12345",
      "x-frame-options": "DENY"
    }});
  }}};
}

const get = u => new Request(u, {method: "GET"});
const reset = extra => { calls = []; world = Object.assign({}, extra); };
const tagOf = (html, re) => { const m = re.exec(html); return m ? m[1] : null; };
const ogTitle = h => tagOf(h, /<meta property="og:title" content="([^"]*)">/);
const ogDesc  = h => tagOf(h, /<meta property="og:description" content="([^"]*)">/);
const ogImage = h => tagOf(h, /<meta property="og:image" content="([^"]*)">/);
const ogType  = h => tagOf(h, /<meta property="og:type" content="([^"]*)">/);
const twCard  = h => tagOf(h, /<meta name="twitter:card" content="([^"]*)">/);
const docTitle= h => tagOf(h, /<title>([^<]*)<\/title>/);

(async function(){
  const W = await import("file://" + path.resolve(dir, "worker/index.mjs"));

  /* ================= routing ================= */
  console.log("which requests get a preview:");

  const route = u => W.previewRoute(new URL(u));
  check("guide.html?g= is a guide", () =>
    route("https://s3builds.net/guide.html?g=abc").kind === "guide");
  /* This platform serves /guide for guide.html, so the extensionless form
     is a real URL and people paste it. Missing it would mean half the
     shared links unfurl and half don't, which is worse than none. */
  check("  and so is /guide?g=", () =>
    route("https://s3builds.net/guide?g=abc").slug === "abc");
  check("  and a trailing slash", () =>
    route("https://s3builds.net/guide/?g=abc").kind === "guide");
  check("  and the slug keeps its case", () =>
    route("https://s3builds.net/guide?g=Lee-Sin-A1").slug === "Lee-Sin-A1");
  check("champion.html?c= is a champion", () =>
    route("https://s3builds.net/champion.html?c=KogMaw").id === "KogMaw");
  check("  and the id keeps ITS case", () =>
    route("https://s3builds.net/champion?c=KogMaw").id === "KogMaw");
  check("a guide page with no slug is not", () =>
    route("https://s3builds.net/guide.html") === null);
  check("the home page is not",  () => route("https://s3builds.net/") === null);
  check("an item page is not",   () => route("https://s3builds.net/item.html?i=3031") === null);
  /* The wildcard that was not used in run_worker_first, in test form. */
  check("guide-load.js is not",  () => route("https://s3builds.net/guide-load.js") === null);

  /* ================= escaping ================= */
  console.log("\nwhat a stranger can put in the head:");

  check("quotes cannot close the attribute", () =>
    !W.esc('" onload="alert(1)').includes('"'));
  check("angle brackets cannot open a tag", () => {
    const out = W.esc('</title><script>alert(1)</script>');
    return !out.includes("<") && !out.includes(">");
  });
  check("ampersands escape first, not twice", () => W.esc("a & b") === "a &amp; b"
    && W.esc("&lt;") === "&amp;lt;");

  /* Searching the head for the string "onerror" is not this test. An
     escaped payload still CONTAINS those letters — they sit inertly inside
     an attribute as text, which is exactly the desired outcome — so a
     substring search reports a correct escape as a leak and tempts you to
     relax it until it passes. The question is structural: did anything a
     stranger typed become MARKUP? So count the tags. */
  const tagNames = html => (html.match(/<[a-zA-Z!\/][^\s>]*/g) || [])
    .map(t => t.slice(1).toLowerCase()).sort();

  const HOSTILE = {
    title: '"><script>alert(1)</script>',
    champ: "Ashe", role: "ADC",
    author_name: '" onmouseover="x',
    blurb: "</title><img src=x onerror=alert(1)>"
  };
  const headOf = html => html.slice(0, html.indexOf("</head>"));

  check("a hostile title lands inert in the real page", () => {
    const c = W.guideCard(HOSTILE, null, "https://s3builds.net/guide.html?g=x");
    const html = W.applyCard(read("guide.html"), c);
    if(html === null) return false;
    /* The head must hold exactly the tags it started with, plus the two
       this worker adds on purpose. */
    const before = tagNames(headOf(read("guide.html"))).concat(["meta", "link"]).sort();
    return JSON.stringify(tagNames(headOf(html))) === JSON.stringify(before);
  });

  /* Mutation guard: the same payload through a rewrite with the escaping
     taken out has to fail the check above, or the check above is scenery. */
  check("  (and the counter sees an injection when there is one)", () => {
    const raw = read("guide.html").replace(
      /<meta property="og:title" content="[^"]*">/,
      `<meta property="og:title" content="${HOSTILE.title}">`);
    const before = tagNames(headOf(read("guide.html"))).concat(["meta", "link"]).sort();
    return JSON.stringify(tagNames(headOf(raw))) !== JSON.stringify(before);
  });

  /* A $& in a replacement string is a backreference. A guide titled
     "Cost $& value" would have had the matched tag spliced into its own
     title. Function replacements are what stops it; this is the test that
     would have caught the string version. */
  check("a dollar sign in a title stays a dollar sign", () => {
    const card = W.guideCard({title: "Worth $& the $1 cost", champ: "Ashe"},
      null, "https://s3builds.net/guide.html?g=x");
    const html = W.applyCard(read("guide.html"), card);
    return html !== null && ogTitle(html) === "Worth $&amp; the $1 cost";
  });

  /* ================= the card's words ================= */
  console.log("\nwhat the card says:");

  const card = W.guideCard(GUIDE, "https://cdn/splash.jpg",
                           "https://s3builds.net/guide.html?g=x");
  check("the tab keeps the site name", () =>
    card.documentTitle === "The most generic Ashe ADC guide ever. — S3 Builds");
  /* og:site_name already prints "S3 Builds" above the title in every
     client, so the title itself must not repeat it. */
  check("  and og:title does not",     () => !/S3 Builds/.test(card.title));
  check("the description leads with champion, role and author", () =>
    card.description.startsWith("Ashe ADC guide by Rayne."));
  check("  then the author's own blurb", () =>
    card.description.includes("Range is the plan"));
  check("a guide with no blurb still says something", () => {
    const c = W.guideCard({title: "t", champ: "Ashe", role: "ADC", author_name: "Kai"},
                          null, "u");
    return c.description === "Ashe ADC guide by Kai.";
  });
  check("a guide with no champion doesn't say 'undefined'", () => {
    const c = W.guideCard({title: "t"}, null, "u");
    return c.description === "guide." && !/undefined|null/.test(c.description);
  });
  check("an untitled guide is named, not blank", () =>
    W.guideCard({}, null, "u").title === "Untitled guide");
  check("a very long blurb is cut at a word", () => {
    const c = W.guideCard({title: "t", champ: "Ashe", blurb: "word ".repeat(200)}, null, "u");
    return c.description.length <= 281 && c.description.endsWith("…")
        && !/ $/.test(c.description.slice(0, -1));
  });
  check("a guide is an article, a champion page isn't", () =>
    card.type === "article"
    && W.championCard(SUMMARY[0], null, "u").type === "website");
  check("the champion card uses the epithet", () =>
    W.championCard(SUMMARY[0], null, "u").title === "Ashe, The Frost Archer");

  /* ================= the rewrite, on the real files ================= */
  console.log("\nthe rewrite, against the files on disk:");

  for(const page of ["guide.html", "champion.html"]){
    check(`${page} still has the tags the worker rewrites`, () => {
      const html = W.applyCard(read(page), card);
      return html !== null;
    });
  }

  const done = W.applyCard(read("guide.html"), card);
  check("og:title is replaced",       () => ogTitle(done) === card.title);
  check("og:description is replaced", () => ogDesc(done) === card.description);
  check("og:image is the splash",     () => ogImage(done) === "https://cdn/splash.jpg");
  check("og:type becomes article",    () => ogType(done) === "article");
  check("the tab title is replaced",  () => docTitle(done) === card.documentTitle);
  check("the card goes large",        () => twCard(done) === "summary_large_image");
  check("og:url is added",            () =>
    /<meta property="og:url" content="https:\/\/s3builds\.net\/guide\.html\?g=x">/.test(done));
  check("a canonical link is added",  () =>
    /<link rel="canonical" href="https:\/\/s3builds\.net\/guide\.html\?g=x">/.test(done));
  check("  inside the head",          () =>
    done.indexOf('rel="canonical"') < done.indexOf("</head>"));
  check("the body is untouched",      () =>
    done.slice(done.indexOf("</head>")) === read("guide.html").slice(read("guide.html").indexOf("</head>")));

  check("with no art the logo is left alone and the card stays small", () => {
    const c = W.guideCard(GUIDE, null, "u");
    const out = W.applyCard(read("guide.html"), c);
    return ogImage(out) === "https://s3builds.net/logo-512.png"
        && twCard(out) === "summary";
  });

  /* The guard that makes the string rewrite safe. */
  check("markup that has moved on refuses to be rewritten", () =>
    W.applyCard(read("guide.html").replace(/<meta property="og:title"[^>]*>/, ""), card) === null);
  check("  and so does a duplicated tag", () => {
    const twice = read("guide.html").replace(/(<meta property="og:title"[^>]*>)/, "$1$1");
    return W.applyCard(twice, card) === null;
  });
  check("  and a document with no head", () =>
    W.applyCard("<p>hello</p>", card) === null);

  /* ================= lookups ================= */
  console.log("\nfinding the champion:");

  check("by name, as a guide stores it", () =>
    W.champByName(SUMMARY, "Kog'Maw").id === 60096);
  check("  case-insensitively",  () => W.champByName(SUMMARY, "lee sin").id === 60064);
  check("  and not at all if it isn't in the mode", () =>
    W.champByName(SUMMARY, "Teemo") === null);
  check("by Data Dragon id, as a champion page is addressed", () =>
    W.champByAlias(SUMMARY, "KogMaw").id === 60096);
  check("  case-insensitively, which is what Fiddlesticks needs", () =>
    W.champByAlias(SUMMARY, "FiddleSticks").id === 60009);
  check("  and Wukong is NOT found this way", () =>
    W.champByAlias(SUMMARY, "MonkeyKing") === null);

  check("the Classic skin wins over the base one", () =>
    W.pickSkin(SKINS[60064]).id === 60064301);
  check("  and the base one wins over a cosmetic", () =>
    W.pickSkin(SKINS[60022]).id === 60022000);
  check("  and no skins at all is null, not a crash", () =>
    W.pickSkin([]) === null && W.pickSkin(undefined) === null);

  check("an asset path becomes a lowercase CDN url", () =>
    W.assetUrl("/lol-game-data/assets/ASSETS/Characters/Jade_Ashe/X.JPG")
      === CD + "/assets/characters/jade_ashe/x.jpg");

  check("the config is read out of the real config.js", () => {
    const cfg = W.readConfig(read("config.js"));
    return !!cfg && /^https:\/\/\w+\.supabase\.co$/.test(cfg.url) && cfg.key.length > 20;
  });
  check("  and a file without one is null, not a broken request", () =>
    W.readConfig("const NOTHING = 1;") === null);

  /* ================= end to end ================= */
  console.log("\nend to end, with the network stubbed:");
  stubFetch();

  const run = async (url, pageFile) => {
    const env = makeEnv(pageFile || "guide.html");
    const res = await W.default.fetch(get(url), env, {});
    return {res, html: await res.text()};
  };
  const GUIDE_URL = "https://s3builds.net/guide.html?g=ashe-adc";

  reset();
  {
    const {res, html} = await run(GUIDE_URL);
    await acheck("a real guide gets its own title", async () =>
      res.status === 200 && ogTitle(html) === GUIDE.title);
    await acheck("  its own description", async () =>
      ogDesc(html).startsWith("Ashe ADC guide by Rayne."));
    await acheck("  and the mode's splash art, not Data Dragon's", async () =>
      ogImage(html) === CD + "/assets/characters/jade_ashe/skins/base/images/"
                          + "jade_ashe_splash_uncentered_0.project_jade.jpg");
    await acheck("  with the other headers kept", async () =>
      res.headers.get("x-frame-options") === "DENY"
      && res.headers.get("cache-control") === "public, max-age=0, must-revalidate");
    /* Hand back a decoded body under a header that says gzip and the
       browser shows a page of binary. */
    await acheck("  and the stale encoding headers dropped", async () =>
      !res.headers.get("content-encoding") && !res.headers.get("content-length"));
    await acheck("  never asking Data Dragon for the roster", async () =>
      !calls.some(c => /ddragon/.test(c)));
  }

  reset();
  {
    const {html} = await run("https://s3builds.net/champion.html?c=LeeSin", "champion.html");
    await acheck("a champion page gets the champion", async () =>
      ogTitle(html) === "Lee Sin, The Blind Monk");
    await acheck("  and his Classic splash", async () =>
      /skin301/.test(ogImage(html)));
    await acheck("  without touching the database", async () =>
      !calls.some(c => /rest\/v1/.test(c)));
  }

  reset();
  {
    const {html} = await run("https://s3builds.net/champion.html?c=MonkeyKing", "champion.html");
    await acheck("Wukong resolves through the archive's key", async () =>
      ogTitle(html) === "Wukong, The Monkey King");
    await acheck("  which is the only time Data Dragon is asked", async () =>
      calls.some(c => /ddragon/.test(c)));
  }

  /* ---- and now every way it can go wrong ---- */
  const plain = read("guide.html");
  const untouched = html => html === plain;

  reset({row: null});
  await acheck("a slug with no guide serves the ordinary page", async () =>
    untouched((await run(GUIDE_URL)).html));

  /* The read policy sends a hidden row to nobody but its author and a
     moderator, and this request has no session — so a hidden guide arrives
     here as no row at all, and stops unfurling the moment it is hidden. */
  reset({row: null});
  await acheck("  which is also what a hidden guide looks like", async () =>
    untouched((await run(GUIDE_URL)).html));

  reset({dbDown: true});
  await acheck("a database that refuses serves the ordinary page", async () =>
    untouched((await run(GUIDE_URL)).html));

  reset({noConfig: true});
  await acheck("a missing config.js serves the ordinary page", async () =>
    untouched((await run(GUIDE_URL)).html));

  reset({throwOn: /rest\/v1/});
  await acheck("a database that cannot be reached serves the ordinary page", async () =>
    untouched((await run(GUIDE_URL)).html));

  /* The art is a bonus and its failure has its own catch, which nothing
     reached until this test existed: a 404 from the catalogue returns an
     empty list rather than throwing, so the catch was dead code that
     tested as covered. A refused connection is what actually exercises it,
     and without the catch the whole card is lost over a missing picture. */
  reset({throwOn: /v1\/champions\//});
  await acheck("art that cannot be fetched still gives the guide its title", async () => {
    const {html} = await run(GUIDE_URL);
    return ogTitle(html) === GUIDE.title
        && ogImage(html) === "https://s3builds.net/logo-512.png";
  });

  reset({noSummary: true});
  await acheck("a champion catalogue that 404s still gives the guide its title", async () => {
    const {html} = await run(GUIDE_URL);
    return ogTitle(html) === GUIDE.title && ogImage(html) === "https://s3builds.net/logo-512.png";
  });

  reset({noSummary: true});
  await acheck("  but a champion PAGE with no catalogue serves the ordinary page", async () => {
    const page = read("champion.html");
    const {html} = await run("https://s3builds.net/champion.html?c=Ashe", "champion.html");
    return html === page;
  });

  reset();
  await acheck("a guide for a champion not in the mode keeps its title", async () => {
    world.row = Object.assign({}, GUIDE, {champ: "Teemo"});
    const {html} = await run(GUIDE_URL);
    return ogTitle(html) === GUIDE.title && twCard(html) === "summary";
  });

  /* The route gate in fetch() is belt and braces — run_worker_first means
     these requests should never arrive at all, and if one did, buildCard
     would fail safely on its own. So this asserts the outcome (the page
     comes back exactly as it was, having asked nothing of anyone) rather
     than pretending to measure the gate itself. */
  reset();
  await acheck("the home page is passed straight through", async () => {
    const {res, html} = await run("https://s3builds.net/");
    return res.status === 200 && html === plain
        && !calls.some(c => /rest\/v1|communitydragon|ddragon/.test(c));
  });

  reset();
  await acheck("a POST is passed straight through", async () => {
    const env = makeEnv("guide.html");
    const res = await W.default.fetch(new Request(GUIDE_URL, {method: "POST"}), env, {});
    await res.text();
    return !calls.some(c => /rest\/v1/.test(c));
  });

  /* The slow case. Real, not simulated: the fetch stub hangs until the
     worker's own budget aborts it, so this proves the timer is wired to
     the signal rather than that a promise can be rejected. */
  reset({hang: true});
  const began = Date.now();
  await acheck("a lookup that hangs gives up and serves the page", async () => {
    const {html} = await run(GUIDE_URL);
    const took = Date.now() - began;
    return untouched(html) && took < 5000 && took >= 900;
  });

  console.log(failed ? "\n" + failed + " failure(s)"
                     : "\nthe preview worker holds up");
  if(failed) process.exitCode = 1;
})();
