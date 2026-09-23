# Cấu hình text của bot

Sửa nội dung hiển thị trong `src/text`. Các file TypeScript chứa chuỗi tĩnh hoặc hàm tạo câu có số liệu; không cần sửa command/service để đổi wording.

## Tìm đúng file

| File / thư mục | Nội dung |
| --- | --- |
| `gameplay.ts` | Menu trang chủ, nhân vật, daily/quest, xác nhận, kết quả chiến đấu và thông báo gameplay |
| `menu.ts` | Điều hướng, tìm kiếm, placeholder, thông báo phiên menu |
| `battleLog.ts` | Phân trang nhật ký, nút đánh lại, cooldown và lỗi cập nhật |
| `common.ts` | Thông báo chung, tiền tệ, lệnh không khả dụng, thiếu dữ liệu thưởng |
| `start.ts`, `classes.ts` | Tạo nhân vật, chỉ số hiển thị, lore và mô tả class |
| `raid.ts`, `ranked.ts`, `duel.ts`, `combat.ts` | Lệnh chiến đấu, mùa ranked, kết quả và combat log |
| `profile.ts`, `balance.ts` | Text trên profile card và số dư |
| `daily.ts`, `quest.ts` | Daily và nhiệm vụ |
| `inventory.ts`, `loadout.ts`, `loot.ts` | Kho đồ, tên preset mặc định, rương và phần thưởng |
| `summon.ts`, `deity.ts`, `enhance.ts`, `socket.ts` | Triệu hồi, deity, enhance, socket và tên lựa chọn |
| `casino.ts`, `pvp.ts`, `cosmetic.ts` | Casino, cửa hàng PvP và cosmetic |
| `help.ts`, `autocomplete.ts`, `reset.ts`, `ping.ts` | Trợ giúp, gợi ý nhập lệnh và quản trị |
| `icons.ts` | Emoji/icon dùng chung |
| `catalog/weapons.ts`, `catalog/armors.ts` | Tên trang bị, mythology, nội tại, mô tả và lore |
| `catalog/deities.ts`, `catalog/mobs.ts` | Tên, mythology, blessing/skill và mô tả |
| `catalog/runes.ts`, `catalog/titles.ts`, `catalog/cosmetics.ts` | Tên rune, danh hiệu, cosmetic và mô tả/điều kiện |

## Cách sửa

- Chuỗi tĩnh: sửa nội dung trong dấu nháy.
- Hàm tạo câu: sửa câu quanh `${...}`; giữ tên/thứ tự tham số và placeholder. Ví dụ `GAMEPLAY_NOTICE.cooldown(seconds)` dùng `seconds` do gameplay truyền vào.
- Giữ escape Markdown, dấu xuống dòng `\n` và giới hạn độ dài Discord, nhất là mô tả slash command và nhãn nút.
- Key object và tên export là địa chỉ code sử dụng, không đổi tên chúng khi chỉnh wording.
- Các con số trong câu chỉ là mô tả; thay phí/cooldown/cấp yêu cầu trong text không thay luật gameplay.

## Áp dụng trên VPS

**Text giao diện:** build lại và restart bot. Với Docker Compose:

```sh
docker compose up -d --build bot
docker compose logs --tail=100 bot
```

Entrypoint hiện chạy migration, seed và đăng ký slash commands trước khi khởi động bot, nên mô tả lệnh và catalog được cập nhật trong lần triển khai này.

**Chạy trực tiếp bằng Node:** sau khi sửa, chạy `pnpm build` rồi restart tiến trình. Nếu đổi mô tả/lựa chọn slash command, chạy thêm `pnpm deploy:commands` với scope đang sử dụng. Nếu đổi `catalog/*`, chạy `pnpm db:seed` với đúng `DATABASE_URL`.

**Dữ liệu đã lưu:** đổi tên preset mặc định và mẫu tên season chỉ áp dụng khi tạo preset/season mới; không tự đổi các bản ghi cũ. Seed không tự đổi tên lịch sử trận đấu đã lưu.

## Catalog và định danh

Catalog được tách theo key/ID ổn định. Giữ nguyên các key này. Tên starter weapon/armor được `config/starter.ts` lấy từ cùng catalog, tránh lệch tên tra cứu khi tạo nhân vật.

**Mob là ngoại lệ:** seed hiện đối chiếu bằng `(name, mythology, mobType)`. Đổi `name` hoặc `mythology` của mob có thể tạo bản ghi mới; cần migration/đối soát DB nếu đổi các trường đó. Đổi mô tả skill thì không đổi khóa này.

Những chuỗi còn ở ngoài `src/text` là định danh và dữ liệu kỹ thuật: tên slash command/subcommand, custom ID, trạng thái, tier/bracket, enum class, key passive/skill, token kết quả casino, đường dẫn, SQL, log vận hành và lỗi nội bộ. Đây không phải cấu hình wording. Số liệu gameplay vẫn nằm trong `src/config` và `src/seed/data`.
