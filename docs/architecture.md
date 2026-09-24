# Architecture (target: modular monolith)

```
src/
  app/                  # sole composition root
    container.ts        # builds the whole graph (sole composition root)
    bot.ts              # registry + events + client wiring; index.ts only handles signals
    events.ts           # subscribeDomainEvents (core/ re-exports for compat)
  shared/
    kernel/             # Result, AppError, UseCase, EventBus, IUnitOfWork/PersistenceContext, Rng, Clock
    discord/            # ICommand + CommandRegistry (only shared scope importing discord.js)
    ui/                 # formatNumber, ICONS, battle-log / inventory pager helpers
    config/             # truly-global config only (env)
  modules/              # one feature = one public barrel (index.ts)
  db/tables/            # schema split per module; schema.ts is the barrel
```

## Layers (dependency flows inward only)

```
presentation (commands/menu/render) -> application (use-cases) -> domain (pure rules)
                                     -> infrastructure (drizzle) via ports
```

## Rules

1. `domain/` and `shared/kernel/`: no runtime `discord.js`/`drizzle-orm`/`src/db/` (type-only db ports allowed).
2. `shared/discord/`: the only shared scope importing `discord.js`.
3. `application/` (module use-cases): one public `execute(input): Promise<Result>`; DB only via ports + `IUnitOfWork`.
4. `infrastructure/`: only place with runtime `drizzle-orm` / `src/db/` imports.
5. `presentation/`: thin — parse interaction, call use-case, render reply. No SQL.
6. RNG via `shared/kernel/rng.ts`; feature balance in `modules/<name>/config.ts`; global env in `shared/config`.
7. Display/diagnostic copy lives in `src/text/`; FK actions (`set null`) and audit actions (`Deity Pull`) are allowlisted technical strings.

## Modules

| Module | Status | Tables (`src/db/tables/`) |
|---|---|---|
| `economy` | ✅ migrated: `ClaimDailyUseCase` owns the daily transaction; `DailyService` is a compat adapter; `GetBalanceUseCase` projects balance | `economy.ts` (gameLogs) |
| `combat-shared` | ✅ facade + `CombatSetup` (assemble → combatant → strategy → resolve); Raid/Duel/Ranked share one instance via `combat` option | — (engine is stateless) |
| `progression` | 🔶 summon migrated (`RunSummonUseCase`; `SummonService` adapter; command via `progressionModule.runSummon`); deity/enhance/socket/loadout/inventory next | `progression.ts` |
| `identity` | facade: Start/ClassChange/Profile | `identity.ts` |
| `pve` | facade: Raid/Reward/Encounter | `pve.ts` |
| `pvp` | facade: Duel/Ranked/Shop | `pvp.ts` |
| `meta` | facade: Quest/Reputation/Cosmetic/Season | `meta.ts` |
| `casino` | facade: Casino/Sessions/Games | `casino.ts` |
| `menu` | facade: Router/GameplayService (orchestration only) | `menu.ts` |
| `system` | facade: Health/Reset/Scheduler/Maintenance | `system.ts` |

`src/db/schema.ts` is a barrel over `src/db/tables/*.ts` (59 tables, verified identical
columns + FK targets vs the old single file). `drizzle.config.ts` still points at the barrel.

## Migration status

- P1 done: `shared/kernel/`, `app/container.ts` (sole root; `src/application/` deleted).
- P2 done: economy fully migrated (`ClaimDailyUseCase` + `GetBalanceUseCase`; `services/DailyService.ts` deleted).
- P3 done: combat-shared facade + shared wiring into Raid/Duel/Ranked.
- P4 done: schema split per module + facade barrels + `app/bot.ts`,
  `app/events.ts`, `shared/discord|ui|config` per the target sketch.
- P5 done: all re-export shims removed — `core/EventBus.ts`, `core/ICommand.ts`,
  `core/subscribeDomainEvents.ts`, `services/SummonService.ts` deleted; every importer
  points at `shared/kernel`, `shared/discord`, `app/*` or `modules/*` directly.
- Next (per-feature, incremental): move each legacy service transaction body into a
  module use-case (same pattern as `ClaimDailyUseCase`/`RunSummonUseCase`), then delete the legacy service.
