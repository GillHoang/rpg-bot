# credd-bot-ts

Discord RPG bot — rewrite TypeScript của `credd-bot` trên discord.js v14,
Drizzle ORM và PostgreSQL. Gameflow khép kín từ tạo nhân vật đến endgame:

- **Nhịp hằng ngày** — `/daily`, `/raid hunt|boss`, casino 6 game, rương loot.
- **Meta tiến trình** — gacha deity, Sigil/Ascension, enhance gear, rune +
  socket, pantheon 2/3 + resonance, deity blessing trong combat.
- **PvP (M7)** — duel cược trực tiếp, ranked Elo async mirror match, PVP shop
  Valor Medals.
- **Tiến trình dài hạn (M7)** — quest daily/weekly, believer EXP, cosmetics +
  titles, relics, rune bag, Diamond/Genesis chest.

Thiết kế flow: [docs/gameplay-flow.md](docs/gameplay-flow.md) ·
triển khai gameflow: [docs/gameplay-implementation.md](docs/gameplay-implementation.md) ·
triển khai M7: [docs/m7-implementation.md](docs/m7-implementation.md).

## Yêu cầu

- Node.js >= 20
- PostgreSQL (bot dùng transaction + `FOR UPDATE` khóa hàng)
- Bot Discord application (token + client ID)

## Cài đặt và chạy

1. Copy `.env.example` thành `.env` và điền:

   | Biến | Ý nghĩa |
   | --- | --- |
   | `DISCORD_TOKEN` | Token bot từ Discord Developer Portal |
   | `DISCORD_CLIENT_ID` | Application ID dùng để đăng ký slash commands |
   | `DATABASE_URL` | `postgres://user:password@localhost:5432/credd` |
   | `LOG_LEVEL` | Tuỳ chọn — `fatal`…`trace`, mặc định `info` |

2. Cài đặt và khởi tạo:

   ```sh
   pnpm install --frozen-lockfile
   pnpm db:migrate          # áp migration vào PostgreSQL
   pnpm db:seed             # upsert roster + seed M7 (cosmetic/title/ranked_reward)
   pnpm build
   pnpm deploy:commands     # đăng ký slash commands lên Discord
   pnpm start               # chạy bản build trong dist/
   ```

   Phát triển dùng `pnpm dev` (tsx watch).

3. **Khi cập nhật bot từ phiên bản cũ**, hai bước luôn phải chạy lại:
   - `pnpm db:seed` — seed ở `src/seed/data/` upsert theo khóa nghiệp vụ,
     không xoá dữ liệu người chơi; thiếu seed mới (M7) thì genesis chest và
     title grant sẽ lỗi.
   - `pnpm deploy:commands` — slash command mới/chỉnh option chỉ có hiệu lực
     sau khi deploy lại.

Không cần cron hay job ngoài: reset daily/weekly (quest, reputation cap,
thưởng tuần) theo **lazy reset** trên lịch Asia/Manila — so ngày tại điểm đọc;
scheduler trong bot chỉ quét dọn duel hết hạn và lock treo mỗi 30 giây.

## Lệnh

Nhóm kinh tế và tiến trình cơ bản:

| Lệnh | Chức năng |
| --- | --- |
| `/register` | Mở account + bag + pity counter |
| `/create class:<Swordsman\|Fighter\|Mage\|Knight\|Archer>` | Tạo nhân vật: starter gear auto-equip, +1.000 shards, +10 Silver Chest, base cosmetics |
| `/balance` | Credux, shards, rương, essence + gợi ý lệnh |
| `/daily` | Quà hằng ngày theo streak 1–30, milestone chest theo streak tổng |
| `/profile` | Thẻ nhân vật canvas: stat trận đấu, EXP, title, believer level, pvp rating |
| `/inventory category:bag\|weapons\|armors\|runes page:N` · `/deities page:N` | Liệt kê tài nguyên/ID để dùng cho các lệnh nhận ID |

Combat và loot:

| Lệnh | Chức năng |
| --- | --- |
| `/raid hunt` | Săn mob thường, 20% gặp elite (loot riêng, Gold Chest) |
| `/raid boss` | Bakunawa: cấp ≥ 10, phí 10.000 Credux, 1 lượt/ngày (00:00 Asia/Manila), phase Eclipse dưới 50% HP |
| `/open chest:silver\|gold\|boss_treasure\|boss_golden\|diamond\|genesis count:1–10` | Mở rương theo loot table; rương lớn rơi rune bag, gear Supreme |
| `/casino coin_toss\|dice_roll\|slot_machine\|baccarat\|blackjack\|crash bet:<số>` | 6 game; Blackjack/Crash có nút 60 giây, phiên lưu DB và tự kết toán khi bot chạy lại |

Gear, rune, deity:

| Lệnh | Chức năng |
| --- | --- |
| `/equip kind:weapon\|armor\|deity\|deity2\|deity3 id:<ID> preset:1` | Trang bị vào preset; deity2/3 là pantheon phụ (stat ×0.5/×0.25) |
| `/preset switch slot:1\|2` | Đổi preset đang dùng (đồng bộ cả pantheon) |
| `/enhance gear_id:<ID>` | +1…+10, Credux trừ cả khi thất bại |
| `/socket equip rune_uid:<ID> gear_id:<ID> slot_num:1 lane:native\|opposite` · `unequip` · `unlock` | Gắn/tháo rune; slot 1 mỗi lane miễn phí, mở thêm theo seed |
| `/summon count:1–30 [relic:sacred\|supreme]` | Gacha 100 shards/lượt với pity 500; relic ép tier (Mythic+/Legendary+) không tốn shards, không đụng pity |
| `/deity sigil user_deity_id:<ID>` · `ascend` | Sigil +5%/lời nguyền (max 10 = 100% base); Ascend chỉ là prestige |
| `/runes shop [bag:lb\|gb\|db]` · `open bag:lb\|gb\|db` | Mua túi bằng essence + Credux, hoặc mở túi rune đang có trong bag |
| `/class change new_class:<X>` | Đổi class bằng Change-Class Token — giữ nguyên level/exp/gear/deity |

PvP (M7):

| Lệnh | Chức năng |
| --- | --- |
| `/duel opponent:@user [stake:<số>]` | Thách đấu 1v1, nút chấp nhận/từ chối 60 giây; cược trừ cả hai khi accept, winner ăn pot, draw hoàn tiền |
| `/ranked fight` · `claim` · `stats` | Elo K=32 đấu async với loadout người chơi ngẫu nhiên ±300 rating; 5 bracket, demotion shield; thưởng tuần theo bracket (≥1 trận/tuần) |
| `/pvp shop` · `buy item:<key>` | Tiêu Valor Medals: Change-Class Token, Diamond Chest, cosmetics, title (cosmetic/title giới hạn 1/season) |

Meta dài hạn (M7):

| Lệnh | Chức năng |
| --- | --- |
| `/quest view` · `refresh` · `claim` | 3 quest daily + 3 weekly sinh tự động, progress qua sự kiện trong game; đủ 3 daily → +1 Sacred Relic; đủ 3 weekly → Weekly Grand (100k + Diamond Chest); refresh 1 lần/ngày |
| `/cosmetic list` · `equip id:<#>` | Cosmetics theo category (profile/battle/battle_result/summon), tier gate theo believer level |
| `/title list` · `equip id:<#>` | Title kiếm qua duel đầu tiên, hạ Bakunawa, thăng bracket ranked, hoặc mua bằng valor |

Hành trình người chơi và dòng tài nguyên (kiếm → tiêu) được thiết kế chi tiết
ở [gameplay-flow.md](docs/gameplay-flow.md).

## Kiến trúc

```
commands/    Discord layer — mỗi slash command 1 class ICommand tự chứa
services/    Facade điều phối: 1 use-case = 1 transaction, khóa bag/character
             trước khi đọc–ghi để bảo vệ read–modify–write
repositories/ Nơi duy nhất viết drizzle query cho từng bảng
domain/      Engine thuần: combat (BattleEngine, Strategy theo class,
             Decorator rune + deity blessing), casino (Strategy 4 game
             một-lượt + session Blackjack/Crash)
config/      Toàn bộ balance số liệu (loot, gacha, ranked, quest, blessings…)
core/        CommandRegistry (Singleton), EventBus (Observer), Scheduler
seed/data/   Dữ liệu seed sửa được — upsert, không xoá dữ liệu chơi
text/        Wording tiếng Việt hiển thị cho người chơi
```

Nguyên tắc nổi bật:

- **EventBus observer**: quest progress và believer EXP là subscriber thuần
  (`core/subscribeDomainEvents.ts`) — combat/economy chỉ emit sự kiện
  (`battle.won`, `summon.done`, `chest.opened`…), không import quest code.
- **Decorator combat**: rune và deity blessing bọc quanh class strategy,
  chain được, engine và 5 class gốc không biết chúng tồn tại.
- **Seeded RNG bắt buộc**: mọi lựa chọn weighted dùng `wrand` qua
  `src/utils/weightedRandom.ts` với RNG từ `domain/combat/Rng.ts` (seed
  entropy cao từ crypto) — không `Math.random()`; cùng seed replay được.
  `wrand` 1.2.0 được import trực tiếp từ `wrand/lib/randomPicker.js` vì
  entry point published trỏ tới file thiếu.
- **Stat trận đấu** từ `StatAssemblyService`: class + gear + deity (pantheon
  1 full / 2 ×0.5 / 3 ×0.25, resonance cùng mythology) + rune stat-% cộng
  dồn rồi nhân một lần. Sudden-death: round 31–40 mọi sát thương ×2^(round−30).
- **Casino** lưu seed/action server-side, dùng revision trên nút để loại thao
  tác từ lượt cũ; phiên hết hạn được kết toán lại khi bot khởi động.

## Kiểm thử

```sh
pnpm test
pnpm build
pnpm lint
```

- 54 test / 6 file, chạy trên **PGlite** (PostgreSQL trong bộ nhớ, SQL thật)
  — không đọc `.env`, không chạm DB thật, RNG được mock để kiểm tra deterministic.
- Phủ: rollback loot khi thiếu seed, quyền sở hữu item, preset/stat, boss fee
  + cooldown, summon pity/relic, casino settlement (kể cả phiên hết hạn),
  duel cược/wager log, ranked Elo/claim-1-lần, quest lazy generation, cap
  believer EXP, sudden-death và từng blessing key, collector nút duel/casino
  giả lập.
- Giới hạn: PGlite chỉ có 1 connection — không thay thế stress test khóa hàng
  trên PostgreSQL nhiều connection; thao tác trên Discord thật (nút, deploy,
  latency) chưa được xác minh tự động.

## Balance và phạm vi

- Số liệu gameflow (rương §5, elite/boss, rune economy, socket):
  [gameplay-implementation.md](docs/gameplay-implementation.md).
- Số liệu M7 (blessing, pantheon/resonance, Elo/bracket, quest, believer EXP,
  relic, rune bag drop, Diamond/Genesis chest, PVP shop):
  [docs/m7-implementation.md](docs/m7-implementation.md) — toàn bộ là mặc định
  mới, chỉnh trong `src/config/` (`blessings.ts`, `ranked.ts`, `quests.ts`,
  `reputation.ts`, `pvpShop.ts`, `chestLoot.ts`, `raidLoot.ts`, `gachaRates.ts`).
- Một số quy ước: stat rune theo fraction của seed (`0.05` = 5%); Aegis chặn
  đúng một đòn/trận; 10 Sigil = 100% base stat; Ascension không cộng stat hay
  kích hoạt blessing; gear/deity mới phải trang bị vào preset mới có tác dụng
  (deity đầu tiên tự equip nếu slot trống).
- **Chưa thuộc phạm vi** (cố ý, xem §8 gameplay-flow): world boss guild
  (`boss_*`, `auto_raids`), vote reward top.gg (`topgg_vote_events`), echo
  deity slot, season-end payout, supporter/stripe/tickets, passive
  weapon/armor theo roster, portrait canvas.
- [docs/port-history.md](docs/port-history.md) — lịch sử port trước gameflow,
  giữ làm tham khảo kiến trúc, không phải hướng dẫn chạy hiện tại.
