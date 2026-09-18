# Kế hoạch thực hiện gameplay flow

Phạm vi: thực hiện §4–6 của gameplay-flow.md trên kiến trúc PostgreSQL hiện có.
Không dùng agent con theo yêu cầu người dùng. Giữ nguyên các chỉnh sửa có sẵn.

- [x] Chuẩn hóa weighted RNG bằng wrand, luôn truyền RNG; giữ pity tuần tự.
- [x] Inventory/deities phân trang; loot rương + stat gear theo tier; shop rune theo seed.
- [x] Equip/preset đồng bộ loadout; socket đầu miễn phí, mở thêm theo seed, hỗ trợ lane opposite.
- [x] Elite 20%, loot riêng; boss Bakunawa có phí/cooldown và phase dưới nửa HP.
- [x] Blackjack/Crash: nút riêng người chơi, 60 giây, debit trước, settle đúng một lần.
- [x] Hướng dẫn sau create, balance đầy đủ, Ascension prestige; tài liệu lệnh mới.

Các lựa chọn thiết kế đã rà soát: bảng rương dùng đề xuất §5; essence mỗi drop = 1;
Gold gear chia Rare/Mythic 50/50. Gear generator và boss/elite balance mới đặt trong config.
Ascension chỉ là prestige (không thêm stat/blessing). Không triển khai các hệ M7 ngoài phạm vi.
Kiểm tra giao dịch đồng thời, thiếu seed phải rollback, quyền sở hữu item, giới hạn Discord.

## Quyết định balance bổ sung

| Hạng mục | Giá trị triển khai |
| --- | --- |
| Elite | 20% khi có cả regular/elite; thiếu một pool thì dùng pool còn lại |
| Elite thắng | 2.500–5.000 Credux, 500–750 EXP trước scale, 20–30 shards, 35% Gold |
| Elite thua | 100 EXP trước scale |
| Boss | Cấp 10, phí 10.000 Credux, một lượt/ngày Asia/Manila, thắng/thua đều tính lượt |
| Boss thắng | 25.000–50.000 Credux, 1.500–2.500 EXP trước scale, 100–200 shards, 1 Boss Treasure, 30% Mythic gear |
| Boss thua | 150 EXP trước scale |
| Bakunawa Eclipse | Dưới 50% HP: +50 điểm phần trăm damage bonus; miễn stun |
| Aswang Queen | Hồi 10% sát thương gây ra; miễn poison/venom |
| Gear rơi | Weapon/armor 50/50; chọn đều roster có isAvailable đúng tier |
| Rare gear | ATK 80–120, CRIT 2–4%; armor HP 400–600, DEF 40–60 |
| Mythic gear | ATK 160–240, CRIT 4–6%; armor HP 800–1.200, DEF 80–120 |
| Legendary gear | ATK 320–480, CRIT 6–8%; armor HP 1.600–2.400, DEF 160–240 |
| Rune | Roll đều trong pool/tier đã seed, không thêm random rolledValue |
| Socket | Một native + một opposite miễn phí; chỉ mua thêm native theo socket_unlock_cost |
| Ascension | Prestige, không tăng stat hoặc blessing; ghi rõ trước và sau thao tác |

Đây là mặc định mới cho flow, không tuyên bố port số liệu boss/elite từ bản gốc.
Thông số rương giữ đúng §5, các drop item độc lập với nhau và currency luôn được cấp.

## Kiểm chứng và triển khai

- [x] 34 test domain/integration/Discord collector qua.
- [x] TypeScript build và ESLint qua.
- [x] pnpm frozen lockfile install qua, không chạy dependency install scripts.
- [x] Rà lại quyền sở hữu, debit/credit, rollback và session expiry; giữ thay đổi có sẵn.

Test domain, giao dịch PGlite và giả lập Discord collector ở `tests/`.
PGlite chạy một connection, không phải bài thử contention nhiều connection của PostgreSQL thật.
Không chạy bot, deploy slash commands hoặc migrate/seed DB thật trong phiên này.
Cần `pnpm deploy:commands` và restart bot để dùng `/raid hunt|boss`, các subcommand casino và lệnh mới.
Nếu DB chưa có roster thì chạy migration/seed theo README trước.

`wrand` 1.2.0 đã xác minh chạy trong bản build Node ESM bằng import trực tiếp
`wrand/lib/randomPicker.js`. Wrapper bắt buộc truyền RNG cho `pick`;
deck dùng RandomPicker removeOnPick. Đã cài thành công từ pnpm frozen lockfile.

## Ghi nhận kỹ thuật

Rà flow phát hiện lỗi có sẵn: gear starter không có socket, rune seed là fraction
nhưng combat chia thêm 100, Aegis chưa chặn một hit, Blight chưa giảm ATK,
duration debuff kiểm tra ngược snapshot, và summon thiếu seed có thể commit debit
cùng một phần pull. Đã sửa và bổ sung test. Giữ tài liệu port cũ ở `port-history.md`.
`.gitignore` đổi `data/` thành `/data/` để seed source không bị loại khỏi Git.

### Unified outcome selection

All discrete outcome selections now use wrand with an explicit seeded RNG, including
Mage multiplier/debuff, raid drops, enhancement, Crash, combat procs, crit, coin and dice.
This supersedes the earlier gameflow exceptions for crit and coin. Shared helpers live
in src/utils/weightedRandom.ts. Probability inputs use fractions; percentage callers
convert explicitly. Zero-weight outcomes are excluded; finite probabilities are clamped
to [0, 1] to preserve guaranteed/impossible stat outcomes. wrand assigns exact cumulative
weight boundaries to the preceding outcome (unlike the previous strict comparisons).
Numeric reward/stat ranges and continuous damage variance retain direct seeded sampling;
crypto remains responsible for IDs and seeds. Equal seeds replay deterministically within
this implementation; outcomes at exact boundaries can differ from older versions.
