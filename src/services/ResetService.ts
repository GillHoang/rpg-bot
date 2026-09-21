import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { ResetRepository } from '../repositories/ResetRepository.js';

import { logger } from '../utils/logger.js';

export type ResetResult = { status: 'ok'; deletedUsers: number } | { status: 'nothing-to-reset' };

export interface ResetDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<ResetRepository, 'countUsers' | 'truncatePlayerData' | 'insertAudit'>;
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
	private readonly queries: Pick<ResetRepository, 'countUsers' | 'truncatePlayerData' | 'insertAudit'>;
	constructor(options: ResetDependencies = {}) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.queries = options.queries ?? new ResetRepository();
	}

	/** Đếm người chơi sẽ bị xoá — CHỈ đếm, không đụng tới TRUNCATE. */
	async countAll(): Promise<number> {
		return this.queries.countUsers(this.persistence.executor);
	}

	async resetAll(): Promise<ResetResult> {
		// Đếm trước khi xoá (TRUNCATE xoá luôn bằng chứng), sau đó xoá.
		const deletedUsers = await this.countAll();
		if (deletedUsers === 0) return { status: 'nothing-to-reset' };
		await this.queries.truncatePlayerData(this.persistence.executor);
		logger.warn({ deletedUsers }, 'full-reset');
		return { status: 'ok', deletedUsers };
	}

	/** Ghi dấu vết reset vào dev_logs (bảng này được chủ đích giữ lại). */
	async audit(devId: string, deletedUsers: number): Promise<void> {
		const detail = `reset ${deletedUsers} users`;
		await this.queries.insertAudit(this.persistence.executor, devId, detail);
	}
}
