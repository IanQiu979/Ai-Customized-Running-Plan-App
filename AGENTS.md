# AGENTS.md — which agent does the work

Imported by [`CLAUDE.md`](CLAUDE.md), which holds the project's facts, commands, and rules. This
file holds only routing: who to dispatch, in what order. On conflict, CLAUDE.md wins.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

This project is pinned to Expo SDK 54 (`expo ~54.0.0`, 54.0.35 installed). Docs for a newer SDK
describe APIs this project does not have. If you upgrade the SDK, update this link in the same
commit.

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
| **Docs** | `doc-writer` `diagram-generator` |
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
- **`ANTHROPIC_API_KEY` never leaves the server.** Any agent touching env goes through
  `env-config-manager`. Two committed-file traps, not one: `EXPO_PUBLIC_*` is plain text in the app
  bundle, and `workers/wrangler.toml` is committed — secrets go in `workers/.dev.vars` (gitignored)
  and `wrangler secret put`.
- **Never run `wrangler login`, `wrangler deploy`, `wrangler d1 create`, or `wrangler secret put`.**
  Those need the captain's own Cloudflare account. Everything is verifiable offline against
  `wrangler dev`'s local emulation.
- **A loopback `EXPO_PUBLIC_API_BASE_URL` is unreachable from a phone, and `--tunnel` does not
  change that** — it forwards Metro, never the Worker. This is the first thing to check on any
  `TypeError: Network request failed` from device testing; `.env.example` has the correct value per
  device type. Relatedly, an `authClient` call needs a real `try`/`catch`, not just an `{ error }`
  check: better-auth's `{ data, error }` contract only covers responses that arrived, so a
  transport failure rejects instead. `src/lib/apiErrors.ts` is where that distinction lives —
  `ApiError` means the server refused, `NetworkError` means nothing answered, and every screen
  `catch` goes through `describeError`.
- **AI output validation is structural, not strict-content.** `ai-feature-builder` and
  `prompt-engineer` follow [`docs/reference/plan-generation.md`](docs/reference/plan-generation.md):
  validate shape, retry once, fall back to a template.
- **Docs are part of the change.** After a behavior-changing commit, `doc-writer` updates
  `docs/mvp-progress.md`, `docs/change_log.md`, and `docs/architecture.md`.
- **Coaching content is never invented.** `docs/reference/coaching/` is a port of Ian's
  McMillan-based library. No agent changes a training rule, formula, or clinical claim without him.

## Maintaining this file

Keep this file limited to durable routing and guardrail rules useful to almost every future
session. Do not repeat what the codebase already shows; point to the authoritative file or
command instead. Prefer rewriting or pruning existing entries over appending new ones, and update
or remove stale guidance when the project changes.
