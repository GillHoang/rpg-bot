# Báo cáo rà soát Logic nghiệp vụ & Test case — credd-bot-ts

- **Ngày rà soát:** 2026-09-25
- **Phạm vi:** toàn bộ `src/modules/**` (casino, economy, identity, meta, system, progression, pve, pvp, combat-shared, menu), `src/app/**`, `src/db/**`, `src/shared/**` và toàn bộ 62 file test trong `tests/`.
- **Phương pháp:** 7 luồng review song song theo nhóm module (đọc toàn bộ file nguồn + file test liên quan), sau đó **mọi finding mức MAJOR được kiểm chứng chéo trực tiếp trên source hiện tại** trước khi ghi nhận. Các finding của luồng review mà không còn đúng với code hiện tại đã bị loại và ghi nhận ở §3.

---

## 1. Tóm tắt điều hành

| Hạng mục | Kết quả |
|---|---|
| Typecheck (`tsc --noEmit`) | ✅ Sạch |
| Test suite (`vitest run`) | ✅ 477/477 pass (62 file; 7 test trong `postgres-concurrency.test.ts` bị **skip mặc định** vì thiếu `TEST_DATABASE_URL`) |
| Lỗi CRITICAL (mất/nhân tiền đã chứng minh được) | **0** |
| Lỗi MAJOR (đã kiểm chứng trên code hiện tại) | **6** |
| Lỗi MINOR đã kiểm chứng | 2 |
| Lỗi MINOR do luồng review báo cáo (chưa kiểm chứng chéo) | ~28 |

**Nhận định tổng thể:** nền tảng giao dịch tiền tệ **vững** — mọi đường ghi `usersBag` đều lock `FOR UPDATE` theo thứ tự thống nhất bag → character → users, debit/grant nằm trong cùng transaction, idempotency qua `menu_action_receipts`, và working tree hiện tại đã chứa một vòng fix audit trước đó kèm suite regression `tests/exploit-guards.test.ts` khá kín. Không tìm thấy đường nào mất hoặc nhân đôi tiền ở trạng thái code hiện tại.

Tuy vậy còn **6 lỗi MAJOR thực tế**: 1 lỗi kinh tế casino (baccarat banker +EV — máy in tiền), 1 lỗi phần thưởng ranked (claim được khi bị động làm bao cát), 1 lỗi công thức combat tiềm ẩn (mitigate chia 0), 1 lỗi mất thưởng im lặng (weekly grand qua biên tuần), 1 dead feature (pantheon slot 2/3), 1 khoảng trống test trọng yếu (pity không được assert ở tầng DB).

**Về test case:** suite ở mức **tốt trên trung bình rõ rệt** so với chuẩn bot Discord (~42% là business test chạy DB thật PGlite + migration + seed thật, assertion số cụ thể, có suite concurrency và regression R1–R11). Điểm yếu còn lại: baccarat là điểm mù hoàn toàn, suite concurrency mặc định skip trong CI, và một số test orchestration chỉ mock.

**Lưu ý phương pháp:** 2/7 luồng review (menu+app+db, economy+identity) đã đọc phải trạng thái code **lỗi thời** và báo cáo các lỗi vốn đã được sửa trong working tree. Mọi mục trong §4–§5 dưới đây đều đã được xác nhận bằng đọc trực tiếp code hiện tại; các mục §6 là phát hiện của luồng review có trích dẫn nguồn cụ thể nhưng chưa kiểm chứng chéo từng dòng.

---

## 2. Hiện trạng build & test

- `pnpm typecheck` — sạch, không lỗi.
- `pnpm test` — **59 file pass + 1 file skip** (`postgres-concurrency.test.ts`, 7 test skip vì `describe.skipIf(!TEST_DATABASE_URL)`), tổng **477 test pass** trong ~79s.
- Suite test gồm 62 file, phân loại:
  - ~42% business/behavior test (chạy DB thật PGlite, migration thật, seed thật, assert trạng thái DB cuối).
  - ~20% architecture/structure/DI test (check wiring, AST boundary — không bảo vệ behavior).
  - ~28% text/presentation/UX test.
  - ~7% migration/regression test.
- **Cảnh báo CI:** toàn bộ test race đa-connection thật (double daily claim, double casino spend, deadlock ranked) chỉ nằm trong `postgres-concurrency.test.ts` và **không chạy nếu không cấp `TEST_DATABASE_URL`**. Các test "concurrent" trên PGlite chạy single-connection nên luôn tuần tự hóa, không phát hiện được mất `FOR UPDATE`.

---

## 3. Các lỗi vốn ĐÃ ĐƯỢC SỬA trong working tree (tránh hiểu nhầm với các vòng audit trước)

Các mục sau từng xuất hiện trong review nhưng **không còn đúng với code hiện tại** — đã kiểm chứng trực tiếp:

| Vấn đề cũ | Trạng thái hiện tại |
|---|---|
| `EconomyService.grantCurrency` read-modify-write mất cập nhật | Đã dùng increment nguyên tử `addCreduxWithExecutor` (`EconomyService.ts:43-60`) + test `exploit-guards.test.ts:88-109` |
| `PlayerAccount.spend` nhận số âm/fraction mint tiền | Đã validate `Number.isInteger && > 0` (`PlayerAccount.ts:26-34`) + test `exploit-guards.test.ts:111-122` |
| Daily claim khi `lastDailyClaimDate` ở tương lai trả thưởng lại | Đã có guard + test `exploit-guards.test.ts:124-133` |
| Streak/milestone daily không có test | Đã có test DB thật: streak liên tiếp, reset khi bỏ lỡ, milestone chest đúng cột ở streak 15/30 (`exploit-guards.test.ts:161-232`) |
| Ranh giới ngày Việt Nam 17:00 UTC không được test | `exploit-guards.test.ts:152-159` |
| `Scheduler` không guard re-entry + pool thiếu statement/lock timeout | Đã có cờ `sweeping` chống re-entry (`Scheduler.ts:35-48`), pool production có `statement_timeout: 10s`, `lock_timeout: 5s` (`db/client.ts:18-19`) |
| Notice lỗi của menu reply công khai → spam kênh | `MenuRouter.notice` đã `MessageFlags.Ephemeral` kèm comment lý do (`MenuRouter.ts:305-318`) |
| `/reset user` bỏ sót `active_duels` → duel "ma" | `deleteUserData` đã xoá `active_duels`/`pvp_logs`/`wager_logs`/`ranked_logs` theo seat, `countUserData` đếm cả seat (`ResetRepository.ts` ~130-170) |
| Casino mutation `stored.actions` sống sót qua retry của UnitOfWork | Đã build bản copy `nextStored` (`CasinoSessionService.ts:118-123`) + test regression `tests/casino-session-retry.test.ts` |
| `creux`/`lifetimeCreuxEarned` trần integer 32-bit | Đã là cột `bigint` (`db/tables/identity.ts`) + test trần 2³¹ (`exploit-guards.test.ts:76-87`) |
| `GetBalanceUseCase` bị bypass | `BalanceCommand` đã nhận use case qua container (`registerAllCommands.ts:48`) |
| `ECONOMY_CONFIG.dailyCycleTimeZone` dead config | Config đã dọn, chỉ còn `monthlyCycleLength` kèm NOTE |
| Bet casino âm/0/quá MAX_BET không có test | `exploit-guards.test.ts:234-255` phủ cho cả 2 service |
| Enhancement failure không test | `exploit-guards.test.ts:257-277` (trừ cost, giữ stats, log failure) |
| Ranked weekly claim không assert bảng thưởng | `exploit-guards.test.ts:280-305` (pin số tuyệt đối theo bracket) |
| Duel hết hạn có stake > 0 không test | `exploit-guards.test.ts:306-328` (không bên nào bị trừ tiền) |
| Thua boss không test | `exploit-guards.test.ts:329-364` (mất đúng fee, không chest, chặn retry trong ngày) |
| Crash multiplier curve không pin | `exploit-guards.test.ts:365+` (pin giá trị theo bậc) |
| `/start` race cùng user | `exploit-guards.test.ts:135-150` |

**Kết luận §3:** working tree đã phản ánh một vòng audit + fix trước đó hoàn chỉnh. Báo cáo này chỉ liệt kê những gì **còn tồn tại**.

---

## 4. Findings MAJOR (đã kiểm chứng trên code hiện tại)

### 4.1 [MAJOR] Casino Baccarat: cược "banker" là +EV ≈ +1.24%/ván — máy in tiền không giới hạn
- **Vị trí:** `src/modules/casino/domain/games/BaccaratGame.ts:66` (`payout = Math.floor(bet * EVEN_MONEY)` cho **cả hai bên**), `src/shared/config/casinoPayouts.ts:8` (`EVEN_MONEY = 2`).
- **Vấn đề:** banker thắng thường hơn player do được rút sau (mô phỏng theo đúng rules đã implement: player ~44.75%, banker ~45.99%, tie ~9.26%). Trả 2x gross cho cả hai bên khiến EV(banker) ≈ **1.0124** trong khi thiết kế mục tiêu là RTP 100% — về mặt toán học không thể có cả hai bên cùng RTP 100%.
- **Kịch bản:** `/casino baccarat bet:500000 choice:banker` lặp vô hạn (không có cooldown/rate-limit trong module) → lời dài hạn ~6.210 creux/ván, phương sai thấp nên gần như chắc chắn lời.
- **Đề xuất:** trả banker 1.95x gross (commission 5% chuẩn → EV ≈ 0.998), hoặc trả banker 2x nhưng player chỉ 1.95x; thêm test thống kê EV cho cả hai phía.
- **Ghi chú:** comment trong code ghi "No commission (virtual economy)" — là quyết định có chủ ý, nhưng phần thưởng cho bên banker vẫn phải giảm nếu muốn giữ EV ≤ 1 cho mọi lựa chọn.

### 4.2 [MAJOR] Ranked: claim thưởng tuần được khi chưa từng chủ động đấu (bị động làm bao cát vẫn claim)
- **Vị trí:** `src/modules/pvp/application/RankedService.ts:394-410` (`settleParticipant` ghi `ranked_logs` cho **cả bên bị động**) + `:427` (`insertLog` theo từng participant) + `src/modules/pvp/infrastructure/RankedRepository.ts:28-34` (`findWeeklyFight` chỉ cần ≥1 row theo `playerId`, không phân biệt initiator/defender).
- **Vấn đề:** khi A initiates fight, service ghi log cho cả đối thủ B. B chưa từng gọi `/ranked fight` nhưng vẫn thỏa điều kiện "≥1 trận trong tuần" và claim bảng thưởng theo bracket hiện tại (Mortal 50k → Divine 800k creux + genesis chest). Matchmaking mở rộng window tới toàn server ở tầng cuối nên account AFK rating cao liên tục bị kéo vào làm bao cát và vẫn claim đều mỗi tuần.
- **Kịch bản:** account Divine (2000) AFK; mỗi tuần bị chọn vài lần, thua (rating giảm ~16 điểm/thua), vẫn `claim` → ok 800k + genesis chest.
- **Đề xuất:** thêm cột `role`/`initiated` vào `ranked_logs` (hoặc chỉ ghi log có perspective cho initiator), và `findWeeklyFight` chỉ đếm row do chính người đó chủ động.

### 4.3 [MAJOR] Combat: `mitigate()` chia 0 và không đơn điệu khi DEF hiệu dụng âm (latent)
- **Vị trí:** `src/modules/combat-shared/domain/DamageCalculator.ts:31-34` — `atk × (1 − min(0.75, def/(def+600)))`, không kẹp `def ≥ 0`; nguồn giá trị âm: `defDownPct` trong `BattleAttack.ts` không được kẹp (khác với `atkDownPct` có kẹp `Math.min(1, …)`).
- **Vấn đề:** với `effDef = −600` → chia 0 → `Infinity` damage (one-shot); `effDef ∈ (−600, 0)` → mitigation âm → damage bị **nhân lên**; `effDef < −600` → damage lại về mức thấp — hàm không đơn điệu.
- **Hiện trạng:** nguồn `def_down` duy nhất hiện là Mage 0.25 nên chưa chạm ngưỡng — đây là bom nổ chậm nếu sau này thêm nguồn shred %.
- **Đề xuất:** kẹp `defDownPct` vào [0, 1] và kẹp `effDef ≥ 0` trước `mitigate`; thêm test cho `mitigate` với def âm.

### 4.4 [MAJOR] Meta: Weekly Grand + weekly quest của tuần cũ mất thưởng im lặng sau biên tuần
- **Vị trí:** `src/modules/meta/application/QuestService.ts:233-244` — `claimWeeklyGrand` chỉ nhìn `weekWindowAt(this.clock.now())`.
- **Vấn đề:** đúng 00:00 thứ Hai (Việt Nam), `ensureWeeklyQuests` sinh board tuần mới; 3 weekly đã hoàn thành của tuần cũ trở nên không thể với tới — Weekly Grand (1 diamond chest + 100k creux + 100 believer EXP) mất hoàn toàn nếu player không kịp claim trước biên. Không có grace period, không auto-grant, UI không hiển thị tuần trước.
- **Kịch bản:** hoàn thành weekly thứ 3 lúc 23:59 Chủ nhật; mở `/quest claim` lúc 00:01 thứ Hai → `QUEST_CLAIM_NOT_READY` vĩnh viễn cho công sức tuần cũ.
- **Đề xuất:** grace window (cho claim grand của `weekWindowAt(now − X giờ)`), hoặc auto-grant khi board tuần mới được sinh ra mà còn grand pending, hoặc tối thiểu hiển thị "tuần trước chưa claim" trong `view`.

### 4.5 [MAJOR] Progression: pantheon slot 2/3 là dead feature — không có đường trang bị từ gameplay
- **Vị trí:** `src/modules/progression/presentation/LoadoutCommand.ts:33` (`addChoices` chỉ `['weapon', 'armor', 'deity']`); đối chiếu `LoadoutService.equipDeity` hỗ trợ `deity2`/`deity3` và `StatAssemblyService` đọc đủ `equippedDeity2Id/3Id` (weight 0.5/0.25 + resonance).
- **Vấn đề:** không có lệnh/menu nào ghi được `equippedDeity2Id`/`equippedDeity3Id`; auto-equip sau summon cũng chỉ slot 1. Cơ chế resonance +20% và weight pantheon hoàn toàn không reach được trong gameplay.
- **Kịch bản:** player summon 2 thần, muốn set pantheon 3 người → không có lệnh nào làm được.
- **Đề xuất:** thêm choice `deity2`/`deity3` cho `/equip` hoặc panel menu chọn slot; nếu cố ý trì hoãn tính năng thì ghi rõ trong doc.

### 4.6 [MAJOR — test gap] Pity counter không được assert persist ở tầng DB sau pull thường
- **Vị trí:** `tests/progression-summon-module.test.ts` (mock `upsertPity`, không assert tham số); `tests/m7.test.ts:310-311` (chỉ assert pity = 0 sau **relic** pull — path này không ghi pity nên test pass bất kể pull thường hỏng); `tests/gameplay-domain.test.ts:33-38` (chỉ math thuần).
- **Vấn đề:** xoá dòng ghi pity trong `RunSummonUseCase` (upsert `planned.pityAfter`) → **toàn bộ suite vẫn xanh**. Regression ở đây phá cơ chế bảo vệ người chơi quan trọng nhất của gacha.
- **Đề xuất:** 1 test DB-level: N pull Epic (mock rng) → `pity_counters.pity_count = N`; pull ở 499 → lượt kế ép Legendary và pity về 0.

### 4.7 [MAJOR — UX] Gear Common (khởi đầu) không enhance được nhưng báo "đã đạt mức tối đa"
- **Vị trí:** `src/shared/config/enhancement.ts` (`ENHANCE_COST` không có `Common`, `nextAttempt` trả null); `EnhanceCommand.ts:56-58` hiển thị `ENHANCE_MAXED`; seed starter là Common.
- **Vấn đề:** người chơi mới thử `/enhance` vũ khí khởi đầu nhận thông báo "Trang bị đã đạt mức tối đa hoặc không thể nâng cấp" — sai ngữ nghĩa (không phải maxed, mà tier không enhance được), dễ gây report nhầm.
- **Đề xuất:** tách trạng thái `not-enhanceable` khỏi `maxed` với thông điệp riêng, hoặc cho Common enhance được.

---

## 5. Findings MINOR (đã kiểm chứng trên code hiện tại)

### 5.1 PVP shop: tier gate fail-open khi thiếu row catalog
- `src/modules/pvp/application/PvpShopService.ts` (~:140-144): `COSMETIC_TIER_MIN_LEVEL[catalog?.tier]` → `undefined` khi catalog thiếu row → **bỏ qua** gate believer level, item chưa seed vẫn mua được. Đề xuất: catalog thiếu → chặn (fail-closed) thay vì cho qua.

### 5.2 Casino `choice` là chuỗi tự do — remap ngầm về phía còn lại
- `src/modules/casino/domain/games/BaccaratGame.ts:35` (`choice === 'banker' ? 'banker' : 'player'`, tương tự coin/dice): người chơi gõ `Banker`/`BANKER` bị đặt cược vào **player** (phía −EV sau khi fix 4.1) mà không hay biết. Đề xuất: dùng `.addChoices()` của discord.js ở `CasinoCommand`.

### 5.3 Ledger `game_logs` chỉ mang creux — shards/essence/relic/chest không đối soát được
- `LootService.ts:130` (open chest) và `:254` (rune bag): log chỉ ghi creux before/after. Schema `game_logs` có sẵn cột essence/chest nhưng không dùng ở các đường này — khi điều tra khiếu nại "mở rương mất mà không nhận item" chỉ truy ngược được rune/gear qua uid. (Đã có test "replayable ledger row per chest" ở `exploit-guards.test.ts:218-232` — nhưng nội dung ledger vẫn thiếu các tài nguyên ngoài creux.)

---

## 6. Findings MINOR từ luồng review (có trích dẫn nguồn, chưa kiểm chứng chéo từng dòng)

> Đánh dấu **(A)** = luồng review đọc code hiện tại và trích dẫn nguồn cụ thể, độ tin cậy cao; kiểm tra nhanh khi fix.

**Casino**
- Crash multiplier làm tròn 2 chữ số lệch lên → +0.30% EV ở chiến lược "push 1 rồi cash" (test hiện dùng tolerance 0.011 nên không chặn) — `casinoPayouts.ts:41-45`. (A)
- `recoverExpired` xử lý tuần tự; 1 session lỗi làm cả vòng dừng, các session sau không bao giờ được settle — `CasinoSessionService.ts:174-177`, `BotMaintenance.ts:37-47`. (A)
- Ledger session interactive: `balanceBefore` chụp lúc start, nếu có giao dịch xen kẽ trong 60s thì log không khép số dư — `CasinoSessionService.ts:84,144-163`. (A)
- Cho phép chơi game stateless song song với session interactive đang mở (không nhất nhất với thông điệp `CASINO_SESSION_BUSY`) — `CasinoService.ts:49-76`. (A)

**Economy / Identity**
- Idempotency daily claim phụ thuộc lock "tình cờ" trên bảng `users_bag` thay vì khoá thẳng row `users` chứa state; `updateStreak` không có guard `WHERE` — `DailyRepository.ts:22-40,82-91`. (A)
- Rune pool seed bị thu hẹp âm thầm khi admin tắt `isAvailable` — người chơi vẫn trả full price cho pool hiển thị đầy đủ — `LootRepository.findRunePool`, `LootGrantService.ts:20-21`. (A)
- Pool gear rỗng → rollback multi-open với lỗi `missingSeed` chung chung thay vì thông báo thân thiện — `LootGrantService.ts:33,47`, `weightedRandom.ts:23-29`. (A)
- `ProfileService`/`GetBalanceUseCase` đọc nhiều SELECT không transaction → torn read hiển thị (display-only) — `ProfileService.ts:43-46`. (A)
- `ClassChangeService.ts:45-46`: check thiếu token trước check trùng class → thông báo lỗi sai ngữ cảnh. (A)

**Meta / System**
- `SeasonService.ensureActive` trả về season đã hết hạn cho tới khi ai đó nhớ chạy `season:rollover` — `SeasonService.ts:17-22`. (A)
- `questRefreshesToday` là cột chết (ghi cứng 1, không bao giờ đọc) — `QuestService.ts:228`, `db/tables/identity.ts`. (A)
- Guard `QUEST_DAY_CHANGED` dead-code ở `/quest refresh` (presentation không truyền `expectedDay`) — `QuestCommand.ts:27`. (A)
- Quest hoàn thành bị mark trước khi chắc chắn có bag — dữ liệu lệch sẽ mất thưởng tĩnh không log — `QuestService.ts:326-332,365-371`. (A)
- Preview `/reset user` thiếu bảng `tickets` (cột `user_id`, không nằm trong USER_TABLES) → số preview lệch số thực xoá; `resetUser` không khoá ACCESS EXCLUSIVE như `resetAll` — `ResetRepository.ts:37-76`. (A)
- `equipCosmetic` không check `catalog.isActive`; list không lọc item deprecated — `CosmeticService.ts:127-145`. (A)
- Label quest hardcode số target trong `shared/ui/text/quest.ts` — lệch config khi đổi balance; có 2 dead label cho quest type không tồn tại. (A)
- `equipTitle` dùng magic number 0 làm "gỡ title" rò rỉ quy ước presentation vào service — `CosmeticService.ts:177-180`. (A)
- Tên season sinh theo `count + 1` trùng lịch sử sau `reset all` — `SeasonService.ts:24-31`. (A)

**PvP / Combat**
- Elo không bảo toàn zero-sum ở floor 0 và demotion shield (lạm phát rating hệ thống) — trade-off thiết kế nên ghi rõ vào doc — `RankedRatingService.ts:24-41`. (A)
- Banned user vẫn tạo/nhận duel và vẫn ranked-fight với chính mình làm initiator — `DuelService.ts:206-213`, `RankedService.ts:155-156`. (A)
- Debuff trùng tag không refresh/cộng dồn — proc thứ 2 trở đi vô nghĩa — `CombatantState.ts:39-56` vs `BattleAttack.ts:77-81`. (A)
- Cột timestamp của duel/pvp_logs là `timestamp without time zone` (trong khi `ranked_logs` đã timestamptz) — lệch hạn duel khi đổi TZ server — `db/tables/pvp.ts:18-33,64-66`. (A)
- Doc drift: tenacity (doc "shave duration" vs code "chance bỏ hẳn"), Fighter 15/35% vs doc 25/50%, Knight 2.5/25% vs doc 2/15% — `CombatantState.ts:81`, `FighterStrategy.ts`, `KnightStrategy.ts`. (A)
- Farm self-duel stake 0 giữa 2 account cùng người vẫn tính win cho quest/title/streak — `DuelService.settle`. (A)

**Menu / App**
- `recordFailure('transaction')` đếm cả business AppError → metric hạ tầng bị nhiễu — `DrizzleUnitOfWork.ts:21`. (A)
- `acquire` check `busy` trước `expired` — session hết hạn đang bận báo sai trạng thái — `MenuSessionStore.ts:88-93`. (A)
- `render()` mutate session (ghi `screen`/`gateId`) — hợp đồng "render thuần" bị vi phạm ngầm — `MenuGatePanels.ts:85-87`, `MenuGameplayService.ts:93-96`. (A)
- `selectSession` không copy `gateId` — bất biến ngầm nhờ whitelist, dễ vỡ khi refactor — `MenuRouter.ts:102-113`. (A)
- Render `quests` thực hiện WRITE (sinh quest lazy) trong lộ trình đọc — đúng về race nhưng nên ghi rõ vào hợp đồng — `MenuGameplayService.ts:86-90`. (A)
- 3 quy tắc cắt ngắn battle-log khác nhau (2800/2800/3500) cùng tồn tại; `logPages` dead-code production — `gameplayPanels.ts:192-238`, `BattleLogPager.ts:59-65`. (A)
- Không có graceful shutdown (SIGTERM/SIGINT) — `bot.stop()` không bao giờ được gọi trong production — `index.ts:15-26`. (A)
- Session `busy` treo vĩnh viễn không bị sweep thu hồi (bounded leak); `portalId` là field chết — `MenuSessionStore.ts:111-115,23`. (A)
- Comment `events.ts`/`DiscordBot` mô tả observer quest-progress không tồn tại; `subscribeDomainEvents` không guard double-subscribe — `events.ts:4-21`, `bot.ts:17-27`. (A)
- `ResetRepository` nối SQL bằng `sql.raw` — an toàn chỉ nhờ validate tầng service — `ResetRepository.ts:104-158`. (A)

**Progression / PVE**
- `findPity` không `FOR UPDATE` — an toàn chỉ nhờ `lockBag` chạy trước (ràng buộc ngầm không comment/test) — `SummonRepository.ts:18-20`. (A)
- `spendCredux` là read-modify-write tuyệt đối thay vì arithmetic SQL có điều kiện (tự thân repo không atomic) — `EnhancementRepository.ts:68-75`. (A)
- `planPulls` query lại deity roster cho từng pull → giữ bag lock lâu không cần thiết khi summon 30 — `RunSummonUseCase.ts:194-209`. (A)
- Guard `expectedDay` (dayChanged) của boss chỉ menu dùng, slash command không truyền, không test — `RaidService.ts:446-448`, `RaidCommand.ts:49`. (A)
- Thống kê lẫn lộn: thắng final-boss portal tăng `bossKills` nhưng `battleType = 'raid'` — `RaidService.ts:392-403`. (A)
- Seed `mobs.ts` lệch công thức doc (`perLevel × (level − 1)` vs code `× lv` cho daily boss) và comment stale "Elite chưa port" — `mobs.ts:9-10,108`. (A)
- Balance notes: PITY_THRESHOLD 500 gần như trang trí (kỳ vọng reset ~67 pull); daily boss scale tuyến tính sẽ bị endgame trivial hoá so với final portal — `gachaRates.ts`, `MonsterEncounterService.ts:133-135`. (A)

---

## 7. Đánh giá chất lượng test case

### 7.1 Điểm mạnh
- **Chiến lược DB đúng cách:** business test chạy PGlite + toàn bộ migration thật + seed thật, gọi service thật và assert trạng thái DB cuối — không assert mock.
- **Suite regression `exploit-guards.test.ts`** (16 scenario, xem §3) chốt được các nhánh exploit rẻ nhất: bet validation, concurrent grant, spend âm, future claim date, streak/milestone, ranked bracket, duel expiry có stake, boss loss, crash curve.
- **Concurrency có thật:** `postgres-concurrency.test.ts` (daily claim đôi, casino double-spend, ranked crossed-match không deadlock) — nhưng xem cảnh báo skip ở §2.
- **Suite `review-business-repro.test.ts` (R1–R11)** chất lượng xuất sắc: integer overflow EXP, lock order, streak, refund quota.
- `menu-gameplay.test.ts` (30 test, SQL thật) là bộ test menu/flow mạnh: forged click, stale revision, receipt dedupe, rollback dây chuyền, không replay khi editReply lỗi.
- `combat-characterization.test.ts` + `combat-review-regressions.test.ts`: lưới hồi quy combat rất chặt (snapshot hash 36 cặp class × 4 seed).

### 7.2 Test yếu / vô nghĩa
- `tests/economy-module.test.ts` — mock 100% repo, không assert bất kỳ giá trị thưởng/streak nào; nếu `DailyRepository.applyReward` cộng nhầm cột, test vẫn xanh. (Phần giá trị đã được `exploit-guards` bù — cân nhắc gộp/bỏ.)
- `tests/progression-summon-module.test.ts` — orchestration-only; `upsertPity` không bao giờ được assert (→ §4.6).
- Assertion yếu cục bộ: `combat-shared-module.test.ts:48` (`toBeDefined`), `menu-gameplay.test.ts:204` (`toBeTruthy` trên string), `service-cohort-a-di.test.ts:171` (`toBeTruthy` gộp), `dip-srp-extraction.test.ts:24-25` (check shape).
- `m7.test.ts:276` — `expect(ratingAfter).not.toBe(ratingBefore)` **flaky**: 2 người mới 1000 Elo đấu hòa thật (Δ0) sẽ fail; nên force outcome như `ranked-draw.test.ts`.
- `tests/summon-result.test.ts:10-11` — nhân bản `summarizePulls`/`fitContent` vào test thay vì import → có thể drift khỏi code thật mà test vẫn xanh.
- Khối structure test (`architecture`, `modules`, `app-structure`, `text-boundaries`) sẽ pass dù business logic bị xóa sạch — chỉ là báo cảnh, cần hiểu đúng vai trò.
- `combat-characterization` là snapshot: bắt được thay đổi, không tự phát hiện behavior sai từ đầu (đã có `combat-sim`/`portal-balance` bù — giữ cặp này).

### 7.3 Lỗ hổng che phủ còn lại (top, sau khi trừ phần đã kín ở §3)
1. **Baccarat: 0 test** — toàn bộ ma trận lá thứ 3, natural, tie-push, payout 2x/1.95x và EV hai phía không được chốt bởi test nào (chỉ tên subcommand được assert trong `discord-flow.test.ts:38`). Trùng với MAJOR 4.1 — ưu tiên cao nhất.
2. Pity persistence DB-level (§4.6).
3. Claim weekly ranked của bên bị động (§4.2) — mọi test hiện tại đều claim bằng initiator.
4. Weekly grand qua biên tuần (§4.4) — không test nào chạm weekly cũ sau khi tuần đổi.
5. `postgres-concurrency.test.ts` skip mặc định trong CI — bất biến lock chỉ được verify tuần tự trên PGlite.
6. Race lazy-generation quest (2 tx cùng mở menu lần đầu) và race `/quest refresh` — không có case nào ở tầng Postgres thật.
7. Nhánh phủ định cosmetic/title: equip khi không sở hữu (`COSMETIC_NOT_OWNED`), tier-lock lúc **equip** (hiện chỉ test lúc mua), unequip title id=0.
8. `ReputationService`: nhánh grant một phần gần cap (480/500 + 50 → granted 20) chưa được assert — nhánh quan trọng nhất của công thức cap.
9. Casino: nhánh `invalid-action` (whitelist action) không test; click từ session khác (`sessionId !== start.sessionId`); `recoverExpired` khi 1 act giữa danh sách ném lỗi.
10. Final-boss portal tier 10 end-to-end qua `RaidService.run` (ELITE loot + mở gate kế + `bossKills`) và case tier-skip của `RaidGatePolicy`.
11. Scheduler overlap: guard `sweeping` đã có nhưng không test nào assert hành vi re-entry.
12. Test JSON của `updateSession`/`replayGame` khi `stateJson` hỏng shape (kịch bản recovery treo — §6 casino).

---

## 8. Đề xuất hành động theo độ ưu tiên

**P0 — vá exploit kinh tế (làm ngay)**
1. Baccarat: trả banker 1.95x gross (commission 5%) — 1 dòng + test EV hai phía.
2. Ranked: `findWeeklyFight` chỉ đếm log do chính người đó initiate (thêm cột `role` hoặc chỉ ghi log perspective cho initiator).
3. Bật `postgres-concurrency.test.ts` trong CI (cấp `TEST_DATABASE_URL`) — tấm khiên duy nhất chống mất `FOR UPDATE`.

**P1 — chặn mất thưởng/lỗi tiềm ẩn**
4. `mitigate`: kẹp `defDownPct ∈ [0,1]` và `effDef ≥ 0` + test def âm.
5. Weekly grand: grace window hoặc auto-grant qua biên tuần + test.
6. Pantheon: mở `deity2`/`deity3` cho `/equip` (hoặc ghi rõ tính năng trì hoãn).
7. Test pity persistence DB-level + baccarat test suite.
8. `pvp shop`: tier gate fail-closed khi thiếu catalog.

**P2 — vệ sinh & UX**
9. Common gear → thông điệp `not-enhanceable` riêng.
10. `.addChoices()` cho option `choice` của casino.
11. Crash multiplier làm tròn xuống để EV ≤ 1 mọi bậc; siết test EV từ tolerance 0.011 về ≤ 1.0000001.
12. `recoverExpired`: try/catch từng session, tiếp tục vòng.
13. Bổ sung ledger shards/essence/chest vào `game_logs` (schema đã có cột).
14. Các minor §6 theo module (doc drift combat, timestamp without TZ, ensureActive expired season, label quest sinh từ config…).

**P3 — chất lượng test**
15. Dọn test mock-only (`economy-module`, `progression-summon-module`) hoặc nâng cấp assertion.
16. Sửa test flaky `m7.test.ts:276`; export các hàm thuần mà `summon-result.test.ts` đang mirror.
17. Bổ sung 12 khoảng trống ở §7.3 theo thứ tự liệt kê.
18. Sửa doc drift: `package.json` description ghi "drizzle-orm/SQLite" trong khi production là **PostgreSQL** (node-postgres; PGlite chỉ dùng cho test).

---

## Phụ lục A — Tổng hợp nghiệp vụ chính theo module

**Casino** — `MAX_BET` 500k; mọi thắng trả gross (EVEN_MONEY 2); slots ladder Σ prob·mult = 1.000; crash: xác suất nổ push n = min(75, 15+2(n−1))%, multiplier compounding, max 10 push, timeout = cash-out (chưa push → hoàn cược); baccarat punto banco chuẩn, không commission (⚠ xem 4.1); blackjack: dealer đứng 17, natural trả 1:1, push hoàn stake, timeout = stand. Stateless: 1 tx (lock → seed crypto mới → play → settle → progress). Interactive: trừ cược trước, 1 session active/người, TTL 60s, revision check, settle đúng 1 lần (click race + recovery sweep 15s hội tụ).

**Economy / Daily** — chu kỳ ngày theo Asia/Ho_Chi_Minh (reset 17:00 UTC); 2 bộ đếm `monthlyStreak` (vòng 30 ngày, wrap `% 30 + 1`) và `overallStreak`; thưởng 50k→1.5M theo ngày, gold chest các ngày {7,14,21,28,29,30}, milestone boss chest ở streak 15 và ≥30 chia hết 15; claim + quest progress + reputation trong 1 transaction, event sau commit; idempotency qua check ngày + lock `users_bag`. Loot: 6 loại rương, tối đa 10 lượt/lệnh, mọi roll + grant trong 1 tx có lock; không pity ở chest (pity chỉ ở summon).

**Identity** — `/start` 1 tx, double-check `hasCharacter` + `onConflictDoNothing` chống race, grant starter 1 lần; `/class change` tiêu 1 token, chỉ đổi class, stats recompute lúc đọc; CHECK DB chặn creux/shards/valor âm; `creux`/`lifetimeCreuxEarned` là bigint.

**Meta** — quest sinh lazy 3 daily + 3 weekly từ pool không trùng loại; progress qua `GameplayProgressCoordinator` trong cùng tx của hành động gameplay; thưởng daily 20k–60k + shards, weekly 50k–150k + valor; đủ 3 daily → Sacred Relic; đủ 3 weekly → Weekly Grand (⚠ 4.4); `/quest refresh` 1 lần/ngày miễn phí, giữ quest đã xong. Believer EXP theo nguồn (25–100), cap 500/ngày, level cost 400+100×N, level 10 → title `devout_believer`. Cosmetic tier gate believer 1/5/10, mua bằng valor, quota theo season (PK upsert). Season lazy-create 30 ngày, advisory lock, rollover thủ công.

**Progression / PVE** — gacha: Epic 64.5 / Mythic 34 / Legendary 1 / Supreme 0.5 (%); pity chỉ tăng trên Epic/Mythic, 500 ép Legendary; dupe → essence 1/2/5/10; giá 100 shards/lượt, relic pull không tốn shards và không đụng pity. Enhancement: fail vẫn mất cost, stats recompute từ bảng hệ số (không cộng dồn sai số). Ascension: 10 sigils + essence + creux, prestige flag thuần. Portal: 5 gate × 10 tầng, tier kế = cleared+1, gate N+1 mở theo clear hoặc minLevel 1/15/30/45/60; hunt cooldown 15s; daily boss: fee 10k, 1 lần/ngày VN, fee rollback nếu reward lỗi, thua vẫn mất fee.

**PvP / Combat** — damage = mitigate × variance ±10% × crit(×2) × (1 − reduction) × sudden-death ramp; mitigated cap 75%, pierce cap 60%; round 31–40 blood moon (−2% maxHP/round); hết 40 round so HP%, bằng nhau hòa. Duel: pending 60s, stake ≥ 1000 hoặc 0, tiền chỉ debit khi accept, hòa refund, winner nhận pot; expiry chỉ xoá row (không tiền đang giữ). Ranked: Elo K=32 zero-sum, floor 0, demotion shield 1 lần, claim tuần theo ISO week VN theo bracket hiện tại (⚠ 4.2), idempotent qua `lastWeeklyClaimWeek`.

**Menu / App / DB** — session menu là UI snapshot in-memory, state thật trong DB; ownership + messageId binding + revision + busy + TTL + whitelist buttons của panel đang render; idempotency server-side qua `menu_action_receipts`; menu và slash command dùng chung service instance. Scheduler: sweep 30s có guard re-entry; reset daily/weekly kiểu lazy theo ngày VN. `/reset`: 3 lớp owner gate; reset all TRUNCATE CASCADE giữ catalog seed; reset user xoá đúng 1 user qua 40+ bảng + các bảng theo seat. `DrizzleUnitOfWork`: retry tối đa 3 lần cho 40P01/40001, backoff + jitter. Pool production: max 10, statement_timeout 10s, lock_timeout 5s.
