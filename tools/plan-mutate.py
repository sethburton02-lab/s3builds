#!/usr/bin/env python3
"""Mutation run for the game-plan checks.

Every mutation below breaks something the new checks claim to guarantee. If a
mutation survives, the check that was supposed to catch it is decoration.

Crashes are reported SEPARATELY from failures. A harness that dies on a
mutation did notice it, but a run where everything crashes for an unrelated
reason looks identical to a run where everything was caught -- which is how
a previous mutation run here reported 11 uncaught as 11 caught.

Mutations are applied IN PLACE and restored in a finally, rather than copied
to a temp tree. Copying 31MB of site (11MB of it art) for each of twenty-odd
mutations took minutes; the harnesses themselves run in under a fifth of a
second. Every file is checksummed before and after, and the run refuses to
report a result if anything was left modified."""
import subprocess, os, sys, hashlib

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARNESS = [("guide-render", ["node", "tools/guide-render.js", "."]),
           ("create-check", ["node", "tools/create-check.js", "."])]

MUT = [
  ('the patch number is shown in Riot internal numbering again', 'site.js',
   'const patchLabel = () => livePatch() ? "Patch " + classicPatch(livePatch()) : "Live patch";',
   'const patchLabel = () => livePatch() ? "Patch " + livePatch() : "Live patch";'),
  ('an empty patch is turned into a number out of nothing', 'site.js',
   '  const m = /^(\\d+)(\\..*)?$/.exec(s);\n  if(!m) return s;\n  const major = Number(m[1]);',
   '  const parts = s.split(".");\n  const m = [s, parts[0], parts[1] ? "." + parts.slice(1).join(".") : ""];\n  const major = Number(m[1]);'),
  ('a patch already in the mode convention gets ten more', 'site.js',
   '  return major >= 20 ? s : String(major + 10) + (m[2] || "");',
   '  return String(major + 10) + (m[2] || "");'),
  ('the guide stamp goes back to the internal number', 'guide.html',
   '  const show = typeof classicPatch === "function" ? classicPatch : (x => x);',
   '  const show = (x => x);'),
  ('guides are stored with the displayed number instead of the internal one', 'guide-store.js',
   '  if(live) row.patch = live;',
   '  if(live) row.patch = (typeof classicPatch === "function" ? classicPatch(live) : live);'),
  ('nothing but labels can be dragged', 'create.html',
   '    if(grab && grab.kind !== "text"){', '    if(false){'),
  ('a dragged stop stops re-snapping to a place', 'create.html',
   '  const st = planStepFrom(Math.max(0, Math.min(1, fx)), Math.max(0, Math.min(1, fy)));',
   '  const st = {x: fx, y: fy};'),
  ('a plain click on a stop moves it instead of adding one', 'create.html',
   '        else { planUndo.pop(); planToolClick(ev, st); }',
   '        else { planUndo.pop(); }'),
  ('the pen grabs instead of drawing when it starts on a stop', 'create.html',
   '  if(PLAN_TOOL.tool !== "pen" && PLAN_TOOL.tool !== "erase"){',
   '  if(PLAN_TOOL.tool !== "erase"){'),
  ('erase grabs instead of removing', 'create.html',
   '  if(PLAN_TOOL.tool !== "pen" && PLAN_TOOL.tool !== "erase"){',
   '  if(PLAN_TOOL.tool !== "pen"){'),
  ('the grab finds the bottom thing instead of the top', 'create.html',
   '  for(let i = p.markers.length - 1; i >= 0; i--){\n    const m = p.markers[i];\n    if(m.kind === "text") continue;',
   '  for(let i = 0; i < p.markers.length; i++){\n    const m = p.markers[i];\n    if(m.kind === "text") continue;'),
  ('the typing box gets a panel behind it again', 'site.css',
   'background:transparent;border:none;border-bottom:2px solid var(--gold-hi);',
   'background:rgba(18,12,6,.78);border:2px solid var(--gold-hi);'),
  ('the typing box rule loses to the page generic input rule again', 'site.css',
   '.plan-canvas input.plan-text-input{position:absolute;', '.plan-text-input{position:absolute;'),
  ('the typing box loses the halo that keeps it readable', 'site.css',
   '  text-shadow:0 0 4px rgba(18,12,6,.95), 0 0 4px rgba(18,12,6,.95),\n              0 1px 2px rgba(18,12,6,.95)}',
   '  color:#fdf6e3}'),
  ('map labels go back to bold', 'site.css',
   '.pl-text{font:400 30px var(--font-jade,Georgia,serif);fill:#fdf6e3;text-anchor:middle;',
   '.pl-text{font:700 30px var(--font-jade,Georgia,serif);fill:#fdf6e3;text-anchor:middle;'),
  ('a label can no longer be picked up, only stacked on', 'create.html',
   '    if(hit >= 0){',
   '    if(false){'),
  ('the label hit box stops following the words', 'create.html',
   'const halfW = Math.max(26, String(m.text || "").length * 8.2);',
   'const halfW = 26;'),
  ('a dragged label keeps its camp, so it springs back', 'create.html',
   '  delete m.place;\n', '  '),
  ('moving a label stops clamping to the map', 'create.html',
   '  m.x = Math.max(0, Math.min(1, +fx.toFixed(4)));\n  m.y = Math.max(0, Math.min(1, +fy.toFixed(4)));',
   '  m.x = +fx.toFixed(4);\n  m.y = +fy.toFixed(4);'),
  ('planMoveText will move any marker, not just text', 'create.html',
   '  if(!m || m.kind !== "text") return false;', '  if(!m) return false;'),
  ('snapping removed: every click stores a raw point', 'create.html',
   'const near = (typeof mapNearest === "function")\n    ? mapNearest(x * MAP_SIZE, y * MAP_SIZE, 38) : null;',
   'const near = null;'),
  ('colour enum stops guarding the marker url', 'data-map.js',
   'marker-end="url(#${u}-arrow-${c})"',
   'marker-end="url(#${u}-arrow-${r.colour})"'),
  ('unknown place resolves to the origin instead of null', 'data-map.js',
   'return p ? {x: p.x, y: p.y} : null;',
   'return p ? {x: p.x, y: p.y} : {x: 0, y: 0};'),
  ("legend stops escaping the author's label", 'data-map.js',
   '</i>${esc(r.label)}</li>',
   '</i>${r.label}</li>'),
  ('the first stop of a path stops showing until the second', 'data-map.js',
   'if(!pts.length) return "";\n    const c = safeCol(r.colour);',
   'if(pts.length < 2) return "";\n    const c = safeCol(r.colour);'),
  ('route pips lose their numbers', 'data-map.js',
   '<text x="${p.x}" y="${p.y + 6}">${i + 1}</text>',
   '<text x="${p.x}" y="${p.y + 6}"></text>'),
  ('objective and note draw the same thing', 'data-map.js',
   'return `<g class="pl-mark pl-note"><circle cx="${p.x}" cy="${p.y}" r="12"/></g>`;',
   'return `<g class="pl-mark pl-obj">\n                <path class="pl-pole" d="M ${p.x - 8} ${p.y + MR} L ${p.x - 8} ${p.y - MR}"/>\n                <path class="pl-flag" d="M ${p.x - 8} ${p.y - MR} L ${p.x + MR - 1} ${p.y - 7}\n                      L ${p.x - 8} ${p.y + 3} Z"/></g>`;'),
  ('a control ward draws as a normal ward', 'data-map.js',
   'const MAP_WARD_ICON = {ward: "art/ward-green.png", pink: "art/ward-pink.png"};',
   'const MAP_WARD_ICON = {ward: "art/ward-green.png", pink: "art/ward-green.png"};'),
  ('the wards go back to the un-recoloured originals', 'data-map.js',
   'const MAP_WARD_ICON = {ward: "art/ward-green.png", pink: "art/ward-pink.png"};',
   'const MAP_WARD_ICON = {ward: MAP_ICON_GAME + "/ux/minimap/icons/minimap_ward_green_full.png", pink: MAP_ICON_GAME + "/ux/minimap/icons/minimap_ward_pink_friendly.png"};'),
  ('the objective flag loses its blue', 'site.css',
   '.pl-obj .pl-flag{fill:#3f8fe0',
   '.pl-obj .pl-flag{fill:#e0a84a'),
  ('a text label stops drawing on the map', 'data-map.js',
   '    if(m.kind === "text")',
   '    if(false)'),
  ('an empty text label draws an invisible element', 'data-map.js',
   'return m.text ? `<text class="pl-text" x="${p.x}" y="${p.y + 6}">${esc(m.text)}</text>` : "";',
   'return `<text class="pl-text" x="${p.x}" y="${p.y + 6}">${esc(m.text)}</text>`;'),
  ('a text label is published as markup rather than text', 'guide-load.js',
   'text: str(m && m.text).slice(0, PLAN_TEXT_MAX)}',
   'text: rich(m && m.text)}'),
  ('the label cap is removed', 'guide-load.js',
   'text: str(m && m.text).slice(0, PLAN_TEXT_MAX)}',
   'text: str(m && m.text)}'),
  ('empty labels are published instead of dropped', 'guide-load.js',
   '}).filter(m => m && (m.kind !== "text" || m.text)),',
   '}).filter(Boolean),'),
  ('the typing box goes back to a panel row under the map', 'create.html',
   '    planEditText(p.markers.length - 1);',
   '    /* no inline editor */'),
  ('the canvas is rebuilt while a label is being typed', 'create.html',
   '  if(planEditing !== null) return;\n  const wrap = $("planCanvas"); if(!wrap) return;',
   '  const wrap = $("planCanvas"); if(!wrap) return;'),
  ('a click on a label drags it instead of opening it', 'create.html',
   '        else { planUndo.pop(); planEditText(hit); }   /* a click, not a drag */',
   '        else { planUndo.pop(); }'),
  ('any twitch counts as a drag, so a label can never be clicked', 'create.html',
   'if(!moved && Math.hypot(e.clientX - x0, e.clientY - y0) < 5) return;',
   'if(false) return;'),
  ('plan cap removed', 'guide-load.js',
   'arr(g.plans).slice(0, PLAN_MAX)',
   'arr(g.plans)'),
  ('step cap removed', 'guide-load.js',
   'arr(r && r.steps).slice(0, PLAN_STEPS_MAX)',
   'arr(r && r.steps)'),
  ('coordinates no longer clamped to the square', 'guide-load.js',
   'const pt = v => Math.max(0, Math.min(1, Math.round(v * 1e4) / 1e4));',
   'const pt = v => v;'),
  ('one-step routes are kept instead of dropped', 'guide-load.js',
   '})).filter(r => r.steps.length > 1),',
   '})),'),
  ('marker kind enum removed', 'guide-load.js',
   'PLAN_MARKS.includes(m && m.kind) ? m.kind : "note"',
   '(m && m.kind) || "note"'),
  ('the plan count on a card stops being the real one', 'guide-load.js',
   'return Array.isArray(g && g.plans) ? g.plans.length : 0;',
   'return 99;'),
  ('the plan section is dropped from the guide page', 'guide.html',
   '["plan",      "Game plan",        plansHtml()]',
   '["plan", "Game plan", ""]'),
  ('erase leaves empty routes behind', 'create.html',
   'if(!r.steps.length){ p.routes.splice(i, 1); if(PLAN_TOOL.route === i) PLAN_TOOL.route = null; }',
   ''),
  ('the editor stops capping steps', 'create.html',
   'if(r.steps.length >= PLAN_STEPS_MAX) return;',
   ''),
  ('paths all come out the same colour', 'create.html',
   'colour: PLAN_COLOURS[p.routes.length % PLAN_COLOURS.length]',
   'colour: "gold"'),
  ('freehand goes back to cycling the palette', 'create.html',
   'const stroke = {colour: "red", w: 8, pts: [at(ev)]};',
   'const stroke = {colour: PLAN_COLOURS[p.ink.length % PLAN_COLOURS.length], w: 8, pts: [at(ev)]};'),
  ('the marker buttons stop hiding under other tools', 'create.html',
   '$("planMarks").hidden = PLAN_TOOL.tool !== "marker";',
   '$("planMarks").hidden = false;'),
  ('the css override that made hidden a no-op comes back', 'site.css',
   '.pt-group[hidden]{display:none}',
   ''),
  ('the label row disappears for a single path', 'create.html',
   '$("planRoutes").innerHTML = p.routes.length\n    ? `<div class="pr-list">',
   '$("planRoutes").innerHTML = p.routes.length > 1\n    ? `<div class="pr-list">'),
  ('clearing a plan stops taking a snapshot, so Undo cannot bring it back', 'create.html',
   '  planSnapshot();                 /* first, so Undo brings the whole plan back */',
   '  /* snapshot removed */'),
  ('an unclosed div creeps back into the page', 'create.html',
   '        </div>\n      </div>\n      </div>\n    </div>\n',
   '        </div>\n      </div>\n    </div>\n'),
  ('the snap preview stops naming what it will snap to', 'create.html',
   '\'<text class="pg-name" x="\' + lx + \'" y="\' + (near.y + (above ? -44 : 58)) + \'">\' +\n      esc(near.name) + \'</text>\'',
   "''"),
  ('the preview name is allowed to run off the map edge', 'create.html',
   'const lx = Math.max(90, Math.min(MAP_SIZE - 90, near.x));',
   'const lx = near.x;'),
  ('plan ids go back to a bare timestamp, so same-millisecond ids collide', 'create.html',
   'const planUid = prefix => prefix + Date.now().toString(36) + (++PLAN_SEQ).toString(36);',
   'const planUid = prefix => prefix + Date.now().toString(36);'),
  ('the explanation box goes back behind a button', 'create.html',
   '  if(noteHost.dataset.for !== p.id){',
   '  if(noteHost.dataset.for !== p.id && p.note){'),
  ("a plan's explanation is dropped on publish", 'guide-load.js',
   '        note:  rich(p && p.note),',
   '        note:  "",'),
  ("the rename pencil stops writing to the plan's own field", 'create.html',
   '  pg[pageNameKey(K)] = next;',
   '  pg.name = next;'),
  ("the plan strip goes back to its own bar instead of the client's tabs", 'create.html',
   'bar.innerHTML = `<div class="page-selector">',
   'bar.innerHTML = `<div class="plan-selector">'),
  ('a repaint during a rename destroys the input', 'create.html',
   '  if(typeof renaming !== "undefined" && renaming !== null) return;',
   '  if(false) return;'),
  ("Duplicate shares the original's arrays instead of copying them", 'create.html',
   '                      routes: structuredClone(src.routes),',
   '                      routes: src.routes,'),
  ('plans can no longer be deleted down to none', 'create.html',
   '  if(K.list().length <= (K.min == null ? 1 : K.min)) return;',
   '  if(K.list().length <= 1) return;'),
  ('planAdd goes back to its own hand-written copy', 'create.html',
   'function planAdd(){ addPage("plan"); }',
   'function planAdd(){ if(S.plans.length >= PLAN_MAX) return; S.plans.push({id: planUid("m"), title: "Plan " + (S.plans.length + 1), kind: "jungle", note: "", routes: [], markers: [], ink: []}); S.planActive = S.plans.length - 1; paintPlan(); save(); }'),
  ('the opt-out drops out of the heading', 'create.html',
   'id="planScrap" hidden',
   'id="planScrapX" hidden'),
  ('the opt-out shows even with no section to opt out of', 'create.html',
   '  if(scrap) scrap.hidden = !p;',
   '  if(scrap) scrap.hidden = false;'),
  ('Do not include gameplan only clears the open plan', 'create.html',
   '  S.plans = []; S.planActive = 0;\n  PLAN_TOOL.route = null; planUndo = [];',
   '  S.plans.splice(S.planActive, 1);\n  PLAN_TOOL.route = null; planUndo = [];'),
  ('the editor stays on the page when there are no plans', 'create.html',
   '  if(ui) ui.hidden = !p;',
   '  if(ui) ui.hidden = false;'),
  ('the opt-out also scraps rune pages', 'create.html',
   '  if(kind !== "plan") return;\n  const before = snapshot()',
   '  const before = snapshot()'),
  ('the explanation box goes back to the full-height white editor', 'site.css',
   '.plan-note-wrap .rt{min-height:58px;background:var(--bg-2);font-size:14px;',
   '.plan-note-wrap .rt{min-height:150px;background:#fff;font-size:14px;'),
]

def run(cmd):
    r = subprocess.run(cmd, cwd=SITE, capture_output=True, text=True, timeout=120)
    out = r.stdout + r.stderr
    saw_checks = ("ok " in out) or ("FAIL" in out)
    crashed = (not saw_checks) or "SyntaxError" in out
    return ("FAIL" in out or r.returncode != 0), crashed

def digest(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()

touched = sorted({m[1] for m in MUT})
before = {f: digest(os.path.join(SITE, f)) for f in touched}

caught = survived = crashes = 0
for label, fname, find, repl in MUT:
    full = os.path.join(SITE, fname)
    original = open(full, encoding="utf-8").read()
    if find not in original:
        survived += 1
        print(f"SURVIVED (pattern not found in {fname})  {label}")
        continue
    try:
        open(full, "w", encoding="utf-8").write(original.replace(find, repl, 1))
        got = crashed_any = False
        who = ""
        for name, cmd in HARNESS:
            failed, crashed = run(cmd)
            # CRASH IS CHECKED FIRST, and ends the run for this mutation.
            # A harness that cannot parse exits non-zero, which the old
            # ordering read as "failed", i.e. as the mutation being caught.
            # A whole run reported 20/20 caught while guide-render had a
            # syntax error and never executed a single check.
            if crashed:
                crashed_any, who = True, name
                break
            if failed:
                got, who = True, name
                break
    finally:
        open(full, "w", encoding="utf-8").write(original)   # always put it back
    if got:
        caught += 1
        print(f"caught by {who:14s}  {label}")
    elif crashed_any:
        crashes += 1
        print(f"!! {who} CRASHED -- it ran no checks, so this proves nothing: {label}")
    else:
        survived += 1
        print(f"SURVIVED  <-- no check noticed  {label}")

after = {f: digest(os.path.join(SITE, f)) for f in touched}
dirty = [f for f in touched if before[f] != after[f]]
if dirty:
    print("\n!! THESE FILES WERE LEFT MUTATED: " + ", ".join(dirty))
    sys.exit(2)

print(f"\n{caught} caught, {survived} SURVIVED, {crashes} INCONCLUSIVE (harness crashed), of {len(MUT)}")
print("all files restored")
if crashes:
    print("a crashed harness ran no checks -- fix it before trusting this run")
sys.exit(1 if (survived or crashes) else 0)
