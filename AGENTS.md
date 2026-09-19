# AGENTS.md — which agent does the work

Imported by [`CLAUDE.md`](CLAUDE.md), which holds the project's facts, commands, and rules. This
file holds only routing: who to dispatch, in what order. On conflict, CLAUDE.md wins.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This project is pinned to Expo SDK 57 (`expo ~57.0.23`, per `package.json` — quote from there, not
from prose, since it will drift). Docs for a newer SDK describe APIs this project does not have. If
you upgrade the SDK, update this link in the same commit.

## Subagent Usage Policy

### 1. Mandatory delegation

Claude Code must not silently carry out multi-step or ambiguous work itself. Before starting,
classify the task's severity (§2) and route it through the matching subagent workflow. Only a
genuinely trivial, one-line task — a typo fix, a single config value, answering a question with
no edit — may be handled directly, with no subagent.

### 2. Severity classification

Three tiers. Classify by blast radius, not diff size — a one-line change to `generate-plan` is
HIGH; a hundred-line copy edit inside one screen can be LOW.

**LOW — small, isolated, low-blast-radius.** Single file, no schema/API change, easily
reversible.
→ Proceed directly, or dispatch at most one subagent (the relevant implementation subagent).
- Fixing a typo or a wrong figure in a single doc file (e.g. a stray km number in
  `docs/reference/coaching/example-plan-5k-pro.md`).
- Correcting one mislabeled string in `src/lib/notation.ts`'s abbreviation tables, with no
  callers affected.
- Bumping a single dependency's patch version already inside the existing lockfile range, no API
  change — `dependency-auditor` applies these itself.

**MEDIUM — multi-file changes, new features, refactors touching shared code, anything that could
break existing behavior.**
→ Minimum sequence: planning subagent → implementation subagent(s) → testing subagent →
`doc-writer` (only if user-facing behavior changed).
- Building a new screen that consumes `src/lib/planTypes.ts` and adds several files under
  `src/components/`.
- Refactoring a shared type in `planTypes.ts` in a way that ripples into the golden fixture,
  `notation.ts`'s consumers, and multiple test files.
- Implementing a new pure-logic module shared by the app and the edge functions (for example,
  extending `paceDerivation.ts` or `planTemplates.ts`), with its own test suite.

**HIGH/CRITICAL — schema/migration changes, auth/security-sensitive code, anything touching
production config, cross-service changes, or anything the user explicitly flags as risky.**
Always HIGH, whatever the diff size: auth, schema/migrations, payments, secrets or env, anything
under `workers/src/`, plan generation, adding a dependency.
→ Full chain: planning subagent → design/architecture review subagent → implementation
subagent(s) → testing subagent → security/review subagent → `doc-writer` → final
verification/QA subagent (`verifier`). Branches (`feat/<slug>` or `fix/<slug>`) and opens a PR
via `github-ops` — never a direct commit (CLAUDE.md → Git etiquette).
- Writing or deploying the `generate-plan` Worker route (AI call + cross-service + secrets, all
  three independently HIGH).
- Any D1 migration (`workers/migrations/`).
- Wiring or debugging auth (better-auth config, OAuth, sessions).
- **Any change to `workers/src/lib/store.ts`.** D1 has no row-level security, so that file *is* the
  authorization layer — a statement missing its `user_id` predicate is a data leak with no second
  net behind it.
- Adding any new npm dependency, even when the diff touches only `package.json`.

**Skipping a required step for a task's severity tier is not allowed** unless the user overrides
it explicitly in the same message.

### 3. Subagent selection — category lookup

Severity → category → a specific subagent should be a lookup, not a guess. This covers the
subagents a chain actually pulls from; "Full roster (70)" below is the exhaustive list.

| Category | Subagents |
|---|---|
| **Planning** (also where HIGH's design/architecture review step comes from — `system-architect`, `api-designer`, `threat-modeler`, `migration-planner`) | `feature-planner` `bug-planner` `migration-planner` `system-architect` `api-designer` `spec-writer` `test-strategist` `threat-modeler` `caching-strategist` `product-strategist` `market-research` `adr-writer` `task-router` |
| **Implementation — client/UI** | `implementer` `frontend-builder` `ui-designer` `design-system` `motion-animation` `responsive-crossdevice` `accessibility-implementer` `ux-copywriter` `i18n-localization` |
| **Implementation — backend/data** | `database-engineer` `supabase-auth` `jobs-queues-edge` `integration-builder` `env-config-manager` |
| **Implementation — AI/LLM** | `prompt-engineer` `ai-feature-builder` `rag-retrieval` |
| **Implementation — fixes/upkeep** | `implementer` `debugger` `refactorer` `framework-upgrader` `mobile-perf-optimizer` |
| **Testing** | `test-writer` `mocks-testdata` `seed-data` `e2e-browser-tester` `load-tester` `coverage-analyst` `llm-eval` |
| **Review / security** | `code-reviewer` `security-auditor` `accessibility-reviewer` `privacy-compliance` `scope-guard` `tech-debt-tracker` `dependency-auditor` |
| **Docs** | `doc-writer` `diagram-generator` — `doc-writer` is the name this file uses throughout; the agent actually registered on this machine is `docs-updater` (`~/.claude/agents/docs-updater.md`), so dispatch that when `doc-writer` is "not found" |
| **QA / final verification** | `verifier` (the mandatory gate, every tier) — plus `profiler`, `e2e-browser-tester`, or `load-tester` as situational adders for HIGH-tier user flows |

### 4. Escalation rule

**If unsure which tier a task falls into, default to the higher tier, not the lower.** This
replaces the old "unsure = treat as big" rule with the same intent, stated as a tier default
rather than a binary. `task-router` remains available for genuinely ambiguous routing — it
returns an ordered plan and does no work itself.

### 5. Standing rules

Carried forward unchanged from the old routing rules; the severity tiers above don't touch them.

1. **Parallel only when tasks share no files.** Otherwise run them in sequence.
2. **Read-only agents report, never fix.** Pair each with its builder: `bug-planner`→`debugger`,
   `accessibility-reviewer`→`accessibility-implementer`, `profiler`→`mobile-perf-optimizer`,
   `migration-planner`→`framework-upgrader`, `test-strategist`→`test-writer`,
   `market-research`→`product-strategist`, `threat-modeler`→`security-auditor`.
3. All git/GitHub actions go through `github-ops` — never a raw `git push` (CLAUDE.md → Git
   etiquette).
4. `verifier` = `npm run typecheck && npm run lint && npm test`. Required before every commit, at
   every tier — for a LOW-tier task handled directly, run the commands yourself rather than
   dispatching the subagent.

## Task → chain

Each row shows only the domain-specific core of its chain — which agent builds it and which agent
does the domain review (`security-auditor` and similar) — not the full tier wrapper from §2. §2's
requirements still apply on top of every row: a HIGH row is always preceded by a planning/design-
review step (§3's Planning category — often already the row's own lead agent, e.g. `api-designer`
on the edge-function row, `migration-planner` on the SDK-bump row), and, wherever new logic is
written, by a testing subagent (§3's Testing category) ahead of `verifier`. Reading only the table
is not license to drop either. `verifier` sits before `doc-writer` here because it's the gate that
must be clean before time goes into docs — it doubles as the tier's final pre-commit check (§2's
"final verification/QA," Standing rule 4), not a separate, later step; the two aren't in
disagreement. Treat the tier as a floor either way: a row may add steps beyond what's shown, never
drop one its tier requires, without an explicit user override in the same message.

| You're asked to… | Tier | Dispatch |
|---|---|---|
| Add a feature | MEDIUM | `feature-planner` → `implementer` → `test-writer` → `verifier` → `code-reviewer` → `doc-writer` (if user-facing) |
| Fix a described bug (root cause known, single file) | LOW–MEDIUM | `debugger` → `verifier` (add `test-writer` if it needs new coverage) |
| Chase a vague symptom | MEDIUM | `bug-planner` → `debugger` → `verifier` |
| Touch DB schema or migrations (`workers/migrations/`) | HIGH | `database-engineer` → `security-auditor` → `verifier` → `doc-writer` → `github-ops` (branch + PR) |
| Anything **auth** (better-auth config, OAuth, sessions) | HIGH | `supabase-auth` (the auth specialist; ignore its Supabase-specific tooling — this project is better-auth on D1) → `security-auditor` → `verifier` → `doc-writer` → `github-ops` (branch + PR) |
| Write or change a Worker route | HIGH | `api-designer` → `jobs-queues-edge` → `security-auditor` → `verifier` → `doc-writer` → `github-ops` (branch + PR) |
| Build the `generate-plan` AI flow | HIGH | `prompt-engineer` → `ai-feature-builder` → `llm-eval` → `security-auditor` → `verifier` → `doc-writer` → `github-ops` (branch + PR) |
| Design a screen | MEDIUM | `ui-designer` → `frontend-builder` → `accessibility-reviewer` → `verifier` → `doc-writer` (if user-facing) |
| Add or change theme tokens | LOW–MEDIUM | `design-system` → `verifier` (single-value fix is LOW; a new token or system-wide change is MEDIUM — never hardcode, CLAUDE.md → Code conventions) |
| Touch `.env`, `workers/.dev.vars`, `wrangler.toml [vars]`, or any secret | HIGH | `env-config-manager` → `verifier` → `doc-writer` → `github-ops` (branch + PR) |
| Ship to TestFlight / stores | HIGH | `release-versioning` → `mobile-release` → `verifier` → `doc-writer` → `github-ops` (branch + PR) |
| Bump Expo SDK or a major dep | HIGH | `migration-planner` → `framework-upgrader` → `verifier` → `doc-writer` → `github-ops` (branch + PR) |
| Add any new npm dependency | HIGH | `dependency-auditor` → `implementer` → `verifier` → `doc-writer` → `github-ops` (branch + PR) |
| Clean up working code, no behavior change | LOW–MEDIUM | `refactorer` → `verifier` (single file is LOW; a shared-code refactor is MEDIUM — add `test-writer` if it needs new regression coverage) |
| Commit, PR, issue, branch cleanup | — | `github-ops` |
| Understand an unfamiliar area | — | `Explore` (cheap) or `codebase-explorer` (deep map) |

## Full roster (70)

**Plan / decide** (read-only) — `task-router` `feature-planner` `bug-planner` `migration-planner`
`system-architect` `api-designer` `spec-writer` `product-strategist` `market-research`
`threat-modeler` `caching-strategist` `test-strategist` `adr-writer`

**Build** (edits code) — `implementer` `debugger` `refactorer` `frontend-builder`
`database-engineer` `supabase-auth` `jobs-queues-edge` `integration-builder` `ai-feature-builder`
`prompt-engineer` `rag-retrieval` `framework-upgrader` `mobile-perf-optimizer` `design-system`
`ui-designer` `ux-copywriter` `motion-animation` `responsive-crossdevice`
`accessibility-implementer` `i18n-localization`

**Verify / review** — `verifier` `code-reviewer` `security-auditor` `accessibility-reviewer`
`privacy-compliance` `scope-guard` `tech-debt-tracker` `dependency-auditor` `coverage-analyst`
`test-writer` `mocks-testdata` `seed-data` `e2e-browser-tester` `load-tester` `profiler` `llm-eval`

**Ship / operate** — `github-ops` `cicd-setup` `mobile-release` `release-versioning`
`feature-flag-rollout` `observability-setup` `uptime-healthcheck` `incident-responder`
`log-analyzer` `analytics-instrumentation` `cost-monitor` `ai-cost-optimizer`

**Explain** — `doc-writer` `diagram-generator` `codebase-explorer`

**Configure** — `project-bootstrapper` `tooling-setup` `config-manager` `env-config-manager`
`mcp-integration-wiring` `notifier`

Built-ins also available: `Explore`, `Plan`, `general-purpose`. Plugin agents are namespaced
(`vercel:*`, `feature-dev:*`) and are not part of this project's default chains.

## V2.2 guardrails agents must respect

- **The backend is Cloudflare (D1 + Workers + better-auth) in `workers/`, not Supabase**
  (2026-08-02). `supabase/` and `src/lib/supabase.ts` are dead scaffold — do not build against
  them, do not delete them. Start at [`workers/README.md`](workers/README.md).
- **`workers/` is a separate npm project with its own gate.** The root
  `typecheck && lint && test` deliberately excludes it, so it passes while the backend is broken.
  Anything touching `workers/` must also run
  `npm --prefix workers run typecheck && npm --prefix workers test`.
- **There is no RLS.** Authorization is enforced in `workers/src/lib/store.ts` and by the single
  pre-dispatch session check in `workers/src/index.ts`. See that store's header before touching it.
- **No business rules in the client.** Tier, quota, and plan generation are Worker work —
  `jobs-queues-edge`, not `frontend-builder`.
- **The privacy policy has one source and a publication gate.** `docs/privacy-policy.md` is the
  source; `src/constants/legal.ts` is the in-app URL; `.github/workflows/publish-legal-pages.yml`
  publishes only that policy after a qualifying push to `main`. Keep all three aligned, and never
  call `https://ianqiu979.github.io/Ai-Customized-Running-Plan-App/privacy-policy/` live until the
  Pages run succeeds. The policy's 13–17 guardian-consent condition is now enforced and recorded
  in `workers/` (schema: `workers/migrations/0004_guardian_consent.sql`; route: `handlePutIntake`
  in `workers/src/routes.ts`) — keep that flow's behavior and the policy's Age section in sync;
  the consent checkbox's exact copy still needs the captain's/legal's certification before ship.
  Treat the account-linked intake and plans conservatively as health/fitness data, and document
  provider retention from current official sources rather than inferring consent or deletion
  behavior.
- **`ANTHROPIC_API_KEY` never leaves the server.** Any agent touching env goes through
  `env-config-manager`. Two committed-file traps, not one: `EXPO_PUBLIC_*` is plain text in the app
  bundle, and `workers/wrangler.toml` is committed — secrets go in `workers/.dev.vars` (gitignored)
  and `wrangler secret put`.
- **Never run `wrangler login`, `wrangler deploy`, `wrangler d1 create`, or `wrangler secret put`.**
  Those need the captain's own Cloudflare account. Everything is verifiable offline against
  `wrangler dev`'s local emulation.
- **The Worker IS deployed, as the named `production` environment, and that name is a trap.**
  `[env.production]` makes the live Worker `pace-blueprint-production`, not `pace-blueprint`, so
  every `wrangler secret put` / `deploy` aimed at it needs `--env production` — without the flag the
  command succeeds while targeting a different Worker that nothing talks to. A named environment
  also inherits **no bindings**, which is why `[[env.production.d1_databases]]` is duplicated in
  `wrangler.toml` on purpose. Diagnose the deployed backend by `curl`ing it before theorising about
  the code; `workers/README.md`'s "Google OAuth, specifically" has the one-line probe that
  separates "secret missing" from every other OAuth failure. Google sign-in was broken in
  production for exactly that reason until 2026-08-09. Note the failure mode of getting the
  directory wrong: run from the repo root instead of `workers/`, wrangler finds no config and
  reports `Required Worker name missing` **and** `no environment named "production"` — two errors
  that both read as "your config is wrong" when the config was simply never loaded.
- **A loopback `EXPO_PUBLIC_API_BASE_URL` is unreachable from a phone, and `--tunnel` does not
  change that** — it forwards Metro, never the Worker. This is the first thing to check on any
  `TypeError: Network request failed` from device testing; `.env.example` has the correct value per
  device type. Relatedly, an `authClient` call needs a real `try`/`catch`, not just an `{ error }`
  check: better-auth's `{ data, error }` contract only covers responses that arrived, so a
  transport failure rejects instead. `src/lib/apiErrors.ts` is where that distinction lives —
  `ApiError` means the server refused, `NetworkError` means nothing answered, and every screen
  `catch` goes through `describeError`.
- **better-auth's `isPending` is not "first load in flight", and never gate a render on it.** It is
  re-raised on every background session refetch while signed out — i.e. for exactly the users on the
  auth screens. Gating `src/app/_layout.tsx`'s `return null` on it unmounted the whole tree and wiped
  the half-typed sign-up form (2026-08-08). `src/lib/sessionGate.ts` holds the latch and the full
  explanation; read its header before touching that gate, and note it is splash sequencing, never an
  authorization signal.
- **Intake owns the runner's target; no other screen re-asks it.** Home reads it back from the
  saved intake and asks only for a plan length, and only when there is no race date to derive one
  from. Adding a race-distance or race-date control anywhere outside `/intake` recreates the
  "take the survey twice" bug the captain reported on 2026-08-15. The rule is code, not convention:
  `src/lib/planRequest.ts`.
- **The plan engine splits by tier, and the split is one line in `planEngine.ts`.** Captain's
  ruling, 2026-09-06: **Free is served entirely from the 40-plan deterministic library**
  (`src/lib/planLibrary/`, a port of `planning/research/plan-blueprint-examples.md`'s "V1
  deterministic template library"); paid tiers keep `planTemplates.ts` as the AI generator's
  skeleton. The library is **not** a fallback for the generator and **not** a parameter source for
  it — do not wire one into the other. Start at
  [`src/lib/planLibrary/index.ts`](src/lib/planLibrary/index.ts); `engine.ts` implements § 20's
  resolution order and cites the section behind every decision.
- **`planLibrary/openQuestions.ts` is the only place that may hold a coaching value the source
  document does not state.** Six such decisions live there, all six ruled by Ian on 2026-09-10 and
  written up in
  [`docs/reference/coaching/free-engine-open-questions.md`](docs/reference/coaching/free-engine-open-questions.md).
  If you need a coaching number that is not in the source document, in `loadRules.ts`, or in that
  file, **it does not exist yet — ask, don't pick one.** Adding a seventh constant there means
  adding a seventh question to that doc in the same commit.
- **Free requires a target race distance; a race date stays optional everywhere.** Ian's Q1 ruling
  (2026-09-10): the library is organised by distance, so a Free request naming none is refused with
  `invalid_request` (quota released, nothing charged) rather than defaulted onto a calendar or
  handed to `buildTemplatePlan`. The captain's 2026-08-15 "the race stage should be optional" report
  now governs the **paid** tiers only — see `workers/test/planEngine.test.ts`'s "no race named
  anywhere" suite, which pins both halves.
- **Recovery-week depth is 15–25%, not the library's own 35–45%.** Ian reversed that band on
  2026-09-06; `loadRules.ts`'s `DELOAD_REDUCTION_MIN`/`DELOAD_REDUCTION_MAX` are authoritative and
  `plan-blueprint-examples.md`'s three stale lines were corrected in place, annotated rather than
  silently overwritten. Coaching *source ports* under `docs/reference/coaching/source/` still carry
  the old figure — that is issue #101, the captain's own to-do, not yours to edit.
- **A rest week shortens the long run first, and `loadRules.ts` owns that band too.**
  `DELOAD_LONG_RUN_SHARE_MIN`/`_MAX` (§ 9's 60–70% of the preceding long run) and `deloadLongRun`
  are read by both engines — the library's `LONG_RUN_RECOVERY_SHARE` is a re-export, not a copy.
  On the skeleton, a rest week's easy runs are bounded by the *last loading week's* long run, not
  the rest week's own shortened one; bounding them by the shortened one makes a 3-day rest week
  fall below the band (captain's 2026-09-12 audit, `docs/change_log.md`). Both property suites —
  `planTemplates.deload.test.ts` and `planLibrary/__tests__/engine.recovery.test.ts` — pin every
  rest week on both engines; if one fails, read which invariant before touching either engine.
- **A declared injury's volume cut lands on the first loading week only, in both engines.** § 17:
  "Percentage reductions apply to the validated baseline once; they never stack." `planTemplates.ts`'s
  `applyInjuryVolumeAdjustment` and `planLibrary/engine.ts`'s week loop both gate the module cut
  (and, in the library, § 16's 90%) on the first non-`RECOVERY` week; later weeks ramp off that
  week's reduced volume through the growth cap. Re-applying it per week compounds it against
  `lastLoadingKm` (0.85 × 0.85 × …) — issue #106, which collapsed an injured Free plan to 29% of its
  healthy twin by week 12. That week is not always week 1: a `canonical + 1` duration (13-week 5K,
  15-week 10K, 17-week half, 25-week marathon) opens on a prepended rest week, and a cut gated on
  `index === 0` is spent there and never reaches a loading week. `engine.injury.test.ts` sweeps
  every module for both shapes, and `engine.recovery.test.ts` sweeps rest weeks for `H0` plus all
  seven `H1` modules (`lower_back` for the total band only until the captain rules on #119).
- **A race target is optional, and nothing may default one.** `buildTemplatePlan` carries
  `raceDistance?: RaceDistance` with no fallback; race week, the taper phase and the taper tail of
  the load curve are all gated on `isRacePlan`. Re-introducing a `?? '5k'` silently gives a
  general-fitness runner a race plan — see `src/lib/planTemplates.ts` and its `noRace` test suite.
  Two rules ride with it, both in that file and pinned by that suite: **a no-race plan never ends on
  a deload** (captain's coaching ruling, 2026-08-15 — the cadence yields for the final week only,
  and only when `isRacePlan` is false), and `raceDistance` is validated **whenever it is present on
  any goal type**, not only on `goalType: 'race'` — see `validateRequest` in
  `workers/src/lib/generate-plan-flow.ts`, since the client sends it with `duration` too.
- **The marathon absolute long-run ceiling yields only to a ceiling that can replace it.**
  `loadRules.ts`'s `maxSingleRunKm` lifts the level's km cap (≤25 / ≤35 km) for a marathon race
  plan only when the runner is `prepared` AND has an easy pace, because the 180-minute time cap it
  defers to needs a pace to exist. A runner with no recent time has no pace (and `advanced` never
  gets an easy pace), so for them the km cap plus the captain's 35% share cap are the whole bound —
  `planTemplates.noRecentTime.test.ts` is the ship-gate proof, including a mocked-away cap showing
  the assertion can fail. Do not pass `Infinity` in from a new caller without that context, and do
  not calibrate the marathon absolute number: it is still the captain's open ruling.
- **Readiness is derived from capacity, never ambition, and it reaches the plan.**
  `deriveReadinessPath` reads `weeklyKm` and (marathon) a ≥10K recent result — never
  `goalTimeSec` — and its verdict shapes phase weights, gates the ceiling above, sets
  `Plan.readinessPath`, and adds the first-timer / limited-preparation disclaimers whose numbers
  are the engine's own thresholds (`READINESS_WEEKLY_KM_THRESHOLD`, `FIRST_TIMER_MIN_WEEKS`).
  The coaching source for both is `planning/research/plan-blueprint-examples.md` (§ "The proposed
  selection model", § 4, § 8, § 9); it may be untracked in a worktree pending the captain's commit.
- **A race date that has already passed is refused, never generated against.** It would otherwise
  reach `weeksUntilRace`'s `Math.max(1, …)` floor and charge a quota slot for a one-week plan. Both
  screens refuse and both say why; the decision and both messages are pure and testable in
  `src/lib/planRequest.ts` (`isRaceDatePast`, `intakeRaceDateError`). Race day itself is still
  valid, and so is a blank date. Do not re-implement the comparison in a screen, and do not change
  the server floor — it is deliberate for other callers.
- **`keyboardType` restricts nothing — it only picks which keyboard is offered.** A hardware
  keyboard, paste, dictation or autofill puts letters into a "number" field (verified on device).
  Every numeric input goes through `src/components/inputs/`, which filters keystrokes via
  `src/lib/fieldInput.ts`; dates and times are segmented boxes with the `-`/`:` printed, never
  typed. Do not add a raw `<TextInput keyboardType="...">` for a numeric answer.
- **The design system is "Blueprint" — the captain's V22 theme sheet — and the accent is ink.**
  One near-black field (dark scheme only), ink `#EEF1F4` for headings, numbers and the primary
  button's fill, dim `#8B9299` for labels, and two session colours (easy `#4DB58C`, hard
  `#E0864E`) that touch bars and tiles only, never text or chrome. There is no cyan and no second
  highlight. Render the primary action through `src/components/ui/ActionButton.tsx`'s
  `PrimaryAction` / `RevealPrimaryAction` and never hand-roll it, so "one accent per screen" stays
  a question about imports. Fonts are Barlow Condensed / IBM Plex Mono / IBM Plex Sans. Values:
  the "Blueprint" section of
  [`docs/design/instrument-visual-system.md`](docs/design/instrument-visual-system.md); the
  Instrument text beneath it is superseded history, kept for its rules.
- **Contrast is enforced, not documented.** `src/constants/__tests__/theme.contrast.test.ts`
  recomputes every ratio in `theme.ts` from the hexes — both schemes, the accent, the session
  tones, the effort ramp — and asserts `progress.disabled`, which is deliberately *below* the
  floor, against a ceiling. Do not "fix" a failing below-floor assertion — read what it is for
  first. A new colour token fails the token count until it is given a floor on purpose.
- **The build animations are ports, not designs.** Every one (onboarding hero, the step pieces,
  the survey intro, the Home header mark, the My Plans hero) derives from a single clock in
  seconds through `src/lib/buildMotion.ts`, whose cue tables and easings are the approved V22
  pages' own numbers, and renders `src/lib/weekStrip.ts`'s strip. Timings never live in a
  component; reduced motion is the end frame (`useBuildClock` starts at the end); a build plays
  once and holds, and only the header mark may re-run, only when its data changes. Guide:
  [`docs/design/build-animations.md`](docs/design/build-animations.md). The design handoff (pages,
  scene sources, `V22 theme.md`) is read-only reference on the captain's USB, not in the repo.
- **AI output validation is structural, not strict-content.** `ai-feature-builder` and
  `prompt-engineer` follow [`docs/reference/plan-generation.md`](docs/reference/plan-generation.md):
  validate shape, retry once, fall back to a template.
- **The heartbeat/pulse-trace and graph motifs are retired app-wide (2026-09-14, spec §V22-06),
  and the week strip is the app's one drawing.** `PulseTraceHero`, `RouteLine`, the accordion's
  effort ribbon and their libs are deleted; do not reintroduce a waveform, a contour line or a
  chart as ornament. A strip is `WeekStrip` (animated), `StaticWeekStrip`, `MiniWeekStrip` or
  `HeaderMark` — the same drawing at four sizes — and days under it are `01 … 07`, never Mon–Sun,
  even where an approved page prints MON…SUN.
- **The progression suite's 22,000-plan baseline mask is a gate, not a fixture — never regenerate
  it.** `src/lib/__tests__/planTemplates.progression.test.ts` encodes the exact *membership* of the
  known offender set as a base64 mask, so a change may remove offenders but never add one.
  Re-encoding the mask to make a failure go away silently destroys the only guard that a
  plan-shape change did not regress a different profile; read the failing case list instead. The
  invariant it encodes is the captain's #103 ruling (2026-09-19): **the peak phase's highest
  loading week is never below the base phase's** — a peak under a mid-build loading spike is
  tolerated only when the plan carries `buildSpikeDisclosure`, emitted only when that spike is the
  plan's highest loading week (a base high above it makes the plan an offender, not a tolerated
  shape, and it says nothing), which the same suite asserts for every swept plan (32 such plans,
  pinned as a ceiling). The 348 residual offenders it pins fall
  in two named families (`REMAINING_OFFENDER_FAMILIES`: beginner three-day 5K plans; the golden
  12-week/4-day 5K path at ≥50 km/week) whose remedies are coaching or safety numbers awaiting
  the captain (`docs/mvp-progress.md` → Blocked) — not a bug to fix in passing. History: encoded
  the stricter peak-below-any-pre-peak-week comparison until 2026-09-19 (770 → 758 on the
  2026-09-16 `golden-cadence3-route` ruling, 458 → 348 under the base-high rule with the taper
  alignment and held long-run curves) — `docs/change_log.md` 2026-09-09, 2026-09-16, 2026-09-19.
- **The coach-authored golden 5K path serves only a runner whose recovery cadence lands on its
  authored dips.** `FIVE_K_WEEKLY_LOAD` dips at weeks 4 and 8, so `buildTemplatePlan` admits a
  12-week / 4-day / 5K race intake to `buildCanonicalFiveKWeek` only on the 4-week cadence or the
  50+ ruling's 4/8/12; the under-50 advanced runner's 3-week cadence goes to `buildGenericWeek`,
  keeping 3/6/9 (captain's `golden-cadence3-route` ruling, option A, 2026-09-16 — audit §1.3, where
  those flagged weeks had gone *up* 14–51%). Do not re-admit that cadence, and do not author a
  week-3/6/9 recovery for the curve: the coach never wrote one. Race week 12 stays flagged
  `isDeload` for 50+ (2026-08-06) and is excluded from the band property, not un-flagged.
  `planTemplates.goldenDeload.test.ts` pins every flagged week of all eight golden-shape profiles.
- **Docs are part of the change.** After a behavior-changing commit, `doc-writer` updates
  `docs/mvp-progress.md`, `docs/change_log.md`, and `docs/architecture.md`.
- **Coaching content is never invented.** `docs/reference/coaching/` is a port of Ian's
  McMillan-based library. No agent changes a training rule, formula, or clinical claim without him.

## Maintaining this file

Keep this file limited to durable routing and guardrail rules useful to almost every future
session. Do not repeat what the codebase already shows; point to the authoritative file or
command instead. Prefer rewriting or pruning existing entries over appending new ones, and update
or remove stale guidance when the project changes.
