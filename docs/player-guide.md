# Hướng dẫn chơi Credd Bot (dành cho người chơi)

Mọi con số dưới đây lấy đúng từ cấu hình game hiện tại. Nếu bản ingame
(`/help`) khác tài liệu này, **ingame luôn đúng** — và đó là bug cần báo.

## 1. Bắt đầu trong 1 phút

1. Gõ `/menu` (hoặc `/start`) → bấm **Đồng ý** → chọn 1 trong 5 class → **Xác nhận**.
2. Bạn nhận ngay: vũ khí + giáp khởi đầu (tự trang bị sẵn), **1.000 Belief
   Shards**, **10 Silver Chest**.
3. Vòng lặp mỗi ngày: `/daily` → `/raid hunt` → `/summon` → hết.

> Từ đây trở đi, mọi thứ đều làm được từ **`/menu`** bằng nút bấm. Các lệnh
> `/...` lẻ chỉ dành cho ai thích gõ tay.

## 2. Tiền tệ (xem nhanh bằng `/balance`)

| Tiền | Kiếm ở đâu | Tiêu vào đâu |
| --- | --- | --- |
| **Credux** | Raid, quest, daily, ranked tuần, casino, mở rương | Enhance, casino, phí boss 10.000, Ascension |
| **Belief Shards** | Daily, quest, raid | Triệu hồi deity (100/lượt) |
| **Essence** (4 tier) | Triệu hồi trùng deity (Epic 1 · Mythic 2 · Legendary 5 · Supreme 10) | Mở Sigil, mua túi rune |
| **Relic** (Sacred/Supreme) | Rương Diamond/Genesis, quest | Triệu hồi ép tier (1 relic/lượt) |
| **Valor Medals** | Quest weekly, ranked tuần | `/pvp shop` |
| **Rương** (Silver/Gold/Boss/Diamond/Genesis + túi rune) | Daily streak, quest, raid, ranked | `/open` để lấy Credux/shards/rune/gear/relic |

## 3. Class và chiến đấu

5 class, mỗi class một nội tại:

| Class | Lối chơi |
| --- | --- |
| **Swordsman** | Chảy máu cộng dồn (4%/đòn tới 20%), +5% ATK mỗi lượt (tối đa +30%) |
| **Fighter** | 15% Bash (35% nếu địch Dizzy): +50% dmg, Choáng, Dizzy lượt sau |
| **Mage** | Mỗi lượt thứ 3 nổ 4.0x (60%) hoặc 5.0x (40%), áp hiệu ứng ngẫu nhiên |
| **Knight** | Nhận vào −25%, đánh ra +30%, hồi 2,5% HP mỗi lượt |
| **Archer** | Bỏ qua 25% DEF, 35% đánh thêm đòn nữa |

**Chỉ số**: HP / ATK / DEF / CRIT cộng từ class + gear + deity; SPD quyết định
đánh trước, ACC đối EVA quyết định trúng/miss, TEN giúp kháng Choáng/Tê liệt.
Crit tối đa **60%** (trị số cao hơn cũng chỉ roll ở 60%), crit ×2 sát thương.

**Diễn biến trận**: tối đa 40 hiệp. Từ hiệp 31 (blood moon), sát thương hai
bên tăng 10%/hiệp và mỗi bên mất 2% HP tối đa/hiệp — trận trâu bò sẽ bị ép
kết thúc, không bao giờ hòa vô hạn. Hết 40 hiệp còn sống cả hai → so % HP.

**Các trần an toàn** (chống one-shot/lỗi): xuyên giáp tối đa 60%, giảm sát
thương từ giáp tối đa 75%, hồi máu tối đa 8% HP/round, độc Venom cộng dồn tối
đa 25% HP nạn nhân.

## 4. Săn quái và Boss (`/raid`, có trong menu)

- **Hunt**: mỗi 15 giây một lượt; 80% quái thường (500–1.000 Credux),
  20% elite (2.500–5.000 + loot riêng). Thua vẫn có chút EXP.
- **5 Gate × 10 tầng**: tầng sau mở khi qua tầng trước; Gate sau mở khi xong
  Gate trước hoặc đủ cấp (15/30/45/60). Tầng 10 mỗi Gate là **final boss** —
  mỗi Gate một boss riêng (kỹ năng khác nhau); boss tích nộ 3 hiệp rồi tung
  đòn nặng, hãy dè chừng hiệp telegraph.
- **Boss ngày Bakunawa**: cần cấp 10, phí vào cửa 10.000, **1 lượt/ngày**.
  Thưởng lớn (25.000–50.000 + chắc chắn có rương + 30% rơi gear hiếm). Dưới
  50% HP boss vào Eclipse: sát thương tăng mạnh. Thua vẫn mất phí và lượt.

## 5. Triệu hồi deity (`/summon`)

- Giá **100 Shards/lượt**, tối đa 30 lượt/lần bấm.
- Tỷ lệ: Epic 64,5% · Mythic 34% · Legendary 1% · Supreme 0,5%.
- **Pity 150**: 150 lượt liền không ra Legendary/Supreme thì lượt tiếp theo
  chắc chắn Legendary. Ra Legendary/Supreme tự nhiên thì đếm lại từ 0.
- Trùng deity đã có → đổi thành Essence (không mất lượt).
- **Relic**: Sacred ép ra Mythic+ (70/28/2), Supreme ép ra Legendary+
  (70/30). Không tốn Shards, không ảnh hưởng pity.
- Deity mới tự đeo vào slot pantheon còn trống.

**Pantheon**: đeo tới 3 deity (slot 1 hưởng 100%, slot 2 ×0.5, slot 3 ×0.25
chỉ số). 2 deity cùng mythology → +10% chỉ số deity, 3 cùng → +20%.
Mỗi deity mang một **blessing** vào trận (hồi máu, khiên, đánh trước…),
mạnh dần theo Sigil.

## 6. Gear: enhance, rune, preset (`/enhance`, `/socket`, `/equip`)

- **Enhance** (+1…+10, Divine tới +20): mỗi mốc ×stat (xem bảng trong game),
  +10 = ×2 chỉ số. **Trừ tiền cả khi thất bại.** Tỷ lệ từ 100% (+1) giảm
  dần tới 10% (+10). Gear khởi đầu (Common) không enhance được.
- Tổng chi phí kỳ vọng tới +10: Rare ~2,1tr · Mythic ~15,7tr ·
  Legendary ~33,3tr · Supreme ~62,5tr — đây là hố tiêu Credux cuối game.
- **Rune**: nhặt từ rương/túi, gắn vào socket gear. Rune chỉ số (+5–15% ATK/
  HP/DEF, crit, SPD…) cộng dồn rồi nhân một lần; rune combat (hút máu, độc,
  gai phản, khiên…) kích hoạt trong trận. Slot 1 mỗi lane miễn phí, mở thêm
  tốn phí theo seed.
- **Sigil/Ascension** (`/deity`): mỗi Sigil +5% chỉ số base của deity (bắt đầu
  50%, tối đa 10 Sigil = 100%), tốn Essence tăng dần (Epic tổng 100 ·
  Mythic 83 · Legendary 47 · Supreme 30). Đủ 10 Sigil thì **Ascension**
  (danh dự prestige, không cộng thêm stat).
- **Preset**: 2 bộ trang bị (weapon/armor/3 deity), đổi qua `/preset`.

## 7. Rương (`/open`)

Silver → Gold → Boss Treasure → Boss Golden → Diamond → Genesis: càng hiếm
càng nhiều Credux/shards, càng dễ rơi rune/gear/essence/relic. Mở được 1–10
rương/lần. Rương Diamond rơi Sacred Relic (25%), Genesis chắc chắn có
Supreme Relic.

## 8. Casino (`/casino`, cược tối đa 500.000/ván)

Casino trả thưởng **~100%** (không hút máu người chơi), thắng được hoàn cả
gốc. Lưu ý hai ngoại lệ có chủ đích:

| Game | Luật rút gọn |
| --- | --- |
| Tung xu / Xúc xắc | Chọn mặt, thắng ×2 |
| Slots | 1 lượt quay: wings 20x (0,4%) · trident 10x (1,6%) · skull 5x (4%) · lightning 2x (13%) · horus 1,5x (20%), còn lại trắng tay |
| Baccarat | Punto banco chuẩn; hòa hoàn tiền; cửa banker thắng trả **1,95x** (hoa hồng 5%), cửa player ×2 |
| Blackjack | Dealer dừng ở 17; natural trả **1:1** (không 3:2); hòa hoàn tiền |
| Crash | Mỗi push có % nổ tăng dần; sống thì khóa hệ số, cash out bất cứ lúc nào; timeout = cash out mức hiện tại |

Blackjack/Crash chơi bằng nút, hết hạn 60 giây tự kết toán, không mất tiền oan.

## 9. PvP

**Duel** (`/duel opponent:@user [stake]`): thách 1v1, đối thủ bấm Chấp nhận
trong 60 giây. Cược tối thiểu 1.000, trừ cả hai **lúc accept**, thắng ăn cả
pot, hòa hoàn tiền, hết hạn không ai mất gì.

**Ranked** (`/ranked fight`): đấu async với loadout của người chơi ngẫu nhiên
cùng tầm rating (Elo K=32). Bracket: Mortal (0) → Champion (1100) → Demigod
(1400) → Ascendant (1700) → Divine (2000). Rớt bracket lần đầu được **khiên
giữ hạng** (rớt về sàn bracket, khiên mất; thăng hạng được cấp lại).

**Thưởng tuần** (`/ranked claim`, reset thứ Hai): cần **tự mình đánh ít nhất
1 trận trong tuần** (bị kéo vào làm đối thủ không tính):

| Bracket | Credux | Valor | Rương |
| --- | --- | --- | --- |
| Mortal | 50.000 | 2 | — |
| Champion | 150.000 | 8 | 2 Silver |
| Demigod | 300.000 | 15 | 1 Gold |
| Ascendant | 500.000 | 25 | 1 Gold + 1 Diamond |
| Divine | 800.000 | 40 | 1 Genesis |

**`/pvp shop`**: tiêu Valor mua Change-Class Token, Diamond Chest,
cosmetic/title (giới hạn 1/season).

## 10. Quest, Believer, Cosmetic, Title

- **Quest** (`/quest`, có trong menu): mỗi ngày/tuần tự sinh 3 quest theo việc
  bạn chơi (thắng raid, summon, enhance, mở rương, casino, duel, ranked…).
  Thưởng Credux + shards/valor mỗi quest; xong cả 3 daily +1 Sacred Relic;
  xong cả 3 weekly thì `/quest claim` nhận Weekly Grand (1 Diamond Chest +
  100.000). Được đổi quest daily 1 lần/ngày. **Quên claim trước thứ Hai vẫn
  nhận được trong tuần sau** (ân hạn 1 tuần).
- **Believer EXP**: daily 50 · thắng raid 30 · thắng boss 80 · thắng duel 40 ·
  thắng ranked 50 · xong quest 25 · Weekly Grand 100. Trần **500 EXP/ngày**,
  lên cấp tốn 400 + 100×cấp. Cấp 10 nhận title Devout Believer.
- **Cosmetic/Title**: mua bằng valor hoặc kiếm qua thành tích (duel đầu,
  hạ Bakunawa, thăng bracket). Cosmetic khóa theo believer level (Chosen cần
  lv 5, Eternal cần lv 10).

## 11. Mùa (Season)

Mỗi mùa dài 30 ngày, tự sang mùa mới (rating giữ nguyên, quota shop reset
theo mùa). Hết mùa không mất gì ngoài việc phải mua lại các món giới hạn
mùa mới.

## 12. Mẹo chơi

1. Ngày nào cũng `/daily` — streak càng dài quà càng lớn (ngày 30: 1,5tr + 1.000 shards).
2. Đừng enhance gear Common khởi đầu (không enhance được); để dành tiền cho gear Rare+.
3. Deity trùng không phí — thành Essence mở Sigil, Sigil mới là sức mạnh thật.
4. Muốn leo ranked: đánh đủ 1 trận/tuần rồi claim đúng bracket hiện tại.
5. Casino là chỗ tiêu tiền giải trí, không phải chỗ cày tiền (EV ≈ 1, banker baccarat hơi dưới 1).

Chơi vui — số liệu ingame (`/help`) luôn là chuẩn cuối cùng.
