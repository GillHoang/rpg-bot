/**
 * SEED DATA — deity_roster
 * ---------------------------------------------------------------------------
 * Toàn bộ text (tên, mythology, blessing, lore) nằm ở file này để bạn sửa.
 * Sửa xong chạy `npm run db:seed` — seed chạy theo chế độ "upsert" nên sẽ
 * cập nhật row đã có theo khóa chính (deityId), KHÔNG tạo bản sao.
 *
 * Tier hợp lệ : Epic | Mythic | Legendary | Supreme
 * blessingScaling: 'scalable' (nhận % theo cấp) | 'binary' (kích hoạt/không)
 * isAvailable : false = ẩn khỏi gacha (vẫn giữ trong DB)
 */

export interface DeitySeed {
	deityId: number;
	name: string;
	mythology: string;
	tier: 'Epic' | 'Mythic' | 'Legendary' | 'Supreme';
	baseHp: number;
	baseAtk: number;
	baseDef: number;
	blessingKey: string;
	blessingName: string;
	blessingDescription: string;
	lore: string | null;
	imageFilename: string | null;
	isAvailable: boolean;
	blessingScaling: 'scalable' | 'binary';
}

export const DEITY_SEED: DeitySeed[] = [
	// ── Epic ─────────────────────────────────────────────────────────────────
	{
		deityId: 1,
		name: 'Bathala',
		mythology: 'Filipino',
		tier: 'Epic',
		baseHp: 900,
		baseAtk: 180,
		baseDef: 160,
		blessingKey: 'guardian_light',
		blessingName: 'Guardian Light',
		blessingDescription: 'Restores a small portion of HP at the end of each round.',
		lore: 'The supreme deity of the Filipino pantheon, keeper of the sky and protector of mortals.',
		imageFilename: null,
		isAvailable: true,
		blessingScaling: 'scalable',
	},
	{
		deityId: 2,
		name: 'Amihan',
		mythology: 'Filipino',
		tier: 'Epic',
		baseHp: 780,
		baseAtk: 210,
		baseDef: 140,
		blessingKey: 'tailwind',
		blessingName: 'Tailwind',
		blessingDescription: 'Increases the chance to act first each round.',
		lore: 'The bird-shaped deity of the northeast winds, bearer of calm and swiftness.',
		imageFilename: null,
		isAvailable: true,
		blessingScaling: 'scalable',
	},
	{
		deityId: 3,
		name: 'Amanikable',
		mythology: 'Filipino',
		tier: 'Epic',
		baseHp: 850,
		baseAtk: 195,
		baseDef: 155,
		blessingKey: 'tidal_wrath',
		blessingName: 'Tidal Wrath',
		blessingDescription: 'Sea-born rage: outgoing damage rises as HP falls.',
		lore: 'The ill-tempered patron of fishermen, whose storms swallowed careless boats whole.',
		imageFilename: null,
		isAvailable: true,
		blessingScaling: 'scalable',
	},

	// ── Mythic ───────────────────────────────────────────────────────────────
	{
		deityId: 101,
		name: 'Bakunawa',
		mythology: 'Filipino',
		tier: 'Mythic',
		baseHp: 1150,
		baseAtk: 260,
		baseDef: 200,
		blessingKey: 'moon_devourer',
		blessingName: 'Moon Devourer',
		blessingDescription: 'Every few rounds, swallows the moon: a heavy bonus strike.',
		lore: 'The serpent-dragon that rises from the sea to swallow the moon, plunging the world into eclipse.',
		imageFilename: null,
		isAvailable: true,
		blessingScaling: 'scalable',
	},
	{
		deityId: 102,
		name: 'Mayari',
		mythology: 'Filipino',
		tier: 'Mythic',
		baseHp: 1000,
		baseAtk: 245,
		baseDef: 195,
		blessingKey: 'lunar_veil',
		blessingName: 'Lunar Veil',
		blessingDescription: 'Moonlight cloak reduces incoming damage for one round after being struck.',
		lore: 'The one-eyed goddess of the moon, who fought the war-god to a standstill for the right to rule the night.',
		imageFilename: null,
		isAvailable: true,
		blessingScaling: 'scalable',
	},
	{
		deityId: 103,
		name: 'Apolaki',
		mythology: 'Filipino',
		tier: 'Mythic',
		baseHp: 1050,
		baseAtk: 275,
		baseDef: 180,
		blessingKey: 'solar_fury',
		blessingName: 'Solar Fury',
		blessingDescription: 'Blinding sunlight adds bonus damage on every attack.',
		lore: 'The god of the sun and patron of warriors, whose blazing eye never blinks in battle.',
		imageFilename: null,
		isAvailable: true,
		blessingScaling: 'scalable',
	},

	// ── Legendary ────────────────────────────────────────────────────────────
	{
		deityId: 201,
		name: 'Maria Makiling',
		mythology: 'Filipino',
		tier: 'Legendary',
		baseHp: 1400,
		baseAtk: 320,
		baseDef: 260,
		blessingKey: 'mountain_grace',
		blessingName: 'Mountain Grace',
		blessingDescription: 'The mountain spirit shields her champion: large damage reduction below half HP.',
		lore: 'The diwata of Mount Makiling, beautiful and merciful to the pure, merciless to those who betray her.',
		imageFilename: null,
		isAvailable: true,
		blessingScaling: 'scalable',
	},

	// ── Supreme ──────────────────────────────────────────────────────────────
	{
		deityId: 301,
		name: 'Kaptan',
		mythology: 'Filipino',
		tier: 'Supreme',
		baseHp: 1800,
		baseAtk: 400,
		baseDef: 330,
		blessingKey: 'sky_sovereign',
		blessingName: 'Sky Sovereign',
		blessingDescription: 'Once per battle, an act of divine providence nullifies all damage taken that round.',
		lore: 'The primordial lord of the sky, who planted the bamboo from which the first humans sprang.',
		imageFilename: null,
		isAvailable: true,
		blessingScaling: 'binary',
	},

	// ── M7 mở rộng: thần thoại mới (resonance đa nền) ────────────────────────
	{ deityId: 4, name: 'Freyja', mythology: 'Norse', tier: 'Epic', baseHp: 860, baseAtk: 195, baseDef: 145,
		blessingKey: 'guardian_light', blessingName: 'Seidr Mending',
		blessingDescription: 'Phép Seidr vá áo giáp, hồi một phần HP cuối mỗi hiệp.',
		lore: 'Nàng thủ lĩnh Vanir của tình yêu và chiến tranh, người dạy pháp thuật cho các vị thần.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 5, name: 'Artemis', mythology: 'Greek', tier: 'Epic', baseHp: 780, baseAtk: 210, baseDef: 140,
		blessingKey: 'tailwind', blessingName: 'Hunter Wind',
		blessingDescription: 'Gió rừng theo bước thợ săn, tăng cơ hội ra đòn trước.',
		lore: 'Nàng thợ săn trăng bạc, không bao giờ bắn trước khi chắc chắn trúng.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 6, name: 'Bastet', mythology: 'Egyptian', tier: 'Epic', baseHp: 820, baseAtk: 205, baseDef: 150,
		blessingKey: 'tidal_wrath', blessingName: "Cat's Wrath",
		blessingDescription: 'Nữ thần mèo gầm lên, sát thương dâng cao khi máu cạn.',
		lore: 'Nữ thần sư tử bảo vệ gia đình, dịu dàng với người thân, hung tợn với kẻ thù.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 7, name: 'Tsukuyomi', mythology: 'Japanese', tier: 'Epic', baseHp: 900, baseAtk: 180, baseDef: 160,
		blessingKey: 'lunar_veil', blessingName: 'Moon Silence',
		blessingDescription: 'Ánh trăng lạnh bao lấy thân, dập bớt đòn đánh sau khi trúng chiêu.',
		lore: 'Thần trăng đêm, hiện thân của trật tự và im lặng tuyệt đối.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 104, name: 'Loki', mythology: 'Norse', tier: 'Mythic', baseHp: 1000, baseAtk: 270, baseDef: 180,
		blessingKey: 'tidal_wrath', blessingName: 'Trickster Surge',
		blessingDescription: 'Lừa dối và cuồng nộ: càng yếu, đòn đánh càng điên loạn.',
		lore: 'Kẻ ngụy tạo của Asgard, miệng lưỡi sắc hơn bất kỳ lưỡi kiếm nào.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 105, name: 'Hermes', mythology: 'Greek', tier: 'Mythic', baseHp: 1000, baseAtk: 260, baseDef: 195,
		blessingKey: 'tailwind', blessingName: 'Winged Sandals',
		blessingDescription: 'Sandal có cánh của sứ thần, luôn đến trước mọi đòn đánh.',
		lore: 'Sứ thần nhanh nhất Olympus, người đưa tin giữa hai thế giới.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 106, name: 'Anubis', mythology: 'Egyptian', tier: 'Mythic', baseHp: 1150, baseAtk: 245, baseDef: 200,
		blessingKey: 'lunar_veil', blessingName: 'Embalmer Shroud',
		blessingDescription: 'Khăn liệm của người ướp xác che chắn, dập bớt đòn kế tiếp.',
		lore: 'Thần xác chết đầu chó, canh ngọ môn giữa hai thế giới.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 107, name: 'Susanoo', mythology: 'Japanese', tier: 'Mythic', baseHp: 1050, baseAtk: 275, baseDef: 180,
		blessingKey: 'moon_devourer', blessingName: 'Storm Slash',
		blessingDescription: 'Thỉnh thoảng gọi cơn bão, chém một đòn nặng gấp đôi.',
		lore: 'Thần bão biển bị trục xuất, từng chém con rắn tám đầu Yamata.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 202, name: 'Thor', mythology: 'Norse', tier: 'Legendary', baseHp: 1400, baseAtk: 340, baseDef: 255,
		blessingKey: 'solar_fury', blessingName: 'Lightning Wrath',
		blessingDescription: 'Sét Mjolnir nạp vào từng đòn đánh của ngươi.',
		lore: 'Vệ thần của nhân loại, tiếng búa của ngươi là tiếng sấm.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 203, name: 'Athena', mythology: 'Greek', tier: 'Legendary', baseHp: 1500, baseAtk: 320, baseDef: 270,
		blessingKey: 'mountain_grace', blessingName: 'Aegis Guard',
		blessingDescription: 'Hòn khiên Aegis che chắn khi ngươi yếu thế.',
		lore: 'Nữ thần trí tuệ và chiến tranh chính nghĩa, sinh ra từ đầu Zeus.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 204, name: 'Ra', mythology: 'Egyptian', tier: 'Legendary', baseHp: 1400, baseAtk: 335, baseDef: 260,
		blessingKey: 'solar_fury', blessingName: 'Sun Barque Fire',
		blessingDescription: 'Lửa từ thuyền mặt trời thiêu đốt từng nhát chém.',
		lore: 'Vua của các vị thần, mỗi đêm ngươi phải chiến đấu qua bóng tối để bình minh lên.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
	{ deityId: 302, name: 'Odin', mythology: 'Norse', tier: 'Supreme', baseHp: 1800, baseAtk: 400, baseDef: 330,
		blessingKey: 'sky_sovereign', blessingName: 'Allfather Providence',
		blessingDescription: 'Đôi mắt hy đổi lấy trí tuệ: một lần mỗi trận, thiên lệnh hoá giải trọn đòn.',
		lore: 'Chúa tể của tất cả, treo mình trên cây thế giới chín đêm để đọc được vận mệnh.', imageFilename: null, isAvailable: true, blessingScaling: 'binary' },
	{ deityId: 303, name: 'Amaterasu', mythology: 'Japanese', tier: 'Supreme', baseHp: 1750, baseAtk: 410, baseDef: 325,
		blessingKey: 'solar_fury', blessingName: 'Eternal Dawn',
		blessingDescription: 'Bình minh vĩnh cửu thiêu trong từng đòn đánh.',
		lore: 'Nữ thần mặt trời, khi nàng trốn trong hang, cả thế giới chìm trong đêm.', imageFilename: null, isAvailable: true, blessingScaling: 'scalable' },
];
