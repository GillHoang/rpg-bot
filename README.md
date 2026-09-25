# credd-bot-ts

Discord RPG bot — rewrite TypeScript của `credd-bot` trên discord.js v14,
Drizzle ORM và PostgreSQL. Gameflow khép kín từ tạo nhân vật đến endgame.

**Định hướng giao diện: `/menu` là cách chơi chính.** Người chơi chỉ cần một
lệnh duy nhất — mọi vòng lặp gameplay (tạo nhân vật, daily, quest, săn
quái/boss, xem log trận) chạy bằng nút bấm/select trong menu. Các slash
command bên dưới là API nền: dùng trực tiếp khi cần, và dần được hút hết
vào menu (lộ trình ở mục [Định hướng menu thuần](#định-hướng-menu-thuần)).

- **Nhịp hằng ngày** — daily, `/raid hunt|boss`, casino 6 game, rương loot.
- **Meta tiến trình** — gacha deity, Sigil/Ascension, enhance gear, rune +
  socket, pantheon 3 slot + resonance, deity blessing trong combat.
- **PvP (M7)** — duel cược trực tiếp, ranked Elo async mirror match, PVP shop
  Valor Medals.
- **Tiến trình dài hạn (M7)** — quest daily/weekly, believer EXP, cosmetics +
  titles, relics, rune bag, Diamond/Genesis chest.

triển khai gameflow: [docs/gameplay-implementation.md](docs/gameplay-implementation.md) ·
triển khai M7: [docs/m7-implementation.md](docs/m7-implementation.md) ·
**người chơi đọc [hướng dẫn chơi chi tiết](docs/player-guide.md)**.

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
   `docker-entrypoint.sh` (đợi DB → migrate → seed → deploy commands, retry
   migrate ~60s nếu Postgres chưa sẵn sàng); đặt `SKIP_DEPLOY=1` khi không đổi
   slash command để boot nhanh và tránh rate-limit Discord. Chạy thủ công thì:
   - `pnpm db:seed` — seed ở `src/seed/data/` upsert theo khóa nghiệp vụ,
     không xoá dữ liệu người chơi; thiếu seed mới (M7) thì genesis chest và
     title grant sẽ lỗi.
   - `pnpm deploy:commands` — slash command mới/chỉnh option chỉ có hiệu lực
     sau khi deploy lại.

Không cần cron hay job ngoài: reset daily/weekly (quest, reputation cap,
thưởng tuần) theo **lazy reset** trên lịch Asia/Ho_Chi_Minh — so ngày tại điểm đọc;
scheduler trong bot chỉ quét dọn duel hết hạn và lock treo mỗi 30 giây.

## Chơi bằng /menu

`/menu` mở bảng điều khiển thường trực: màn hình render từ session, mọi thao
tác là nút/select có `revision` chống click cũ, receipt `menu_action_receipts`
chống xử lý lại. Chi tiết: [Menu giai đoạn 1](docs/menu-phase-1.md) ·
[Menu giai đoạn 2](docs/menu-phase-2.md). Khi nâng cấp lên giai đoạn 2, chạy
`pnpm db:migrate` trước khi khởi động bot để tạo bảng chống xử lý lại trận đấu.

**Phần tử menu đăng ký qua file**: mỗi nút nằm trong một file
`src/modules/menu/items/{category}/{name}.ts` (default-export một `MenuItemSpec`).
Tên file = action, thư mục = category (freestyle, lồng nhau được). Thêm nút =
thêm file rồi chạy `pnpm menu:registry` để sinh `items/registry.generated.ts`
(CI chặn nếu file generated lệch qua `pnpm menu:registry:check`).

| Màn hình | Nội dung |
| --- | --- |
| Home | Lối vào các nhóm: nhân vật, hằng ngày, chiến đấu, điều hướng (nhóm tài sản sẽ tích hợp sau) |
| Tạo nhân vật | Chọn class → xác nhận (starter gear auto-equip, +1.000 shards, +10 Silver Chest) |
| Profile | Thẻ nhân vật: stat trận đấu, EXP, title, believer level, pvp rating |
| Daily | Điểm danh streak 1–30 + milestone chest |
| Quests | Xem 3 daily + 3 weekly, reroll daily, claim Weekly Grand |
| Battle | Chọn gate/tier (portal), đánh boss có confirm, nối tầng thắng, đọc log từng hiệp |
| Help | Nút dẫn tới `/help` (menu không còn màn hình/tìm kiếm hướng dẫn) |

## Slash commands (lớp API nền)

Mỗi lệnh là lớp mỏng trên service dùng chung với menu (cùng transaction,
cùng rule) — dùng trực tiếp khi cần, không cần học hết để chơi. Cột **Menu**
cho biết lệnh đã có trong `/menu` hay đang chờ hút (xem lộ trình bên dưới).

Kinh tế và tiến trình cơ bản:

| Lệnh | Chức năng | Menu |
| --- | --- | --- |
| `/start` | Onboarding một chạm: đồng ý điều khoản → chọn class → xác nhận | ✅ (màn tạo nhân vật) |
| `/help` | Hướng dẫn chơi đầy đủ, phân trang theo chủ đề (bot đang beta — số liệu có thể thay đổi) | ✅ (màn help + tìm kiếm) |
| `/balance` | Credux, shards, rương, essence + gợi ý lệnh | ⏳ |
| `/daily` | Quà hằng ngày theo streak 1–30, milestone chest theo streak tổng | ✅ |
| `/profile` | Thẻ nhân vật canvas: stat trận đấu, EXP, title, believer level, pvp rating | ✅ |
| `/inventory category:bag\|weapons\|armors\|runes page:N` · `/deities page:N` | Liệt kê tài nguyên/ID để dùng cho các lệnh nhận ID | ⏳ |

Combat và loot:

| Lệnh | Chức năng | Menu |
| --- | --- | --- |
| `/raid hunt` | Săn mob thường, 20% gặp elite (loot riêng, Gold Chest) | ✅ (nút Hunt) |
| `/raid boss` | Bakunawa: cấp ≥ 10, phí 10.000 Credux, 1 lượt/ngày (00:00 Asia/Ho_Chi_Minh), phase Eclipse dưới 50% HP | ✅ (confirm + nút đánh) |
| `/open chest:silver\|gold\|boss_treasure\|boss_golden\|diamond\|genesis count:1–10` | Mở rương theo loot table; rương lớn rơi rune bag, gear Supreme | ⏳ |
| `/casino coin_toss\|dice_roll\|slot_machine\|baccarat\|blackjack\|crash bet:<số>` | 6 game; Blackjack/Crash có nút 60 giây, phiên lưu DB và tự kết toán khi bot chạy lại | ⏳ |

Gear, rune, deity:

| Lệnh | Chức năng | Menu |
| --- | --- | --- |
| `/equip kind:weapon\|armor\|deity\|deity2\|deity3 id:<ID> preset:1` | Trang bị vào preset (option `id` có autocomplete theo tên); `deity2`/`deity3` là pantheon phụ ×0.5/×0.25 | ⏳ |
| `/preset switch slot:1\|2` | Đổi preset đang dùng (đồng bộ cả pantheon) | ⏳ |
| `/enhance gear_id:<ID>` | +1…+10, Credux trừ cả khi thất bại | ⏳ |
| `/socket equip rune_uid:<ID> gear_id:<ID> slot_num:1 lane:native\|opposite` · `unequip` · `unlock` | Gắn/tháo rune; slot 1 mỗi lane miễn phí, mở thêm theo seed | ⏳ |
| `/summon count:1–30 [relic:sacred\|supreme]` | Gacha 100 shards/lượt với pity 150; relic ép tier (Mythic+/Legendary+) không tốn shards, không đụng pity | ⏳ |
| `/deity sigil user_deity_id:<ID>` · `ascend` | Sigil +5%/cấp (max 10 = 100% base); Ascend chỉ là prestige | ⏳ |
| `/runes shop [bag:lb\|gb\|db]` · `open bag:lb\|gb\|db` | Mua túi bằng essence + Credux, hoặc mở túi rune đang có trong bag | ⏳ |
| `/class change new_class:<X>` | Đổi class bằng Change-Class Token — giữ nguyên level/exp/gear/deity | ⏳ |

PvP (M7):

| Lệnh | Chức năng | Menu |
| --- | --- | --- |
| `/duel opponent:@user [stake:<số>]` | Thách đấu 1v1, nút chấp nhận/từ chối 60 giây; cược trừ cả hai khi accept, winner ăn pot, draw hoàn tiền | ⏳ |
| `/ranked fight` · `claim` · `stats` | Elo K=32 đấu async với loadout người chơi ngẫu nhiên (window 300 → mở rộng); 5 bracket, demotion shield; thưởng tuần theo bracket (cần ≥1 trận **chủ động**/tuần) | ⏳ |
| `/pvp shop` · `buy item:<key>` | Tiêu Valor Medals: Change-Class Token, Diamond Chest, cosmetics, title (cosmetic/title giới hạn 1/season) | ⏳ |

Meta dài hạn (M7):

| Lệnh | Chức năng | Menu |
| --- | --- | --- |
| `/quest view` · `refresh` · `claim` | 3 quest daily + 3 weekly sinh tự động, progress trong transaction của hành động; đủ 3 daily → +1 Sacred Relic; đủ 3 weekly → Weekly Grand (100k + Diamond Chest, có grace tuần trước); refresh 1 lần/ngày | ✅ |
| `/cosmetic list` · `equip id:<#>` | Cosmetics theo category (profile/battle/battle_result/summon), tier gate theo believer level | ⏳ |
| `/title list` · `equip id:<#>` | Title kiếm qua duel đầu tiên, hạ Bakunawa, thăng bracket ranked, hoặc mua bằng valor | ⏳ |

Admin (chỉ owner trong `OWNER_DISCORD_IDS` — ở lại slash, không vào menu):

| Lệnh | Chức năng |
| --- | --- |
| `/reset all` | Xoá TOÀN BỘ data người chơi + log (giữ seed/catalog), preview số user + nút xác nhận 60 giây |
| `/reset user target:@user` | Xoá sạch data đúng 1 user trong 1 transaction (preview số rows + nút xác nhận), ghi audit vào dev_logs |

Cơ chế gameplay và trạng thái triển khai: [gameplay-implementation.md](docs/gameplay-implementation.md).
Lịch sử thiết kế và port được lưu tại [port-history.md](docs/port-history.md).

## Định hướng menu thuần

Mục tiêu: người chơi mới **không cần học lệnh nào ngoài `/menu`**. Slash commands
còn lại phục vụ power-user/automation và dần được hút — service đã không
phụ thuộc UI (command chỉ là lớp mỏng gọi use-case), nên mỗi đợt hút chỉ
cần thêm panel + action + receipt, không sửa rule.

| Đợt | Phạm vi | Trạng thái |
| --- | --- | --- |
| 1 — vòng lặp daily | Start/class, profile, daily, quest view/refresh/claim, raid hunt/boss/fight, battle log | ✅ xong |
| 2 — xem tài nguyên | Inventory, deities, pvp shop, casino panels (xem trước khi chơi) | ⏳ tiếp theo |
| 3 — tiến trình | Summon, equip/preset, enhance, socket, deity sigil/ascend, open/runes | ⏳ |
| 4 — PvP | Duel challenge/accept, ranked fight/claim, cosmetic/title equip | ⏳ |
| Ở lại slash | `/reset`, `/ping`, `/test`, deploy/undeploy scripts | Không vào menu |

## Kiến trúc

Các thư mục dưới `src/` (6 folder + entrypoint):

```
app/        Composition root duy nhất: container (dựng toàn bộ graph),
            bot (wiring registry/events/client), DiscordBot, CommandRegistry,
            Scheduler, BotMaintenance
modules/    Mỗi tính năng 1 slice dọc: application/ (use-case + service),
            presentation/ (slash command), infrastructure/ (repository),
            domain/ (rule thuần), config/·seed/ (số liệu + dữ liệu mẫu)
shared/     kernel/ (Result, EventBus, UnitOfWork, Clock),
            discord/ (ICommand), ui/ (text wording + render canvas/pager),
            config/ (balance số liệu), utils/, progress/
db/         Kết nối, schema tách theo module (tables/), migrations
scripts/    Tooling vận hành (deploy/clear commands, rollover season)
seed/       Seed runner — upsert, không xoá dữ liệu chơi
```

Nguyên tắc nổi bật:

- **EventBus kiểm toán**: quest progress và believer EXP commit ngay trong
  transaction của hành động; subscriber trong `app/events.ts` chỉ ghi nhận
  khi sự kiện đến mà thiếu cờ `progressApplied` (bắt đường quên apply).
- **Decorator combat**: rune và deity blessing bọc quanh class strategy,
  chain được, engine và 5 class gốc không biết chúng tồn tại.
- **Phân chia combat**: [BattleEngine](src/modules/combat-shared/domain/BattleEngine.ts) giữ
  API và điều phối hiệp; [BattleAttack](src/modules/combat-shared/domain/BattleAttack.ts)
  xử lý đòn đánh, [CombatStatusEffects](src/modules/combat-shared/domain/CombatStatusEffects.ts)
  xử lý trạng thái, [combatRules](src/modules/combat-shared/domain/combatRules.ts) giữ giới hạn
  hiệp và hệ số sudden-death.
- **Khởi tạo nhân vật chiến đấu**: raid, duel và ranked dùng chung
  [CombatSetup](src/modules/combat-shared/application/CombatSetup.ts) (assemble →
  combatant → strategy), sao chép stat vào trạng
  thái riêng cho từng trận và bọc strategy theo thứ tự class → rune → blessing.
- **Trình bày tách khỏi điều phối**: `MenuGameplayService` đọc dữ liệu và gọi
  nghiệp vụ; [gameplayPanels](src/modules/menu/gameplayPanels.ts) dựng panel/log từ
  snapshot. [InventoryPager](src/shared/ui/render/InventoryPager.ts) dựng view và phân
  tích ID nút; `InventoryCommand` xử lý interaction và vòng đời collector.
- **Seeded RNG bắt buộc**: mọi lựa chọn weighted dùng `wrand` qua
  `src/shared/utils/weightedRandom.ts` với RNG mulberry32 từ
  `src/modules/combat-shared/domain/Rng.ts` (seed entropy cao từ crypto) —
  không `Math.random()`; cùng seed replay được.
  `wrand` 1.2.0 được import trực tiếp từ `wrand/lib/randomPicker.js` vì
  entry point published trỏ tới file thiếu.
- **Stat trận đấu** từ `StatAssemblyService`: class + gear + deity (pantheon
  1 full / 2 ×0.5 / 3 ×0.25, resonance cùng mythology) + rune stat-% cộng
  dồn rồi nhân một lần. Sudden-death: round 31–40 sát thương ×(1 + 10% mỗi
  round) + blood moon rút 2% max HP.
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
  kết quả, toàn bộ log và trạng thái hai bên của các trận có seed cố định với
  snapshot. [Test factory](tests/combatant-factory.test.ts)
  kiểm tra thứ tự decorator và trạng thái riêng từng trận;
  [test inventory](tests/inventory-pager.test.ts) dùng ID từ nút đã render để
  kiểm tra chuyển trang/loại đồ, ID sai, ownership và hết hạn collector.
- Phủ: rollback loot khi thiếu seed, quyền sở hữu item, preset/stat, boss fee
  + cooldown, summon pity/relic, casino settlement (kể cả phiên hết hạn),
  duel cược/wager log, ranked Elo/claim-1-lần, quest lazy generation, cap
  believer EXP, crit/venom/heal/immunity caps, blessing matrix, baccarat banker
  commission, slots RTP, blackjack
  natural 1:1, ranked shield/floor, concurrent summon/enhance, duel cược/wager log,
  collector nút duel/casino/menu giả lập, help-vs-config pins.
- Concurrency đa connection chạy trên PostgreSQL thật, gate bởi
  `TEST_DATABASE_URL` ([postgres-concurrency](tests/postgres-concurrency.test.ts)):
  daily đơn, casino race, ranked serialize/deadlock, season đơn, reset
  rollback, summon pity, enhance ledger.
- Coverage gate trong `vitest.config.ts` (`test:coverage`): statements 85,
  branches 80, functions 84, lines 87.
- Giới hạn: thao tác trên Discord thật (nút, deploy,
  latency) chưa được xác minh tự động.

## Balance và phạm vi

- Số liệu gameflow (rương §5, elite/boss, rune economy, socket):
  [gameplay-implementation.md](docs/gameplay-implementation.md).
- Số liệu M7 (blessing, pantheon/resonance, Elo/bracket, quest, believer EXP,
  relic, rune bag drop, Diamond/Genesis chest, PVP shop):
  [docs/m7-implementation.md](docs/m7-implementation.md) — toàn bộ là mặc định
  mới, chỉnh trong `src/shared/config/` (`blessings.ts`, `ranked.ts`, `quests.ts`,
  `reputation.ts`, `pvpShop.ts`, `chestLoot.ts`, `raidLoot.ts`, `gachaRates.ts`).
- Một số quy ước: stat rune theo fraction của seed (`0.05` = 5%); Aegis chặn
  đúng một đòn/trận; 10 Sigil = 100% base stat; Ascension không cộng stat hay
  kích hoạt blessing; gear/deity mới phải trang bị vào preset mới có tác dụng
  (deity đầu tiên tự equip nếu slot trống); crit cap 60%; pity 150 ép Legendary.
- **Chưa thuộc phạm vi** (cố ý, xem docs/gameplay-implementation.md + docs/m7-implementation.md
  §Giới hạn): world boss guild (`boss_*`, `auto_raids`), vote reward top.gg
  (`topgg_vote_events`), echo deity slot, season-end payout,
  supporter/stripe/tickets (`custom_avatar_token`, `custom_deity_token`),
  `supreme_chest`, essence exchange, per-level reward grants, passive
  weapon/armor theo roster, portrait canvas.
- [docs/port-history.md](docs/port-history.md) — lịch sử port trước gameflow,
  giữ làm tham khảo kiến trúc, không phải hướng dẫn chạy hiện tại.

## Kiến trúc OOP/SOLID

`src/app/container.ts` khởi tạo một bộ service dùng chung cho commands, menu, event và tác vụ nền. Các lớp nhận dependency qua constructor với contract chỉ gồm những method cần dùng. `PersistenceContext` (`shared/kernel/persistence.ts`) và `DrizzleUnitOfWork` giữ ranh giới giao dịch rõ ràng; truy vấn SQL nằm trong repository.

Combat dùng Strategy/Decorator và các policy attack/status có thể thay thế. Inventory, deity, monster selection và reward calculation được tách khỏi truy vấn DB. `BotMaintenance`/`Scheduler` quản lý start/stop và vòng đời timer. Hàm tính toán thuần và cấu hình vẫn giữ dạng hàm/dữ liệu.

Constructor mặc định và các export repository cũ được giữ để tương thích. Chi tiết kiến trúc, giới hạn và kết quả kiểm tra: [OOP/SOLID refactor](docs/oop-solid-plan.md).
