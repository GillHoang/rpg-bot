# Tổng hợp bug, sai lệch nghiệp vụ và kế hoạch refactor

Ngày tổng hợp: 2026-09-23.

Tài liệu gộp hai báo cáo rà soát bằng CodeGraph và đề xuất cải tiến đính kèm. Các mục trùng được hợp nhất. Đây là backlog sửa lỗi/refactor, chưa phải báo cáo đã triển khai. Không sử dụng agent con trong đợt rà soát được tổng hợp.

## 1. Phạm vi và cách đọc

- P1: ưu tiên cao, ảnh hưởng tính đúng dữ liệu hoặc giao dịch.
- P2: ưu tiên tiếp theo, sai hành vi hoặc hiển thị trong tình huống cụ thể.
- P3: tài liệu và cải tiến phòng ngừa.
- Đề xuất cũ dùng P0 cho khóa tuần và multi-count như thứ tự triển khai. Tài liệu này thống nhất mức độ lỗi thành P1/P2; không coi đó là bằng chứng sự cố P0 đang xảy ra.
- Đường dẫn và số dòng là vị trí tại thời điểm rà soát; có thể thay đổi sau refactor.
- Các nhận định concurrency dựa trên phân tích code; chưa được tái hiện bằng PostgreSQL nhiều kết nối.

## 2. Danh sách lỗi đã ghi nhận

### BUG-01 — P1: Khóa tuần thiếu năm

`weekWindowAt()` chỉ trả số tuần 1–53. `weekly_quests`, `weekly_grand` và `lastWeeklyClaimWeek` không phân biệt năm. Quest hoặc Weekly Grand có thể dùng lại dữ liệu năm trước; ranked claim cũng có thể bị chặn khi giá trị tuần cũ trùng tuần hiện tại.

**Hướng xử lý:** dùng ISO week-year như `2027-W01`, hoặc cặp `(weekYear, week)`. Cập nhật repository, unique constraint và migration đồng bộ.

**Migration:** kiểm tra nguồn gốc dữ liệu trước khi chuyển. Không tự gán năm hiện tại cho toàn bộ row cũ. Nếu không suy ra được năm, lưu bản sao dữ liệu mơ hồ và xác định chính sách giữ/reset tiến độ trước khi áp dụng.

**Kiểm chứng cần thêm:** hai năm có cùng số tuần; ranh giới tháng 12/tháng 1; tuần 53; nhận thưởng chỉ một lần mỗi khóa tuần.

**Nguồn:** [ranked.ts:67](../src/config/ranked.ts), [schema.ts:1076](../src/db/schema.ts), [QuestService.ts:260](../src/services/QuestService.ts), [RankedService.ts:251](../src/services/RankedService.ts).

### BUG-02 — P1: Ranked có thể mất cập nhật đối thủ

Đối thủ được đọc không khóa; rating, shield, peak và W/L sau đó được ghi từ snapshot đã đọc. Hai trận cùng chọn một đối thủ có thể ghi đè kết quả của nhau.

**Hướng xử lý:** thiết kế khóa cho cả hai người theo thứ tự thống nhất, đọc lại trạng thái dưới khóa trước khi tính kết quả. Phải phối hợp với BUG-03; chỉ thêm khóa đối thủ sau khóa người khởi tạo có thể tạo deadlock khi hai người chọn nhau.

**Kiểm chứng cần thêm:** hai trận cùng đối thủ; hai người đấu chéo; log và rating/W/L cuối cùng phải phản ánh đủ kết quả.

**Nguồn:** [RankedRepository.ts:55](../src/repositories/RankedRepository.ts), [RankedService.ts:143,390](../src/services/RankedService.ts).

### BUG-03 — P1: Thứ tự khóa giao dịch không thống nhất

Ranked khóa character rồi bag; raid khóa bag rồi character. Khi chạy đồng thời cho cùng người chơi, hai transaction có thể chờ khóa của nhau và một transaction bị hủy do deadlock.

**Hướng xử lý:** lập quy tắc thứ tự khóa dùng chung cho các bảng và người chơi. Rà cả ranked, raid, duel, summon, daily, quest, class change và PvP shop trước khi thay đổi.

**Kiểm chứng cần thêm:** chạy song song các cặp hành động dùng chung dữ liệu, đặc biệt ranked/raid và giao dịch hai người.

**Nguồn:** [RankedService.ts:143](../src/services/RankedService.ts), [RaidService.ts:198](../src/services/RaidService.ts).

### BUG-04 — P2: Multi-summon/open chỉ tăng quest một lần

Event summon/chest có `count`, nhưng subscriber bỏ qua và quest luôn tăng một đơn vị. Ví dụ summon 30 lượt chỉ cộng 1 lượt quest.

**Hướng xử lý:** bổ sung `amount` vào API tiến độ và coordinator; truyền số lượt thực tế. Kiểm tra amount là số nguyên dương, giới hạn tiến độ bằng target và giữ điều kiện phát thưởng một lần. Enhance/daily/casino mặc định là 1.

**Kiểm chứng cần thêm:** count 1/10/30, vượt target, nhiều lần cập nhật đồng thời và không phát thưởng lặp.

**Nguồn:** [SummonService.ts:103](../src/services/SummonService.ts), [LootService.ts:126](../src/services/LootService.ts), [subscribeDomainEvents.ts:45](../src/core/subscribeDomainEvents.ts), [QuestService.ts:294](../src/services/QuestService.ts).

### BUG-05 — P2: Có thể mất quest/Believer EXP sau khi hành động thành công

Các subscriber legacy chạy fire-and-forget sau transaction chính. DB lỗi hoặc bot dừng có thể làm mất tiến độ; lỗi chỉ được log. Menu daily/raid có cập nhật tiến độ trong transaction, còn slash command vẫn dùng đường bất đồng bộ.

**Hướng xử lý:** mở rộng `GameplayProgressCoordinator` và áp dụng trong transaction nghiệp vụ cho các hành động cần bảo đảm tiến độ. Thống nhất menu/slash, bỏ quyền lựa chọn `atomicProgress` ở tầng giao diện. Tránh cộng hai lần khi chuyển đổi subscriber. EventBus giữ vai trò thông báo/telemetry không quyết định phần thưởng.

Outbox có retry là phương án mở rộng khi cần xử lý qua nhiều process/hàng đợi; chưa cần thêm ngay nếu transaction nội bộ đáp ứng được yêu cầu.

**Kiểm chứng cần thêm:** progress lỗi thì hành động rollback; menu/slash cho cùng kết quả; event không cộng lại tiến độ đã ghi.

**Nguồn:** [subscribeDomainEvents.ts:18](../src/core/subscribeDomainEvents.ts), [EventBus.ts:49](../src/core/EventBus.ts), [DailyService.ts:60](../src/services/DailyService.ts), [MenuGameplayService.ts:147,189](../src/menu/MenuGameplayService.ts).

### BUG-06 — P2: Reset và audit không nguyên tử

Reset đếm user, truncate, rồi ghi audit bằng thao tác riêng. Audit lỗi có thể để lại dữ liệu đã xóa nhưng thiếu dấu vết; đăng ký đồng thời có thể làm số đếm không khớp.

**Hướng xử lý:** đổi API thành `resetAll(devId)`; trong cùng transaction, khóa phù hợp trước khi đếm, truncate, ghi audit rồi commit. Bảo đảm bảng audit không nằm trong tập bị xóa. Acknowledge nút Discord bằng `deferUpdate()` sau xác thực và trước thao tác dài; cập nhật phản hồi sau khi hoàn tất.

**Kiểm chứng cần thêm:** audit thất bại phải rollback reset; reset đồng thời với start; số đếm chính xác; interaction được acknowledge trước khi chạy reset.

**Nguồn:** [ResetService.ts:38](../src/services/ResetService.ts), [ResetCommand.ts:75,89](../src/commands/admin/ResetCommand.ts).

### BUG-07 — P2: Starter gear bị đánh dấu equipped sai

Start tạo starter gear trong preset, nhưng các cột trang bị cache trên character còn NULL. Combat/profile đọc preset nên có trang bị, inventory search đọc character nên không đánh dấu equipped.

**Hướng xử lý:** cho inventory đọc active preset. Sau khi chuyển toàn bộ reader/writer và kiểm tra dữ liệu, tiến tới bỏ cache trang bị trùng trên character.

**Kiểm chứng cần thêm:** ngay sau start, combat/profile/inventory đồng nhất; equip và switch hai preset vẫn đúng.

**Nguồn:** [StartService.ts:117](../src/services/StartService.ts), [PresetRepository.ts:26](../src/repositories/PresetRepository.ts), [InventoryDataRepository.ts:34](../src/repositories/InventoryDataRepository.ts).

### BUG-08 — P2: Profile hiển thị enhancement lệch +1

Profile menu hiển thị thẳng `enhancement`, trong khi inventory dùng `enhancement - 1`. Trang bị cơ bản lưu 1 nên profile hiện +1 thay vì +0.

**Hướng xử lý:** thống nhất quy tắc chuyển cấp lưu trữ sang cấp hiển thị ở các presenter/read model; không thay đổi giá trị lưu trữ chỉ để sửa hiển thị.

**Kiểm chứng cần thêm:** trang bị cơ bản và đã enhance có cùng cấp hiển thị trên profile/inventory. Sửa test hiện đang kỳ vọng giá trị lệch.

**Nguồn:** [gameplayPanels.ts:125](../src/menu/gameplayPanels.ts), [InventoryDataRepository.ts:56,83](../src/repositories/InventoryDataRepository.ts).

### BUG-09 — P2: Có thể tạo nhiều season active

Ranked và PvP shop lặp logic đọc active season, đếm rồi insert. Không có ràng buộc chỉ một season active; các giao dịch đồng thời có thể cùng tạo mùa.

**Hướng xử lý:** gom thao tác vào một service/repository quản lý season; serialize khởi tạo và thêm unique constraint có điều kiện cho active season. Kiểm tra/xử lý dữ liệu active trùng trước migration.

**Kiểm chứng cần thêm:** nhiều người đồng thời mở ranked/shop khi chưa có season; chỉ một mùa active và mọi giao dịch dùng đúng season ID.

**Nguồn:** [RankedService.ts:444](../src/services/RankedService.ts), [PvpShopService.ts:128](../src/services/PvpShopService.ts), [schema.ts:560](../src/db/schema.ts).

### BUG-10 — P2: Ranked giữ lock khi không tìm thấy đối thủ

`fight()` tạo lock rồi trả `no-opponent` trước lệnh xóa lock. Transaction commit lock này khiến lần thử tiếp theo báo busy tới khi maintenance dọn.

**Hướng xử lý:** bảo đảm mọi nhánh kết thúc giải phóng lock, hoặc thay thiết kế lock để vòng đời phù hợp transaction.

**Kiểm chứng cần thêm:** không có đối thủ không để lại lock; thêm đối thủ rồi thử lại được ngay.

**Nguồn:** [RankedService.ts:147,156,221](../src/services/RankedService.ts).

### BUG-11 — P3: README chứa liên kết chết

README còn trỏ tới `docs/gameplay-flow.md`, trong khi file này đã bị xóa trong worktree tại thời điểm rà soát.

**Hướng xử lý:** sửa về tài liệu tồn tại và thêm kiểm tra link nội bộ trong CI.

**Nguồn:** [README.md:14,139](../README.md).

## 3. Các cải tiến/refactor hợp nhất

| Mục | Thay đổi đề xuất | Lợi ích và lưu ý |
|---|---|---|
| Progression | Một đường cập nhật tiến độ trong transaction, nhận amount | Giải quyết BUG-04/05 và sai khác menu/slash. |
| Loadout | Active preset là nguồn đọc thống nhất | Giải quyết BUG-07; bỏ dần các lần ghi kép, cần migration riêng khi xóa cột. |
| Season | Một nơi khởi tạo và quản lý vòng đời | Giải quyết BUG-09; thống nhất thời gian và chính sách chuyển mùa. |
| Profile | Tách summary/detail, chỉ tải loadout khi cần | Giảm đọc character/preset lặp và tối đa bốn query loadout bổ sung trên màn hình không sử dụng. Có thể dùng `getDetail(id)` hoặc tùy chọn `includeLoadout`. |
| Preset ID | Identity/sequence thay `MAX(id) + 1` và advisory lock | Bỏ bộ cấp ID thủ công; migration phải đồng bộ sequence với ID hiện hữu. |
| DB constraints | CHECK số dư không âm, slot, enhancement, enum phù hợp | Chốt invariant thực tế trước khi thêm; không sao chép comment schema cũ nếu khác logic hiện hành. |
| Quan sát lỗi | Metric lỗi progression/domain-event | Giúp phát hiện lỗi vận hành, không thay thế bảo đảm transaction. |
| Tài liệu | Link checker trong CI | Ngăn lỗi tài liệu tái diễn. |
| Wrapper | Xem xét interface/wrapper không có hành vi | Ưu tiên thấp; không gom mọi repository vào generic CRUD chỉ vì giống cú pháp. |

### Những quyết định nghiệp vụ cần chốt khi triển khai

1. **Season hết hạn:** code có `endsAt` nhưng chưa xử lý chuyển mùa. Chọn tự động hay quản trị thủ công; làm rõ reset giới hạn shop. Không tự bổ sung phần thưởng cuối mùa vì phần này hiện được ghi là ngoài phạm vi.
2. **Ranked double-submit:** lock được tạo/xóa trong cùng transaction sau khóa character; request đồng thời có thể chờ rồi chạy thành trận mới. Cần xác định yêu cầu là serialize, trả busy ngay hay chống xử lý lặp theo request ID.
3. **Hunt cooldown:** 15 giây hiện nằm ở menu/replay UI. Nếu đây là luật cân bằng gameplay, chuyển xuống service theo người chơi; nếu chỉ là hạn chế nút replay, ghi rõ phạm vi.
4. **Dữ liệu tuần cũ:** không có năm nên cần chính sách migration có căn cứ, không suy đoán dữ liệu lịch sử.

Class/level của PlayerAccount được ánh xạ từ `user_character`; không ghi nhận lỗi hai nguồn dữ liệu class/level. Bản sao loadout giữa character và preset mới là phần cần xử lý.

## 4. Kế hoạch triển khai ba đợt

### Đợt 1 — Bảo đảm giao dịch và phần thưởng

1. Chuẩn hóa thứ tự khóa; sửa ranked cập nhật đối thủ và vòng đời fight lock.
2. Chuyển khóa tuần sang ISO week-year, có preflight và migration.
3. Bổ sung amount và thống nhất progression trong transaction.
4. Gộp reset/audit, acknowledge interaction sớm.
5. Bổ sung test PostgreSQL nhiều kết nối cho các thay đổi giao dịch.

### Đợt 2 — Thống nhất dữ liệu và luật nghiệp vụ

1. Chuyển inventory sang active preset; sửa enhancement hiển thị.
2. Gom quản lý season và bảo đảm một mùa active.
3. Triển khai chuyển mùa sau khi chốt chính sách.
4. Chuyển preset ID sang identity/sequence; bỏ cache loadout khi reader/writer đã chuyển xong.

### Đợt 3 — Hiệu năng và phòng ngừa tái diễn

1. Tách profile summary/detail, giảm query lặp.
2. Thêm DB constraints phù hợp dữ liệu thực tế.
3. Sửa link README, bổ sung link checker và metric lỗi.
4. Dọn wrapper/interface ít giá trị sau khi các luồng nghiệp vụ ổn định.

### Ước lượng tham khảo từ đề xuất trước

| Hạng mục | Ước lượng ban đầu |
|---|---|
| Khóa tuần có năm | 1 ngày + migration |
| Quest amount | 0,5 ngày |
| Progression trong transaction | 1–2 ngày |
| Reset/audit và acknowledge | 0,5–1 ngày |
| Profile chỉ tải dữ liệu cần | 0,5 ngày |
| Suite PostgreSQL concurrency | 1 ngày |
| DB constraints và link checker | 0,5–1 ngày |

Đây là ước lượng cũ, chưa bao gồm toàn bộ phát hiện ranked/loadout/season và thời gian xử lý dữ liệu migration; không dùng tổng cộng này làm cam kết tiến độ.

## 5. Kiểm thử và tiêu chí hoàn thành

### Kết quả đã ghi nhận

- Lượt rà soát đầu: ESLint đạt; typecheck đạt; 36/36 file và 276/276 test Vitest đạt.
- Lượt kiểm tra tiếp theo: typecheck đạt; 5/5 file và 45/45 test đạt, gồm gameplay, m7, inventory-service, service-cohort-a-di và ranked-draw.
- Hai con số trên là hai phạm vi chạy khác nhau, không cộng thành 321 test.
- Các test đạt không chứng minh những tình huống chưa được bao phủ đã đúng.
- Nhận định ban đầu “chưa thấy lỗi correctness khác trong diff profile/loadout” được cập nhật bởi BUG-08 về enhancement hiển thị.
- Chưa sửa source trong các lượt rà soát được tổng hợp; worktree có thay đổi sẵn của người dùng.

### Test cần bổ sung theo rủi ro

- [ ] Tuần cùng số khác năm, ranh giới ISO week-year, claim đúng một lần.
- [ ] Multi-summon/open tăng đủ amount, cap target, thưởng không lặp.
- [ ] Progression lỗi làm rollback hành động; menu/slash đồng nhất.
- [ ] Hai daily claim đồng thời; hai casino cùng tiêu số dư cuối.
- [ ] Hai ranked cùng đối thủ, ranked đấu chéo, ranked/raid đồng thời.
- [ ] Ranked không có đối thủ không để lại lock; hành vi double-submit đúng chính sách.
- [ ] Duel khóa hai người theo thứ tự thống nhất.
- [ ] Reset audit lỗi rollback; reset đồng thời với start.
- [ ] Starter gear equipped đúng ngay sau start; switch/equip nhất quán mọi màn hình.
- [ ] Enhancement cơ bản hiện +0 và nhất quán profile/inventory.
- [ ] Tạo season đồng thời chỉ tạo một mùa active; expiry đúng chính sách đã chốt.
- [ ] Profile summary không tải loadout không sử dụng.
- [ ] Migration chạy với dữ liệu hiện hữu; constraints không loại bỏ dữ liệu hợp lệ.
- [ ] Lint, typecheck, suite hiện hành và kiểm tra link đều đạt.

Giữ test nhanh hiện có; dùng PostgreSQL thật với nhiều kết nối cho deadlock/lost-update và các tình huống tranh chấp khóa. Suite này có thể chạy trong CI trước merge hoặc nightly.

## 6. Trạng thái

Báo cáo ban đầu ghi nhận các mục chưa triển khai. Bản sửa source/migration đã được thực hiện sau đó; xem [tiến độ và kết quả kiểm chứng](bug-audit-refactor-progress.md) và [hướng dẫn triển khai](audit-deployment.md). Migration chưa chạy trên database ứng dụng; 7 test PostgreSQL nhiều kết nối đã chạy đạt trên database test người dùng cung cấp; chi tiết nằm trong file tiến độ.
