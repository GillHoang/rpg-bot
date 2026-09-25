---
phase: 4
title: Result unification
status: completed
priority: P2
effort: 1d
dependencies:
  - 1
---

# Phase 4: Result unification

## Overview
Chốt 1 kênh lỗi duy nhất: `UseCase.execute() -> Result<T, AppError>`, xóa dual-paradigm throw/return-string. Nâng Error-handling 7.5 lên ~8.5. User-visible text không đổi.

## Scope note (recalibrated during implementation)
Điều tra cho thấy user-facing methods ĐÃ trả `Result` (Loot/Quest/Cosmetic/Loadout/
Weapon/PvpShop/Ranked/Socket/ClassChange) và try/catch trong commands chỉ là
Discord I/O guard — boundary thật là `CommandRegistry.dispatch`. Ép mọi
`throw` nội bộ (repository/domain invariant, tx-abort) thành `Result` sẽ PHÁ
cơ chế rollback-by-exception và làm code tệ đi. Scope thực hiện:
- Policy chính thức: `Result` cho outcome user-recoverable ở public boundary;
  `throw AppError` chỉ cho invariant/tx-abort/DI-wiring (`docs/architecture.md` rule 8).
- `LootService` (2) + `SocketService.unlock` (1): throw trong method đã trả
  `Result` → `return err()` (total methods).
- `MenuRouter`: parity với dispatch — `AppError.message` surface vào notice
  thay vì generic `MENU_TEXT.failed` (trước đây menu nuốt message cụ thể).
- Throws còn lại (repo missing-bag, domain validation, seed-missing, menu flow
  guards, ResetService input guards) GIỮ NGUYÊN có chủ ý — tài liệu hóa trong
  architecture rule 8 thay vì xóa.

## Requirements
- Functional: mọi application method trả text cho user (`LootService` 3, `QuestService` 3, `CosmeticService` 4, `PvpShopService.buy`, `LoadoutService` 2, `RankedService.stats`, `SocketService.unlock`, `ClassChangeService.change`, + ~25 service còn `throw`) đều trả `Result<string, AppError>`; command chỉ `value/error.message`.
- Non-functional: `CommandRegistry.dispatch` vẫn map `AppError→userMessage`, unknown→`GENERIC_ERROR`; test dùng `tests/helpers/result.ts:textOf`.

## Architecture
Giữ `src/shared/kernel/Result.ts:1 (ok/err/AppError)` + `UseCase.ts:4`. Mỗi service: logic cũ vào `execute()` trả `Result`; method public cũ thành wrapper deprecated (unwrap hoặc throw) để test/command migrate dần. `architecture.md:68` dòng `Next: move legacy service body into use-case` được đóng trong phase này.

## Related Code Files
- Modify: `src/shared/kernel/Result.ts`, `src/app/CommandRegistry.ts:57`
- Modify: ~25 services còn `throw new AppError` (`ResetService.ts:62,98`, `HealthService.ts:12`, `CasinoRepository.ts:26`, `EconomyService.ts`, `EnhancementService.ts`, `DuelService.ts`, `RankedService.ts`,...)
- Modify: ~22 presentation commands (`DailyCommand`, `RaidCommand`, `CasinoCommand`,...) chuyển sang `textOf(result)`
- Modify: `tests/helpers/result.ts`, các test đang `expect(...).rejects` chuyển sang unwrap `Result`

## Implementation Steps
1. `grep -rn "throw new AppError" src/modules | sort` lập danh sách đầy đủ; ưu tiên nhóm đã làm 17 method (`Loot/Quest/Cosmetic/PvpShop/Loadout/Ranked/Socket/ClassChange`) để thống nhất helper `textOf`.
2. Từng service: đổi signature `Promise<string>` → `Promise<Result<string, AppError>>`, `throw` → `return err(...)`, `return text` → `return ok(text)`; command tương ứng dùng `textOf`.
3. `HealthService/ResetService` (admin, ít caller) làm trước để lấy mẫu; sau đó `Economy/Enhancement/Casino/Duel/Ranked`.
4. Migrate test: `rejects.toThrow` → `expect(result.ok).toBe(false) + error.code`; thêm test mã lỗi ổn định (`DI_*`, `*_MISSING_BAG`).
5. Cập nhật `docs/oop-solid-plan.md:48-56` + `docs/architecture.md:68-73` (xóa dòng Next).

## Success Criteria
- [ ] `grep -rn "throw new AppError" src/modules/*/application` = 0 (chỉ còn trong kernel/test util nếu có)
- [ ] Mọi command dùng `textOf`/unwrap, không `try/catch` thủ công ngoài `CommandRegistry`
- [ ] User message byte-identical (so bằng presentation/text-boundary tests)
- [ ] `pnpm lint + typecheck + test` xanh

## Risk Assessment
- Rủi ro: đổi signature hàng loạt vỡ command + test cùng lúc. Giảm thiểu: làm từng service + command + test theo cụm (1 PR nhỏ/cụm), giữ wrapper deprecated cho cụm chưa migrate.
- Rủi ro: nuốt stack trace khi chuyển throw→err. Giảm thiểu: `AppError{cause/context}` giữ stack; logger vẫn ghi `error` level cho `err` nghiêm trọng.
