# Testing the game plan locally

## Run it

Double-click **`serve.bat`**, then open <http://localhost:8080/create.html>.

It needs nothing installed. It tries Python, then Node, then falls back to
PowerShell, which ships with Windows. Each one is tested by *running* it
rather than by looking it up — Windows has a Microsoft Store stub called
`python.exe` that exists on the PATH and does nothing but print "Python was
not found", and an earlier version of this picked it and stalled.

Use a server rather than opening the `.html` file directly. From a `file://`
page the browser gives every request a null origin and refuses some of them —
the champion catalogue, the ability data, the map icons — so the page renders
with pieces missing and looks broken when it isn't. Over `http://localhost` it
behaves exactly as it does on the live site.

For four ready-made plans to look at, open
<http://localhost:8080/demo-plans.html>. It renders one plan per role and can
load them straight into the creator — note that doing so **replaces whatever
draft you have open**.

## What to try

**In the creator**, scroll to **Game plan** (below Matchups).

1. **+ Plan** adds one. The map appears with the Route tool already selected.
2. Click a camp. It should **snap onto the camp** and drop a numbered pip —
   that means it stored the camp's *name*, not the pixel. Clicking open ground
   stores a coordinate instead, which is fine but less durable.
3. Keep clicking to extend the route. The pips number themselves in order.
4. **+ Route** starts a second line; pick a colour first and it uses that.
   Picking a colour *while* drawing recolours the route you're on.
5. **Marker** drops wards, pinks, danger and objective markers. Wards use the
   game's own ward icons.
6. **Pen** draws freehand — drag, don't click.
7. **Erase** removes whatever you click nearest. A route that loses its last
   stop goes with it.
8. **Undo** steps back through whole-plan snapshots.
9. Name the plan, set its kind, label the routes, write the note underneath.
10. **Preview** (top right) opens the guide view with the plan in it.

## What should be true

- A plan survives **Save draft** and a page reload.
- The guide page shows a **Game plan** section with a tab per plan, and a jump
  link in the left nav.
- A published guide's card says "2 plans" alongside its matchup count.
- Routes drawn to camps still point at the right camps — they are stored by
  name, so this holds even if the map art is replaced.

## If something looks wrong

The checks that cover this:

    node tools/guide-render.js .     the guide page and the plan renderer
    node tools/create-check.js .     the editor
    python3 tools/plan-mutate.py     proves those checks actually catch things

The last one is the one that matters: it breaks the code on purpose and fails
if any check doesn't notice.

## The browser check

`node tools/browser-check-page.js` writes `tools/browser-check.html`.

It is named `-page` rather than `-check` on purpose: it BUILDS a page, it
does not assert anything itself. Globbed in with `tools/*-check.js` it
reported a cheerful exit 0 having only written a file, which is precisely
the false confidence the rest of this document is about. The assertions run
in the browser, and you have to look. Open it in a
browser; it shows a pass/fail list and the map underneath.

Every other harness here runs against a DOM stub. A stub cannot tell you what
the **cascade** did — which is how `.plan-text-input` passed twelve checks
while `input[type=text]` quietly outranked it and the typing box stayed white.
This one asks a real engine for computed styles and real geometry.

It found two things on its first run:

- the editor frame's 1px border meant clicks were measured in a 560px box
  while the art and the plan were drawn in a 558px one, and the snap preview
  in a third. An `outline` replaced it: all layers now share one box.
- the preview surface fetches nothing, which reproduces the icon host being
  down exactly. The map filled with thirty broken-image glyphs, despite a
  comment promising it would "degrade to the disc". Now it does.

It does **not** test pointer interaction: drag thresholds, pointer capture,
focus and blur on the inline text input. Nothing substitutes for drawing one
real route in the editor.

## Checking against a game-file extract

`node tools/extract-check.js <path to .../global/default/v1>`

Champions, items, stats and item tiers come from the mode's catalogue at
runtime, so they follow a patch by themselves. Three things do not, and this
diffs all three against an extract: `CLASSIC_ROSTER`, `CHAMP_FACE_Y` and
`CLASSIC_RUNES`.

Extract with **Obsidian** (`Downloads\Obsidian_5.1.8`). Patch the game first,
let Obsidian sync its hashtables, then pull from
`plugins/rcp-be-lol-game-data/global/default/v1/`:
`jade-perks.json`, `champion-summary.json`, `jade-items.json`, `items.json`.
Anything absent is reported as unchecked rather than silently skipped.

On 10 Oct 2026 this found two stale rune values and nine champions missing
from the fallback. No other check in this repo could have seen either: the
rune numbers are transcribed, so a wrong one renders as confidently as a
right one, and the roster gap was invisible because the live catalogue
papers over it on every page load.

## Before deploying

`node tools/ship-check.js`

`wrangler.jsonc` sets `"directory": "./"`, so the whole repo ships except what
`.assetsignore` excludes — which makes that file the newest thing in the
deploy path and the one whose failure mode isn't a red test but a live 404.
This resolves every asset the shipping pages reference and confirms it exists
*and* survives the ignore list, looks for keys in anything deployable, and
checks the cache version is uniform.

Two things it got wrong on its first run, both now fixed, both worth knowing
if you extend it: `src="${esc(sp.icon)}"` is a template expression and not a
filename (eighteen imaginary missing assets, which buried the one real
finding), and grepping for the word `service_role` flags `config.js`, whose
comment warns never to put one there. It now decodes JWTs and judges a key by
its own claimed role instead, so only `anon` passes.

## What a failure says to the reader

`node tools/auth-error-check.js`

Every error path in this repo passes through `friendlyError`, which turns a
server's vocabulary into a sentence. It read `data.message`, which is
PostgREST's field. GoTrue's is `msg`. So *every* authentication failure —
wrong password, email already taken — arrived with a blank message and fell
through to `Something went wrong (400).`

The outage was not the wording. `site.js` carries hand-written sentences for
exactly those two cases, and it chose them by matching the message text, so
with the text blank **neither had ever been shown to anybody**. Fourteen
accounts existed and not one password reset had ever been requested — not
because nobody forgot a password, but because nobody was ever told that
resetting one was the way out. The site reported itself as broken, and a
reader believed it and wrote in.

Two lessons worth keeping, both of which this repo has now learned twice:

- **A check on the helper would have passed.** `friendlyError` was correct
  for the shape it was tested with. The property worth asserting is the one
  the reader experiences, so this check runs the real submit handler's choice
  of sentence against the error body GoTrue really sends — the bodies in it
  were copied out of the project's auth logs, not out of the documentation.
- **Branch on codes, not on prose.** The dialogs now test
  `err.code === "invalid_credentials"`, which `sbFetch` lifts from
  `error_code`. The text match is kept as a fallback, so the fix has two
  independent halves; `tools/auth-error-check.js` pins each one separately
  and fails on all four counts when both are reverted.

The generalised assertion, and the one that would have caught this on day
one, is that no authentication failure may reach a reader as a status code.
It runs over every GoTrue failure the site can provoke, not just the two with
bespoke wording.
