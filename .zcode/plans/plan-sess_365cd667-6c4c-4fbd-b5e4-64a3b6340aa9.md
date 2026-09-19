# Triển khai M7 — PvP, Quest, Pantheon/Blessing, Cosmetics, Reputation + cột schema nằm im

Phạm vi theo lựa chọn của bạn: **Ranked async mirror match**, **bỏ vote reward** (bảng `topgg_vote_events` để im), **scheduler = sweeps + reset, không world boss** (bảng `boss_*`/`auto_raids` để im). Không đổi schema — mọi bảng/cột đã có sẵn. Số liệu balance là mặc định mới, ghi rõ trong doc (không tuyên bố port từ bản gốc, như precedent của gameplay-implementation.md).

## WS1 — Combat core (nền cho PvP)

1. **Sudden-death sau round 30** (`BattleEngine.ts`): round 31–40 mọi sát thương nhân `2^(round−30)` (log header báo sudden death); hết round 40 giữ nguyên tiebreak HP%. 
2. **Deity blessing** (`config/blessings.ts` + `domain/combat/DeityBlessingDecorator.ts`, cùng pattern Decorator với rune): 8 blessing key theo seed deity. Strength `scalable` = `0.5 + 0.05×sigils` (cap 1.0), `binary` = cố định:
   - `guardian_light` hồi 4%×s maxHP mỗi round · `tailwind` +25%×s cơ hội đánh trước (engine thêm initiative roll mỗi round qua `flags.initiativeBias`) · `tidal_wrath` tới +35%×s damage khi HP thấp · `moon_devourer` 15%×s/round đòn heavy ×2 · `lunar_veil` sau khi dính đòn, đòn kế −30%×s · `solar_fury` +6%×s mỗi đòn · `mountain_grace` dưới 50% HP −35%×s damage vào · `sky_sovereign` (binary) 1 lần/trận hoá giải trọn đòn.
3. **Pantheon slot 2/3 + resonance** (`StatAssemblyService.ts`): đọc `equippedDeity2Id/3Id` của preset active — stat deity 2 nhân 0.5, deity 3 nhân 0.25; resonance cùng mythology: 2 deity trùng mythology +10%, 3 trùng +20% lên phần đóng góp deity. Blessing chỉ tính từ deity slot 1. `LoadoutService`: `/equip kind:deity2|deity3` (validate không trùng slot). `RaidService` bọc thêm blessing decorator.

## WS2 — Duel + Ranked PvP

4. **Duel** (`services/DuelService.ts` + `commands/rpg/DuelCommand.ts`): `/duel opponent:@user stake:<credux>` — row `active_duels` + `active_duel_participants` với lockToken, hết hạn 60s; nút Chấp nhận/Từ chối (pattern collector như casino). Chấp nhận: khoá 2 bag, trừ stake cả 2, resolve BattleEngine (2 player full StatAssembly + rune + blessing), winner nhận 2× stake; ghi `pvp_logs`, `wager_logs` (nếu có cược), `pvp_wins/losses`, emit `battle.won/lost` type `duel`. Casual: stake 0.
5. **Ranked** (`services/RankedService.ts` + `commands/rpg/RankedCommand.ts` — sub `fight|claim|stats`): lock `active_ranked_fights`; chọn ngẫu nhiên registered opponent khác, rating ±300 (fallback rộng dần); cả hai loadout đấu async. Elo K=32; bracket Mortal <1100, Champion 1100, Demigod 1400, Ascendant 1700, Divine ≥2000; demotion shield: thua đầu tiên rớt bracket chỉ về ngưỡng (cờ `pvp_demotion_shield`, reset khi thăng bracket); cập nhật `pvp_peak`, `highest_rank_streak`, `ranked_logs`; tạo season lazily nếu chưa có.
6. **Weekly claim** (`ranked_reward` seed mới theo bracket): Mortal 50k Credux + 2 valor; Champion 150k + 8 valor + 2 Silver; Demigod 300k + 15 valor + 1 Gold; Ascendant 500k + 25 valor + 1 Gold + 1 Diamond; Divine 800k + 40 valor + 1 Genesis. Điều kiện ≥1 trận tuần đó, `last_weekly_claim_week` = ISO week Manila.
7. **`/pvp shop`** (`commands/rpg/PvpCommand.ts` + `config/pvpShop.ts`): tiêu `valor_medals` — change-class token 120, Diamond chest 60, cosmetic 40, title 80 (cosmetic/title giới hạn 1/season qua `pvp_shop_purchases`).

## WS3 — Quest + Reputation/Believer EXP

8. **EventBus mở rộng**: thêm `summon.done`, `gear.enhanced`, `chest.opened`, `casino.played`, `daily.claimed`; emit từ Summon/Enhancement/Loot/Casino/DailyService.
9. **Quest** (`config/quests.ts` + `services/QuestService.ts` + `commands/rpg/QuestCommand.ts`): sinh lazily 3 daily (pool: raid_win ×5, summon ×3, enhance ×2, open_chest ×3, casino ×5, daily ×1 — thưởng 20–60k Credux + 50–150 shards) và 3 weekly (pool: raid_win ×15, summon ×10, duel_win ×5, ranked ×5, open_chest ×10, enhance ×6 — thưởng 50–150k + 5–15 valor) theo ngày/ISO-week Manila. Progress qua subscriber; hoàn thành tự cộng thưởng; đủ 3 daily → `daily_quest_completion_rewards` +1 Sacred Relic; đủ 3 weekly → claim Weekly Grand qua `/quest claim` (+1 Diamond Chest). `/quest refresh` reroll daily 1 lần/ngày.
10. **Believer EXP** (`config/reputation.ts` + `services/ReputationService.ts`): `awardBelieverExp` — daily +50, raid win +30, duel win +40, ranked win +50, quest +25, weekly grand +100; cap 500/ngày (`reputation_exp_today` + reset theo DailyCycle); level cost `400 + 100×N`. Gate tier cosmetic (believer/chosen/eternal). `/profile` hiển thị believer level/exp.

## WS4 — Cosmetics, Titles, Change-class + cột bag nằm im

11. **Seed mới** (`seed/data/cosmetics.ts`, `titles.ts`, `rankedRewards.ts` + seed.ts): base cosmetic mỗi category (auto-grant khi `/create`), vài item shop; title: boss_slayer, 4 title bracket ranked, collection.
12. **`/cosmetic list|equip`** + **`/title list|equip`** (`services/CosmeticService.ts` + `commands/rpg/CosmeticCommand.ts`, `TitleCommand.ts`): equip vào `equipped_skins` / `equipped_title_id`; title hiện trên `/profile`.
13. **`/class change class:<X>`** (`ClassCommand.ts`): tiêu 1 `change_class` token, đổi class giữ nguyên level/exp/gear/deity.
14. **Relic summon**: `/summon relic:sacred|supreme` — sacred = Mythic 70/Legendary 28/Supreme 2; supreme = Legendary 70/Supreme 30; 1 relic/pull, không đụng pity, ghi `summon_reward_grants` (source `sacred_relic|supreme_relic`).
15. **Rune bag**: `/runes open bag:lb|gb|db` tiêu `lesser/greater/divine_rune_bag`, roll đúng `runePool` của `essence_bag_def`.
16. **Diamond/Genesis chest** (`config/chestLoot.ts`): thêm 2 rương (diamond: 200–400k, 300–600 shards, 100% rune Legendary, 40% gear Legendary, 50% legendary essence; genesis: 500k–1M, 800–1500 shards, 100% rune Supreme, 50% gear Supreme — thêm `GEAR_STATS.Supreme`, 100% supreme essence) + drop rune bag từ rương hiện có (gold 8% lb; boss_treasure 20% lb/8% gb; boss_golden 30% gb/12% db); `/open` nhận thêm diamond|genesis.

## WS5 — Scheduler (sweeps)

17. **`core/Scheduler.ts`** (khởi động trong `DiscordBot` ClientReady): mỗi 30s quét — duel quá `expires_at` → huỷ + nhả lock, `active_ranked_fights` hết hạn → xoá. Reset daily/weekly theo kiểu lazy (so ngày Manila tại điểm đọc) — không cần cron.

## WS6 — Nối dây + docs + tests

18. `registerAllCommands.ts` +7 lệnh (duel, ranked, pvp, quest, cosmetic, title, class); `index.ts` khởi tạo subscriber (quest/reputation) + scheduler; text mới: `duel.ts`, `ranked.ts`, `quest.ts`, `cosmetic.ts`, `title.ts`, `class.ts`.
19. **Docs**: `docs/m7-implementation.md` (bảng balance + quyết định thiết kế như precedent); cập nhật §8 `gameplay-flow.md` + README (lệnh mới, phạm vi còn lại: world boss, vote, echo deity, supporter/stripe).
20. **Tests** (harness PGlite hiện có): `tests/m7.test.ts` — duel accept/decline/expiry/wager atomic, ranked elo/bracket/claim-1-lần/tuần, quest lazy gen/progress/hoàn thành/relic, reputation cap+level, relic summon, rune bag, rương mới, class change, cosmetic/title ownership; domain: sudden death, từng blessing key, trọng số pantheon/resonance; `discord-flow.test.ts`: collector nút duel. Chạy `pnpm test && pnpm build && pnpm lint`.

**Không làm** (theo lựa chọn/phạm vi): world boss (`boss_*`, `auto_raids`), vote reward (`topgg_vote_events`), echo deity slot, hệ supporter/stripe/tickets, portrait canvas.