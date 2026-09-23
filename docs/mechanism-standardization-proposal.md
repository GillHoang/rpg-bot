# Đề xuất thống nhất cơ chế — 2026-09-23

Trạng thái: đang triển khai theo từng lát cắt; battle/calendar/cooldown đã có thay đổi runtime đầu tiên. Rà soát trực tiếp, không dùng agent con. Các nhận xét dưới đây phân biệt khác biệt kiến trúc với lỗi đã tái hiện; không coi mọi khác biệt là bug.

## Quyết định sản phẩm

Đã được người dùng chọn trong lượt trao đổi này:

- Daily/weekly chuyển sang lịch Việt Nam, `Asia/Ho_Chi_Minh`, daily reset 00:00.
- Ranked bất đồng bộ tiếp tục ghi kết quả, rating và thành tích cho cả hai người.
- Hunt có cooldown chung 15 giây/người chơi trên menu, nút replay và slash command.

- Đưa toàn bộ tính năng vào menu. Slash được giữ trong thời gian chuyển đổi; sau đó xóa các slash thừa, không cần thiết.

Không còn câu hỏi sản phẩm đang chờ trả lời trong phạm vi đề xuất này.

### Phạm vi chuyển toàn bộ tính năng sang menu

- Lập bảng đối chiếu từng command/subcommand với màn hình và thao tác menu tương ứng; chỉ coi hoàn tất khi người dùng thực hiện được toàn bộ luồng, không chỉ thấy nút hoặc hướng dẫn gọi slash.
- Menu gọi các use case dùng chung; không sao chép nghiệp vụ từ command vào handler của nút. Trong giai đoạn cùng tồn tại, menu và slash áp dụng cùng cooldown, hạn mức và chống xử lý lặp.
- Các chức năng quản trị vẫn giữ kiểm tra quyền tại nơi thực thi, kể cả khi được truy cập qua menu riêng. Ẩn nút không thay thế kiểm tra quyền.
- Kiểm chứng cả nhập liệu, phân trang, xác nhận thao tác, kết quả, lỗi nghiệp vụ và session hết hạn. Ưu tiên hoàn thiện từng nhóm tính năng sử dụng được từ đầu đến cuối.
- Sau khi menu đủ chức năng và được kiểm chứng, lập danh sách slash dư thừa để bỏ cả handler lẫn đăng ký Discord. Giữ điểm mở menu cần thiết; không mặc định xóa tất cả slash.

Đề xuất giữ nguyên trong đợt chuẩn hóa đầu tiên: đầu tuần ISO thứ Hai; season rollover do admin thực hiện; quest tham gia ranked chỉ tính người chủ động chơi, reputation thắng dành cho winner. Việc tính kết quả cho cả hai không tự động đồng nghĩa với tăng quest tham gia cho đối thủ thụ động.

## 1. Lịch game và thời gian — ưu tiên đầu tiên

**Đã sửa trong lát cắt này:** `DailyCycle` và `weekWindowAt` cùng dùng `Asia/Ho_Chi_Minh` và offset UTC+7. Season vẫn dùng khoảng 30 ngày và chỉ rollover theo lệnh admin (`src/services/SeasonService.ts:28`).

**Thống nhất:** một `GameCalendar` chịu trách nhiệm day key, ISO week key và ranh giới kỳ theo timezone đã chọn; một `Clock` cung cấp thời điểm, có thể thay bằng thời gian cố định trong test. Một hành động lấy thời điểm một lần rồi truyền xuống. Phân biệt rõ lịch reset, thời lượng cooldown/TTL và vòng đời season.

**Chuyển đổi dữ liệu:** không chỉ thay chuỗi timezone. Phải chọn thời điểm chuyển và quy tắc bảo toàn các lượt daily/boss/weekly đã nhận, nhất là khoảng 23:00–00:00 khi hai lịch khác ngày. Không đổi ý nghĩa khóa kỳ đã lưu mà không có kế hoạch đối chiếu.

**Hoàn thành khi:** daily, boss, quest, ranked weekly và UI dùng cùng lịch; test sát nửa đêm, đầu tuần, giao năm ISO và kỳ chuyển múi giờ không cho nhận thưởng lặp.

## 2. Hành động, cooldown và chống xử lý lặp — ưu tiên đầu tiên

**Đã sửa trong lát cắt này:** `RaidService` lưu cooldown hunt trong bảng `hunt_cooldowns`, khóa theo người chơi và kiểm tra trong transaction. Menu, slash và replay đều đi qua policy này; session/replay chỉ còn guard giao diện. Receipt menu vẫn chống xử lý lặp khi có request ID.

**Thống nhất:** menu/slash/nút chỉ chuyển đầu vào sang cùng use case. Context hành động gồm người gọi, mã hành động và thời điểm. Kiểm tra sở hữu, điều kiện chơi, hạn mức, cooldown nghiệp vụ và receipt ở service/transaction; session chỉ giữ trạng thái giao diện. Mã hành động ổn định khi retry, khác nhau cho hai hành động mới hợp lệ.

Không gộp ba khái niệm: chống xử lý lặp bảo vệ cùng một yêu cầu; cooldown giới hạn tần suất yêu cầu mới; lock bảo vệ cập nhật đồng thời. Với cooldown toàn người chơi đã chọn, trạng thái phải dùng chung giữa các session và tồn tại qua restart.

**Hoàn thành khi:** retry một hành động chỉ cấp thưởng một lần; menu và slash có cùng điều kiện; hai hành động khác nhau tuân thủ cooldown đã chọn; test concurrency thật trên PostgreSQL.

## 3. Kết quả trận, thưởng và tiến độ — ưu tiên đầu tiên

**Đã sửa trong lát cắt này:** `RaidRewardService` nhận `BattleOutcome` và dùng outcome để ghi history/counter; draw không còn bị suy ra thành loss từ số Credux. Duel draw ghi `pvp_logs` với `winner_id = NULL` và outcome rõ ràng.

**Thống nhất:** kết quả trận là nguồn xác định thắng/thua/hòa; phần thưởng được tính từ kết quả và policy. Sự kiện nghiệp vụ biểu đạt điều đã xảy ra, gồm mode, outcome, người khởi tạo và participant. Quy tắc quest, reputation, title ánh xạ riêng từ sự kiện đó. Không dùng tiền nhận được để suy ra kết quả.

Các thao tác thay đổi tiền, item, quota, quest và EXP của một hành động phải commit hoặc rollback cùng nhau. Giữ `EventBus` sau commit cho quan sát/thông báo như `src/core/subscribeDomainEvents.ts`; không chuyển thưởng cốt lõi sang subscriber bất đồng bộ.

**Hoàn thành khi:** thắng với thưởng tiền bằng 0 vẫn tăng đúng counter; hòa/thua không tăng win; quest tham gia và thưởng thắng tách biệt; rollback không để lại thưởng hoặc tiến độ một phần.

## 4. Tiền, vật phẩm và audit — ưu tiên cao

**Hiện trạng:** có `EconomyService`, nhưng raid, loot và PvP shop vẫn cập nhật bag theo đường riêng. Một điểm có service chung chưa đồng nghĩa mọi thay đổi tài sản đều tuân thủ cùng contract.

**Thống nhất:** primitive ghi biến động tài sản nhận transaction hiện có, lý do và action ID; kiểm tra số dư/hạn mức, ghi số trước/sau và delta. Phân biệt kiếm được, tiêu, hoàn trả và chuyển tiền khi cập nhật lifetime counters. Tính thưởng vẫn thuộc từng tính năng; không gom mọi luật game vào một service lớn.

Với cosmetic/title: cấp quyền sở hữu idempotent; mua trùng không mất tiền/quota. Giữ thứ tự khóa tài nguyên nhất quán và sắp thứ tự ID khi tác động nhiều người.

**Hoàn thành khi:** các đường cấp/trừ/hoàn có cùng invariant; thất bại cấp item rollback khoản trừ; có thể truy từ một action đến mọi biến động tài sản của nó.

## 5. Kết quả service và nội dung hiển thị — ưu tiên cao

**Hiện trạng:** Daily/Raid trả object có `status`; `LootService.open` và `PvpShopService.buy` trả luôn chuỗi hiển thị. Một số nhánh nghiệp vụ vẫn mang câu thông báo.

**Thống nhất:** service trả discriminated union theo từng use case, gồm mã kết quả và dữ liệu có cấu trúc. Presenter chuyển kết quả sang text/embed/menu sau khi xử lý nghiệp vụ. Các tình huống dự kiến như thiếu tiền, đã nhận, đang bận dùng result; exception dành cho lỗi không dự kiến.

Không ép mọi service vào một union khổng lồ hoặc thêm interface cho từng hàm. Dùng presenter chung cho cùng nội dung, cho phép menu/slash bố cục khác nhau.

**Hoàn thành khi:** đổi câu chữ không sửa transaction; test nghiệp vụ kiểm tra status/delta, test presenter kiểm tra nội dung; thêm đường vào không chép lại luật.

## 6. Khởi tạo dependency — ưu tiên cao

**Hiện trạng:** `createApplicationServices:61` đã là composition root, nhưng nhiều service còn tự tạo collaborator và có singleton/default song song. Root truyền coordinator dùng chung cho Daily/Raid nhưng chưa truyền cho mọi service hỗ trợ nó. Constructor trộn positional arguments và object options.

**Thống nhất:** composition root tạo và nối các dependency; core service nhận object dependency rõ ràng. Default/compatibility factory chỉ ở biên ứng dụng trong thời gian chuyển đổi. Clock, RNG và persistence cũng đi theo quy tắc này; RNG có scope theo hành động để test tái lập được.

Đây là vấn đề khả năng kiểm soát dependency, không khẳng định mọi `new Service()` hiện tại đều dùng sai database: nhiều lời gọi vẫn truyền transaction đúng xuống dưới.

**Hoàn thành khi:** một application graph dùng đúng persistence/events/progress đã inject, không âm thầm tạo đường mặc định khác; test có thể dựng graph không chạm môi trường production.

## 7. Text, emoji, thuật ngữ và số — ưu tiên tiếp theo

**Hiện trạng:** đã có text/icon registry và boundary check. Tuy nhiên `src/text/format.ts` mặc định `en-US`, trong khi menu và daily dùng `vi-VN`.

**Thống nhất:** đề xuất locale hiển thị mặc định `vi-VN`, số/ngày/thời lượng đi qua formatter chung. Danh mục currency/item chứa key ổn định, tên hiển thị và icon; text theo tính năng, không gom thành một file khổng lồ. Nếu cần đa ngôn ngữ sau này, truyền locale ở presenter. Format kỹ thuật phục vụ ISO key/database độc lập với locale UI.

**Hoàn thành khi:** cùng số tiền và cùng tài nguyên được gọi/hiển thị nhất quán giữa menu, slash và log hiển thị; guard chặn text/emoji hardcode mới ở biên đã quy định.

## 8. Công thức, đơn vị và nguồn dữ liệu — ưu tiên tiếp theo

**Hiện trạng:** đã có `StatAssemblyService`, cấu hình combat và helper EXP dùng chung. Trong stat assembly có phép đổi fraction sang điểm phần trăm (`critPts * 100`); lịch sử sửa blessing từng cho thấy nguy cơ nhầm đơn vị.

**Thống nhất:** quy định rõ fraction, điểm phần trăm, multiplier, số lượng nguyên và tiền; đặt tên hoặc type thể hiện đơn vị, chuyển đổi đúng một lần ở ranh giới. Config chứa luật cân bằng; database chứa trạng thái người chơi. Với catalog được seed vào DB, ghi rõ thuộc tính nào là định nghĩa chuẩn và cách cập nhật; không có hai định nghĩa độc lập cho cùng hệ số. Derived stats tính qua assembler chung.

**Hoàn thành khi:** profile và combat dùng cùng công thức; test kiểm tra giá trị damage/EXP thực tế, không chỉ snapshot câu chữ; thay cap hoặc công thức có kiểm tra sức chứa kiểu dữ liệu và constraint DB.

## 9. Test và tài liệu quy tắc — xuyên suốt

- Unit test: công thức, policy và clock/RNG cố định.
- Integration: transaction, ownership, receipt, rollback và migration trên dữ liệu hiện có.
- PostgreSQL concurrency: race/lock/uniqueness; báo rõ skipped, không coi PGlite là đã kiểm chứng cạnh tranh trên server PostgreSQL.
- UI/presenter: quyền thao tác, menu/slash gọi cùng use case, nội dung hiển thị. Không lấy snapshot làm bằng chứng duy nhất cho luật game.
- Một tài liệu quy tắc hiện hành làm nguồn tham chiếu. Các kế hoạch M7, port và audit cũ giữ vai trò lịch sử, có liên kết tới quy tắc mới. Sửa comment cũ khi sửa phần liên quan.

## Thứ tự triển khai đề xuất

1. Lập bảng tính năng cần chuyển sang menu; viết contract thời gian/hành động/kết quả theo các quyết định đã chốt và test đặc tả. (Đang tiếp tục.)
2. Dùng Daily/Raid làm lát cắt đầu tiên: calendar, action context, receipt/cooldown, result và presenter; nối dependency ở root. Calendar, action context và cooldown hunt đã triển khai; presenter/menu mapping vẫn tiếp tục.
3. Chuẩn hóa ghi tài sản/progress; lần lượt đưa loot, shop, summon, casino, duel và ranked vào cùng các quy ước. Giữ policy đặc thù của từng tính năng.
4. Hoàn thiện các luồng menu còn thiếu theo bảng đối chiếu; kiểm chứng chức năng và quyền truy cập. Sau đó loại bỏ các slash dư thừa cùng đăng ký tương ứng.
5. Hoàn tất locale/thuật ngữ, đơn vị công thức, bỏ compatibility đã hết caller, cập nhật tài liệu và chạy toàn bộ kiểm tra.

Mỗi bước có thể review và kiểm chứng riêng. Mục tiêu là một nơi quyết định cho mỗi luật dùng chung, với các tính năng vẫn có ranh giới rõ ràng.
