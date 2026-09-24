import type { Result } from './Result.js';

/** Single-public-method contract for every application use-case. */
export interface UseCase<TInput, TOutput> {
	execute(input: TInput): Promise<Result<TOutput>>;
}
