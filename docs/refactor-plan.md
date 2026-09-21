---
title: "Behavior-preserving codebase refactor"
description: "Separate combat mechanics, service assembly, presentation, and database test setup with explicit regression gates."
status: completed
priority: P1
effort: 8h
branch: main
tags: [refactor, backend, database, tech-debt]
created: 2026-09-21
---

# Refactor plan

## Scope and acceptance contract

Review the whole application, then change coherent areas with demonstrated duplication or mixed responsibilities. Preserve command names/options, public module exports, result discriminants, Vietnamese text, combat mathematics and seeded RNG order, transaction/locking boundaries, event timing, database schemas, migrations, seed data, package versions, and runtime configuration. One explicit behavior correction: inventory page buttons currently parse the wrong custom-ID segments.

Planning evidence was inspected directly on `main` before implementation. Line citations below describe the pre-refactor baseline; new module paths now reflect the implementation. No repository `AGENTS.md` or `docs/development-rules.md` was found. The assigned review artifact is this file; there are no separate phase plan files.

## Existing data flow and lifetimes

1. Bootstrap registers commands, subscribes domain events, and starts Discord in `src/index.ts:18`. Incoming interactions first enter the menu router, then autocomplete or slash dispatch in `src/core/DiscordBot.ts:46`. Command instances are registered in `src/core/registerAllCommands.ts:34` and retained by the singleton map in `src/core/CommandRegistry.ts:13`.
2. Commands/menu translate interaction data into service requests. Services retain repository collaborators and the shared event bus, for example `src/services/RaidService.ts:62`, `src/services/DuelService.ts:70`, and `src/services/RankedService.ts:70`. These objects can serve many users; introduce no request-specific mutable fields.
3. Production uses one PostgreSQL pool and database executor in `src/db/client.ts:13`. Repository methods accept either the database or an existing transaction via the executor type at `src/db/client.ts:22`; account lookup delegates to the supplied executor in `src/repositories/PlayerAccountRepository.ts:17`.
4. Raid begins one transaction at `src/services/RaidService.ts:77`, locks bag then character, reads the account, validates receipts/day/entry conditions, assembles stats, resolves battle, grants rewards, applies optional atomic progress, and records the receipt. Reward persistence is delegated to `src/repositories/RaidRewardRepository.ts:33`. Progress runs inside the transaction at `src/services/RaidService.ts:186`; events emit after commit at `src/services/RaidService.ts:209`. Subscribers skip already-applied progression at `src/core/subscribeDomainEvents.ts:36` and `src/core/subscribeDomainEvents.ts:41`.
5. Stat assembly reads equipment, pantheon, and runes using the caller's executor in `src/services/StatAssemblyService.ts:84`, then returns numeric stats plus effect descriptions. Raid, duel, and ranked each translate those results into mutable combatants and ordered strategy decorators.
6. Combat constructs RNG, log arrays, and a debuff identity set per invocation in `src/domain/combat/BattleEngine.ts:81`. Base class strategies are process-shared instances in `src/domain/combat/ClassStrategyRegistry.ts:17`; wrapper and combatant state must stay battle-local. No new mutable state belongs on the registry strategies.
7. Menu reads/builds panels in `src/menu/MenuGameplayService.ts:42` and mutates gameplay through actions at `src/menu/MenuGameplayService.ts:195`. Extract only formatting; retain query and action orchestration in the service.
8. Tests construct a separate in-memory PGlite database inside each test module's mock. Production database exports must never be imported at runtime by the shared test helper.

## Phases, ownership, and dependency graph

All paths below are relative to `D:/Data/Downloads/credd-bot-ts/`. Each implementation owner is exclusive; any scope extension requires reassignment before edits.

| Phase | Owner and files | Dependencies | Effort | Observable completion |
|---|---|---|---|---|
| A. Record baseline | Integration lead; no production edits | None | 0.5h | Existing lint, typecheck, full tests, and build results recorded; failed baseline distinguished from new failures |
| B. Shared database fixtures | Fixture worker: six integration suites listed below; new `tests/helpers/database.ts` | A | 1h | All six use one reusable factory/migration loader while retaining isolated clients, seeds, and teardown |
| C. Service combat assembly | Service worker: `src/db/client.ts`, `src/services/RaidService.ts`, `src/services/DuelService.ts`, `src/services/RankedService.ts`, `src/services/PvpShopService.ts`; new `src/services/combatantFactory.ts`, `tests/combatant-factory.test.ts` | A | 1.5h | Three gameplay services share pure assembly functions; nested transaction aliases centralized; public behavior unchanged |
| D. Presentation separation | Presentation worker: `src/menu/MenuGameplayService.ts`, `src/commands/rpg/InventoryCommand.ts`, `tests/inventory-pager.test.ts`; new `src/menu/gameplayPanels.ts`, `src/render/InventoryPager.ts`, `tests/gameplay-panels.test.ts` | A | 2h | Pure menu rendering extracted; inventory command consumes shared renderer/protocol; real page navigation regression passes |
| E. Combat responsibilities | Integration lead: `src/domain/combat/BattleEngine.ts`; new `src/domain/combat/BattleAttack.ts`, `src/domain/combat/CombatStatusEffects.ts`, `src/domain/combat/combatRules.ts`, `tests/combat-characterization.test.ts`, and `tests/__snapshots__/combat-characterization.test.ts.snap` | A and pre-edit characterization | 2h | Seeded full-result characterization unchanged; engine retains orchestration; attack/status mechanics have clear boundaries |
| F. Integration review | Integration lead; this plan's completion evidence, no unassigned production changes | B, C, D, E | 1h | Complete lint/typecheck/tests/build pass and no schema/dependency/public-interface drift |

After A, B/C/D/E may run concurrently because file ownership does not overlap. E cannot start production edits until its characterization cases pass against the old engine. B owns integration test fixture edits even when those suites validate C or E. Each other owner creates separate focused tests. F waits for every branch of the graph.

## B. Database fixture design

Create an asynchronous factory that returns the same mocked database, pool teardown adapter, and PGlite handle each suite currently expects. Call that factory from each hoisted mock through a dynamic import. The helper contains no module-level database singleton. Load ordered migration SQL from the checked-in migration journal, using URLs relative to the helper, not the process working directory. Leave suite-specific seed inserts and event subscription wiring in the suites. Close each client exactly once in its existing teardown.

All six callers are enumerated: `tests/gameplay.test.ts:7`, `tests/m7.test.ts:7`, `tests/menu-gameplay.test.ts:6`, `tests/quest-refresh.test.ts:7`, `tests/ranked-draw.test.ts:7`, and `tests/reset.test.ts:7`. Five currently apply only migration 0000 (`tests/gameplay.test.ts:47`, `tests/m7.test.ts:47`, `tests/quest-refresh.test.ts:30`, `tests/ranked-draw.test.ts:28`, `tests/reset.test.ts:22`); menu already loads the full journal at `tests/menu-gameplay.test.ts:41`. Applying the full journal everywhere intentionally improves schema fidelity without changing production migrations. Keep timeout allowances at the suite level.

## C. Service design and exact caller inventory

Use pure functions receiving identity/class and already-assembled stats. Return a fresh combatant and ordered strategy decorators; preserve shared stateless base strategies. The helper performs no database I/O, randomness, events, logging, or transaction creation. It must not import service classes at runtime merely to obtain their types.

Combatant construction sites: `src/services/RaidService.ts:114`, `src/services/DuelService.ts:265`, `src/services/RankedService.ts:122`, and `src/services/RankedService.ts:130`. Decorator composition sites: `src/services/RaidService.ts:124`, `src/services/DuelService.ts:273`, and `src/services/RankedService.ts:465`; the ranked wrapper is called twice at `src/services/RankedService.ts:140` and `src/services/RankedService.ts:141`. Preserve class → runes → blessings composition. Preserve monster construction in the raid service.

Add a transaction type alias beside the existing executor type at `src/db/client.ts:22`; retain both existing runtime exports and executor compatibility. There are 17 service annotations to replace. First ten: `src/services/DuelService.ts:114`, `:131`, `:202`, `:214`, `:238`, `:254`, `:281`, `:297`, `:359`, and `src/services/RaidService.ts:229`. Remaining seven: raid `:250`, `:266`; ranked `:331`, `:411`, `:436`, `:453`; PvP shop `:117`. Re-grep at implementation time because earlier edits move line numbers.

## D. Presentation design and explicit correction

Extract menu panel formatting from `src/menu/MenuGameplayService.ts:42`, battle log pagination from `src/menu/MenuGameplayService.ts:310`, and battle summary formatting from `src/menu/MenuGameplayService.ts:327`. Inputs are loaded data, session view state, and action/button descriptions; outputs remain existing panel objects. Keep queries, notices, progression, request IDs, and action mutations in the original service. Do not touch menu router authorization, revision checks, or receipt logic.

Inventory currently creates IDs with the page prefix at `src/commands/rpg/InventoryCommand.ts:46` and page constructor at `src/commands/rpg/InventoryCommand.ts:48`, but reads only three segments at `src/commands/rpg/InventoryCommand.ts:152`. Thus `inventory:page:runes:2` is misread as category `page`, page text `runes`. Put ID construction/parsing and rendering in the proposed pager module. Validate category and finite integer page values, clamp valid page requests to available pages, and preserve emitted ID strings. Old rendered buttons then continue working during deployment. Replace copied helper implementations in `tests/inventory-pager.test.ts:12` with imports from production code, plus a mocked actual collector/navigation path.

## E. Combat extraction invariants

Keep the existing exports and method signature at `src/domain/combat/BattleEngine.ts:21`, `:24`, `:33`, `:44`, `:48`, and `:81`; re-export moved public constants/functions if necessary. Internal attack/status helpers may take existing context and explicit collaborators; no generic combat plugin framework.

Preserve the exact control flow: both round-start hooks run at `src/domain/combat/BattleEngine.ts:131`; the fresh-debuff baseline is captured afterward; initiative consumes RNG in `src/domain/combat/BattleEngine.ts:157`; each turn removes immune effects, checks disablement, and attacks in `src/domain/combat/BattleEngine.ts:200`; immediate extra attacks stay in `src/domain/combat/BattleEngine.ts:233`. End-of-round processing short-circuits on death at `src/domain/combat/BattleEngine.ts:148`. Status ticking receives the same debuff object identities at `src/domain/combat/BattleEngine.ts:366`. Preserve roll suppression, RNG consumption count, hook order, log strings/order, rounding, sudden-death multiplier, HP snapshots, and result round counting exactly.

Before edits, capture deterministic full results for all five classes, a monster strategy, rune/blessing combinations, status application/expiry, sudden death, and a draw. Assert input combatant mutations as well as returned logs/results where relevant. A fixture generated after refactoring cannot prove compatibility and is not accepted as the baseline.

## Per-phase failure modes and rollback

Likelihood and impact use Low/Medium/High; High impact requires explicit mitigation even when likelihood is low.

| Phase | Likelihood × impact | Failure mode | Mitigation and rollback |
|---|---|---|---|
| A | Medium × High | A failing baseline is mistaken for a regression, or tests contact production | Record commands/results before edits; preserve isolated mock environment; never run seed/migrate/deploy/reset scripts. No code rollback needed |
| B | Medium × High | Shared database leaks across suites; mock hoisting imports production pool; migration order/paths break | Per-call PGlite factory, dynamic mock import, journal order, suite seeds, explicit teardown, all six suites pass together. Revert helper and its six caller edits as one unit |
| C | Medium × High | Wrapper order or state reuse changes outcomes; a transaction is accidentally replaced with the shared database | Pure helper, explicit same transaction, unchanged seed call sites and constructor signatures; state-isolation/equivalence tests. Revert factory plus service calls and type-only alias edits together |
| D | Medium × Medium | Text/button output changes; collector stops acknowledging interactions; wrong user can navigate | Preserve panel outputs/IDs/owner filters, production parser tests, actual navigation/invalid-input tests. Revert renderer extraction and command changes together; preserve a separately reviewable pager bug fix if reverting unrelated rendering |
| E | High × High | RNG/hook order or debuff identity changes silently affect rewards/combat | Require pre-edit characterization; preserve context lifetime; compare exact results and focused edge cases. Revert engine extraction and new helper files as one unit; C can continue using unchanged public engine exports |
| F | Medium × High | Individually passing phases fail together or emitted ESM imports break | Whole suite + lint + typecheck + production build/import check after merge; inspect diff for unintended files. Revert the failing coherent phase, rerun combined checks; no database rollback required |

## Test matrix and release gate

| Layer | Required evidence |
|---|---|
| Unit | Factory value equivalence and independent mutable battle state; real inventory protocol round trips and rejected malformed IDs; pure menu panel text/buttons; exact seeded combat characterization and status/extra-attack/death order |
| Integration | Existing gameplay, M7, menu gameplay, quest-refresh, ranked-draw, and reset suites pass against separate databases with the full migration journal; retain rollback, duplicate request, daily boundary, and progression assertions |
| Discord interaction | Existing menu/router/command suites pass; inventory collector uses the real parser and navigates to the expected repository category/page; owner restriction, stale/deleted response and error handling retain behavior |
| Build/static | Run package scripts `lint:check`, `typecheck`, `test`, and `build` from `package.json:20`, `:24`, `:23`, and `:10`; use existing installed tooling. Build includes emitted import verification |
| Live environment | No live Discord or production database execution is required for refactor validation. Do not claim live end-to-end coverage from mocks or PGlite; PostgreSQL concurrency/row-lock equivalence is preserved structurally, not proven by in-memory tests |

- [x] Baseline and final commands, pass/fail counts, and material limitations recorded.
- [x] Six integration suites share the factory without sharing database state.
- [x] Three combat services share assembly with unchanged transactions and event timing.
- [x] Inventory page 2 navigation actually reaches category `runes`, page 2.
- [x] Menu panel output retains content, disabled state, action IDs, and ordering.
- [x] Engine fixture outcomes, logs, HP, and side mutations match the old implementation.
- [x] Public exports, command definitions, schema/migrations/seeds, dependency lockfile, and config remain compatible.
- [x] All assigned files reviewed; no overlapping ownership or unrelated rewrites.

## Completion evidence — 2026-09-21

Completed: 6/6 phases, 8/8 acceptance items. No implementation blocker. Integration review reported no production defects; the missing direct panel assertions identified during review were added and passed before final validation.

| Phase | Status | Verified evidence |
|---|---|---|
| A | Completed | Pre-edit baseline: 163/163 tests in 22 suites; lint and strict source typecheck passed; clean build and import guard passed for 171 emitted modules |
| B | Completed | All six integration suites use `tests/helpers/database.ts`; 50 focused tests passed with independent PGlite clients and complete journal migrations |
| C | Completed | Raid, duel, ranked share the pure factory; 8 focused tests passed; existing transaction and event boundaries preserved |
| D | Completed | `gameplayPanels.ts` and `src/render/InventoryPager.ts` extracted; 35 focused presentation tests passed, including direct panel assertions and real runes page 2 navigation |
| E | Completed | 276 seeded full battle traces captured before edits match after extraction, including logs, HP, and input mutations |
| F | Completed | Final full run: 198/198 tests in 25/25 files, 0 failed/skipped/todo, 27.27s; source lint and strict typecheck passed; standalone strict typechecks passed for four new test files and the database helper; clean build loaded 177 emitted modules successfully |

Commands used installed tools directly through Node:

```text
node node_modules/eslint/bin/eslint.js src
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/vitest/vitest.mjs run --maxWorkers=2
node node_modules/typescript/bin/tsc -p tsconfig.json
node scripts/check-dist-imports.mjs
```

Baseline used the same source checks/build commands and `vitest run` without the final worker limit: 163 tests, 22 suites, 102.16s. Both builds started from a cleaned, verified workspace `dist` directory. Test durations are execution records, not a performance comparison; the worker limit changed. Validation used dummy environment values and a nonexistent dotenv path, with no live Discord or production database connection.

All 28 command JSON definitions are byte-for-byte identical to baseline (19,657 bytes). Protected diffs are empty for schema, migrations, seeds, `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`. Public module exports were reviewed; production import verification passed. Local validation artifacts: `.tools/final-validation-tests.json`, `.tools/commands-after-refactor.json`. No commit, deployment, or database migration was performed.

Scope adjustments: final helper names were aligned with repository organization; direct pure-panel tests closed a review coverage gap; database tests now consistently apply the full existing migration journal as planned. The inventory parser correction remains the only intended behavior change. README and menu documentation describe the resulting boundaries. No dependency or production schema change was needed.

Tooling deviation: pnpm's default `verify-deps-before-run=install` path encountered a `workspacePackagePatterns` mismatch. Direct Node execution completed every gate without reinstalling dependencies. Optional local workaround: `pnpm_config_verify_deps_before_run=warn`. This is a tooling issue, not an unresolved implementation blocker.

| Risk | Current disposition | Owner / next action / done criteria |
|---|---|---|
| Fixture isolation, combat drift, panel/protocol regression, combined build failure | Refactor validation gates passed; focused tests, old-engine traces, review, and full suite provide evidence | Integration lead: implementation and validation complete; no remaining plan action |
| PostgreSQL row-lock/concurrency behavior and live Discord operation | Residual validation limit; transaction structure preserved, no live or staging validation performed | Release owner: run any environment-specific release checks required by the release process; done when those checks pass |
| Coverage percentage | Unmeasured: V8/Istanbul provider unavailable; dependencies were not installed | No percentage claimed; test counts and assertions are the recorded evidence |

All phase statuses and acceptance checkboxes were reconciled in this file; no separate phase files or unresolved task mappings exist.

## Compatibility, migration, and deferred scope

Existing databases and users require no migration. Reuse existing service constructor defaults/result shapes and module paths. Keep generated inventory IDs compatible with active messages. Rolling back code cannot require reverting database data or stored menu receipts. Test migrations improve test coverage only.

Keep runtime recovery timers and scheduling unchanged: casino recovery currently guards overlap and runs immediately at readiness (`src/core/DiscordBot.ts:29`); duel/ranked sweeps run on an interval at `src/core/Scheduler.ts:18`. Adding lifecycle stop/overlap behavior changes operational semantics and belongs in a separately characterized batch. Defer calendar deduplication at `src/config/ranked.ts:67` and `src/utils/dailyCycle.ts:16`; it provides less value than the selected changes and affects reset boundaries. Preserve repository query implementations, balance formulas, and transactional settlement rather than mechanically splitting every large file.

## Unresolved questions

None. Whole-codebase review does not require edits to every file, and passing tests does not justify a zero-defect guarantee.
