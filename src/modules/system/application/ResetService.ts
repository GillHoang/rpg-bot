import { LOG_EVENT_TEXT, RESET_ERROR_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { RESET_USER_AUDIT_DETAIL } from '../../../shared/ui/text/reset.js';

import type { PersistenceContext } from '../../../shared/kernel/persistence.js';
import { defaultPersistence } from '../../../db/defaultPersistence.js';
import { ResetRepository } from '../infrastructure/ResetRepository.js';

import { logger } from '../../../shared/utils/logger.js';

export type ResetResult = { status: 'ok'; deletedUsers: number } | { status: 'nothing-to-reset' };

export type ResetUserResult = { status: 'ok'; deletedRows: number } | { status: 'not-found' };

export interface ResetDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<
		ResetRepository,
		| 'lockUsers'
		| 'countUsers'
		| 'truncatePlayerData'
		| 'insertAudit'
		| 'insertUserAudit'
		| 'countUserData'
		| 'deleteUserData'
	>;
}

/**
 * "Reset full data": xoá TOÀN BỘ dữ liệu người chơi + log gameplay, giữ lại
 * catalog seed và cấu hình server. users là gốc của mọi FK dữ liệu người
 * chơi — một lệnh `TRUNCATE users CASCADE` dọn hết bảng con (bag, character,
 * gear, runes, quests, sessions, supporters...). Các bảng log/giao dịch còn
 * lại được dọn tường minh trong cùng một lệnh TRUNCATE.
 *
 * RESTART IDENTITY cho các ID tự tăng bắt đầu lại từ 1 — data sạch hoàn toàn
 * như lúc mới migrate. Thao tác này chỉ được gọi sau bước xác nhận reset.
 */

export class ResetService {
	private readonly persistence: PersistenceContext;
	private readonly queries: Pick<
		ResetRepository,
		| 'lockUsers'
		| 'countUsers'
		| 'truncatePlayerData'
		| 'insertAudit'
		| 'insertUserAudit'
		| 'countUserData'
		| 'deleteUserData'
	>;
	constructor(options: ResetDependencies = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.queries = options.queries ?? new ResetRepository();
	}

	/** Đếm người chơi sẽ bị xoá — CHỈ đếm, không đụng tới TRUNCATE. */
	async countAll(): Promise<number> {
		return this.queries.countUsers(this.persistence.executor);
	}

	async resetAll(devId: string): Promise<ResetResult> {
		if (!devId.trim()) throw new Error(RESET_ERROR_TEXT.missingAdministrator);
		const result = await this.persistence.unitOfWork.run(async (tx): Promise<ResetResult> => {
			await this.queries.lockUsers(tx);
			const deletedUsers = await this.queries.countUsers(tx);
			if (deletedUsers === 0) return { status: 'nothing-to-reset' };
			await this.queries.truncatePlayerData(tx);
			await this.queries.insertAudit(tx, devId, `reset ${deletedUsers} users`);
			return { status: 'ok', deletedUsers };
		});
		if (result.status === 'ok') logger.warn({ devId, deletedUsers: result.deletedUsers }, LOG_EVENT_TEXT.fullReset);
		return result;
	}

	/** Đếm tổng số row của một user — preview trước khi xoá, không đụng data. */
	async countUser(discordId: string): Promise<number> {
		assertDiscordId(discordId);
		return this.queries.countUserData(this.persistence.executor, discordId);
	}

	async resetUser(devId: string, discordId: string): Promise<ResetUserResult> {
		if (!devId.trim()) throw new Error(RESET_ERROR_TEXT.missingAdministrator);
		assertDiscordId(discordId);
		const result = await this.persistence.unitOfWork.run(async (tx): Promise<ResetUserResult> => {
			const deletedRows = await this.queries.deleteUserData(tx, discordId);
			if (deletedRows === 0) return { status: 'not-found' };
			await this.queries.insertUserAudit(tx, devId, discordId, RESET_USER_AUDIT_DETAIL(discordId, deletedRows));
			return { status: 'ok', deletedRows };
		});
		if (result.status === 'ok')
			logger.warn({ devId, discordId, deletedRows: result.deletedRows }, LOG_EVENT_TEXT.fullReset);
		return result;
	}
}

/** Discord snowflake luôn là chuỗi số — chặn raw-SQL injection từ input. */
function assertDiscordId(discordId: string): void {
	if (!/^\d+$/.test(discordId)) throw new Error(RESET_ERROR_TEXT.invalidTarget);
}
