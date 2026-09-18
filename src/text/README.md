# src/text — toàn bộ text hiển thị của bot

Mọi chuỗi người chơi nhìn thấy (tên lệnh, mô tả, câu trả lời, lore, nhãn
trên thẻ profile, battle log...) nằm trong folder này. Muốn đổi wording,
sửa đúng file tương ứng rồi restart bot — không cần đụng code logic.

## Các file

| File | Nội dung |
| --- | --- |
| `common.ts` | Câu dùng chung nhiều lệnh + tên tiền tệ (Credux, Belief Shards) |
| `register.ts` | `/register` |
| `create.ts` | `/create` |
| `balance.ts` | `/balance` |
| `daily.ts` | `/daily` + nhãn rương (Silver/Gold/Boss...) |
| `profile.ts` | `/profile` + nhãn vẽ trên thẻ (HP/ATK/DEF/CRIT...) |
| `raid.ts` | `/raid` (khung thông báo chiến thắng/thất bại, reward) |
| `summon.ts` | `/summon` + alias tier (Remnant/Awakened/...) |
| `enhance.ts` | `/enhance` |
| `socket.ts` | `/socket` |
| `deity.ts` | `/deity` (Sigil/Ascension) |
| `casino.ts` | `/casino` + tên 4 game |
| `classes.ts` | Lore + passive text của 5 lớp nhân vật |
| `combat.ts` | Battle log hiện trong `/raid` (hit/crit/passive/rune) |

## Quy tắc

1. Chuỗi tĩnh: sửa trực tiếp trong ngoặc kép.
2. Chuỗi có biến (hàm arrow): chỉ sửa wording **quanh** placeholder,
   giữ nguyên thứ tự/tham số — code gọi hàm đang truyền số liệu vào.
3. Chỉ text, không viết logic trong folder này.
4. `index.ts` re-export tất cả; import từ `'../text/index.js'` (hoặc file
   cụ thể) ở nơi sử dụng.

## Lưu ý: những gì KHÔNG nằm ở đây

- **Tên lệnh** (`register`, `casino`, subcommand `equip`...) và **key
  trạng thái** (`not-registered`, `ok`...) — là định danh logic, đổi sẽ
  vỡ quyền hạn DB/discord registration.
- **Giá trị token kết quả casino** (`heads`, `tails`, `blank`...) — được
  lưu vào `casino_logs` trong DB, là dữ liệu chứ không phải text thuần.
- **Dữ liệu seed** (`src/seed/data/` — tên deity, mob, vũ khí...) — là
  game data trong DB, chỉnh qua seed.
- Màu/font trong `ProfileCardRenderer` — là style, không phải text.
