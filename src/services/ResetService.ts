import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { ResetRepository } from '../repositories/ResetRepository.js';

import { logger } from '../utils/logger.js';

export type ResetResult = { status: 'ok'; deletedUsers: number } | { status: 'nothing-to-reset' };

export interface ResetDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<ResetRepository, 'lockUsers' | 'countUsers' | 'truncatePlayerData' | 'insertAudit'>;
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
	private readonly queries: Pick<ResetRepository, 'lockUsers' | 'countUsers' | 'truncatePlayerData' | 'insertAudit'>;
	constructor(options: ResetDependencies = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.queries = options.queries ?? new ResetRepository();
	}

	/** Đếm người chơi sẽ bị xoá — CHỈ đếm, không đụng tới TRUNCATE. */
	async countAll(): Promise<number> {
		return this.queries.countUsers(this.persistence.executor);
	}

	async resetAll(devId: string): Promise<ResetResult> {
		if (!devId.trim()) throw new Error('Reset requires an administrator ID');
		const result = await this.persistence.unitOfWork.run(async (tx): Promise<ResetResult> => {
			await this.queries.lockUsers(tx);
			const deletedUsers = await this.queries.countUsers(tx);
			if (deletedUsers === 0) return { status: 'nothing-to-reset' };
			await this.queries.truncatePlayerData(tx);
			await this.queries.insertAudit(tx, devId, `reset ${deletedUsers} users`);
			return { status: 'ok', deletedUsers };
		});
		if (result.status === 'ok') logger.warn({ devId, deletedUsers: result.deletedUsers }, 'full-reset');
		return result;
	}
}
