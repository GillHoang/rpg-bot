/**
 * Toàn bộ text hiển thị cho người chơi (mô tả lệnh, câu trả lời, nhãn,
 * lore...) tập trung ở folder này để chỉnh sửa một chỗ.
 *
 * Convention:
 *  - `export const TEN = '...'`  → chuỗi tĩnh, sửa trực tiếp.
 *  - `export const TEN = (x) => ...` → câu có chèn số/tên lúc chạy; sửa
 *    wording quanh placeholder, đừng đổi tham số.
 *
 * Mỗi file tương ứng một lệnh/khu vực. Không put logic vào đây — chỉ text.
 */
export * from './common.js';
export * from './start.js';
export * from './reset.js';
export * from './ping.js';
export * from './balance.js';
export * from './daily.js';
export * from './profile.js';
export * from './raid.js';
export * from './summon.js';
export * from './enhance.js';
export * from './socket.js';
export * from './deity.js';
export * from './casino.js';
export * from './classes.js';
export * from './combat.js';
