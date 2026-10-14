/* Sign-in and sign-up error messages.

   This check exists because of a bug that was live for as long as
   passwords have been: PostgREST puts its error text in {message} and
   GoTrue puts its in {msg}, and friendlyError only read the former. So
   every authentication failure — wrong password, email already taken —
   arrived at the dialog with a blank message and fell through to
   "Something went wrong (400)."

   The damage was not the wording. site.js carries two hand-written
   sentences for exactly these two cases, and it selected them by
   matching the message text, so with the text blank NEITHER HAD EVER
   BEEN SHOWN TO ANYONE. A reader who mistyped their password was told
   the site was broken, and reported it as broken. The sentence telling
   them where the way out is was sitting in the source the whole time:
   fourteen accounts exist and not one password reset has ever been
   requested.

   So the property under test is end-to-end and deliberately not
   "friendlyError works": given the body GoTrue actually sends, does the
   dialog put the specific sentence in front of the reader? A test of
   friendlyError alone, written against a PostgREST body, would have
   passed throughout.

   Run: node tools/auth-error-check.js
*/
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const store = fs.readFileSync(path.join(root, "guide-store.js"), "utf8");
const site = fs.readFileSync(path.join(root, "site.js"), "utf8");

/* ---- lift the real source, rather than restating it here ---- */

function balanced(src, from, open, close){
  let d = 0;
  for(let k = src.indexOf(open, from); k < src.length; k++){
    if(src[k] === open) d++;
    else if(src[k] === close && --d === 0) return src.slice(from, k + 1);
  }
  throw new Error("unbalanced from " + from);
}
function lift(src, decl){
  const i = src.indexOf(decl);
  if(i < 0) throw new Error("not found: " + decl);
  return balanced(src, i, "{", "}");
}
/* A function has to skip its parameter list before its body is found.
   sbFetch destructures its second argument, so the first "{" after the
   name belongs to the parameters, and balancing from there returns a
   fragment that is not the function. */
function liftFn(src, decl){
  const i = src.indexOf(decl);
  if(i < 0) throw new Error("not found: " + decl);
  const params = balanced(src, i + decl.length, "(", ")");
  const bodyAt = i + decl.length + params.length;
  return src.slice(i, bodyAt) + balanced(src, bodyAt, "{", "}");
}

/* The dialog's choice of sentence, taken out of the submit handler it
   lives in so it can be run without a DOM. The handler is found by its
   form id, so renaming the form fails this check rather than silently
   testing nothing. */
function liftChoice(formId){
  const h = site.indexOf('closest("#' + formId + '")');
  if(h < 0) throw new Error("no handler for #" + formId);
  const call = site.indexOf("signInError(form,", h);
  if(call < 0) throw new Error("#" + formId + " no longer reports errors");
  /* Balance from before the call's OWN paren. Starting after "(form"
     finds the first paren inside the condition instead and returns a
     fragment that happens to parse. */
  const args = balanced(site, call + "signInError".length, "(", ")");
  /* args is '(form, COND ? "..." : err.message)'; strip the wrapper
     parens and the form argument to leave the expression that decides
     what the reader sees. */
  const expr = args.slice(1, -1).replace(/^\s*form\s*,\s*/, "");
  if(/^\s*form\b/.test(expr)) throw new Error("could not isolate the message expression");
  return new Function("err", "return (" + expr + ");");
}

const choosePw = liftChoice("acctPw");
const chooseUp = liftChoice("acctUp");

/* ---- the store, with fetch replaced ---- */

let NEXT = null;
global.fetch = async () => ({
  ok: NEXT.status < 400,
  status: NEXT.status,
  text: async () => JSON.stringify(NEXT.body)
});
global.localStorage = {
  _d: {}, getItem(k){ return this._d[k] ?? null; },
  setItem(k, v){ this._d[k] = String(v); }, removeItem(k){ delete this._d[k]; }
};
global.SUPABASE_URL = "https://example.test";
global.SUPABASE_ANON_KEY = "anon";

(0, eval)(
  lift(store, "const SB = ") .replace(/^const SB = /, "globalThis.SB = ") + ";\n" +
  "globalThis.SB.on = true;\n" +
  "const SESSION_KEY = 'x';\n" +
  "function session(){ return null; }\n" +
  liftFn(store, "function friendlyError") + "\n" +
  liftFn(store, "async function sbFetch") + "\n" +
  ";globalThis.__sbFetch = sbFetch; globalThis.__friendly = friendlyError;"
);
const sbFetch = globalThis.__sbFetch;

/* ---- the bodies GoTrue really sends ----
   Copied from the project's own auth logs, not from the docs. Each was
   observed against s3builds.net in October 2026. */
const GOTRUE = {
  wrongPassword: {status: 400,
    body: {code: 400, error_code: "invalid_credentials",
           msg: "Invalid login credentials"}},
  emailTaken: {status: 422,
    body: {code: 422, error_code: "user_already_exists",
           msg: "User already registered"}},
  weakPassword: {status: 422,
    body: {code: 422, error_code: "weak_password",
           msg: "Password should be at least 6 characters"}},
  notConfirmed: {status: 400,
    body: {code: 400, error_code: "email_not_confirmed",
           msg: "Email not confirmed"}}
};
/* PostgREST's shape, which must keep working — it is the one that did. */
const PGRST = {status: 403,
  body: {code: "42501", message: 'permission denied for table guides'}};

let failed = 0;
const check = (label, fn) => {
  let ok = false, note = "";
  try{ const r = fn(); ok = r === true; if(r !== true && r !== false) note = " — " + r; }
  catch(e){ note = " — threw: " + e.message; }
  console.log((ok ? "ok    " : "FAIL  ") + label + note);
  if(!ok) failed++;
};
async function err(fixture){
  NEXT = fixture;
  try{ await sbFetch("/auth/v1/token?grant_type=password",
                     {method: "POST", auth: false, body: {}}); }
  catch(e){ return e; }
  throw new Error("that should not have succeeded");
}

(async () => {

  /* The bug itself: no auth failure may reach a reader as a status code.
     This is the assertion that was missing, and it is deliberately
     written over every known GoTrue failure rather than one of them. */
  for(const [name, fx] of Object.entries(GOTRUE)){
    const e = await err(fx);
    check(name + ": says something other than the status code", () =>
      !/^Something went wrong/.test(e.message) || "got: " + e.message);
  }

  {
    const e = await err(GOTRUE.wrongPassword);
    check("wrong password carries GoTrue's message", () =>
      /invalid login credentials/i.test(e.message) || "got: " + e.message);
    check("wrong password carries error_code", () =>
      e.code === "invalid_credentials" || "got: " + JSON.stringify(e.code));
    check("wrong password carries the status", () => e.status === 400);

    /* The call site. This is the one that matters: the reader must get
       the sentence that names the way out, not GoTrue's English. */
    const shown = choosePw(e);
    check("sign-in dialog points at Forgot your password?", () =>
      /forgot your password/i.test(shown) || "showed: " + shown);
    check("sign-in dialog does not show GoTrue's raw English", () =>
      !/invalid login credentials/i.test(shown) || "showed: " + shown);
  }
  {
    const e = await err(GOTRUE.emailTaken);
    check("email taken carries error_code", () =>
      e.code === "user_already_exists" || "got: " + JSON.stringify(e.code));
    const shown = chooseUp(e);
    check("sign-up dialog says the account already exists", () =>
      /already an account/i.test(shown) || "showed: " + shown);
  }

  /* Two failures that are not the famous two must still reach the
     reader as words. They have no hand-written sentence, so they fall
     through to err.message — which is the branch that was empty. */
  {
    const e = await err(GOTRUE.weakPassword);
    check("an unhandled auth failure still reads as English", () =>
      /at least 6 characters/i.test(chooseUp(e)) || "showed: " + chooseUp(e));
  }

  /* The shape that always worked, so the fix is additive. */
  {
    NEXT = PGRST;
    let e;
    try{ await sbFetch("/rest/v1/guides", {method: "POST", body: {}}); }
    catch(x){ e = x; }
    check("PostgREST {message} still maps to the server-fault sentence", () =>
      /fault on our side/i.test(e.message) || "got: " + e.message);
  }

  /* data.code on a GoTrue error is the numeric status. If it were ever
     added to the message chain, a reader would be shown "400". */
  check("the numeric code is never used as a message", () =>
    globalThis.__friendly({code: 400}, 400) === "Something went wrong (400)." ||
    "got: " + globalThis.__friendly({code: 400}, 400));

  console.log(failed ? "\n" + failed + " failed" : "\nall ok");
  process.exit(failed ? 1 : 0);
})();
