# Getting S3 Builds onto s3builds.net

Right now the site is a folder on your computer. To reach it at
`s3builds.net`, three things have to happen, in this order:

1. the folder gets uploaded somewhere public  (GitHub)
2. something serves it as a website           (Cloudflare Pages)
3. your domain points at that                 (DreamHost → Cloudflare)

Each step works on its own, and you can stop after any of them and still
have a working site — just at a different address. Roughly 30 minutes.

---

## Step 1 — Put the folder on GitHub

This is storage, not hosting. Nothing is visible on the web yet.

1. Make an account at **github.com** if you don't have one.
2. Click **+** (top right) → **New repository**.
3. Name: `s3builds`. Leave it **Public**. Don't tick anything else.
4. **Create repository.**
5. On the next screen, click **uploading an existing file**.
6. Open `C:\Users\sethb\Downloads\RiftVault` in File Explorer, select
   everything (Ctrl+A), and drag it into the browser window.
7. Wait for the upload, then click **Commit changes**.

**Watch out:** files starting with a dot — `.htaccess` — are sometimes
hidden by Windows. In File Explorer, View → Show → Hidden items, so it
gets uploaded with the rest.

You now have your code on GitHub. Still no website.

---

## Step 2 — Turn it into a website (Cloudflare Pages)

This is the step that produces a real, working URL.

1. Make an account at **dash.cloudflare.com**.
2. Left sidebar → **Workers & Pages** → **Create** → **Pages** tab →
   **Connect to Git**.
3. Authorise GitHub when asked, and pick the `s3builds` repository.
4. On the build settings screen:
   - Framework preset: **None**
   - Build command: **leave completely empty**
   - Build output directory: **/**
5. **Save and Deploy.** It takes about a minute.

Cloudflare gives you an address like `s3builds-abc.pages.dev`. **Open it.**
That is your site, live on the internet, for anyone in the world.

At this point the site works. Sign-in won't yet — see Step 4.

---

## Step 3 — Point s3builds.net at it

Two halves: tell Cloudflare about the domain, then tell DreamHost to hand
it over.

**3a. Add the domain to Cloudflare**

1. Cloudflare dashboard → **Add a site** (or Websites → Add a site).
2. Type `s3builds.net`. Choose the **Free** plan.
3. Cloudflare shows you **two nameservers**, like
   `xxx.ns.cloudflare.com`. Leave this page open — you need them next.

**3b. Tell DreamHost to use them**

1. Sign in at **panel.dreamhost.com**.
2. Left menu → **Domains** → **Registrations**.
   (Not "Manage Domains" — that's the hosting side, and it's the usual
   wrong turn.)
3. Find `s3builds.net`. Click the **DNS** or **Nameservers** option next
   to it.
4. Choose the option for **your own / custom nameservers**.
5. Paste in the two from Cloudflare, replacing what's there. Save.

DreamHost will warn you that DNS is moving away from them. That's the
point.

**3c. Attach it to your site**

Back in Cloudflare, wait until the domain says **Active** — usually
minutes, occasionally a few hours. Then:

1. **Workers & Pages** → your `s3builds` project → **Custom domains**.
2. **Set up a domain** → `s3builds.net` → Activate.
3. Do it again for `www.s3builds.net`.

HTTPS switches itself on a few minutes later. If you see a certificate
warning before that, it's normal — wait, don't change anything.

---

## Step 4 — Let people sign in

Sign-in only works on an address Supabase has been told about.

1. **supabase.com** → your project → **Authentication** → **URL
   Configuration**.
2. **Site URL:** `https://s3builds.net`
3. **Redirect URLs:** add `https://s3builds.net/**`

If you want to test sign-in *before* the domain is live, also add your
`pages.dev` address there. You can remove it later.

---

## Did it work?

Go to `https://s3builds.net` and:

- [ ] the site loads, with the gold S3 logo in the corner
- [ ] Champions, Items and Runes pages show real content
- [ ] the padlock shows in the address bar
- [ ] type your email in the header and click Sign in
- [ ] the email arrives and clicking the link signs you in
- [ ] write and publish a guide
- [ ] **open the site in a different browser** — the guide is still there

That last one is the real test. Everything before it can pass while the
database sits empty; only that proves guides are actually being saved
somewhere other than your own computer.

---

## Making changes later

Edit the files in `C:\Users\sethb\Documents\s3builds`, then commit and push.
Cloudflare notices and redeploys in about a minute.

**If you changed a `.js` or `.css` file, run this first:**

```
python tools/bump-version.py
```

It renumbers `site.js?v=94` to `?v=95` everywhere. Skip it and the deploy
still happens, but browsers and Cloudflare's edge can keep serving the old
copy of the file from cache — the site looks unchanged and there is nothing
wrong to find, because nothing is wrong except which bytes are being run.
That cost a full debugging session once; the number is what stops it.

---

## If something goes wrong

**The pages.dev address shows nothing.** Check the build output directory
is `/` and the build command is empty.

**s3builds.net doesn't load but pages.dev does.** DNS hasn't propagated,
or the nameservers at DreamHost didn't save. Check Cloudflare says the
domain is Active.

**A tab gives "too many redirects".** An old copy of `_redirects` is
still deployed. Re-upload it and wait for the deploy to finish, then
hard-refresh with Ctrl+Shift+R — a 301 is cached by the browser, so the
loop can outlive the fix.

**The site loads but there are no guides and sign-in does nothing.** The
browser is blocking the database. Press F12 → Console; if you see a
Content-Security-Policy error mentioning supabase.co, the domain in
`_headers` doesn't match your project.

**The sign-in email never arrives.** Check spam. Supabase's built-in mail
is rate-limited to a handful per hour on the free tier — that's fine for
testing, and worth swapping for a real mail service before you tell
anyone about the site.
