# Kế hoạch thực hiện M7 — PvP, Quest, Pantheon/Blessing, Cosmetics + cột schema nằm im

Phạm vi: các hệ thống còn lại của [gameplay-flow.md](gameplay-flow.md) §8 (trước đây
đánh dấu "M7 trở đi") trên schema PostgreSQL hiện có — **không có migration mới**,
mọi bảng/cột đã tồn tại từ pg_dump schema gốc (`active_duels`, `ranked_*`,
`daily_quests`, `weekly_quests`, `cosmetic_catalog`, `user_character.believer_*`…).

Ba quyết định phạm vi do người dùng chốt:

1. **Ranked PvP = async mirror match** — đấu với loadout hiện tại của một người
   chơi ngẫu nhiên khác (rating chênh trong cửa sổ matchmaking), không cần cả
   hai online; khớp cấu trúc `active_ranked_fights` (1 lock mỗi người, không có
   cột đối thủ).
2. **Bỏ vote reward** — bảng `topgg_vote_events` nằm im; không chạy webhook HTTP.
3. **Scheduler = sweeps + reset lazy** — không làm world boss guild
   (`boss_spawn_queue`, `boss_state`, `boss_attack_log`, `auto_raids` nằm im).

## Checklist triển khai

- [x] Sudden-death sau round 30 (damage ×2 mỗi round, 31–40) + initiative roll
      theo cờ `initiative_bias` trong `BattleEngine`.
- [x] Deity blessing decorator (8 blessing key đã seed), pantheon slot 2/3
      (trọng số 50%/25%) + resonance mythology trong StatAssembly;
      `/equip kind:deity2|deity3`.
- [x] `/duel` (giao hữu + cược, nút chấp nhận/từ chối, 60s), `/ranked
      fight|claim|stats`, `/pvp shop|buy` (Valor Medals).
- [x] Quest daily/weekly sinh lazily qua EventBus subscriber; `/quest
      view|refresh|claim`; Sacred Relic khi đủ 3 daily; Weekly Grand Diamond
      Chest khi đủ 3 weekly.
- [x] Believer EXP/reputation với cap hằng ngày (Asia/Ho_Chi_Minh), level-up nội
      bộ, gate tier cosmetic, hiển thị trên `/profile`.
- [x] `/cosmetic list|equip`, `/title list|equip`, title tự grant (first duel
      win, boss kill, ranked promotion), base cosmetic auto-grant khi `/create`.
- [x] `/class change` tiêu Change-Class Token; `/summon relic:sacred|supreme`
      ép tier; `/runes open bag:lb|gb|db`; `/open` nhận thêm Diamond/Genesis
      chest + drop rune bag.
- [x] Scheduler sweep: duel hết hạn + ranked lock treo mỗi 30s.
- [x] Seed mới: cosmetics, titles, ranked_reward; bổ sung Supreme rune/gear
      cho genesis chest.
- [x] 54 test domain/PGlite qua (thêm `m7-domain.test.ts`, `m7.test.ts`);
      build + ESLint qua.

## Quyết định balance bổ sung (mặc định mới — không port từ bản gốc)

| Hạng mục | Giá trị triển khai |
| --- | --- |
| Pantheon slot 2/3 | Stat deity ×0.5 / ×0.25 (`PANTHEON_SLOT_WEIGHT`) |
| Resonance | 2 deity cùng mythology +10%, 3 cùng +20% lên phần đóng góp deity |
| Blessing strength | `scalable` = 0.5 + 0.05×sigils (cap 1.0); `binary` = 1 |
| guardian_light | Hồi 4%×strength maxHP mỗi round |
| tailwind | +25%×strength bias initiative (engine roll mỗi round, chênh lệch bias 2 bên) |
| tidal_wrath | Tới +35%×strength damage theo tỉ lệ máu đã mất |
| moon_devourer | 15%×strength/round: đòn forced ×2 |
| lunar_veil | Sau khi dính đòn, đòn kế −30%×strength |
| solar_fury | +6%×strength damage mỗi đòn |
| mountain_grace | Dưới 50% HP: −35%×strength damage vào |
| sky_sovereign | 1 lần/trận hoá giải trọn đòn (binary) |
| Blessing nguồn | Chỉ deity slot 1 của preset active |
| Sudden death | Round 31–40: mọi damage ×2^(round−30); hết round 40 tiebreak HP% |
| Duel | Stake ≥ 1.000; trừ cược khi accept, winner ăn 2× stake; draw hoàn cả hai; hết hạn 60s; 1 duel pending mỗi người |
| Elo | K=32 zero-sum, cả hai bên đều đổi rating |
| Bracket | Mortal <1100, Champion 1100, Demigod 1400, Ascendant 1700, Divine ≥2000 |
| Demotion shield | Lần rớt bracket đầu tiên chỉ về sàn bracket cũ, shield mất; thăng bracket nạp lại |
| Ranked weekly claim | ≥1 trận trong tuần ISO Asia/Ho_Chi_Minh; thưởng theo `ranked_reward` seed (Mortal 50k+2 valor → Divine 800k+40 valor+1 Genesis) |
| PVP shop | change_class 120 · diamond chest 60 · frame_gold 40 · frame_eternal 90 · title_champion 80; cosmetic/title giới hạn 1/season |
| Quest daily | 3/6 loại, thưởng 20–60k Credux + 50–150 shards; đủ 3 → +1 Sacred Relic |
| Quest weekly | 3/6 loại, thưởng 50–150k Credux + 5–15 valor; đủ 3 → `/quest claim` 100k + 1 Diamond Chest |
| `/quest refresh` | 1 lần/ngày, chỉ reroll daily chưa hoàn thành |
| Believer EXP | daily 50 · raid win 30 · duel win 40 · ranked win 50 · quest 25 · weekly grand 100; cap 500/ngày; level cost 400+100×N |
| Relic pull | sacred = Mythic 70/Legendary 28/Supreme 2; supreme = Legendary 70/Supreme 30; không tốn shards, không đụng pity, ghi `summon_reward_grants` |
| Relic faucet | Diamond chest 25% +1 Sacred Relic · Genesis chest 100% +1 Supreme Relic — vòng kín relic: daily quest → sacred, genesis chest → supreme, cả hai tiêu ở `/summon relic` |
| Rune bag drop | Gold 8% lb · Boss Treasure 20% lb/8% gb · Boss Golden 30% gb/12% db · Diamond 50% gb/25% db · Genesis 100% db |
| Diamond chest | 200–400k Credux, 300–600 shards, 100% rune Legendary, 40% gear Legendary, 50% legendary essence |
| Genesis chest | 500k–1M Credux, 800–1500 shards, 100% rune Supreme, 50% gear Supreme, 100% supreme essence |
| Supreme gear stat | ATK 640–960 · HP 3200–4800 · DEF 320–480 · CRIT 8–10 |
| Nguồn Diamond chest | Ranked weekly Ascendant+ · Weekly Grand · PVP shop |
| Nguồn Genesis chest | Ranked weekly Divine · PVP shop (không bán; nằm ở ranked) |

## Kiến trúc

- `EventBus` mở rộng 5 event mới (`summon.done`, `gear.enhanced`, `chest.opened`,
  `casino.played`, `daily.claimed`); quest + believer EXP là subscriber thuần
  trong `core/subscribeDomainEvents.ts` — combat/economy services chỉ emit.
- Blessing dùng đúng Decorator pattern của rune (`DeityBlessingDecorator`,
  chain được với `RuneStrategyDecorator`); strength tính tại StatAssembly.
- Duel/ranked khóa người qua `active_duel_participants` / `active_ranked_fights`
  với lockToken + expiresAt; mọi thay đổi tài nguyên trong 1 tx, thua/bị hết hạn
  rollback sạch.
- Reset daily/weekly là **lazy** (so ngày/ISO-week Asia/Ho_Chi_Minh tại điểm đọc) — không
  cron nào phải chạy để hệ thống quest/reputation đúng hạn.

## Giới hạn đã biết

- Chưa port (nằm ngoài quyết định phạm vi): world boss guild, vote reward,
  echo deity slot (`active_echo_deity_id` — schema có, chưa có cơ chế),
  supporter/stripe/tickets, season-end payout (bảng `seasons` chỉ tạo lazily).
- Cột/bảng schema vẫn nằm im sau M7 (không faucet không sink, có chủ đích):
  `users_bag.supreme_chest`, `users_bag.custom_avatar_token` /
  `custom_deity_token` (hệ supporter), `essence_exchange_submissions`,
  `raid_reward_grants` (phần thưởng theo level), `user_guild_activity`,
  `user_character.boss_top_damage`, `topgg_vote_events`, `boss_*`/`auto_raids`.
- `raid_logs` giờ được ghi cho MỌI trận raid/boss (win lẫn loss) — trước đợt
  audit này bảng tồn tại nhưng không bao giờ được ghi; `highest_raid_streak`
  tính từ đuôi raid_logs, `ranked` cũng đã cộng `pvp_wins`/`pvp_losses` cho
  cả hai đấu thủ.
- Tailwind của cả hai bên cộng trừ qua `initiative_bias` — mob thường không có
  bias nên deity tailwind luôn có lợi trong raid.
- Draw ở duel (double KO) hoàn cược cho cả hai và không ghi `pvp_logs`.
- `ranked_reward.season_end_payload` để trống — trao cuối mùa chưa có cơ chế.

Cần `pnpm deploy:commands` + restart bot để dùng 7 lệnh mới (`/duel`, `/ranked`,
`/pvp`, `/quest`, `/cosmetic`, `/title`, `/class`) và subcommand mới
(`/runes open`, `/summon relic:`, `/open chest:diamond|genesis`).
DB cần chạy `pnpm db:seed` để nạp cosmetic/title/ranked_reward seed.
