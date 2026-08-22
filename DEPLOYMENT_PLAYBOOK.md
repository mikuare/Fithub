# Project Playbook — Local Repo → GitHub → Vercel (Vite)

A reusable, step-by-step reference for starting any new project, pushing it to
GitHub, and deploying it live on Vercel — written from what actually shipped
(and actually broke) while launching FitHub. Commands assume a terminal on
Linux/macOS/WSL; everything works the same from Windows PowerShell unless noted.

---

## 0. One-time machine setup

Do these once per computer, not per project.

```bash
# Identify yourself to git (goes into every commit)
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"

# Make new repos start on 'main' (GitHub's default branch name)
git config --global init.defaultBranch main
```

Authentication to GitHub — pick ONE:

**Option A — GitHub CLI (easiest, recommended):**
```bash
# Install: https://cli.github.com  (or: winget install GitHub.cli / brew install gh)
gh auth login
# → GitHub.com → HTTPS → Login with a web browser → follow the code
```

**Option B — Personal Access Token (no CLI):**
GitHub → Settings → Developer settings → Personal access tokens →
*Fine-grained token* → give it repo access → copy it. When `git push` asks for
a password, paste the token (not your account password — that never works).

---

## 1. Start a new local project

```bash
# New Vite project (pick your framework in the prompt: React, Vue, Svelte…)
npm create vite@latest my-app
cd my-app
npm install
npm run dev        # confirm it boots before doing anything else
```

Create the repo and the safety net **before** the first commit:

```bash
git init
```

**`.gitignore` — check it before the first commit.** Vite scaffolds a good one,
but verify these lines exist; committing any of them is the classic mistake:

```gitignore
node_modules
dist
.env
.env.local
*.local
.DS_Store
coverage
```

> `.env` holds secrets and must never be committed. `.env.example` (with
> placeholder or intentionally-public values) IS committed, so the next person
> knows which variables the project needs.

First commit:

```bash
git add -A
git status          # read this — make sure node_modules/.env are NOT listed
git commit -m "Initial commit: Vite scaffold"
```

---

## 2. Push it to GitHub

**Option A — GitHub CLI (one command):**
```bash
gh repo create my-app --private --source=. --push
# --public instead of --private if you want it open
# Done. It created the repo, added the remote, and pushed.
```

**Option B — manual (website + git):**
1. On github.com → **+** → **New repository** → name it, choose private/public.
   **Do NOT tick** "Add a README / .gitignore / license" — an empty repo avoids
   the first-push conflict entirely.
2. Connect and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/my-app.git
git branch -M main
git push -u origin main
```

After that first `-u` push, day-to-day is just:

```bash
git add -A
git commit -m "What actually changed, in plain words"
git push
```

**First-push problems and their fixes:**

| Symptom | Cause → fix |
| --- | --- |
| `remote contains work that you do not have` | You ticked "Add a README" when creating the repo → `git pull --rebase origin main` then `git push` |
| `authentication failed` | You typed your GitHub password → use a token (Option B above) or `gh auth login` |
| `src refspec main does not match any` | No commit exists yet → `git commit` first, or your branch is `master` → `git branch -M main` |
| Pushed a secret by accident | Rotate the secret at the provider immediately — deleting the file in a later commit does NOT remove it from history |

---

## 3. Vite specifics you must get right for deployment

These are the framework-level facts that decide whether the deployed site works.

### 3.1 Environment variables — the `VITE_` rule

- Only variables prefixed **`VITE_`** are available in browser code
  (`import.meta.env.VITE_API_URL`). Unprefixed vars are invisible to the client
  — which is exactly why **secrets must never get the `VITE_` prefix**.
- Values are **baked in at build time**, not read at runtime. Changing a var on
  the host means nothing until you **rebuild/redeploy**.
- File convention:
  - `.env` — real values, git-ignored.
  - `.env.example` — committed template of every variable the app needs.
  - `.env.test` — committed override so tests never hit live services
    (empty values → the app falls back to its offline/local mode). FitHub
    learned this the hard way: without it, the test suite signed up real
    accounts on the live backend.
- **Never** put a service-role / admin / secret API key in any `VITE_` variable
  — it would ship inside the public JS bundle for anyone to read.

### 3.2 SPA routing — the deep-link 404

A Vite single-page app handles routes like `/settings` in the browser. The
server only has `index.html` — so refreshing or directly opening a deep link
404s unless the host rewrites everything to `index.html`. On Vercel, commit a
**`vercel.json`** at the repo root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Real static files (assets, images) still win over the rewrite — Vercel checks
the filesystem first — so this one rule is safe and sufficient.

### 3.3 If the app is a PWA (service worker)

Two headers matter, or updates will strand users on old versions:

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

- `sw.js` uncacheable → new deploys are picked up on the next visit.
- Hashed `/assets/` immutable → free speed; the filename changes when content does.
- Register the service worker in **production builds only**
  (`if (import.meta.env.PROD && 'serviceWorker' in navigator) …`) so the dev
  server never serves stale bundles.
- Camera, GPS, motion sensors, install prompts: all require **HTTPS** (or
  localhost). They will not work over a plain-HTTP LAN address — test those
  features on the deployed URL or localhost.

### 3.4 Base path (only for non-Vercel subpath hosting)

Vercel serves from the domain root — **no change needed**. Only if you ever
deploy under a subpath (e.g. GitHub Pages `user.github.io/my-app/`) set
`base: '/my-app/'` in `vite.config.ts`.

### 3.5 Build sanity check before deploying

```bash
npm run build      # outputs dist/
npm run preview    # serves dist/ locally — click through the real build
```

If `preview` works and deep links work, Vercel will too.

---

## 4. Deploy on Vercel

### 4.1 Dashboard flow (recommended)

1. vercel.com → **Add New → Project** → **Import** your GitHub repo
   (authorize the GitHub app the first time).
2. Vercel auto-detects Vite: build `npm run build`, output `dist` — leave as is.
3. **Environment Variables** → add every `VITE_…` your app needs
   (copy names from `.env.example`). Public keys only — see 3.1.
4. **Deploy.** You get `https://my-app-xxxx.vercel.app`.

From then on, Vercel deploys **automatically**:
- push to `main` → production deployment,
- push any other branch / open a PR → a preview deployment with its own URL.

Changed an env var later? **Redeploy** (Deployments → ⋯ → Redeploy) — baked at
build time, remember.

### 4.2 CLI flow (optional)

```bash
npm i -g vercel
vercel          # first run: link project, answer prompts → preview deploy
vercel --prod   # production deploy
```

### 4.3 Custom domain

Project → Settings → Domains → add your domain → point DNS at Vercel
(they show the exact records). HTTPS certificates are automatic.

---

## 5. If the backend is Supabase

The extra steps that made or broke the FitHub launch:

1. **Migrations**: keep schema in `supabase/migrations/*.sql`, then
   `supabase link --project-ref <ref>` and `supabase db push`. The client code
   and SQL must agree on types — notably, if primary keys are Postgres `uuid`,
   client-generated ids must be **plain UUIDs** (`crypto.randomUUID()`), not
   `prefix_uuid` strings.
2. **Keys**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` go into Vercel.
   The anon key is designed to be public — **row-level security is the actual
   boundary**, so RLS must be enabled and forced on every table. The
   `service_role` key goes **nowhere** near the frontend, Vercel included,
   until you have real server-side code (edge functions, webhooks).
3. **Auth URLs**: Supabase → Authentication → URL Configuration → set **Site
   URL** to the Vercel domain and add it to the redirect allow-list, or email
   links and OAuth will bounce users to localhost.
4. **Auth emails — the #1 silent launch-killer**: Supabase's built-in mailer
   sends only ~2–4 emails/hour. With "Confirm email" on, sign-ups lock out
   almost immediately. Either disable Confirm email (Authentication → Sign In /
   Providers → Email) or connect real SMTP (Authentication → Emails) before
   real users arrive.
5. **Seeding**: demo/local seed code must run only against the local/dev
   backend; the live database is seeded by SQL migrations.
6. **Smoke test on the live URL**: one real sign-up through the app's core flow
   exercises every table's insert path. Do it before announcing anything.

---

## 6. Go-live checklist (print this)

- [ ] `.gitignore` covers `node_modules`, `dist`, `.env` — verified with `git status`
- [ ] `.env.example` lists every variable; no secret carries a `VITE_` prefix
- [ ] `vercel.json` committed (SPA rewrite; SW headers if PWA)
- [ ] `npm run build && npm run preview` clicked through locally
- [ ] All work committed and pushed — Vercel builds **from GitHub**, not your disk
- [ ] Env vars entered in Vercel; redeployed after any change
- [ ] Deep link (e.g. `/settings`) opened directly on the deployed URL — no 404
- [ ] Backend auth URLs point at the production domain
- [ ] One real end-to-end account created on the live site

---

## 7. Troubleshooting the classics

| Problem | Fix |
| --- | --- |
| Deep links 404 on Vercel | `vercel.json` rewrite (§3.2) missing or not committed |
| `import.meta.env.X` is `undefined` in prod | Missing `VITE_` prefix, or var added after build → set in Vercel and redeploy |
| Site deploys but shows an old version | Service worker cached it → SW `no-cache` headers (§3.3); hard-reload once |
| Works locally, Vercel build fails | Vercel builds from the pushed repo — commit untracked files; check case-sensitive imports (Linux!) |
| Dev server doesn't see file changes (WSL) | Editing on `/mnt/c` — Vite's watcher misses events; restart the dev server, or move the repo into the Linux filesystem (`~/projects`) |
| Tests suddenly hit a live backend | `.env` reached test runs → add committed `.env.test` with empty overrides |
| Pushed a secret | Rotate it at the provider now; history keeps deleted files forever |
| Camera/GPS/motion dead on phone testing | Plain-HTTP LAN URL → secure context required; use the deployed HTTPS URL |

---

*Written 2026-08 from the FitHub launch. Reuse freely for the next project.*
