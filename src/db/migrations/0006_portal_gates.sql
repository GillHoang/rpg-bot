-- 0006: portal hunt v2 — 5 Gate × 10 tầng, mỗi Gate 1 cột tiến độ.
-- Thay thế cột portal_gates_cleared đơn từ 0005.
ALTER TABLE "user_character" ADD COLUMN "gate1_tiers_cleared" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_character" ADD COLUMN "gate2_tiers_cleared" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_character" ADD COLUMN "gate3_tiers_cleared" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_character" ADD COLUMN "gate4_tiers_cleared" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_character" ADD COLUMN "gate5_tiers_cleared" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_character" ADD CONSTRAINT "gate1_tiers_valid" CHECK ("gate1_tiers_cleared" BETWEEN 0 AND 10);
ALTER TABLE "user_character" ADD CONSTRAINT "gate2_tiers_valid" CHECK ("gate2_tiers_cleared" BETWEEN 0 AND 10);
ALTER TABLE "user_character" ADD CONSTRAINT "gate3_tiers_valid" CHECK ("gate3_tiers_cleared" BETWEEN 0 AND 10);
ALTER TABLE "user_character" ADD CONSTRAINT "gate4_tiers_valid" CHECK ("gate4_tiers_cleared" BETWEEN 0 AND 10);
ALTER TABLE "user_character" ADD CONSTRAINT "gate5_tiers_valid" CHECK ("gate5_tiers_cleared" BETWEEN 0 AND 10);
ALTER TABLE "user_character" DROP COLUMN IF EXISTS "portal_gates_cleared";
ALTER TABLE "user_character" DROP CONSTRAINT IF EXISTS "portal_gates_cleared_nonnegative";
