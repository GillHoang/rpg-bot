# Rà soát cơ chế battle — 2026-09-23

Trạng thái: đang triển khai theo từng lát cắt. Phạm vi gồm raid thường, boss, duel, ranked async, combat engine, reward/settlement, cooldown, log và menu.

## Quyết định đã chốt

- Sau giới hạn round, cùng HP% là `draw`; double-KO cũng là `draw`.
- Tách counter duel và ranked; mỗi mode có wins/losses/streak riêng.
- Raid draw ghi outcome riêng, không tăng `raidsWon`/`raidsLost`; vẫn nhận EXP theo nhánh thất bại.
- Hunt cooldown 15 giây bắt đầu sau mọi lượt hunt hợp lệ, dù thắng hay thua; lỗi điều kiện không bắt đầu cooldown.
- Ranked cập nhật rating/thành tích/log cho đối thủ thụ động nhưng quest tham gia chỉ tính người chủ động.
- Duel hòa vẫn ghi `pvp_logs`; lịch sử phải có outcome rõ ràng, không dùng người thắng giả.
- Counter duel/ranked mới được backfill từ `ranked_logs` và `pvp_logs`; phần lịch sử không truy ra được giữ ở counter tổng cũ.
- Đưa toàn bộ tính năng qua menu; slash chỉ giữ trong giai đoạn chuyển đổi.

## Hiện trạng

Bốn use case đều lắp `StatAssemblyService` → `PlayerCombatantFactory` → `BattleEngine`, nhưng orchestration và settlement nằm riêng:

| Luồng | Đối thủ | Điều kiện | Thưởng/settlement | Lịch sử |
|---|---|---|---|---|
| Raid hunt | Mob | Cooldown nghiệp vụ chung 15 giây/người chơi; menu/replay chỉ là lớp hiển thị | Win nhận Credux/shards/chest; loss vẫn nhận EXP; draw chỉ nhận EXP | `raid_logs` |
| Raid boss | Mob boss | Level, phí 10.000, một lần mỗi ngày | Win nhận boss loot/title; phí trừ cùng transaction | `raid_logs` |
| Duel | Người chơi chủ động accept | Challenge 60 giây; stake 0 hoặc tối thiểu 1.000 | Win nhận pot; draw hoàn stake; First Blood | Mọi duel hoàn tất ghi `pvp_logs`; `wager_logs` chỉ ghi settlement có stake |
| Ranked | Bản sao loadout người chơi khác | Matchmaking, fight lock 90 giây | Elo, bracket, shield, streak, weekly progress | `ranked_logs` cho cả hai |

`BattleEngine` hiện là phần dùng chung tốt: outcome, round log, HP snapshot, strategy/decorator, giới hạn 40 round và sudden death. Phần cần gom là **contract của action và kết quả**, không phải gom mọi luật thưởng vào một service lớn.

## Các lệch contract cần xử lý

1. `BattleOutcome` có `draw`, nhưng Raid truyền boolean `won` vào `RaidRewardService`. **Đã sửa:** reward/history/counter dùng outcome; draw không tăng `raidsLost` và không phát `battle.lost`.
2. Duel draw hiện hoàn tiền nhưng chưa ghi `pvp_logs`, trong khi ranked draw đã ghi `ranked_logs`. **Đã sửa:** mọi duel hoàn tất đều ghi `pvp_logs`.
3. `pvp_logs.winner_id` hiện `NOT NULL`, không biểu diễn được draw. **Đã sửa bằng migration:** thêm `outcome` (`win`/`loss`/`draw`) và cho phép `winner_id` nullable; không chèn một người thắng giả.
4. Cooldown hunt đang ở `MenuSession.huntReadyAt` và battle-log replay; `/raid hunt` gọi `RaidService` trực tiếp. **Đã sửa:** cooldown nghiệp vụ nằm ở `hunt_cooldowns`, khóa theo người chơi và dùng chung cho menu/slash/replay.
5. Raid, duel và ranked tự lấy `Date`/seed. **Đã sửa một phần:** thêm `BattleActionContext` và dùng cùng action time/seed trong ba service; persistence action receipt/audit đầy đủ vẫn là bước sau.
6. Ranked settle hai participant trong một transaction; Duel chỉ cập nhật wins/losses và Raid dùng counter riêng. **Đã sửa:** thêm counter duel/ranked riêng, giữ counter tổng legacy và backfill từ log.
7. `BattleEngine.endOfRound` truyền `enemy: side` cho hook `onRoundEnd`, trong khi contract `StrategyContext` yêu cầu đối thủ. **Đã sửa** và có test hồi quy.
8. Các service tự dựng collaborator/RNG theo từng mode. `createApplicationServices` đã có graph chung nhưng chưa truyền cùng progress/clock/action policy cho mọi battle service; phần dependency cleanup vẫn còn.

## Contract chung nên có

```ts
type BattleMode = 'raid' | 'boss' | 'duel' | 'ranked';
type BattleOutcome = 'player_win' | 'enemy_win' | 'draw';

interface BattleActionContext {
  actionId: string;
  actorId: string;
  mode: BattleMode;
  now: Date;
  seed: number;
}

interface BattleResult {
  mode: BattleMode;
  outcome: BattleOutcome;
  rounds: number;
  roundLogs: BattleRoundLog[];
  participants: Array<{ id: string; hpRemaining: number; maxHp: number; result: 'win' | 'loss' | 'draw' }>;
}
```

`BattleEngine` chỉ nhận snapshot combatant + seed và trả kết quả thuần. Feature service giữ luật vào trận và settlement riêng. Mỗi service chuyển kết quả engine thành settlement participant có cấu trúc, sau đó ghi tài sản, progress và history trong cùng transaction. EventBus chỉ phát event sau commit, ưu tiên một `battle.completed` có mode/outcome/participants; các event win/loss có thể là adapter tạm thời.

Không nên tạo một `GameBattleService` khổng lồ. Nên dùng helper/policy nhỏ cho phần thật sự chung:

- `BattleActionContext` và clock/seed.
- `BattleParticipantSnapshot`/factory.
- `BattleResult` và mapping outcome → participant result.
- `BattleLogPresenter` dùng chung cho menu và các đường vào còn lại.
- `CooldownPolicy` và `ActionReceipt` dùng chung; session chỉ là trạng thái UI.

## Thứ tự triển khai

1. Đóng băng các quyết định nghiệp vụ đã chốt trong contract và migration plan.
2. Sửa `BattleEngine` để truyền đúng đối thủ ở mọi hook; thêm test contract cho round-limit, double-KO và equal-HP.
3. Tạo context chung và chuyển Raid làm lát cắt đầu tiên; tách `draw` khỏi boolean `won` trong reward/history.
4. Đưa cooldown hunt và action receipt về use case; menu, replay và slash đi qua cùng entry point.
5. Migration schema cho outcome draw và counter theo mode; backfill counter duel/ranked từ `pvp_logs`/`ranked_logs`, giữ phần không truy ra được trong counter tổng legacy.
6. Chuyển Duel và Ranked sang cùng result/participant settlement; giữ stake, Elo và shield là policy riêng.
7. Chuẩn hóa history/event/presenter, sau đó cập nhật menu và loại bỏ slash dư thừa khi menu đã đủ luồng.

## Tiêu chí hoàn tất

- Cùng một `BattleResult` có nghĩa giống nhau trong cả bốn mode; equal-HP sau giới hạn round không thiên về người khởi tạo.
- Mọi kết quả kết thúc trận đều có outcome/history rõ ràng; không suy ra thắng/thua từ tiền thưởng.
- Duel draw có bản ghi `pvp_logs` hợp lệ với `winner_id = NULL` và `outcome = 'draw'`; raid draw không tăng win/loss counter.
- Counter duel/ranked mới phản ánh được log lịch sử; dữ liệu không thể backfill vẫn được bảo toàn ở counter tổng legacy.
- Retry cùng action không cấp thưởng hai lần; hai đường vào khác nhau tuân thủ cùng cooldown.
- Settlement nhiều participant atomic, lock theo thứ tự ID và có test concurrency.
- Có thể tái hiện một trận từ action ID/seed và snapshot stats khi cần điều tra.
