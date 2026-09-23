import { logger } from './logger.js';
export type FailureKind = 'transaction' | 'deadlock' | 'serialization' | 'observer' | 'missing_atomic_progress';
const failures: Record<FailureKind, number> = {
	transaction: 0,
	deadlock: 0,
	serialization: 0,
	observer: 0,
	missing_atomic_progress: 0,
};
/** Bounded in-process counters; structured logs can be aggregated across restarts. */
export function recordFailure(kind: FailureKind): void {
	failures[kind]++;
	logger.warn({ metric: 'gameplay_failure_total', kind, count: failures[kind] }, 'gameplay-failure');
}
export function failureCounts(): Readonly<Record<FailureKind, number>> {
	return { ...failures };
}
