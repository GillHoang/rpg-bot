/**
 * KHO ICON DUY NHẤT của bot. Unicode mặc định ở UNICODE_ICONS; custom emoji
 * cho Discord được ghi đè ở ICONS. Canvas chỉ dùng UNICODE_ICONS vì không
 * thể vẽ markup custom emoji (`<:name:id>` / `<a:name:id>`).
 *
 * Quy tắc:
 *  - Key đặt theo NGHĨA (win/chest/locked…), không theo hình — đổi hình không đổi key.
 *  - Cùng một unicode có thể nằm ở nhiều key: mỗi chỗ dùng một key riêng để
 *    thay độc lập (VD `effect.frenzy` và `effect.lifesteal` đều là 🩸 hôm nay).
 *  - `→`, `·` là typography của câu chữ, không phải icon — không đưa vào đây.
 */
export const UNICODE_ICONS = {
	/** Đòn đánh — engine đọc bộ Discord qua COMBAT_STRIKE_EMOJIS. */
	strike: {
		bareHand: '👊',
		crit: '💥',
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
		exp: '✨',
		credux: '🪙',
		shards: '🔮',
		chest: '🎁',
		droppedChest: '📦',
		levelUp: '⬆️',
	},

	/** Số dư tài nguyên hiển thị ở profile/ví. */
	economy: {
		wallet: '🪙',
		shards: '🔮',
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
		weapon: '⚔️',
		armor: '🛡️',
		enhance: '🔨',
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
		wager: '🪙',
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
		companion: '✦',
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
		credux: '🪙',
		shards: '🔮',
		essence: '✨',
		relic: '📦',
		valor: '🏅',
		ping: '📡',
		book: '📖',
		beta: '🚧',
	},
	menu: {
		home: '🏠',
		back: '↩️',
		refresh: '🔄',
		close: '❌',
		profile: '👤',
		help: '📖',
		search: '🔎',
		daily: '🎁',
		hunt: '⚔️',
		boss: '🐉',
		quests: '📜',
		inventory: '🎒',
		deity: '✨',
		shop: '🛒',
		casino: '🎲',
	},
	battle: { health: '❤️' },
} as const;

/** Same semantic keys for both render targets; canvas cannot draw Discord markup. */
type IconPalette = {
	readonly [Group in keyof typeof UNICODE_ICONS]: {
		readonly [Key in keyof (typeof UNICODE_ICONS)[Group]]: string;
	};
};

/** Discord text and component emoji. Override individual Unicode defaults here. */
export const ICONS = {
	...UNICODE_ICONS,
	strike: { ...UNICODE_ICONS.strike, bareHand: '<:PHYS:1550859263990046913>', crit: '<:CRIT:1550864466420310017>' },
	reward: {
		...UNICODE_ICONS.reward,
		exp: '<:xp:1552213820599042088>',
		credux: '<:coin:1552212010958200922>',
		shards: '<:shard:1552211980704813127>',
	},
	economy: {
		...UNICODE_ICONS.economy,
		wallet: '<:coin:1552212010958200922>',
		shards: '<:shard:1552211980704813127>',
	},
	duel: { ...UNICODE_ICONS.duel, wager: '<:coin:1552210977611587715>' },
	menu: {
		...UNICODE_ICONS.menu,
		home: '<:home:1552201189108748449>',
		back: '<:back:1552205759381504011>',
		refresh: '<:refesh:1552203539630137416>',
		close: '<:close:1552206651971473501>',
	},
	battle: { health: '<:heart:1550849637902979142>' },
} as const satisfies IconPalette;

/** Discord-only progress bar assets; renderer owns clamping and cell selection. */
export const PROGRESS_BAR_EMOJIS = {
	full: {
		blue: {
			left: '<a:line1:1550837949271117824>',
			mid: '<a:line2:1550837973946212422>',
			right: '<a:line3:1550837998118117456>',
		},
		green: {
			left: '<a:linea1:1550838020071235704>',
			mid: '<a:linea2:1550838051574521977>',
			right: '<a:linea3:1550838078610997358>',
		},
	},
	partial: {
		yellow: {
			left: '<a:linee2:1550838146789408799>',
			mid: '<a:linee3:1550838170206339122>',
			right: '<a:linee1:1550838101839056996>',
		},
	},
	empty: {
		left: '<:line4:1550837845638389821>',
		mid: '<:line6:1550837891045785620>',
		right: '<:line7:1550837914701926430>',
	},
} as const;
