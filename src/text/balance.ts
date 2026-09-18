import { CURRENCY } from './common.js';

export const BALANCE_DESCRIPTION = 'Xem số Credux hiện có của bạn';

export const BALANCE_SUCCESS = (username: string, credux: number): string =>
	`💰 **${username}** hiện có **${credux}** ${CURRENCY.credux}.`;
