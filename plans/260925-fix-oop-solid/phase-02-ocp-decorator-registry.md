---
phase: 2
title: OCP decorator registry
status: completed
priority: P1
effort: 1d
dependencies:
  - 1
---

# Phase 2: OCP decorator registry

## Overview
Thay switch/if-chain trong 3 decorator bằng registry `Map<key, Handler>` để thêm passive/effect mới không sửa class cũ. Nâng OCP 6.5 lên ~8.5. Snapshot combat phải giữ nguyên.

## Requirements
- Functional: mọi `passiveKey/effectKey` hiện tại (12 weapon + rune + blessing) chạy qua registry; thêm mới = đăng ký 1 handler, 0 sửa decorator core.
- Non-functional: `tests/combat-characterization.test.ts` hash 276 trận không đổi; coverage không giảm.

## Architecture
Mỗi decorator giữ vai trò薄 wrapper `inner` + dispatch: `Handler { prepareOutgoingHit?; onHitLanded?; onRoundEnd?; ... }`. Registry là instance inject được (không static global): `WeaponPassiveRegistry`, `RuneEffectRegistry`, `BlessingRegistry`. `combatantFactory.ts:34` chain `wrapWith*` giữ nguyên thứ tự class → weapon → rune → blessing.

## Related Code Files
- Modify: `src/modules/combat-shared/domain/WeaponPassiveDecorator.ts:43-163` (tách 12 case thành `passives/*.ts` hoặc `weaponPassives.ts` map)
- Modify: `src/modules/combat-shared/domain/RuneStrategyDecorator.ts` (if-chain `effectKey`), `src/modules/combat-shared/domain/DeityBlessingDecorator.ts` (if-chain `blessing`)
- Modify: `src/modules/combat-shared/domain/ClassStrategyRegistry.ts:16`, `src/modules/casino/domain/CasinoGameRegistry.ts:16` (chuyển static → instance inject, mẫu cho registry mới)
- Modify: `src/modules/menu/MenuGameplayService.ts:88-129 resolveKind/buildPanel` (tách `Map<kind, PanelBuilder>` — cùng pattern, làm gọn trong phase này)
- Modify: `src/modules/combat-shared/application/combatantFactory.ts` (nhận 3 registry qua constructor)
- Create: `src/modules/combat-shared/domain/passives/*.ts` (1 file/handler hoặc gom theo nhóm), `src/modules/combat-shared/domain/PassiveRegistry.ts`
- Modify: `tests/combat-characterization.test.ts`, `tests/combatant-factory.test.ts` (thêm test: đăng ký handler fake không chạm core)

## Implementation Steps
1. Liệt kê toàn bộ key: grep `passiveKey|effectKey` trong domain + seed (`src/seed/data/*.ts`, `src/shared/config/runes.ts`, `blessings.ts`); lập bảng key → case hiện tại.
2. Định nghĩa `PassiveHandler` interface + `PassiveRegistry { register(key, handler); get(key): handler | noop }`; viết `WeaponPassiveDecorator` mới chỉ `inner.prepare...` rồi `registry.get(key).prepare...(ctx, hit)`.
3. Tách từng case (`warlord_edge`, `first_blood`, `sky_dive`, `eclipse_mark`, ...) thành handler riêng, copy nguyên logic + log string (không sửa số). Tương tự cho rune (`aegis_rune`, `warding_pct`,...) và blessing (`tailwind`, `lunar_veil`, `sky_sovereign`,...).
4. Chuyển `ClassStrategyRegistry`/`CasinoGameRegistry` static thành instance inject qua `CombatSetup`/container (giữ export static deprecated 1 phase nếu test dùng).
5. `MenuGameplayService.resolveKind`: thay if-chain bằng `Map<string, (deps)=>Panel>`; mỗi panel là builder pure.
6. Thêm test OCP: register handler `test_nuke` fake, assert engine gọi mà không sửa decorator; chạy characterization snapshot — nếu hash lệch, diff log từng hiệp để tìm handler migrate sai.

## Success Criteria
- [ ] Thêm 1 passive fake chỉ bằng `register()` (không sửa decorator) và test pass
- [ ] Characterization 276 trận hash/log/state giữ nguyên (snapshot không update bừa)
- [ ] Không còn `switch (passiveKey|effectKey)` trong 3 decorator; `grep "switch.*passiveKey\|effectKey ===" src/modules/combat-shared/domain` = 0
- [ ] `pnpm test + lint + typecheck` xanh

## Risk Assessment
- Rủi ro: copy-paste sai số (dmg bonus, cap) → lệch balance âm thầm. Giảm thiểu: characterization snapshot là gate cứng; cấm `--update-snapshot` nếu chưa review diff từng dòng.
- Rủi ro: registry instance bị dùng như global. Giảm thiểu: không export singleton; container dựng 1 lần, test dựng riêng.
