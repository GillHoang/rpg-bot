/**
 * KHO ICON DUY NHẤT của bot — mọi icon unicode hiển thị cho người dùng phải
 * lấy từ đây, không viết literal rải rác trong code. Sau này thay giá trị bằng
 * Discord custom emoji (`<:name:id>` / `<a:name:id>`) là toàn bộ UI đổi theo.
 *
 * Quy tắc:
 *  - Key đặt theo NGHĨA (win/chest/locked…), không theo hình — đổi hình không đổi key.
 *  - Cùng một unicode có thể nằm ở nhiều key: mỗi chỗ dùng một key riêng để
 *    thay độc lập (VD `effect.frenzy` và `effect.lifesteal` đều là 🩸 hôm nay).
 *  - `→`, `·` là typography của câu chữ, không phải icon — không đưa vào đây.
 */
export const ICONS = {
	/** Đòn đánh — Discord custom emoji, engine đọc qua COMBAT_STRIKE_EMOJIS. */
	strike: {
		bareHand: '<:PHYS:1550859263990046913>',
		crit: '<:CRIT:1550864466420310017>',
	},

	/** Icon đại diện class + hành động gắn với class. */
	combatClass: {
		swordsman: '⚔️',
		fighter: '👊',
		mage: '🔮',
		knight: '🛡️',
		archer: '🏹',
		change: '🔄',
	},

	/** Hiệu ứng trạng thái/trong combat (rune, monster, sudden death…). */
	effect: {
		suddenDeath: '💀',
		lifesteal: '🩸',
		venom: '☠️',
		thorns: '🌵',
		aegis: '🛡️',
		eclipse: '🌑',
		frenzy: '🩸',
		feast: '🩸',
	},

	/** Deity blessing. */
	blessing: {
		guardianLight: '✨',
		tailwind: '🌬️',
		tidalWrath: '🌊',
		moonDevourer: '🌑',
		lunarVeil: '🌙',
		solarFury: '☀️',
		mountainGrace: '⛰️',
		skySovereign: '🌩️',
	},

	/** Kết quả giao đấu. */
	outcome: {
		win: '🏆',
		lose: '💀',
		draw: '⚖️',
	},

	/** Thưởng và tài nguyên (dòng reward). */
	reward: {
		exp: '<:xp:1552213820599042088>',
		credux: '<:coin:1552212010958200922>',
		shards: '<:shard:1552211980704813127>',
		chest: '🎁',
		droppedChest: '📦',
		levelUp: '⬆️',
	},

	/** Số dư tài nguyên hiển thị ở profile/ví. */
	economy: {
		wallet: '<:coin:1552212010958200922>',
		shards: '<:shard:1552211980704813127>',
	},

	/** Điểm danh hằng ngày. */
	daily: {
		already: '⏳',
		header: '📅',
	},

	/** Nhiệm vụ. */
	quest: {
		dailyHeader: '📜',
		weeklyHeader: '🗓️',
		grand: '🎁',
	},

	/** Trang bị: nâng cấp, gắn rune, cosmetic/title. */
	gear: {
		list: '🎨',
		titles: '🏷️',
		locked: '🔒',
	},

	/** Trạng thái kết quả thao tác. */
	status: {
		success: '✅',
		fail: '❌',
		completed: '✅',
	},

	/** Duel. */
	duel: {
		challenge: '⚔️',
		casual: '🤝',
		wager: '<:coin:1552210977611587715>',
		countdown: '⏳',
		expired: '⌛',
	},

	/** Ranked. */
	ranked: {
		shield: '🛡️',
		weeklyReward: '🏅',
		profileBadge: '🏅',
	},

	/** Summon / deity. */
	summon: {
		header: '🔮',
		new: '✨',
	},
	deity: {
		sigil: '✨',
		ascension: '🌟',
		believer: '🙏',
	},

	/** Casino. */
	casino: {
		win: '🎉',
		push: '🤝',
		lose: '💸',
	},

	/** Shop. */
	shop: {
		pvp: '⚔️',
	},

	/** Nút điều hướng battle log pager (Components V2). */
	nav: {
		first: '⏮',
		prev: '◀',
		next: '▶',
		last: '⏭',
	},

	/** Lệnh /help. */
	help: {
		book: '📖',
		beta: '🚧',
	},
} as const;
