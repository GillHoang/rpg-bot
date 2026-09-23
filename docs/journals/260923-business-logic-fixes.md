# Sửa lỗi nghiệp vụ và test — 2026-09-23

Đã xử lý R1–R11 trong báo cáo [review](../business-logic-review-2026-09-23.md), tự thực hiện không dùng agent con.

Các nguyên nhân chính là giới hạn database lệch cấu hình, fraction bị dùng như điểm phần trăm, hiệu ứng tích lũy ngoài ý muốn, gộp sự kiện tham gia với thắng trận, và bỏ qua kết quả cấp quyền sở hữu. Ranked có hai nhánh settlement lệch nhau; truy vấn history giới hạn 50 bị dùng để suy ra cả chuỗi thắng.

Đã thêm migration 0003 cho cap 100 và bigint EXP, dùng hệ số blessing từ config, tách ranked participation/win, dùng chung settlement từng người và phép đếm streak bằng SQL. Shop chỉ tiêu tiền/quota sau khi cấp thành công. First Blood được cấp idempotent khi thắng duel. Guard duel dọn participant hết hạn và xử lý insert xung đột thành busy, xóa claim dở dang trong transaction.

Đã gom presenter daily và phép tính progress quest. Menu giữ riêng tư theo contract test, format số Việt Nam. Test nhãn profile đã đổi từ tên cũ EXP sang Kinh nghiệm. Snapshot combat được cập nhật do sửa số round và Tailwind, kèm assertion round trực tiếp.

Trong lượt kiểm chứng toàn bộ, việc sắp xếp guard duel theo ID làm đổi thứ tự ưu tiên báo lỗi. Đã tách thứ tự xử lý khóa khỏi ưu tiên challenger/opponent. Lỗi assertion này còn để lại duel trong test database, khiến ca decline sau đó fail theo; suite duel nay dọn pending challenges trước mỗi test.

Bằng chứng kiểm chứng:

- 11 regression ban đầu đều fail trước khi sửa production code.
- 20 regression nghiệp vụ và 1 test nâng migration có dữ liệu đều pass.
- Sau sửa ưu tiên báo busy, `m7.test.ts` và regression nghiệp vụ đạt 32/32 pass.
- Full suite cuối cùng: **349 tests — 342 pass, 0 fail, 7 skipped**. Các test skipped thuộc PostgreSQL nhiều kết nối do chưa cấu hình `TEST_DATABASE_URL`.
- ESLint, TypeScript compile/typecheck, text/emoji boundaries, Markdown links và `git diff --check` đều pass. Build import smoke check tải thành công 234 module.
- Snapshot Drizzle mới so với schema biên dịch không có khác biệt migration (`generateMigration` trả `[]`). CLI generate bị lỗi hệ thống `uv_os_get_passwd`; migration/snapshot được tạo cục bộ và đối chiếu qua API Drizzle cùng test database.

Chưa chạy migration lên database ứng dụng, chưa commit/deploy. Cần migration 0003 trước khi chạy bản mới; không tự bù tiền/title hay viết lại lịch sử. PostgreSQL nhiều kết nối cần `TEST_DATABASE_URL`, không được suy ra là đã kiểm chứng từ PGlite. Xem [triển khai](../audit-deployment.md).
