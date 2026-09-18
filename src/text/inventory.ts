import type { usersBag } from '../db/schema.js';
export function bagSummary(b: typeof usersBag.$inferSelect): string {
	return (
		`Credux: **${b.credux.toLocaleString()}** · Belief Shards: **${b.beliefShards.toLocaleString()}**\n` +
		`Rương: Silver ${b.silverChest} · Gold ${b.goldChest} · Boss Treasure ${b.bossTreasureChest} · Boss Golden ${b.bossGoldenChest}\n` +
		`Essence: Epic ${b.epicEssence} · Mythic ${b.mythicEssence} · Legendary ${b.legendaryEssence} · Supreme ${b.supremeEssence}\n` +
		'`/open` mở rương · `/runes shop` mua rune · `/inventory` tra ID · `/deities` xem deity'
	);
}
