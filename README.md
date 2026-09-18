# credd-bot-ts

Discord RPG bot viết bằng TypeScript, discord.js v14, Drizzle ORM và PostgreSQL.
Gameflow đã nối từ tạo nhân vật đến loot, gear/rune/deity, elite/boss và casino.

## Chạy project

Yêu cầu Node.js >=20 và PostgreSQL. Copy `.env.example` thành `.env` nếu chưa có,
điền `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL`.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm deploy:commands
pnpm start
```

Dùng `pnpm dev` khi phát triển. Cần deploy lại slash commands sau cập nhật này:
raid thường đổi thành `/raid hunt`; casino chọn game bằng subcommand.
Seed nằm ở `src/seed/data/`, upsert vào roster, không xóa dữ liệu người chơi.
Gameflow dùng các bảng sẵn có; không có migration mới trong đợt này.

## Hành trình người chơi

1. `/register` → `/create class:Knight`: nhận starter gear, 1.000 shards, 10 Silver Chest.
2. `/daily` nhận tài nguyên; `/raid hunt` lấy EXP/loot, có 20% gặp elite khi đã seed đủ.
3. `/inventory category:bag|weapons|armors|runes page:1` và `/deities page:1` tra tài nguyên/ID.
4. `/open chest:silver|gold|boss_treasure|boss_golden count:1` mở 1–10 rương.
5. `/equip kind:weapon|armor|deity id:<ID> preset:1` trang bị; bỏ preset để dùng slot đang active.
6. `/enhance gear_id:<ID>` nâng gear; `/preset switch slot:2` đổi bộ trang bị.
7. `/summon` dùng shards; `/deity sigil` tăng chỉ số; `/deity ascend` chỉ nhận prestige.
8. `/runes shop` xem giá; `/runes shop bag:lb|gb|db` mua và mở ngay một rune.
9. `/socket equip rune_uid:<ID> gear_id:<ID> slot_num:1 lane:native|opposite` gắn rune.
   Mỗi lane có slot 1 miễn phí; `/socket unlock gear_id:<ID>` mua thêm native socket theo seed.
   `/socket unequip rune_uid:<ID>` tháo rune.
10. `/raid boss`: Bakunawa, cấp >=10, phí 10.000 Credux/lượt, một lượt mỗi ngày
    (reset 00:00 Asia/Manila). Thắng nhận Boss Treasure và có 30% rơi Mythic gear.
11. `/casino coin_toss|dice_roll|slot_machine|baccarat|blackjack|crash bet:<số>`.
    Blackjack/Crash có nút của chủ ván, 60 giây tự Stand/Cash Out. Cược trừ trước;
    phiên lưu DB, bot phục hồi kết toán phiên hết hạn khi chạy lại.
12. `/balance`, `/profile` xem tài nguyên và sức mạnh từ preset đang dùng.

## Balance và phạm vi

- Rương dùng bảng đề xuất ở [gameplay-flow.md](docs/gameplay-flow.md) §5.
  Giá trị bổ sung và lựa chọn triển khai ghi trong [gameplay-implementation.md](docs/gameplay-implementation.md).
- `src/config/chestLoot.ts`: loot rương, stat generator Rare/Mythic/Legendary.
- `src/config/raidLoot.ts`: phần thưởng regular/elite/boss và điều kiện vào boss.
- `src/seed/data/runeEconomy.ts`: giá shop, pool rune và giá mở socket.
- Weighted selection dùng `wrand` với RNG được truyền vào. `src/utils/weightedRandom.ts`
  dùng module triển khai của wrand 1.2.0 vì entry point được publish trỏ tới file thiếu.
- Stat rune theo đơn vị fraction của seed (`0.05 = 5%`); Aegis chặn một đòn/trận.
  Gear/deity mới phải được trang bị vào preset để có tác dụng, deity đầu tự equip nếu slot trống.
- Ascension không tăng stat hay kích hoạt blessing; 10 Sigil đã đạt 100% base stat.
- Chưa thuộc phạm vi: PvP/ranked, quest/vote/cosmetic, pantheon/resonance, deity blessing,
  các boss khác và passive weapon/armor. Seed roster vẫn là dữ liệu mẫu để phát triển.

## Kiểm tra và kiến trúc

```sh
pnpm test
pnpm build
pnpm lint
```

Test dùng PGlite chạy SQL PostgreSQL trong bộ nhớ, không đọc `.env` hoặc chạm DB thật;
kiểm tra loot rollback, quyền sở hữu, preset/stat, boss, summon, casino settlement và
Discord collector giả lập. PGlite chỉ có một connection: các test Promise.all kiểm tra
kết quả các lệnh chồng nhau, không thay thế stress test khóa hàng trên PostgreSQL nhiều connection.
Chưa xác minh thao tác trên Discord thật.

`commands/` xử lý Discord; `services/` điều phối transaction; `repositories/` đọc/ghi dữ liệu;
`domain/` chứa combat/casino engine; `config/` chứa balance; `text/` chứa wording hiện có.
Giao dịch tiêu/nhận tài nguyên khóa bag trước khi đọc và cập nhật để bảo vệ read–modify–write.
Casino lưu seed/action server-side và dùng revision trên nút để loại thao tác từ lượt cũ.

[Lịch sử port trước gameflow](docs/port-history.md) được giữ làm tham khảo, không phải hướng dẫn chạy hiện tại.
