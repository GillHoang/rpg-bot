export const MENU_TEXT = {
	description: 'Mở bảng điều khiển Credd',
	home: 'Trang chủ',
	back: 'Quay lại',
	refresh: 'Làm mới',
	close: 'Đóng',
	help: 'Hướng dẫn',
	search: 'Tìm hướng dẫn',
	open: 'Mở menu mới',
	chooseSection: 'Chọn khu vực',
	chooseTopic: 'Chọn chủ đề để đọc',
	welcome: 'Chọn khu vực bên dưới để bắt đầu chơi hoặc xem hướng dẫn.',
	helpIntro: 'Chọn chủ đề hoặc tìm theo từ khoá, ví dụ: rune, daily, triệu hồi.',
	searchLabel: 'Bạn muốn tìm hiểu điều gì?',
	searchPlaceholder: 'Ví dụ: rune, daily, triệu hồi',
	invalidSearch: 'Nhập từ khoá từ 1 đến 80 ký tự, rồi thử lại bằng nút Tìm hướng dẫn.',
	noResults: 'Không tìm thấy chủ đề phù hợp. Hãy thử từ khoá khác.',
	closed: 'Đã đóng menu. Bạn có thể mở lại bất cứ lúc nào.',
	expired: 'Menu đã hết hạn hoặc bot vừa khởi động lại. Mở menu mới để tiếp tục.',
	forbidden: 'Menu này thuộc về người khác. Mở menu riêng của bạn để tiếp tục.',
	stale: 'Màn hình đã thay đổi. Hãy dùng các nút mới nhất; nội dung vừa gửi chưa được áp dụng.',
	busy: 'Menu đang xử lý thao tác trước. Vui lòng chờ một chút rồi thử lại.',
	invalid: 'Thao tác không hợp lệ. Hãy dùng các nút trên menu hoặc mở menu mới.',
	failed: 'Không thể cập nhật menu. Mở menu mới để tiếp tục.',
	capacity: 'Đang có quá nhiều menu hoạt động. Vui lòng thử lại sau ít phút.',
	footer: 'Menu riêng tư • Hết hạn sau 10 phút không hoạt động.',
} as const;

/** Fallback descriptions; phase-2 destinations load their gameplay panels. */
export const MENU_SECTIONS = {
	character: {
		title: 'Nhân vật',
		body: '`/profile` xem nhân vật · `/preset switch` đổi bộ trang bị.\n`/cosmetic` và `/title` tuỳ chỉnh diện mạo · `/class` xem hoặc đổi class.',
	},
	daily: {
		title: 'Daily & nhiệm vụ',
		body: '`/daily` nhận quà hằng ngày.\n`/quest view` xem tiến độ · `/quest claim` nhận thưởng tuần · `/quest refresh` đổi nhiệm vụ ngày.',
	},
	inventory: {
		title: 'Kho đồ & trang bị',
		body: '`/inventory` xem kho · `/equip` trang bị · `/enhance` nâng cấp.\n`/socket` gắn rune · `/open` mở rương · `/runes` mua và mở túi rune.',
	},
	deity: {
		title: 'Deity & triệu hồi',
		body: '`/summon` triệu hồi · `/deities` xem deity đã sở hữu.\n`/deity sigil` mở Sigil · `/deity ascend` thăng hoa.',
	},
	battle: {
		title: 'Chiến đấu & PvP',
		body: '`/raid hunt` săn quái · `/raid boss` đánh boss.\n`/ranked` đấu xếp hạng · `/duel` thách đấu người chơi.',
	},
	casino: {
		title: 'Casino',
		body: '`/casino` chọn trò chơi và số tiền cược. Blackjack và Crash có nút thao tác trong từng ván.',
	},
	shop: {
		title: 'Cửa hàng',
		body: '`/pvp shop` xem cửa hàng Valor · `/pvp buy` mua vật phẩm.\n`/runes shop` xem giá hoặc mua túi rune.',
	},
} as const;

export type MenuSection = keyof typeof MENU_SECTIONS;

export const MENU_QUEST_LABELS = {
	raid_win: 'Thắng săn quái/boss',
	summon: 'Triệu hồi',
	enhance: 'Nâng trang bị',
	open_chest: 'Mở rương',
	casino: 'Chơi casino',
	daily: 'Nhận daily',
	duel_win: 'Thắng duel',
	ranked: 'Đấu ranked',
} as const;
