/* ============================================================
   Draft guard check

       node tools/draft-guard-check.js <site-dir>

   One rule, proved rather than trusted: a blank editor must never
   overwrite a stored draft that has content in it.

   WHY THIS EXISTS

   On production, create.html opened with an empty form, autosave fired
   600ms later, and the saved draft was replaced by an empty one. The same
   build restored correctly on localhost, so there was nothing to find
   where anyone was looking. The draft was gone and the page said nothing —
   an empty form is also what a first visit looks like, which is exactly
   why the failure could not be seen.

   The restore bug itself is a separate question and may be environmental.
   This check is about the part that loses work: whatever makes load()
   fail, the failure must not be destructive.

   HOW IT WORKS

   isEmptyDraft() and save() are lifted out of create.html by source and
   evaluated against a localStorage stub. Lifting the real source rather
   than a copy is the point — a copy would pass forever after the original
   changed.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const src = fs.readFileSync(path.join(dir, "create.html"), "utf8");

function lift(name){
  const i = src.indexOf(`function ${name}(`);
  if(i < 0) throw new Error(`${name}() not found in create.html`);
  /* Brace-match from the opening { so a nested } cannot end it early. */
  const start = src.indexOf("{", i);
  let depth = 0;
  for(let j = start; j < src.length; j++){
    if(src[j] === "{") depth++;
    else if(src[j] === "}" && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`${name}() is unbalanced`);
}

/* The two functions plus the small surface they touch. */
const store = {};
const sandbox = {
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  saveKey: () => "riftvault.draft.v2",
  paintSaveState(){},
  notes: [],
  note(msg){ sandbox.notes.push(String(msg)); },
  unsaved: false,
  S: null
};

const BLANK = {
  title: "", blurb: "", champ: null, role: "Mid", tag: "",
  spellSets: [[]], items: [{label: "Starting items", items: []},
                           {label: "Core build", items: []},
                           {label: "Situational", items: []}],
  setups: [{name: "Standard", mast: {}, runes: {mark: [null], seal: [null],
            glyph: [null], quint: [null]}}],
  skillPages: [{name: "Standard", skills: Array(18).fill(null)}],
  sections: [{h: "Why this build works", b: ""}],
  matchups: [], plans: [], notes: {}
};
/* isEmptyDraft reads BLANK to learn the seeded section heading, so the
   sandbox has to carry it — the same object the editor starts from. */
const api = new Function(
  "localStorage", "saveKey", "paintSaveState", "note", "BLANK",
  `let S = null, unsaved = false;
   ${lift("isEmptyDraft")}
   let blankSaveBlocked = false;
   ${lift("save")}
   return {isEmptyDraft, save, setS: v => { S = v; }};`
)(sandbox.localStorage, sandbox.saveKey, sandbox.paintSaveState, sandbox.note, BLANK);

const clone = o => JSON.parse(JSON.stringify(o));
const REAL = Object.assign(clone(BLANK), {
  title: "Lee Sin jungle — one opening, two builds",
  champ: "Lee Sin", role: "Jungle",
  items: [{label: "Start", items: ["1039", "2003"]}]
});

let failures = 0;
const check = (name, cond) => {
  if(cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}`); failures++; }
};

console.log("isEmptyDraft");
check("a fresh editor state is empty", api.isEmptyDraft(clone(BLANK)) === true);
check("null is empty", api.isEmptyDraft(null) === true);
check("a title alone is not empty", !api.isEmptyDraft({...clone(BLANK), title: "x"}));
check("a champion alone is not empty", !api.isEmptyDraft({...clone(BLANK), champ: "Lee Sin"}));
check("one item in one row is not empty",
  !api.isEmptyDraft({...clone(BLANK), items: [{label: "Start", items: ["1039"]}]}));
check("prose alone is not empty",
  !api.isEmptyDraft({...clone(BLANK), sections: [{h: "", b: "<p>words</p>"}]}));
check("empty tags do not count as prose",
  api.isEmptyDraft({...clone(BLANK), sections: [{h: "", b: "<p></p>"}]}));
check("one skill point is not empty",
  !api.isEmptyDraft({...clone(BLANK),
    skillPages: [{name: "x", skills: ["Q", ...Array(17).fill(null)]}]}));
check("one rune is not empty",
  !api.isEmptyDraft({...clone(BLANK),
    setups: [{name: "x", mast: {}, runes: {mark: ["sm1"], seal: [null], glyph: [null], quint: [null]}}]}));
check("a mastery point is not empty",
  !api.isEmptyDraft({...clone(BLANK), setups: [{name: "x", mast: {"512": 4}, runes: {}}]}));

console.log("save");
store["riftvault.draft.v2"] = JSON.stringify(REAL);
api.setS(clone(BLANK));
api.save(true);
check("a blank editor does NOT overwrite a real stored draft",
  JSON.parse(store["riftvault.draft.v2"]).title === REAL.title);
check("refusing is reported to the author", sandbox.notes.some(m => /left alone/i.test(m)));

sandbox.notes.length = 0;
api.setS(clone(BLANK));
api.save(true);
check("the warning is not repeated on every autosave tick", sandbox.notes.length === 0);

delete store["riftvault.draft.v2"];
api.setS(clone(BLANK));
api.save(true);
check("a blank editor still saves when nothing is stored",
  typeof store["riftvault.draft.v2"] === "string");

store["riftvault.draft.v2"] = JSON.stringify(REAL);
const edited = Object.assign(clone(REAL), {title: "edited"});
api.setS(edited);
api.save(true);
check("a real edit still overwrites",
  JSON.parse(store["riftvault.draft.v2"]).title === "edited");

store["riftvault.draft.v2"] = "{not json";
api.setS(clone(BLANK));
api.save(true);
check("an unparseable stored draft does not block a blank save",
  store["riftvault.draft.v2"] !== "{not json");

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
