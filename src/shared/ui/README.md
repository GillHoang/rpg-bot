# Cấu hình text của bot

Sửa nội dung hiển thị trong `src/shared/ui/text`. Các file TypeScript chứa chuỗi tĩnh hoặc hàm tạo câu có số liệu; không cần sửa command/service để đổi wording.

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
| `icons.ts` | Unicode, custom emoji Discord, fallback canvas và asset thanh tiến độ |
| `format.ts` | Locale mặc định và hàm định dạng số dùng chung |
| `diagnostics.ts` | Lỗi nội bộ, validation môi trường, log vận hành và thông báo CLI |
| `catalog/weapons.ts`, `catalog/armors.ts` | Tên trang bị, mythology, nội tại, mô tả và lore |
| `catalog/deities.ts`, `catalog/mobs.ts` | Tên, mythology, blessing/skill và mô tả |
| `catalog/runes.ts`, `catalog/titles.ts`, `catalog/cosmetics.ts` | Tên rune, danh hiệu, cosmetic và mô tả/điều kiện |

## Cách sửa

- Chuỗi tĩnh: sửa nội dung trong dấu nháy.
- Hàm tạo câu: sửa câu quanh `${...}`; giữ tên/thứ tự tham số và placeholder. Ví dụ `GAMEPLAY_NOTICE.cooldown(seconds)` dùng `seconds` do gameplay truyền vào.
- Giữ escape Markdown, dấu xuống dòng `\n` và giới hạn độ dài Discord, nhất là mô tả slash command và nhãn nút.
- Key object và tên export là địa chỉ code sử dụng, không đổi tên chúng khi chỉnh wording.
- Các con số trong câu chỉ là mô tả; thay phí/cooldown/cấp yêu cầu trong text không thay luật gameplay.

## Thêm text cho tính năng mới

Thêm hằng số hoặc hàm vào module tương ứng, dùng key theo ý nghĩa và tham số có kiểu rõ ràng. Import trực tiếp module đó ở nơi sử dụng. Ví dụ:

```ts
// src/shared/ui/text/loot.ts
export const LOOT_GEAR_RECEIVED = (name: string, tier: string, id: string): string =>
  `${name} (${tier}) · ID: ${id}`;
```

Giữ câu hoàn chỉnh trong text module để có thể sửa thứ tự từ và dấu câu mà không sửa service. Text module không import runtime service, DB, logger hoặc env; type-only import được phép. `diagnostics.ts` không có runtime dependency nên dùng được ngay khi kiểm tra env/bootstrap. `LOG_EVENT_TEXT` giữ nguyên các tên event phục vụ truy vấn log.

Chưa có chuyển ngôn ngữ theo từng người chơi. Nếu cần tính năng đó, bổ sung catalog locale theo cùng key và chữ ký hàm, rồi truyền locale từ request; tránh thay global locale vì các interaction chạy đồng thời.

## Thêm hoặc thay emoji

- Khai báo Unicode trong `UNICODE_ICONS.<nhóm>.<ýNghĩa>` tại `icons.ts`. Các key có ý nghĩa khác nhau được phép dùng cùng hình và thay độc lập.
- Discord dùng `ICONS`. Mặc định kế thừa Unicode; thêm override `<:name:id>` hoặc `<a:name:id>` vào nhóm tương ứng để dùng custom emoji. Giữ spread `...UNICODE_ICONS.<nhóm>` khi override nhóm.
- Canvas dùng `UNICODE_ICONS`; class trên profile dùng `PROFILE_CLASS_ICONS`. Canvas không hiểu custom emoji Discord. Unicode có thể phụ thuộc glyph/font được cài trên máy.
- Thanh tiến độ dùng `PROGRESS_BAR_EMOJIS` tại `icons.ts`. `shared/utils/progressBar.ts` chỉ chọn ô/màu và re-export hằng số cũ để giữ tương thích.
- Không dán emoji trực tiếp vào help text hoặc template. Dùng `${ICONS.<nhóm>.<key>}` kể cả khi icon nằm giữa câu.

Thay icon/text cần build và restart vì các chuỗi được tạo khi module được nạp; đây không phải cấu hình hot reload.

## Định dạng số

Gọi `formatNumber(value)` thay cho `.toLocaleString()` rải rác. `TEXT_LOCALE` mặc định là `en-US`, giữ dấu phân cách hiện tại và loại bỏ phụ thuộc locale của hệ điều hành. Những nơi đã chỉ định locale riêng vẫn giữ lựa chọn đó; có thể gọi `formatNumber(value, 'vi-VN')` hoặc truyền `Intl.NumberFormatOptions` ở tham số thứ ba. Không dùng chuỗi đã format để tính toán hay làm khóa DB.

## Kiểm tra tự động

Chạy `pnpm check:text` (đã nằm trong `pnpm check`) để tìm emoji ngoài registry, text hiển thị/log viết trực tiếp trong logic và định dạng số ngoài helper. Script dùng AST TypeScript nên đọc được escape Unicode, template và bỏ qua comment/regex. Ngoại lệ cho SQL, font và chuỗi giao thức/lưu trữ được giới hạn rõ trong `scripts/check-text-boundaries.mjs`.

Đây là kiểm tra cú pháp và heuristic, không phải bộ phân loại hoàn hảo cho mọi chuỗi: khi review vẫn cần phân biệt nhãn hiển thị với định danh. `tests/text-presentation.test.ts` kiểm tra thay icon, fallback Unicode, định dạng số và pool rune đồng bộ catalog.

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

Catalog được tách theo key/ID ổn định. Giữ nguyên các key này. Tên starter weapon/armor được `shared/config/starter.ts` lấy từ cùng catalog, tránh lệch tên tra cứu khi tạo nhân vật. Pool rune trong `src/modules/progression/seed/runeEconomy.ts` lấy tên từ `RUNES_TEXT` theo ID, nên đổi tên rune và chạy lại seed sẽ cập nhật cả roster lẫn pool.

**Mob là ngoại lệ:** seed hiện đối chiếu bằng `(name, mythology, mobType)`. Đổi `name` hoặc `mythology` của mob có thể tạo bản ghi mới; cần migration/đối soát DB nếu đổi các trường đó. Đổi mô tả skill thì không đổi khóa này.

Những chuỗi còn ở ngoài `src/shared/ui/text` là định danh và dữ liệu kỹ thuật: tên slash command/subcommand, custom ID, trạng thái, tier/bracket, enum class, key passive/skill, token kết quả casino, đường dẫn, font, SQL, marker che bí mật và action/detail đã lưu trong DB. Đây không phải cấu hình wording. Số liệu gameplay vẫn nằm trong `src/shared/config` và seed của từng module (`src/modules/<tên>/seed`).
