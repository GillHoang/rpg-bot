import type { AppError, Result } from '../../src/shared/kernel/Result.js';

/** Test-only unwrap for Result<string, AppError>: success text or the coded error message. */
export function textOf(result: Result<string, AppError>): string {
	return result.ok ? result.value : result.error.message;
}
