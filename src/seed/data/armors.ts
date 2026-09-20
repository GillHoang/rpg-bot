/**
 * SEED DATA — armor_roster
 * ---------------------------------------------------------------------------
 * Sửa text ở file này rồi chạy `npm run db:seed`.
 *
 * Tier hợp lệ: Common | Rare | Mythic | Legendary | Supreme
 * type: 'Heavy' | 'Medium' | 'Light'
 *
 * ⚠ QUAN TRỌNG: armorRosterId = 1 phải là giáp khởi đầu
 * "Initiate's Garb" — CharacterCreationService tra cứu roster theo TÊN
 * (STARTER_ARMOR_NAME trong config/starter.ts).
 */

export interface ArmorSeed {
	armorRosterId: number;
	name: string;
	type: 'Heavy' | 'Medium' | 'Light';
	tier: 'Common' | 'Rare' | 'Mythic' | 'Legendary' | 'Supreme';
	mythology: string;
	passiveKey: string;
	passiveName: string;
	passiveDescription: string;
	lore: string | null;
	imageFilename: string | null;
	isAvailable: boolean;
}

export const ARMOR_SEED: ArmorSeed[] = [
	// ── Starter (bắt buộc, tra cứu theo tên) ─────────────────────────────────
	{
		armorRosterId: 1,
		name: "Initiate's Garb",
		type: 'Medium',
		tier: 'Common',
		mythology: 'Neutral',
		passiveKey: 'none',
		passiveName: 'No Passive',
		passiveDescription: 'A simple woven tunic that has saved more recruits than any doctrine.',
		lore: 'Standard-issue cloth, smelling faintly of the barracks.',
		imageFilename: null,
		isAvailable: false,
	},

	// ── Rare ─────────────────────────────────────────────────────────────────
	{
		armorRosterId: 101,
		name: 'Bakunawa Scale Mail',
		type: 'Heavy',
		tier: 'Rare',
		mythology: 'Filipino',
		passiveKey: 'serpent_hide',
		passiveName: 'Serpent Hide',
		passiveDescription: 'Reduces crit damage taken by 10%.',
		lore: 'Plates cut from a shed scale of the moon-eater. Still cold to the touch.',
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 102,
		name: 'Diwata Silk Vest',
		type: 'Light',
		tier: 'Rare',
		mythology: 'Filipino',
		passiveKey: 'forest_blessing',
		passiveName: 'Forest Blessing',
		passiveDescription: 'Regenerates 1% max HP per round while below half HP.',
		lore: 'Woven by diwata of the middle forest; it never stains and never rots.',
		imageFilename: null,
		isAvailable: true,
	},

	// ── Mythic ───────────────────────────────────────────────────────────────
	{
		armorRosterId: 201,
		name: 'Aegis of Mayari',
		type: 'Heavy',
		tier: 'Mythic',
		mythology: 'Filipino',
		passiveKey: 'moonward',
		passiveName: 'Moonward',
		passiveDescription: 'Once per battle, survives a killing blow with 1 HP.',
		lore: 'The silver half of the war-moon, hammered into a breastplate by the moon goddess herself.',
		imageFilename: null,
		isAvailable: true,
	},

	// ── Supreme ──────────────────────────────────────────────────────────────
	{
		armorRosterId: 401,
		name: 'Mantle of the First Dawn',
		type: 'Heavy',
		tier: 'Supreme',
		mythology: 'Filipino',
		passiveKey: 'first_dawn',
		passiveName: 'First Dawn',
		passiveDescription: 'Woven from the light that ended the first night.',
		lore: 'When Apolaki first rose, his rays left an imprint on the sky; this mantle is its echo.',
		imageFilename: null,
		isAvailable: true,
	},

	// ── M7 mở rộng: đa dạng loot ─────────────────────────────────────────────
	{
		armorRosterId: 103,
		name: 'Manananggal Wing Half-Cloak',
		type: 'Light',
		tier: 'Rare',
		mythology: 'Filipino',
		passiveKey: 'severed_flight',
		passiveName: 'Severed Flight',
		passiveDescription: 'Đôi cánh cắt lìa vẫn đập trong gió.',
		lore: 'Vải dệt từ mảnh cánh của kẻ săn đêm.',
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 104,
		name: 'Bamboo Warden Cuirass',
		type: 'Medium',
		tier: 'Rare',
		mythology: 'Filipino',
		passiveKey: 'grove_guard',
		passiveName: 'Grove Guard',
		passiveDescription: 'Tre già dày hơn thép',
		lore: 'Đan từ tre trăm tuổi của những kẻ canh rừng.',
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 202,
		name: 'Freki Wolf Harness',
		type: 'Medium',
		tier: 'Mythic',
		mythology: 'Norse',
		passiveKey: 'wolves_feast',
		passiveName: 'Wolves Feast',
		passiveDescription: 'Da sói của Freki, ngấu nghiến mọi đòn.',
		lore: 'Da của sói chiến thần, giờ khoác lên vai người.',
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 203,
		name: 'Scarab Laminar',
		type: 'Heavy',
		tier: 'Mythic',
		mythology: 'Egyptian',
		passiveKey: 'dawn_roll',
		passiveName: 'Dawn Roll',
		passiveDescription: 'Lá chắn bọ hung lăn mặt trời mỗi bình minh.',
		lore: 'Vảy bọ hung gắn theo đúng trật tự vũ trụ.',
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 302,
		name: 'Susanoo Storm Robe',
		type: 'Light',
		tier: 'Legendary',
		mythology: 'Japanese',
		passiveKey: 'tide_tempest',
		passiveName: 'Tide Tempest',
		passiveDescription: 'Áo bào cuôn theo bão biển.',
		lore: 'Của thần bão sau khi bị trục xuất khỏi thiên giới.',
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 402,
		name: 'Aegis of Athena',
		type: 'Heavy',
		tier: 'Supreme',
		mythology: 'Greek',
		passiveKey: 'gorgon_gaze',
		passiveName: 'Gorgon Gaze',
		passiveDescription: 'Đầu Gorgon trên ngực khiếp kẻ nhìn.',
		lore: 'Khi Athena di chuyển, cả chiến trường nghe tiếng rắn rít.',
		imageFilename: null,
		isAvailable: true,
	},
];
