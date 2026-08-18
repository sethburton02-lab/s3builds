/* ============================================================
   GUIDE SANITISER

   A guide's prose is rich text, stored as HTML and rendered with
   innerHTML. That is fine while the only writer is you, in your own
   creator, on your own machine. It stops being fine the moment a guide
   arrives from anywhere else — a #g= link someone pasted in Discord, a
   ?url= fetch, an imported file, and soon a row from a database that any
   signed-in stranger can write to.

   Until now nothing sanitised on the way IN. cleanRich() lives inside
   create.html's IIFE and runs on the author's own draft; the reader had no
   sanitiser at all, so <img src=x onerror=...> in a shared guide simply
   ran. With a backend behind it that is stored XSS against every reader of
   a published guide.

   ---- why this is a string pass and not a DOM walk ----

   The obvious implementation parses the HTML and walks the tree removing
   what it doesn't like. That is what cleanRich does, and it is the shape
   most sanitisers take. Two problems here:

     · it is fail-OPEN. Anything the walk forgets to check survives. The
       list of things to check is long, browser-specific and grows.
     · it needs a DOM, so it cannot run in the node harnesses, which means
       the security-critical code is the one thing left untested.

   So this goes the other way and is fail-CLOSED: escape everything, then
   put back only the exact tag strings on the allowlist. An attribute
   cannot survive unless it is explicitly rebuilt, because by the time the
   allowlist runs there are no tags left to carry one — they are all text.
   Malformed markup degrades to visible words rather than to a hole.

   It is pure string work, so the tests run it for real.
   ============================================================ */

/* Formatting the editor produces. None of these take an attribute, which
   is what makes them safe to restore literally. */
const SAFE_TAGS = ["b", "strong", "i", "em", "u",
                   "ul", "ol", "li", "blockquote", "p", "div", "br"];

/* A reference chip's token: kind:id, where kind is one the site knows.
   Anchored and character-limited — this ends up back in an attribute, so
   it is the one value allowed through and gets the tightest check. */
const REF_TOKEN = /^(champ|item|spell|rune|ability|mastery):[\w.\-]{1,64}$/;

/* Schemes a link may use. Anything else — javascript:, data:, vbscript:,
   and the whitespace/entity tricks that hide them — fails to match and the
   whole anchor is dropped rather than repaired. */
const SAFE_HREF = /^(https?:\/\/[^\s"'<>]{1,300}|mailto:[^\s"'<>]{1,200}|#[\w-]{0,64}|[\w./-]{1,200})$/;

/* An ampersand that already begins a well-formed entity is left alone.
   Without this the pass is not idempotent: text arrives holding &#39; from
   the last save, comes back as &amp;#39;, and every load/save cycle adds
   another layer — a guide edited five times would be showing its own
   escaping. An existing entity is inert, so keeping it is safe as well as
   correct. Everything else is escaped, including a bare & and a malformed
   one like "&#zz;". */
const ENTITY = /&(?=[a-zA-Z][a-zA-Z0-9]{1,10};|#\d{1,7};|#x[0-9a-fA-F]{1,6};)/;
const ESCAPE = {"<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
const escapeAll = s => String(s ?? "").replace(/[&<>"']/g, (c, i, whole) =>
  c === "&" ? (ENTITY.test(whole.slice(i)) ? "&" : "&amp;") : ESCAPE[c]);

/* Rebuild the tags we allow, from their escaped forms. Each pattern is
   written against the ESCAPED text, so it can only ever match something
   that was a tag in the original — never a fragment of one an attacker
   assembled out of pieces. */
function sanitiseRich(html){
  let s = escapeAll(html);

  /* Everything up to the closing bracket, without being able to run past
     it. Attribute values contain &quot;, so a pattern like [^&]* stops
     dead at the first one and the tag is missed — which is safe but wrong,
     and is what made a legitimate reference chip vanish. */
  const INNER = "(?:(?!&gt;).)*";

  /* Plain formatting tags. The attribute text is matched so it can be
     THROWN AWAY: `<b onmouseover=...>` becomes a plain `<b>` rather than
     visible tag soup. Nothing from inside the brackets is ever emitted, so
     dropping attributes this way stays fail-closed — the output tag is
     built from the allowlisted name and nothing else. */
  const tags = SAFE_TAGS.join("|");
  s = s.replace(new RegExp(`&lt;(${tags})(?:\\s${INNER})?\\s*\\/?&gt;`, "gi"),
                (_, t) => `<${t.toLowerCase()}>`);
  s = s.replace(new RegExp(`&lt;\\/\\s*(${tags})\\s*&gt;`, "gi"),
                (_, t) => `</${t.toLowerCase()}>`);

  /* Links. Only href is read; every other attribute is discarded with the
     rest of the tag. The value is re-escaped after validation, so even one
     that passes the scheme check cannot break out of the quotes. */
  s = s.replace(new RegExp(`&lt;a\\s${INNER}&gt;`, "gi"), tag => {
    const m = /href=(?:&quot;|&#39;)((?:(?!&quot;|&#39;).)*)/i.exec(tag);
    if(!m) return "";
    const href = m[1].replace(/&amp;/g, "&").trim();
    if(!SAFE_HREF.test(href)) return "";
    return `<a href="${escapeAll(href)}" target="_blank" rel="noopener noreferrer">`;
  });
  s = s.replace(/&lt;\/\s*a\s*&gt;/gi, "</a>");

  /* Reference chips. Only the token is carried across — the icon and
     classes are rebuilt by the page from the token, so whatever markup was
     inside the chip is discarded rather than inspected. Chips arrive as
     "pending" and the renderer fills in the art once catalogues load,
     which is also what happens to a legitimate chip on a slow connection. */
  s = s.replace(new RegExp(`&lt;span\\s${INNER}&gt;`, "gi"), tag => {
    const m = /data-ref=(?:&quot;|&#39;)((?:(?!&quot;|&#39;).)*)/i.exec(tag);
    return m && REF_TOKEN.test(m[1])
      ? `<span class="ref pending" data-ref="${escapeAll(m[1])}">` : "";
  });
  s = s.replace(/&lt;\/\s*span\s*&gt;/gi, "</span>");

  /* A chip's label is a name, never markup. The icon the creator puts
     inside one is not on the allowlist, so it survives this far as the
     escaped text "&lt;img src=...&gt;" and would be DISPLAYED — safe, but
     it would read as junk sitting inside every reference. The page rebuilds
     the icon from the token anyway, so the label is reduced to its words. */
  s = s.replace(/(<span class="ref pending" data-ref="[^"]*">)([\s\S]*?)(<\/span>)/g,
                (_, open, label, close) =>
                  open + label.replace(/&lt;[\s\S]*?&gt;/g, "").trim() + close);

  return s;
}

/* Plain text, for fields that are never rich: titles, blurbs, names. They
   are escaped at render time too, but a guide should not be CARRYING
   markup in a field that has no use for it. */
const sanitiseText = s => String(s ?? "").replace(/[<>]/g, "").slice(0, 2000);

if(typeof module !== "undefined" && module.exports)
  module.exports = {sanitiseRich, sanitiseText, SAFE_TAGS, REF_TOKEN, SAFE_HREF};
