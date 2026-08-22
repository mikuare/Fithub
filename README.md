# FitHub

**Smart Fitness Guidance, Workout Monitoring & Gym Management**

A production-quality fitness platform: personal training programmes, a distraction-free
live workout mode, progressive-overload tracking, recovery scoring, habits, nutrition,
challenges, coaching tools and gym operations — in one application.

```
PLAN → TRAIN → RECORD → RECOVER → ANALYSE → IMPROVE → REPEAT
```

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:7351
```

FitHub runs on **7351** — deliberately outside the crowded 3000/4000/5000/8000 ranges, so
it will not fight another project for a port. If 7351 is somehow busy, Vite steps to the
next free port and prints it rather than refusing to boot. To pin a specific one:

```bash
PORT=6000 npm run dev
```

That is the whole setup. FitHub runs immediately with a local browser database —
no backend, no accounts to create anywhere, works offline.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check the project references, then produce `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Type-check only |
| `npm test` | Run the full test suite (279 tests) |
| `npm run test:watch` | Watch mode |

---

## Two ways to run it

FitHub talks to a **`Backend` interface** (`src/lib/db/adapter.ts`). Two implementations
satisfy it and the app picks one at boot.

### 1. Local mode — the default

No configuration. Everything lives in this browser's IndexedDB (with a
localStorage fallback when IndexedDB is unavailable). Passwords are hashed with
PBKDF2-SHA256, 210k iterations, per-user salt.

Be clear about what this is: **single-browser, single-device storage.** It is a real,
durable database for one person on one machine — not multi-user auth. The Settings
screen says so plainly rather than implying otherwise.

### 2. Supabase mode

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

Then run the SQL in `supabase/migrations/` **in order** against your project:

| File | Contents |
| --- | --- |
| `0001_schema.sql` | Enums, 33 tables, foreign keys, check constraints, indexes, triggers |
| `0002_rls.sql` | Row-level security on every table, plus the private storage bucket |
| `0003_functions.sql` | `handle_new_user`, `delete_my_account`, analytics helpers |
| `0004_seed.sql` | One gym, plans, equipment inventory, starter challenges |
| `0005_body_map.sql` | Niggle journal table + RLS, and `delete_my_account` updated to clear it |
| `0006_billing.sql` | Subscriptions + payment history, RLS, and a loud note on moving writes behind payment-provider webhooks |

Restart the dev server. The app switches over automatically, and Google sign-in
becomes available.

> **Honest note:** the Supabase adapter and the migrations are written against the
> same column names as the TypeScript model and are exercised by the type system,
> but they have not been run against a live Supabase project in this build. The local
> adapter is the one covered end to end by the test suite.

---

## Architecture

```
src/
  types/index.ts          One domain model; the SQL schema mirrors it 1:1
  lib/
    fitness/              Pure, tested domain logic — no React, no I/O
      calculations.ts       1RM, volume, BMI, BMR/TDEE, pace, rep schemes
      program.ts            Split selection + exercise selection + time budgeting
      progression.ts        Double progression, deload detection, strength trend
      recovery.ts           Readiness scoring from self-reported inputs
      freshness.ts          Per-muscle fatigue decay, weekly balance, niggle cautions
      foodiq.ts             Food benefits, goal-fit scoring, eating strategy, meal suggestions
      barcode.ts            EAN/UPC validation + Open Food Facts response mapping
      walk.ts               Pedometer step detection + GPS distance accumulation
      fitscore.ts           Five weighted components, 0–1000
      goals.ts              Progress, pace-aware status, milestones, projection
      streaks.ts            Rest-day-aware consistency
      records.ts            Personal-record detection per exercise type
      achievements.ts       Achievement evaluation from raw data
      units.ts              Metric/imperial conversion + plate maths
    coach/fitcoach.ts     Deterministic assistant grounded in the user's own data
    db/                   Backend interface, local adapter, Supabase adapter
    storage/idb.ts        IndexedDB wrapper with a localStorage fallback
  store/                  Zustand: auth, data, timer, toast
  data/                   Exercise library (107), achievements, habits, foods
  components/             Design system, layout, charts, workout UI
  lib/billing/            Plans, prices, entitlements + card/wallet validation
  pages/                  34 screens
  tests/                  359 tests
supabase/migrations/      Postgres schema + RLS + functions + seed
```

**The rule that shapes everything:** business logic lives in `src/lib/fitness/` as pure
functions with no React and no I/O. Components render, the store persists, and the maths
is separately testable. Every number the UI shows traces back to a function with tests
behind it.

---

## What is actually built

### The core loop
- **Onboarding** — 10 guided steps: profile, experience, goal, location, equipment,
  availability, preferences, safety screening, habits, review with a live programme preview.
- **FitStart assessment** — an optional baseline. Every field is skippable.
- **Programme generation** — picks a split from days available × experience × goal, then
  fills movement-pattern slots with the hardest exercise the user can safely do *with the
  equipment they actually listed*, trims the session to their stated time budget, and
  assigns weekdays around their preferences.
- **Live workout mode** — one exercise at a time, previous performance, a progression
  suggestion, large touch targets, swipe between exercises, plate calculator, warm-up
  flagging, undo, and a rest timer that runs on the wall clock so navigating away never
  desynchronises it. Screen wake-lock where supported.
- **Completion** — duration, sets, volume, clearly-labelled calorie *estimates*, automatic
  personal-record detection, difficulty and feeling capture, notes.
- **Everything downstream updates from that one session**: goals recalculate, achievements
  re-evaluate, challenge progress recomputes, records are checked, FitScore moves.

### Analysis
Progress (overview / body / strength / cardio / history / photos), personal records,
weekly review with a real "biggest win" and "opportunity", month-over-month report,
calendar with drag-and-drop rescheduling, and FitCoach.

### Health & lifestyle
Recovery check-ins with a transparent score breakdown, habits with a 14-day grid,
nutrition logging with estimated targets you can override.

**Walk Mode** — real measured walks, within the limits a web app honestly has.
Steps are counted live from the accelerometer with a tested detector (peak
detection over a self-adjusting baseline, human-cadence rate limiting, and a
three-step rhythm confirmation so a bumped phone counts nothing); distance and
pace come from GPS with accuracy filtering, teleport-glitch rejection and a
standing-still noise floor. iOS motion permission is requested correctly, the
screen is kept awake during a walk, and saving feeds everything downstream: the
walk becomes a completed cardio session (distance challenges, streaks, calorie
estimate via MET), and steps are added to the steps habit (step challenges,
daily-steps goal). The setup screen states the hard limit plainly: counting
runs only in the foreground with the screen on — no web app gets a background
pedometer on iOS or Android — and only the distance total is kept, never the
route.

**Food IQ & barcode scanning.** Selecting any food now explains what it actually
does for you — protein density, macro roles, honest benefit statements computed
from the data on record (no invented micronutrients) — and scores it against
*your* training goal with the reasoning shown; a food is never "bad", only a fit
or a trade-off. An **Eat for your goal** panel turns the goal into numbers:
protein per day from your body weight (mainstream sports-nutrition ranges),
roughly how much per meal, and live "good picks right now" that fit what is left
of today's targets — prioritising protein when it lags, and refusing to nudge
you to eat when the day is already covered. The **barcode scanner** uses the
native `BarcodeDetector` and the device camera to read packaged foods and look
them up in Open Food Facts (only the barcode digits leave the device, stated in
the UI); EAN/UPC check digits are validated locally, manual entry always works
as a fallback, and missing database values are reported as missing. FitHub
deliberately does **not** pretend to recognise food from photos — that would
need a vision model it does not have; the honest version is barcodes plus a
good local library.

**Body Map** — the anatomical muscle map becomes a living heat map. Every logged
working set deposits fatigue into the muscles that exercise targets (primary
weighted over secondary, RPE-modulated), and that fatigue decays exponentially at
muscle-size-dependent rates, so the map shows what is fresh, recovering or
fatigued *right now*. Alongside it: a **niggle journal** for aches and tight
spots — exercises that stress a niggled or still-fatigued muscle are flagged in
today's plan with alternatives suggested (never imposed), lingering niggles are
called out after two weeks, and logged pain gets a see-a-professional note.
A weekly push/pull and quad/posterior-chain balance readout completes the page,
and it declines to judge below a minimum set count rather than inventing verdicts.
Niggles are private in the strongest sense: like recovery and nutrition, they are
never visible to trainers under any setting.

### Gym operations
Attendance (search, QR, manual, check-out), member and membership management,
equipment inventory with maintenance logging, gym analytics computed from real
check-in records, and an append-only audit log.

### Coaching
A trainer roster, per-client detail with attendance, notes (with an internal-only
option) and messaging.

### Plans & billing
Three tiers with monthly and yearly billing in USD and PHP (regional price points,
not conversions):

| | Free | Plus | Pro |
| --- | --- | --- | --- |
| The training core — programme, live workouts, progress, records, recovery, habits, challenges | ✓ | ✓ | ✓ |
| Active goals | 3 | unlimited | unlimited |
| Body Map, niggle journal, weekly review, monthly report | — | ✓ | ✓ |
| FitCoach | — | — | ✓ |
| Data export & account deletion | ✓ always | ✓ always | ✓ always |

Checkout supports international cards (Visa, Mastercard, Amex, JCB — validated with
Luhn, brand detection and expiry checks, all client-side) and the wallets the
Philippines actually uses: GCash, Maya and GrabPay, with PH mobile-number
validation. **Billing is a clearly-labelled sandbox**: no payment provider is
connected, so checkout activates the plan and records a receipt marked `sandbox`
without moving money. Full card numbers and CVCs are validated in memory and never
stored — only the brand and last four digits. Locked pages show an honest pitch and
a route to `/pricing`, never a crippled half-version, and the paywall never touches
export or deletion.

### PWA / mobile
FitHub installs as a Progressive Web App: a `manifest.webmanifest` with app
shortcuts (Today's workout, Recovery check-in), a hand-rolled service worker
(network-first navigations with an offline app-shell fallback, cache-first for
hashed build assets), and a generated icon set — `scripts/make-icons.mjs` renders
the PNGs with a dependency-free PNG encoder, so the repo ships no binary tooling.
The service worker registers in production builds only, keeping dev servers fresh.
The UI is responsive throughout with a bottom tab bar on small screens.

---

## Design decisions worth defending

**Rest days do not break your streak.** A day counts if you trained *or* if that weekday
is a scheduled rest day in your programme. Punishing people for taking the recovery their
own plan prescribes pushes them toward exactly the behaviour the product exists to discourage.

**Missing data is reported as missing.** The recovery score drops absent inputs and
re-normalises the remaining weights instead of substituting a neutral value. Calories are
`null` without a bodyweight rather than invented. FitCoach says "I don't have that
recorded" instead of guessing. `estimate1RM` returns `null` for nonsensical input.

**Everything is private by default.** Profile visibility starts at `private`, every sharing
toggle starts off, and leaderboards are opt-in per challenge. Progress photos, recovery
check-ins and nutrition are never shared under any setting — the RLS policies enforce that,
not just the UI.

**Suggestions are suggestions.** Progressive overload proposes a load and explains why;
it never mandates one. A deload is recommended when volume falls three sessions running
at the same weight, with the reasoning shown.

**The Body Map warns, it never blocks.** A flagged exercise stays in the plan with its
reasoning and possible swaps shown — the user knows their body better than a decay curve
does. Balance verdicts require a minimum weekly set count before saying anything, a
niggle that lingers past two weeks is surfaced rather than silently tracked, and logged
pain always carries the advice to see a professional instead of an in-app workaround.

**Billing tells the truth.** Every checkout, receipt and plan badge says *sandbox* until a
real payment provider is connected — the flow is complete, the money is not pretended.
Locked features pitch what they do and link to pricing; they never ship a degraded
version, and export and deletion are free on every tier because a paywall on your own
data would be ransom, not pricing.

**FitScore is labelled for what it is** — an engagement and progress indicator, not a
health measurement. BMI is shown with the caveat that it cannot distinguish muscle from fat.

**Achievements reward showing up, improving and recovering** — never appearance or
bodyweight. There are no expiring windows and no loss mechanics.

---

## Security & privacy

- Row-level security is enabled **and forced** on all 36 tables.
- Full card numbers and CVCs are validated in memory and never persisted, in sandbox or
  otherwise; billing rows keep only the brand, last four digits, or a masked wallet number.
- Role checks read a dedicated `user_roles` table through `SECURITY DEFINER` helpers, so a
  `profiles` policy never has to query `profiles` (which would recurse).
- Trainers see programmes, sessions, sets, records and goals **only** for clients actively
  assigned to them. Body measurements require the client's explicit opt-in, checked inside
  the policy. Recovery, nutrition, niggles and photos are never exposed to a trainer.
- Challenge leaderboard rows are visible only when `on_leaderboard` is true *and* the
  viewer is in the same challenge.
- Audit logs are append-only: insert requires `actor_id = auth.uid()`, read requires admin,
  and there is no update or delete policy.
- Progress photos live in a private storage bucket partitioned by user id.
- Login failures return one message for both unknown email and wrong password.
- `delete_my_account()` removes every owned row in one transaction, then the auth user.
- Full JSON export is available from Settings.

Client-side role checks (`ROUTE_GUARDS` in `src/components/layout/nav.ts`) exist for
navigation and UX. **They are not the security boundary** — the database policies are.

---

## Accessibility

Keyboard navigable throughout with visible focus rings; a skip link; ARIA roles on tabs,
switches, radio groups, dialogs and progress indicators; focus trapping and restoration in
modals; `prefers-reduced-motion` respected globally **and** re-exposed as a setting that
actually applies a class to the document; status always carried by text or shape as well as
colour; tabular numerals so timers and weights do not jitter; 44px+ touch targets in the
workout UI.

Colour contrast is enforced by tests rather than by eye: `src/tests/contrast.test.ts` parses
`src/index.css` and checks body text, secondary text, muted text, brand text, button labels,
badges, progress fills and borders against WCAG 2.1 minima in **both** themes.

---

## Testing

```bash
npm test
```

**359 tests across 19 files:**

| Area | What it covers |
| --- | --- |
| `calculations` | 1RM blending and caps, volume excluding warm-ups, BMI/BMR/TDEE, pace, rep schemes |
| `goals` | Progress in both directions, degenerate goals, pace-aware status, projections |
| `progression` | History grouping, double progression, deload detection, bodyweight handling |
| `recovery` | Weight re-normalisation, sleep curve, consecutive-day load, state bands |
| `freshness` | Fatigue decay, warm-up exclusion, RPE weighting, honest no-data reads, balance thresholds, niggle cautions and alternative filtering |
| `billing` | Tier entitlements, goal limits, real yearly savings, price formatting, period rolls, Luhn/brand/expiry/CVC validation, PH wallet numbers and masking |
| `foodiq` | Protein-density profiles, goal-fit bands with reasons, eating strategies with honest no-weight fallbacks, remaining-macro suggestions, EAN/UPC check digits, Open Food Facts mapping incl. kJ conversion and missing-value honesty |
| `walk` | Step detection on synthetic walks (steady cadence counted, stillness and single jolts at zero, rhythm re-confirmation after pauses), haversine, GPS accuracy/teleport/jitter filtering, honest pace nulls |
| `streaks` | Rest-day-aware streaks, open current week |
| `records` | Per-type record candidates, lower-is-better pace, warm-up exclusion |
| `fitscore` | Bounds, recency weighting, partial-data damping |
| `program` | Equipment respected, no advanced moves for beginners, safety flag honoured, time budget, no duplicates |
| `units` | Round-trips, plate maths, missing-value formatting |
| `coach` | Intent routing, honest "no data" answers, no crash on an empty account |
| `icons` | Every string-addressed icon resolves |
| `flow` | **End-to-end**: sign-up → onboarding → programme → workout → sets → finish → records, goals, achievements, recovery, habits, account deletion |
| `render` | All 34 pages render with data **and** on an empty account, asserting zero React errors — which also exercises both sides of every paywall |
| `components` | Label association, ARIA roles and states on switches/radio groups/dialogs, progress clamping |
| `contrast` | Parses the real stylesheet and checks 25 colour pairs per theme against WCAG minima |

Bugs these tests caught during development, all since fixed:

- A goal with zero progress could never be flagged as needing attention, no matter how much
  of its window had elapsed — the exact goals that most needed surfacing were the ones hidden.
- The FitCoach intent matcher used substring search, so `"pr"` fired inside `"press"` and
  `"progress"`, routing strength questions to the records answer.
- Exercise lookup required the library's exact name, so "cable rows" resolved to nothing.
- `MuscleMap` spread a `key` prop into JSX, which React 18 flags as a correctness problem.
- Field errors rendered a `<p>` inside a `<p>` — invalid DOM nesting.
- Five light-theme colour tokens failed WCAG contrast: the lime progress fill sat at 2.22:1
  against a white card (3:1 required for non-text UI), and the amber, green, red and blue
  badge text all fell short of 4.5:1 against their own tinted backgrounds.

---

## Tech stack

React 18 · TypeScript (strict, `noUnusedLocals`, `noUnusedParameters`) · Vite 6 ·
Tailwind CSS 3 · Zustand · React Router 6 · Recharts · Lucide · Vitest ·
Testing Library · Supabase (optional)

**Bundle:** ~90 kB gzipped for the entry chunk, with every page code-split. Icons are
imported through an explicit registry rather than a namespace import — the namespace
version pulled 778 kB of unused icons into the bundle; the registry is 57 kB.

Exercise illustrations are inline SVG muscle maps generated from each exercise's
`primary`/`secondary` muscle data, so the library ships with real illustrations and
zero image assets.

---

## Health disclaimer

FitHub provides general fitness guidance and is not a medical device or a substitute for
professional healthcare advice. It does not diagnose conditions and does not provide
treatment for eating disorders or medical nutrition conditions. Users are prompted to
consult a qualified healthcare professional before starting or significantly changing an
exercise programme, and the safety screening surfaces that prompt automatically when
answers warrant it.
