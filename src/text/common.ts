/**
 * Text dùng chung cho nhiều lệnh. Sửa wording ngay tại đây.
 * Convention: const = chuỗi tĩnh; hàm arrow = chuỗi có chèn số/tên lúc chạy.
 */
export const NOT_REGISTERED = 'Bạn chưa đăng ký. Gõ `/start` để bắt đầu.';
export const NO_CHARACTER = 'Bạn chưa có nhân vật. Gõ `/start` để tạo.';

/** Tên tiền tệ hiển thị cho người chơi. */
export const CURRENCY = {
	credux: 'Credux',
	beliefShards: 'Belief Shards',
} as const;
export const GENERIC_ERROR = 'Đã có lỗi xảy ra khi thực thi lệnh này.';

/** Display text for core/CommandRegistry. */
export const COMMAND_RECOVERY_TEXT = {
	unavailable: 'Lệnh này không còn khả dụng. Hãy mở lại danh sách lệnh.',
};

/** Display text for utils/weightedRandom. */
export const REWARD_DATA_TEXT = {
	missingSeed: 'Thiếu dữ liệu seed cho phần thưởng. Tài nguyên chưa bị trừ.',
};
