---
title: Fix OOP SOLID debt
description: >-
  Khắc phục 4 nhóm nợ từ review 8.2/10: DIP fallback/singleton (7.0), OCP switch
  trong decorator (6.5), encapsulation CombatantState.flags (7.5), dual-paradigm
  Result/throw (7.5). Behavior-preserving, test-first.
status: completed
priority: P1
branch: main
tags:
  - oop
  - solid
  - refactor
blockedBy: []
blocks: []
created: '2026-09-25T13:09:57.305Z'
createdBy: 'ck:plan'
source: skill
---

# Fix OOP SOLID debt

## Overview

Review tổng thể chấm ~8.2/10. Kế hoạch này fix 4 lỗ hổng load-bearing đã xác minh bằng grep: (1) DI fallback + singleton trá hình, (2) switch/if-chain vi phạm OCP trong 3 decorator, (3) `flags: Record` phá encapsulation, (4) nửa service `throw` nửa `Result`. Mỗi phase giữ gameplay/DB/protocol, chạy `pnpm check + build` xanh.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [DI hardening](./phase-01-di-hardening.md) | Completed |
| 2 | [OCP decorator registry](./phase-02-ocp-decorator-registry.md) | Completed |
| 3 | [Battle state encapsulation](./phase-03-battle-state-encapsulation.md) | Completed |
| 4 | [Result unification](./phase-04-result-unification.md) | Completed |
| 5 | [Quality gates](./phase-05-quality-gates.md) | Completed |

## Dependencies

- Phase 2,3,4 đều phụ thuộc Phase 1 (xóa fallback DI trước để fail-fast lộ wiring sai).
- Phase 3 rủi ro cao nhất (chạm snapshot combat 276 trận) — làm sau Phase 2 để registry ổn định.
- Phase 5 chốt: siết lint/type/coverage sau khi code đã sạch.

## Cook

```bash
ck plan check plans/260925-fix-oop-solid/phase-01-di-hardening --start
# ... lần lượt cook từng phase, mỗi phase xong: pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
