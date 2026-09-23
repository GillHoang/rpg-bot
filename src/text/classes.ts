import type { CombatClass } from '../domain/entities/PlayerAccount.js';

/**
 * Text lore/passive của từng lớp nhân vật (tách từ config/classes.ts).
 * Số liệu base/scaling nằm ở config/classes.ts; emoji lấy từ text/icons.ts.
 */
export interface ClassText {
	passiveName: string;
	flavor: string;
	passiveLine: string;
}

export const CLASS_TEXT: Record<CombatClass, ClassText> = {
	Swordsman: {
		passiveName: 'Chảy Máu',
		flavor:
			'Chiến binh được tôi luyện cho chiến trường. Không phải mạnh nhất hay nhanh nhất, nhưng là đáng tin nhất. ' +
			'Kiếm Sĩ đi trên sợi dây giữa công và thủ, thích ứng với mọi trận đánh. Mỗi nhát kiếm để lại một vết thương, và mỗi vết thương đều chảy máu.',
		passiveLine:
			'**Nội tại: Chảy Máu** — Đòn đánh gây 4% Chảy máu, cộng dồn tới 20%. ' +
			'Nhận +5% ATK mỗi lượt, cộng dồn tới +30% trong trận.',
	},
	Fighter: {
		passiveName: 'Choáng',
		flavor:
			'Chiến binh không chờ trận đấu đến — họ tự mang nó đến. Chiến Binh được dựng nên từ hung hãn, ' +
			'sức mạnh thô và niềm tin sắt đá rằng đòn phòng thủ tốt nhất là một cú đấm thẳng vào hàm.',
		passiveLine:
			'**Nội tại: Choáng** — Đòn đánh gây thêm +50% sát thương với 30% cơ hội biến thành Bash. Bash cộng thêm ' +
			'+50% sát thương, Choáng 1 lượt và khiến mục tiêu Dizzy với 15% trượt đòn tiếp theo.',
	},
	Mage: {
		passiveName: 'Quá Tải',
		flavor:
			'Pháp Sư không vung kiếm. Họ không cần. Khi kẻ khác đang thu ngắn khoảng cách, Pháp Sư ' +
			'đã đi trước ba nước, tích tụ nguồn năng lượng không lớp giáp nào hấp thụ nổi.',
		passiveLine:
			'**Nội tại: Quá Tải** — Đòn chính của mỗi lượt thứ ba trong trận gieo xác suất 4.0x sát thương (60%) hoặc 5.0x ' +
			'sát thương (40%), không thể CRIT, và áp một hiệu giảm ngẫu nhiên 25%: Paralyze, Burn, DEF Down hoặc ATK Down.',
	},
	Knight: {
		passiveName: 'Giảm Sát Thương',
		flavor:
			'Hiệp Sĩ không dễ ngã. Trong khi kẻ khác gãy đổ dưới áp lực, Hiệp Sĩ hấp thụ nó, ' +
			'giữ vững phòng tuyến và tiếp tục chiến đấu.',
		passiveLine:
			'**Nội tại: Giảm Sát Thương** — Sát thương nhận vào giảm 25%, sát thương gây ra tăng 30%, ' +
			'và Hiệp Sĩ hồi 2% HP tối đa mỗi lượt.',
	},
	Archer: {
		passiveName: 'Xuyên Giáp & Đánh Đôi',
		flavor:
			'Nhanh nhẹn, chuẩn xác và chết chóc từ xa. Cung Thủ không chờ kẻ địch đến — họ ' +
			'đã biến mất từ trước khi địch kịp áp sát.',
		passiveLine:
			'**Nội tại: Xuyên Giáp & Đánh Đôi** — Đòn đánh bỏ qua 25% DEF của mục tiêu và có 35% ' +
			'cơ hội thực hiện thêm một đòn tấn công ngay lập tức.',
	},
};
