export const TOWER_TEXT = {
	title: 'Tháp Vô Hạn',
	description: 'Leo tháp tầng vô hạn; thắng tầng N để mở tầng N+1',
	floorOption: 'Tầng muốn đánh (mặc định: cao nhất có thể)',
	invalidFloor: 'Tầng không hợp lệ: chỉ được đánh tầng tiếp theo chưa qua.',
	locked: (best: number) => `Tiến độ tháp tuần này: tầng ${best}. Chỉ được đánh tầng ${best + 1}.`,
	best: (best: number) => `Kỷ lục tuần: tầng ${best}`,
	rules:
		'Mỗi lượt đánh 1 tầng; thắng tầng N mở tầng N+1. Kỷ lục reset mỗi tuần. Lần đầu qua tầng trong tuần thưởng gấp đôi Credux. Tháp không tính quest raid.',
	floorLabel: (floor: number, level: number, boss: boolean) =>
		`Tháp · Tầng ${floor}${boss ? ' · Boss' : ''} · Quái Lv.${level}`,
	firstClear: 'Phá kỷ lục tuần! Thưởng gấp đôi.',
	result: (floor: number, credux: number, exp: number) =>
		`Thắng tầng ${floor}: +${credux} Credux · +${exp} EXP.`,
	defeat: (floor: number) => `Thua tầng ${floor}: giữ nguyên kỷ lục, thử lại nhé.`,
};
