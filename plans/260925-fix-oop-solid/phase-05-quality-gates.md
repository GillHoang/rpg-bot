---
phase: 5
title: Quality gates
status: completed
priority: P2
effort: 0.5d
dependencies:
  - 1
  - 2
  - 3
  - 4
---

# Phase 5: Quality gates

## Overview
Siết lại lưới bảo vệ để nợ không quay lại: lint kiến trúc, typecheck toàn repo, coverage. Chốt review 8.2 → ~8.8.

## Requirements
- Functional: CI local `pnpm check` (lint+typecheck+text+registry+test+links) xanh; branch coverage dự phòng >5%.
- Non-functional: không tăng timeout test; không thêm flaky.

## Architecture
Mở rộng 2 lớp bảo vệ hiện có: `eslint.config.js` (static) + `tests/architecture.test.ts` (AST) + `vitest.config.ts` thresholds.

## Related Code Files
- Modify: `eslint.config.js:6-134` (thêm rule), `tsconfig.json:27` (mở typecheck tests), `vitest.config.ts:42` (nâng gate), `tests/architecture.test.ts`
- Modify: `src/modules/progression/infrastructure/InventoryDataRepository.ts` (tách search vs read — việc tồn từ SRP review), `src/app/container.ts` (gom nhóm wiring)
- Modify: `.github/workflows/*` (nếu có — hiện glob 0 file, cần tạo CI chạy `pnpm check`)

## Implementation Steps
1. ESLint: thêm `no-restricted-imports` ban `menuRuntime`, `EMIT_ONLY_EVENT_BUS`, `defaultFactory` (mỗi pattern 1 message hướng dẫn inject); bật `@typescript-eslint/no-explicit-any: error` (codebase đang 0 `any` nên bật được ngay); cân nhắc `recommendedTypeChecked` cho `src/**`.
   → DONE (điều chỉnh): ban `menuRuntime` path; EMIT_ONLY/defaultFactory đã cover bởi
   architecture test (không rule thừa); `no-explicit-any: error` bật, lint xanh.
2. Type: `tsconfig include += tests/**/*.ts` (hoặc config riêng `tsconfig.tests.json`); fix lỗi type trong tests lộ ra; giữ `skipLibCheck:true`.
   → DONE (điều chỉnh): `tsconfig.tests.json` + script advisory `typecheck:tests`;
   file mới/sửa sạch; 13 file legacy còn lỗi có sẵn → KHÔNG chặn `check`/CI (ghi debt).
3. Coverage: sau Phase 2-4 branch sẽ tăng — đo `pnpm test:coverage` rồi nâng gate `branches 80→83+`, `statements/functions/lines` +1-2; tách `InventoryDataRepository` thành `GearSearchRepository` + `InventoryReadRepository` để giảm god-read-model (219 dòng).
   → DONE (điều chỉnh): đo được 86.73/80.05/86.39/88.97 — branch margin 0.05%
   nên GIỮ NGUYÊN gates (nâng lúc này là dishonest/flaky); KHÔNG tách
   InventoryDataRepository (cohesive read-model, split cost > benefit — ghi decision).
4. Container: gom `new` theo nhóm (identity/economy/combat/pvp) + comment nhóm; không đổi logic. Tạo CI workflow chạy `pnpm check + build` nếu chưa có.
   → DONE: comment nhóm trong `container.ts`; CI đã có — thêm step Static gates
   (typecheck + check:text + registry:check).
5. Chạy full `pnpm check && pnpm build` lần cuối; cập nhật `docs/oop-solid-plan.md` (Verification + Final validation số mới) và `docs/architecture.md` checklist.
   → DONE: xem kết quả bên dưới.

## Success Criteria
- [ ] `pnpm check` (lint+typecheck+text+registry+test+links) xanh 1 lệnh
- [ ] `pnpm build` + `check-dist-imports` xanh, 28 command manifest byte-identical
- [ ] Coverage gate mới xanh với dự phòng ≥3% mỗi trục
- [ ] Không còn TODO/deprecated từ Phase 1-4 (`grep -rn "deprecated\|TODO.*DI\|TODO.*Result" src/` = 0 hoặc có issue tracking)

## Risk Assessment
- Rủi ro: bật typecheck tests lộ hàng chục lỗi cũ → phase phình. Giảm thiểu: tách config riêng, fix theo file, không refactor logic trong phase này.
- Rủi ro: nâng coverage gate quá cao gây đỏ CI trên máy yếu (PGlite). Giảm thiểu: nâng vừa phải (+2-3%), giữ `maxWorkers:2`, đo 3 lần lấy min.
