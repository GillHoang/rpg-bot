export const WORLD_BOSS_TEXT = {
	description: 'Đánh World Boss chung của server, góp damage nhận thưởng theo rank',
	boardDescription: 'Bảng xếp hạng damage World Boss hiện tại',
	attackOption: 'Đánh boss (mặc định) hay xem trạng thái',
	noBoss: 'Chưa có World Boss. Dùng `/raid worldboss` để triệu hồi và đánh đòn đầu tiên.',
	spawned: (hp: string) => `World Boss xuất hiện với __${hp} HP__ chung! Cả server cùng góp damage.`,
	status: (hp: string, max: string, attackers: number) =>
		`World Boss: __${hp}/${max} HP__ còn lại · ${attackers} người đã góp damage.`,
	dead: 'World Boss đã gục! Dùng `/raid wboard` xem bảng xếp hạng và nhận thưởng kill.',
	capped: 'Hết lượt hôm nay. Quay lại sau reset ngày (auto-raid: +2 lượt).',
	contribution: (damage: string, total: string) => `Gây __${damage} damage__ (tổng __${total}__).`,
	killRank: (rank: number, credux: number, chest: string | null) =>
		`Hạ boss ở hạng #${rank}: +${credux} Credux${chest ? ` · +1 ${chest}` : ''}.`,
	boardTitle: 'Bảng damage World Boss',
	boardRow: (rank: number, name: string, damage: string) => `#${rank} ${name} — ${damage} damage`,
	warTitle: 'Guild War · Đua damage liên server',
	warRow: (rank: number, guildId: string, damage: string, attackers: number, eligible: boolean) =>
		`#${rank} ${guildId} — ${damage} damage · ${attackers} người${eligible ? '' : ' (chưa đủ 3 người)'}`,
	warEmpty: 'Chưa server nào góp damage World Boss.',
	warDescription: 'Bảng đua damage World Boss liên server (guild đủ 3 người mới xếp hạng)',
	warToggled: (active: boolean, endsAt: string) =>
		active ? `Auto-raid bật đến ${endsAt}.` : 'Auto-raid đã tắt.',
};
