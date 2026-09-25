---
title: OOP and SOLID application architecture
status: complete
created: 2026-09-21
---

# OOP and SOLID refactor

## Implemented architecture

The first behavior-preserving refactor established 198 tests in 25 files. This second pass applies constructor injection across the application while preserving gameplay, database structures, command protocols and transaction boundaries.

- `src/application/createApplicationServices.ts` builds the application graph shared by commands, menu, event observers and maintenance. Production bootstrap passes that graph explicitly. Construction starts no jobs or database queries.
- `PersistenceContext` exposes an executor and `IUnitOfWork`; `DrizzleUnitOfWork` delegates the original callback directly to Drizzle. Transaction handles remain scoped to the caller's operation.
- The 22 existing use-case service classes and `GameplayProgressCoordinator` use narrow structural collaborator contracts (`Pick` of required methods), injected persistence and named repository operations.
- SQL resides in repositories or database entry points. Feature query repositories preserve the original filters, writes and locking order. Health checks, inventory queries and gear-ID collision queries also have repository boundaries.
- `DeityService`, `MonsterEncounterService`, `RaidRewardService`, `LootGrantService` and `InventoryService` own calculation, selection and projection behavior previously mixed into repositories.
- `BattleEngine` composes `IBattleAttackResolver` and `ICombatStatusEffects`; player combatants and their decorated strategies are created by `PlayerCombatantFactory`. Per-battle mutations and RNG remain local.
- `BotMaintenance` and `Scheduler` own their timers with explicit start/stop methods. Casino recovery retains overlap protection and the existing 15/30/60-second schedules.

## Patterns and SOLID boundaries

| Pattern / principle          | Application                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Command                      | Discord adapters implement `ICommand` and call injected use cases.                                      |
| Repository / Unit of Work    | Named SQL operations and explicit transaction boundaries.                                               |
| Strategy / Decorator         | Combat class policies, rune and deity modifiers; casino strategies.                                     |
| Factory / composition        | One application graph; fresh combatants and strategies for each battle.                                 |
| Observer                     | Event publication after commit; atomic progression flags suppress duplicate observers.                  |
| Single responsibility        | Transport, orchestration, policies, persistence and lifecycle have separate owners.                     |
| Open/closed and substitution | Strategy interfaces and structural ports permit alternate implementations.                              |
| Interface segregation        | Consumers request only methods they use.                                                                |
| Dependency inversion         | Use cases accept collaborators and persistence contracts rather than accessing a global DB in handlers. |

Pure arithmetic helpers, immutable configuration and text formatting remain functions/data.

## Required persistence + AppError (2026-09-25)

- `PersistenceContext` is now **required**: every service takes it via constructor
  (`requirePersistence()` in `shared/kernel/persistence.ts` throws
  `DI_MISSING_PERSISTENCE` when missing). The deprecated global
  `defaultPersistence` is **removed** — the composition root
  (`app/container.ts`) and entry points create their context explicitly via
  `createLivePersistence()`. Repositories take a required
  executor; `Scheduler`/`BotMaintenance`/`DiscordBot`/all commands take required
  collaborators. Tests inject `tests/helpers/persistence.ts:testPersistence()`
  (PGlite mock); an architecture test bans any import of the removed global.
- All service error channels are `AppError` with stable codes
  (`DI_*`, `*_MISSING_BAG`, …); `CommandRegistry.dispatch` maps `AppError` to
  the user message, unknown errors to `GENERIC_ERROR`. Pure validation utils
  (`progressBar`, `weightedRandom`) keep native `RangeError`; CLI scripts keep
  `Error`. `Clock` is injected everywhere time matters (`BattleEngine` seeds
  from crypto instead of `Date.now()`); `DrizzleUnitOfWork` retries
  `40P01/40001` with backoff. SRP extractions: `RaidGatePolicy`,
  `RankedRatingService`, `QuestTemplatePicker`, `MenuActionRouter`.
- Full suite: **477 passed / 7 skipped** (postgres-concurrency needs live PG);
  typecheck + lint + text-boundaries + dist import check pass.

## No-singleton + Result envelope + menu split (2026-09-25)

- `EventBus.getInstance` / `CommandRegistry.getInstance` deleted (no static
  singletons left). `registerAllCommands`, `DiscordBot`, `subscribeDomainEvents`,
  `Scheduler`, `BotMaintenance`, `HealthService`, `PingCommand` and all 22
  presentation commands take required collaborators; `deployCommands` builds an
  explicit registry. Tests assert `'getInstance' in X === false`.
- All 17 string-returning application methods now return
  `Result<string, AppError>` (`LootService` 3, `QuestService` 3, `CosmeticService`
  4, `PvpShopService.buy`, `LoadoutService` 2, `RankedService.stats`,
  `SocketService.unlock`, `ClassChangeService.change`); commands reply with
  `value`/`error.message` (user-visible text unchanged); tests unwrap via
  `tests/helpers/result.ts:textOf`. Remaining returns are kernel `Result`,
  `{status}` domain unions, or presentation text — no bare error strings.
- `MenuGameplayService` (~345 → ~190 lines) is a facade over `MenuGatePanels`
  (pure gate render), `MenuActionRouter` (stateless routing + pager math) and
  `MenuBattleFlow` (daily/confirm/fight flows).

## PvE battle overhaul (2026-09-25)

- Damage v2 (`DamageCalculator`/`BattleAttack`): mitigation `DEF/(DEF+600)`
  capped 75%, additive armor-pen capped 60%, per-skill variance windows,
  crit ×2.0 unchanged; `OutgoingHit.varianceRange`, `ResolvedHit.missed`.
- Blood-moon pacing (`combatRules`): rounds 31–40 deal +10%/round (cap ×2.0)
  and drain 2% max HP from both sides instead of ×2^(round−30).
- New stats (`CombatantState`/`StatAssembly`/`classes.ts`): SPD (deterministic
  first strike, ties roll bias), ACC/EVA (95% +1%/pt clamped 80–100% via
  `rollHit`), TEN (flat shrug chance vs stun/paralyze/dizzy via `applyDebuff`
  choke point); mob secondaries derived in `MonsterEncounterService` (no migration).
- Class reworks (auto-battle compatible): Swordsman hemorrhage detonate,
  conditional Fighter Bash + execution + stun-ward, Mage spellweave consume,
  Knight Bulwark + Second Wind, alternating Archer aimed shots.
- Monster AI (`MonsterStrategy`): round rotation, telegraphed heavies,
  4 flavor skills implemented, elite affix pool, Bakunawa 3 phases with DOT
  shed + devour cycle; `slow` tag, venom cap 25%, conditional cleanses.
- Runes/deity (P8): pen cap respected, 8%/round heal budget (`cappedHeal`),
  2-per-battle immunity budget, blessings from all pantheon slots weighted
  1/0.5/0.25 with max-merge, new swiftness/eagle-eye/frost runes (+ seeds).
- Encounter retune (glass-cannon mobs, steep early difficulty slope) keeps
  portal-balance green; characterization snapshots re-baselined after review.
- Full suite: **477 passed / 7 skipped** (+21 new exploit-guard tests);
  typecheck + lint + text-boundaries + dist import check pass; 7-test
  multi-connection Postgres suite verified green against a live database.

## Compatibility

Original positional constructor arguments remain supported with optional trailing dependency options. The unused InventoryRepository, DeityRepository, MonsterRepository and RaidRewardRepository aliases were removed on 2026-09-23; tests now import the policy services directly. LootService still honors legacy injected rune/gear methods, with explicit grant overrides taking precedence.

Zero-argument registration uses the legacy shared EventBus and lazy menuRouter, matching zero-argument observer/bot setup. Explicit application graphs use independent buses and menu stores. Unused functional delegates for gameplay progress, battle attacks and combat status effects were also removed on 2026-09-23; active callers use the corresponding classes.

## Verification

- Implementation complete: persistence contracts, service/query separation, command injection, composition, combat policies and lifecycle ownership.
- Review compared 183 extracted query chains (84 account/progression and 99 battle/economy) against the original AST; Reset SQL was checked manually.
- Tests cover dependency substitution, two-database isolation, rollback and commit ordering, event routing, lifecycle, inventory, command registration and architecture boundaries.
- Combat characterization retains the original hashes for 276 seeded battles.
- Final full-suite, static, clean build and manifest results are recorded below.

PGlite and simulated Discord tests do not establish live PostgreSQL lock scheduling or live Discord availability. No dependency upgrade, migration, production data operation or deployment is part of this refactor.

## Final validation — 2026-09-21

- Full suite: **265 tests passed in 35 files**, 49.89 seconds; includes the previous 198 tests and 67 added checks.
- ESLint across `src`: passed. Strict source TypeScript and standalone strict checks for all ten new OOP test files: passed.
- Clean production build and emitted ESM import smoke check: **214 modules loaded**.
- All **28 command JSON manifests** are byte-for-byte identical to the pre-refactor baseline.
- `git diff --check`: passed. Schema, migrations, seed data, package manifest and lockfile unchanged.
- An initial run while compiling concurrently timed out in the existing 5-second quest scenario. With compilation finished, the unmodified scenario passed in 593 ms and the full suite passed with the same timeouts. No assertion or timeout was relaxed.

Changes remain uncommitted in the workspace. No deployment or live database operation was performed.
