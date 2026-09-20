import { ICONS } from './icons.js';
/**
 * Text lệnh /help — toàn bộ nội dung hướng dẫn chơi. Số liệu trong body là
 * bản chụp balance lúc viết (gameplay-implementation.md); khi đổi config,
 * nhớ sửa lại text ở đây cho khớp.
 */

// --- Lệnh ---
export const HELP_DESCRIPTION = 'Hướng dẫn chi tiết cách chơi Credd Bot';
export const HELP_PAGER_TTL_MS = 180_000;
export const HELP_PREV_LABEL = 'Trước';
export const HELP_NEXT_LABEL = 'Sau';
export const HELP_PAGE_INDICATOR = (page: number, total: number): string => `Trang ${page}/${total}`;
export const HELP_TITLE = (title: string): string => `${ICONS.help.book} Hướng dẫn chơi — ${title}`;
export const HELP_FOOTER =
	'BETA — mọi con số, tỷ lệ và phần thưởng đều có thể thay đổi bất cứ lúc nào. Gõ /help để mở lại bảng này.';

/** Cảnh báo beta ghim đầu mỗi trang. */
export const HELP_BETA_NOTICE = `${ICONS.help.beta} **Bot đang ở giai đoạn BETA** — toàn bộ cơ chế, con số và tỷ lệ bên dưới hoàn toàn **có thể thay đổi** mà không cần báo trước.`;

export interface HelpPage {
	title: string;
	body: string;
}

export const HELP_PAGES: readonly HelpPage[] = [
	{
		title: 'Bắt đầu',
		body: [
			'Chào mừng đến **Credd** — RPG với gacha deity, train trang bị, rune và PvP. Hành trình bắt đầu từ đây:',
			'**Tạo nhân vật**\n`/start` → bấm **Đồng ý** → chọn 1 trong 5 class → **Xác nhận**. Bạn nhận ngay bộ gear khởi đầu (tự trang bị sẵn), **1.000 Belief Shards** và **10 Silver Chest**. Muốn xem trước nội tại từng class: `/class info class:<tên>`.',
			[
				'**5 class — mỗi class một nội tại riêng**',
				'⚔️ **Swordsman** — Chảy máu cộng dồn, +5% ATK mỗi lượt',
				'👊 **Fighter** — 30% cơ hội Bash: +50% sát thương và Choáng',
				'🔮 **Mage** — mỗi lượt thứ 3 nổ 4x–5x sát thương',
				'🛡️ **Knight** — giảm 25% sát thương nhận vào, hồi 2% HP mỗi lượt',
				'🏹 **Archer** — bỏ qua 25% DEF, 35% cơ hội đánh đôi',
			].join('\n'),
			'**Tài nguyên chính**\n🪙 **Credux** — tiền mặt · 🔮 **Belief Shards** — triệu hồi deity · ✨ **Essence** (4 tier) — Sigil & rune · 📦 **Sacred/Supreme Relic** — triệu hồi ép tier · 🏅 **Valor Medals** — cửa hàng PvP',
			'**Vòng đầu tiên của bạn:** `/daily` → `/raid hunt` → `/summon` → `/balance` · `/profile` để kiểm tra.',
		].join('\n\n'),
	},
	{
		title: 'Vòng lặp hằng ngày',
		body: [
			'Nhịp chơi cốt lõi — vài phút mỗi ngày là đủ tiến bộ:',
			'**📅 `/daily`** — điểm danh theo chu kỳ 30 ngày: Credux từ 50.000 lên 1.500.000, Shards từ 100 lên 1.000. Ngày vàng (7 · 14 · 21 · 28 · 29 · 30) tặng **Gold Chest**. Chuỗi điểm danh đạt mốc 15 ngày → **Boss Treasure Chest**; mốc 30/45/60… ngày → **Boss Golden Chest**. Reset 00:00 Manila.',
			'**⚔️ `/raid hunt`** — đánh quái ngẫu nhiên, 20% gặp **elite** (thưởng lớn gấp ~5 lần). Thắng: EXP + Credux 500–1.000 + Shards, 20–35% rơi rương. Thua vẫn nhận chút EXP — không mất gì cả. Tối đa cấp 100.',
			'**🌑 `/raid boss`** — **Bakunawa**: cần cấp 10, phí vào cửa 10.000 Credux, 1 lần/ngày. Thưởng khủng (25.000–50.000 Credux), chắc chắn có rương, 30% rơi gear hiếm. Khi dưới nửa HP boss bước vào Eclipse — sát thương tăng mạnh.',
			'**📜 `/quest view`** — 3 daily + 3 weekly tự tính tiến độ khi bạn chơi. Đủ 3 daily → +1 **Sacred Relic**. Đủ 3 weekly → `/quest claim` nhận **Weekly Grand**: 1 Diamond Chest + 100.000 Credux. `/quest refresh` reroll daily (1 lần/ngày).',
			'**Kiểm tra tiến độ:** `/balance` (ví + kho) · `/profile` (thẻ nhân vật).',
		].join('\n\n'),
	},
	{
		title: 'Deity & Gacha',
		body: [
			'Deity là nguồn chỉ số lớn nhất về cuối game:',
			'**🔮 `/summon count:1–30`** — **100 Shards/lượt**. Tỷ lệ: Epic 64,5% · Mythic 34% · Legendary 1% · Supreme 0,5%. Pity 500 lượt: Legendary bảo đảm. Trúng trùng tự đổi thành **Essence** theo tier (Epic 1 · Mythic 2 · Legendary 5 · Supreme 10).',
			'**Tùy chọn `relic`** — `sacred` đảm bảo Mythic+ (70% Mythic · 28% Legendary · 2% Supreme), `supreme` đảm bảo Legendary+ (70/30). Mỗi lượt tốn 1 relic, **không tốn Shards**, không ảnh hưởng pity.',
			'**✨ `/deities`** — danh sách deity đang sở hữu: ID (`user_deity_id`), Sigil, chỉ số.',
			'**`/deity sigil user_deity_id:<id>`** — mở Sigil bằng Essence: mỗi Sigil **+5% chỉ số base** của deity (bắt đầu ở 50%, tối đa 10 Sigil = 100%).',
			'**🌟 `/deity ascend user_deity_id:<id>`** — khi đủ 10 Sigil: nộp Essence + Credux để **Ascension** (prestige).',
			'**Trang bị deity:** `/equip kind:deity id:<id>`. Resonance mythology: 2 deity cùng mythology → +10%, 3 cùng → +20% chỉ số deity.',
		].join('\n\n'),
	},
	{
		title: 'Trang bị & Rune',
		body: [
			'Toàn bộ ID gear/rune tra ở `/inventory` — mọi lệnh khác đều nhận ID từ đó.',
			'**🎒 `/inventory [bag|weapons|armors|runes] [page]`** — ví + kho, 8 món/trang, có nút chuyển loại/trang.',
			'**⚔️ `/equip kind:<weapon|armor|deity> id:<id> [preset:1|2]`** — trang bị (gõ `id` sẽ có gợi ý tự động). `/preset switch slot:<1|2>` đảo nhanh giữa 2 bộ preset.',
			'**🔨 `/enhance gear_id:<id>`** — nâng cấp **+1 mỗi lần thử**. Tỷ lệ thành công giảm dần: +1 100% → +10 10%; thất bại mất tiền nhưng giữ nguyên cấp. Tối đa **+10** (gear Divine tới +20). Giá tăng theo tier: Rare rẻ nhất → Supreme/Divine đắt nhất.',
			'**🎁 `/open chest:<loại> [count:1–10]`** — mở rương: Silver · Gold · Boss Treasure · Boss Golden · Diamond · Genesis. Rương càng hiếm càng nhiều rune/gear/essence/relic, và có thể rơi thêm **túi rune** (lb/gb/db).',
			'**Rune:** `/runes shop [lb|gb|db]` — xem giá/mua túi rune (Essence + Credux) · `/runes open bag:<lb|gb|db>` — mở túi, nhận rune ngẫu nhiên.',
			'**Socket:** `/socket equip rune_uid:<uid> gear_id:<id> slot_num:<n> [lane:native|opposite]` — gắn rune vào gear · `/socket unequip rune_uid:<uid>` — tháo ra · `/socket unlock gear_id:<id>` — mở thêm slot native (Credux + Essence; slot đầu tiên miễn phí).',
		].join('\n\n'),
	},
	{
		title: 'PvP & Casino',
		body: [
			'Đấu người thật — hoặc thử vận may:',
			'**⚔️ `/duel opponent:@user [stake]`** — thách đấu 1v1 trực tiếp; đối thủ bấm **Chấp nhận** trong 60 giây. Có cược (tối thiểu 1.000 Credux): cả hai phải đủ tiền, người thắng ăn cả pot.',
			'**🏅 `/ranked`** — PvP bất đồng bộ: `fight` ghép bạn với loadout của một người chơi ngẫu nhiên cùng tầm rating (Elo). Bracket: Mortal → Champion (1100) → Demigod (1400) → Ascendant (1700) → Divine (2000). `stats` xem rating hiện tại · `claim` nhận thưởng tuần = **Valor Medals** + rương.',
			'**🛒 `/pvp`** — `shop` xem hàng mua bằng Valor Medals: Change-Class Token (120) · Diamond Chest (60) · khung/banner/vòng summon/title giới hạn (40–150, tối đa 1 mỗi season). `buy item:<tên>` để mua.',
			'**🎲 `/casino <game> bet:1–500.000`** — coin_toss · dice_roll · slot_machine · baccarat (chọn phe) chơi nhanh 1 ván; **blackjack** và **crash** chơi bằng nút bấm (hết hạn 60 giây) — crash thì cash out kịp trước khi nổ, không thì mất trắng.',
		].join('\n\n'),
	},
	{
		title: 'Cosmetic & khác',
		body: [
			'Cá nhân hoá và tiện ích:',
			'**🔄 `/class`** — `info class:<tên>` xem trước nội tại/chỉ số · `change new_class:<tên>` đổi class tốn **Change-Class Token** (mua ở `/pvp shop`).',
			'**🎨 `/cosmetic`** — `list` xem catalog · `equip id:<#>` trang bị khung ảnh, banner, vòng summon… Khoá theo **believer level**: tier Chosen cần lv 5, Eternal cần lv 10.',
			'**🏷️ `/title`** — `list` xem title · `equip id:<#>` đeo (`id 0` = tháo). Title kiếm từ ranked và shop PvP.',
			'**🙏 Believer level** — EXP tăng dần từ `/daily`, thắng raid/duel/ranked và làm quest (cap 500 EXP/ngày) — level càng cao mở càng nhiều cosmetic tier.',
			'**📡 `/ping`** — đo độ trễ WebSocket / REST / PostgreSQL.',
			'Gặp lỗi hoặc có ý tưởng? Báo cho dev — đang beta, đóng góp của bạn định hình phiên bản tiếp theo.',
		].join('\n\n'),
	},
];
