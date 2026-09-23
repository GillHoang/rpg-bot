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

triển khai gameflow: [docs/gameplay-implementation.md](docs/gameplay-implementation.md) ·
triển khai M7: [docs/m7-implementation.md](docs/m7-implementation.md).

Donation/supporter (tắt mặc định):
[Supporter / Donation System](docs/supporter-donation-plan.md) — ủng hộ nhà phát triển,
quyền cảm ơn cosmetic/social, không tạo lợi thế gameplay. Luồng VietQR + SePay chỉ
được mở khi cấu hình đầy đủ; phần cấp quyền Keygate vẫn cần contract test với
deployment thực tế trước khi bật production.

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
| `ERROR_WEBHOOK_URL` | Tuỳ chọn — URL webhook Discord nhận embed khi logger ghi `error`/`fatal` (bao gồm lỗi client/shard). Để trống để tắt. Embed có thông báo, stack trace, ngữ cảnh; giới hạn 4096 ký tự và che token/URL DB đã cấu hình. Giữ `LOG_LEVEL=info` hoặc `error` để nhận đủ lỗi; `fatal` lọc bỏ `error`. |
| `OWNER_DISCORD_IDS` | Discord ID của chủ bot (phân tách bằng dấu `,`) — bắt buộc để dùng `/reset` |
| `DEPLOY_GUILD_ID` | Tuỳ chọn — guild deploy mặc định cho `deploy:commands` trên server thử nghiệm |
| `SUPPORTER_DONATIONS_ENABLED` | Mặc định `false`; bản tích hợp `tabloy/keygate` hiện chặn cứng việc bật nhận tiền vì API tạo license chưa bảo đảm chống cấp trùng |
| `SUPPORTER_TIERS_JSON` | JSON array tier, mỗi tier có `id`, `name`, `minimumAmount`, `durationDays` và `keygatePlanSlug` |
| `SUPPORTER_DONATION_MIN_AMOUNT` / `SUPPORTER_DONATION_MAX_AMOUNT` | Khoảng số tiền VND nguyên được phép nhận |
| `SEPAY_WEBHOOK_API_KEY` / `SEPAY_ACCOUNT_NUMBER` / `SEPAY_BANK_NAME` | Bí mật và tài khoản nhận tiền dùng để xác thực/matching webhook |
| `SEPAY_WEBHOOK_HOST` / `SEPAY_WEBHOOK_PORT` / `SEPAY_WEBHOOK_PATH` | Địa chỉ HTTP callback; mặc định `0.0.0.0:8787/webhooks/sepay` |
| `KEYGATE_BASE_URL` / `KEYGATE_ADMIN_TOKEN` / `KEYGATE_PRODUCT_ID` | HTTPS origin, admin token và product ID của deployment `tabloy/keygate`; adapter đọc `/api/v1/admin/plans` và `/api/v1/admin/licenses` |
| `KEYGATE_CONTRACT_VERIFIED` | Mặc định `false`; đặt `true` hiện vẫn không mở nhận tiền cho đến khi API license có chống cấp trùng bền vững và quyền được xác minh |

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

   Dọn bộ slash command đã đăng ký (global + guild tuỳ chọn):

   ```sh
   pnpm undeploy:commands -- --global           # chỉ xoá global
   pnpm undeploy:commands -- --guild <guildId>  # chỉ xoá guild chỉ định
   pnpm undeploy:commands -- --all --guild <guildId> # xoá global + guild này
   ```

   Không truyền cờ: dùng guild trong `DEPLOY_GUILD_ID`, nếu không có thì dùng global.
   `--guild` thiếu ID hoặc cờ không hợp lệ sẽ dừng trước khi gọi Discord.
   `deploy:commands -- --global` luôn chọn global dù có `DEPLOY_GUILD_ID`.

   Sau khi clear, lệnh trong phạm vi đã chọn biến mất cho tới khi chạy lại `pnpm deploy:commands`
   (hoặc khởi động lại bot — entrypoint tự deploy).

3. **Khi cập nhật bot từ phiên bản cũ**, các bước chạy lại đã có trong
   `docker-entrypoint.sh` (migrate → seed → deploy commands); chạy thủ công thì:
   - `pnpm db:seed` — seed ở `src/seed/data/` upsert theo khóa nghiệp vụ,
     không xoá dữ liệu người chơi; thiếu seed mới (M7) thì genesis chest và
     title grant sẽ lỗi.
   - `pnpm deploy:commands` — slash command mới/chỉnh option chỉ có hiệu lực
     sau khi deploy lại.

Không cần cron hay job ngoài: reset daily/weekly (quest, reputation cap,
thưởng tuần) theo **lazy reset** trên lịch Asia/Manila — so ngày tại điểm đọc;
scheduler trong bot chỉ quét dọn duel hết hạn và lock treo mỗi 30 giây.

## Lệnh

`/menu` mở bảng riêng tư: tạo nhân vật, xem tổng quan, nhận daily, xem/đổi quest,
nhận thưởng tuần, săn quái, xác nhận đánh boss và đọc log từng hiệp bằng nút/select.
Hướng dẫn có modal tìm kiếm. Kho đồ, deity, PvP, casino và shop vẫn dùng lệnh bên dưới.
Chi tiết: [Menu giai đoạn 1](docs/menu-phase-1.md) · [Menu giai đoạn 2](docs/menu-phase-2.md).
Khi nâng cấp lên giai đoạn 2, chạy `npm run db:migrate` trước khi khởi động bot
để tạo bảng chống xử lý lại trận đấu `menu_action_receipts`.

Nhóm kinh tế và tiến trình cơ bản:

| Lệnh | Chức năng |
| --- | --- |
| `/start` | Onboarding một chạm: đồng ý điều khoản → chọn class → xác nhận; starter gear auto-equip, +1.000 shards, +10 Silver Chest |
| `/help` | Hướng dẫn chơi đầy đủ, phân trang theo chủ đề (bot đang beta — số liệu có thể thay đổi) |
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
| `/equip kind:weapon\|armor\|deity id:<ID> preset:1` | Trang bị vào preset (option `id` có autocomplete theo tên); service chấp nhận thêm `deity2`/`deity3` (pantheon phụ ×0.5/×0.25) nhưng slash command chỉ expose `deity` |
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
| `/quest view` · `refresh` · `claim` | 3 quest daily + 3 weekly sinh tự động, progress trong transaction của hành động; đủ 3 daily → +1 Sacred Relic; đủ 3 weekly → Weekly Grand (100k + Diamond Chest); refresh 1 lần/ngày |
| `/cosmetic list` · `equip id:<#>` | Cosmetics theo category (profile/battle/battle_result/summon), tier gate theo believer level |
| `/title list` · `equip id:<#>` | Title kiếm qua duel đầu tiên, hạ Bakunawa, thăng bracket ranked, hoặc mua bằng valor |

Cơ chế gameplay và trạng thái triển khai: [gameplay-implementation.md](docs/gameplay-implementation.md).
Lịch sử thiết kế và port được lưu tại [port-history.md](docs/port-history.md).

## Kiến trúc

Các thư mục dưới `src/`:

```
commands/    Discord layer — mỗi slash command 1 class ICommand tự chứa
services/    Điều phối nghiệp vụ và transaction, khóa bag/character
             trước khi đọc–ghi để bảo vệ read–modify–write
repositories/ Truy cập dữ liệu theo bảng; service cũng có query trong transaction
domain/      Engine thuần: combat (BattleEngine, Strategy theo class,
             Decorator rune + deity blessing), casino (Strategy 4 game
             một-lượt + session Blackjack/Crash)
menu/        Router/session cho /menu, điều phối gameplay và dựng panel
render/      Canvas, component và phân trang inventory/log chiến đấu
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
- **Phân chia combat**: [BattleEngine](src/domain/combat/BattleEngine.ts) giữ
  API và điều phối hiệp; [BattleAttack](src/domain/combat/BattleAttack.ts)
  xử lý đòn đánh, [CombatStatusEffects](src/domain/combat/CombatStatusEffects.ts)
  xử lý trạng thái, [combatRules](src/domain/combat/combatRules.ts) giữ giới hạn
  hiệp và hệ số sudden-death.
- **Khởi tạo nhân vật chiến đấu**: raid, duel và ranked dùng chung
  [combatantFactory](src/services/combatantFactory.ts), sao chép stat vào trạng
  thái riêng cho từng trận và bọc strategy theo thứ tự class → rune → blessing.
- **Trình bày tách khỏi điều phối**: `MenuGameplayService` đọc dữ liệu và gọi
  nghiệp vụ; [gameplayPanels](src/menu/gameplayPanels.ts) dựng panel/log từ
  snapshot. [InventoryPager](src/render/InventoryPager.ts) dựng view và phân
  tích ID nút; `InventoryCommand` xử lý interaction và vòng đời collector.
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
pnpm check    # lint + typecheck + test
pnpm build    # compile + kiểm tra import của dist
```

- Test nghiệp vụ DB chạy trên **PGlite** (PostgreSQL trong bộ nhớ, SQL thật)
  — không đọc `.env`, không chạm DB thật, RNG được mock để kiểm tra deterministic.
  [Helper DB](tests/helpers/database.ts) tạo DB riêng cho từng suite và áp mọi
  migration theo thứ tự trong journal đã commit.
- [Characterization combat](tests/combat-characterization.test.ts) so hash
  kết quả, toàn bộ log và trạng thái hai bên của 276 trận có seed cố định với
  snapshot trước refactor. [Test factory](tests/combatant-factory.test.ts)
  kiểm tra thứ tự decorator và trạng thái riêng từng trận;
  [test inventory](tests/inventory-pager.test.ts) dùng ID từ nút đã render để
  kiểm tra chuyển trang/loại đồ, ID sai, ownership và hết hạn collector.
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
- **Chưa thuộc phạm vi runtime hiện tại** (cố ý, xem docs/gameplay-implementation.md +
  docs/m7-implementation.md §Giới hạn): world boss guild (`boss_*`, `auto_raids`),
  vote reward top.gg (`topgg_vote_events`), echo deity slot, season-end payout,
  `supreme_chest`, essence exchange, per-level reward grants, passive weapon/armor
  theo roster, portrait canvas. Donation/supporter đang được triển khai từng phần
  theo [Supporter / Donation System](docs/supporter-donation-plan.md);
  các cột supporter legacy và `custom_avatar_token`, `custom_deity_token` chưa được
  nối vào luồng thanh toán.
- [docs/port-history.md](docs/port-history.md) — lịch sử port trước gameflow,
  giữ làm tham khảo kiến trúc, không phải hướng dẫn chạy hiện tại.

## Kiến trúc OOP/SOLID

`src/application/createApplicationServices.ts` khởi tạo một bộ service dùng chung cho commands, menu, event và tác vụ nền. Các lớp nhận dependency qua constructor với contract chỉ gồm những method cần dùng. `PersistenceContext` và `DrizzleUnitOfWork` giữ ranh giới giao dịch rõ ràng; truy vấn SQL nằm trong repository.

Combat dùng Strategy/Decorator và các policy attack/status có thể thay thế. Inventory, deity, monster selection và reward calculation được tách khỏi truy vấn DB. `BotMaintenance`/`Scheduler` quản lý start/stop và vòng đời timer. Hàm tính toán thuần và cấu hình vẫn giữ dạng hàm/dữ liệu.

Constructor mặc định và các export repository cũ được giữ để tương thích. Chi tiết kiến trúc, giới hạn và kết quả kiểm tra: [OOP/SOLID refactor](docs/oop-solid-plan.md).
