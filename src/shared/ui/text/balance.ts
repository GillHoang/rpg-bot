import { CURRENCY } from './common.js';
import { ICONS } from './icons.js';

export const BALANCE_DESCRIPTION = 'Xem số Credux hiện có của bạn';

export const BALANCE_SUCCESS = (username: string, credux: number): string =>
	`${ICONS.economy.wallet} **${username}** hiện có **${credux}** ${CURRENCY.credux}.`;
