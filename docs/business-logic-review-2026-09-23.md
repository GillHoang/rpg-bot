# Rà soát bug và logic nghiệp vụ — 2026-09-23

Phạm vi review ban đầu: working tree tại commit `99087b0`, sau refactor text/emoji. Rà soát trực tiếp, không dùng agent con. Các vị trí dòng trong phần phát hiện tham chiếu mã trước sửa; không quy kết chúng do refactor text gây ra.

Kiểm tra tập trung vào combat, EXP, phần thưởng, ranked/duel, shop, quest và các điểm lặp logic. P1: nên sửa trước khi phát hành; P2: lỗi chức năng cần sửa; P3: sai số hiển thị.

## Trạng thái bản sửa

Đã sửa R1–R11 trong workspace theo yêu cầu tiếp theo của người dùng. Có migration mới `0003_combat_progression`, giữ nguyên migration cũ; chưa áp dụng lên database ứng dụng. Xem [hướng dẫn triển khai](audit-deployment.md).

Kiểm chứng cuối: **342 pass, 0 fail, 7 skipped / 349 tests**. Lint, typecheck/build, 234 module import smoke check, text boundaries và Markdown links đều pass. Chi tiết ở [nhật ký sửa lỗi](journals/260923-business-logic-fixes.md).

- Cấu hình blessing là nguồn hệ số runtime; bonus damage dùng đúng đơn vị và Tailwind chỉ áp một lần mỗi combatant.
- Shop chỉ ghi tiền/quota sau khi cấp quyền sở hữu thành công trong cùng transaction.
- Ranked tách tham gia khỏi thắng: người gọi được tính quest kể cả hòa/thua, winner nhận reputation; cả hai bên được xét kỷ lục/title thăng hạng. Đây là policy đã chọn để thống nhất mô tả title với gameplay.
- First Blood được cấp idempotent khi thắng duel; duel hết hạn được dọn trước khi chiếm slot, xung đột slot trả busy và dọn claim dở dang.
- Raid/ranked dùng chung phép đếm SQL sau trận không thắng cuối cùng, không giới hạn 50 và không tải toàn bộ history vào bộ nhớ.
- Đã dùng chung presenter daily, phép tính progress quest và settlement từng người trong ranked. Menu mở ephemeral và dùng format số Việt Nam; cập nhật test nhãn “Kinh nghiệm” theo nội dung hiện hành.
- Bộ snapshot combat đã cập nhật sau khi sửa số round và Tailwind; thêm assertion trực tiếp số round bằng số log round để tránh snapshot lưu lại lỗi này.

## Các phát hiện

### R1 — P1: Không thể lên cấp 51

- Vị trí: `src/db/schema.ts:860`, `src/db/migrations/0002_audit_integrity.sql:46`; cấu hình đối chiếu `src/config/combatExp.ts:6`.
- Cấu hình cho phép cấp 100 nhưng CHECK của database chỉ cho phép 1–50. `RaidRewardService.grant` cập nhật cấp trong transaction nhận thưởng.
- Tái hiện: nhân vật cấp 50, EXP cách mốc lên cấp đúng 1; nhận thêm 1 EXP. PostgreSQL/PGlite báo `character_valid_level`, transaction rollback, nhân vật vẫn cấp 50. Phần thưởng trong cùng transaction cũng không được ghi.
- Hướng sửa: thống nhất cap nghiệp vụ và thêm migration thay constraint cho database đã triển khai; sửa riêng schema TypeScript không đủ. Kiểm thử mốc 50→51 và cấp tối đa. Xử lý đồng thời R11.

### R7 — P1: Shop trừ Valor khi mua title/cosmetic đã sở hữu

- Vị trí: `src/services/PvpShopService.ts:82–107`; `src/services/CosmeticService.ts:72–92`.
- Shop tăng lượt mua theo mùa và trừ tiền trước khi cấp vật phẩm; bỏ qua kết quả boolean của hàm cấp. Insert quyền sở hữu dùng `onConflictDoNothing`, nên mua trùng vẫn trả thông báo thành công.
- Tái hiện: đã có `rank_champion`, có 100 Valor, mua `title_champion` giá 80. Còn 20 Valor nhưng vẫn chỉ sở hữu title cũ. Trường hợp tương tự có thể xảy ra với cosmetic được mua ở mùa trước.
- Hướng sửa: kiểm tra quyền sở hữu và bảo đảm cấp thành công trước khi tiêu tiền/lượt mua trong cùng transaction. Xử lý cả xung đột cấp trùng, không chỉ thêm kiểm tra ở UI.

### R2 — P1: Solar Fury và Tidal Wrath cộng damage nhỏ hơn dự kiến 100 lần

- Vị trí: `src/domain/combat/DeityBlessingDecorator.ts:49–58`; `src/domain/combat/DamageCalculator.ts:37–38`.
- `damagePctBonus` dùng đơn vị điểm phần trăm và được chia 100 khi tính damage. Blessing lại truyền fraction `0.06`/`0.35` trong khi log hiển thị `6`/`35`.
- Tái hiện với strength=1, đòn không crit: Solar trả multiplier `1.0006` thay vì `1.06`; Tidal khi còn 50% HP trả `1.00175` thay vì `1.175`.
- Hướng sửa: thống nhất đơn vị ở ranh giới cấu hình–combat, chuyển fraction sang điểm phần trăm đúng một lần. Kiểm tra damage thực tế, không chỉ log.

### R3 — P2: Tailwind cộng dồn vĩnh viễn qua từng round

- Vị trí: `src/domain/combat/DeityBlessingDecorator.ts:38–43`; `src/domain/combat/BattleEngine.ts:145–147`.
- Mỗi `onRoundStart` cộng tiếp vào `initiative_bias`, không xóa phần bonus của round trước.
- Tái hiện strength=1: sau hai round bias=0.5. Khi đối thủ không có bias, xác suất đi trước tăng từ 75% lên 100% từ round 2, thay vì giữ bonus cố định 25 điểm phần trăm.
- Hướng sửa: tính bonus mỗi round từ trạng thái nền hoặc đặt hiệu ứng một lần; bảo toàn cách kết hợp với các nguồn initiative khác. Thử nhiều round và cả hai bên có Tailwind.

### R4 — P2: Nhiệm vụ “Đủ 5 trận ranked” chỉ tăng cho người thắng

- Vị trí: `src/services/RankedService.ts:223`; đối chiếu `src/text/quest.ts:20,30` và quy tắc progress trong `src/services/gameplayProgress.ts`.
- Nhánh gọi progress chỉ chạy khi không hòa và chỉ cho winner. Nó gộp sự kiện tham gia ranked với phần thưởng reputation dành cho thắng ranked.
- Tái hiện: cả hai người có quest ranked; người gọi lệnh thua. Quest của người gọi vẫn 0, đối thủ tăng 1. Nhánh hòa không gọi progress.
- Hướng sửa: tách `ranked_played` khỏi `ranked_win`; trận thua/hòa vẫn tính tham gia cho người gọi. Chính sách có tính lượt tham gia cho đối thủ thụ động hay không cần được quy định riêng; không tự suy ra từ phần thưởng thắng.

### R5 — P2: Kỷ lục chuỗi thắng ranked của đối thủ không được cập nhật

- Vị trí: `src/services/RankedService.ts:397–438`.
- Rating, win/loss và history được ghi cho cả hai người, nhưng `highestRankStreak` chỉ được tính cho người khởi tạo. Đối thủ thắng rồi thua trước khi tự gọi ranked có thể mất cơ hội ghi nhận kỷ lục đó.
- Tái hiện: ép đối thủ thắng trận đầu; có win/rating mới nhưng `highestRankStreak` vẫn 0.
- Hướng sửa: settlement theo từng participant, cập nhật kỷ lục sau khi ghi history cho cả hai bên.
- Điểm chính sách liên quan: đối thủ vượt mốc thăng hạng cũng không nhận title. Code có comment chủ ý “initiator only”, trong khi mô tả title chỉ yêu cầu đạt hạng. Đây là mâu thuẫn contract cần thống nhất; không coi riêng việc thiếu title là bug chắc chắn khi chưa chốt quy tắc.

### R6 — P2: Thắng ranked trước sẽ làm mất điều kiện nhận First Blood

- Vị trí: `src/services/DuelService.ts:343–346`; `src/services/RankedService.ts:407–417`; `src/text/catalog/titles.ts:3–5`.
- First Blood yêu cầu chiến thắng duel đầu tiên, nhưng điều kiện lại là `pvpWins === 0`. Counter này được tăng bởi cả ranked.
- Tái hiện: thắng một trận ranked rồi thắng duel đầu tiên. Không được cấp First Blood; các lần duel sau counter vẫn lớn hơn 0 nên tiếp tục không được cấp.
- Hướng sửa: dùng lịch sử/counter riêng của duel hoặc cấp First Blood idempotent khi thắng duel, vì một chiến thắng duel đã đủ điều kiện sở hữu title.

### R9 — P2: Duel hết hạn vẫn gây lỗi tạo duel mới

- Vị trí: `src/services/DuelService.ts:166–183`; `src/repositories/DuelRepository.ts:19–20`; khóa chính participant ở `src/db/schema.ts:101`.
- Guard bỏ qua participant đã hết hạn nhưng hàng vẫn nằm trong database đến khi cleanup chạy. Insert participant mới sử dụng lại cùng `discordId` nên vi phạm khóa chính.
- Tái hiện: tạo duel, đưa thời hạn của duel/participants về quá khứ, tạo duel mới ngay. Nhận lỗi `duplicate key` thay vì kết quả nghiệp vụ.
- Hướng sửa: giải phóng duel/participant hết hạn trong transaction trước khi chiếm slot mới, đồng thời xử lý tranh chấp tạo mới thành trạng thái busy. Không phụ thuộc thời điểm scheduler chạy.

### R10 — P2: Chuỗi thắng bị cắt ở 50 trận

- Vị trí: `src/repositories/RaidRewardStore.ts:55–61`, `src/repositories/RankedRepository.ts:71–77`; vòng đếm ở `src/services/RaidRewardService.ts:127–134`, `src/services/RankedService.ts:455–462`.
- Cả hai query chỉ lấy 50 history gần nhất, nhưng kết quả lại được dùng như toàn bộ chuỗi thắng hiện tại.
- Tái hiện database: chèn 51 raid win liên tiếp; `currentWinStreak` trả 50. Ranked có cùng giới hạn query và cùng thuật toán đếm (đã kiểm tra tĩnh, chưa chạy probe 51 trận ranked).
- Hướng sửa: lưu current streak và cập nhật atomically theo kết quả trận, hoặc đọc lịch sử đến trận không thắng đầu tiên. Helper đếm chung không tự giải quyết việc thiếu dữ liệu đầu vào.

### R11 — P2: Kiểu dữ liệu lifetime EXP không chứa được đường cong cấp 100

- Vị trí: `src/db/schema.ts:855`, `src/config/combatExp.ts:8–24`, `src/services/RaidRewardService.ts:57`.
- Tổng EXP từ cấp 1 đến 100 là **3.630.601.650**, vượt `integer` PostgreSQL (**2.147.483.647**). Mốc đầu tiên có tổng EXP vượt giới hạn là cấp **82**; có thể overflow trong quá trình tích EXP ở cấp 81.
- Tái hiện: tính tổng bằng chính bảng EXP hiện tại rồi ghi vào `lifetimeExp`; database báo out of range.
- Đây là lỗi tiềm ẩn sau khi bỏ chặn cấp 50 ở R1, không phải khẳng định người chơi hiện tại đã lên được cấp 81.
- Hướng sửa: migration sang kiểu đủ lớn, chọn mapping TypeScript phù hợp và rà soát các counter tích lũy tương tự. Test cả cấp cao và tiếp tục nhận EXP khi đã đạt cap.

### R8 — P3: Số round trả về thừa một

- Vị trí: `src/domain/combat/BattleEngine.ts:87–104`.
- Vòng for tăng biến round trước lần kiểm tra tử vong tiếp theo, rồi trả biến đó thay vì số round đã thực hiện. `Math.min` chỉ che sai số ở MAX_ROUNDS.
- Tái hiện: trận kết thúc trong một round, `roundLogs.length === 1` nhưng `rounds === 2`.
- Hướng sửa: dùng số round thực thi/log thực tế; kiểm tra kết thúc sớm và kết thúc tại giới hạn.

## Logic trùng lặp nên gom lại

1. **Hệ số blessing:** `src/config/blessings.ts:16–25` khai báo giá trị, nhưng runtime decorator viết lại các hệ số. Search `BLESSINGS` chỉ có declaration và tham chiếu kiểu `BlessingKey`; chỉnh bảng config không đổi damage/heal/chance. Dùng một nguồn giá trị, với đơn vị được ghi rõ; đây cũng là chỗ sửa R2/R3.
2. **Settlement ranked:** hai nhánh cập nhật character/log gần giống nhau nhưng title và highest streak chỉ nằm ở nhánh initiator. Tách hàm settlement cho một participant, truyền kết quả và policy phần thưởng rõ ràng; sửa R5 trước khi gom.
3. **Win streak:** raid và ranked lặp cùng vòng đếm và cùng giới hạn 50 (R10). Dùng một quy tắc tính với dữ liệu đầy đủ hoặc counter lưu sẵn.
4. **Quest daily/weekly:** `src/services/QuestService.ts:309–374` lặp guard, clamp counter, xác định hoàn thành và cộng reputation. Có thể tách phép tính progress thuần; giữ riêng phần tiền thưởng, Valor/shards và thưởng hoàn tất daily vì nghiệp vụ khác nhau.
5. **Presenter daily:** `src/commands/economy/DailyCommand.ts` và `src/menu/MenuGameplayService.ts` lặp cách ghép kết quả claim. Locale cũng khác giữa menu (`vi-VN`) và helper mặc định (`en-US`). Nên dùng chung presenter với locale được chọn rõ ràng, tránh thay đổi format tùy đường vào.

## Kiểm chứng và giới hạn

Lệnh tái hiện:

```powershell
node node_modules/vitest/vitest.mjs run tests/review-business-repro.test.ts
```

Ở lượt review, 11/11 probe tái hiện hành vi lỗi. Khi bắt đầu sửa, đã chuyển assertion sang kết quả đúng và xác nhận cả 11 test đều fail trước khi chỉnh production code. Hiện file này là **20 regression test**, assert hành vi đúng và đã pass. Có thêm **1 test migration** với dữ liệu sẵn có, kiểm tra nâng schema không mất tiến độ, ghi EXP lớn và chặn cấp vượt cap. Các test ranked/duel ép kết quả BattleEngine để kiểm tra settlement xác định; các test combat chạy engine/decorator thật. Database dùng PGlite trong bộ nhớ với migrations thật, không kết nối production.

Baseline full suite trước sửa: **339 tests: 324 pass, 8 fail, 7 skipped**. Tám failure ban đầu thuộc `gameplay-panels.test.ts` (nội dung/format), `menu-gameplay.test.ts` (dấu phân cách số), `menu-router.test.ts` (ephemeral). Các lỗi này đã được xử lý; không bỏ/skip test để che lỗi.

Không dùng kết quả này để khẳng định đã kiểm chứng concurrency trên PostgreSQL thật hoặc mọi đường đi Discord. Bảy test PostgreSQL nhiều kết nối cần `TEST_DATABASE_URL`; test mô phỏng xung đột insert trong PGlite không thay thế kiểm chứng nhiều kết nối.

Các hướng sửa trong phần phát hiện được giữ lại để truy vết nguyên nhân; không phải danh sách công việc còn treo.
