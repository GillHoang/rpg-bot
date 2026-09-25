# Architecture (modular monolith)

```
src/
  index.ts              # process signals only; bootstrap lives in app/
  app/                  # sole composition root
    container.ts        # builds the whole collaborator graph (no I/O, no timers)
    bot.ts              # registry + events + client wiring
    events.ts           # subscribeDomainEvents (quest/believer observers)
    DiscordBot.ts CommandRegistry.ts Scheduler.ts BotMaintenance.ts owners.ts
    registerAllCommands.ts
  modules/              # one feature = one vertical slice (public barrel: index.ts)
    identity/           # start, profile, class-change
    economy/            # balance, daily (ClaimDailyUseCase), chest/open, loot-grant
    combat-shared/      # BattleEngine, strategies, CombatSetup, stat assembly, seeded Rng
    pve/                # raid hunt/boss, encounter, rewards
    pvp/                # duel, ranked, pvp-shop
    progression/        # summon (RunSummonUseCase), deity/sigil/ascend, enhance,
                        # socket, loadout, inventory, gear/rune
    meta/               # quest, reputation/believer, cosmetic/title, season
    casino/             # 4 one-shot games + blackjack/crash sessions
    menu/               # /menu orchestration only (router + gameplay service + panels)
                        # items/{category}/{name}.ts = menu elements (registry.generated.ts)
    system/             # health, reset, ping, admin
  shared/
    kernel/             # Result, AppError, UseCase, EventBus, IUnitOfWork,
                        # PersistenceContext, Clock
    discord/            # ICommand + CommandRegistry re-export
    ui/                 # text/ (wording), render/ (canvas, pagers)
    config/             # balance data (loot, gacha, ranked, quest, blessings…)
    utils/              # logger, RNG helpers, cycles, formatters
    progress/           # GameplayProgressCoordinator (cross-module quest/EXP)
  db/                   # client, livePersistence, DrizzleUnitOfWork,
                        # schema barrel + tables/<module>.ts, migrations
  scripts/              # ops tooling (deploy/clear commands, season rollover)
  seed/                 # seed runner (data lives in modules/*/seed/)
```

Each slice is layered internally:

```
presentation/ (discord commands) -> application/ (use-cases, services)
                                   -> domain/ (pure rules)
                                   -> infrastructure/ (drizzle repositories)
```

## Rules

1. `modules/*/domain/` and `shared/kernel/`: no runtime `discord.js`/`drizzle-orm`/`src/db/` (type-only db ports allowed).
2. `shared/discord/`: the only shared scope importing `discord.js`.
3. Module use-cases: one public `execute(input): Promise<Result>`; DB only via ports + `IUnitOfWork`.
4. `modules/*/infrastructure/` + `db/`: the only places with runtime drizzle/db imports.
5. `modules/*/presentation/`: thin — parse interaction, call use-case, render reply. No SQL.
6. RNG via `shared/kernel`; display copy in `shared/ui/text` (checked by `pnpm check:text`).
7. Cross-module imports are allowed but must go through the target's public barrel or a port — never deep-link around it without reason.
8. Error channel: public use-case/service methods return `Result` (user-recoverable
   outcomes: validation, insufficient funds, not-registered) with stable `AppError`
   codes; `throw new AppError` is reserved for invariants, tx-internal aborts
   (missing locked rows, corrupt seeds — these roll the transaction back) and
   DI-wiring bugs. Both transports map the boundary the same way
   (`CommandRegistry.dispatch`, `MenuRouter` `userMessage`): `AppError` message
   shown as-is, unknown errors → generic failure + logged stack.

## Adding a feature (checklist)

1. Domain rule in `modules/<name>/domain/` (pure, unit-tested, no I/O).
2. Repository in `modules/<name>/infrastructure/` (drizzle only here).
3. Use-case in `modules/<name>/application/` with `execute()` returning `Result`.
4. Command in `modules/<name>/presentation/` (thin) + one line in `app/registerAllCommands.ts`.
5. Export the public surface from `modules/<name>/index.ts`; wire shared collaborators in `app/container.ts`.
6. Balance numbers in `shared/config/` (or module `config/`), wording in `shared/ui/text/`, seed rows in `modules/<name>/seed/`.
7. Menu element: add `modules/menu/items/{category}/{name}.ts` (default-export a `MenuItemSpec`) and run `pnpm menu:registry` — the router/view read the generated registry, so no central button list is edited.

## Migration status

- P1–P5 done: kernel, container-as-root, economy + summon use-cases, combat-shared,
  schema split, app bootstrap, all shared barrels.
- P6 done: full consolidation — 16 top-level `src/` dirs → 6
  (`app db modules scripts seed shared`); all re-export shims deleted.
- Next (per-feature, incremental): move each remaining legacy service transaction body
  into a module use-case (same pattern as `ClaimDailyUseCase`/`RunSummonUseCase`).
- Known follow-ups (tracked, not blocking): `pnpm typecheck:tests` (advisory) still
  reports pre-existing fixture staleness in 13 legacy test files (missing
  P8 stat fields, drizzle overload strictness) — new/modified test files are
  clean; branch coverage margin is razor-thin (80.05 vs gate 80), so gates stay
  until branch-specific tests land; `InventoryDataRepository` stays one cohesive
  read-model by decision (split cost > benefit).
