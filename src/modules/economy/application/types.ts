/** Canonical daily-claim result — owned by the economy module. */
export type ClaimDailyResult =
	| { status: 'not-registered' }
	| { status: 'already-claimed'; overall: number }
	| {
			status: 'ok';
			day: number;
			monthly: number;
			overall: number;
			credux: number;
			shards: number;
			chestLabel: string;
			milestoneChestLabel: string | null;
	  };
