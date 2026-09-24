/** Shared kernel: Result type for use-cases. Forces explicit error handling. */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

export class AppError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly context?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'AppError';
	}
}
