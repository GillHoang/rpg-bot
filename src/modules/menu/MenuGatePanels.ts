import {
	GATES,
	GATE_TIERS,
	TIERS_PER_GATE,
	defaultGateTier,
	gateModifiers,
	gateUnlocked,
	highestAccessibleGate,
} from '../../shared/config/portals.js';
import { GATE_TEXT } from '../../shared/ui/text/portals.js';
import { WEEKLY_MODIFIERS, weeklyModifierAt } from '../../shared/config/weeklyModifiers.js';
import { battleLobbyPanel } from './gameplayPanels.js';
import type { GamePanel } from './MenuGameplay.js';
import type { MenuSession } from './MenuSessionStore.js';
import type { ProfileSummaryData } from '../identity/application/ProfileService.js';
import type { MenuPlayerState } from './infrastructure/MenuPlayerRepository.js';

/** Progress row projection shared by both gate panels (SRP extraction). */
export function gatesCleared(
	user:
		| {
				gate1TiersCleared?: number | null;
				gate2TiersCleared?: number | null;
				gate3TiersCleared?: number | null;
				gate4TiersCleared?: number | null;
				gate5TiersCleared?: number | null;
		  }
		| undefined,
): number[] {
	return [
		user?.gate1TiersCleared ?? 0,
		user?.gate2TiersCleared ?? 0,
		user?.gate3TiersCleared ?? 0,
		user?.gate4TiersCleared ?? 0,
		user?.gate5TiersCleared ?? 0,
	];
}

/** Màn chọn Gate: danh sách 5 Gate kèm trạng thái unlocked theo tiến độ + level. */
export function gateSelectPanel(
	session: MenuSession,
	profile: ProfileSummaryData,
	user: MenuPlayerState | undefined,
	bossDone: boolean,
): GamePanel {
	const cleared = gatesCleared(user);
	const level = profile.level;
	const panel = battleLobbyPanel(profile, bossDone, !!session.battle);
	panel.title = GATE_TEXT.title;
	const weekly = WEEKLY_MODIFIERS[weeklyModifierAt(new Date())]!;
	panel.body = [
		GATE_TEXT.weeklyLine(weekly.name, weekly.desc),
		...GATES.map((g) => {
			const done = cleared[g.id - 1] ?? 0;
			return (
				GATE_TEXT.gateRow(g.id, g.name, gateModifiers(g), g.minLevel, done, level) +
				` · ` +
				GATE_TEXT.tiersStatus(done)
			);
		}),
		GATE_TEXT.rules,
		panel.body,
	].join('\n');
	panel.data = {
		...panel.data,
		gates: GATES.map((g) => ({ id: g.id, disabled: !gateUnlocked(g, cleared, level) })),
	};
	return panel;
}

/** Màn tier trong một Gate: khóa tầng vượt quá `cleared + 1` (chỉ mở dần từng tầng).
 * Ghi chú hợp đồng: render được phép chuẩn hoá lựa chọn (gateId/portalGate
 * mặc định) ngay trên session — có tính idempotent (tính lại cùng kết quả),
 * và router luôn render trên bản copy rồi gán ngược, nên caller trực tiếp
 * gọi render() phải coi session có thể đã đổi sau khi render xong. */
export function gateTiersPanel(
	session: MenuSession,
	profile: ProfileSummaryData,
	user: MenuPlayerState | undefined,
	bossDone: boolean,
): GamePanel {
	const cleared = gatesCleared(user);
	const level = profile.level;
	const gate = GATES.find((g) => g.id === session.gateId) ?? highestAccessibleGate(cleared);
	const gateCleared = cleared[gate.id - 1] ?? 0;
	const tiers = GATE_TIERS.filter((t) => t.gate.id === gate.id);
	const selected = tiers.find((t) => t.number === session.portalGate) ?? defaultGateTier(cleared, gate);
	session.gateId = gate.id;
	session.portalGate = selected.number;
	const panel = battleLobbyPanel(profile, bossDone, !!session.battle);
	panel.title = GATE_TEXT.title;
	const weekly = WEEKLY_MODIFIERS[weeklyModifierAt(new Date())]!;
	panel.body = [
		GATE_TEXT.gateHeader(gate.id, gate.name, gateModifiers(gate), gate.minLevel),
		GATE_TEXT.weeklyLine(weekly.name, weekly.desc),
		...tiers.map((t) => GATE_TEXT.tierRow(t, gateCleared)),
		gateCleared >= TIERS_PER_GATE ? GATE_TEXT.gateCleared : '',
		panel.body,
	]
		.filter(Boolean)
		.join('\n');
	panel.data = {
		...panel.data,
		tiers: tiers.map((tier) => ({
			number: tier.number,
			disabled: !gateUnlocked(gate, cleared, level) || tier.number > gateCleared + 1,
		})),
	};
	return panel;
}
