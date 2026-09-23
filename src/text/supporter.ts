import { formatDate, formatNumber } from './format.js';
import { ICONS } from './icons.js';

export const SUPPORTER_TEXT = {
	description: 'Ủng hộ nhà phát triển và nhận quyền cảm ơn không ảnh hưởng gameplay.',
	amountOption: 'Số tiền đóng góp bằng VND',
	disabled: 'Tính năng ủng hộ chưa được cấu hình. Vui lòng thử lại sau.',
	invalidAmount: (min: number, max: number) => `Khoản đóng góp phải từ ${formatVnd(min)} đến ${formatVnd(max)}.`,
	underTier: (amount: number, code: string, bank: string, account: string) =>
		paymentInstructions(amount, undefined, code, bank, account),
	pending: (amount: number, tier: string | undefined, code: string, bank: string, account: string) =>
		paymentInstructions(amount, tier, code, bank, account),
	thankYou: (amount: number, tier: string | undefined, code: string, expiresAt?: Date | null) =>
		[
			`${ICONS.supporter.heart} Cảm ơn bạn đã ủng hộ nhà phát triển!`,
			'',
			`Khoản đóng góp: ${formatVnd(amount)}`,
			tier ? `Supporter Tier: ${tier}` : 'Supporter Tier: Chưa đạt ngưỡng tier',
			`Mã ủng hộ: ${code}`,
			expiresAt ? `Thời hạn: đến ${formatDate(expiresAt)}` : 'Thời hạn: theo cấu hình supporter',
			'',
			'Cảm ơn bạn đã giúp duy trì và phát triển bot!',
		].join('\n'),
	statusUnknown: 'Khoản đóng góp đang được đối soát. Vui lòng kiểm tra lại sau.',
	statusDescription: 'Xem trạng thái khoản ủng hộ của bạn.',
	orderIdOption: 'Mã đơn ủng hộ đã nhận khi tạo QR',
	orderNotFound: 'Không tìm thấy đơn ủng hộ của bạn với mã này.',
	orderStatus: (orderId: string, amount: number, state: string, code: string) =>
		`Đơn ${orderId}\nKhoản đóng góp: ${formatVnd(amount)}\nMã chuyển khoản: ${code}\nTrạng thái: ${state}`,
	qr: (url: string) => `QR thanh toán: ${url}`,
	orderId: (id: string) => `Mã đơn: ${id}`,
	orderExpiresAt: (date: Date) => `Hết hạn: ${formatDate(date)}`,
} as const;

function paymentInstructions(
	amount: number,
	tier: string | undefined,
	code: string,
	bank: string,
	account: string,
): string {
	return [
		`${ICONS.supporter.heart} Cảm ơn bạn đã muốn ủng hộ nhà phát triển!`,
		'',
		`Khoản đóng góp: ${formatVnd(amount)}`,
		tier ? `Supporter Tier dự kiến: ${tier}` : 'Khoản này chưa đạt ngưỡng Supporter Tier.',
		'',
		'Chuyển khoản tự nguyện với thông tin sau:',
		`Ngân hàng: ${bank}`,
		`Số tài khoản: ${account}`,
		`Số tiền: ${formatVnd(amount)}`,
		`Nội dung: ${code}`,
		'',
		`Sau khi nhận đủ tiền, hệ thống sẽ đối soát mã ${code} và gửi lời cảm ơn.`,
	].join('\n');
}

function formatVnd(amount: number): string {
	return `${formatNumber(amount, 'vi-VN')}đ`;
}
