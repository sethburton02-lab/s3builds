/* ============================================================
   Project config

   The anon key is MEANT to be public. It ships in the page, it identifies
   the project and nothing more, and the row-level policies in
   supabase/schema.sql are what actually protect the data. Publishing it is
   how Supabase is designed to work.

   The service_role key is the opposite: it bypasses every policy. It must
   never appear in this file, in this repo, or in anything the browser can
   reach. If one ever lands here, rotate it in the dashboard — deleting the
   commit is not enough, it is in the history and in anyone's clone.
   ============================================================ */
const SUPABASE_URL = "https://egbhtuhaatyclufktfla.supabase.co";

/* The publishable key. Public by design — it names the project and grants
   nothing the row-level policies don't already allow. Verified against the
   live database: an author cannot edit anyone else's guide, cannot publish
   under another name, and cannot touch their own vote count. */
const SUPABASE_ANON_KEY = "sb_publishable_c1p7iRtmsA5W8ZBTmIhGHA_2QnoDuH-";

/* One switch. The store falls back to localStorage whenever the project
   isn't configured, so a missing key degrades to the current behaviour
   rather than to a broken page — which is also what keeps every node
   harness working without a network. */
const BACKEND_READY = !!SUPABASE_ANON_KEY;
