import { ICONS } from './index.js';

/** Display text for menu/gameplayPanels. */
export const GAMEPLAY_TEXT = {
	cancel: 'Huỷ',
	dailyClaimed: 'Đã nhận daily',
	dailyClaim: 'Nhận daily',
	hunt: 'Săn quái',
	quests: 'Nhiệm vụ',
	chooseClass: (combatClass: string | number): string => `Chọn ${combatClass}`,
	baseStats: (hp: string | number, atk: string | number, def: string | number, crit: string | number): string =>
		`Chỉ số cơ bản: HP ${hp} · ATK ${atk} · DEF ${def} · Crit ${crit}%\n`,
	starterRewards: (shards: string | number, silverChests: string | number): string =>
		`Quà khởi đầu: trang bị, ${shards} shards và ${silverChests} Silver Chest.\nXác nhận để tạo nhân vật; đổi class về sau cần vật phẩm.`,
	createCharacter: 'Tạo nhân vật',
	confirmBoss: 'Xác nhận đánh boss',
	confirmReroll: 'Xác nhận đổi quest',
	bossConfirmation: (minLevel: string | number, fee: string | number, day: string | number): string =>
		`Yêu cầu cấp ${minLevel}. Phí: **${fee} Credux**, trừ khi vào trận kể cả thua.\nMỗi ngày 1 lượt; reset 00:00 giờ Việt Nam.\nLượt ngày ${day}.`,
	rerollConfirmation: (day: string | number): string =>
		`Đổi miễn phí 1 lần/ngày. **Tiến độ của nhiệm vụ ngày chưa hoàn thành sẽ mất.** Nhiệm vụ đã hoàn thành được giữ.\nBộ nhiệm vụ ngày ${day}.`,
	confirm: 'Xác nhận',
	onboardingTitle: 'Bắt đầu hành trình',
	onboardingBody:
		'Chọn một class bên dưới để xem chỉ số và tạo nhân vật. Sau đó bạn có thể nhận daily và săn quái ngay trong menu này.',
	valorReward: (rewardValor: string | number): string => `${rewardValor} Valor`,
	shardReward: (rewardBeliefShards: string | number): string => `${rewardBeliefShards} shards`,
	questRow: (
		progress: string | number,
		label: string | number,
		credux: string | number,
		bonus: string | number,
	): string => `${progress} ${label} · ${credux} Credux + ${bonus}`,
	weeklyIncomplete: 'Hoàn thành 3 nhiệm vụ tuần để nhận thưởng tuần.',
	weeklyClaimed: 'Đã nhận thưởng tuần.',
	weeklyReady: 'Thưởng tuần sẵn sàng!',
	questsTitle: 'Daily & nhiệm vụ',
	questSections: (
		day: string | number,
		dailyRows: string | number,
		week: string | number,
		weeklyRows: string | number,
	): string => `**Ngày ${day}**\n${dailyRows}\n\n**Tuần ${week}**\n${weeklyRows}\n\n`,
	questHint:
		'\nThưởng từng quest tự nhận khi hoàn thành. Các tính năng kho đồ, triệu hồi và PvP sẽ được nối menu ở giai đoạn tiếp theo.',
	claimWeekly: 'Nhận thưởng tuần',
	rerollDaily: 'Đổi quest ngày',
	bossReady: 'Bạn có thể đánh boss.',
	bossDone: 'Đã đánh boss hôm nay.',
	bossLowLevel: 'Chưa đủ cấp đánh boss.',
	bossLowBalance: 'Chưa đủ Credux vào boss.',
	battleLobbyTitle: 'Săn quái & boss',
	huntInfo: (level: string | number, credux: string | number): string =>
		`Cấp ${level} · ${credux} Credux\nSăn quái miễn phí.\n`,
	bossInfo: (minLevel: string | number, fee: string | number): string =>
		`Boss: cấp ${minLevel}, phí ${fee} Credux, 1 lượt/ngày.\n`,
	resetTime: '\nReset 00:00 giờ Việt Nam.',
	boss: 'Đánh boss',
	lastBattle: 'Trận gần nhất',
	profileHeading: (
		username: string | number,
		emoji: string | number,
		combatClass: string | number,
		level: string | number,
	): string => `> Xin chào **${username}**!\n> ${emoji} **Class: ${combatClass} · Level ${level}**\n`,
	profileExp: (bar: string | number, exp: string | number, expToNext: string | number): string =>
		`> ${ICONS.reward.exp} Kinh nghiệm: ${bar} \`${exp}/${expToNext}\`\n`,
	profileCurrency: (credux: string | number, shards: string | number): string =>
		`> ${ICONS.economy.wallet} **${credux}** xu · ${ICONS.economy.shards} **${shards}** kim cương\n`,
	gearRow: (name: string | number, enhancement: string | number): string => `**${name}** · +${enhancement}`,
	unequipped: 'Chưa trang bị',
	deityRow: (name: string | number, sigils: string | number): string =>
		`${ICONS.deity.companion} **${name}** · ${sigils} Sigil`,
	noDeities: 'Chưa có thần đồng hành',
	profile: 'Nhân vật',
	equipmentSection: (weapon: string | number, armor: string | number): string =>
		`\n**Đang sử dụng**\n${ICONS.gear.weapon} Vũ khí: ${weapon}\n${ICONS.gear.armor} Giáp: ${armor}\n`,
	deitiesSection: (deities: string | number): string => `\n**Thần đồng hành**\n${deities}\n`,
	combatStats: (hp: string | number, atk: string | number, def: string | number): string =>
		`\nHP ${hp} · ATK ${atk} · DEF ${def}`,
	home: 'Trang chủ',
	help: 'Hướng dẫn',
	searchHelp: 'Tìm hướng dẫn',
	infoGroup: 'Thông tin',
	activityGroup: 'Hoạt động',
	inventory: 'Kho đồ',
	deitySummon: 'Deity & triệu hồi',
	shop: 'Cửa hàng',
	casino: 'Casino',
	assetsGroup: 'Tài sản',
	navigationGroup: 'Điều hướng',
	confirmationGroup: 'Xác nhận',
	helpLink: 'Gõ /help để xem hướng dẫn đầy đủ.',
	roundLog: (
		round: string | number,
		playerHp: string | number,
		playerMaxHp: string | number,
		enemyHp: string | number,
		enemyMaxHp: string | number,
		lines: string | number,
	): string => `Hiệp ${round}\nBạn: ${playerHp}/${playerMaxHp} HP · Địch: ${enemyHp}/${enemyMaxHp} HP\n${lines}`,
	battleTitle: 'Chiến đấu',
	noBattle: 'Chưa có trận đấu trong menu này.',
	logTitle: (page: string | number, total: string | number): string => `Nhật ký · ${page}/${total}`,
	noLog: 'Không có log.',
	first: 'Đầu',
	previous: 'Trang trước',
	next: 'Trang sau',
	last: 'Cuối',
	replay: 'Đánh lại (15s)',
	draw: 'Hoà',
	win: 'Chiến thắng',
	lose: 'Thất bại',
	resultTitle: 'Kết quả trận đấu',
	battleRewards: (
		rounds: string | number,
		hpRemaining: string | number,
		exp: string | number,
		credux: string | number,
		shards: string | number,
	): string => `${rounds} hiệp · HP còn ${hpRemaining}\n+${exp} EXP · +${credux} Credux · +${shards} shards\n`,
	levelUp: (previousLevel: string | number, newLevel: string | number): string =>
		`Lên cấp ${previousLevel} → ${newLevel}!\n`,
	bossFee: (fee: string | number): string => `Phí vào boss: −${fee} Credux.\n`,
};

/** Display text for menu/MenuGameplayService. */
export const GAMEPLAY_NOTICE = {
	createFirst: 'Hãy tạo nhân vật trước.',
	created: 'Đã tạo nhân vật và nhận quà khởi đầu! Chọn Nhận daily hoặc Săn quái để chơi.',
	alreadyCreated: 'Bạn đã có nhân vật.',
	starterUnavailable: 'Dữ liệu trang bị khởi đầu chưa sẵn sàng. Hãy thử lại sau.',
	cooldown: (seconds: string | number): string => `Chờ ${seconds} giây nữa để đánh lại.`,
	alreadyProcessed: 'Trận đấu đã được xử lý; không nhận thưởng lần hai.',
	noMonster: 'Chưa có quái phù hợp. Hãy thử lại sau.',
};
