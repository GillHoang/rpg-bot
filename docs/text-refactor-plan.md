# Text và emoji: kế hoạch refactor

Phạm vi: hoàn thiện `src/text` hiện có, giữ nguyên nội dung Discord và hành vi gameplay. Không đổi tên lệnh, custom ID, enum, SQL, khóa lưu trữ hay dữ liệu người chơi.

- [x] Gom Unicode và custom emoji về `src/text/icons.ts`; có bộ Unicode riêng cho canvas, giữ API string hiện tại cho Discord.
- [x] Chuyển text còn sót, lỗi và log sang các module text theo chức năng; tham chiếu tên rune từ catalog khi seed pool.
- [x] Bổ sung kiểm tra AST chống emoji/text hardcode, kiểm tra tương thích đầu ra và các trường hợp Unicode/custom emoji.
- [x] Chạy lint, typecheck, test, build; cập nhật hướng dẫn thêm text/icon và ghi nhận kết quả.

Đã tự rà soát kế hoạch: tiếp tục dùng hằng số và hàm TypeScript có kiểu; chưa thêm framework dịch, global locale hay registry runtime vì hiện chỉ có một ngôn ngữ. Các thông báo vận hành tách khỏi nội dung người chơi. Canvas không được nhận markup custom emoji của Discord.

## Kết quả kiểm tra

- So sánh tự động 905 giá trị tĩnh có sẵn trong text/catalog/icon với HEAD: không thay đổi.
- ESLint, TypeScript, kiểm tra ranh giới text và liên kết Markdown: đạt.
- Build TypeScript và kiểm tra import của 232 module dist: đạt.
- Lần chạy toàn bộ sau refactor: 311 test đạt, 8 lỗi, 7 bỏ qua; cùng 8 lỗi của baseline trước thay đổi (baseline: 293 đạt, 8 lỗi, 7 bỏ qua).
- Sau khi bổ sung kiểm tra canvas và dependency text: 49 test liên quan trong 6 suite đạt; bao gồm toàn bộ 20 test mới về nội dung/emoji.
- 8 lỗi có sẵn: 5 ở `gameplay-panels`, 1 ở `menu-gameplay` do test kỳ vọng dấu chấm nhưng panel đang chủ động dùng `en-US`; 2 ở `menu-router` do test kỳ vọng ephemeral trong khi `open()` đang gọi `deferReply()` không có flags. Không sửa hành vi này trong refactor nội dung.

Chạy công cụ trực tiếp bằng Node từ `node_modules` vì launcher `pnpm` trên máy tự yêu cầu cài lại dependencies rồi dừng do không có TTY. Không cài lại hoặc thay lockfile. Không chạy seed, deploy slash commands hay kết nối Discord production.

Mặc định số dùng `en-US` rõ ràng để giữ đầu ra hiện có trên môi trường kiểm tra và ổn định giữa các máy. Các nơi đã chỉ định `vi-VN` tiếp tục giữ locale đó. Thẻ profile dùng Unicode thay cho chuỗi markup custom emoji trước đây.
