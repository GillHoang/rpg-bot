# Triển khai bản sửa audit

Bản sửa theo [kế hoạch audit](bug-audit-refactor-plan.md); trạng thái kiểm chứng nằm trong [tiến độ](bug-audit-refactor-progress.md).

## Migration 0002

Chưa chạy migration trên database ứng dụng. Migration cần triển khai cùng phiên bản code mới, trong thời gian dừng các instance bot; code cũ không tương thích sau khi bỏ cache character. Sao lưu database trước khi triển khai và thử khôi phục trên môi trường test.

- Khóa tuần đổi thành ISO week-year theo lịch Manila, ví dụ 2026-W39. Dòng cũ thiếu năm giữ dưới legacy-W1…legacy-W53, bao gồm trạng thái claim ranked/Weekly Grand. Không tự gán năm thiếu bằng chứng.
- Triển khai vào ranh giới tuần trước hành động đầu tiên của tuần mới để tránh reset tiến độ/cho claim lại giữa tuần. Nếu phải triển khai giữa tuần, cần đối soát và chuyển riêng dữ liệu thuộc tuần hiện hành từ backup/log sang khóa mới trước khi mở bot. Không đổi toàn bộ dòng legacy sang năm hiện tại.
- Active preset là nguồn trang bị chính thức; sáu cột cache trang bị/deity trên character bị bỏ. Migration dừng nếu có character thiếu active preset; sửa dữ liệu có căn cứ trước khi chạy lại.
- Preset ID dùng identity và bắt đầu sau MAX(id) hiện hữu; không sửa ID hoặc FK hiện có.
- Chỉ được có một season active. Migration dừng nếu dữ liệu đang có nhiều season active; cần đối soát purchase ledger trước khi chọn mùa giữ lại.
- CHECK chặn currency âm, class không hỗ trợ, combat level ngoài 1–50, preset slot ngoài 1–2, enhancement ngoài 1–21 (Divine tối đa +20; giới hạn theo tier vẫn do service kiểm tra), và season có endsAt không sau startsAt. Dữ liệu cũ vi phạm làm migration thất bại, không bị tự động xóa/sửa.
- Dùng pnpm db:migrate sau khi hoàn tất đối soát. Rollback phiên bản phải khôi phục schema/dữ liệu từ backup, không chỉ checkout code cũ.

## Season

Policy triển khai là chuyển mùa thủ công. endsAt là thời điểm sớm nhất được chuyển; hết hạn không tự reset quota shop. Quản trị chạy pnpm season:rollover <expected-active-season-id>. Lệnh khóa và kiểm tra lại mùa hiện tại; gọi lại cùng ID trả stale và không tạo mùa nữa. Mùa mới dài 30 ngày, quota shop gắn seasonId mới. Rating và thưởng cuối mùa giữ nguyên; không tự phát thêm thưởng hoặc reset rating.

## Giao dịch và sự kiện

Các luồng thay đổi tài nguyên lấy bag trước character; nhiều người thì lấy tất cả bag theo discordId tăng dần. Ranked đọc lại cả hai character sau khóa. Reset lấy khóa bảng bag trước users để serialize với start rồi count/truncate/audit trong một transaction; vẫn nên dùng reset trong thời gian bảo trì.

Daily, raid/boss thắng, ranked/duel thắng, summon, enhance attempt, open chest và casino settlement cập nhật quest/EXP trong transaction chính. Số lượng summon/chest được cộng đủ và cap target. Menu không còn chọn atomicProgress. EventBus chỉ có observer; observer thất bại không đảo kết quả hành động đã commit và không ghi reward bất đồng bộ.

Ranked double-submit hiện được serialize thành hai trận độc lập; không có requestId để deduplicate. Menu raid vẫn dùng receipt để chống xử lý lại cùng interaction.

## Kiểm tra

- pnpm check: lint, typecheck, Vitest và link file Markdown trong README/tài liệu này.
- pnpm test:postgres: cần TEST_DATABASE_URL trỏ tới database test (tên chứa test), tài khoản có quyền CREATE schema trong database test, không cần CREATEDB. Suite tạo schema credd_audit_<UUID> riêng, đặt search_path riêng cho mọi kết nối (không fallback public), đổi qualifier FK public trong SQL migration sang schema tạm rồi chạy migration và dọn đúng schema đó; không dùng DATABASE_URL.
- CI có PostgreSQL 16 và chạy cả suite nhiều kết nối. Khi thiếu TEST_DATABASE_URL, các test này được báo skipped, không được xem là đã kiểm chứng concurrency.
- Metric gameplay_failure_total có nhãn transaction/deadlock/serialization/observer/missing_atomic_progress. Counter trong tiến trình reset khi bot khởi động lại; thu thập structured log để theo dõi dài hạn. Không có retry tự động cho giao dịch gameplay.
