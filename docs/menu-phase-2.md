# Menu all-in-one — giai đoạn 2

## Phạm vi

- Người mới mở `/menu`, chọn class, xem chỉ số/nội tại và xác nhận tạo nhân vật; service cấp quà và trang bị như `/start`.
- Trang chủ hiển thị cấp/EXP, tiền, daily/streak, tiến độ quest và lượt boss. Nhân vật hiển thị chỉ số đã cộng trang bị, tín đồ, danh hiệu và PvP rating.
- Nhận daily; xem quest ngày/tuần; nhận Weekly Grand; đổi quest có xác nhận mất tiến độ chưa hoàn thành, giữ quest hoàn thành.
- Săn quái miễn phí; boss có xác nhận phí và lượt ngày. Service kiểm tra lại cấp, số dư và cooldown trong transaction.
- Kết quả có EXP, tiền, shards, rương, gear drop, lên cấp và phí boss. Log từng hiệp có phân trang; hiệp dài được chia trang. Làm mới/xem log không đánh lại.
- Các slash command cũ giữ nguyên. Inventory/deity/PvP/casino/shop chờ các giai đoạn tiếp theo; menu hiện hướng dẫn tương ứng.

## Tổ chức

Trang chủ tham khảo form Components V2 người dùng cung cấp: viền vàng, tóm tắt nhân vật cạnh avatar Discord, thanh EXP và nhóm nút **Thông tin / Hoạt động / Tài sản** có đường phân cách. Chỉ dùng emoji và dữ liệu CREDD; không phụ thuộc banner/URL CDN tạm thời của bot mẫu. Nút Tài sản mở hướng dẫn lệnh hiện có trong lúc chờ giai đoạn kế tiếp. Trang con giữ select chuyển khu vực và nút Trang chủ.

`MenuRouter` xử lý ownership, message, revision, lock và ACK; chỉ chấp nhận gameplay action đang có trên màn hình và không bị disabled. Giá trị class được kiểm tra server-side.
[`MenuGameplayService`](../src/menu/MenuGameplayService.ts) đọc dữ liệu và gọi service trực tiếp; không giả lập slash interaction. [`gameplayPanels.ts`](../src/menu/gameplayPanels.ts) dựng panel và phân trang log từ snapshot được truyền vào, không truy cập DB hay thực hiện nghiệp vụ. Runtime nạp service khi sử dụng; router có thể inject service để test.
`MenuSessionStore` giữ snapshot giao diện và trận gần nhất, không giữ token hay quyền quyết định số dư. Điều hướng gameplay xoá lịch sử cũ; nút Huỷ trở về trang tương ứng.
Thông tin trên trang là snapshot; Làm mới đọc lại DB. Hai menu của cùng người chơi có thể hiển thị khác thời điểm nhưng service luôn xác thực trạng thái hiện tại khi ghi.

## Nhất quán và chống nhận lặp

- Daily dựa vào khoá bag và ngày đã nhận; weekly dựa vào khoá và unique user/tuần; onboarding đăng ký idempotent, khoá bag rồi kiểm tra lại character trước khi cấp starter.
- Kiểm tra seed starter trước khi đăng ký, tránh commit tài khoản dở dang khi thiếu seed.
- Mỗi thao tác hunt/boss của menu dùng mã `sessionId:revision`. Bảng `menu_action_receipts` lưu mã cùng transaction với phí, cooldown và phần thưởng. Mã đã xử lý không sinh trận/thưởng lần hai, kể cả gọi qua service instance khác.
- Daily/raid của menu cập nhật quest và reputation **trong transaction**. Event có `progressApplied` để subscriber không cộng thêm lần nữa. Lệnh cũ tiếp tục đường event hiện có.
- Quest dùng khoá bag → user trước khi tạo hoặc cập nhật quest; tránh sinh quá 3 quest khi hai menu đồng thời mở bộ mới và tránh đảo thứ tự khoá giữa raid/daily với quest.
- Confirmation boss/đổi quest gắn ngày Asia/Ho_Chi_Minh; xác nhận sau khi qua ngày bị từ chối. Cooldown ngày/tuần vẫn do service kiểm tra.
- Lỗi transaction rollback cả phần thưởng lẫn tiến độ. Lỗi Discord sau commit: router huỷ session và đưa nút mở lại, không tự chạy lại nghiệp vụ. Restart khiến nút session cũ hết hiệu lực.
- Receipt được giữ trong DB, không có job xoá tự động ở giai đoạn này; xoá user/reset cascade sẽ xoá receipt. Mỗi trận menu tạo một row nhỏ. Session RAM vẫn chỉ hỗ trợ một process bot; receipt không biến UI session thành hệ thống nhiều replica.

## Cập nhật và kiểm tra

Migration `0001_dazzling_maelstrom.sql` chỉ thêm `menu_action_receipts` và FK; không đổi dữ liệu/balance hiện có.
Trên VPS, chạy `npm run db:migrate` trước `npm run build` và khởi động lại bot. Không cần đăng ký lại `/menu` nếu giai đoạn 1 đã được triển khai.

Kiểm tra tự động: `npm run build`, `npm run lint:check`, `npm test -- --maxWorkers=2`.
Test dùng Discord builder thật và PostgreSQL trong bộ nhớ (PGlite), không cần bot token hoặc DB thật. [Helper DB dùng chung](../tests/helpers/database.ts) tạo DB riêng cho từng suite và áp toàn bộ migration theo journal.
Các test bao phủ vòng chơi `/menu`, payload, giả mạo action, nút cũ, claim lặp, receipt qua nhiều service instance, rollback daily/boss và lỗi gửi Discord sau commit.

Kết quả khi hoàn tất giai đoạn 2, trước đợt refactor: 163 test / 22 file đạt; lint và build đạt (171 module được kiểm tra import). Phạm vi kiểm thử hiện tại được mô tả trong [README](../README.md#kiểm-thử). PGlite không mô phỏng đầy đủ tranh chấp khoá giữa nhiều kết nối PostgreSQL; kiểm tra tải nhiều kết nối và giao diện Discord thật vẫn cần môi trường thử nghiệm.

Checklist guild thử nghiệm (chưa chạy live):

1. Người mới: `/menu` → từng class → Huỷ → class khác → tạo → daily → quest → săn quái → log → Trang chủ.
2. Hai menu cùng user: daily/weekly chỉ nhận một lần; refresh trang còn lại thấy trạng thái mới.
3. Boss: thiếu cấp/tiền/đã dùng lượt bị chặn; xem phí → Huỷ không trừ tiền → xác nhận chỉ chạy một trận.
4. Đổi quest: xem cảnh báo → Huỷ giữ tiến độ → xác nhận giữ quest hoàn thành; thử sau reset ngày.
5. Bấm nhanh, mở modal rồi điều hướng, hết TTL, restart bot; kiểm tra phục hồi và các slash command cũ.

Giai đoạn tiếp theo: kho đồ, trang bị, preset, nâng cấp, rune, mở rương và triệu hồi/deity.
