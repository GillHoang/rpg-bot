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

Pure arithmetic helpers, immutable configuration and text formatting remain functions/data. Constructor defaults still import concrete adapters for source compatibility: this is explicit dependency injection, not a claim that every module is independent of infrastructure types.

## Compatibility

Original positional constructor arguments remain supported with optional trailing dependency options. Old InventoryRepository, DeityRepository, MonsterRepository and RaidRewardRepository exports alias the new policy classes. LootService still honors legacy injected rune/gear methods, with explicit grant overrides taking precedence.

Zero-argument registration uses the legacy shared EventBus and lazy menuRouter, matching zero-argument observer/bot setup. Explicit application graphs use independent buses and menu stores. Existing function entry points remain compatibility delegates.

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
