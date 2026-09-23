# Text và emoji — 2026-09-23

Hoàn thiện cấu trúc `src/text` sẵn có: gom icon về `icons.ts`, cung cấp Unicode cho canvas và override custom emoji cho Discord, chuyển log/lỗi/CLI sang `diagnostics.ts`, tập trung định dạng số trong `format.ts`. Các câu còn nằm ở service đã chuyển về module tương ứng; pool rune tham chiếu tên theo ID catalog.

Giữ API import cũ và nội dung có sẵn; so sánh 905 giá trị tĩnh không phát hiện khác biệt. Guard AST và 20 test mới kiểm tra ranh giới nội dung, Unicode escaped, custom emoji, renderer canvas, formatter và tên rune. Không thêm framework i18n khi chưa có yêu cầu đa ngôn ngữ.

Kiểm tra tĩnh/build đạt; 8 lỗi test đã có ở baseline liên quan locale/menu vẫn còn. Xem [kế hoạch và kết quả](../text-refactor-plan.md) cùng [hướng dẫn nội dung](../../src/text/README.md).
