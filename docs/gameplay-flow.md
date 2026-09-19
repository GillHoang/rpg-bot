# Thiết kế Flow Chơi — credd-bot-ts

> Cập nhật triển khai: các hạng mục §4–6 đã được nối vào code. Cú pháp thực tế,
> balance bổ sung và giới hạn kiểm thử xem [gameplay-implementation.md](gameplay-implementation.md)
> và [README](../README.md). Nội dung dưới đây giữ làm bản thiết kế ban đầu.

> Thiết kế hành trình người chơi (player journey) dựa trên **trạng thái thật của
> code hiện tại**: những gì đã port (M1–M6) và những dead-end cần vá để flow
> khép kín. Mục tiêu thiết kế: **mọi tài nguyên kiếm được phải có nơi tiêu,
> mọi lệnh phải truy cập được từ trong bot.**

---

## 1. Nguyên tắc thiết kế

1. **Vòng kín tài nguyên (closed economy)** — mỗi currency có cả nguồn (faucet)
   và điểm tiêu (sink). Hiện tại rương và rune là 2 tài nguyên "chỉ kiếm được,
   không tiêu được" → phải vá trước tiên.
2. **Không ID ngoài bot** — mọi lệnh nhận ID (`gear_id`, `rune_uid`,
   `user_deity_id`) phải đi kèm lệnh liệt kê để người chơi tự tra được.
3. **Tiến trình khoá dần (progressive unlock)** — hệ thống mới xuất hiện đúng
   lúc người chơi có đủ tài nguyên dùng nó, không dồn hết vào lúc tạo nhân vật.
4. **Mọi nhánh tiến trình hội tụ về sức mạnh trận đấu** — StatAssembly
   (`class + gear + deity + rune`) là điểm gặp nhau của 4 nhánh đầu tư.

---

## 2. Ba giai đoạn của hành trình người chơi

### Giai đoạn 0 — Nhập môn (5 phút đầu)

```
/register ──▶ /create class:<Swordsman|Fighter|Mage|Knight|Archer>
```

- `/register`: mở account + bag + pity counter (không cho gì có giá trị).
- `/create`: chọn 1/5 class → nhận **starter gear** (Initiate's Blade + Garb,
  auto-equip vào **Preset 1**) + **1.000 Belief Shards** + **10 Silver Chest**.
- `activePresetSlot` = 1 mặc định, stat trận đấu = class level 1 + starter gear.

**Cần thêm (nhỏ):** embed sau `/create` nên chỉ tiếp 3 lệnh: `/daily`,
`/raid`, `/summon` — hiện mới chỉ nói chữ, không có menu hướng dẫn.

### Giai đoạn 1 — Nhịp hằng ngày (Daily loop, 2–5 phút/ngày)

```
        ┌────────────── mỗi ngày ──────────────┐
        │                                      │
   /daily ────▶ Credux 50k–1.5M                 │
        │       Shards 100–1000                 │
        │       Rương (ngày vàng → Gold)        │
        │       Streak 15/30 → Boss Chest       │
        │                                      │
   /raid ─────▶ EXP (lên cấp ≤100, class stat ↑)│
        │       Credux 500–1000                 │
        │       Shards 5–10                     │
        │       20% → +1 Silver Chest           │
        │                                      │
   /casino ───▶ (tuỳ chọn) đánh bạc Credux     │
        │                                      │
   /balance · /profile ──▶ kiểm tra tiến độ ───┘
```

Nhịp này **đã chạy được hoàn chỉnh trong code hiện tại** — đây là phần xương
sống, không cần port thêm gì.

### Giai đoạn 2 — Meta tiến trình (Meta loop, tuần/tháng)

Bốn nhánh đầu tư song song, tất cả hội tụ về sức mạnh trận đấu:

```
                        TÀI NGUYÊN                          SỨC MẠNH
                ┌──────────────────────────┐
   Shards ─────▶│ NHÁNH 1: DEITY           │────▶ deity stat (base ×
   (/daily,     │ /summon 100 shards/pull  │      (0.5 + 0.05×sigil))
    /raid)      │  ├ mới → auto-equip      │
                │  └ trùng → ESSENCE ──┐   │
                └──────────────────────┼───┘
                                       │   essence
                                       ▼
                ┌──────────────────────────┐
   Essence ────▶│ NHÁNH 2: SIGIL/ASCEND    │────▶ deity stat ↑ (+5%/sigil)
   (từ summon)  │ /deity sigil (max 10)    │      (ascend: prestige flag)
                │ /deity ascend (cần 10)   │
                └──────────────────────────┘
                ┌──────────────────────────┐
   Credux ─────▶│ NHÁNH 3: GEAR            │────▶ weapon/armor stat ×2.0
   (/daily,     │ /enhance gear_id         │      ở +10 (Divine tới ×4.0)
    /raid)      │  (+1→+10, fail mất tiền) │
                └──────────────────────────┘
                ┌──────────────────────────┐
   Essence ────▶│ NHÁNH 4: RUNE            │────▶ stat-% cộng dồn vào
   + Credux     │ /runes shop (mua túi)    │      ATK/HP/DEF/CRIT + combat
                │  → rune ngẫu nhiên       │      hook (vampiric, thorns…)
                │ /socket equip vào gear   │
                └──────────────────────────┘
                ┌──────────────────────────┐
   Chests ─────▶│ NHÁNH 5: LOOT            │────▶ Credux / shards / runes
   (/daily,     │ /open <loại rương>       │      / gear (theo loot table)
    /raid,      │  silver · gold · boss    │
    streak)     └──────────────────────────┘
```

### Giai đoạn 3 — Nội dung khó (đích đến của tiến trình)

Sức mạnh tích luỹ mở khoá nội dung phần thưởng tốt hơn — vòng lặp quay lại:

```
   /raid thường ──▶ đủ mạnh ──▶ ELITE mob (20% spawn)  ──▶ elite loot + Gold Chest
        │                    └──▶ BOSS (/raid boss)     ──▶ Boss Chest + gear hiếm
        └── (M7+) ──▶ DUEL / RANKED PVP ──▶ rank + thưởng tuần
```

Mob hiện tại chỉ random trong 5 con `regular`; elite "Aswang Queen" và boss
"Bakunawa" đã seed nhưng **chưa bao giờ được chọn** — cần mở nhánh spawn.

---

## 3. Bảng dòng tài nguyên (kiếm → tiêu)

| Tài nguyên | Nguồn (faucet) | Điểm tiêu (sink) | Trạng thái |
|---|---|---|---|
| **Credux** | daily, raid win, casino win, (mới) `/open` | `/enhance`, `/casino` bet, `/deity ascend`, (mới) mở socket, mua rune bag | ✅ khép kín |
| **Belief Shards** | create +1000, daily, raid win | `/summon` (100/pull) | ✅ khép kín |
| **Essence (4 tier)** | summon trùng | `/deity sigil`, `/deity ascend`, (mới) rune bag | ✅ sau khi có `/runes shop` |
| **Silver/Gold/Boss Chest** | create +10, daily, raid 20%, streak | **CHƯA CÓ** → cần `/open` | ❌ dead-end |
| **Runes** | (mới) `/open`, rune bag | `/socket` | ❌ dead-end (hiện chỉ INSERT tay) |
| **Gear mới** | (mới) `/open`, boss drop | `/enhance`, `/socket` | ❌ dead-end (chỉ starter mãi mãi) |
| Relics, rune bag lb/gb/db, valor medals, diamond/genesis chest, change-class token | — | — | cột schema nằm im, M7 |

---

## 4. Dead-end hiện tại & thứ tự ưu tiên vá

Duyệt theo nguyên tắc "vá lỗ hổng nhỏ trước, mở hệ thống lớn sau":

| # | Việc cần làm | Đóng dead-end | Độ lớn | Ghi chú |
|---|---|---|---|---|
| 1 | **`/inventory`** — liệt kê gear/rune/rương/essence **kèm ID**; **`/deities`** — liệt kê deity kèm `user_deity_id`, sigil, stat hiện tại | Lệnh `/enhance`, `/socket`, `/deity` hiện yêu cầu ID không thể tra trong bot | Nhỏ | Thuần đọc DB + render text/embed |
| 2 | **`/open`** — mở rương theo loot table | Rương tích trữ vô nghĩa | Nhỏ | Loot table mới, thiết kế ở §5 |
| 3 | **`/runes shop`** — essence + Credux → túi rune (`ESSENCE_BAG_DEF_SEED` đã seed sẵn 3 túi legendary/grand/divine với pool rune cụ thể) → random rune vào `user_runes` | Rune không thể có trong tay → `/socket` vô dụng | Vừa | Service mới nhưng số liệu đã có sẵn |
| 4 | **Elite spawn trong `/raid`** (20%) + nhánh loot `RAID_LOOT_ELITE` | Elite mob + elite loot đã seed nhưng không bao giờ xuất hiện | Nhỏ | Mở `MonsterRepository` chọn thêm `elite` |
| 5 | **`/casino blackjack` + `/casino crash`** — session engine port 1:1 sẵn sàng, chỉ thiếu command + button collector + timer 60s | 2 game nhiều lượt bị khoá | Vừa | Pattern Discord.js thuần |
| 6 | **`/equip` + `/preset switch`** — trang bị gear vào preset, đổi `activePresetSlot` | Preset 2 rỗng vĩnh viễn; gear mới (từ `/open`) không có cách mang | Vừa | Cần validate slot/rương như SocketService |
| 7 | **`/raid boss`** — Bakunawa, điều kiện vào (level/credux phí), cooldown, drop Boss Chest | Boss đã seed không bao giờ gặp | Vừa–Lớn | Cần cơ chế riêng theo boss (M3 còn lại) |
| 8 | **Sửa nhỏ:** `/balance` hiện thêm shards + rương + essence; quyết định cờ `ascended` có cộng stat không (hiện chỉ sigils được tính) | Trải nghiệm tra cứu; Ascension "tiền mất không thấy stat" | Nhỏ | |

> Va chạm cần lưu ý khi làm mục gear-drop (2 & 6): `weapon_roster` /
> `armor_roster` **không lưu base stat** — stat nằm trên row
> `user_weapons`/`user_armors` của từng người. Muốn gear rơi từ rương/boss cần
> thêm 1 **bộ sinh stat theo tier** (stat generator) hoặc bổ sung stat gốc vào
> seed roster.

---

## 5. Đề xuất loot table cho `/open` (chưa có trong bản gốc — cần chốt số liệu)

| Rương | Credux | Shards | Rune | Gear | Khác |
|---|---|---|---|---|---|
| Silver | 10k–50k | 20–50 | 15% Rare (stat-% pool) | 5% Rare | — |
| Gold | 50k–200k | 50–150 | 40% (Mythic pool) | 15% Rare–Mythic | 5% Mythic essence |
| Boss Treasure | 100k–300k | 200–500 | 60% Mythic | 30% Mythic | Mythic essence |
| Boss Golden | 300k–600k | 500–1000 | Legendary đảm bảo | 50% Legendary | Legendary essence |

Nguyên tắc: rương càng hiếm càng nghiêng về **item tiến trình** (rune/gear)
thay vì currency, để không phá kinh tế Credux (casino đã là lỗ thoát tiền lớn).

---

## 6. Lưu ý: hệ thống random chuẩn hoá về [`wrand`](https://github.com/Balastrong/wrand)

Toàn bộ **lựa chọn ngẫu nhiên có trọng số** (weighted pick) của bot chuyển sang
thư viện `wrand` (`npm install wrand`): `pick(items)` / `new RandomPicker(items)`
với item dạng `{ original, weight }`, trả về đúng giá trị `original`.

**Tích hợp với seeded RNG hiện có (`src/domain/combat/Rng.ts`) — bắt buộc:**
wrand mặc định dùng `Math.random()`, **không được phép dùng mặc định đó**.
Class `RandomPicker` nhận `Options.next?: () => number` — truyền vào
`createRng(createSecureSeed())` hiện có:

```ts
import { pick } from 'wrand';
import { createRng, createSecureSeed } from '../domain/combat/Rng.js';

const rng = createRng(createSecureSeed());
const tier = pick(
	[
		{ original: 'epic', weight: 64.5 },
		{ original: 'mythic', weight: 34 },
		{ original: 'legendary', weight: 1 },
		{ original: 'supreme', weight: 0.5 },
	],
	{ next: rng },
);
```

Điều này giữ nguyên 2 tính chất đã có của bot: (1) casino/gacha dùng seed
entropy cao, người chơi không thể đoán/replay kết quả; (2) nếu sau này cần
battle replay deterministic, cứ truyền 1 seed cố định — cùng 1 `rng` nguồn thì
kết quả pick của wrand cũng deterministic theo seed. wRandom chỉ là **lớp chọn
có trọng số**, nguồn entropy vẫn 100% là `Rng.ts`.

**Các điểm áp dụng cụ thể trong flow:**

| Điểm | Hiện tại | Sau khi chuyển |
|---|---|---|
| Gacha tier roll (`rollTier` trong `config/gachaRates.ts`) | `rng()` + if/else cộng dồn 64.5/34/1/0.5 | `pick` 4 tier, multi-pull 30 vẫn roll tuần tự để pity đếm đúng |
| Casino slot ladder (`SlotMachineGame`, 5 mặt theo %) | `rng() * 100` + if/else | `pick` 5 mặt — dữ liệu xác suất đã nằm sẵn trong `casinoPayouts` |
| Rút bài deck (`CardDeck`) | tự shuffle/rút | `RandomPicker` với `removeOnPick: true` — mỗi lá pick xong bị loại khỏi deck, đúng bản chất "1 deck/ván không trùng lá" |
| Chọn mob raid (`MonsterRepository`) | lọc `mob_type='regular'` rồi random | `pick` regular:80 / elite:20 — chính là nhánh elite spawn ở mục #4 của bảng dead-end |
| Loot table `/open` (§5) và túi rune (`ESSENCE_BAG_DEF_SEED`) | chưa tồn tại | sinh ra là để dùng `pick` — thiết kế loot table theo `{ outcome, weight }` ngay từ đầu |

**Giới hạn — những gì KHÔNG đổi:** wrand chỉ thay weighted selection. Roll
khoảng số nguyên (`randInt` cho range reward), variance 0.9–1.1, roll crit,
coin 50/50 đơn thuần, và logic pity giữ nguyên trên rng hiện có — ép chúng vào
weighted pick chỉ làm phức tạp vô nghĩa.

**Ràng buộc validation của wrand** (lỗi runtime nếu vi phạm): mọi `weight`
phải > 0 và `original` không được trùng. Loot table có mặt muốn "tắt" (0%)
phải lọc bỏ trước khi đưa vào picker, không đưa weight 0 vào.

---

## 7. Sơ đồ flow tổng (trạng thái đích)

```
 register ─▶ create(class) ─▶ [Preset 1: starter gear]
                                 │
      ┌──────────────────────────┤ mỗi ngày
      │                          ▼
      │                       /daily ──▶ Credux · Shards · Chests
      │                          │
      │                          ▼
      │                       /raid ───▶ EXP → level up (stat class ↑)
      │                          │       Credux · Shards · Silver Chest
      │                          │
      │         ┌────────────────┼──────────────────┐
      │         ▼                ▼                  ▼
      │   /summon (shards)  /enhance (credux)   /open (chests)
      │     │ deity           │ gear ×2.0          │ rune · gear · tiền
      │     │  ├ trùng→essence│                    ▼
      │     │  └ mới→auto-equip                   /socket (rune → gear)
      │     ▼                                    │
      │   /deity sigil → ascend                  │
      │     │ deity stat ↑                       │
      │         │                                │
      │         └──────────┬─────────────────────┘
      │                    ▼
      │   /runes shop (essence → rune)  ·  /equip · /preset switch
      │                    │
      │                    ▼
      │         STATASSEMBLY (class + gear + deity + rune)
      │                    │
      │                    ▼
      │         /raid elite (20%) ─▶ /raid boss ─▶ loot tốt hơn
      │                    │                          │
      │  /casino (giải trí, sink Credux)              │
      │  /balance · /profile · /inventory · /deities  │
      │                                               │
      └──── ◀──── vòng lặp quay lại grind ────────────┘
                        (M7+: duel/ranked, quest, cosmetic)
```

---

## 8. Phạm vi thiết kế này KHÔNG bao phủ

> Cập nhật M7: duel/ranked PvP, quest/achievement, pantheon slot 2/3 + resonance,
> deity blessing, sudden-death sau round 30, cosmetic/title, scheduler sweep,
> reputation/believer EXP và các cột bag nằm im (relic, rune bag lb/gb/db, valor
> medals, diamond/genesis chest, change-class token) **đã được triển khai** —
> số liệu và lựa chọn thiết kế xem [m7-implementation.md](m7-implementation.md).
> Vote reward bị loại theo quyết định phạm vi (bảng `topgg_vote_events` nằm im).

Vẫn giữ ranh giới như README: world boss guild (`boss_*`, `auto_raids`), echo
deity slot, season-end payout, supporter/stripe/tickets, portrait canvas. Đây
là các hệ thống lớn độc lập còn lại, không phải lỗ hổng của flow.
