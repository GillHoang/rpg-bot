---
phase: 1
title: DI hardening
status: completed
priority: P1
effort: 1d
dependencies: []
---

# Phase 1: DI hardening

## Overview
Xóa mọi đường fallback che wiring bug để `requirePersistence()` fail-fast thật. Nâng DIP từ 7.0 lên ~8.5. Không đổi behavior — chỉ đổi cách dựng object.

## Requirements
- Functional: toàn bộ service/command nhận collaborator qua constructor, không tự `new` ẩn; không import global `menuRouter/db/EMIT_ONLY/defaultFactory` trong `src/`.
- Non-functional: `pnpm lint + typecheck + test` xanh; 477 passed giữ nguyên; không thêm dependency mới.

## Architecture
Composition root duy nhất `src/app/container.ts` dựng graph. Các service giữ signature tương thích ở phase này bằng overload deprecated (log warning) rồi xóa ở cuối phase — tránh vỡ 68 test cùng lúc.

## Related Code Files
- Modify: `src/modules/progression/infrastructure/InventoryDataRepository.ts:20` (bỏ `= db`)
- Modify: `src/modules/menu/menuRuntime.ts:5`, `src/app/DiscordBot.ts:7,39`, `src/app/BotMaintenance.ts:5,16`, `src/modules/menu/presentation/MenuCommand.ts:3,10` (xóa `menuRouter` global)
- Modify: `src/shared/kernel/EventBus.ts:66` + 9 files dùng `EMIT_ONLY_EVENT_BUS` (`CasinoService.ts:46`, `RaidService.ts:138`, `LootService.ts:91`, `ClaimDailyUseCase.ts:36`, `DuelService.ts:143`, `RankedService.ts:148`, `EconomyService.ts:37`, `RunSummonUseCase.ts:76`, `EnhancementService.ts:63`)
- Modify: `src/modules/combat-shared/application/combatantFactory.ts:45-51` (xóa `defaultFactory` + 2 export function)
- Modify: `src/app/container.ts:141,201,207`, `src/modules/menu/MenuGameplayService.ts:67-71`, `src/modules/pve/application/RaidService.ts:136`, `DuelService.ts:141`, `RankedService.ts:146`, `ProfileService.ts:36` (xóa `undefined` + `?? new`)
- Modify: `tests/architecture.test.ts` (mở rộng ban list)

## Implementation Steps
1. `InventoryDataRepository`: constructor `executor: Executor` bắt buộc; sửa call-site duy nhất `container.ts:180` truyền `persistence.executor`; thêm architecture-test assert không file nào import `db/client` ngoài `db/`, `app/container`, `livePersistence`, tests.
2. `menuRouter`: xóa `menuRuntime.ts`; `DiscordBot`/`BotMaintenance`/`MenuCommand` nhận `menu: Pick<MenuRouter,...>` bắt buộc (bỏ `?? menuRouter` / `= menuRouter`); `container.ts:176` luôn `new MenuRouter(new MenuSessionStore(), menuGameplay)`; entry `src/index.ts` + `scripts/deployCommands.ts` dựng explicit. Xóa comment compatibility `docs/oop-solid-plan.md:107` liên quan.
3. `EMIT_ONLY_EVENT_BUS`: đổi mọi `events?: X = EMIT_ONLY` thành `events: X` bắt buộc; `container.ts` đã truyền `events` thật nên chỉ sửa signature + call trong tests (`testPersistence`/`new EventBus()`). Giữ export hằng nhưng đánh `@deprecated` 1 phase rồi xóa, hoặc xóa ngay nếu test không dùng — kiểm tra `grep EMIT_ONLY tests`.
4. `combatantFactory`: xóa `defaultFactory/createPlayerCombatant/createPlayerStrategy`; grep toàn repo sửa caller sang inject `PlayerCombatantFactory` (chủ yếu `CombatSetup` + tests).
5. Xóa `{} as Deps` + `?? new`: `ClaimDailyUseCase.ts:32`, `StatAssemblyService.ts:110` thành `options: ClaimDailyOptions` bắt buộc có `persistence`; `MenuGameplayService.ts:67-71`, `Raid/Duel/Ranked/ProfileService` xóa nhánh fallback, nhận `statAssembly/combat` bắt buộc từ container. `container.ts` thay `undefined` bằng instance thật (`new DailyRepository()`, `new CasinoRepository()`,...).
6. Chạy `pnpm lint && pnpm typecheck && pnpm test`; fix wiring lộ ra (đây chính là bug bị che — không tự thêm fallback mới).

## Success Criteria
- [ ] `grep -rn "menuRouter\|EMIT_ONLY\|defaultFactory\|= db" src/` = 0 hit (trừ comment deprecated đã ghi)
- [ ] `grep -rn "(undefined," src/app/container.ts` = 0 hit; không còn `{} as .*Dependencies`
- [ ] Architecture test mới ban 4 pattern trên pass
- [ ] `pnpm lint && pnpm typecheck && pnpm test` xanh, số test không giảm

## Risk Assessment
- Rủi ro: ~68 test đang dựa vào zero-arg constructor → vỡ hàng loạt. Giảm thiểu: giữ overload deprecated 1 commit, migrate tests theo từng module, chạy test sau mỗi module.
- Rủi ro: `MenuCommand`/bot bootstrap quên truyền menu → crash lúc start. Giảm thiểu: `requireMenu()` fail-fast + smoke `pnpm build && node dist/index.js --help` (hoặc dry-run deploy commands).
