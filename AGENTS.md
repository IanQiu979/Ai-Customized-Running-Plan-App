# AGENTS.md — which agent does the work

Imported by [`CLAUDE.md`](CLAUDE.md), which holds the project's facts, commands, and rules. This
file holds only routing: who to dispatch, in what order. On conflict, CLAUDE.md wins.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

This project is pinned to Expo SDK 54 (`expo ~54.0.0`, 54.0.35 installed). Docs for a newer SDK
describe APIs this project does not have. If you upgrade the SDK, update this link in the same
commit.

## Routing rules

1. **Always dispatch a subagent. Size the chain, not the decision.** File count is not the
   measure — blast radius is. A one-liner can be big; a hundred-line rename is small.
   - **Small** — one behavior, no new dependency/route/table, nothing from rule 2:
     **builder → `verifier`.** The builder just makes the edit. No planner, no review, no docs.
   - **Big** — multi-step, new surface area, or anything from rule 2, *even a one-file edit*:
     **the full chain** (rule 3). Never shortcut it because the diff looks small.
2. **Always big, whatever the diff size:** auth, RLS, schema, payments, secrets or env, edge
   functions, plan generation, adding a dependency. These also branch + PR, not a direct commit.
3. **Full chain:** plan → build → `verifier` → `code-reviewer` → `doc-writer` → `github-ops`.
   `verifier` runs in *both* chains and is never skipped.
4. **Unsure which size it is?** Treat it as big, or ask `task-router` — it returns an ordered
   plan and does no work itself.
5. **Read-only agents report, never fix.** Pair each with its builder: `bug-planner`→`debugger`,
   `accessibility-reviewer`→`accessibility-implementer`, `profiler`→`mobile-perf-optimizer`,
   `migration-planner`→`framework-upgrader`, `test-strategist`→`test-writer`,
   `market-research`→`product-strategist`, `threat-modeler`→`security-auditor`.
6. **Parallel only when tasks share no files.** Otherwise run them in sequence.
7. `verifier` = `npm run typecheck && npm run lint && npm test`. Required before every commit.
8. All git/GitHub actions go through `github-ops` — never a raw `git push` (CLAUDE.md → Git etiquette).

## Task → chain

Chains below assume a **big** edit. If it's small (rule 1), collapse to builder → `verifier`.

| You're asked to… | Dispatch |
|---|---|
| Add a feature | `feature-planner` → `implementer` → `test-writer` → `verifier` → `code-reviewer` |
| Fix a described bug (root cause known) | `debugger` → `verifier` |
| Chase a vague symptom | `bug-planner` → `debugger` → `verifier` |
| Touch DB schema, migrations, or RLS | `database-engineer` → `security-auditor` → `verifier` |
| Anything Supabase **auth** (OAuth, PKCE, redirects) | `supabase-auth` |
| Write or deploy an edge function | `api-designer` → `jobs-queues-edge` → `security-auditor` |
| Build the `generate-plan` AI flow | `prompt-engineer` → `ai-feature-builder` → `llm-eval` |
| Design a screen | `ui-designer` → `frontend-builder` → `accessibility-reviewer` |
| Add or change theme tokens | `design-system` (never hardcode — CLAUDE.md → Code conventions) |
| Touch `.env`, secrets, or edge-function env | `env-config-manager` |
| Ship to TestFlight / stores | `release-versioning` → `mobile-release` |
| Bump Expo SDK or a major dep | `migration-planner` → `framework-upgrader` → `verifier` |
| Clean up working code, no behavior change | `refactorer` → `verifier` |
| Commit, PR, issue, branch cleanup | `github-ops` |
| Understand an unfamiliar area | `Explore` (cheap) or `codebase-explorer` (deep map) |

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

- **No business rules in the client.** Tier, quota, and plan generation are edge-function work —
  `jobs-queues-edge`, not `frontend-builder`.
- **`ANTHROPIC_API_KEY` never leaves the server.** Any agent touching env goes through
  `env-config-manager`; `EXPO_PUBLIC_*` is plain text in the bundle.
- **AI output validation is structural, not strict-content.** `ai-feature-builder` and
  `prompt-engineer` follow [`docs/reference/plan-generation.md`](docs/reference/plan-generation.md):
  validate shape, retry once, fall back to a template.
- **Docs are part of the change.** After a behavior-changing commit, `doc-writer` updates
  `docs/change_log.md`, `docs/status.md`, and `docs/architecture.md`.
