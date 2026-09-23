# Tiến độ thực hiện audit — 2026-09-23

Kế hoạch: [bug-audit-refactor-plan.md](bug-audit-refactor-plan.md). Hướng dẫn triển khai: [audit-deployment.md](audit-deployment.md).

## Phạm vi và quyết định

- Thực hiện trên nhánh codex/bug-audit-refactor; giữ thay đổi có sẵn của người dùng. Dùng CodeGraph để tìm code. Không dùng agent con, kể cả review.
- Chỉ sửa source, tài liệu, CI và migration; chưa chạy migration trên database ứng dụng, chưa commit/push/deploy.
- Season chuyển thủ công sau endsAt, không tự phát thưởng cuối mùa/reset rating. Ranked double-submit serialize thành hai trận; hunt cooldown giữ phạm vi UI.
- Dữ liệu tuần thiếu năm giữ legacy-W, không đoán năm. Triển khai ở ranh giới tuần hoặc đối soát dữ liệu tuần hiện hành trước khi mở bot.

## Kết quả triển khai

| Nhóm | Trạng thái source | Thay đổi |
|---|---|---|
| BUG-02/03/10 — ranked/khóa | Đã sửa | Bag hai người theo thứ tự ID, đọc lại hai character có khóa; bag trước character ở claim/class-change/shop; duel khóa bag có thứ tự; không tạo fight lock khi không có đối thủ. |
| BUG-01 — tuần có năm | Đã sửa | ISO week-year cho quest/Grand/ranked claim; migration bảo toàn khóa legacy. |
| BUG-04/05 — progression | Đã sửa | Amount, cap target, thưởng một lần; daily/raid/duel/ranked/summon/enhance/open/casino cập nhật trong transaction; loại atomicProgress và subscriber ghi reward bất đồng bộ. |
| BUG-06 — reset | Đã sửa | Khóa bảng bag rồi users; count/truncate/audit trong transaction; defer nút xác nhận; giữ dev_logs và xóa active_ranked_fights. |
| BUG-07/08 — loadout/enhance | Đã sửa | Inventory đọc active preset; bỏ ghi kép và sáu cache character; dùng chung enhancementPlus. |
| BUG-09 — season | Đã sửa | SeasonService/SeasonRepository dùng chung advisory lock; unique partial index; rollover theo expected season ID, chống gọi lặp. |
| Profile | Đã refactor | Summary không tải stats/loadout/title; detail dùng lại preset cho assembly và loadout, bỏ query hasCharacter. |
| Preset ID/constraints | Đã refactor | Identity đặt sau MAX hiện hữu; CHECK currency, class, level, slot, enhancement 1–21 và season window. |
| BUG-11 — tài liệu | Đã sửa | README trỏ tới file tồn tại; thêm link checker trong CI. |
| Quan sát lỗi | Đã bổ sung | Counter và structured log transaction/deadlock/serialization/observer/missing_atomic_progress; observer lỗi không làm action đã commit ném lỗi. |
| Wrapper | Đã rà trong phạm vi thay đổi | Bỏ thao tác season trùng và writer cache không còn dùng; giữ wrapper tương thích có caller, không tạo generic CRUD. |

## Bằng chứng kiểm tra

- Lint source: đạt.
- TypeScript và biên dịch: đạt; kiểm tra import dist tải thành công 220 module.
- Link checker README và tài liệu triển khai: đạt; chỉ kiểm tra đích file local, không kiểm tra HTTP hoặc anchor.
- Drizzle generate: “No schema changes” sau khi đối chiếu snapshot migration.
- Lượt toàn bộ trước bổ sung cuối: 39 file đạt, 288 test đạt; 1 file/7 test PostgreSQL skip.
- Nhóm cuối: 4 file, 43 test đạt (migration, audit regressions, gameplay, M7), gồm multi-summon/open thực tế, lỗi observer, weekly Grand qua hai năm, reset rollback và season rollover.
- Lượt toàn bộ cuối: **39 file đạt, 290 test đạt; 1 file/7 test PostgreSQL skip**, không có test thất bại. Thời gian 106,86 giây.

Kết quả kiểm chứng hiện tại: 290 test local đạt và 7 test PostgreSQL thật đạt ở lượt riêng. Credential chỉ truyền qua môi trường tiến trình chạy test, không ghi vào repository.

Các regression ranked no-opponent, thứ tự bag/character, amount và starter equipment đã được quan sát thất bại trước khi sửa, rồi đạt sau sửa. Test reset audit thất bại đã tái hiện hành vi commit dữ liệu cũ và xác nhận rollback sau sửa.

## Kiểm chứng PostgreSQL và triển khai

- [x] Viết suite PostgreSQL nhiều kết nối và gắn PostgreSQL 16 vào CI.
- [x] Chạy PostgreSQL thật trên database test người dùng cung cấp: **7/7 test đạt**, 9,71 giây; không có test skip/fail trong suite này. Schema tạm được dọn thành công qua teardown.
- [ ] Đối soát database thực tế, backup và chạy migration trong maintenance window. Đây là bước triển khai, chưa thực hiện trên dữ liệu ứng dụng.

Suite PostgreSQL bao phủ daily đồng thời, tiêu số dư casino cuối, ranked cùng đối thủ/đấu chéo/ranked + raid/double-submit, khởi tạo season và reset + start. Các test dùng schema ngẫu nhiên riêng, search_path không fallback public và statement/lock timeout; không dùng DATABASE_URL ứng dụng.
