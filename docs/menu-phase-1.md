# Menu all-in-one — giai đoạn 1

## Phạm vi đã triển khai

- `/menu` mở bảng riêng tư bằng Components V2; chưa thay thế các slash command cũ.
- Select chuyển khu vực, nút Trang chủ/Quay lại/Làm mới/Đóng.
- Hướng dẫn có chọn chủ đề và modal tìm từ khoá (hỗ trợ tiếng Việt không dấu).
- Các khu vực nhân vật/kho/deity/chiến đấu/casino/shop hiện là trang chỉ dẫn các lệnh hiện có. Chưa đọc DB hoặc thực hiện gameplay.
- Không thêm bảng DB, không thay đổi balance, không chuyển package manager trong giai đoạn này.

## Luồng xử lý

`MenuCommand` và `DiscordBot` dùng chung `menuRouter` trong `src/menu/menuRuntime.ts`.
`MenuRouter.handle()` chỉ nhận custom ID bắt đầu bằng `menu:`; các collector cũ vẫn xử lý duel, casino và battle log.
Menu không tạo collector trên từng message và không giữ interaction token lâu dài.

`MenuSessionStore` giữ UI state trong RAM: owner, message ID, revision, màn hình, lịch sử tối đa 12 màn hình, modal nonce và khoá đang xử lý.
Mỗi `/menu` tạo phiên độc lập, kể cả cùng một user mở hai lần. Giới hạn 5 phiên/user, tối đa 2.000 phiên/process.
Mở phiên thứ 6 thay thế phiên cũ nhất không đang xử lý của chính user; không đẩy phiên của người khác để lấy chỗ.

ID: `menu:v1:<sessionId>:<revision>:<action>[:<modalNonce>]`, dài dưới 100 ký tự.
Quyền sở hữu và message ID được kiểm tra trước khi xử lý. Select values và modal input luôn được kiểm tra lại trên server.
Khoá được lấy đồng bộ trước await để chặn double-click trong lúc cập nhật. Mỗi điều hướng thành công tăng revision và huỷ modal cũ.
Mở modal trả lời bằng `showModal` ngay; các thao tác cập nhật message dùng `deferUpdate` trước.

## Hết hạn và lỗi

- TTL 10 phút không hoạt động; hoạt động hợp lệ gia hạn TTL.
- Quét RAM mỗi 60 giây sau ClientReady; kiểm tra TTL ngay khi bấm để không phụ thuộc chu kỳ quét.
- Không cố sửa message ephemeral bằng token cũ khi TTL hết. Message cũ có thể còn hiển thị nút; bấm vào sẽ nhận thông báo riêng và nút **Mở menu mới**.
- Khi restart, RAM mất; nút cũ cũng đi qua đường phục hồi này. Nút mở lại tạo phiên mới cho chính người bấm, không chạy lại hành động cũ.
- Khi gửi cập nhật thất bại, xoá phiên và đưa nút mở lại. Không tự retry nghiệp vụ vì kết quả HTTP có thể không chắc chắn.
- Lỗi mở menu thay thông báo loading bằng thông báo phục hồi khi token còn dùng được. Nếu Discord từ chối cả phản hồi lỗi, chỉ ghi log.
- Phạm vi giai đoạn 1 là một process bot. Không coi RAM lock/revision là cơ chế chống trừ tiền hai lần xuyên restart hoặc nhiều replica.

## Kiểm thử

`tests/menu-session.test.ts`: owner/message binding, TTL, memory bounds, bảo vệ phiên đang xử lý.
`tests/menu-router.test.ts`: hai user/hai phiên cùng user, điều hướng, stale button/modal, input giả, click đồng thời, restart, đóng, lỗi mạng/ack, phục hồi.
`tests/menu-views.test.ts`: serialize builder thật, giới hạn component/text/options, ID duy nhất, modal Label/TextInput, tìm tiếng Việt.

Chạy `npm test`, `npm run lint:check`, `npm run build` bằng dependencies hiện có. Repo vẫn giữ lockfile/packageManager pnpm; thay đổi đó là công việc riêng.
Chưa xác minh Discord thật: triển khai command vào guild thử nghiệm bằng `npm run deploy:commands:guild -- <guildId>`, khởi động bot, rồi kiểm tra trên desktop/mobile.
Không chạy script deploy khi unit test; các test menu không kết nối Discord hoặc DB.

## Checklist thử trên guild

- Hai tài khoản mở menu; chỉ chủ nhân thao tác được. Cùng tài khoản mở hai menu và điều hướng độc lập.
- Chọn khu vực → Hướng dẫn → chủ đề → Quay lại → Trang chủ.
- Mở modal, tìm “trieu hoi”; submit rỗng hoặc dài quá giới hạn không được chấp nhận.
- Bấm nhanh cùng nút, mở modal rồi đổi màn hình; thao tác cũ không áp dụng.
- Đóng → mở lại; để yên hơn 10 phút → mở lại; restart bot → bấm nút cũ → mở lại.
- Các slash command/collector cũ vẫn hoạt động bình thường.

## Nối tiếp giai đoạn 2

Thêm onboarding, query tổng quan, daily/quest/raid vào màn hình. Gọi trực tiếp service, không giả lập slash interaction.
Trước khi nối thao tác ghi: xác thực lại DB trong transaction, bổ sung mã thao tác được lưu cùng giao dịch khi cần chống replay, và xử lý quest/reputation event nhất quán.
Không dùng khoá UI trong RAM để thay thế transaction, quyền sở hữu hay kiểm tra số dư của service.
