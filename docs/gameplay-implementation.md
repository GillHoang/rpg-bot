# Kế hoạch thực hiện gameplay flow

Phạm vi: thực hiện §4–6 của gameplay-flow.md trên kiến trúc PostgreSQL hiện có.
Không dùng agent con theo yêu cầu người dùng. Giữ nguyên các chỉnh sửa có sẵn.

- [x] Chuẩn hóa weighted RNG bằng wrand, luôn truyền RNG; giữ pity tuần tự.
- [x] Inventory/deities phân trang; loot rương + stat gear theo tier; shop rune theo seed.
- [x] Equip/preset đồng bộ loadout; socket đầu miễn phí, mở thêm theo seed, hỗ trợ lane opposite.
- [x] Elite 20%, loot riêng; boss Bakunawa có phí/cooldown và phase dưới nửa HP.
- [x] Blackjack/Crash: nút riêng người chơi, 60 giây, debit trước, settle đúng một lần.
- [x] Hướng dẫn sau create, balance đầy đủ, Ascension prestige; tài liệu lệnh mới.

Các lựa chọn thiết kế đã rà soát: bảng rương dùng đề xuất §5; essence mỗi drop = 1;
Gold gear chia Rare/Mythic 50/50. Gear generator và boss/elite balance mới đặt trong config.
Ascension chỉ là prestige (không thêm stat/blessing). Không triển khai các hệ M7 ngoài phạm vi.
Kiểm tra giao dịch đồng thời, thiếu seed phải rollback, quyền sở hữu item, giới hạn Discord.

## Quyết định balance bổ sung

| Hạng mục | Giá trị triển khai |
| --- | --- |
| Elite | 20% khi có cả regular/elite; thiếu một pool thì dùng pool còn lại |
| Elite thắng | 2.500–5.000 Credux, 500–750 EXP trước scale, 20–30 shards, 35% Gold |
| Elite thua | 100 EXP trước scale |
| Boss | Cấp 10, phí 10.000 Credux, một lượt/ngày Asia/Ho_Chi_Minh, thắng/thua đều tính lượt |
| Boss thắng | 25.000–50.000 Credux, 1.500–2.500 EXP trước scale, 100–200 shards, 1 Boss Treasure, 30% Mythic gear |
| Boss thua | 150 EXP trước scale |
| Bakunawa Eclipse | Dưới 50% HP: +50 điểm phần trăm damage bonus; miễn stun |

> **Cải tổ battle PvE 2026-09-25** (auto-battle giữ nguyên, chỉ PvE; PvP balance
> để phase sau — Elo/shield không đổi):
> - Damage: mitigation `DEF/(DEF+600)` cap 75%, armor-pen cộng dồn cap 60%,
>   variance theo skill (mặc định ±10%), crit ×2 giữ nguyên.
> - Stat mới: SPD (đi trước; hòa mới roll bias), ACC/EVA (hit 95% +1%/điểm,
>   kẹp 80–100%), TEN (tỉ lệ kháng thẳng stun/paralyze/dizzy).
> - Class: Swordsman detonate bleed 5 stack; Fighter Bash có điều kiện
>   (15%/35% khi dizzy, execution stun 2 dưới 30% HP, miễn stun-lock 2 round);
>   Mage weave (tiêu debuff cũ lấy Overcharge 5.0 chắc chắn); Knight Bulwark
>   (round 4: −75% + phản 25%) + Second Wind (xóa debuff dưới 30% HP 1 lần);
>   Archer xen kẽ đánh thường/aimed (xuyên 45%, variance hẹp, +20%).
> - Quái: rotation + telegraph; 4 skill flavor thành thật
>   (leap/wing_clippers/trail_haze/cigar_smoke); elite affix pool cho regular
>   gate modifier + final boss 2 affix; regen/evasive wire thật.
> - Bakunawa 3 phase (P1 −12% vào + stir +20% dưới 2/3 HP; P2 eclipse +50%;
>   P3 enrage +80% + devour telegraph ×3.0), shed DOT mỗi lần chuyển phase.
> - Status: tag `slow` (frost rune), cleanse có điều kiện, venom cap 25% maxHP.
> - Rune/deity: piercing tuân cap 60%, heal budget 8% maxHP/round, miễn nhiễm
>   budget 2 lần/trận, blessing mọi slot pantheon (1/0.5/0.25, trùng key lấy
>   max), rune mới swiftness/eagle-eye/frost (+ seed 19–21, Frost vào túi gb).
> - Encounter: mob HP ×2.0 / ATK ×0.93 / DEF ×0.45 curve, difficulty
>   +8%/level cap +50%; portal-balance giữ (gate 1 >60%, gate 4 starter <50%,
>   final boss upgraded >80%, late upgraded >50%).
> - Test kiểm toán exploit mới: `tests/exploit-guards.test.ts` (streak,
>   bet validation, enhance-fail, ranked claim theo bracket, duel refund,
>   boss-loss, crash EV, loot EV, DailyCycle 17:00 UTC).
| Aswang Queen | Hồi 10% sát thương gây ra; miễn poison/venom |
| Gear rơi | Weapon/armor 50/50; chọn đều roster có isAvailable đúng tier |
| Rare gear | ATK 80–120, CRIT 2–4%; armor HP 400–600, DEF 40–60 |
| Mythic gear | ATK 160–240, CRIT 4–6%; armor HP 800–1.200, DEF 80–120 |
| Legendary gear | ATK 320–480, CRIT 6–8%; armor HP 1.600–2.400, DEF 160–240 |
| Rune | Roll đều trong pool/tier đã seed, không thêm random rolledValue |
| Socket | Một native + một opposite miễn phí; chỉ mua thêm native theo socket_unlock_cost |
| Ascension | Prestige, không tăng stat hoặc blessing; ghi rõ trước và sau thao tác |

Đây là mặc định mới cho flow, không tuyên bố port số liệu boss/elite từ bản gốc.
Thông số rương giữ đúng §5, các drop item độc lập với nhau và currency luôn được cấp.

### Battle upgrade Phase 4–6 (2026-09)

- **Phase 4**: final boss mỗi Gate một skill riêng + telegraph 4k+3/đòn nặng
  4k+4; 5 modifier hành vi (reflect/drain/enrage/shielded/rupture), Gate 4–5
  xếp chồng 2 modifier (clamp); 5 affix mới (executioner/bulwark/lifedrinker/
  berserk/deadeye), elite 1–2 / final boss 3; weekly modifier hunt
  (bloodmoon/frenzy/drought); Tower `/raid tower` (migration 0015).
- **Phase 5**: World Boss pool chung/server + purse theo rank (`boss_state`,
  `boss_spawn_queue`, `boss_attack_log`, `auto_raids`, `boss_top_damage`,
  migration 0016); Guild War board `/raid wwar` (`user_guild_activity`);
  season payout `/ranked season` (`season_end_payload` + `last_season_claim_id`,
  migration 0017).
- **Phase 6**: `/raid preview` (100 sims, read-only), `/raid sweep` (60%,
  tốn cooldown, không rương), gợi ý loadout theo modifier trong menu Gate.
- Test mới: `gate-modifiers`, `weekly-modifier`, `tower`, `world-boss`,
  `ranked-season`, `preview`, `sweep` (mock + PGlite); portal-balance pins giữ.

## Kiểm chứng và triển khai

- [x] 34 test domain/integration/Discord collector qua.
- [x] TypeScript build và ESLint qua.
- [x] pnpm frozen lockfile install qua, không chạy dependency install scripts.
- [x] Rà lại quyền sở hữu, debit/credit, rollback và session expiry; giữ thay đổi có sẵn.

Test domain, giao dịch PGlite và giả lập Discord collector ở `tests/`.
PGlite chạy một connection, không phải bài thử contention nhiều connection của PostgreSQL thật.
Không chạy bot, deploy slash commands hoặc migrate/seed DB thật trong phiên này.
Cần `pnpm deploy:commands` và restart bot để dùng `/raid hunt|boss`, các subcommand casino và lệnh mới.
Nếu DB chưa có roster thì chạy migration/seed theo README trước.

`wrand` 1.2.0 đã xác minh chạy trong bản build Node ESM bằng import trực tiếp
`wrand/lib/randomPicker.js`. Wrapper bắt buộc truyền RNG cho `pick`;
deck dùng RandomPicker removeOnPick. Đã cài thành công từ pnpm frozen lockfile.

## Ghi nhận kỹ thuật

Rà flow phát hiện lỗi có sẵn: gear starter không có socket, rune seed là fraction
nhưng combat chia thêm 100, Aegis chưa chặn một hit, Blight chưa giảm ATK,
duration debuff kiểm tra ngược snapshot, và summon thiếu seed có thể commit debit
cùng một phần pull. Đã sửa và bổ sung test. Giữ tài liệu port cũ ở `port-history.md`.
`.gitignore` đổi `data/` thành `/data/` để seed source không bị loại khỏi Git.

### Unified outcome selection

All discrete outcome selections now use wrand with an explicit seeded RNG, including
Mage multiplier/debuff, raid drops, enhancement, Crash, combat procs, crit, coin and dice.
This supersedes the earlier gameflow exceptions for crit and coin. Shared helpers live
in src/utils/weightedRandom.ts. Probability inputs use fractions; percentage callers
convert explicitly. Zero-weight outcomes are excluded; finite probabilities are clamped
to [0, 1] to preserve guaranteed/impossible stat outcomes. wrand assigns exact cumulative
weight boundaries to the preceding outcome (unlike the previous strict comparisons).
Numeric reward/stat ranges and continuous damage variance retain direct seeded sampling;
crypto remains responsible for IDs and seeds. Equal seeds replay deterministically within
this implementation; outcomes at exact boundaries can differ from older versions.
