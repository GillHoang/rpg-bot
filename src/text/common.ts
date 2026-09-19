/**
 * Text dùng chung cho nhiều lệnh. Sửa wording ngay tại đây.
 * Convention: const = chuỗi tĩnh; hàm arrow = chuỗi có chèn số/tên lúc chạy.
 */
export const NOT_REGISTERED = 'Bạn chưa đăng ký. Dùng `/register` trước đã.';
export const NO_CHARACTER = 'Bạn chưa tạo nhân vật. Dùng `/create` trước đã.';

/** Tên tiền tệ hiển thị cho người chơi. */
export const CURRENCY = {
	credux: 'Credux',
	beliefShards: 'Belief Shards',
} as const;
export const GENERIC_ERROR = 'Đã có lỗi xảy ra khi thực thi lệnh này.';
