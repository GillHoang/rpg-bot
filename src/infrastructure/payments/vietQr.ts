import { DONATION_ERROR_TEXT } from '../../text/diagnostics.js';

export interface VietQrParams {
	bank: string;
	accountNumber: string;
	amount: number;
	description: string;
	template?: string;
}

/** Build SePay's documented dynamic VietQR image URL. */
export function buildVietQrUrl(params: VietQrParams): string {
	if (!params.bank.trim() || !params.accountNumber.trim()) throw new Error(DONATION_ERROR_TEXT.qrAccount);
	if (!Number.isSafeInteger(params.amount) || params.amount <= 0) throw new Error(DONATION_ERROR_TEXT.qrAmount);
	if (!params.description.trim()) throw new Error(DONATION_ERROR_TEXT.qrDescription);
	const query = new URLSearchParams({
		acc: params.accountNumber,
		bank: params.bank,
		amount: String(params.amount),
		des: params.description,
	});
	if (params.template?.trim()) query.set('template', params.template);
	return `https://qr.sepay.vn/img?${query.toString()}`;
}

export const generateVietQrUrl = buildVietQrUrl;
