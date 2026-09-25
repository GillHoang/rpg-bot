---
phase: 3
title: Battle state encapsulation
status: completed
priority: P2
effort: 1-2d
dependencies:
  - 1
  - 2
---

# Phase 3: Battle state encapsulation

## Overview
Thay `flags: Record<string, number|boolean>` stringly-typed bằng typed battle-state có invariant, chặn ghi đè bừa. Nâng Encapsulation 7.5 lên ~8.5. Đây là phase rủi ro cao nhất vì chạm mọi strategy/decorator.

## Requirements
- Functional: mọi flag hiện tại (`weapon_first_blood_used`, `storm_echo_armed`, `eclipse_mark_until`, `aegis_used`, `immunity_used`, `healed_this_round`, `initiative_bias`, `blessing_veil_active`,...) thành field/method typed; truy cập sai key = lỗi compile.
- Non-functional: combat snapshot + exploit-guard tests xanh; không đổi số balance.

## Architecture
`CombatantState` giữ các stat số (`hp/atk/def/crit/spd/...`) + `BattleFlags` value-object: `{ firstBloodUsed: boolean; skyDiveBonus: number; eclipseMarkUntil: number; stormEchoArmed: boolean; aegisUsed: boolean; immunityUsed: number; healedThisRound: number; initiativeBias: number; veilActive: boolean; sovereignUsed: boolean; ... }` với method `resetRound()` (reset `healedThisRound` mỗi hiệp — hiện đang làm thủ công). `cappedHeal/immunityMultiplier/applyDebuff` thành method hoặc nhận `BattleFlags` typed thay vì `flags.healed_this_round as number`.

## Related Code Files
- Modify: `src/modules/combat-shared/domain/CombatantState.ts:62-168` (core)
- Modify: ~15 consumers `grep "\.flags\." src/modules/combat-shared/domain` (`WeaponPassiveDecorator.ts:53-140`, `RuneStrategyDecorator.ts:38-55`, `DeityBlessingDecorator.ts:43-102`, `CombatStatusEffects.ts`, `classes/*.ts`, `BattleEngine.ts` round reset)
- Modify: `tests/combat-characterization.test.ts`, `tests/combatant-factory.test.ts`, `tests/exploit-guards.test.ts` (update truy cập flags → typed)

## Implementation Steps
1. `grep "\.flags\." src tests` lập danh sách đầy đủ key + kiểu thực tế (number|boolean) — đối chiếu với grep phase này (~20+ hit).
2. Định nghĩa `BattleFlags` interface + `createBattleFlags()` default; `CombatantState.flags: BattleFlags` (bỏ `Record`). Thêm `resetRoundFlags()` gọi trong `BattleEngine.closeRound` thay cho reset rải rác.
3. Migrate từng file: thay `ctx.self.flags.x as number ?? 0` → `ctx.self.flags.x`; thay gán trực tiếp thành method có guard nếu có invariant (vd `addHealed(n)` kẹp cap, `useImmunity()` đếm budget). Compile sau mỗi 2-3 file.
4. `immunityMultiplier/cappedHeal` (dòng 111-130) đọc `flags` typed, bỏ cast `as number`.
5. Chạy `pnpm test` — characterization là gate; nếu lệch, so log hiệp để xác định flag nào migrate sai default (thường `undefined` vs `0/false`).

## Success Criteria
- [ ] `grep "\.flags\.\w* as \|flags\[" src/` = 0; `flags: Record` biến mất
- [ ] Mọi key flag có trong `BattleFlags` type (thêm key mới bắt buộc sửa type)
- [ ] Characterization + exploit-guards xanh không sửa snapshot bừa
- [ ] `pnpm lint + typecheck + test` xanh

## Risk Assessment
- Rủi ro cao: miss 1 flag hiếm (vd `slow`/`blight` proc thấp) → test xanh giả. Giảm thiểu: grep exhaustive + bật `exactOptionalPropertyTypes` tạm thời lúc migrate để compiler bắt thiếu field, hoặc khởi tạo flags đầy đủ default thay vì optional.
- Rủi ro: `healed_this_round` reset sai thời điểm → vỡ heal cap P8. Giảm thiểu: test riêng `cappedHeal` budget 8% + review `BattleEngine.closeRound` trước/sau.
