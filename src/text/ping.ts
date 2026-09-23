/**
 * Text lệnh /ping — sửa wording ngay tại đây.
 */

export const PING_DESCRIPTION = 'Kiểm tra độ trễ bot: WebSocket, REST API và PostgreSQL';

export const PING_WS_LABEL = 'WebSocket';
export const PING_REST_LABEL = 'REST API';
export const PING_DB_LABEL = 'PostgreSQL';

export const PING_DB_ERROR = 'Không kết nối được DB';

/** Display text for commands/admin/PingCommand. */
export const PING_VALUE_TEXT = {
	error: (error: string | number, ms: string | number): string => `${error} (${ms}ms)`,
	latency: (ms: string | number): string => `${ms}ms`,
};
