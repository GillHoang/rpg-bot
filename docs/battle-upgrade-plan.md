# Kế hoạch nâng cấp toàn diện hệ thống battle

> Mục tiêu: **(1)** nâng cấp mọi mặt của combat engine, **(2)** tạo đa dạng cách chơi/build,
> **(3)** đóng kín mọi "dead flow" (tính năng có schema nhưng chưa có cơ chế, hoặc nội dung không ai dùng).
> Nguyên tắc xuyên suốt: giữ kiến trúc **Strategy + Decorator + EffectRegistry (OCP)** hiện có — thêm hiệu ứng
> là `register()` một handler, không sửa decorator core. Mọi balance nằm ở `src/shared/config/`, mọi wording ở
> `src/shared/ui/text/`, seed ở `src/modules/*/seed/`, tính thuần ở `domain/`, transaction ở `application/`.

---

## 0. Hiện trạng (điểm xuất phát)

**Combat core** (`src/modules/combat-shared/domain/`):
- Stat: HP · ATK · DEF · CRIT · SPD · ACC · EVA · TEN. Formula:
  `mitigate(DEF/(DEF+600), cap 75%) × variance(±10%) × hitMultiplier(crit ×2) × (1 − reduction) × suddenDeath` ;
  pierce cap 60%, crit cap 60%, hit 95% +1%/điểm ACC−EVA (kẹp 80–100%).
- 5 class Strategy (Swordsman bleed-detonate · Fighter Bash/execution · Mage Overcharge-weave · Knight Bulwark/SecondWind · Archer aimed-alternate) + MonsterStrategy (9 skill + 5 affix + Bakunawa 3 phase).
- Rune: 6 stat% (`sharpness/precision/vitality/bulwark/swiftness/eagle-eye`) + 8 combat hook (`vampiric/piercing/venom/blight/thorns/warding/aegis_rune/frost`).
- Weapon passive 12 key · Armor passive 11 key · Deity blessing 8 key (pantheon 3 slot × 1/0.5/0.25 + resonance mythology).
- Anti-stall: sudden death round 31–40 (×1.1→×2.0 damage + 2% maxHP bleed/round), tiebreak HP%.

**Cấu hình nội dung:** 5 Gate × 10 tầng (modifier `none/tanky/aggressive/regen/evasive`), elite 20% + affix pool,
boss Bakunawa daily. PvP: duel (stake) + ranked async mirror Elo K=32, 5 bracket, demotion shield.

**Vấn đề cốt lõi:** battle **auto-battle 100%** — người chơi chỉ chọn loadout + gate/tier rồi xem log. Không có
quyết định nào trong/bên cạnh trận, không có nhánh build trong class, không có khắc hệ. Và ~8 nhóm dữ liệu schema
đang "nằm im" (dead flow).

---

## 1. Bảy trục nâng cấp

### Trục A — Combat core: lớp khắc hệ & stat phụ (đa dạng build nền tảng)

Hiện tại mọi build quy về "stack ATK + crit". Thêm trục lựa chọn:

| Thêm | Mô tả | Nguồn file |
|---|---|---|
| **Damage type** | `physical · magical · ranged · holy · shadow` — mỗi class/weapon/mob gắn 1 type | `DamageCalculator`, `StatAssembly`, seed weapon/mob |
| **Armor type** | `light · medium · heavy · ethereal` — ma trận khắc (vd physical→heavy 80%, magical→heavy 120%) | mới `combatRules.ts` hoặc `damageTypes.ts` |
| **Crit severity** | thay `×2` cố định bằng `critDmg%` (mặc định 200%) — build crit có trade-off | `DamageCalculator.hitMultiplier` |
| **Shield (khiên tạm)** | lớp HP tạm thời không tính mitigation, có thời hạn/stack | `CombatantState` + `BattleAttack` |
| **Armor Penetration theo % và flat** | hiện chỉ có fraction; thêm flat pen trước mitigation | `DamageCalculator.mitigate` |
| **DoT stacking rule** | bleed/burn/venom hỗ trợ stack có cap + refresh duration chuẩn | `applyDebuff` (đã có `stacks?`) |

> **Anti-exploit:** mọi biến mới đều đi qua cap có sẵn (mitigation 75%, pierce 60%, crit 60%, heal 8%/round,
> immunity 2 lần/trận). Ma trận khắc hệ phải **zero-sum** (mọi phe đều có điểm yếu) để không có "hệ mạnh tuyệt đối".

### Trục B — Hệ kỹ năng chủ động + tài nguyên (mở khoá đa dạng cách chơi lớn nhất)

Hiện mọi passive **tự proc**, không ai chọn gì. Thêm lớp "skill loadout":

1. **Skill pool theo class** — mỗi class 4–6 skill (active + passive), người chơi **chọn 2 active mang vào trận**.
   - Ví dụ Swordsman: *Rend* (chảy máu) / *Bash* (choáng) / *Warcry* (buff ATK 3 turn) / *Execute* (sát thương theo HP đã mất).
   - Dùng `EffectRegistry.register()` — mỗi skill = 1 handler, không sửa engine.
2. **Tài nguyên (Rage / Focus / Mana)** — tích qua đòn đánh/nhận damage, chiêu tốn tài nguyên; ultimate đầy thì
   auto-cast hoặc chờ điều kiện. Thay thế hoàn toàn "proc ngẫu nhiên" bằng **quyết định build**.
3. **Battle Order (thế trận)** — chọn trước: *Aggressive / Balanced / Defensive / Counter* → đổi priority AI
   (ưu tiên skill burst / giữ tài nguyên / ưu tiên phòng thủ / phản đòn). Giữ auto-battle nhưng **có chiến thuật**.
4. **Decision Moment (tuỳ chọn, chỉ cho boss/duel/ranked)** — giống pattern casino blackjack: ở round telegraph,
   hiện 1 nút *"Dùng Ultimate / Phòng thủ / Rút lui"* trong 60s. Không làm chậm hunt thường.

> Kiến trúc: `IClassStrategy` thêm hook `chooseAction(ctx, resource)` (mặc định auto), engine hỏi strategy mỗi turn.
> Battle vẫn resolve 1 lần (hợp Discord), nhưng **đầu vào** là skill loadout + order — đây là chỗ tạo đa dạng.

### Trục C — Build diversity: set gear, rune synergy, nhánh class, echo deity

| Cơ chế | Mô tả | Kích hoạt dead flow |
|---|---|---|
| **Gear set** | 2/4 mảnh cùng set → set bonus (vd "Bloodfang": +bleed dmg). Thêm bảng `gear_set` + `set_bonus` | nội dung mới |
| **Rune resonance** | rune cùng `lane`/`effectGroup` socket ≥3 → resonance bonus (song song với deity resonance) | dùng lại socket |
| **Nhánh class (Branch)** | Lv.40 chọn 1 trong 2 nhánh/class (Duelist vs Blademaster…) — sửa đổi passive + 1 skill | đa dạng trong class |
| **Echo deity** | kích hoạt `user_character.active_echo_deity_id` (đang im) — deity thứ 4 slot echo, blessing ×0.25 | **dead flow** |
| **Pantheon preset 2** | đã có `/preset switch` — thêm UI menu cho preset, autoswitch theo gate | menu P3 |

### Trục D — Enemy & encounter design (đa dạng thử thách)

- **Monster AI**: thêm skill rotation + telegraph cho mọi gate boss (hiện chỉ Bakunawa có phase).
- **Gate modifier mở rộng**: 5 → ~10 modifier (`reflect`, `thorn`, `drain`, `enrage`, `shielded`, `summon`, …),
  cho phép **2 modifier/gate** (elite affix đã có sẵn pool → tận dụng).
- **Elite affix**: mở rộng pool, elite có 1–2 affix, boss 2–3.
- **Tower / Infinite**: mode leo tầng vô hạn (tái dùng `GATE_TIERS` infra) — thưởng theo chuỗi, reset tuần.
- **Weekly modifier**: modifier xoay tuần cho hunt (VD "tuần Bloodmoon: mọi trận sudden death từ round 15").

### Trục E — Battle modes (mở rộng phạm vi chiến đấu)

| Mode | Mô tả | Kích hoạt dead flow |
|---|---|---|
| **World Boss (guild)** | boss server-wide định kỳ, mọi người đóng góp damage, thưởng theo % | **`boss_state`, `boss_spawn_queue`, `boss_attack_log`, `auto_raids`** |
| **Guild War / Territory** | guild đánh chiếm, dùng `user_guild_activity` | **`user_guild_activity`** |
| **Ranked season payout** | trao thưởng cuối mùa theo `ranked_reward.season_end_payload` | **cột đang rỗng** |
| **Co-op raid 2 người** | 2 combatant vs boss — mở rộng `BattleEngine` lên N-vs-M | mode mới |
| **Vote reward (top.gg)** | tuỳ chọn — hiện `topgg_vote_events` im | **dead flow** |

### Trục F — Đóng dead flow (toàn bộ schema/cơ chế đang im)

| Dead flow hiện tại | Kế hoạch kích hoạt |
|---|---|
| `boss_state`, `boss_spawn_queue`, `boss_attack_log`, `auto_raids` | Trục E — World Boss guild |
| `user_character.active_echo_deity_id` | Trục C — Echo deity slot |
| `user_guild_activity` | Trục E — Guild War |
| `ranked_reward.season_end_payload` (rỗng) | Trục E — Season payout + script `season:rollover` tự trao |
| `users_bag.supreme_chest` | rương Supreme — faucet qua World Boss / thành tích |
| `essence_exchange_submissions` | essence exchange shop (đổi essence → relic/rune) |
| `raid_reward_grants` (per-level rewards) | trao thưởng theo mốc level (hiện seed có, chưa có đường cấp) |
| `user_character.boss_top_damage` | bảng xếp hạng damage World Boss |
| `topgg_vote_events` | vote reward (tuỳ chọn, ngoài scope nếu không muốn webhook) |
| Portrait canvas (`/profile` chỉ dùng text) | render canvas portrait — đã deferred |
| Passive weapon/armor theo roster (README: ngoài scope) | đã có weapon/armor passive — giờ mở rộng theo set (Trục C) |

> Quy tắc: **mọi bảng/cột trong schema phải có ít nhất một đường ghi + một đường đọc**, hoặc được chủ động
> drop. Thêm checklist "schema coverage" vào test (`tests/modules.test.ts`) để không tái diễn dead flow.

### Trục G — UX / QoL chiến đấu

- **Battle preview**: trước khi vào gate/boss, ước lượng win-rate + damage dự kiến (chạy 100 sim với loadout hiện tại).
- **Auto-repeat / sweep**: quét tầng đã thắng (tốn vé hoặc cooldown), trả thưởng tức thì — giảm thao tác lặp.
- **Battle log nâng cấp**: highlight damage theo type, timeline buff/debuff, so sánh 2 lần đánh.
- **Loadout öneriler**: gợi ý rune/gear theo gate modifier (vd gate `evasive` → ưu tiên ACC/eagle-eye).
- **Preset theo nội dung**: autoswitch preset khi vào gate khác nhau.

---

## 2. Lộ trình triển khai (từng phase giao được độc lập)

Mỗi phase: source + config + seed + text + test (unit/characterization/PGlite) + docs. Không phase nào phá
characterization snapshot của phase trước. `pnpm check` + `pnpm build` phải xanh trước khi chuyển phase.

### Phase 0 — Nền tảng & dọn đường (1–2 ngày) ✅
- ✅ **Schema coverage test** (`tests/schema-coverage.test.ts`): mọi bảng trong schema barrel được phân loại `active`/`planned`/`drop` kèm lý do. Thêm bảng mới chưa khai báo → test fail (chặn dead flow tái diễn). Manifest trỏ phase trong battle-upgrade-plan cho mục `planned`.
- ✅ **Type `DamageType`/`ArmorType` + ma trận khắc hệ** (`src/shared/config/damageTypes.ts`): 5 damage × 4 armor, **zero-sum chặt** (mọi hàng = 4.0, mọi cột = 5.0), clamp [0.8, 1.2]. Feature flag `DAMAGE_TYPE_MATRIX_ENABLED = false` — **chưa bật trong damage formula**, characterization snapshot không đổi. Test chốt zero-sum/clamp tại `tests/damage-types.test.ts`.
- ✅ **Doc drift**: tenacity (`classes.ts:85` "shortens" → "shrug off entirely"), Fighter Bash (`gameplay-implementation.md:37` "25%/50%" → "15%/35%" khớp `FighterStrategy.ts`). Knight đã khớp sẵn (25/30/2.5/25) — claim "2/15" trong audit là stale. `package.json` description đã đúng "PostgreSQL".
- **Deliverable:** test mới pass (11 test), `pnpm check` + `pnpm build` xanh, không đổi behavior.

### Phase 1 — Combat core: khắc hệ + crit severity + shield (3–5 ngày) ✅
- ✅ `critDmg%` thay `×2` cố định (default 200 = identical); stat `critDmg`, `penFlat`, `shield` vào `CombatantState` (default 200/0/0). Wire ma trận vào `BattleAttack` (`armorTypeMultiplier`, shield absorb trước HP, penFlat trừ DEF trước mitigate).
- ✅ Derive `damageType`/`armorType` cho **mob** (tier + level, no migration) và **player** (`StatAssemblyService` theo class, `combatantFactory` pass-through).
- ✅ **Bật `DAMAGE_TYPE_MATRIX_ENABLED`** — design đã chốt sau 2 vòng balance:
  - Default neutral pair = physical/**medium** (test combatant giữ nguyên damage).
  - Armor progressive theo content: boss/elite gate 1-2 medium, gate 3+ heavy; regular light → medium từ lv 30.
  - Kết quả: Mage (magical→heavy 1.2) thành boss-killer, Knight (heavy) tank physical (0.8), Archer/Mage (light) squishy vs physical (1.1).
- ✅ Verification: characterization **chứng minh behavior-identical** (strip 5 field inert → khớp snapshot gốc) rồi re-baseline shape; `combat-review-regressions` (pin HP) pass; **portal-balance pins giữ nguyên** (gate 1 >60%, final boss upgraded >80%, starter late <20%).

### Phase 2 — Skill system + tài nguyên + Battle Order ✅
- ✅ 20 skill (4/class) dạng EffectRegistry handler + SkillDecorator bọc theo turn; sustain effect chạy cả khi miss (prepareOutgoingHit).
- ✅ Battle Order 4 stance (priority deterministic, không roll RNG); resource tích khi gây/nhận damage (cap 100), cooldown theo round — tất cả gated trên loadout (skill-less battle bit-identical, đã strip-verify).
- ✅ Migration 0013 (skill_slot_1/2, battle_order + CHECK, class_branch prep); SkillService + `/skill list|equip|order` (31 commands).
- ✅ Test: registry validity, stance priority, engine flow, loadout DB, assembly carry.

### Phase 3 — Build diversity ✅
- ✅ Gear set (migration 0014 `set_key`, 3 set/tier, bonus 2 món cộng một lần).
- ✅ Rune resonance (3 socket cùng family offense/defense/mystic, không migration).
- ✅ Echo deity (`/equip kind:echo`, stat ×0.25 flat, không blessing/resonance).
- ✅ Class branch (10 nhánh, Lv.40+, stat tilt, stale-branch sau đổi class bị lọc; `/branch list|set`, 31 commands).

### Phase 4 — Enemy & encounter 🔄
- ✅ Gate-final identity (4a): mỗi Gate boss đánh skill riêng theo level band (daily boss giữ Bakunawa); final boss non-Baku telegraph hiệp 4k+3 → đòn nặng ×2 hiệp 4k+4 (không flag mới, characterization giữ nguyên).
- ⏳ Modifier mở rộng + 2 modifier/gate (4b) · affix mở rộng (4c) · weekly modifier (4d) · Tower mode (4e).
  - ✅ 4b: 5 modifier hành vi (reflect/drain/enrage/shielded/rupture) + gate 4–5 xếp chồng 2 modifier (clamp).
  - ✅ 4c: 5 affix (executioner/bulwark/lifedrinker/berserk/deadeye); elite 1–2, final boss 3.
  - ✅ 4d: weekly modifier xoay theo ISO week (bloodmoon/frenzy/drought) cho hunt thường.
  - ✅ 4e: Tower mode leo tầng vô hạn (`/raid tower`, migration 0015 `tower_floor`/`tower_week`, reset tuần).

### Phase 5 — Battle modes (6–10 ngày) 🔄
- ✅ **World Boss guild** (5a): shared HP pool/server, lazy spawn 7 ngày, daily budget 3 (+2 auto_raids),
  purse theo rank + `boss_top_damage`, board `/raid wboard`, toggle `/raid wauto`. Kích hoạt `boss_state`,
  `boss_spawn_queue`, `boss_attack_log`, `auto_raids`, `boss_top_damage` (migration 0016 `daily_attacks`).
- ⏳ Guild War (`user_guild_activity`) · Ranked season payout (`season_end_payload` + script) · (tuỳ chọn) Co-op 2-vs-1.
  - ✅ 5b: Guild War board `/raid wwar` — đua damage liên server, guild đủ 3 người mới xếp hạng;
    mọi đòn worldboss ghi `user_guild_activity`.

### Phase 6 — QoL & polish (3–5 ngày)
- Battle preview, auto-repeat/sweep, battle log nâng cấp, gợi ý loadout, preset theo nội dung.
- Docs: player-guide, gameplay-implementation cập nhật toàn bộ cơ chế mới.

---

## 3. Nguyên tắc kỹ thuật bắt buộc

1. **OCP**: mỗi skill/passive/effect/blessing mới = 1 entry `register()`; cấm sửa `switch`/`if-chain` trong decorator.
2. **Battle state typed**: mọi biến trận đấu nằm trong `BattleFlags` (field typed) — sai key = lỗi compile.
3. **Deterministic + seeded RNG**: mọi roll qua `wrand` + `Rng`; cùng seed replay được (kể cả sim preview).
4. **Transaction atomic**: mọi grant/reward trong 1 tx với lock đúng thứ tự (bag → character → …); idempotency
   qua `menu_action_receipts` / request ID.
5. **Caps chống exploit**: mitigation 75% · pierce 60% · crit 60% · heal 8% maxHP/round · immunity 2 lần/trận ·
   sudden death anti-stall. Mọi stat mới phải có cap hoặc budget.
6. **Balance ở config**: số liệu trong `src/shared/config/`, đổi balance không sửa code.
7. **Characterization gate**: trước mỗi phase đổi damage, chụp snapshot `combat-characterization.test.ts`;
   cấm `--update-snapshot` nếu chưa review diff.
8. **Text boundary**: wording ở `shared/ui/text/`, emoji ở `icons.ts`, không hardcode trong module.
9. **Schema coverage**: không thêm bảng/cột mà không có đường ghi/đọc + test.

---

## 4. Ma trận ưu tiên (giá trị / công sức / rủi ro)

| Hạng mục | Giá trị (đa dạng chơi) | Công sức | Rủi ro | Ưu tiên |
|---|---|---|---|---|
| Skill system + resource + order (Trục B) | ★★★★★ | Cao | Trung bình | **P0** |
| Khắc hệ damage/armor (Trục A) | ★★★★ | Trung bình | Trung bình | **P0** |
| Gear set + rune resonance (Trục C) | ★★★★ | Trung bình | Thấp | **P1** |
| Echo deity + branch class (Trục C) | ★★★ | Thấp | Thấp | **P1** |
| Monster AI + modifier (Trục D) | ★★★★ | Trung bình | Thấp | **P1** |
| World Boss + Guild War (Trục E) | ★★★★★ | Cao | Cao | **P2** |
| Tower/Infinite + weekly modifier (Trục D) | ★★★ | Trung bình | Thấp | **P2** |
| Season payout + dead-flow closure (Trục F) | ★★ | Thấp | Thấp | **P1** |
| Battle preview + sweep + QoL (Trục G) | ★★★ | Trung bình | Thấp | **P2** |

---

## 5. Rủi ro & giảm thiểu

| Rủi ro | Mô tả | Giảm thiểu |
|---|---|---|
| Power creep | thêm stat/skill làm nội dung cũ trivial | mọi stat có cap; sim EV trước/sau mỗi phase; sudden death giữ anti-stall |
| Vỡ characterization | đổi damage formula phá snapshot | feature flag; snapshot trước/sau; review diff từng dòng |
| Discord latency | decision moment làm chậm trận | chỉ áp cho boss/duel/ranked, timeout 60s = auto-động mặc định |
| Transaction/lock | mode mới (world boss, guild war) thêm tranh chấp | giữ thứ tự lock bag→character; idempotency receipt; test concurrency PostgreSQL |
| Scope creep | "toàn diện" phình vô hạn | chốt theo phase; mỗi phase giao được & rollback độc lập; dead-flow có mục tiêu rõ |
| Balance PvP lệch | skill mới phá meta ranked | test EV cả 2 phía; giới hạn skill trong ranked; season rollback |

---

## 6. Định nghĩa "Hoàn thành" (Definition of Done)

- [ ] Mọi trục A–G có ít nhất một phase đã giao.
- [ ] **Không còn dead flow**: mọi bảng/cột schema có đường ghi + đọc + test, hoặc đã drop có chủ đích.
- [ ] **Đa dạng build**: ≥3 archetype khác nhau cho mỗi class thắng được cùng nội dung (không có 1 build dominant).
- [ ] **Không có lựa chọn chết**: mọi skill/rune/gear/branch đều có tình huống mạnh — không có option luôn thua.
- [ ] `pnpm check` + `pnpm build` + characterization snapshot xanh; coverage gate giữ ≥ hiện tại.
- [ ] Docs (player-guide, gameplay-implementation) mô tả đúng mọi cơ chế đã bật.
