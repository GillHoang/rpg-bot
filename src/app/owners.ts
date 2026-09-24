import { env } from '../shared/config/env.js';

/** Đúng một nguồn sự thật cho quyền /reset — dùng bởi command + test. */
export function isOwner(discordId: string): boolean {
	return env.OWNER_DISCORD_IDS.includes(discordId);
}
