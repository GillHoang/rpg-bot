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
];
